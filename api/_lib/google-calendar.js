// Google Calendar read access with a service-account JWT. Plain REST + node
// crypto, no googleapis SDK (keeps the function cold start small).

const crypto = require('crypto');
const fs = require('fs');
const { e164Digits, fetchWithTimeout } = require('./util');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
// We only ever READ bookings. Ask for the narrowest scope first and fall back to the
// broader one, because domain-wide delegation grants an exact scope string: the
// 41labs.ai Workspace delegates 'auth/calendar', so asking only for
// 'calendar.events.readonly' returned unauthorized_client and the cron read nothing.
// Ordered narrowest first, so if the delegation is ever tightened this needs no change.
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar',
];
const SCOPE = SCOPES[0];

// GOOGLE_SERVICE_ACCOUNT_JSON may be the JSON itself (Vercel), base64 of it, or a
// file path (local dev: ~/.config/41labs/google.env points at a file).
function loadServiceAccount(raw, readFile = (p) => fs.readFileSync(p, 'utf8')) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const tryParse = (txt) => {
    try {
      const j = JSON.parse(txt);
      return j && j.client_email && j.private_key ? j : null;
    } catch { return null; }
  };
  if (s.startsWith('{')) return tryParse(s);
  if (s.startsWith('/') || s.startsWith('~') || s.endsWith('.json')) {
    try { return tryParse(readFile(s.replace(/^~/, process.env.HOME || ''))); } catch { return null; }
  }
  try { return tryParse(Buffer.from(s, 'base64').toString('utf8')); } catch { return null; }
}

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

function signJwt(sa, { scope = SCOPE, nowSec, sub } = {}) {
  const iat = Math.floor(nowSec);
  const claims = { iss: sa.client_email, scope, aud: TOKEN_URL, iat, exp: iat + 3600 };
  if (sub) claims.sub = sub;
  const unsigned = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url(claims)}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(unsigned), sa.private_key).toString('base64url');
  return `${unsigned}.${sig}`;
}

async function requestToken(sa, { fetchImpl, nowSec, sub, scope }) {
  const assertion = signJwt(sa, { nowSec, sub, scope });
  const r = await fetchWithTimeout(fetchImpl, TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
  }, 8000);
  if (!r.ok) {
    // Carry Google's reason, not just the status: 'unauthorized_client' means the
    // exact scope is not delegated, which the caller retries with a wider one.
    let why = '';
    try { why = (await r.text()).slice(0, 200); } catch {}
    throw new Error(`calendar token ${r.status} ${why}`);
  }
  const j = await r.json();
  if (!j.access_token) throw new Error('calendar token missing');
  return j.access_token;
}


// Walks SCOPES until one is actually delegated. 'unauthorized_client' means the exact
// scope string is not on the delegation list, which is a configuration answer, not an
// outage, so it is worth trying the next one rather than failing the whole run.
async function getAccessToken(sa, opts = {}) {
  if (opts.scope) return requestToken(sa, opts);
  let lastErr;
  for (const scope of SCOPES) {
    try {
      return await requestToken(sa, { ...opts, scope });
    } catch (e) {
      lastErr = e;
      if (!/unauthorized_client|invalid_scope|token 40[13]/i.test(String(e))) throw e;
    }
  }
  throw lastErr;
}

async function listEvents({ token, calendarId, params, fetchImpl }) {
  const q = new URLSearchParams({ singleEvents: 'true', maxResults: '250', ...params });
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${q}`;
  const r = await fetchWithTimeout(fetchImpl, url, { headers: { Authorization: `Bearer ${token}` } }, 8000);
  if (!r.ok) throw new Error(`calendar events ${r.status}`);
  const j = await r.json();
  return Array.isArray(j.items) ? j.items : [];
}

// BOOKING_EVENT_MATCH: comma-separated, case-insensitive, matched against the
// title and description of the appointment-schedule booking.
function isBookingEvent(ev, match) {
  if (!ev || ev.status === 'cancelled') return false;
  const hay = `${ev.summary || ''}\n${ev.description || ''}`.toLowerCase();
  return String(match || '').split(',').map((m) => m.trim().toLowerCase()).filter(Boolean)
    .some((m) => hay.includes(m));
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /\+?\(?\d[\d \t().-]{6,}\d/g; // one line only, never across line breaks

// Guest contacts: attendee emails (not Alexander) plus any email/phone typed
// into the booking form, which Google puts in the event description.
function extractContacts(ev) {
  const emails = new Set();
  for (const a of ev.attendees || []) {
    if (a && a.email && !a.self && !a.organizer) emails.add(a.email.trim().toLowerCase());
  }
  const desc = String(ev.description || '').replace(/<[^>]+>/g, ' ');
  for (const m of desc.match(EMAIL_RE) || []) emails.add(m.toLowerCase());
  const phones = new Set();
  for (const m of desc.match(PHONE_RE) || []) {
    const d = e164Digits(m.trim());
    if (d.length >= 8 && d.length <= 15) phones.add(d);
  }
  return { emails: [...emails], phones: [...phones] };
}

function meetLink(ev) {
  if (ev && ev.hangoutLink) return ev.hangoutLink;
  const ep = ((ev && ev.conferenceData && ev.conferenceData.entryPoints) || []).find((e) => e.entryPointType === 'video');
  return ep ? ep.uri : '';
}

module.exports = { SCOPE, SCOPES, loadServiceAccount, signJwt, getAccessToken, listEvents, isBookingEvent, extractContacts, meetLink };
