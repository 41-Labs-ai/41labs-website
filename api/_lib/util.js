// Shared helpers for the /ai-closer booking pipeline.
// Files under api/_lib are not deployed as functions (leading underscore).

const clean = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const escapeHtml = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Phone -> E.164 digits without the "+". Singapore-first: a bare 8-digit number
// is a local SG number and gets 65 in front.
function e164Digits(raw) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return '';
  const digits = s.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 8 && !s.startsWith('+')) return `65${digits}`;
  return digits.replace(/^0+/, '');
}

// Same person? Compare the last 8 digits (an SG number, or the tail of any
// number), so "+65 9123 4567", "91234567" and "6591234567" all agree.
function samePhone(a, b) {
  const x = String(a || '').replace(/\D/g, '');
  const y = String(b || '').replace(/\D/g, '');
  if (x.length < 8 || y.length < 8) return false;
  return x.slice(-8) === y.slice(-8);
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "Sat 12 Sep 2026, 3:00pm SGT". Computed by hand (UTC+8, no DST) so it never
// depends on the runtime's ICU data.
function formatSgt(isoOrMs) {
  const d = new Date(new Date(isoOrMs).getTime() + 8 * 60 * 60 * 1000);
  const h24 = d.getUTCHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${h12}:${mm}${h24 < 12 ? 'am' : 'pm'} SGT`;
}

// fetch with a hard timeout. Rejects on timeout like any network error.
async function fetchWithTimeout(fetchImpl, url, init = {}, ms = 3000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetchImpl(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { clean, escapeHtml, e164Digits, samePhone, formatSgt, fetchWithTimeout };
