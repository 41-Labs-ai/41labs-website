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
async function postHermesIntake(body, { env, fetchImpl, timeoutMs = 3000 }) {
  if (!hermesConfigured(env)) return 'skipped';
  const url = `${String(env.HERMES_BASE_URL).replace(/\/+$/, '')}/api/intake/landing-lead`;
  try {
    const r = await fetchWithTimeout(fetchImpl, url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-intake-key': env.HERMES_INTAKE_KEY },
      body: JSON.stringify(body),
    }, timeoutMs);
    return r.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

module.exports = { hermesConfigured, postHermesIntake };
