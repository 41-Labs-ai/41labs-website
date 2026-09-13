import { test, expect } from '@playwright/test';
import path from 'path';

// api/booking-check.js answers "has this person booked yet?", because Google's
// appointment iframe never tells the page a booking completed.
//
// It is public, so the tests are written from the point of view of someone probing it:
// the damage would be learning who has meetings with Alexander and when.

const HANDLER = path.join(__dirname, '..', 'api', 'booking-check.js');
const ENV_KEYS = ['GOOGLE_SERVICE_ACCOUNT_JSON', 'BOOKING_CALENDAR_ID', 'BOOKING_CALENDAR_IMPERSONATE', 'BOOKING_EVENT_MATCH'];
const ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

function fakeRes() {
  const res: any = { statusCode: 200, headers: {}, body: '' };
  res.setHeader = (k: string, v: string) => { res.headers[k] = v; };
  res.end = (b?: string) => { res.body = b || ''; };
  return res;
}

async function run(query: string, opts: { events?: any[]; env?: Record<string, string>; method?: string } = {}) {
  const origFetch = globalThis.fetch;
  const saved: Record<string, string | undefined> = {};
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  Object.assign(process.env, opts.env ?? { GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'x@y.iam.gserviceaccount.com', private_key: PEM }) });

  (globalThis as any).fetch = async (url: string) => {
    if (String(url).includes('oauth2')) return { ok: true, status: 200, json: async () => ({ access_token: 'tok' }), text: async () => '' };
    return { ok: true, status: 200, json: async () => ({ items: opts.events ?? [] }), text: async () => '' };
  };
  delete require.cache[require.resolve(HANDLER)];
  const handler = require(HANDLER);
  const res = fakeRes();
  try {
    await handler({ method: opts.method ?? 'GET', url: '/api/booking-check' + query, headers: {} }, res);
  } finally {
    (globalThis as any).fetch = origFetch;
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
  return { res, json: JSON.parse(res.body || '{}') };
}

import crypto from 'crypto';
const PEM = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const booking = (email: string) => ({
  id: 'ev1', summary: '41 Closer (Tan Wei Ming)',
  start: { dateTime: '2026-09-16T13:30:00+08:00' },
  attendees: [{ email }],
  hangoutLink: 'https://meet.google.com/abc-defg-hij',
});

test.describe('it answers the one question it is for', () => {
  test('says booked, with the time and the meet link', async () => {
    const { json } = await run(`?id=${ID}&email=wm@tanaircon.sg`, { events: [booking('wm@tanaircon.sg')] });
    expect(json.booked).toBe(true);
    expect(json.start).toContain('2026-09-16');
    expect(json.meet).toContain('meet.google.com');
  });

  test('says not booked when nothing matches that email', async () => {
    const { json } = await run(`?id=${ID}&email=someone@else.com`, { events: [booking('wm@tanaircon.sg')] });
    expect(json.booked).toBe(false);
  });

  test('ignores events that are not 41 Closer bookings', async () => {
    const other = { ...booking('wm@tanaircon.sg'), summary: 'Lunch with Ricky' };
    expect((await run(`?id=${ID}&email=wm@tanaircon.sg`, { events: [other] })).json.booked).toBe(false);
  });

  test('matches regardless of how the email was typed', async () => {
    const { json } = await run(`?id=${ID}&email=WM@TanAircon.SG`, { events: [booking('wm@tanaircon.sg')] });
    expect(json.booked).toBe(true);
  });
});

test.describe('it cannot be used to find out who is meeting Alexander', () => {
  test('without the opportunity id it refuses, so you cannot probe an email', async () => {
    const { res, json } = await run('?email=wm@tanaircon.sg', { events: [booking('wm@tanaircon.sg')] });
    expect(res.statusCode).toBe(400);
    expect(json.error).toBe('id_required');
  });

  test('a guessable id is not enough: it has to be a real UUID', async () => {
    for (const id of ['1', 'abc', '00000000', 'null']) {
      expect((await run(`?id=${id}&email=wm@tanaircon.sg`)).res.statusCode, id).toBe(400);
    }
  });

  test('needs an email too', async () => {
    expect((await run(`?id=${ID}`)).res.statusCode).toBe(400);
  });

  test('never returns anyone else’s details', async () => {
    const { json } = await run(`?id=${ID}&email=wm@tanaircon.sg`, { events: [booking('wm@tanaircon.sg')] });
    const blob = JSON.stringify(json);
    expect(blob).not.toContain('Tan Wei Ming');      // no names
    expect(blob).not.toContain('attendees');
    expect(Object.keys(json).sort()).toEqual(['booked', 'meet', 'ok', 'start']);
  });

  test('only GET', async () => {
    expect((await run(`?id=${ID}&email=a@b.co`, { method: 'POST' })).res.statusCode).toBe(405);
  });

  test('is never cached, or a stale "not booked" would stick', async () => {
    const { res } = await run(`?id=${ID}&email=wm@tanaircon.sg`, { events: [booking('wm@tanaircon.sg')] });
    expect(res.headers['Cache-Control']).toBe('no-store');
  });
});

test.describe('it never breaks the page', () => {
  test('no calendar configured just means not booked yet', async () => {
    const { res, json } = await run(`?id=${ID}&email=a@b.co`, { env: {} });
    expect(res.statusCode).toBe(200);
    expect(json.booked).toBe(false);
    expect(json.reason).toBe('calendar_not_configured');
  });
});
