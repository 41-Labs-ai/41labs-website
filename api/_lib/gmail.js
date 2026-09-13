// Lead email over Gmail, sent as alexander@41labs.ai.
//
// Why not a form service: Formspree's free tier is 50 submissions a month and the page
// sends two per lead (one when they give their details, one when they finish), so it
// died after 25 leads. Resend needs a new account and a DNS change.
//
// The 41labs.ai Workspace already delegates gmail.compose to the service account, and
// GOOGLE_SERVICE_ACCOUNT_JSON is already on Vercel for the booking cron. So this needs
// no new account, no new key, has no practical quota, and arrives from our own domain
// instead of a third party's shared sender.

const { getAccessToken, loadServiceAccount } = require('./google-calendar');

const SCOPE = 'https://www.googleapis.com/auth/gmail.compose';
const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

// Anything that reaches a header has to be one line: a newline would let a lead's own
// name inject extra headers into the message.
const header = (v) => String(v || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 240);

// RFC 2047 for non-ASCII subjects, so a name with an accent does not arrive as mojibake.
function encodeSubject(s) {
  const v = header(s);
  return /^[\x20-\x7E]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, 'utf8').toString('base64')}?=`;
}

function buildRaw({ to, from, subject, html, text, replyTo }) {
  const boundary = 'b' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const lines = [
    `To: ${header(to)}`,
    `From: ${header(from)}`,
    ...(replyTo ? [`Reply-To: ${header(replyTo)}`] : []),
    `Subject: ${encodeSubject(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    text || '',
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    html || '',
    '',
    `--${boundary}--`,
    '',
  ];
  return b64url(lines.join('\r\n'));
}

// 'sent' | 'skipped' (not configured) | 'failed'. Never throws: losing the email copy
// must not cost us the lead, which Telegram and Twenty already have.
async function sendGmail({ to, from, subject, html, text, replyTo }, { env, fetchImpl, timeoutMs = 6000 }) {
  let sa;
  try {
    sa = loadServiceAccount(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch {
    return 'skipped';
  }
  if (!sa) return 'skipped';

  const sender = from || env.LEAD_ALERT_EMAIL_FROM || 'alexander@41labs.ai';
  const recipient = to || env.LEAD_ALERT_EMAIL_TO || 'alexander@41labs.ai';

  try {
    const token = await getAccessToken(sa, {
      fetchImpl, nowSec: Date.now() / 1000,
      scope: SCOPE,
      // Gmail has no "service account inbox": it must act as a real person.
      sub: env.LEAD_ALERT_EMAIL_FROM || 'alexander@41labs.ai',
    });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetchImpl(SEND_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: buildRaw({ to: recipient, from: sender, subject, html, text, replyTo }) }),
        signal: ctrl.signal,
      });
      return r.ok ? 'sent' : 'failed';
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return 'failed';
  }
}

module.exports = { sendGmail, buildRaw, header, encodeSubject, SCOPE };
