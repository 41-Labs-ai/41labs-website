// POST /api/cal-webhook
//
// Cal.com tells us the moment a booking is made, moved or cancelled, and hands back the
// metadata we set on the embed in ai-closer.js. That metadata carries the opportunity id,
// so a booking is matched to the exact deal instead of guessed.
//
// Why this exists. api/cron/booking-sync.js had to scan the Google Calendar every five
// minutes and work out which deal a booking belonged to by pulling emails and phone
// numbers out of the event text. Alan Ong booked twice, once as onggl@cdgtaxi.com and
// once as onggl@cdgtaxi.com.sg, and seven bookings never matched anything at all. Anyone
// who books with a different address was simply lost.
//
// The cron stays as the backstop and as the clock for reminders. This is the fast, exact
// path. The two see the same booking under different ids (Cal.com's uid here, the Google
// event id there), so the only claim they can share is the call itself: the deal plus the
// time it starts. Key anything on an id and both paths will announce the same booking.
//
// Setup: Cal.com, Settings, Webhooks. Point it at https://41labs.ai/api/cal-webhook,
// subscribe to BOOKING_CREATED, BOOKING_RESCHEDULED and BOOKING_CANCELLED, and put the
// secret it gives you in CAL_WEBHOOK_SECRET.

const crypto = require('crypto');
const notesLib = require('./_lib/notes');
const { twentyBase, patchOpportunity } = require('./_lib/twenty');
const { buildScheduleEvent, sendCapiEvent } = require('./_lib/meta-capi');
const { hermesConfigured, postHermesIntake } = require('./_lib/hermes');

const HANDLED = ['BOOKING_CREATED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED'];

function readRaw(req) {
  if (typeof req.rawBody === 'string') return Promise.resolve(req.rawBody);
  if (Buffer.isBuffer(req.rawBody)) return Promise.resolve(req.rawBody.toString('utf8'));
  if (typeof req.body === 'string') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    if (!req || typeof req.on !== 'function') return resolve('');
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 256 * 1024) req.destroy(); });
    req.on('end', () => resolve(raw));
    req.on('error', () => resolve(''));
  });
}

// Compared with timingSafeEqual so the endpoint cannot be probed a byte at a time.
function signatureOk(raw, header, secret) {
  if (!header || !secret) return false;
  const mine = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
  const a = Buffer.from(mine, 'utf8');
  const b = Buffer.from(String(header).trim().toLowerCase(), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const send = (res, status, obj) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(obj));
};

const isoOrNull = (v) => {
  const ms = Date.parse(v || '');
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};

// Only deals from the landing page, still live. Matching a booking to a won deal or to
// somebody else's pipeline would be worse than not matching at all.
async function candidates(env, fetchImpl) {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  // depth=1 expands pointOfContact and company. Without it Twenty returns
  // pointOfContactId alone, which left every booking handed to Hermes with no name,
  // no phone and no email: Hermes refused it, the claim was released, and the
  // confirmation fell to the cron. It also killed the attendee-email fallback below.
  const url = `${twentyBase(env)}/rest/opportunities?order_by=createdAt[DescNullsLast]&limit=120&depth=1`;
  const r = await fetchImpl(url, { headers: { Authorization: `Bearer ${env.TWENTY_API_KEY}` } });
  if (!r.ok) throw new Error(`twenty ${r.status}`);
  const d = await r.json();
  return ((d && d.data && d.data.opportunities) || []).filter((o) =>
    o && o.id && ['SCREENING', 'MEETING'].includes(o.stage) && o.createdAt >= since);
}

