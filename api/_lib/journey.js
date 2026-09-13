// What the visitor did on /ai-closer before they filled in the form.
//
// closer-analytics.js records it in the browser and posts it with the lead. This
// turns it into one line for the deal in Twenty, so the call can open with
// "you spent most of your time on the proof screens" instead of a cold start.
//
// Everything here is attacker-supplied, so every field is clamped. A bad payload
// must degrade to an empty summary, never to a thrown error or an oversized note.

const MAX_MS = 24 * 60 * 60 * 1000;
const TOP_SECTIONS = 3;

const num = (v, min, max) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : 0;
};

const slug = (v) => String(v == null ? '' : v).replace(/[^a-z0-9_-]/gi, '').slice(0, 40);

// "4m 11s", "45s", "1h 2m"
function dur(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// Normalised copy, safe to store and to forward. Returns null when there is
// nothing worth recording.
function cleanJourney(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const ms = num(raw.ms, 0, MAX_MS);
  const j = {
    ms,
    engagedMs: Math.min(ms, num(raw.engagedMs, 0, MAX_MS)),
    scroll: num(raw.scroll, 0, 100),
    visits: num(raw.visits, 0, 999),
    landing: String(raw.landing || '').slice(0, 120),
    referrer: String(raw.referrer || '').slice(0, 200),
    sections: (Array.isArray(raw.sections) ? raw.sections : [])
      .filter((p) => Array.isArray(p) && slug(p[0]))
      .slice(0, 20)
      .map((p) => [slug(p[0]), num(p[1], 0, MAX_MS)])
      .sort((a, b) => b[1] - a[1]),
  };
  return j.ms || j.scroll || j.sections.length ? j : null;
}

// One line for the CRM note. '' when there is nothing to say.
function journeyNote(j) {
  if (!j) return '';
  const bits = [];
  if (j.ms) bits.push(`${dur(j.ms)} on page`);
  if (j.engagedMs) bits.push(`${dur(j.engagedMs)} engaged`);
  if (j.scroll) bits.push(`scrolled ${j.scroll}%`);
  if (j.visits > 1) bits.push(`visit ${j.visits}`);
  const top = j.sections.slice(0, TOP_SECTIONS).filter(([, ms]) => ms >= 1000);
  const where = top.length ? ` Most time: ${top.map(([id, ms]) => `${id} ${dur(ms)}`).join(', ')}.` : '';
  return bits.length ? `Journey: ${bits.join(', ')}.${where}` : '';
}

module.exports = { cleanJourney, journeyNote, dur };
