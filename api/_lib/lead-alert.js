// Instant lead alert for /ai-closer: Telegram (speed to lead) + a Resend email
// copy (the durable backup that replaces Formspree). Both best-effort, run in
// parallel, never throw. Each reports 'sent' | 'skipped' | 'failed'.
//
// Routing: LEAD_ALERT_CHAT_ID (+ optional LEAD_ALERT_THREAD_ID). When unset it
// falls back to TELEGRAM_GROUP_ID + TELEGRAM_INBOX_THREAD_ID, which is where
// /api/audit already posts website leads (41 Labs group, inbox topic 27).

const { escapeHtml, fetchWithTimeout } = require('./util');

const DEFAULT_FROM = '41 Labs Leads <leads@41labs.ai>';
const DEFAULT_TO = 'alexander@41labs.ai';

// lead: { tier, name, company, whatsapp, waDigits, email, role, enquiries,
//         saleValue, jobs[], fitReason, notes, utmContent, utmCampaign,
//         nextAction, twentyUrl, crmError }
function alertLines(lead, { html }) {
  const esc = html ? escapeHtml : (s) => String(s == null ? '' : s);
  const wa = lead.waDigits ? `https://wa.me/${lead.waDigits}` : '';
  const who = [lead.name, lead.role ? `(${lead.role})` : ''].filter(Boolean).join(' ');
  const lines = [
    html ? `<b>${esc(lead.tier ? `TIER ${lead.tier}` : 'NEW LEAD')}</b> · 41 Closer ad lead` : `${lead.tier ? `TIER ${lead.tier}` : 'NEW LEAD'} · 41 Closer ad lead`,
    html ? `<b>${esc(who)}</b>` : `Name: ${who}`,
    `Company: ${esc(lead.company || '-')}`,
    wa
      ? (html ? `WhatsApp: <a href="${wa}">${esc(lead.whatsapp)}</a>` : `WhatsApp: ${lead.whatsapp} (${wa})`)
      : `WhatsApp: ${esc(lead.whatsapp || '-')}`,
    lead.email ? `Email: ${esc(lead.email)}` : '',
    `Volume: ${esc(lead.enquiries || '-')} enquiries/week`,
    `Ticket: ${esc(lead.saleValue || '-')}`,
    `Jobs: ${esc(lead.jobs && lead.jobs.length ? lead.jobs.join(', ') : '-')}`,
    lead.fitReason ? `Reason: ${esc(lead.fitReason)}` : '',
    lead.utmContent || lead.utmCampaign
      ? `Ad: ${esc(lead.utmContent || '-')}${lead.utmCampaign ? ` (${esc(lead.utmCampaign)})` : ''}`
      : 'Ad: none tagged',
    lead.notes ? `Notes: ${esc(String(lead.notes).slice(0, 800))}` : '',
    lead.nextAction ? `Next: ${esc(lead.nextAction)}` : '',
    lead.crmError
      ? `CRM write failed (${esc(String(lead.crmError).slice(0, 200))}). Add this lead to Twenty by hand.`
      : (lead.twentyUrl ? (html ? `<a href="${lead.twentyUrl}">Open in Twenty</a>` : `Twenty: ${lead.twentyUrl}`) : ''),
  ];
  return lines.filter(Boolean);
}

async function sendTelegram(lead, { env, fetchImpl }) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chat = env.LEAD_ALERT_CHAT_ID || env.TELEGRAM_GROUP_ID;
  const thread = env.LEAD_ALERT_CHAT_ID ? env.LEAD_ALERT_THREAD_ID : env.TELEGRAM_INBOX_THREAD_ID;
  if (!token || !chat) return 'skipped';
  const payload = {
    chat_id: chat,
    text: alertLines(lead, { html: true }).join('\n'),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
  if (thread && Number(thread)) payload.message_thread_id = Number(thread);
  try {
    const r = await fetchWithTimeout(fetchImpl, `https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }, 4000);
    return r.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

async function sendEmail(lead, { env, fetchImpl }) {
  const key = env.RESEND_API_KEY;
  if (!key) return 'skipped';
  const text = alertLines(lead, { html: false });
  const subject = `${lead.tier ? `TIER ${lead.tier}` : 'New'} lead: ${lead.name}${lead.company && lead.company !== lead.name ? `, ${lead.company}` : ''}`;
  const body = {
    from: env.RESEND_FROM || DEFAULT_FROM,
    to: [env.LEAD_ALERT_EMAIL_TO || DEFAULT_TO],
    subject: subject.slice(0, 200),
    text: text.join('\n'),
    html: alertLines(lead, { html: true }).map((l) => `<p style="margin:0 0 6px">${l}</p>`).join(''),
  };
  if (lead.email) body.reply_to = lead.email;
  try {
    const r = await fetchWithTimeout(fetchImpl, 'https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, 4000);
    return r.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

async function sendLeadAlerts(lead, deps) {
  const [telegram, email] = await Promise.all([
    sendTelegram(lead, deps).catch(() => 'failed'),
    sendEmail(lead, deps).catch(() => 'failed'),
  ]);
  return { telegram, email };
}

module.exports = { alertLines, sendLeadAlerts };
