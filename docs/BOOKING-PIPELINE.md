# 41 Closer booking pipeline (/ai-closer)

What happens between a Meta ad click and a demo call, and which piece does what.

```mermaid
flowchart TD
  A[Meta ad click<br/>utm_* + fbclid] --> B[/ai-closer form/]
  B --> M[closer-analytics.js<br/>visitor id, first/last touch,<br/>section dwell, scroll, engaged time]
  M -->|sendBeacon /api/track| N[GA4 Measurement Protocol<br/>event: closer_journey]
  B -->|POST /api/closer-lead| C[Twenty: Person + Company<br/>Opportunity SCREENING, CLOSER_41<br/>statusNotes: tier, UTM, fbclid, UA, journey]
  C --> P[Meta CAPI: Lead always<br/>+ QualifiedLead when tier A/B]
  C --> D[Telegram alert to Alexander<br/>TIER first, wa.me link]
  C --> E[Resend email copy<br/>to alexander@41labs.ai]
  C --> F[Hermes intake<br/>event: lead_created]
  B --> G[Cal.com inline embed<br/>prefilled, metadata: opportunityId]
  G --> H[(alexander@41labs.ai calendar)]
  I[Vercel cron every 5 min<br/>GET /api/cron/booking-sync] -->|service account, read-only| H
  I -->|match guest email / phone| C
  I --> J[Twenty: stage MEETING<br/>nextAction + followUp]
  I --> K[Meta CAPI: Schedule<br/>event_id schedule_oppId]
  I --> L[Hermes: booked / finish_booking /<br/>reminder_24h / reminder_1h]
```

Plain text version:

```
ad click -> /ai-closer page -> closer-analytics.js records the visit
                                 |-> sendBeacon /api/track -> GA4 closer_journey   [where they went, how long]
         -> /ai-closer form -> /api/closer-lead
                                 |-> Twenty (SCREENING deal)            [the record]
                                 |-> Meta CAPI Lead (+ QualifiedLead if tier A/B)  [what the ads optimise on]
                                 |-> Telegram + Resend email            [speed to lead, backup]
                                 |-> Hermes  lead_created               [41 Closer takes over on WhatsApp]
            everyone  -> Cal.com embed (fires bookingSuccessful, prefilled, carries the deal id)

every 5 min: /api/cron/booking-sync
   calendar (last 2 days of updates + next 25h) -> match to deal
     new booking   -> MEETING + nextAction + followUp, CAPI Schedule, Hermes booked
     23-24h before -> Hermes reminder_24h
     55-60m before -> Hermes reminder_1h
   tier A/B, 15 min to 24 h old, no booking -> Hermes finish_booking (once)
```

## Files

| File | Job |
|---|---|
| `api/closer-lead.js` | Form POST. Twenty write, then alert + Hermes in parallel. Always 200 to the visitor. |
| `api/cron/booking-sync.js` | The 5-minute cron. `runBookingSync()` is exported for tests. |
| `api/_lib/lead-alert.js` | Telegram + email. Resend if a key is set, otherwise Gmail via the service account. |
| `api/_lib/hermes.js` | Hermes intake call (3s timeout, skip when env missing). |
| `api/_lib/meta-capi.js` | SHA-256 hashing, `fbp`/`fbc`, Lead / QualifiedLead / Schedule payloads, batched send. |
| `closer-analytics.js` | Browser journey recorder. Loads before `ai-closer.js`, exposes `window.cl41`. |
| `api/track.js` | Journey beacon sink. Clamps the payload, forwards `closer_journey` to GA4. |
| `api/_lib/journey.js` | Clamps an untrusted journey payload and turns it into one CRM line. |
| `api/_lib/google-calendar.js` | Service-account JWT (node crypto, no SDK), event listing, booking detection. |
| `api/_lib/twenty.js` | Candidate search + PATCH. |
| `api/_lib/notes.js` | Parses statusNotes, owns the idempotency markers. |
| `vercel.json` | `crons` entry (`*/5 * * * *`) and `maxDuration: 60` for the cron. The team is on Vercel Pro, so a 5-minute cron is allowed. |

