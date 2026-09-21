import { test, expect } from '@playwright/test';
import path from 'path';

// Unit tests for api/closer-lead.js (the /ai-closer ad landing page form).
// Runs the Vercel function directly with a fake req/res and a stubbed fetch,
// so no server, Twenty, Telegram, Resend or Hermes instance is needed.

const HANDLER = path.join(__dirname, '..', 'api', 'closer-lead.js');

type Call = { url: string; method: string; headers: any; body: any };

// Not every call sends JSON: the Google token exchange posts form-encoded data, and
// blindly JSON.parsing it threw inside the stub itself. That throw then surfaced as the
// caller's "failure reason", which hid what the test was actually asserting.
function parseBody(body: any) {
  if (!body) return null;
  try { return JSON.parse(body); } catch { return String(body); }
}

// Every env var the handler reads. Each run starts from a clean slate so a
// developer's sourced ~/.config/41labs/*.env can never leak into a test.
const ENV_KEYS = [
  'TWENTY_API_KEY', 'TWENTY_BASE_URL', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_GROUP_ID', 'TELEGRAM_INBOX_THREAD_ID',
  'LEAD_ALERT_CHAT_ID', 'LEAD_ALERT_THREAD_ID', 'RESEND_API_KEY', 'RESEND_FROM', 'LEAD_ALERT_EMAIL_TO',
  'HERMES_BASE_URL', 'HERMES_INTAKE_KEY',
  'META_CAPI_TOKEN', 'META_CAPI_PIXEL_ID', 'META_CAPI_TEST_EVENT_CODE',
  // The email path falls back to Gmail, so the service account decides whether email is
  // 'skipped' or attempted. Leaving it out let a developer's sourced ~/.config/41labs
  // env leak in and turned "no email configured" into a live token exchange.
  'GOOGLE_SERVICE_ACCOUNT_JSON', 'LEAD_ALERT_EMAIL_FROM', 'LEAD_ALERT_EMAIL_TO',
];

const FULL_ENV = {
  TWENTY_API_KEY: 'test-key',
  TELEGRAM_BOT_TOKEN: 'tg-token',
  LEAD_ALERT_CHAT_ID: '-100123',
  LEAD_ALERT_THREAD_ID: '27',
  RESEND_API_KEY: 're_test',
  HERMES_BASE_URL: 'https://hermes.example.com/',
  HERMES_INTAKE_KEY: 'intake-secret',
  META_CAPI_TOKEN: 'EAAmetatoken',
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
  replyJson?: Record<string, any>; // these hosts answer 200 with this body
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
    calls.push({ url, method: init?.method, headers: init?.headers || {}, body: parseBody(init?.body) });
    if (opts.throwHosts?.includes(host)) throw new Error('network down');
    if (opts.hangHosts?.includes(host)) {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    }
    if (opts.failHosts?.includes(host)) return { ok: false, status: 500, text: async () => 'boom', json: async () => ({}) };
    if (opts.replyJson?.[host]) return { ok: true, status: 200, json: async () => opts.replyJson![host], text: async () => JSON.stringify(opts.replyJson![host]) };
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
  enquiries: '50to150',
  saleValue: '500to2k',
  qualified: 'yes',
  tier: 'A',
  fitReason: 'High enquiry value. Guarantee-eligible once the maths is checked on the call',
  challenges: ['slow', 'afterhours'],
  goal: 'recover',
  notes: 'Most chats come in after 9pm',
  utm_source: 'facebook',
  utm_campaign: '41closer_lp_2026-09',
  utm_content: 'ad_stalk1_notchatbot',
  fbclid: 'abc123',
  website: 'tanaircon.sg',
};

