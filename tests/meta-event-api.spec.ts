import { test, expect } from '@playwright/test';
import path from 'path';

// api/meta-event.js is the server half of the browser-fired Meta events. It is public,
// so the tests are written from the point of view of someone abusing it: the worst
// damage they could do is inflate ROAS or double-count a conversion, and both would
// quietly wreck how the ad set optimises rather than throw an error anyone would see.

const HANDLER = path.join(__dirname, '..', 'api', 'meta-event.js');
const ENV_KEYS = ['META_CAPI_TOKEN', 'META_CAPI_PIXEL_ID', 'META_CAPI_TEST_EVENT_CODE'];

function fakeRes() {
  const res: any = { statusCode: 200, headers: {}, body: '' };
  res.setHeader = (k: string, v: string) => { res.headers[k] = v; };
  res.end = (b?: string) => { res.body = b || ''; };
  return res;
}

async function run(body: any, opts: { method?: string; env?: Record<string, string>; headers?: any } = {}) {
  const calls: any[] = [];
  const origFetch = globalThis.fetch;
  const saved: Record<string, string | undefined> = {};
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  Object.assign(process.env, opts.env ?? { META_CAPI_TOKEN: 'EAAtoken' });

  (globalThis as any).fetch = async (url: string, init: any) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body) : null });
    return { ok: true, status: 200, text: async () => '{}', json: async () => ({}) };
  };
  delete require.cache[require.resolve(HANDLER)];
  const handler = require(HANDLER);
  const res = fakeRes();
  try {
    await handler({ method: opts.method ?? 'POST', body, headers: opts.headers ?? { 'user-agent': 'UA', 'x-forwarded-for': '203.0.113.9' } }, res);
  } finally {
    (globalThis as any).fetch = origFetch;
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
  return { res, json: JSON.parse(res.body || '{}'), calls };
}

const sent = (calls: any[]) => calls.find((c) => c.url.includes('graph.facebook.com'))?.body?.data?.[0];

test.describe('the events it will send', () => {
  for (const name of ['InitiateCheckout', 'ViewContent', 'Schedule']) {
    test(`sends ${name} with the id the pixel used`, async () => {
      const { json, calls } = await run({ name, eventId: 'evt-1' });
      expect(json.ok).toBe(true);
      const ev = sent(calls);
      expect(ev.event_name).toBe(name);
      expect(ev.event_id).toBe('evt-1');
      expect(ev.action_source).toBe('website');
    });
  }

  test('refuses an event name it does not know', async () => {
    const { res, calls } = await run({ name: 'Purchase', eventId: 'evt-1' });
    expect(res.statusCode).toBe(400);
    expect(calls).toHaveLength(0);
  });

  test('refuses to send without an event id, which would double count', async () => {
    const { res, json, calls } = await run({ name: 'Schedule' });
    expect(res.statusCode).toBe(400);
    expect(json.error).toBe('event_id_required');
    expect(calls).toHaveLength(0);
  });

  test('only POST', async () => {
    expect((await run({ name: 'ViewContent', eventId: 'e' }, { method: 'GET' })).res.statusCode).toBe(405);
  });
});

test.describe('it does not trust the caller', () => {
  test('a value supplied by the client is ignored: Schedule keeps the value we set', async () => {
    const capi = require(path.join(__dirname, '..', 'api', '_lib', 'meta-capi.js'));
    const { calls } = await run({ name: 'Schedule', eventId: 'e', value: 999999, currency: 'USD' });
    const ev = sent(calls);
    expect(ev.custom_data.value).toBe(capi.VALUE_SCHEDULE);
    expect(ev.custom_data.currency).toBe('SGD');
  });

  test('InitiateCheckout and ViewContent carry no value at all', async () => {
    for (const name of ['InitiateCheckout', 'ViewContent']) {
      const { calls } = await run({ name, eventId: 'e', value: 5000 });
      expect(sent(calls).custom_data.value, name).toBeUndefined();
    }
  });

  test('a source url on someone else’s domain is dropped', async () => {
    const { calls } = await run({ name: 'ViewContent', eventId: 'e', sourceUrl: 'https://evil.example/ai-closer' });
    expect(sent(calls).event_source_url).toBe('https://41labs.ai/ai-closer');
  });

  test('our own source url is kept, so the sf variant reports itself', async () => {
    const { calls } = await run({ name: 'ViewContent', eventId: 'e', sourceUrl: 'https://41labs.ai/ai-closer-sf' });
    expect(sent(calls).event_source_url).toBe('https://41labs.ai/ai-closer-sf');
  });
});

test.describe('match quality', () => {
  test('hashes the identifiers and adds what only the server knows', async () => {
    const { calls } = await run({
      name: 'Schedule', eventId: 'e',
      email: 'WM@TanAircon.sg', phone: '+65 9123 4567', fullName: 'Tan Wei Ming',
      fbp: 'fb.1.1.2', fbc: 'fb.1.3.4',
    });
    const u = sent(calls).user_data;
    expect(u.em[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(u.ph[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(u.fn[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(u.ln[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(u.fbp).toBe('fb.1.1.2');
    expect(u.fbc).toBe('fb.1.3.4');
    expect(u.client_ip_address).toBe('203.0.113.9');
    expect(u.client_user_agent).toBe('UA');
  });

  test('raw email and phone never appear in what is sent', async () => {
    const { calls } = await run({ name: 'Schedule', eventId: 'e', email: 'wm@tanaircon.sg', phone: '+6591234567' });
    const blob = JSON.stringify(calls);
    expect(blob).not.toContain('wm@tanaircon.sg');
    expect(blob).not.toContain('91234567');
  });

  test('builds fbc from a bare fbclid when the cookie is missing', async () => {
    const { calls } = await run({ name: 'InitiateCheckout', eventId: 'e', fbclid: 'ABC123' });
    expect(sent(calls).user_data.fbc).toMatch(/^fb\.1\.\d{13}\.ABC123$/);
  });
});

test.describe('it never breaks the page', () => {
  test('no token configured still answers ok', async () => {
    const { res, json, calls } = await run({ name: 'ViewContent', eventId: 'e' }, { env: {} });
    expect(res.statusCode).toBe(200);
    expect(json.meta).toBe('skipped');
    expect(calls).toHaveLength(0);
  });

  test('junk body is a 400, not a crash', async () => {
    for (const junk of [null, 'a string', 42, []]) {
      const { res } = await run(junk as any);
      expect(res.statusCode).toBe(400);
    }
  });
});
