import { test, expect } from '@playwright/test';
import path from 'path';
import crypto from 'crypto';

// Lead email goes over Gmail as alexander@41labs.ai. Formspree's free tier was 50 a
// month and the page sent two per lead, so it died after 25. The Workspace already
// delegates gmail.compose to the service account we use for the booking calendar.

const LIB = path.join(__dirname, '..', 'api', '_lib');
const gmail = require(path.join(LIB, 'gmail.js'));
const PEM = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const SA = JSON.stringify({ client_email: 'x@y.iam.gserviceaccount.com', private_key: PEM });

const decode = (raw: string) => Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

test.describe('the message it builds', () => {
  const msg = () => decode(gmail.buildRaw({
    to: 'alexander@41labs.ai', from: 'alexander@41labs.ai',
    subject: 'TIER A lead: Tan Wei Ming', replyTo: 'wm@tanaircon.sg',
    text: 'plain body', html: '<p>rich body</p>',
  }));

  test('carries both a plain and an HTML part, so any client can read it', () => {
    const m = msg();
    expect(m).toContain('Content-Type: multipart/alternative');
    expect(m).toContain('plain body');
    expect(m).toContain('<p>rich body</p>');
  });

  test('replying goes to the lead, not to ourselves', () => {
    expect(msg()).toContain('Reply-To: wm@tanaircon.sg');
  });

  test('a non-ASCII name arrives readable instead of as mojibake', () => {
    const raw = decode(gmail.buildRaw({ to: 'a@b.co', from: 'a@b.co', subject: 'TIER A lead: Zoë Ng', text: 'x', html: 'x' }));
    expect(raw).toMatch(/Subject: =\?UTF-8\?B\?/);
    const b64 = raw.match(/Subject: =\?UTF-8\?B\?(.+?)\?=/)![1];
    expect(Buffer.from(b64, 'base64').toString('utf8')).toBe('TIER A lead: Zoë Ng');
  });

  // A lead types their own name. Without this, a newline in it would let them append
  // headers to our message: a Bcc to anyone they like.
  test('a newline in a header value cannot inject another header', () => {
    const raw = decode(gmail.buildRaw({
      to: 'a@b.co', from: 'a@b.co', subject: 'ok',
      replyTo: 'evil@x.com\r\nBcc: victim@elsewhere.com',
      text: 'x', html: 'x',
    }));
    expect(raw).not.toMatch(/^Bcc:/m);
    expect(gmail.header('a\r\nBcc: x')).not.toContain('\n');
  });
});

test.describe('sending', () => {
  const run = async (opts: { ok?: boolean; throws?: boolean; env?: any } = {}) => {
    const calls: any[] = [];
    const fetchImpl = async (url: string, init: any) => {
      calls.push({ url, init });
      if (opts.throws) throw new Error('network');
      if (String(url).includes('oauth2')) return { ok: true, status: 200, json: async () => ({ access_token: 'tok' }), text: async () => '' };
      return { ok: opts.ok !== false, status: opts.ok === false ? 500 : 200, json: async () => ({ id: 'm1' }), text: async () => '' };
    };
    const r = await gmail.sendGmail(
      { subject: 's', text: 't', html: '<p>t</p>' },
      { env: opts.env ?? { GOOGLE_SERVICE_ACCOUNT_JSON: SA }, fetchImpl },
    );
    return { r, calls };
  };

  test('sends, and asks only for the scope it needs', async () => {
    const { r, calls } = await run();
    expect(r).toBe('sent');
    const tokenCall = calls.find((c) => String(c.url).includes('oauth2'));
    const assertion = new URLSearchParams(tokenCall.init.body).get('assertion')!;
    const claims = JSON.parse(Buffer.from(assertion.split('.')[1], 'base64').toString());
    expect(claims.scope).toBe('https://www.googleapis.com/auth/gmail.compose');
    expect(claims.sub, 'Gmail has no service-account inbox: it must act as a person').toBe('alexander@41labs.ai');
    expect(calls.some((c) => String(c.url).includes('gmail.googleapis.com'))).toBe(true);
  });

  test('no service account configured is skipped, not an error', async () => {
    expect((await run({ env: {} })).r).toBe('skipped');
  });

  test('a Gmail outage is reported, never thrown into the lead path', async () => {
    expect((await run({ ok: false })).r).toBe('failed');
    expect((await run({ throws: true })).r).toBe('failed');
  });
});

// The import of sendGmail was missing for three deploys and every lead email failed
// with "sendGmail is not defined". Nothing threw where anyone could see it, and the
// alert just reported a bare 'failed'. This proves the wiring, not just the file parsing.
test.describe('lead-alert really reaches Gmail', () => {
  const alert = require(path.join(LIB, 'lead-alert.js'));

  test('with no Resend key, the email goes out over Gmail', async () => {
    const hit: string[] = [];
    const fetchImpl = async (url: string) => {
      hit.push(String(url));
      if (String(url).includes('oauth2')) return { ok: true, status: 200, json: async () => ({ access_token: 'tok' }), text: async () => '' };
      return { ok: true, status: 200, json: async () => ({ id: 'm1' }), text: async () => '' };
    };
    const r = await alert.sendLeadAlerts(
      { name: 'Tan Wei Ming', tier: 'A', whatsapp: '+6591234567', waDigits: '6591234567', email: 'wm@tanaircon.sg' },
      { env: { GOOGLE_SERVICE_ACCOUNT_JSON: SA, TELEGRAM_BOT_TOKEN: 't', LEAD_ALERT_CHAT_ID: '-1' }, fetchImpl },
    );
    expect(r.email, 'a bare "failed" means the reason was swallowed again').toBe('sent');
    expect(hit.some((u) => u.includes('gmail.googleapis.com'))).toBe(true);
  });

  test('a failure keeps its reason instead of collapsing to "failed"', async () => {
    const fetchImpl = async (url: string) => {
      if (String(url).includes('oauth2')) return { ok: true, status: 200, json: async () => ({ access_token: 'tok' }), text: async () => '' };
      return { ok: false, status: 403, json: async () => ({}), text: async () => '{"error":"forbidden"}' };
    };
    const r = await alert.sendLeadAlerts(
      { name: 'Tan', tier: 'A', whatsapp: '+6591234567', waDigits: '6591234567' },
      { env: { GOOGLE_SERVICE_ACCOUNT_JSON: SA }, fetchImpl },
    );
    expect(r.email).toMatch(/^failed:403/);
  });
});
