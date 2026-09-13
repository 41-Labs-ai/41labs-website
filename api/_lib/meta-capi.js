// Meta Conversions API: what we send back to Meta so the ad account learns to
// find buyers instead of form-fillers.
//
// Three events, deepest last:
//   Lead           every form submit. No value: it is only a signal that someone filled in the form.
//   QualifiedLead  Tier A and B only, with a value. THIS is the event ad sets should optimise on.
//   Schedule       a call actually booked, with a bigger value. Sent by the booking cron.
//
// Every event must carry an event_id that the browser pixel also sends, or Meta
// counts the same conversion twice. See ai-closer.js (mints the id) and
// api/closer-lead.js (sends it server-side).
//
// Server-side matters because ad blockers and iOS strip the browser pixel. The
// server has the things Meta matches best on: the phone number they typed, their
// IP, their user agent, and the _fbp / _fbc cookies the page read for us.
//
// Payload shape follows hermes/src/lib/marketing/meta-conversions.ts (Bearer token
// in the header, never in the URL) with action_source 'website'.

const crypto = require('crypto');
const { e164Digits, fetchWithTimeout } = require('./util');

const GRAPH = 'https://graph.facebook.com/v21.0';
const DEFAULT_PIXEL = '24659272643698089';
const SOURCE_URL = 'https://41labs.ai/ai-closer';
const CURRENCY = 'SGD';

// Values Meta optimises against. Set by the ads-side contract at
// 41closer-marketing/ads/2026-09-batch/CONVERSION-TRACKING-SPEC.md: a flat S$500 on
// Schedule, to be tuned later. Kept deliberately as the spec says rather than as the
// funnel implies: 20% of calls close x S$9,600 build fee would put a booked call
// nearer S$2,000, so this UNDERSTATES a booked call by about 4x. That is safe for
// bidding and wrong for reading ROAS, so raise it once the campaign has data.
const VALUE_SCHEDULE = 500;

// QualifiedLead is modelled, not measured: as of 13 Sep 2026 no ad-attributed lead has
// ever reached a won stage. The Hertz deal has leadSource "WhatsApp inbound" in Twenty,
// no Hermes lead record and no ad referral, and only 83 of 1,157 non-demo July leads
// (7%) carry an ad referral at all. So this uses the modelled base case from
// 41 Labs/41-CLOSER-NUMBERS.md section 3: 5% book x 20% close x S$9,600 = S$96.
const VALUE_QUALIFIED_LEAD = 96;

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

const hashEmail = (v) => {
  const s = String(v || '').trim().toLowerCase();
  return s ? sha256(s) : '';
};
const hashPhone = (v) => {
  const s = e164Digits(String(v || ''));
  return s ? sha256(s) : '';
};
// Meta: lowercase, no punctuation. Spaces go too ("Wei Ming" -> "weiming").
const hashName = (v) => {
  const s = String(v || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  return s ? sha256(s) : '';
};

// fbc = fb.<subdomainIndex>.<creationTimeMs>.<fbclid>; subdomain index 1 = 41labs.ai.
const buildFbc = (fbclid, clickMs) => (fbclid ? `fb.1.${Math.floor(clickMs)}.${fbclid}` : '');

// Everything Meta can match a person on. The real _fbc cookie beats one we rebuild
// from the fbclid, because the cookie carries the true click time.
function buildUserData(i) {
  const u = {};
  const em = hashEmail(i.email); if (em) u.em = [em];
  const ph = hashPhone(i.phone); if (ph) u.ph = [ph];
  const fn = hashName(i.firstName); if (fn) u.fn = [fn];
  const ln = hashName(i.lastName); if (ln) u.ln = [ln];
  const fbc = i.fbc || buildFbc(i.fbclid, i.clickMs); if (fbc) u.fbc = fbc;
  if (i.fbp) u.fbp = i.fbp;
  if (i.clientIp) u.client_ip_address = i.clientIp;
  if (i.userAgent) u.client_user_agent = i.userAgent;
  return u;
}

function buildEvent(i) {
  const custom = { content_name: i.contentName || '41closer', ...(i.tier ? { tier: i.tier } : {}), ...(i.custom || {}) };
  if (i.value != null) { custom.value = i.value; custom.currency = i.currency || CURRENCY; }
  return {
    event_name: i.eventName,
    event_time: i.eventTimeSec,
    event_id: i.eventId,
    action_source: 'website',
    event_source_url: i.sourceUrl || SOURCE_URL,
    user_data: buildUserData(i),
    custom_data: custom,
  };
}

// Every form submit. No value on purpose: bidding on this would buy us Tier C.
const buildLeadEvent = (i) => buildEvent({ ...i, eventName: 'Lead', contentName: i.contentName || '41closer-form' });

// Tier A and B only. The event to optimise ad sets on. The '_q' suffix keeps it
// distinct from the Lead that fires on the same submit.
const buildQualifiedLeadEvent = (i) => buildEvent({
  ...i,
  eventName: 'QualifiedLead',
  eventId: `${i.eventId}_q`,
  contentName: i.contentName || '41closer-qualified',
  value: VALUE_QUALIFIED_LEAD,
});

// The visitor opened the booking calendar. The early optimisation proxy: enough volume
// on day one to train the ad set before Schedule has the ~15-25/week it needs.
const buildInitiateCheckoutEvent = (i) => buildEvent({
  ...i,
  eventName: 'InitiateCheckout',
  contentName: i.contentName || '41closer-open-calendar',
});

// They reached the product demo and stayed. Engagement, no value.
const buildViewContentEvent = (i) => buildEvent({
  ...i,
  eventName: 'ViewContent',
  contentName: i.contentName || '41closer-demo',
});

const buildScheduleEvent = (i) => buildEvent({
  ...i,
  eventName: 'Schedule',
  // The cron derives the id from the deal; the browser mints its own and sends the
  // same one to the pixel, so either source can be deduplicated against the other.
  eventId: i.opportunityId ? `schedule_${i.opportunityId}` : i.eventId,
  contentName: '41closer-demo-call',
  value: VALUE_SCHEDULE,
});

// Takes one event or a list. 'sent' | 'skipped' (nothing to send, or not
// configured) | 'failed'. Never throws: a Meta outage must not cost us the lead.
async function sendCapiEvent(event, { env, fetchImpl, timeoutMs = 5000 }) {
  const events = (Array.isArray(event) ? event : [event]).filter(Boolean);
  const token = env.META_CAPI_TOKEN;
  const pixel = env.META_CAPI_PIXEL_ID || DEFAULT_PIXEL;
  if (!token || !events.length) return 'skipped';
  const body = { data: events };
  if (env.META_CAPI_TEST_EVENT_CODE) body.test_event_code = env.META_CAPI_TEST_EVENT_CODE;
  try {
    const r = await fetchWithTimeout(fetchImpl, `${GRAPH}/${pixel}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }, timeoutMs);
    return r.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

module.exports = {
  DEFAULT_PIXEL, CURRENCY, VALUE_QUALIFIED_LEAD, VALUE_SCHEDULE,
  hashEmail, hashPhone, hashName, buildFbc, buildUserData,
  buildEvent, buildLeadEvent, buildQualifiedLeadEvent, buildScheduleEvent,
  buildInitiateCheckoutEvent, buildViewContentEvent, sendCapiEvent,
};
