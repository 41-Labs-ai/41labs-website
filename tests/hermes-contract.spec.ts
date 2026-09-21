import { test, expect } from '@playwright/test';
import path from 'path';

// The website and Hermes are separate repos that build separately. On 21 Sep 2026 this
// site was sending `challenges` and `goal`, Hermes's schema did not list them, and they
// were stripped without a word. The Closer never learned what was costing a lead or what
// they wanted. Every test in both repos passed.
//
// THE CONTRACT: the lead fields api/closer-lead.js sends to Hermes on lead_created.
// Hermes pins the same list as WEBSITE_SENDS in src/__tests__/intake/landing-lead.test.ts.
// Change the payload, change both lists.
const WEBSITE_SENDS = [
  'name', 'phone', 'email', 'company', 'enquiries', 'saleValue', 'challenges', 'goal',
  'tier', 'fitReason', 'website', 'notes', 'utm', 'fbclid', 'journey', 'twentyOpportunityId',
];

const LIB = path.join(__dirname, '..', 'api', '_lib', 'hermes.js');
const HANDLER = path.join(__dirname, '..', 'api', 'closer-lead.js');
const ENV = { HERMES_BASE_URL: 'https://hermes.example.com', HERMES_INTAKE_KEY: 'k' };

function fetchReplying(reply: any, seen?: any[]) {
  return async (url: string, init: any) => {
    if (seen) seen.push({ url, body: init?.body ? JSON.parse(init.body) : null });
    return { ok: true, status: 200, json: async () => reply, text: async () => JSON.stringify(reply) };
  };
}

test.describe('the contract with Hermes', () => {
  test('the lead_created payload sends exactly the agreed fields', async () => {
    const seen: any[] = [];
    const saved: Record<string, any> = {};
    const keys = ['TWENTY_API_KEY', 'HERMES_BASE_URL', 'HERMES_INTAKE_KEY', 'TELEGRAM_BOT_TOKEN',
      'RESEND_API_KEY', 'META_CAPI_TOKEN', 'GOOGLE_SERVICE_ACCOUNT_JSON'];
    for (const k of keys) { saved[k] = process.env[k]; delete process.env[k]; }
    Object.assign(process.env, { TWENTY_API_KEY: 'tw', ...ENV });
    const orig = globalThis.fetch;
    (globalThis as any).fetch = async (url: string, init: any) => {
      if (String(url).includes('hermes.example.com')) {
        seen.push(JSON.parse(init.body));
        return { ok: true, status: 200, json: async () => ({ ok: true }), text: async () => '{}' };
      }
      if (String(url).includes('/rest/')) {
        return { ok: true, status: 201, json: async () => ({ data: { x: { id: 'id-1' } } }), text: async () => '' };
      }
      return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
    };
    delete require.cache[require.resolve(HANDLER)];
    const res: any = { statusCode: 200, headers: {}, setHeader() {}, end(b: string) { this.body = b; } };
    try {
      await require(HANDLER)({
        method: 'POST', headers: {},
        body: {
          name: 'Tan Wei Ming', whatsapp: '+6591234567', email: 'wm@tan.sg', website: 'tan.sg',
          enquiries: '50to150', saleValue: '10kplus', challenges: ['afterhours'], goal: 'recover',
          tier: 'A', qualified: 'yes', fbclid: 'abc', utm_content: 'cold_carrental',
          journey: { v: 1, ms: 5000, engagedMs: 4000, scroll: 50, visits: 1, sections: [], marks: [] },
        },
      }, res);
    } finally {
      globalThis.fetch = orig;
      for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    }
    const sent = seen.find((b) => b.event === 'lead_created');
    expect(sent, 'no lead_created reached Hermes').toBeTruthy();
    expect(Object.keys(sent.lead).sort()).toEqual([...WEBSITE_SENDS].sort());
  });
});

test.describe('when Hermes says it ignored a field', () => {
  test('the return value is still exactly "sent"', async () => {
    // The booking cron claims a send and releases it unless the result is exactly
    // 'sent'. Anything else there retries every five minutes forever.
    const { postHermesIntake } = require(LIB);
    const out = await postHermesIntake({ event: 'booked', lead: {} },
      { env: ENV, fetchImpl: fetchReplying({ ok: true, ignoredFields: ['brandNew'] }) });
    expect(out).toBe('sent');
  });

  test('the ignored fields come back through the report, so the caller can raise them', async () => {
    const { postHermesIntake } = require(LIB);
    const report: any = {};
    await postHermesIntake({ event: 'lead_created', lead: {} },
      { env: ENV, fetchImpl: fetchReplying({ ok: true, ignoredFields: ['challenges', 'goal'] }), report });
    expect(report.ignoredFields).toEqual(['challenges', 'goal']);
  });

  test('a clean reply leaves the report empty', async () => {
    const { postHermesIntake } = require(LIB);
    const report: any = {};
    await postHermesIntake({ event: 'lead_created', lead: {} },
      { env: ENV, fetchImpl: fetchReplying({ ok: true }), report });
    expect(report.ignoredFields).toBeUndefined();
  });

  test('a reply that is not JSON never breaks the send', async () => {
    const { postHermesIntake } = require(LIB);
    const report: any = {};
    const out = await postHermesIntake({ event: 'lead_created', lead: {} }, {
      env: ENV, report,
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new Error('not json'); }, text: async () => 'x' }),
    });
    expect(out).toBe('sent');
  });
});
