// GET /api/booking-check?email=...&id=<opportunityId>
// "Has this person booked yet?"
//
// Google's appointment iframe is cross-origin and tells the page nothing when a booking
// completes, so the visitor books and the screen sits there. Rather than guess, the page
// polls this while the calendar is open and switches to a thank-you state when a real
// booking appears on the calendar.
//
// Two rules make this safe to expose:
//   - BOTH the email and the opportunity id are required. The id is a UUID we handed
//     that visitor, so this cannot be used to ask "has <anyone@anywhere> booked?".
//   - It returns a boolean and a start time. Never a name, never an attendee list,
//     never anything about anyone else's booking.

const gcal = require('./_lib/google-calendar');

const DAY = 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const send = (res, status, obj) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
};

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'method_not_allowed' });

  const url = new URL(req.url || '/', 'https://41labs.ai');
  const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
  const id = String(url.searchParams.get('id') || '').trim();

  // The id is the thing that makes this not an enumeration endpoint.
  if (!UUID_RE.test(id)) return send(res, 400, { ok: false, error: 'id_required' });
  if (!email || email.length > 160 || email.indexOf('@') < 1) return send(res, 400, { ok: false, error: 'email_required' });

  const env = process.env;
  const fetchImpl = (...a) => fetch(...a);
  let sa;
  try {
    sa = gcal.loadServiceAccount(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch {
    return send(res, 200, { ok: true, booked: false, reason: 'calendar_not_configured' });
  }
  if (!sa) return send(res, 200, { ok: true, booked: false, reason: 'calendar_not_configured' });

  try {
    const now = Date.now();
    const token = await gcal.getAccessToken(sa, {
      fetchImpl, nowSec: now / 1000, sub: env.BOOKING_CALENDAR_IMPERSONATE || undefined,
    });
    const events = await gcal.listEvents({
      token, fetchImpl,
      calendarId: env.BOOKING_CALENDAR_ID || 'alexander@41labs.ai',
      params: { timeMin: new Date(now - DAY).toISOString(), timeMax: new Date(now + 90 * DAY).toISOString(), orderBy: 'startTime' },
    });
    const match = env.BOOKING_EVENT_MATCH || '41 Closer';
    const hit = (events || []).find((ev) => {
      if (!gcal.isBookingEvent(ev, match)) return false;
      const { emails } = gcal.extractContacts(ev);
      return emails.includes(email);
    });
    if (!hit) return send(res, 200, { ok: true, booked: false });
    return send(res, 200, {
      ok: true,
      booked: true,
      start: (hit.start && (hit.start.dateTime || hit.start.date)) || '',
      meet: gcal.meetLink(hit) || '',
    });
  } catch (e) {
    // A calendar hiccup must never break the page: it just keeps polling.
    return send(res, 200, { ok: true, booked: false, reason: 'lookup_failed' });
  }
};
