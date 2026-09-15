// GET /api/cron/booking-sync  (Vercel cron, every 5 minutes; Bearer CRON_SECRET)
//
// Closes the loop the Google Calendar booking iframe on /ai-closer can't: it
// reads Alexander's calendar with the service account, matches each new
// appointment-schedule booking to the SCREENING 41 Closer deal the form created,
// and then, once each:
//   1. moves the deal to MEETING, sets nextAction + followUp        (Twenty)
//   2. sends the Meta CAPI "Schedule" event (dedupe id schedule_<oppId>)
//   3. tells Hermes: 'booked'
// It also nudges tier A/B leads who never booked ('finish_booking', 15 min to
// 24 h after the form) and sends 'reminder_24h' / 'reminder_1h' before calls.
//
// Idempotency: marker lines in the deal's statusNotes ("[booked:<eventId>]",
// "[sent:...]"). A send is claimed (marker written) BEFORE it goes out and
// released if it fails, so a rerun retries failures but never double-sends.
// See docs/BOOKING-PIPELINE.md.

const crypto = require('crypto');
const { e164Digits, samePhone, formatSgt } = require('../_lib/util');
const notesLib = require('../_lib/notes');
const gcal = require('../_lib/google-calendar');
const { buildScheduleEvent, sendCapiEvent } = require('../_lib/meta-capi');
const { hermesConfigured, postHermesIntake } = require('../_lib/hermes');
const { listCloserCandidates, patchOpportunity } = require('../_lib/twenty');

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const FINISH_MIN_AGE = 15 * MIN;
const FINISH_MAX_AGE = 24 * HOUR;
const R24 = { key: 'reminder_24h', from: 23 * HOUR, to: 24 * HOUR };
const R1 = { key: 'reminder_1h', from: 55 * MIN, to: 60 * MIN };
// No 24h reminder when the booking itself was made less than this before the
// call: the booking confirmation just went out.
const R24_MIN_LEAD = 25 * HOUR;

const iso = (ms) => new Date(ms).toISOString();
const eventStart = (ev) => Date.parse((ev.start && (ev.start.dateTime || ev.start.date)) || '');
const eventEnd = (ev) => Date.parse((ev.end && (ev.end.dateTime || ev.end.date)) || '');

function contactOf(opp) {
  const p = opp.pointOfContact || {};
  const name = p.name || {};
  const emails = [];
  if (p.emails && p.emails.primaryEmail) emails.push(p.emails.primaryEmail);
  for (const e of (p.emails && p.emails.additionalEmails) || []) if (e) emails.push(e);
  const phones = [];
  const ph = p.phones || {};
  if (ph.primaryPhoneNumber) {
    const n = String(ph.primaryPhoneNumber);
    phones.push(n.startsWith('+') || !ph.primaryPhoneCallingCode ? n : `${ph.primaryPhoneCallingCode}${n}`);
  }
  for (const a of ph.additionalPhones || []) {
    if (a && a.number) phones.push(`${a.callingCode || ''}${a.number}`);
  }
  const phoneDigits = phones.length ? e164Digits(phones[0]) : '';
  return {
    firstName: name.firstName || '',
    lastName: name.lastName || '',
    fullName: `${name.firstName || ''} ${name.lastName || ''}`.trim(),
    emails: emails.map((e) => String(e).trim().toLowerCase()),
    phones,
    phone: phoneDigits ? `+${phoneDigits}` : '',
  };
}

function hermesLead(opp) {
  const c = contactOf(opp);
  const { tier } = notesLib.parseLeadNotes(opp.statusNotes);
  return {
    name: c.fullName,
    phone: c.phone,
    email: c.emails[0] || '',
    company: (opp.company && opp.company.name) || '',
    tier,
    twentyOpportunityId: opp.id,
  };
}

function bookingOf(ev) {
  return { start: iso(eventStart(ev)), end: iso(eventEnd(ev)), meetLink: gcal.meetLink(ev) };
}

function contactMatches(opp, contacts) {
  const c = contactOf(opp);
  if (c.emails.some((e) => contacts.emails.includes(e))) return true;
  return c.phones.some((p) => contacts.phones.some((q) => samePhone(p, q)));
}

// Already bound to this event wins; else a contact match, preferring deals not
// yet bound to another booking, newest first.
function matchOpp(ev, opps) {
  const bound = opps.find((o) => notesLib.boundEventIds(o.statusNotes).includes(ev.id));
  if (bound) return bound;
  const contacts = gcal.extractContacts(ev);
  const hits = opps.filter((o) => contactMatches(o, contacts))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return hits.find((o) => notesLib.boundEventIds(o.statusNotes).length === 0) || hits[0] || null;
}

