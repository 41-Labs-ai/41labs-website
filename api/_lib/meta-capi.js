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

// Expected build revenue sitting behind one event. Taken from what the July 2026
// Meta run ACTUALLY did, not from the modelled base case (41-CLOSER-NUMBERS.md):
//   84 leads -> 4 booked calls -> 1 client (Hertz), build fee S$9,600
//   qualified lead: 1 in 84  = 1.19% x S$9,600 = S$114
//   booked call:    1 in 4   =   25%  x S$9,600 = S$2,400
//
// Build fee only. The S$1,490/mo retainer is deliberately excluded: four clients are
// signed and none is live yet, so there are zero months of real retention to value.
//
// Caveat worth keeping in view: this is a ONE client sample, so a single deal either
// way moves it a lot. The ratio between the two (about 1:21) is what actually steers
// Meta's bidding, and that is stable across every scenario in the doc. The absolute
// figures only change how ROAS reads in Ads Manager. Revisit at 30+ closed deals.
const VALUE_QUALIFIED_LEAD = 114;
const VALUE_SCHEDULE = 2400;

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

const buildScheduleEvent = (i) => buildEvent({
  ...i,
  eventName: 'Schedule',
  eventId: `schedule_${i.opportunityId}`,
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
  buildEvent, buildLeadEvent, buildQualifiedLeadEvent, buildScheduleEvent, sendCapiEvent,
};