test.describe('POST /api/closer-lead', () => {
  test('rejects non-POST with 405', async () => {
    const { res, json } = await run({}, { method: 'GET' });
    expect(res.statusCode).toBe(405);
    expect(json.ok).toBe(false);
  });

  // A real bot pastes the same URL into every field. A valid email plus a real phone
  // beside a tripped honeypot is browser autofill, not a bot, and is kept: see the
  // autofill tests further down.
  test('honeypot filled by an actual bot: pretends success and never calls anything', async () => {
    const bot = { name: 'http://spam.example', whatsapp: 'http://spam.example', email: 'http://spam.example' };
    const { res, json, calls } = await run({ ...bot, url_hp: 'http://spam.example' }, { env: FULL_ENV });
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
    expect(opp.body.statusNotes).toContain('Costing them most: Replies take too long, Nobody answers after hours');
    expect(opp.body.statusNotes).toContain('Wants: Stop losing paid-for enquiries');
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
    expect(text).toContain('S$500-2,000');
    expect(text).toContain('Replies take too long');
    expect(text).toContain(lead.fitReason);
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
    expect(mail.body.text).toContain('Replies take too long');
  });

  // 16 Sep 2026: two booked calls never reached the CRM. The honeypot field was
  // labelled "Website URL" while the real form also asks for a website, so browser
  // autofill filled it. The API answered {ok:true, skipped:'bot'}, the page showed the
  // calendar anyway, and the lead booked a call we had no record of. A trap that eats
  // real buyers is worse than no trap.
  test('a complete human answer is kept even if the honeypot was autofilled', async () => {
    const { json, calls } = await run({ ...lead, url_hp: 'www.tanaircon.sg' }, { env: FULL_ENV });
    expect(json.ok).toBe(true);
    expect(json.skipped, 'a real answer must not be discarded').toBeUndefined();
    expect(json.id, 'the deal must still be created').toBeTruthy();
    expect(tgCall(calls), 'and Alexander must still be told').toBeTruthy();
  });

  test('an obvious bot (honeypot + no real answers) is still dropped silently', async () => {
    const { json, calls } = await run(
      { name: 'x', whatsapp: '123', url_hp: 'http://spam.example', enquiries: '', saleValue: '' },
      { env: FULL_ENV });
    expect(json.skipped).toBe('bot');
    expect(tgCall(calls)).toBeUndefined();
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

  // Resend failing must never cost us the notification: the email path falls through to
  // Gmail. No service account is configured here, so the fallback reports 'skipped'
  // rather than sending. That the fallback really reaches Gmail is proven in
  // gmail-lib.spec.ts; what matters here is that Resend dying is not fatal.
  test('Resend returns 500: the email path falls through, Telegram still sends, response still ok', async () => {
    const { json } = await run(lead, { env: FULL_ENV, failHosts: ['api.resend.com'] });
    expect(json.ok).toBe(true);
    expect(json.alerts).toEqual({ telegram: 'sent', email: 'skipped' });
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
      enquiries: '50to150',
      saleValue: '500to2k',
      challenges: ['slow', 'afterhours'],
      goal: 'recover',
      tier: 'A',
      fitReason: lead.fitReason,
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

  // 21 Sep 2026: Hermes silently dropped `challenges` and `goal` for days. It now names
  // any field it did not recognise, and that has to reach a person, not a log.
  test('Hermes ignores a field: a second Telegram message names it', async () => {
    const { json, calls } = await run(lead, {
      env: FULL_ENV,
      replyJson: { 'hermes.example.com': { ok: true, ignoredFields: ['goal', 'challenges'] } },
    });
    expect(json.hermes).toBe('sent');
    expect(json.hermesIgnored).toEqual(['goal', 'challenges']);
    const tg = calls.filter((c) => c.url.startsWith('https://api.telegram.org/'));
    expect(tg).toHaveLength(2);
    expect(tg[1].body.text).toMatch(/goal, challenges/);
    expect(tg[1].body.text).toMatch(/Tan Wei Ming/);
    expect(tg[1].body.message_thread_id).toBe(tg[0].body.message_thread_id);
  });

  test('Hermes takes every field: one Telegram message, nothing extra reported', async () => {
    const { json, calls } = await run(lead, {
      env: FULL_ENV,
      replyJson: { 'hermes.example.com': { ok: true, ignoredFields: [] } },
    });
    expect(json.hermesIgnored).toBeUndefined();
    expect(calls.filter((c) => c.url.startsWith('https://api.telegram.org/'))).toHaveLength(1);
  });

  test('the warning failing never costs the visitor their ok', async () => {
    const { res, json } = await run(lead, {
      env: FULL_ENV,
      replyJson: { 'hermes.example.com': { ok: true, ignoredFields: ['goal'] } },
      throwHosts: ['api.telegram.org'],
    });
    expect(res.statusCode).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.hermesIgnored).toEqual(['goal']);
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

  test('the answers and the website land in Twenty; website becomes the company domain', async () => {
    const { calls } = await run(lead);
    const company = calls.find((c) => c.url.endsWith('/rest/companies'))!;
    const opp = calls.find((c) => c.url.endsWith('/rest/opportunities'))!;
    expect(company.body.domainName).toEqual({ primaryLinkUrl: 'https://tanaircon.sg' });
    expect(opp.body.statusNotes).toContain('Wants: Stop losing paid-for enquiries');
    
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

  test('the Hermes handoff carries the goal, the challenges and the website', async () => {
    const { calls } = await run(lead, { env: FULL_ENV });
    const h = hermesCall(calls)!;
    expect(h.body.lead).toMatchObject({ goal: 'recover', challenges: ['slow', 'afterhours'], website: 'tanaircon.sg' });
  });

  test('the Telegram alert shows the goal and website', async () => {
    const { calls } = await run(lead, { env: FULL_ENV });
    const text = tgCall(calls)!.body.text;
    expect(text).toContain('Stop losing paid-for enquiries');
    expect(text).toContain('tanaircon.sg');
  });

  test('no company field: the company name comes from the website', async () => {
    const { calls } = await run({ ...lead, company: undefined, website: 'https://www.tanaircon.sg/' });
    const company = calls.find((c) => c.url.endsWith('/rest/companies'))!;
    expect(company.body.name).toBe('Tanaircon');
    expect(company.body.domainName).toEqual({ primaryLinkUrl: 'https://www.tanaircon.sg/' });
  });

  test('no company and no website: falls back to the person name', async () => {
    const { calls } = await run({ ...lead, company: undefined, website: '' });
    const company = calls.find((c) => c.url.endsWith('/rest/companies'))!;
    expect(company.body.name).toBe('Tan Wei Ming');
    expect(company.body.domainName).toBeUndefined();
  });
});

// What Meta gets back. The point of all of this is that the ad account optimises
// for leads we actually want, so a Tier C form-fill and a Tier A must not look
// the same to Meta.
const capiCall = (calls: Call[]) => calls.find((c) => c.url.includes('graph.facebook.com'));
const capiEvents = (calls: Call[]) => capiCall(calls)?.body?.data ?? [];
const eventNames = (calls: Call[]) => capiEvents(calls).map((e: any) => e.event_name);

const browser = {
  eventId: 'evt-abc-123',
  fbp: 'fb.1.1757660000000.1234567890',
  fbc: 'fb.1.1757660400123.abc123',
};

test.describe('Meta Conversions API', () => {
  test('a Tier A lead sends both Lead and QualifiedLead, in one request', async () => {
    const { calls } = await run({ ...lead, ...browser }, { env: FULL_ENV });
    expect(calls.filter((c) => c.url.includes('graph.facebook.com'))).toHaveLength(1);
    expect(eventNames(calls)).toEqual(['Lead', 'QualifiedLead']);
  });

  test('a Tier B lead is still one we want, so it qualifies too', async () => {
    const { calls } = await run({ ...lead, ...browser, tier: 'B' }, { env: FULL_ENV });
    expect(eventNames(calls)).toEqual(['Lead', 'QualifiedLead']);
  });

  test('a Tier C lead sends Lead only: Meta must not learn to buy more of these', async () => {
    const { calls } = await run({ ...lead, ...browser, tier: 'C', qualified: 'no' }, { env: FULL_ENV });
    expect(eventNames(calls)).toEqual(['Lead']);
  });

  test('the browser pixel event id is reused so the same lead is not counted twice', async () => {
    const { calls } = await run({ ...lead, ...browser }, { env: FULL_ENV });
    const [leadEv, qualEv] = capiEvents(calls);
    expect(leadEv.event_id).toBe('evt-abc-123');
    expect(qualEv.event_id).toBe('evt-abc-123_q');
  });

  test('with no id from the browser it still sends, rather than losing the conversion', async () => {
    const { calls } = await run({ ...lead, fbp: browser.fbp }, { env: FULL_ENV });
    expect(eventNames(calls)).toEqual(['Lead', 'QualifiedLead']);
    expect(capiEvents(calls)[0].event_id).toMatch(/^lead_/);
  });

  test('carries the identifiers the browser pixel cannot: typed phone, cookies, IP, UA', async () => {
    const { calls } = await run({ ...lead, ...browser }, {
      env: FULL_ENV,
      headers: { 'x-forwarded-for': '203.0.113.9, 70.41.3.18', 'user-agent': 'Mozilla/5.0 test' },
    });
    const u = capiEvents(calls)[0].user_data;
    expect(u.ph).toHaveLength(1);            // hashed, from the number they typed
    expect(u.em).toHaveLength(1);
    expect(u.fn).toHaveLength(1);
    expect(u.fbp).toBe(browser.fbp);
    expect(u.fbc).toBe(browser.fbc);
    expect(u.client_ip_address).toBe('203.0.113.9');   // the visitor, not the proxy
    expect(u.client_user_agent).toBe('Mozilla/5.0 test');
  });

  test('only the qualified event carries a value, and it says which tier', async () => {
    const { calls } = await run({ ...lead, ...browser }, { env: FULL_ENV });
    const [leadEv, qualEv] = capiEvents(calls);
    expect(leadEv.custom_data.value).toBeUndefined();
    expect(qualEv.custom_data.value).toBeGreaterThan(0);
    expect(qualEv.custom_data.currency).toBe('SGD');
    expect(qualEv.custom_data.tier).toBe('A');
  });

  test('the short-form variant reports its own page as the source url', async () => {
    const { calls } = await run({ ...lead, ...browser, variant: 'sf' }, { env: FULL_ENV });
    expect(capiEvents(calls)[0].event_source_url).toBe('https://41labs.ai/ai-closer-sf');
  });

  test('no token configured: no call to Meta, and the lead is still saved', async () => {
    const { calls, json } = await run({ ...lead, ...browser }, { env: { TWENTY_API_KEY: 'test-key' } });
    expect(capiCall(calls)).toBeUndefined();
    expect(json.ok).toBe(true);
    expect(json.meta).toBe('skipped');
  });

  test('Meta being down never costs us the lead', async () => {
    const { json } = await run({ ...lead, ...browser }, { env: FULL_ENV, throwHosts: ['graph.facebook.com'] });
    expect(json.ok).toBe(true);
    expect(json.id).toBe('opportunities-id-3');
    expect(json.meta).toBe('failed');
  });

  test('a bot caught by the honeypot is never reported to Meta as a lead', async () => {
    const bot = { name: 'http://spam.example', whatsapp: 'http://spam.example', email: 'http://spam.example' };
    const { calls } = await run({ ...bot, ...browser, url_hp: 'http://spam.example' }, { env: FULL_ENV });
    expect(capiCall(calls)).toBeUndefined();
  });
});

test.describe('what the visitor did before they filled the form', () => {
  const journey = {
    ms: 251000,
    engagedMs: 170000,
    scroll: 86,
    visits: 2,
    landing: '/ai-closer',
    referrer: 'https://l.facebook.com/',
    sections: [['proof-2', 52000], ['hero', 41000], ['guarantee', 30000]],
  };

  test('the journey is written on the deal, so the call starts knowing what they read', async () => {
    const { calls } = await run({ ...lead, journey });
    const opp = calls.find((c) => c.url.endsWith('/rest/opportunities'))!;
    expect(opp.body.statusNotes).toContain('4m 11s on page');
    expect(opp.body.statusNotes).toContain('2m 50s engaged');
    expect(opp.body.statusNotes).toContain('86%');
    expect(opp.body.statusNotes).toContain('proof-2');
  });

  test('a second visit is called out, because it means they came back', async () => {
    const { calls } = await run({ ...lead, journey });
    const opp = calls.find((c) => c.url.endsWith('/rest/opportunities'))!;
    expect(opp.body.statusNotes).toMatch(/visit 2/i);
  });

  test('no journey data at all is fine: the note simply leaves it out', async () => {
    const { calls } = await run(lead);
    const opp = calls.find((c) => c.url.endsWith('/rest/opportunities'))!;
    expect(opp.body.statusNotes).not.toContain('on page');
    expect(opp.body.statusNotes).toContain('Tier: A');
  });

  test('a hostile journey payload cannot blow up the handler or the note size', async () => {
    const nasty = { ms: 'x', engagedMs: -5, scroll: 9999, visits: 1e9, sections: 'not-an-array' };
    const { json, calls } = await run({ ...lead, journey: nasty });
    expect(json.ok).toBe(true);
    const opp = calls.find((c) => c.url.endsWith('/rest/opportunities'))!;
    expect(opp.body.statusNotes.length).toBeLessThanOrEqual(2500);
  });

  test('the journey goes to Hermes too, so the bot knows what they already read', async () => {
    const { calls } = await run({ ...lead, journey }, { env: FULL_ENV });
    expect(hermesCall(calls)!.body.lead.journey).toMatchObject({ scroll: 86, visits: 2 });
  });
});

// Twenty rejects a company whose name already exists. create() ran people ->
// companies -> opportunities with no recovery, so the SECOND lead from any domain
// we already know died after the Person was written, leaving an orphan contact and
// no deal. Telegram was the only thing that still fired.
test.describe('a company we already know must not kill the lead', () => {
  const dupCompany = async (body: any) => {
    const calls: Call[] = [];
    const origFetch = globalThis.fetch;
    const saved: Record<string, string | undefined> = {};
    for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
    Object.assign(process.env, { TWENTY_API_KEY: 'test-key' });
    let n = 0;
    (globalThis as any).fetch = async (url: string, init: any) => {
      calls.push({ url, method: init?.method, headers: init?.headers || {}, body: parseBody(init?.body) });
      if (url.includes('/rest/companies') && init?.method === 'POST') {
        return { ok: false, status: 400, text: async () => '{"messages":["A duplicate entry was detected"]}', json: async () => ({}) };
      }
      if (url.includes('/rest/companies') && (!init?.method || init.method === 'GET')) {
        return { ok: true, status: 200, json: async () => ({ data: { companies: [{ id: 'existing-company-id', name: 'Tan Aircon Services' }] } }), text: async () => '' };
      }
      if (url.includes('/rest/')) {
        n += 1;
        const obj = url.split('/rest/')[1].split('?')[0];
        return { ok: true, status: 201, json: async () => ({ data: { [obj]: { id: `${obj}-id-${n}` } } }), text: async () => '' };
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }), text: async () => '{}' };
    };
    delete require.cache[require.resolve(HANDLER)];
    const handler = require(HANDLER);
    const res = fakeRes();
    try { await handler({ method: 'POST', body, headers: {} }, res); }
    finally {
      (globalThis as any).fetch = origFetch;
      for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    }
    return { json: JSON.parse(res.body || '{}'), calls };
  };

  test('the deal is still created, linked to the company that already exists', async () => {
    const { json, calls } = await dupCompany(lead);
    expect(json.ok).toBe(true);
    const opp = calls.find((c) => c.url.endsWith('/rest/opportunities'))!;
    expect(opp).toBeTruthy();
    expect(opp.body.companyId).toBe('existing-company-id');
    expect(opp.body.pointOfContactId).toMatch(/^people-id/);
  });

  test('and the lead is never lost just because the company lookup also fails', async () => {
    const calls: Call[] = [];
    const origFetch = globalThis.fetch;
    const saved: Record<string, string | undefined> = {};
    for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
    Object.assign(process.env, { TWENTY_API_KEY: 'test-key' });
    let n = 0;
    (globalThis as any).fetch = async (url: string, init: any) => {
      calls.push({ url, method: init?.method, headers: init?.headers || {}, body: parseBody(init?.body) });
      if (url.includes('/rest/companies')) return { ok: false, status: 500, text: async () => 'boom', json: async () => ({}) };
      if (url.includes('/rest/')) {
        n += 1;
        const obj = url.split('/rest/')[1].split('?')[0];
        return { ok: true, status: 201, json: async () => ({ data: { [obj]: { id: `${obj}-id-${n}` } } }), text: async () => '' };
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }), text: async () => '{}' };
    };
    delete require.cache[require.resolve(HANDLER)];
    const handler = require(HANDLER);
    const res = fakeRes();
    try { await handler({ method: 'POST', body: lead, headers: {} }, res); }
    finally {
      (globalThis as any).fetch = origFetch;
      for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    }
    const json = JSON.parse(res.body || '{}');
    expect(json.ok).toBe(true);                       // a deal with no company beats no deal
    const opp = calls.find((c) => c.url.endsWith('/rest/opportunities'))!;
    expect(opp.body.companyId).toBeUndefined();
    expect(opp.body.pointOfContactId).toMatch(/^people-id/);
  });
});

// Alexander wants a ping for every lead, finished or not. A partial is still someone
// he can call, but the questions are unanswered, so it has to be obvious which is which.
test.describe('he is notified either way', () => {
  const partial = { partial: true, name: 'Tan Wei Ming', whatsapp: '+6591234567', email: 'wm@tanaircon.sg' };

  test('a half-finished form still pings Telegram', async () => {
    const { calls, json } = await run(partial, { env: FULL_ENV });
    expect(json.ok).toBe(true);
    expect(tgCall(calls), 'no Telegram alert for a partial').toBeTruthy();
  });

  test('and the ping says it is a partial, not a finished lead', async () => {
    const { calls } = await run(partial, { env: FULL_ENV });
    const text = tgCall(calls)!.body.text;
    expect(text).toMatch(/PARTIAL/);
    expect(text).toMatch(/did not finish/i);
    expect(text).toContain('Tan Wei Ming');
    expect(text).toContain('9123');           // the number, so he can call straight back
  });

  test('a finished lead leads with the tier instead', async () => {
    const { calls } = await run(lead, { env: FULL_ENV });
    const text = tgCall(calls)!.body.text;
    expect(text).toMatch(/TIER A/);
    expect(text).not.toMatch(/PARTIAL/);
  });

  test('a partial is still never reported to Meta as a conversion', async () => {
    const { calls } = await run(partial, { env: FULL_ENV });
    expect(calls.find((c) => c.url.includes('graph.facebook.com'))).toBeUndefined();
  });
});