Files in `api/_lib/` start with an underscore, so Vercel does not deploy them as functions.

## Hermes intake contract

`POST ${HERMES_BASE_URL}/api/intake/landing-lead`, header `x-intake-key: ${HERMES_INTAKE_KEY}`, JSON body:

```json
{ "event": "lead_created",
  "lead": { "name": "Tan Wei Ming", "phone": "+6591234567", "email": "wm@tanaircon.sg",
            "company": "Tan Aircon Services", "role": "owner", "enquiries": "50to150",
            "saleValue": "200to1k", "jobs": ["quotes", "bookings"], "tier": "A",
            "fitReason": "...", "notes": "...",
            "utm": { "source": "facebook", "campaign": "...", "content": "..." },
            "fbclid": "abc123", "twentyOpportunityId": "uuid-or-null" } }
```

`role`, `enquiries`, `saleValue` and `jobs` are the raw form values the page sends. `twentyOpportunityId` is `null` when the CRM write failed.

The cron sends the same endpoint with `event` = `booked`, `finish_booking`, `reminder_24h` or `reminder_1h`, a smaller `lead` (`name, phone, email, company, tier, twentyOpportunityId`) and, except for `finish_booking`, `booking: { start, end, meetLink }` (ISO UTC).

## Idempotency: why markers in Twenty

The cron writes marker lines into the opportunity's `statusNotes`:

```
[booked:<calendarEventId>]                 deal bound to this booking, stage moved
[sent:capi_schedule:<calendarEventId>]     Meta Schedule event accepted, per booking
[sent:booked:<eventId>]                    Hermes told about the booking
[sent:reminder_24h:<eventId>@<startIso>]   reminder sent for this start time
[sent:reminder_1h:<eventId>@<startIso>]
[sent:finish_booking]
```

This project has no KV or Blob store, the opportunity is already the record the cron reads every run, and a human looking at the deal can see exactly what went out. Each send is **claimed first** (marker written), then sent, and the marker is removed if the send fails. So reruns retry failures but never double-send. Reminder markers include the start time, so if Alexander moves the call the reminders re-arm for the new slot (and `nextAction` / `followUp` are updated).

To replay a step on purpose, delete its marker line from the deal's notes in Twenty.

## Rules worth knowing

- **Calendar unreadable = do nothing.** If the calendar read fails the cron stops before touching Twenty, so nobody who might have booked gets a "finish your booking" nudge. The cron answers `502` with the error, which shows as a failed run in Vercel's cron logs.
- **Matching** is on guest email (attendees, not the organiser) and any email or phone typed into the booking form (Google puts form answers in the event description). Phones match on the last 8 digits. Only deals whose notes contain `Form: 41labs.ai/ai-closer` are considered.
- **Unmatched bookings** are listed in the cron response (`unmatched`) and never write anything. If an unmatched booking contains a lead's full name, that lead is not sent `finish_booking`.
- **Stage** only moves `SCREENING -> MEETING`. A deal already at MEETING keeps its stage but still gets CAPI + Hermes.
- **finish_booking** only for tier A/B, still SCREENING, 15 minutes to 24 hours after the form. The 24-hour cap stops the first deploy from nudging two weeks of old leads.
- **reminder_24h** is skipped when the booking was made less than 25 hours before the call (the booking confirmation just went out).
- **reminder_1h** window is 55 to 60 minutes before the call, exactly one 5-minute cron tick. If Vercel skips or delays that tick, the reminder is missed rather than sent late.
- **CAPI** `event_time` is when the booking was made (Meta rejects events older than 7 days, so older bookings use "now"). `fbc` is the REAL `_fbc` cookie when the notes carry one, falling back to `fb.1.<deal created ms>.<fbclid>` for leads saved before 15 Sep 2026. `client_user_agent` comes from the form request, stored as a `UA:` line in the notes. Leads created before this deploy have no UA line.
- **Race**: the cron overwrites `statusNotes` with its own copy plus the new marker. An edit Alexander makes to the same deal's notes in the same second could be lost. Put hand notes in Twenty notes/tasks, not in `statusNotes`.

