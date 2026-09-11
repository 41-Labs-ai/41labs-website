// POST /api/closer-lead
// Lead form on /ai-closer (the Meta ad landing page). Creates Person + Company +
// a SCREENING 41 Closer Opportunity in Twenty, linked together, with the ad's UTMs
// in leadSource so cost per lead / per booked call can be traced back to the ad.
// Then, best-effort and in parallel (a failure never blocks the visitor):
//   - instant alert to Alexander: Telegram + a Resend email copy (api/_lib/lead-alert.js).
//     Fires even when the CRM write fails, so the lead is never lost.
//   - handoff to Hermes (41 Closer) intake, event 'lead_created' (api/_lib/hermes.js).
// The page still posts to Formspree too, for now. See docs/BOOKING-PIPELINE.md.

const { sendLeadAlerts } = require('./_lib/lead-alert');
const { postHermesIntake } = require('./_lib/hermes');
const { e164Digits } = require('./_lib/util');

const TWENTY_BASE = process.env.TWENTY_BASE_URL || 'https://twenty-server-production-bb71.up.railway.app';

const ENQUIRIES = { under20: 'Under 20', '20to50': '20-50', '50to150': '50-150', '150plus': '150+' };
const SALE = { under200: 'Under S$200', '200to1k': 'S$200-1,000', '1kto5k': 'S$1,000-5,000', '5kplus': 'S$5,000+' };
const ROLE = { owner: 'Owner', sales_head: 'Head of sales', manager: 'Manager', other: 'Other' };
const JOBS = { answers: 'Simple questions', quotes: 'Quotes', bookings: 'Bookings', stock: 'Stock/price checks', orders: 'Orders/payments' };
const NEXT = {
  A: 'TIER A: guarantee-eligible. Call within 1 hour, even if they booked.',
  B: 'TIER B: confirm the call is booked. If not, WhatsApp them within 1 working hour.',
  C: 'TIER C: triage. WhatsApp within 1 working day, check volume and ticket before offering a call.',
};

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

