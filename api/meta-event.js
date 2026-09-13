// POST /api/meta-event
// The server half of the browser-fired Meta events. The page fires the pixel and posts
// here with the SAME event_id, so Meta deduplicates and we still get the conversion
// when an ad blocker or iOS eats the pixel.
//
// Contract: 41closer-marketing/ads/2026-09-batch/CONVERSION-TRACKING-SPEC.md
//   InitiateCheckout  the visitor opened the booking calendar
//   ViewContent       they reached the demo and stayed
//   Schedule          a booking was confirmed in the browser (Cal.com). Google bookings
//                     are caught server-side instead, by api/cron/booking-sync.js.
//
// This endpoint is public, so it is written as if every caller is hostile:
//   - only the three event names above are accepted
//   - the VALUE IS NEVER TAKEN FROM THE CLIENT. Letting a caller set it would let
//     anyone with curl inflate ROAS and poison the ad set's optimisation.
//   - identifiers are hashed here, so raw email and phone never sit in a log line

const { buildInitiateCheckoutEvent, buildViewContentEvent, buildScheduleEvent, sendCapiEvent } = require('./_lib/meta-capi');

const BUILDERS = {
  InitiateCheckout: buildInitiateCheckoutEvent,
  ViewContent: buildViewContentEvent,
  Schedule: buildScheduleEvent,
};

const clean = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); } }
    // No readable stream (a null body, or a harness calling us directly): nothing to read.
    if (!req || typeof req.on !== 'function') return resolve({});
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 32 * 1024) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function splitName(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
  }

  const body = await readBody(req);
  const name = clean(body.name, 40);
  const build = BUILDERS[name];
  if (!build) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'unknown_event' }));
  }

  const eventId = clean(body.eventId, 80);
  if (!eventId) {
    // Without the id the pixel copy cannot be deduplicated, so this would double count.
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'event_id_required' }));
  }

  const headers = req.headers || {};
  const person = splitName(body.fullName);
  const event = build({
    eventId,
    eventTimeSec: Math.floor(Date.now() / 1000),
    sourceUrl: /^https:\/\/(www\.)?41labs\.ai\//.test(clean(body.sourceUrl, 300))
      ? clean(body.sourceUrl, 300) : undefined,
    email: clean(body.email, 160),
    phone: clean(body.phone, 40),
    firstName: person.firstName,
    lastName: person.lastName,
    fbp: clean(body.fbp, 120),
    fbc: clean(body.fbc, 300),
    fbclid: clean(body.fbclid, 300),
    clickMs: Date.now(),
    clientIp: clean(String(headers['x-forwarded-for'] || '').split(',')[0], 60),
    userAgent: clean(headers['user-agent'], 300),
    tier: ['A', 'B', 'C'].includes(body.tier) ? body.tier : '',
  });

  const meta = await sendCapiEvent(event, { env: process.env, fetchImpl: (...a) => fetch(...a) });
  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true, meta, event: name }));
};
