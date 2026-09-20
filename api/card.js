// GET /card  →  logs the scan, then forwards to WhatsApp.
//
// This sits behind the QR code printed on the 41 Labs name card. The card does
// NOT point at wa.me directly, for three reasons:
//
//  1. Tracking. A wa.me QR is invisible until someone actually sends a message,
//     so every scan that does not convert is lost. Here we see the scan itself,
//     which gives us the scan → message conversion rate.
//  2. The destination stays editable. The number and the opening message live
//     here, not in the printed code, so both can change without reprinting a
//     single card.
//  3. A shorter URL is a lower-density QR (29 modules instead of 41), which
//     scans more reliably at the size a name card allows.
//
// Whatever happens, this must redirect. Someone is standing there holding a
// phone, so analytics never gets to block or slow the handoff.

const WHATSAPP = '6580124848';   // the 41 Closer line: an AI answers here.
const MESSAGE  = 'Hi, I have your card. Show me what the AI Sales Closer would do for my business.';

const GA_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const DEFAULT_GA4 = 'G-VQQ49H8N1L';
const GA_TIMEOUT_MS = 600;       // a scan is a human waiting; never stall longer

// Batch tag, so a print run can be attributed ( /card?b=nrf ).
// Clamped hard: it is attacker-controlled and ends up in our analytics.
const batchOf = (v) =>
  (typeof v === 'string' ? v : '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) || 'default';

function deviceOf(ua = '') {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (!ua) return 'unknown';
  return 'other';
}

// A per-scan id. Not a person and not persisted anywhere: GA4 needs a client_id
// and we have no cookie on a QR scan, so an ephemeral one keeps scans from all
// collapsing into a single session.
const scanId = () => `${Date.now()}.${Math.floor(Math.random() * 1e9)}`;

async function report(env, params) {
  const secret = env.GA4_API_SECRET;
  if (!secret) return;                        // not configured: skip, still redirect
  const id = env.GA4_MEASUREMENT_ID || DEFAULT_GA4;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GA_TIMEOUT_MS);
  try {
    await fetch(`${GA_ENDPOINT}?measurement_id=${encodeURIComponent(id)}&api_secret=${encodeURIComponent(secret)}`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: params.client_id,
        events: [{ name: 'card_scan', params: {
          batch: params.batch,
          device: params.device,
          country: params.country,
          engagement_time_msec: 1,
        } }],
      }),
    });
  } catch {
    // Timed out, aborted, or GA4 is down. The redirect matters, this does not.
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async (req, res) => {
  const url = new URL(req.url, `https://${req.headers.host || '41labs.ai'}`);
  const batch = batchOf(url.searchParams.get('b'));
  const device = deviceOf(req.headers['user-agent']);
  const country = (req.headers['x-vercel-ip-country'] || '').slice(0, 2) || 'unknown';

  // Logged regardless of GA4, so the Vercel log is a usable fallback record.
  console.log(JSON.stringify({ evt: 'card_scan', batch, device, country, at: new Date().toISOString() }));

  await report(process.env, { client_id: scanId(), batch, device, country });

  const target = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(MESSAGE)}`;
  res.statusCode = 302;
  res.setHeader('Location', target);
  res.setHeader('Cache-Control', 'no-store');   // never cache: every scan must be counted
  res.end();
};