const clean = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function splitName(full) {
  const parts = full.split(/\s+/);
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function send(res, status, obj) {
  res.statusCode = status;
  res.end(JSON.stringify(obj));
}

async function create(key, object, record) {
  const r = await fetch(`${TWENTY_BASE}/rest/${object}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`${object} ${r.status}: ${txt.slice(0, 200)}`);
  }
  const data = await r.json();
  const created = data && data.data ? Object.values(data.data)[0] : null;
  return created && created.id ? created.id : null;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method_not_allowed' });

  const body = await readBody(req);

  // honeypot: bots fill hidden fields. Pretend success and skip.
  if (clean(body._gotcha) || clean(body.website)) return send(res, 200, { ok: true, skipped: 'bot' });

  const name = clean(body.name, 120);
  const whatsapp = clean(body.whatsapp, 40);
  if (!name || !whatsapp) return send(res, 400, { ok: false, error: 'missing_fields' });

  const env = process.env;
  const fetchImpl = (...a) => fetch(...a);
  const key = env.TWENTY_API_KEY;

  const company = clean(body.company, 160) || name;
  const email = clean(body.email, 160);
  const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const utm = UTM_KEYS
    .map((k) => (clean(body[k], 120) ? `${k}=${clean(body[k], 120)}` : ''))
    .filter(Boolean);
  const utmObj = {};
  for (const k of UTM_KEYS) if (clean(body[k], 120)) utmObj[k.slice(4)] = clean(body[k], 120);
  const fbclid = clean(body.fbclid, 300);
  const tier = ['A', 'B', 'C'].includes(body.tier) ? body.tier : '';
  const jobKeys = (Array.isArray(body.jobs) ? body.jobs : [body.jobs]).filter((j) => JOBS[j]);
  const jobs = jobKeys.map((j) => JOBS[j]);
  const fitReason = clean(body.fitReason, 200);
  const leadNotes = clean(body.notes, 1500);
  const headers = req.headers || {};
  const userAgent = clean(headers['user-agent'], 300);

  // Short lines first: the cron (api/cron/booking-sync.js) parses Tier, fbclid and
  // UA back out of statusNotes, so they must survive the 2,500-char cap.
  const notes = [
    `Form: 41labs.ai/ai-closer`,
    `Role: ${ROLE[body.role] || clean(body.role, 40) || '-'}`,
    `WhatsApp enquiries/week: ${ENQUIRIES[body.enquiries] || clean(body.enquiries, 40) || '-'}`,
    `Average sale: ${SALE[body.saleValue] || clean(body.saleValue, 40) || '-'}`,
    `Chats involve: ${jobs.length ? jobs.join(', ') : '-'}`,
    `Qualified: ${clean(body.qualified, 10) || '-'}`,
    tier ? `Tier: ${tier}${fitReason ? ` (${fitReason})` : ''}` : '',
    utm.length ? `UTM: ${utm.join(' ')}` : '',
    fbclid ? `fbclid=${fbclid}` : '',
    userAgent ? `UA: ${userAgent}` : '',
    leadNotes ? `Notes: ${leadNotes}` : '',
  ].filter(Boolean).join('\n');

  let oppId = null;
  let crmError = '';
  let result;
  if (!key) {
    crmError = 'CRM not configured';
    result = { ok: false, error: 'crm_not_configured' };
  } else {
    try {
      const personId = await create(key, 'people', {
        name: splitName(name),
        phones: { primaryPhoneNumber: whatsapp.replace(/[^\d+]/g, '') },
        ...(email ? { emails: { primaryEmail: email } } : {}),
        jobTitle: ROLE[body.role] || '',
      });
      const companyId = await create(key, 'companies', { name: company });
      oppId = await create(key, 'opportunities', {
        name: `${company} - 41 Closer (ad landing page)`,
        stage: 'SCREENING',
        productLine: 'CLOSER_41',
        waitingOn: 'US',
        leadSource: `Meta ad landing page${utm.length ? ' | ' + utm.join(' ') : ''}`.slice(0, 500),
        statusNotes: notes.slice(0, 2500),
        nextAction: NEXT[tier] || NEXT.B,
        firstContactAt: new Date().toISOString(),
        pointOfContactId: personId,
        companyId,
      });
      result = { ok: true, id: oppId };
    } catch (e) {
      crmError = String(e).slice(0, 300);
      result = { ok: false, error: 'crm_error', detail: crmError };
    }
  }

  const waDigits = e164Digits(whatsapp);
  const deps = { env, fetchImpl };
  const [alerts, hermes] = await Promise.all([
    sendLeadAlerts({
      tier,
      name,
      company,
      whatsapp,
      waDigits,
      email,
      role: ROLE[body.role] || clean(body.role, 40),
      enquiries: ENQUIRIES[body.enquiries] || clean(body.enquiries, 40),
      saleValue: SALE[body.saleValue] || clean(body.saleValue, 40),
      jobs,
      fitReason,
      notes: leadNotes,
      utmContent: utmObj.content || '',
      utmCampaign: utmObj.campaign || '',
      nextAction: NEXT[tier] || NEXT.B,
      twentyUrl: oppId ? `${TWENTY_BASE}/object/opportunity/${oppId}` : '',
      crmError,
    }, deps),
    postHermesIntake({
      event: 'lead_created',
      lead: {
        name,
        phone: waDigits ? `+${waDigits}` : whatsapp,
        email,
        company,
        role: clean(body.role, 40),
        enquiries: clean(body.enquiries, 40),
        saleValue: clean(body.saleValue, 40),
        jobs: jobKeys,
        tier,
        fitReason,
        notes: leadNotes,
        utm: utmObj,
        fbclid,
        twentyOpportunityId: oppId,
      },
    }, deps),
  ]);

  return send(res, 200, { ...result, alerts, hermes });
};