## The Cal.com webhook (20 Sep 2026)

`POST /api/cal-webhook` is now the fast, exact path for bookings. The cron stays as the
backstop and as the clock for reminders.

**Why.** The cron matched a booking to a deal by pulling emails and phone numbers out of
the calendar event text. Alan Ong booked twice, once as `onggl@cdgtaxi.com` and once as
`onggl@cdgtaxi.com.sg`. Seven bookings matched nothing at all. We were already sending
`metadata[opportunityId]` into the Cal.com embed from `ai-closer.js` and never reading it
back. This endpoint reads it, so the match is exact. Email is kept only as a fallback for
a booking made outside the page.

| Cal.com event | What happens |
|---|---|
| `BOOKING_CREATED` | stage to MEETING, follow-up set, Meta `Schedule` keyed `schedule_<oppId>`, Closer told `booked` |
| `BOOKING_RESCHEDULED` | follow-up moved, Closer told `rescheduled`. **No second Meta event**: moving a call is not a second conversion |
| `BOOKING_CANCELLED` | stage back to SCREENING, booking marker removed so they re-enter the chase list, Closer told `cancelled` |
| anything else | acknowledged with 200 and ignored |

**Security.** `CAL_WEBHOOK_SECRET` must be set, and the same value must be in the Cal.com
webhook's Secret field. Signature is HMAC-SHA256 of the raw body, compared with
`timingSafeEqual`. With no secret configured the endpoint answers 503 and writes nothing,
rather than trusting anyone who finds the URL.

**Idempotency.** Every send is claimed in the SAME write that records the booking, then
released if it fails. Claiming in a second write meant a failed write could report one
booking to Meta twice, and could make the Closer send "you are booked in" again on a
Cal.com retry. Markers: `[booked:<uid>]`, `[sent:capi_schedule:<uid>]`,
`[sent:hermes_booked:<uid>]`. The cron uses the same keys, so whichever arrives first
wins and the other does nothing.

**Failures answer 200.** Cal.com retries a non-200 for hours. A Twenty outage is reported
in the response body instead, and the cron picks the booking up on its next run.

## Traps (14-15 Sep 2026)

Each of these cost hours. They are written down because none of them look like bugs.

### `QualifiedLead` is server-side. Searching the page for it finds nothing, correctly.

It is sent from `api/closer-lead.js` over the Conversions API, tier A and B only. There is
no browser copy, so `grep QualifiedLead ai-closer.js` returns 0 and that is the design: a
server-to-server call survives ad blockers and iOS, a browser pixel does not. An outside
reviewer has already concluded "QualifiedLead is not tracking" from this. Verify the
**event**, never the page:

```bash
curl "https://graph.facebook.com/v21.0/24659272643698089/stats?aggregation=event&access_token=$META_ADS_ACCESS_TOKEN"
```

### Meta's `/stats` endpoint runs about a day behind.

It returns hourly buckets that end roughly 24 hours ago, while `last_fired_time` can look
even staler. Do not design a "the number should go from 7 to 8" test around it: today's
conversions are not in it. For anything same-day use Events Manager, or set
`META_CAPI_TEST_EVENT_CODE` and watch Test Events.

### One conversion appears under many `action_type` names. That is not double counting.

In an insights `actions` array, `ViewContent` showed under seven aliases
(`view_content`, `omni_view_content`, `offsite_conversion.fb_pixel_view_content`,
`onsite_web_view_content`, `*_add_20_s_calls`, `*_add_meta_leads`) **all reading 25**.
To tell genuinely distinct conversions apart, request
`action_attribution_windows=['1d_click','7d_click','1d_view']` and read the split. Real
double counting shows up as a doubled `1d_click` on **one** ad, not as two ads with one
each.

