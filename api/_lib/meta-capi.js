// Meta Conversions API: the "Schedule" event for a booked 41 Closer demo call,
// sent server-side because the Google Calendar booking iframe can't tell the
// page (or the pixel) that a booking happened.
//
// Payload shape follows hermes/src/lib/marketing/meta-conversions.ts (Schedule,
// Bearer token in the header, never in the URL) with action_source 'website',
// since the conversion happens on the /ai-closer page's calendar.

const crypto = require('crypto');
const { e164Digits, fetchWithTimeout } = require('./util');

const GRAPH = 'https://graph.facebook.com/v21.0';
const DEFAULT_PIXEL = '24659272643698089';
const SOURCE_URL = 'https://41labs.ai/ai-closer';

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

function buildScheduleEvent(i) {
  const user_data = {};
  const em = hashEmail(i.email); if (em) user_data.em = [em];
  const ph = hashPhone(i.phone); if (ph) user_data.ph = [ph];
  const fn = hashName(i.firstName); if (fn) user_data.fn = [fn];
  const ln = hashName(i.lastName); if (ln) user_data.ln = [ln];
  const fbc = buildFbc(i.fbclid, i.clickMs); if (fbc) user_data.fbc = fbc;
  if (i.userAgent) user_data.client_user_agent = i.userAgent;
  return {
    event_name: 'Schedule',
    event_time: i.eventTimeSec,
    event_id: `schedule_${i.opportunityId}`,
    action_source: 'website',
    event_source_url: SOURCE_URL,
    user_data,
    custom_data: { content_name: '41closer-demo-call', ...(i.tier ? { tier: i.tier } : {}) },
  };
}

// 'sent' | 'skipped' (not configured) | 'failed'. Never throws.
async function sendCapiEvent(event, { env, fetchImpl, timeoutMs = 5000 }) {
  const token = env.META_CAPI_TOKEN;
  const pixel = env.META_CAPI_PIXEL_ID || DEFAULT_PIXEL;
  if (!token) return 'skipped';
  const body = { data: [event] };
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

module.exports = { DEFAULT_PIXEL, hashEmail, hashPhone, hashName, buildFbc, buildScheduleEvent, sendCapiEvent };