const emailsOf = (opp) => {
  const e = (opp.pointOfContact && opp.pointOfContact.emails) || {};
  return [e.primaryEmail, ...(e.additionalEmails || [])]
    .filter(Boolean).map((x) => String(x).trim().toLowerCase());
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method_not_allowed' });

  const env = process.env;
  const fetchImpl = (...a) => fetch(...a);
  const raw = await readRaw(req);
  const secret = env.CAL_WEBHOOK_SECRET;

  // No secret means we cannot tell Cal.com from anyone else with the URL. Refuse rather
  // than accept: this endpoint moves deals and reports conversions to Meta.
  if (!secret) return send(res, 503, { ok: false, error: 'webhook_secret_not_configured' });
  const header = (req.headers || {})['x-cal-signature-256'];
  if (!signatureOk(raw, header, secret)) return send(res, 401, { ok: false, error: 'bad_signature' });

  let evt = {};
  try { evt = JSON.parse(raw || '{}'); } catch { return send(res, 400, { ok: false, error: 'bad_json' }); }

  const trigger = String(evt.triggerEvent || '');
  if (!HANDLED.includes(trigger)) return send(res, 200, { ok: true, ignored: trigger });

  const p = evt.payload || {};
  const bookingId = String(p.uid || '').slice(0, 80);
  const startIso = isoOrNull(p.startTime);
  const meta = p.metadata || {};
  const wantedId = String(meta.opportunityId || '').trim();

  let opps = [];
  try {
    opps = await candidates(env, fetchImpl);
  } catch (e) {
    // Cal.com retries a non-200 for hours. Acknowledge, report, move on.
    return send(res, 200, { ok: true, matched: null, crm: `failed:${String(e.message || e).slice(0, 80)}` });
  }

  // The id Cal.com carried wins. Email is only the fallback for a booking made before
  // this endpoint existed, or one made outside the page.
  let opp = wantedId ? opps.find((o) => o.id === wantedId) : null;
  let matchedBy = opp ? 'metadata' : null;
  if (!opp) {
    const guests = (p.attendees || []).map((a) => String(a.email || '').trim().toLowerCase()).filter(Boolean);
    opp = opps.find((o) => emailsOf(o).some((e) => guests.includes(e))) || null;
    if (opp) matchedBy = 'email';
  }
  if (!opp) return send(res, 200, { ok: true, matched: null, action: trigger, booking: bookingId });

  const parsed = notesLib.parseLeadNotes(opp.statusNotes);
  const bookedKey = `booked:${bookingId}`;
  const capiKey = `sent:capi_schedule:${bookingId}`;
  let notes = String(opp.statusNotes || '');
  const fields = {};
  let action = 'booked';

  if (trigger === 'BOOKING_CANCELLED') {
    action = 'cancelled';
    // Let go of every claim on this call, not just the one this endpoint made. The cron
    // binds the same booking under the Google event id, and the nudge skips any deal
    // with a call attached, so leaving it behind meant nobody who cancelled was ever
    // chased for a new time. The claim on the slot goes too: rebooking it is a booking
    // like any other and deserves its confirmation.
    for (const id of notesLib.boundEventIds(notes)) notes = notesLib.removeMarker(notes, `booked:${id}`);
    if (startIso) notes = notesLib.removeMarker(notes, `sent:booked@${startIso}`);
    // Stamped so the chase runs from the cancellation. The form submit is usually days
    // old by then, and the nudge only looks at the first 24 hours.
    notes = notesLib.addMarker(notes, `cancelled@${new Date().toISOString()}`);
    fields.stage = 'SCREENING';
    fields.followUp = null;
    fields.nextAction = 'Booking cancelled by the lead. Chase for a new time.';
  } else {
    action = trigger === 'BOOKING_RESCHEDULED' ? 'rescheduled' : 'booked';
    if (!notesLib.hasMarker(notes, bookedKey)) notes = notesLib.addMarker(notes, bookedKey);
    if (opp.stage === 'SCREENING') fields.stage = 'MEETING';
    if (startIso) {
      fields.followUp = startIso;
      fields.nextAction = action === 'rescheduled'
        ? `Call moved. New time ${startIso}.`
        : `Call booked for ${startIso}.`;
    }
  }
  // Claim the Meta send in this same write, before it goes out. A second patch after the
  // send would double-report the booking if that write ever failed.
  const before = String(opp.statusNotes || '');
  const willSendMeta = action === 'booked'
    && !notesLib.hasMarker(before, capiKey)
    && !!env.META_CAPI_TOKEN;
  if (willSendMeta) notes = notesLib.addMarker(notes, capiKey);

  // The Closer gets told about a booking once, by whichever path sees it first: this
  // webhook or the five-minute cron. They see the same booking under different ids, so
  // the claim is on the call itself, the deal plus the time it starts. A call that
  // really moves has a new start and is announced again.
  // Hermes has no cancelled event, so a cancellation is a CRM change only.
  const hermesKey = startIso ? `sent:booked@${startIso}` : '';
  const willTellHermes = action !== 'cancelled' && !!hermesKey
    && hermesConfigured(env) && !notesLib.hasMarker(before, hermesKey);
  if (willTellHermes) notes = notesLib.addMarker(notes, hermesKey);

  fields.statusNotes = notes;

  let crm = 'ok';
  try {
    await patchOpportunity({ env, fetchImpl, id: opp.id, fields });
  } catch (e) {
    crm = `failed:${String(e.message || e).slice(0, 80)}`;
  }

  // Meta hears about a booking once. Moving or cancelling it is not a second conversion,
  // and the id matches what the cron and the browser send for the same deal.
  let meta_status = 'skipped';
  if (willSendMeta) {
    const c = opp.pointOfContact || {};
    const name = c.name || {};
    const ph = c.phones || {};
    const phone = ph.primaryPhoneNumber
      ? `${ph.primaryPhoneCallingCode || ''}${ph.primaryPhoneNumber}` : '';
    meta_status = await sendCapiEvent(buildScheduleEvent({
      opportunityId: opp.id,
      email: emailsOf(opp)[0] || '',
      phone,
      firstName: name.firstName || '',
      lastName: name.lastName || '',
      fbclid: parsed.fbclid,
      fbp: parsed.fbp,
      fbc: parsed.fbc,
      clickMs: Date.parse(opp.createdAt),
      userAgent: parsed.userAgent,
      tier: parsed.tier,
      eventTimeSec: Math.floor(Date.now() / 1000),
    }), { env, fetchImpl });
    // Release the claim so the next run retries. If the release itself fails the marker
    // stays: a missed conversion beats a double-counted one.
    if (meta_status !== 'sent' && crm === 'ok') {
      try {
        await patchOpportunity({ env, fetchImpl, id: opp.id,
          fields: { statusNotes: notesLib.removeMarker(notes, capiKey) } });
      } catch { /* keep the claim */ }
    }
  }

  let hermes = 'skipped';
  if (willTellHermes) {
    const c = opp.pointOfContact || {};
    const nm = c.name || {};
    const ph = c.phones || {};
    hermes = await postHermesIntake({
      // 'rescheduled' is not an event Hermes knows. A moved call is a booking at a
      // new time, and its own idempotency is per lead, event and start.
      event: 'booked',
      lead: {
        name: `${nm.firstName || ''} ${nm.lastName || ''}`.trim(),
        phone: ph.primaryPhoneNumber ? `${ph.primaryPhoneCallingCode || ''}${ph.primaryPhoneNumber}` : '',
        email: emailsOf(opp)[0] || '',
        company: (opp.company && opp.company.name) || '',
        tier: parsed.tier,
        twentyOpportunityId: opp.id,
      },
      booking: { start: startIso, end: isoOrNull(p.endTime), meetLink: meta.videoCallUrl || p.videoCallUrl || '' },
    }, { env, fetchImpl }).catch((e) => `failed:${String(e.message || e).slice(0, 60)}`);
    if (hermes !== 'sent' && crm === 'ok') {
      try {
        await patchOpportunity({ env, fetchImpl, id: opp.id,
          fields: { statusNotes: notesLib.removeMarker(notes, hermesKey) } });
      } catch { /* keep the claim */ }
    }
  }

  return send(res, 200, {
    ok: true, action, matched: opp.id, matchedBy, booking: bookingId,
    crm, meta: meta_status, hermes,
  });
};