async function readBookings({ env, fetchImpl, t }) {
  const sa = gcal.loadServiceAccount(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (!sa) throw new Error('calendar_not_configured');
  const token = await gcal.getAccessToken(sa, { fetchImpl, nowSec: t / 1000, sub: env.BOOKING_CALENDAR_IMPERSONATE || undefined });
  const calendarId = env.BOOKING_CALENDAR_ID || 'alexander@41labs.ai';
  // New bookings (updated in the last 2 days) + anything starting in the next
  // 25h (for reminders on bookings made days ago).
  const [recent, upcoming] = await Promise.all([
    gcal.listEvents({ token, calendarId, fetchImpl, params: { updatedMin: iso(t - 2 * DAY), orderBy: 'updated' } }),
    gcal.listEvents({ token, calendarId, fetchImpl, params: { timeMin: iso(t), timeMax: iso(t + 25 * HOUR), orderBy: 'startTime' } }),
  ]);
  const byId = new Map();
  for (const ev of [...recent, ...upcoming]) if (ev && ev.id) byId.set(ev.id, ev);
  const match = env.BOOKING_EVENT_MATCH || '41 Closer';
  return [...byId.values()]
    .filter((ev) => gcal.isBookingEvent(ev, match) && Number.isFinite(eventStart(ev)))
    .sort((a, b) => eventStart(a) - eventStart(b));
}

async function runBookingSync({ env, fetchImpl, now }) {
  const t = now();
  const summary = { ok: true, errors: [], booked: [], unmatched: [], finishBooking: [], reminders: [], sends: [] };
  const fail = (msg) => { summary.ok = false; summary.errors.push(String(msg).slice(0, 300)); };
  if (!env.TWENTY_API_KEY) { fail('twenty_not_configured'); return summary; }

  // Calendar first: if we can't see bookings we can't know who booked, so we
  // touch nothing (no stage moves, and above all no "finish your booking" nudges).
  let bookings;
  try {
    bookings = await readBookings({ env, fetchImpl, t });
  } catch (e) {
    fail(`calendar: ${e && e.message ? e.message : e}`);
    return summary;
  }

  let opps;
  try {
    const since = t - 14 * DAY;
    opps = (await listCloserCandidates({ env, fetchImpl, sinceIso: iso(since) }))
      .filter((o) => o && o.id && o.productLine === 'CLOSER_41'
        && ['SCREENING', 'MEETING'].includes(o.stage)
        && Date.parse(o.createdAt) >= since
        && notesLib.parseLeadNotes(o.statusNotes).fromLandingPage);
  } catch (e) {
    fail(`twenty: ${e && e.message ? e.message : e}`);
    return summary;
  }

  const patch = async (opp, fields) => {
    await patchOpportunity({ env, fetchImpl, id: opp.id, fields });
    Object.assign(opp, fields);
  };

  // Claim -> send -> release on failure. 'already' | 'skipped' | 'sent' | 'failed'.
  const once = async (opp, key, configured, send) => {
    // Record the early exits too. An empty sends[] used to be unreadable: it meant
    // "nothing this run", which covers both "already sent" and "not configured", and
    // that ambiguity cost an hour working out whether a booking had reached Meta.
    if (notesLib.hasMarker(opp.statusNotes, key)) {
      summary.sends.push({ opportunityId: opp.id, key, status: 'already' });
      return 'already';
    }
    if (!configured) {
      summary.sends.push({ opportunityId: opp.id, key, status: 'skipped' });
      return 'skipped';
    }
    await patch(opp, { statusNotes: notesLib.addMarker(opp.statusNotes, key) });
    let status;
    try { status = await send(); } catch { status = 'failed'; }
    if (status !== 'sent') {
      // Release so the next run retries. If the release itself fails the marker
      // stays: a missed message beats a duplicate one.
      try { await patch(opp, { statusNotes: notesLib.removeMarker(opp.statusNotes, key) }); } catch { /* keep claim */ }
    }
    summary.sends.push({ opportunityId: opp.id, key, status });
    return status;
  };

  const hermesOn = hermesConfigured(env);
  const boundThisRun = new Set();
  const unmatchedBookings = [];

  for (const ev of bookings) {
    const opp = matchOpp(ev, opps);
    if (!opp) { summary.unmatched.push(ev.id); unmatchedBookings.push(ev); continue; }
    boundThisRun.add(opp.id);
    const startMs = eventStart(ev);
    const startIso = iso(startMs);
    try {
      // 1. Bind + stage. Also refreshes nextAction/followUp if the call moved.
      const bindKey = `booked:${ev.id}`;
      const nextAction = `Demo booked ${formatSgt(startMs)}. Run the leak audit before the call.`;
      if (!notesLib.hasMarker(opp.statusNotes, bindKey)) {
        const fields = { statusNotes: notesLib.addMarker(opp.statusNotes, bindKey), nextAction, followUp: startIso };
        if (opp.stage === 'SCREENING') fields.stage = 'MEETING';
        await patch(opp, fields);
        summary.booked.push({ opportunityId: opp.id, eventId: ev.id, start: startIso });
      } else if (Date.parse(opp.followUp || '') !== startMs) {
        await patch(opp, { nextAction, followUp: startIso });
      }

      // 2. Meta CAPI Schedule.
      // Keyed per booking, not per deal. A flat 'sent:capi_schedule' meant a deal
      // reported its first booking and went silent for every later one, so a
      // reschedule or a second call never reached Meta.
      await once(opp, `sent:capi_schedule:${ev.id}`, !!env.META_CAPI_TOKEN, () => {
        const c = contactOf(opp);
        const parsed = notesLib.parseLeadNotes(opp.statusNotes);
        const created = Date.parse(ev.created || '');
        // Meta rejects events older than 7 days; use the booking time when fresh.
        const eventMs = Number.isFinite(created) && t - created < 6 * DAY ? created : t;
        return sendCapiEvent(buildScheduleEvent({
          opportunityId: opp.id,
          email: c.emails[0],
          phone: c.phone,
          firstName: c.firstName,
          lastName: c.lastName,
          fbclid: parsed.fbclid,
          // The cookies the browser had at lead time. Without these the match is just
          // hashed email plus an fbc rebuilt from a guessed click time, which Meta was
          // not attributing to the ad at all.
          fbp: parsed.fbp,
          fbc: parsed.fbc,
          clickMs: Date.parse(opp.createdAt),
          userAgent: parsed.userAgent,
          tier: parsed.tier,
          eventTimeSec: Math.floor(eventMs / 1000),
        }), { env, fetchImpl });
      });

      // 3. Hermes: booked.
      await once(opp, `sent:booked:${ev.id}`, hermesOn, () =>
        postHermesIntake({ event: 'booked', lead: hermesLead(opp), booking: bookingOf(ev) }, { env, fetchImpl }));

      // 4. Reminders (keyed by start time, so a moved call re-arms them).
      const until = startMs - t;
      const bookedAhead = startMs - Date.parse(ev.created || '');
      for (const r of [R24, R1]) {
        if (until < r.from || until > r.to) continue;
        if (r === R24 && !(bookedAhead >= R24_MIN_LEAD)) continue;
        const status = await once(opp, `sent:${r.key}:${ev.id}@${startIso}`, hermesOn, () =>
          postHermesIntake({ event: r.key, lead: hermesLead(opp), booking: bookingOf(ev) }, { env, fetchImpl }));
        if (status === 'sent') summary.reminders.push({ opportunityId: opp.id, kind: r.key });
      }
    } catch (e) {
      fail(`opp ${opp.id} / event ${ev.id}: ${e && e.message ? e.message : e}`);
    }
  }

  // finish_booking: tier A/B, 15 min to 24 h old, still SCREENING, no booking.
  const bookedUnderName = (name) => {
    const n = name.toLowerCase();
    return n.length >= 3 && unmatchedBookings.some((ev) => `${ev.summary || ''}\n${ev.description || ''}`.toLowerCase().includes(n));
  };
  for (const opp of opps) {
    if (opp.stage !== 'SCREENING' || boundThisRun.has(opp.id)) continue;
    if (notesLib.boundEventIds(opp.statusNotes).length) continue;
    const { tier } = notesLib.parseLeadNotes(opp.statusNotes);
    if (tier !== 'A' && tier !== 'B') continue;
    const age = t - Date.parse(opp.createdAt);
    if (!(age >= FINISH_MIN_AGE && age <= FINISH_MAX_AGE)) continue;
    // A booking under their name we couldn't match (different email, no phone):
    // they probably did book. Never tell a booker to book. Left for a human.
    if (bookedUnderName(contactOf(opp).fullName)) continue;
    try {
      const status = await once(opp, 'sent:finish_booking', hermesOn, () =>
        postHermesIntake({ event: 'finish_booking', lead: hermesLead(opp) }, { env, fetchImpl }));
      if (status === 'sent') summary.finishBooking.push(opp.id);
    } catch (e) {
      fail(`opp ${opp.id} / finish_booking: ${e && e.message ? e.message : e}`);
    }
  }

  return summary;
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const reply = (status, obj) => { res.statusCode = status; res.end(JSON.stringify(obj)); };

  const secret = process.env.CRON_SECRET;
  if (!secret) return reply(500, { ok: false, error: 'cron_secret_not_configured' });
  const auth = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (!safeEqual(auth, `Bearer ${secret}`)) return reply(401, { ok: false, error: 'unauthorized' });

  try {
    const summary = await runBookingSync({ env: process.env, fetchImpl: (...a) => fetch(...a), now: Date.now });
    return reply(summary.ok ? 200 : 502, summary);
  } catch (e) {
    return reply(500, { ok: false, error: 'unexpected', detail: String(e).slice(0, 300) });
  }
};

module.exports.runBookingSync = runBookingSync;
