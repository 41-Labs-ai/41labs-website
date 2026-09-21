// Instant lead alert for /ai-closer: Telegram (speed to lead) + a Resend email
// copy (the durable backup that replaces Formspree). Both best-effort, run in
// parallel, never throw. Each reports 'sent' | 'skipped' | 'failed'.
//
// Routing: LEAD_ALERT_CHAT_ID (+ optional LEAD_ALERT_THREAD_ID). When unset it
// falls back to TELEGRAM_GROUP_ID + TELEGRAM_INBOX_THREAD_ID, which is where
// /api/audit already posts website leads (41 Labs group, inbox topic 27).

const { escapeHtml, fetchWithTimeout } = require('./util');
const { sendGmail } = require('./gmail');

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
    // A partial has to be obvious at a glance: it is someone we can still call, but the
    // questions are unanswered, so it is a different job from a finished lead.
    (() => {
      const badge = lead.partial ? 'PARTIAL' : (lead.tier ? `TIER ${lead.tier}` : 'NEW LEAD');
      const rest = lead.partial ? ' \u00b7 contact only, did not finish the questions' : ' \u00b7 41 Closer ad lead';
      return html ? `<b>${esc(badge)}</b>${esc(rest)}` : `${badge}${rest}`;
    })(),
    html ? `<b>${esc(who)}</b>` : `Name: ${who}`,
    `Company: ${esc(lead.company || '-')}${lead.industry ? ` · ${esc(lead.industry)}` : ''}`,
    lead.website ? `Website: ${esc(lead.website)}` : '',
    lead.whatsappUse ? `WhatsApp use: ${esc(lead.whatsappUse)}` : '',
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

async function postTelegram(text, { env, fetchImpl }) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chat = env.LEAD_ALERT_CHAT_ID || env.TELEGRAM_GROUP_ID;
  const thread = env.LEAD_ALERT_CHAT_ID ? env.LEAD_ALERT_THREAD_ID : env.TELEGRAM_INBOX_THREAD_ID;
  if (!token || !chat) return 'skipped';
  const payload = {
    chat_id: chat,
    text,
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

function sendTelegram(lead, deps) {
  return postTelegram(alertLines(lead, { html: true }).join('\n'), deps);
}

// Sent as its own message, after the lead alert, because the alert and the Hermes
// handoff run in parallel and the alert has already gone by the time Hermes answers.
// Same chat and topic as the alert, so it lands right under the lead it is about.
function sendHermesWarning(fields, lead, deps) {
  const text = [
    `<b>Hermes ignored ${fields.length === 1 ? 'a field' : 'fields'}</b> from ${escapeHtml(lead.name || 'this lead')}`,
    `Not recognised: ${escapeHtml(fields.join(', '))}`,
    'The Closer will not see these answers. The website and Hermes disagree on the field names, so fix one side.',
  ].join('\n');
  return postTelegram(text, deps);
}

// Gmail first: the Workspace already delegates gmail.compose to the service account we
// use for the booking calendar, so it needs no new account, has no practical quota, and
// arrives from our own domain. Resend stays as an override if a key is ever set, since a
// dedicated sending service is better for volume and gives delivery reporting.
async function sendEmail(lead, { env, fetchImpl }) {
  const subject = `${lead.partial ? 'PARTIAL' : lead.tier ? `TIER ${lead.tier}` : 'New'} lead: ${lead.name}${lead.company && lead.company !== lead.name ? `, ${lead.company}` : ''}`.slice(0, 200);
  const text = alertLines(lead, { html: false }).join('\n');
  const html = alertLines(lead, { html: true }).map((l) => `<p style="margin:0 0 6px">${l}</p>`).join('');

  const key = env.RESEND_API_KEY;
  if (key) {
    const body = {
      from: env.RESEND_FROM || DEFAULT_FROM,
      to: [env.LEAD_ALERT_EMAIL_TO || DEFAULT_TO],
      subject, text, html,
    };
    if (lead.email) body.reply_to = lead.email;
    try {
      const r = await fetchWithTimeout(fetchImpl, 'https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }, 4000);
      if (r.ok) return 'sent';
    } catch {
      // fall through to Gmail rather than losing the copy
    }
  }

  return sendGmail({
    to: env.LEAD_ALERT_EMAIL_TO || DEFAULT_TO,
    subject, html, text,
    replyTo: lead.email || '',        // hit reply and you are talking to the lead
  }, { env, fetchImpl });
}

async function sendLeadAlerts(lead, deps) {
  // Keep the reason. A bare 'failed' here hid a real Gmail error for an hour, and on
  // the lead path that is the kind of thing that stays broken for weeks: nothing
  // throws where anyone can see it, the email just never arrives.
  const reason = (e) => `failed:${String((e && e.message) || e).slice(0, 140)}`;
  const [telegram, email] = await Promise.all([
    sendTelegram(lead, deps).catch(reason),
    sendEmail(lead, deps).catch(reason),
  ]);
  return { telegram, email };
}

module.exports = { alertLines, sendLeadAlerts, sendHermesWarning };