### Never put Alexander's real email or phone in a test that hits the live pixel.

A curl test using `alexander@41labs.ai` + `6580124848` was hashed, matched to his own
Facebook profile, checked against ads he had been shown, and recorded as a **view-attributed
conversion** on `cold_whatsapp_B`. It inflated Lead and QualifiedLead by one each for days
and looked exactly like a double-fire. Use an address with no Facebook account, or
`META_CAPI_TEST_EVENT_CODE`.

### `Schedule` has three senders. They must share one id.

The browser pixel, `POST /api/meta-event`, and `api/cron/booking-sync.js` can all send
`Schedule` for the same booking, because Cal.com writes into the Google Calendar the cron
scans. All three key on `schedule_<opportunityId>`.

Until 14 Sep the Cal.com `bookingSuccessful` callback ran `onCloserBooked()` with **no
argument**, so the browser minted a random uuid: it agreed with `/api/meta-event` and
disagreed with the cron. One booked call counted twice and every cost-per-booked-call
figure read half its real value.

⚠️ A test that calls `onCloserBooked('schedule_x')` by hand proves nothing. It only shows
that two things you triggered yourself agree. **Fire the vendor's own registered handler**
(find the `['on', {action:'bookingSuccessful', callback}]` entry in `Cal.q` and invoke it)
and assert the id equals what the third sender would use.

### Events sent later by a server need the browser's cookies written down.

Meta credited the ads with `Lead` and with **nothing else**: `Schedule` appeared in no
attribution window over seven days. `Lead` is sent from the browser carrying `_fbp` and
`_fbc`. `Schedule` is sent minutes later by the cron, and `statusNotes` only stored
`fbclid`, so the cron rebuilt an `fbc` from `opp.createdAt`, which is not the click time.
Hashed email plus a guessed-timestamp `fbc` was not enough to match.

Now `api/closer-lead.js` writes `fbp=` and `fbc=` lines into the notes,
`api/_lib/notes.js` parses them, and the cron passes them through. **Rule: any event a
server sends later needs the browser identifiers persisted at capture time. Hashed PII
alone does not attribute.**

### Custom conversion rules are immutable, and the API lies about it.

