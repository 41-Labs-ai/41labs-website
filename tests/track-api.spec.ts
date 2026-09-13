import { test, expect } from '@playwright/test';
import path from 'path';

// Unit tests for api/track.js — the sink for the journey beacon that
// closer-analytics.js fires when a visitor leaves /ai-closer.
//
// Two rules drive the whole design:
//   it must never slow down or break a page unload, and
//   everything in the body came from the open internet, so nothing is trusted.

const HANDLER = path.join(__dirname, '..', 'api', 'track.js');
const ENV_KEYS = ['GA4_MEASUREMENT_ID', 'GA4_API_SECRET'];

type Call = { url: string; body: any };

function fakeRes() {
  const res: any = { statusCode: 200, headers: {}, body: '' };
  res.setHeader = (k: string, v: string) => { res.headers[k] = v; };
  res.end = (b?: string) => { res.body = b || ''; };
  return res;
}

async function run(body: any, opts: { env?: Record<string, string>; method?: string; throws?: boolean } = {}) {
  const calls: Call[] = [];
  const origFetch = globalThis.fetch;
  const saved: Record<string, string | undefined> = {};
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  Object.assign(process.env, opts.env ?? {});

  (globalThis as any).fetch = async (url: string, init: any) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body) : null });
    if (opts.throws) throw new Error('ga down');
    return { ok: true, status: 204, text: async () => '', json: async () => ({}) };
  };

  delete require.cache[require.resolve(HANDLER)];
  const handler = require(HANDLER);
  const res = fakeRes();
  try {
    await handler({ method: opts.method ?? 'POST', body, headers: { 'user-agent': 'UA', 'x-forwarded-for': '203.0.113.9' } }, res);
  } finally {
    (globalThis as any).fetch = origFetch;
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
  return { res, calls };
}

const beacon = {
  v: 1,
  vid: 'visitor-1',
  sid: 'session-1',
  page: '/ai-closer',
  variant: 'long',
  ga: '1234567.7654321',
  ids: { fbp: 'fb.1.1.2', fbc: 'fb.1.3.4' },
  attr: { first: { utm_content: 'ad_stalk1', fbclid: 'abc' }, last: { utm_content: 'ad_stalk1' } },
  journey: { ms: 251000, engagedMs: 170000, scroll: 86, visits: 2, sections: [['proof-2', 52000], ['hero', 41000]], marks: [['scroll_depth', 12]] },
};

const GA_ENV = { GA4_MEASUREMENT_ID: 'G-TEST', GA4_API_SECRET: 'secret' };
const gaCall = (calls: Call[]) => calls.find((c) => c.url.includes('google-analytics.com'));

test.describe('accepting the beacon', () => {
  test('answers 204 with no body, so the unload is never held open', async () => {
    const { res } = await run(beacon);
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
  });

  test('only POST is accepted', async () => {
    const { res } = await run(beacon, { method: 'GET' });
    expect(res.statusCode).toBe(405);
  });

  test('junk in means 204 out, never a 500 that would show up as an error rate', async () => {
    for (const junk of [null, undefined, 'a string', 42, [], { journey: 'nope' }]) {
      const { res } = await run(junk as any);
      expect(res.statusCode).toBe(204);
    }
  });
});

test.describe('forwarding to GA4', () => {
  test('sends the journey as an event GA4 can report on', async () => {
    const { calls } = await run(beacon, { env: GA_ENV });
    const ga = gaCall(calls)!;
    expect(ga.url).toContain('measurement_id=G-TEST');
    expect(ga.url).toContain('api_secret=secret');
    const ev = ga.body.events[0];
    expect(ev.name).toBe('closer_journey');
    expect(ev.params).toMatchObject({
      page_path: '/ai-closer',
      variant: 'long',
      engaged_seconds: 170,
      scroll_depth: 86,
      visits: 2,
      top_section: 'proof-2',
      utm_content: 'ad_stalk1',
    });
  });

  test('stitches onto the same GA4 user as the browser hits when the _ga cookie was readable', async () => {
    const { calls } = await run(beacon, { env: GA_ENV });
    expect(gaCall(calls)!.body.client_id).toBe('1234567.7654321');
  });

  test('falls back to our own visitor id when GA has not set a cookie yet', async () => {
    const { calls } = await run({ ...beacon, ga: '' }, { env: GA_ENV });
    expect(gaCall(calls)!.body.client_id).toBe('visitor-1');
  });

  test('does nothing at all when GA4 is not configured', async () => {
    const { calls, res } = await run(beacon);
    expect(calls).toHaveLength(0);
    expect(res.statusCode).toBe(204);
  });

  test('GA4 being down is still a 204: losing analytics must never look like a site error', async () => {
    const { res } = await run(beacon, { env: GA_ENV, throws: true });
    expect(res.statusCode).toBe(204);
  });
});

test.describe('not trusting the body', () => {
  test('an absurd journey is clamped rather than forwarded as-is', async () => {
    const { calls } = await run(
      { ...beacon, journey: { ms: 1e15, engagedMs: 1e15, scroll: 9999, visits: 1e9, sections: 'nope' } },
      { env: GA_ENV },
    );
    const p = gaCall(calls)!.body.events[0].params;
    expect(p.scroll_depth).toBeLessThanOrEqual(100);
    expect(p.visits).toBeLessThanOrEqual(999);
    expect(p.engaged_seconds).toBeLessThanOrEqual(24 * 60 * 60);
  });

  test('a section name cannot smuggle markup or a huge string into the report', async () => {
    const { calls } = await run(
      { ...beacon, journey: { ...beacon.journey, sections: [['<script>alert(1)</script>' + 'x'.repeat(500), 9000]] } },
      { env: GA_ENV },
    );
    const top = gaCall(calls)!.body.events[0].params.top_section;
    expect(top).not.toContain('<');
    expect(top.length).toBeLessThanOrEqual(40);
  });

  test('never forwards the Meta cookies or raw attribution blob to GA4', async () => {
    const { calls } = await run(beacon, { env: GA_ENV });
    const sent = JSON.stringify(gaCall(calls)!.body);
    expect(sent).not.toContain('fb.1.1.2');
    expect(sent).not.toContain('fbclid');
  });
});
