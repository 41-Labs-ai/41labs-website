import { test, expect } from '@playwright/test';
import path from 'path';
import crypto from 'crypto';

// POST /api/cal-webhook
//
// Cal.com tells us the moment a booking is made, moved or cancelled, and hands back the
// metadata we set on the embed. That metadata carries the opportunity id, so the booking
// is matched to the exact deal instead of guessed.
//
// The cron had to scan the calendar and match on email and phone pulled out of the event
// text. Alan Ong booked twice under onggl@cdgtaxi.com and onggl@cdgtaxi.com.sg, and seven
// bookings never matched anything at all. A lead who books with a different address was
// simply lost.

const HANDLER = path.join(__dirname, '..', 'api', 'cal-webhook.js');
const SECRET = 'cal-test-secret';

const ENV_KEYS = ['TWENTY_API_KEY', 'TWENTY_BASE_URL', 'CAL_WEBHOOK_SECRET',
  'META_CAPI_TOKEN', 'META_CAPI_PIXEL_ID', 'HERMES_BASE_URL', 'HERMES_INTAKE_KEY'];

const FULL_ENV = {
  TWENTY_API_KEY: 'tw-key',
  CAL_WEBHOOK_SECRET: SECRET,
  META_CAPI_TOKEN: 'EAAtoken',
  HERMES_BASE_URL: 'https://hermes.example.com/',
  HERMES_INTAKE_KEY: 'intake-secret',
};

const OPP = {
  id: 'opp-abc', stage: 'SCREENING', productLine: 'CLOSER_41',
  createdAt: '2026-09-18T02:00:00.000Z',
  statusNotes: 'Form: 41labs.ai/ai-closer\nTier: A (fit)\nfbclid=abc123\nfbp=fb.1.1757000000000.9\nfbc=fb.1.1757000000000.abc123\nUA: Mozilla/5.0',
  pointOfContact: { name: { firstName: 'Alan', lastName: 'Ong' },
    emails: { primaryEmail: 'onggl@cdgtaxi.com' },
    phones: { primaryPhoneNumber: '98529367', primaryPhoneCallingCode: '+65' } },
};

function body(trigger: string, over: any = {}) {
  return JSON.stringify({
    triggerEvent: trigger,
    payload: {
      uid: 'cal-booking-1',
      title: '41 Closer between Alexander Lee and Alan Ong',
      startTime: '2026-09-25T05:00:00Z',
      endTime: '2026-09-25T05:30:00Z',
      attendees: [{ name: 'Alan Ong', email: 'onggl@cdgtaxi.com.sg', timeZone: 'Asia/Singapore' }],
      metadata: { opportunityId: 'opp-abc', tier: 'A', utm_content: 'cold_carrental',
        videoCallUrl: 'https://meet.google.com/abc-defg-hij' },
      ...over,
    },
  });
}

const sign = (raw: string, secret = SECRET) =>
  crypto.createHmac('sha256', secret).update(raw).digest('hex');

type Call = { url: string; method: string; body: any };

async function run(raw: string, opts: { env?: any; sig?: string; opp?: any; twentyFail?: boolean } = {}) {
  const calls: Call[] = [];
  const saved: Record<string, any> = {};
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  Object.assign(process.env, opts.env ?? FULL_ENV);
  const orig = globalThis.fetch;
  const opp = opts.opp === null ? null : (opts.opp ?? OPP);

  (globalThis as any).fetch = async (url: string, init: any) => {
    let parsed: any = null;
    if (init?.body) { try { parsed = JSON.parse(init.body); } catch { parsed = String(init.body); } }
    calls.push({ url, method: init?.method || 'GET', body: parsed });
    if (url.includes('/rest/opportunities/') && init?.method === 'PATCH') {
      if (opts.twentyFail) return { ok: false, status: 500, text: async () => 'boom' };
      return { ok: true, status: 200, json: async () => ({ data: { updateOpportunity: {} } }) };
    }
    if (url.includes('/rest/opportunities')) {
      return { ok: true, status: 200, json: async () => ({ data: { opportunities: opp ? [opp] : [] } }) };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true, events_received: 1 }), text: async () => '{}' };
  };

  const req: any = { method: 'POST', headers: {}, rawBody: raw };
  req.headers['x-cal-signature-256'] = opts.sig ?? sign(raw);
  const res: any = { statusCode: 200, headers: {}, body: '' };
  res.setHeader = (k: string, v: string) => { res.headers[k] = v; };
  res.end = (b: string) => { res.body = b; };

  delete require.cache[require.resolve(HANDLER)];
  try {
    await require(HANDLER)(req, res);
  } finally {
    globalThis.fetch = orig;
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
  return { res, json: (() => { try { return JSON.parse(res.body); } catch { return {}; } })(), calls };
}

const patchCall = (c: Call[]) => c.find((x) => x.method === 'PATCH');
const capiCall = (c: Call[]) => c.find((x) => x.url.startsWith('https://graph.facebook.com/'));
const hermesCall = (c: Call[], ev?: string) =>
  c.find((x) => x.url.startsWith('https://hermes.example.com/') && (!ev || x.body?.event === ev));

test.describe('the signature is the door', () => {
  test('a wrong signature is rejected and nothing is written', async () => {
    const raw = body('BOOKING_CREATED');
    const { res, calls } = await run(raw, { sig: 'deadbeef' });
    expect(res.statusCode).toBe(401);
    expect(calls).toHaveLength(0);
  });

  test('no secret configured: refuse rather than trust anyone', async () => {
    const raw = body('BOOKING_CREATED');
    const { res, calls } = await run(raw, { env: { TWENTY_API_KEY: 'k' } });
    expect(res.statusCode).toBe(503);
    expect(calls).toHaveLength(0);
  });

  test('a tampered body fails even with a signature that was valid for the original', async () => {
    const original = body('BOOKING_CREATED');
    const tampered = body('BOOKING_CREATED', { startTime: '2026-12-25T05:00:00Z' });
    const { res } = await run(tampered, { sig: sign(original) });
    expect(res.statusCode).toBe(401);
  });
});

