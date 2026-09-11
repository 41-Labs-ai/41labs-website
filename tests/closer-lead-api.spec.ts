import { test, expect } from '@playwright/test';
import path from 'path';

// Unit tests for api/closer-lead.js (the /ai-closer ad landing page form).
// Runs the Vercel function directly with a fake req/res and a stubbed fetch,
// so no server, Twenty, Telegram, Resend or Hermes instance is needed.

const HANDLER = path.join(__dirname, '..', 'api', 'closer-lead.js');

type Call = { url: string; method: string; headers: any; body: any };

// Every env var the handler reads. Each run starts from a clean slate so a
// developer's sourced ~/.config/41labs/*.env can never leak into a test.
const ENV_KEYS = [
  'TWENTY_API_KEY', 'TWENTY_BASE_URL', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_GROUP_ID', 'TELEGRAM_INBOX_THREAD_ID',
  'LEAD_ALERT_CHAT_ID', 'LEAD_ALERT_THREAD_ID', 'RESEND_API_KEY', 'RESEND_FROM', 'LEAD_ALERT_EMAIL_TO',
  'HERMES_BASE_URL', 'HERMES_INTAKE_KEY',
];

const FULL_ENV = {
  TWENTY_API_KEY: 'test-key',
  TELEGRAM_BOT_TOKEN: 'tg-token',
  LEAD_ALERT_CHAT_ID: '-100123',
  LEAD_ALERT_THREAD_ID: '27',
  RESEND_API_KEY: 're_test',
  HERMES_BASE_URL: 'https://hermes.example.com/',
  HERMES_INTAKE_KEY: 'intake-secret',
};

function fakeRes() {
  const res: any = { statusCode: 200, headers: {}, body: '' };
  res.setHeader = (k: string, v: string) => { res.headers[k] = v; };
  res.end = (b: string) => { res.body = b; };
  return res;
}

type Opts = {
  method?: string;
  env?: Record<string, string>;
  fail?: boolean; // Twenty fails
  failHosts?: string[]; // these hosts return 500
  throwHosts?: string[]; // these hosts throw (network error)
  hangHosts?: string[]; // these hosts never answer until aborted
  headers?: Record<string, string>;
};

async function run(body: any, opts: Opts = {}) {
  const calls: Call[] = [];
  const origFetch = globalThis.fetch;
  const saved: Record<string, string | undefined> = {};
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  Object.assign(process.env, opts.env ?? { TWENTY_API_KEY: 'test-key' });

  let n = 0;
  (globalThis as any).fetch = async (url: string, init: any) => {
    const host = new URL(url).host;
    calls.push({ url, method: init?.method, headers: init?.headers || {}, body: init?.body ? JSON.parse(init.body) : null });
    if (opts.throwHosts?.includes(host)) throw new Error('network down');
    if (opts.hangHosts?.includes(host)) {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    }
    if (opts.failHosts?.includes(host)) return { ok: false, status: 500, text: async () => 'boom', json: async () => ({}) };
    if (url.includes('/rest/')) {
      if (opts.fail) return { ok: false, status: 500, text: async () => 'boom', json: async () => ({}) };
      n += 1;
      const obj = url.split('/rest/')[1];
      return { ok: true, status: 201, json: async () => ({ data: { [obj]: { id: `${obj}-id-${n}` } } }), text: async () => '' };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true }), text: async () => '{}' };
  };

  delete require.cache[require.resolve(HANDLER)];
  const handler = require(HANDLER);
  const res = fakeRes();
  const started = Date.now();
  try {
    await handler({ method: opts.method ?? 'POST', body, headers: opts.headers ?? {} }, res);
  } finally {
    (globalThis as any).fetch = origFetch;
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
  return { res, json: JSON.parse(res.body || '{}'), calls, ms: Date.now() - started };
}

const twentyCalls = (calls: Call[]) => calls.filter((c) => c.url.includes('/rest/'));
const tgCall = (calls: Call[]) => calls.find((c) => c.url.startsWith('https://api.telegram.org/'));
const mailCall = (calls: Call[]) => calls.find((c) => c.url === 'https://api.resend.com/emails');
const hermesCall = (calls: Call[]) => calls.find((c) => c.url.includes('/api/intake/landing-lead'));

