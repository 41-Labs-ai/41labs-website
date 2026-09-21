// Hermes (41 Closer) intake: one endpoint, one header, an `event` field.
//   POST ${HERMES_BASE_URL}/api/intake/landing-lead
//   x-intake-key: ${HERMES_INTAKE_KEY}
//   { event: 'lead_created' | 'booked' | 'finish_booking' | 'reminder_24h' | 'reminder_1h', lead, booking? }
// Best-effort with a 3s timeout. Skipped (not failed) when env is missing.

const { fetchWithTimeout } = require('./util');

function hermesConfigured(env) {
  return !!(env.HERMES_BASE_URL && env.HERMES_INTAKE_KEY);
}

// 'sent' | 'skipped' | 'failed'. Never throws.
// Pass `report` (an object) to learn which lead fields Hermes did not recognise. It is
// filled rather than returned because the booking cron releases its claim on anything
// other than exactly 'sent', so a richer return value would make it retry every five
// minutes forever. On 21 Sep 2026 Hermes was silently dropping `challenges` and `goal`,
// this is how that shows up now.
async function postHermesIntake(body, { env, fetchImpl, timeoutMs = 3000, report }) {
  if (!hermesConfigured(env)) return 'skipped';
  const url = `${String(env.HERMES_BASE_URL).replace(/\/+$/, '')}/api/intake/landing-lead`;
  try {
    const r = await fetchWithTimeout(fetchImpl, url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-intake-key': env.HERMES_INTAKE_KEY },
      body: JSON.stringify(body),
    }, timeoutMs);
    if (r.ok && report && typeof r.json === 'function') {
      try {
        const j = await r.json();
        if (j && Array.isArray(j.ignoredFields) && j.ignoredFields.length > 0) {
          report.ignoredFields = j.ignoredFields.map(String).slice(0, 20);
        }
      } catch { /* a reply we cannot read never costs us the send */ }
    }
    return r.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

module.exports = { hermesConfigured, postHermesIntake };