The original "41 Closer Qualified Lead" rule was
`{"and":[{"event":{"eq":"QualifiedLead"}},{"or":[{"value":{"eq":"41closer-qualified"}}]}]}`
which compares a **string** against Meta's **numeric** `value` field and can never match,
so `last_fired` stayed `None` forever. A POST to update the rule returns
`{"success": true}` and silently changes nothing. Create a new one instead: creation needs
`event_source_id` and rejects a single-condition rule ("A conversion rule is required at
creation time"), hence the url clause. Live one is
**41 Closer Qualified Lead v2**, id `2848588148855565`:
`{"and":[{"event":{"eq":"QualifiedLead"}},{"url":{"i_contains":"41labs.ai"}}]}`.

⚠️ Do **not** paste the drop-in from `41closer-marketing/ads/2026-09-batch/tracking-snippet.md`
onto the page. It puts a string in Meta's numeric `value` field. That snippet is what
created the broken rule.

### Test records in Twenty hijack real bookings.

The cron matches bookings to deals **by contact**, pulling emails out of the calendar event
description, and every Cal.com invite lists `alexander@41labs.ai` in its "Who:" block. A
test deal carrying that address swallowed six real bookings. Delete test deals the same day
you make them, contact record included.

### Google appointment schedules are invisible to the Calendar API.

They render in the UI and cannot be listed, audited or deleted programmatically. Same for
which calendars a viewer has ticked in their sidebar (`calendarList.patch` is not exposed).
A booking that appears "twice" is usually one event id rendered on the organiser's calendar
and on an attendee calendar the same person also has open: a self-test artifact, not a
duplicate.

## Environment variables

Checked against `~/.config/41labs/*.env` and `vercel env ls` for `41labs/41labs-website` on 2026-09-11. "Vercel" means the 41labs-website project's Production env.

| Variable | Used by | Required | Where to get it | Exists today |
|---|---|---|---|---|
| `TWENTY_API_KEY` | lead, cron | yes | Twenty settings, API keys | Vercel: yes. `platform.env`: yes |
| `TWENTY_BASE_URL` | lead, cron | no | defaults to the Railway Twenty URL | not needed |
| `TELEGRAM_BOT_TOKEN` | lead alert | yes for Telegram | @fortyonelabs_ops_bot | Vercel: yes. `comms.env`: yes |
| `LEAD_ALERT_CHAT_ID` | lead alert | no | see "Telegram routing" | no (new) |
| `LEAD_ALERT_THREAD_ID` | lead alert | no | topic thread id | no (new) |
| `TELEGRAM_GROUP_ID`, `TELEGRAM_INBOX_THREAD_ID` | lead alert fallback | no | already used by `/api/audit` | Vercel: yes |
| `RESEND_API_KEY` | lead email | yes for email | resend.com, API keys | `platform.env` has the name but the value is **empty**. Vercel: no |
| `RESEND_FROM` | lead email | no | default `41 Labs Leads <leads@41labs.ai>`, needs 41labs.ai verified in Resend | no |
| `LEAD_ALERT_EMAIL_TO` | lead email | no | default `alexander@41labs.ai` | no |
| `HERMES_BASE_URL` | lead, cron | yes for Hermes | the Hermes prod URL, no trailing path | no (new) |
| `HERMES_INTAKE_KEY` | lead, cron | yes for Hermes | shared secret, must equal the value Hermes checks | no (new) |
| `CRON_SECRET` | cron | **yes** (cron fails closed without it) | any long random string. Vercel sends it as `Authorization: Bearer` automatically | `platform.env`: yes. Vercel: no |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | cron | yes | the `claude-drive@claude-drive-access-492002` key | `google.env`: yes, but as a **file path**. On Vercel it must be the JSON itself (or base64 of it) |
| `BOOKING_CALENDAR_ID` | cron | no | default `alexander@41labs.ai` | not needed |
| `BOOKING_CALENDAR_IMPERSONATE` | cron | no | only for domain-wide delegation. Tested 2026-09-11: the SA is **not** delegated the Calendar scope, so leave unset and share the calendar instead | not needed |
| `BOOKING_EVENT_MATCH` | cron | no | default `41 Closer`. Comma-separated, case-insensitive, matched on event title + description | not needed if the schedule title contains "41 Closer" |
| `META_CAPI_TOKEN` | lead, cron | yes for CAPI | `META_ACCESS_TOKEN` in `meta.env` already works: system-user token, never expires, `ads_management`, can read pixel `24659272643698089` (checked 2026-09-11) | no (new name). Value exists as `META_ACCESS_TOKEN` |
| `META_CAPI_PIXEL_ID` | cron | no | default `24659272643698089` (same as `META_PIXEL_ID` in `meta.env`) | not needed |
| `CAL_WEBHOOK_SECRET` | cal-webhook | **yes** (endpoint fails closed without it) | Cal.com, Settings, Webhooks, the Secret field. Stored in `~/.config/41labs/calcom.env` | Vercel: yes (20 Sep) |
| `META_CAPI_TEST_EVENT_CODE` | lead, cron | no | Events Manager, dataset, Test events tab. When set, every CAPI event goes to Test Events only | set only while testing |


| `GA4_API_SECRET` | `/api/track` | no (beacons are dropped without it) | GA4 Admin > Data Streams > the 41labs.ai stream > Measurement Protocol API secrets | not set yet |
| `GA4_MEASUREMENT_ID` | `/api/track` | no | defaults to `G-VQQ49H8N1L` | not needed |

## What Meta gets back, and why

The ad account can only optimise for what we report. Three events, deepest last:

| Event | Fires | Value | Why |
|---|---|---|---|
| `Lead` | every form submit, including tier C | none | Volume, so the pixel keeps learning. No value, so Meta never bids to buy more tier C. |
| `QualifiedLead` | tier A and B only | S$96 | **This is the event ad sets should optimise on.** MODELLED, not measured: base case 5% book x 20% close x S$9,600 build fee. See the warning below. |
| `Schedule` | a call is confirmed | S$500 | Set by the ads contract, not derived. The funnel implies nearer S$2,000, so this UNDERSTATES a booked call about 4x: safe for bidding, wrong for reading ROAS. Sent by the browser AND the cron, same id. |

⚠️ **No ad-sourced client has ever been traced.** Checked 13 Sep 2026 against Hermes and
Twenty: no lead carrying an ad referral has reached a won stage, the Hertz deal has
leadSource "WhatsApp inbound" with no Hermes lead record and no ad referral, and only
83 of 1,157 non-demo July leads (7%) carry an ad referral at all. The line in
41-CLOSER-NUMBERS.md saying "Hertz came from this one" is not supported by either system.
Raise these values to a measured rate only once a traced ad-sourced deal closes.

The two values are therefore modelled, so treat them as direction not law. What actually
steers Meta's bidding is the ratio between them (about 1:21), and that holds across every
scenario in the numbers doc. The absolute figures only change how ROAS reads in Ads Manager.
The value lives in `VALUE_QUALIFIED_LEAD` in code and is deliberately NOT set on the Meta
custom conversion: a fixed value there would override what we send and freeze it.

Both halves of the loop run: the browser pixel AND the Conversions API. They share an
`event_id` minted per submit in `ai-closer.js`, so Meta deduplicates instead of double
counting. **If you ever change how that id is generated, change it in both places or every
cost-per-lead number in Ads Manager silently halves.**

Server-side is not optional here. Ad blockers and iOS strip the browser pixel, and the
server holds what Meta matches best on: the phone number they typed, their IP, their user
agent, and the `_fbp` / `_fbc` cookies the page read for us.

### Switching the campaign over

Once `QualifiedLead` has ~50 events in a week, move the ad set's optimisation event from
`Lead` to `QualifiedLead`. Below that volume Meta cannot exit the learning phase, so leave
it on `Lead` and just watch the qualified rate in Events Manager.

### Telegram routing

The alert goes to `LEAD_ALERT_CHAT_ID` (+ `LEAD_ALERT_THREAD_ID` if set). If `LEAD_ALERT_CHAT_ID` is unset it falls back to `TELEGRAM_GROUP_ID` + `TELEGRAM_INBOX_THREAD_ID`, already set on Vercel. That is the 41 Labs group (`-1003997747426`), `inbox` topic (thread `27`), the same place `/api/audit` posts website leads. So alerts work on deploy with no new variables.

Chosen default: **41 Labs group, inbox topic 27.** There is no leads or sales topic in `~/.config/41labs/telegram-topics.json`, and inbox is where website leads already land. Two better options:

- **Straight to Alexander's phone:** DM `/myid` to @fortyonelabs_ops_bot, then set `LEAD_ALERT_CHAT_ID` to the user id it returns and leave `LEAD_ALERT_THREAD_ID` unset. A DM notifies harder than a group topic.
- **A dedicated `leads` topic:** create the topic in the group, get its `message_thread_id`, set `LEAD_ALERT_CHAT_ID=-1003997747426` and `LEAD_ALERT_THREAD_ID=<id>`, and add it to `telegram-topics.json`.

## One-time human steps

1. **Share the calendar with the service account.** Google Calendar (alexander@41labs.ai), Settings, the calendar, "Share with specific people", add `claude-drive@claude-drive-access-492002.iam.gserviceaccount.com` with **"See all event details"**. (Tested 2026-09-11: today the API answers 404, meaning not shared. The Calendar API is already enabled on the project.)
2. ~~Appointment schedule setup.~~ **Done and gone.** The Google appointment schedule was deleted on 14 Sep 2026; Cal.com is the only booking path. Cal.com writes its bookings into the same Google Calendar, so the cron still sees them. Its event titles read "41 Closer between Alexander Lee and <name>", which still contains "41 Closer".
3. **Resend.** Create an API key. Verify `41labs.ai` in Resend: add the DKIM TXT (`resend._domainkey`), and the `send` subdomain MX + SPF records it shows. Today 41labs.ai has no Resend records. Until then, set `RESEND_FROM="41 Labs Leads <onboarding@resend.dev>"`. That only delivers to the Resend account owner's address, so the account must be alexander@41labs.ai.
4. **Hermes.** Once the `landing-lead` intake is deployed, set the same `HERMES_INTAKE_KEY` on Hermes and here, plus `HERMES_BASE_URL`.
5. **Vercel env vars** (Production) for `41labs/41labs-website`:
   ```bash
   cd ~/Projects/41labs-website
   vercel env add CRON_SECRET production                 # paste the value from platform.env
   vercel env add GOOGLE_SERVICE_ACCOUNT_JSON production < ~/.config/41labs/google-drive-sa.json
   vercel env add META_CAPI_TOKEN production             # paste META_ACCESS_TOKEN from meta.env
   vercel env add RESEND_API_KEY production
   vercel env add HERMES_BASE_URL production
   vercel env add HERMES_INTAKE_KEY production
   # optional: LEAD_ALERT_CHAT_ID / LEAD_ALERT_THREAD_ID / RESEND_FROM
   ```
   Don't use `vercel env pull` to check them. It blanks secrets.
6. **Deploy** (`vercel --prod`). The cron appears under the project's Settings, Cron Jobs.
7. ~~Formspree.~~ **Removed.** It capped out on the free tier. Email now goes through Gmail with the service account's `gmail.compose` delegation, which needs no new account and has no practical quota.

## Testing

**Unit tests (no network):**

```bash
npx playwright test tests/closer-lead-api.spec.ts tests/booking-lib.spec.ts tests/booking-sync-cron.spec.ts --project=chromium
```

They cover alert formatting, failure isolation, the Hermes contract and timeout, cron auth, booking to MEETING + CAPI + Hermes, SHA-256 vectors, `fbc`, rerun dedupe, finish_booking timing, reminder windows and calendar failures.

**End to end, safely (on a preview deployment):**

1. Deploy a preview (`vercel`) with the env vars above set for Preview, plus `META_CAPI_TEST_EVENT_CODE=<code from Events Manager>` so CAPI events land in Test Events only. Point `HERMES_BASE_URL` at a Hermes preview/staging if one exists, or leave it unset (Hermes steps are then skipped and nothing is marked).
2. Submit the form on the preview's `/ai-closer?utm_source=test&utm_content=e2e&fbclid=TEST123` with your own name, a number you own and a `+e2e` email. Expect: Telegram alert, email, SCREENING deal in Twenty with a `UA:` line.
3. Book a slot through the calendar with the same email.
4. Trigger the cron by hand instead of waiting:
   ```bash
   curl -s -H "Authorization: Bearer $CRON_SECRET" https://<preview-url>/api/cron/booking-sync | jq
   ```
   Expect `booked: [...]`, the deal at MEETING with `[booked:...]`, `[sent:capi_schedule:<eventId>]` in the notes, and a Schedule event in Events Manager, Test events.
5. Run the curl again. Nothing new should be sent (`sends` empty).
6. Clean up: cancel the test booking, move the test deal to LOST, and unset `META_CAPI_TEST_EVENT_CODE` before production.

Preview deployments don't run crons. Only production does, so step 4 is how you exercise it on a preview.
