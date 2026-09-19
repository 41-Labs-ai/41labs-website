// POST /api/track
// Sink for the journey beacon that closer-analytics.js fires when a visitor
// leaves /ai-closer: where they went on the page, how far they scrolled, how
// long they actually read, and which ad sent them.
//
// Two hard rules:
//  1. Answer 204 immediately. This runs during page unload, so anything slow or
//     loud here costs us the visitor's last impression of the site.
//  2. Trust nothing. sendBeacon can be replayed by anyone with curl, so every
//     field is clamped (api/_lib/journey.js) before it goes anywhere.
//
// Forwarded to GA4 through the Measurement Protocol, which is worth doing
// server-side: roughly a third of ad traffic blocks the browser's gtag, and those
// are exactly the visitors we would otherwise never see in the funnel report.
// Configure with GA4_MEASUREMENT_ID + GA4_API_SECRET (Admin > Data Streams >
// Measurement Protocol API secrets). Without them this endpoint just accepts and drops.

const { cleanJourney } = require('./_lib/journey');

const GA_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const DEFAULT_GA4 = 'G-VQQ49H8N1L';
const TIMEOUT_MS = 2000;

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); } }
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 64 * 1024) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

// Only the fields GA4 should report on. The Meta cookies and the raw attribution
// blob stay on our side: GA4 has no use for them and they are visitor identifiers.
function gaParams(b, j) {
  const last = (b && typeof b.attr === 'object' && b.attr && b.attr.last) || {};
  const p = {
    page_path: str(b.page, 120) || '/ai-closer',
    variant: str(b.variant, 20) || 'long',
    engaged_seconds: Math.round(j.engagedMs / 1000),
    total_seconds: Math.round(j.ms / 1000),
    scroll_depth: j.scroll,
    visits: j.visits,
    sections_seen: j.sections.length,
    // GA4's own session id, not ours. Ours is not a GA4 session, and sending it made
    // every beacon a new sourceless session. Omitted when the cookie is absent: no
    // session_id is better than one GA4 cannot match.
    ...(str(b.gaSid, 60) ? { session_id: str(b.gaSid, 60) } : {}),
    engagement_time_msec: Math.max(1, j.engagedMs),
  };
  if (j.sections.length) p.top_section = j.sections[0][0];
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach((k) => {
    const v = str(last[k], 100);
    if (v) p[k] = v;
  });
  return p;
}

async function sendGa4(body, journey, env, fetchImpl) {
  const secret = env.GA4_API_SECRET;
  if (!secret) return 'skipped';
  const id = env.GA4_MEASUREMENT_ID || DEFAULT_GA4;
  const clientId = str(body.ga, 60) || str(body.vid, 60);
  if (!clientId) return 'skipped';
  const url = `${GA_ENDPOINT}?measurement_id=${encodeURIComponent(id)}&api_secret=${encodeURIComponent(secret)}`;
  const payload = { client_id: clientId, events: [{ name: 'closer_journey', params: gaParams(body, journey) }] };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    await fetchImpl(url, { method: 'POST', body: JSON.stringify(payload), signal: ctrl.signal });
    return 'sent';
  } catch {
    return 'failed';
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end();
  }

  // Everything below is best-effort. The visitor is already gone.
  try {
    const raw = await readBody(req);
    const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const journey = cleanJourney(body.journey);
    if (journey) await sendGa4(body, journey, process.env, (...a) => fetch(...a));
  } catch {
    // swallow: an analytics failure must never surface as a site error
  }

  res.statusCode = 204;
  return res.end();
};
