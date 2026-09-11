import { test, expect } from '@playwright/test';
import path from 'path';

// Unit tests for api/closer-lead.js (the /ai-closer ad landing page form).
// Runs the Vercel function directly with a fake req/res and a stubbed fetch,
// so no server or Twenty instance is needed.

const HANDLER = path.join(__dirname, '..', 'api', 'closer-lead.js');

type Call = { url: string; method: string; body: any };

function fakeRes() {
  const res: any = { statusCode: 200, headers: {}, body: '' };
  res.setHeader = (k: string, v: string) => { res.headers[k] = v; };
  res.end = (b: string) => { res.body = b; };
  return res;
}

async function run(body: any, opts: { method?: string; key?: string | null; fail?: boolean } = {}) {
  const calls: Call[] = [];
  const origFetch = globalThis.fetch;
  const origKey = process.env.TWENTY_API_KEY;
  if (opts.key === null) delete process.env.TWENTY_API_KEY;
  else process.env.TWENTY_API_KEY = opts.key ?? 'test-key';

  let n = 0;
  (globalThis as any).fetch = async (url: string, init: any) => {
    calls.push({ url, method: init?.method, body: init?.body ? JSON.parse(init.body) : null });
    if (opts.fail) return { ok: false, status: 500, text: async () => 'boom', json: async () => ({}) };
    n += 1;
    const obj = url.split('/rest/')[1];
    return { ok: true, status: 201, json: async () => ({ data: { [obj]: { id: `${obj}-id-${n}` } } }), text: async () => '' };
  };

  delete require.cache[require.resolve(HANDLER)];
  const handler = require(HANDLER);
  const res = fakeRes();
  await handler({ method: opts.method ?? 'POST', body }, res);

  (globalThis as any).fetch = origFetch;
  if (origKey === undefined) delete process.env.TWENTY_API_KEY; else process.env.TWENTY_API_KEY = origKey;
  return { res, json: JSON.parse(res.body || '{}'), calls };
}

const lead = {
  name: 'Tan Wei Ming',
  whatsapp: '+65 9123 4567',
  email: 'wm@tanaircon.sg',
  company: 'Tan Aircon Services',
  role: 'owner',
  enquiries: '50to150',
  saleValue: '200to1k',
  qualified: 'yes',
  notes: 'Most chats come in after 9pm',
  utm_source: 'facebook',
  utm_campaign: '41closer_lp_2026-09',
  utm_content: 'ad_stalk1_notchatbot',
  fbclid: 'abc123',
};

test.describe('POST /api/closer-lead', () => {
  test('rejects non-POST with 405', async () => {
    const { res, json } = await run({}, { method: 'GET' });
    expect(res.statusCode).toBe(405);
    expect(json.ok).toBe(false);
  });

  test('honeypot filled: pretends success and never calls Twenty', async () => {
    const { res, json, calls } = await run({ ...lead, website: 'http://spam.example' });
    expect(res.statusCode).toBe(200);
    expect(json.skipped).toBe('bot');
    expect(calls).toHaveLength(0);
  });

  test('missing name or WhatsApp number returns 400', async () => {
    expect((await run({ ...lead, name: '' })).res.statusCode).toBe(400);
    expect((await run({ ...lead, whatsapp: '  ' })).res.statusCode).toBe(400);
  });

  test('no Twenty key configured: still 200 so the visitor is never blocked', async () => {
    const { res, json, calls } = await run(lead, { key: null });
    expect(res.statusCode).toBe(200);
    expect(json.error).toBe('crm_not_configured');
    expect(calls).toHaveLength(0);
  });

  test('creates person, company and a SCREENING 41 Closer deal linked together', async () => {
    const { json, calls } = await run(lead);
    expect(json.ok).toBe(true);

    const person = calls.find((c) => c.url.endsWith('/rest/people'))!;
    const company = calls.find((c) => c.url.endsWith('/rest/companies'))!;
    const opp = calls.find((c) => c.url.endsWith('/rest/opportunities'))!;
    expect(person && company && opp).toBeTruthy();

    expect(person.body.name).toEqual({ firstName: 'Tan', lastName: 'Wei Ming' });
    expect(person.body.phones.primaryPhoneNumber).toContain('91234567');
    expect(person.body.emails.primaryEmail).toBe('wm@tanaircon.sg');
    expect(company.body.name).toBe('Tan Aircon Services');

    expect(opp.body.stage).toBe('SCREENING');
    expect(opp.body.productLine).toBe('CLOSER_41');
    expect(opp.body.waitingOn).toBe('US');
    expect(opp.body.name).toContain('Tan Aircon Services');
    expect(opp.body.pointOfContactId).toMatch(/^people-id/);
    expect(opp.body.companyId).toMatch(/^companies-id/);
    expect(opp.body.leadSource).toContain('41closer_lp_2026-09');
    expect(opp.body.statusNotes).toContain('50-150');
    expect(opp.body.statusNotes).toContain('Qualified: yes');
    expect(opp.body.statusNotes).toContain('after 9pm');
    expect(opp.body.statusNotes).toContain('fbclid=abc123');
  });

  test('Twenty error: returns 200 with ok=false, never a 5xx', async () => {
    const { res, json } = await run(lead, { fail: true });
    expect(res.statusCode).toBe(200);
    expect(json.ok).toBe(false);
  });

  test('trims and caps oversized input', async () => {
    const { calls } = await run({ ...lead, notes: 'x'.repeat(10000) });
    const opp = calls.find((c) => c.url.endsWith('/rest/opportunities'))!;
    expect(opp.body.statusNotes.length).toBeLessThan(3000);
  });
});
