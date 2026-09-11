// Reads what /api/closer-lead wrote into the opportunity's statusNotes, and
// keeps the cron's idempotency markers there.
//
// Why markers in Twenty and not Vercel KV/Blob: this project has no store, the
// opportunity is already the record the cron reads, and a marker line next to
// the lead is visible to a human ("[sent:reminder_1h:...]") when debugging.

const LANDING_FORM_LINE = 'Form: 41labs.ai/ai-closer';

function parseLeadNotes(notes) {
  const n = String(notes || '');
  const tier = (n.match(/^Tier: ([ABC])\b/m) || [])[1] || '';
  const fbclid = (n.match(/^fbclid=(\S+)/m) || [])[1] || '';
  const userAgent = ((n.match(/^UA: (.+)$/m) || [])[1] || '').trim();
  const utmContent = (n.match(/\butm_content=(\S+)/) || [])[1] || '';
  return { tier, fbclid, userAgent, utmContent, fromLandingPage: n.includes(LANDING_FORM_LINE) };
}

const tag = (key) => `[${key}]`;

const hasMarker = (notes, key) => String(notes || '').split('\n').some((l) => l.trim() === tag(key));

function addMarker(notes, key) {
  const n = String(notes || '');
  if (hasMarker(n, key)) return n;
  return n ? `${n}\n${tag(key)}` : tag(key);
}

function removeMarker(notes, key) {
  return String(notes || '').split('\n').filter((l) => l.trim() !== tag(key)).join('\n');
}

// The calendar event this opportunity is bound to, if any ("[booked:<eventId>]").
function boundEventIds(notes) {
  return String(notes || '').split('\n')
    .map((l) => (l.trim().match(/^\[booked:(.+)\]$/) || [])[1])
    .filter(Boolean);
}

module.exports = { LANDING_FORM_LINE, parseLeadNotes, hasMarker, addMarker, removeMarker, boundEventIds };