const lead = {
  name: 'Tan Wei Ming',
  whatsapp: '+65 9123 4567',
  email: 'wm@tanaircon.sg',
  company: 'Tan Aircon Services',
  role: 'owner',
  enquiries: '50to150',
  saleValue: '200to1k',
  qualified: 'yes',
  tier: 'A',
  fitReason: 'High enquiry value and real sales work in chat',
  jobs: ['quotes', 'bookings'],
  notes: 'Most chats come in after 9pm',
  utm_source: 'facebook',
  utm_campaign: '41closer_lp_2026-09',
  utm_content: 'ad_stalk1_notchatbot',
  fbclid: 'abc123',
  industry: 'servicing',
  whatsappUse: 'most',
  website: 'tanaircon.sg',
};

test.describe('POST /api/closer-lead', () => {
  test('rejects non-POST with 405', async () => {
    const { res, json } = await run({}, { method: 'GET' });
    expect(res.statusCode).toBe(405);
    expect(json.ok).toBe(false);
  });

  test('honeypot filled: pretends success and never calls anything', async () => {
    const { res, json, calls } = await run({ ...lead, url_hp: 'http://spam.example' }, { env: FULL_ENV });
    expect(res.statusCode).toBe(200);
    expect(json.skipped).toBe('bot');
    expect(calls).toHaveLength(0);
  });

  test('missing name or WhatsApp number returns 400', async () => {
    expect((await run({ ...lead, name: '' })).res.statusCode).toBe(400);
    expect((await run({ ...lead, whatsapp: '  ' })).res.statusCode).toBe(400);
  });

  test('no Twenty key configured: still 200, no Twenty calls', async () => {
    const { res, json, calls } = await run(lead, { env: {} });
    expect(res.statusCode).toBe(200);
    expect(json.error).toBe('crm_not_configured');
    expect(twentyCalls(calls)).toHaveLength(0);
  });

  test('no Twenty key configured: the Telegram + email alert still fires so the lead is never lost', async () => {
    const { json, calls } = await run(lead, { env: { ...FULL_ENV, TWENTY_API_KEY: '' } });
    expect(json.error).toBe('crm_not_configured');
    expect(twentyCalls(calls)).toHaveLength(0);
    expect(tgCall(calls)).toBeTruthy();
    expect(mailCall(calls)).toBeTruthy();
    expect(tgCall(calls)!.body.text).toContain('CRM');
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
    expect(opp.body.statusNotes).toContain('Tier: A');
    expect(opp.body.statusNotes).toContain('Chats involve: Quotes, Bookings');
    expect(opp.body.nextAction).toMatch(/^TIER A/);
    expect(opp.body.statusNotes).toContain('after 9pm');
    expect(opp.body.statusNotes).toContain('fbclid=abc123');
  });

  test('stores the visitor user agent so the booking CAPI event can send client_user_agent', async () => {
    const { calls } = await run(lead, { headers: { 'user-agent': 'Mozilla/5.0 (iPhone) test' } });
    const opp = calls.find((c) => c.url.endsWith('/rest/opportunities'))!;
    expect(opp.body.statusNotes).toContain('UA: Mozilla/5.0 (iPhone) test');
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

test.describe('closer-lead: instant Telegram + email alert', () => {
  test('Telegram message leads with the tier and carries every field Alexander needs to call back', async () => {
    const { calls } = await run(lead, { env: FULL_ENV });
    const tg = tgCall(calls)!;
    expect(tg.url).toBe('https://api.telegram.org/bottg-token/sendMessage');
    expect(tg.body.chat_id).toBe('-100123');
    expect(tg.body.message_thread_id).toBe(27);
    expect(tg.body.parse_mode).toBe('HTML');
    const text: string = tg.body.text;
    expect(text.startsWith('<b>TIER A</b>')).toBe(true);
    expect(text).toContain('Tan Wei Ming');
    expect(text).toContain('Tan Aircon Services');
    expect(text).toContain('<a href="https://wa.me/6591234567">+65 9123 4567</a>');
    expect(text).toContain('50-150');
    expect(text).toContain('S$200-1,000');
    expect(text).toContain('Quotes, Bookings');
    expect(text).toContain('High enquiry value and real sales work in chat');
    expect(text).toContain('ad_stalk1_notchatbot');
    expect(text).not.toContain('—');
  });

  test('HTML in visitor input is escaped so Telegram never rejects the message', async () => {
    const { calls } = await run({ ...lead, name: 'Bob <script>', company: 'A & B' }, { env: FULL_ENV });
    const text: string = tgCall(calls)!.body.text;
    expect(text).toContain('Bob &lt;script&gt;');
    expect(text).toContain('A &amp; B');
  });

  test('falls back to the existing TELEGRAM_GROUP_ID + inbox topic when LEAD_ALERT_* is not set', async () => {
    const env = { ...FULL_ENV, LEAD_ALERT_CHAT_ID: '', LEAD_ALERT_THREAD_ID: '', TELEGRAM_GROUP_ID: '-100999', TELEGRAM_INBOX_THREAD_ID: '27' };
    const { calls } = await run(lead, { env });
    const tg = tgCall(calls)!;
    expect(tg.body.chat_id).toBe('-100999');
    expect(tg.body.message_thread_id).toBe(27);
  });

  test('no thread id: posts to the chat without message_thread_id', async () => {
    const { calls } = await run(lead, { env: { ...FULL_ENV, LEAD_ALERT_THREAD_ID: '' } });
    expect(tgCall(calls)!.body.message_thread_id).toBeUndefined();
  });

  test('email copy goes to alexander@41labs.ai via Resend with reply-to the lead', async () => {
    const { calls } = await run(lead, { env: FULL_ENV });
    const mail = mailCall(calls)!;
    expect(mail.method).toBe('POST');
    expect(mail.headers.Authorization).toBe('Bearer re_test');
    expect(mail.body.to).toEqual(['alexander@41labs.ai']);
    expect(mail.body.from).toMatch(/@41labs\.ai>?$/);
    expect(mail.body.reply_to).toBe('wm@tanaircon.sg');
    expect(mail.body.subject).toMatch(/^TIER A/);
    expect(mail.body.subject).toContain('Tan Wei Ming');
    expect(mail.body.text).toContain('https://wa.me/6591234567');
    expect(mail.body.text).toContain('Quotes, Bookings');
  });

  test('alerts are skipped (not failed) when their env is missing', async () => {
    const { json, calls } = await run(lead, { env: { TWENTY_API_KEY: 'k' } });
    expect(json.ok).toBe(true);
    expect(tgCall(calls)).toBeUndefined();
    expect(mailCall(calls)).toBeUndefined();
    expect(json.alerts).toEqual({ telegram: 'skipped', email: 'skipped' });
  });

  test('Telegram down: the email still sends, the CRM record is still created, visitor gets ok', async () => {
    const { res, json, calls } = await run(lead, { env: FULL_ENV, throwHosts: ['api.telegram.org'] });
    expect(res.statusCode).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.alerts.telegram).toBe('failed');
    expect(json.alerts.email).toBe('sent');
    expect(mailCall(calls)).toBeTruthy();
  });

  test('Resend returns 500: Telegram still sends and the response is still ok', async () => {
    const { json } = await run(lead, { env: FULL_ENV, failHosts: ['api.resend.com'] });
    expect(json.ok).toBe(true);
    expect(json.alerts).toEqual({ telegram: 'sent', email: 'failed' });
  });

  test('Twenty fails: the alert says so, so Alexander knows to add the lead by hand', async () => {
    const { calls } = await run(lead, { env: FULL_ENV, fail: true });
    expect(tgCall(calls)!.body.text).toMatch(/CRM write failed/);
  });
});

test.describe('closer-lead: Hermes handoff', () => {
  test('POSTs lead_created to the Hermes intake with the key header and the exact contract', async () => {
    const { json, calls } = await run(lead, { env: FULL_ENV });
    const h = hermesCall(calls)!;
    expect(h.url).toBe('https://hermes.example.com/api/intake/landing-lead');
    expect(h.method).toBe('POST');
    expect(h.headers['x-intake-key']).toBe('intake-secret');
    expect(h.body.event).toBe('lead_created');
    expect(h.body.lead).toEqual({
      name: 'Tan Wei Ming',
      phone: '+6591234567',
      email: 'wm@tanaircon.sg',
      company: 'Tan Aircon Services',
      role: 'owner',
      enquiries: '50to150',
      saleValue: '200to1k',
      jobs: ['quotes', 'bookings'],
      tier: 'A',
      fitReason: 'High enquiry value and real sales work in chat',
      industry: 'servicing',
      whatsappUse: 'most',
      website: 'tanaircon.sg',
      notes: 'Most chats come in after 9pm',
      utm: { source: 'facebook', campaign: '41closer_lp_2026-09', content: 'ad_stalk1_notchatbot' },
      fbclid: 'abc123',
      twentyOpportunityId: 'opportunities-id-3',
    });
    expect(json.hermes).toBe('sent');
  });

  test('runs after the Twenty write so it can carry the opportunity id', async () => {
    const { calls } = await run(lead, { env: FULL_ENV });
    const oppIdx = calls.findIndex((c) => c.url.endsWith('/rest/opportunities'));
    const hIdx = calls.findIndex((c) => c.url.includes('/api/intake/landing-lead'));
    expect(oppIdx).toBeGreaterThanOrEqual(0);
    expect(hIdx).toBeGreaterThan(oppIdx);
  });

  test('skipped when HERMES_BASE_URL or HERMES_INTAKE_KEY is missing', async () => {
    for (const drop of ['HERMES_BASE_URL', 'HERMES_INTAKE_KEY']) {
      const { json, calls } = await run(lead, { env: { ...FULL_ENV, [drop]: '' } });
      expect(hermesCall(calls)).toBeUndefined();
      expect(json.hermes).toBe('skipped');
    }
  });

  test('Twenty failed: Hermes still gets the lead, with a null opportunity id', async () => {
    const { calls } = await run(lead, { env: FULL_ENV, fail: true });
    expect(hermesCall(calls)!.body.lead.twentyOpportunityId).toBeNull();
  });

  test('Hermes hangs: aborted after ~3s, the visitor still gets ok', async () => {
    const { json, ms } = await run(lead, { env: FULL_ENV, hangHosts: ['hermes.example.com'] });
    expect(json.ok).toBe(true);
    expect(json.hermes).toBe('failed');
    expect(ms).toBeLessThan(4500);
    expect(ms).toBeGreaterThanOrEqual(2900);
  });

  test('Hermes 500: reported as failed, never thrown', async () => {
    const { res, json } = await run(lead, { env: FULL_ENV, failHosts: ['hermes.example.com'] });
    expect(res.statusCode).toBe(200);
    expect(json.hermes).toBe('failed');
  });

  test('a real website answer is NOT mistaken for the spam trap', async () => {
    const { json } = await run(lead);
    expect(json.skipped).toBeUndefined();
    expect(json.ok).toBe(true);
  });

  test('industry, WhatsApp use and website land in Twenty; website becomes the company domain', async () => {
    const { calls } = await run(lead);
    const company = calls.find((c) => c.url.endsWith('/rest/companies'))!;
    const opp = calls.find((c) => c.url.endsWith('/rest/opportunities'))!;
    expect(company.body.domainName).toEqual({ primaryLinkUrl: 'https://tanaircon.sg' });
    expect(opp.body.statusNotes).toContain('Industry: Servicing');
    expect(opp.body.statusNotes).toContain('WhatsApp: Most sales start on WhatsApp');
    expect(opp.body.statusNotes).toContain('Website: tanaircon.sg');
    expect(opp.body.nextAction).toMatch(/WOW preview/i);
  });

  test('an Instagram handle is kept in notes but not used as a domain', async () => {
    const { calls } = await run({ ...lead, website: '@tanaircon' });
    const company = calls.find((c) => c.url.endsWith('/rest/companies'))!;
    const opp = calls.find((c) => c.url.endsWith('/rest/opportunities'))!;
    expect(company.body.domainName).toBeUndefined();
    expect(opp.body.statusNotes).toContain('Website: @tanaircon');
  });

  test('tier C leads are not sent a WOW preview task', async () => {
    const { calls } = await run({ ...lead, tier: 'C', qualified: 'no' });
    const opp = calls.find((c) => c.url.endsWith('/rest/opportunities'))!;
    expect(opp.body.nextAction).not.toMatch(/WOW/i);
  });

  test('the Hermes handoff carries industry, WhatsApp use and website', async () => {
    const { calls } = await run(lead, { env: FULL_ENV });
    const h = hermesCall(calls)!;
    expect(h.body.lead).toMatchObject({ industry: 'servicing', whatsappUse: 'most', website: 'tanaircon.sg' });
  });

  test('the Telegram alert shows industry and website', async () => {
    const { calls } = await run(lead, { env: FULL_ENV });
    const text = tgCall(calls)!.body.text;
    expect(text).toContain('Servicing');
    expect(text).toContain('tanaircon.sg');
  });
});