test.describe('a new booking', () => {
  test('matches the deal by the id Cal.com carried, never by email', async () => {
    const { res, json, calls } = await run(body('BOOKING_CREATED'));
    expect(res.statusCode).toBe(200);
    expect(json.matched).toBe('opp-abc');
    // The attendee email differs from the CRM email on purpose. It must not matter.
    expect(json.matchedBy).toBe('metadata');
  });

  test('moves the deal to MEETING and records when the call is', async () => {
    const { calls } = await run(body('BOOKING_CREATED'));
    const p = patchCall(calls);
    expect(p).toBeTruthy();
    expect(p!.body.stage).toBe('MEETING');
    expect(p!.body.followUp).toBe('2026-09-25T05:00:00.000Z');
    expect(String(p!.body.statusNotes)).toContain('[booked:cal-booking-1]');
  });

  test('tells Meta, keyed on the deal so the cron and the browser agree', async () => {
    const { calls } = await run(body('BOOKING_CREATED'));
    const capi = capiCall(calls);
    expect(capi).toBeTruthy();
    const ev = capi!.body.data[0];
    expect(ev.event_name).toBe('Schedule');
    expect(ev.event_id).toBe('schedule_opp-abc');
    // The identifiers the browser captured have to survive into this send.
    expect(ev.user_data.fbp).toBe('fb.1.1757000000000.9');
    expect(ev.user_data.fbc).toBe('fb.1.1757000000000.abc123');
  });

  test('hands the booking to the Closer', async () => {
    const { calls } = await run(body('BOOKING_CREATED'));
    const h = hermesCall(calls, 'booked');
    expect(h).toBeTruthy();
    expect(h!.body.booking.start).toBe('2026-09-25T05:00:00.000Z');
  });

  test('the same webhook twice changes nothing the second time', async () => {
    const raw = body('BOOKING_CREATED');
    const first = await run(raw);
    const booked = { ...OPP, stage: 'MEETING', statusNotes: patchCall(first.calls)!.body.statusNotes };
    const second = await run(raw, { opp: booked });
    expect(capiCall(second.calls), 'Meta must not hear about it twice').toBeUndefined();
    expect(hermesCall(second.calls, 'booked')).toBeUndefined();
  });
});

test.describe('a moved booking', () => {
  test('follows the new time and re-arms the reminders', async () => {
    const booked = { ...OPP, stage: 'MEETING',
      statusNotes: `${OPP.statusNotes}\n[booked:cal-booking-1]\n[sent:capi_schedule:cal-booking-1]` };
    const { json, calls } = await run(
      body('BOOKING_RESCHEDULED', { startTime: '2026-09-26T06:57:00Z', endTime: '2026-09-26T07:27:00Z' }),
      { opp: booked });
    expect(json.action).toBe('rescheduled');
    expect(patchCall(calls)!.body.followUp).toBe('2026-09-26T06:57:00.000Z');
    // Already told Meta about this booking. Moving it is not a second conversion.
    expect(capiCall(calls)).toBeUndefined();
    expect(hermesCall(calls, 'rescheduled')).toBeTruthy();
  });
});

test.describe('a cancelled booking', () => {
  test('puts the deal back so they can be chased again', async () => {
    const booked = { ...OPP, stage: 'MEETING', statusNotes: `${OPP.statusNotes}\n[booked:cal-booking-1]` };
    const { json, calls } = await run(body('BOOKING_CANCELLED'), { opp: booked });
    expect(json.action).toBe('cancelled');
    const p = patchCall(calls)!;
    expect(p.body.stage).toBe('SCREENING');
    expect(String(p.body.statusNotes)).not.toContain('[booked:cal-booking-1]');
    expect(hermesCall(calls, 'cancelled')).toBeTruthy();
  });
});

test.describe('when the id is missing', () => {
  test('falls back to the attendee email rather than dropping the booking', async () => {
    const { json } = await run(body('BOOKING_CREATED', { metadata: {},
      attendees: [{ name: 'Alan Ong', email: 'onggl@cdgtaxi.com', timeZone: 'Asia/Singapore' }] }));
    expect(json.matched).toBe('opp-abc');
    expect(json.matchedBy).toBe('email');
  });

  test('no id and no matching email: answers 200 and says so, never 500', async () => {
    const { res, json } = await run(body('BOOKING_CREATED', { metadata: {},
      attendees: [{ name: 'Nobody', email: 'nobody@example.com', timeZone: 'Asia/Singapore' }] }), { opp: null });
    expect(res.statusCode).toBe(200);
    expect(json.matched).toBeNull();
  });
});

test.describe('failures never cost us the booking', () => {
  test('Twenty down: still answers 200 so Cal.com does not retry forever', async () => {
    const { res, json } = await run(body('BOOKING_CREATED'), { twentyFail: true });
    expect(res.statusCode).toBe(200);
    expect(json.ok).toBe(true);
    expect(String(json.crm)).toMatch(/failed/);
  });

  test('an event we do not handle is acknowledged and ignored', async () => {
    const { res, json, calls } = await run(body('MEETING_ENDED'));
    expect(res.statusCode).toBe(200);
    expect(json.ignored).toBe('MEETING_ENDED');
    expect(patchCall(calls)).toBeUndefined();
  });
});
