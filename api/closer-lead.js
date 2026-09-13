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
const { cleanJourney, journeyNote } = require('./_lib/journey');
const { buildLeadEvent, buildQualifiedLeadEvent, sendCapiEvent } = require('./_lib/meta-capi');

const TWENTY_BASE = process.env.TWENTY_BASE_URL || 'https://twenty-server-production-bb71.up.railway.app';

const ENQUIRIES = { under20: 'Under 20', '20to50': '20-50', '50to150': '50-150', '150plus': '150+' };
const SALE = { under500: 'Under S$500', '500to2k': 'S$500-2,000', '2kto10k': 'S$2,000-10,000', '10kplus': 'S$10,000+' };
const CHALLENGES = {
  slow: 'Replies take too long', afterhours: 'Nobody answers after hours', followup: 'Forgets to follow up',
  stock: 'Stock/price checks are slow', quotes: 'Quoting takes too long', volume: 'Too many enquiries',
};
const GOALS = {
  recover: 'Stop losing paid-for enquiries', faster: 'Reply and quote faster',
  scale: 'Handle more without hiring', freeteam: 'Free the team from repetitive chats', unsure: 'Wants to see what it can do',
};
const NEXT = {
  A: 'TIER A: guarantee-eligible. Call within 1 hour, even if they booked.',
  B: 'TIER B: confirm the call is booked. If not, WhatsApp them within 1 working hour.',
  C: 'TIER C: HOLD. Did not clear 50 enquiries a week and S$500 a sale. Do NOT hand to the AI Closer. Look properly, then reply within 1 working day.',
};
// Step 1 only: we have their number but not their answers yet.
const NEXT_PARTIAL = 'INCOMPLETE FORM: gave contact details, did not finish the questions. WhatsApp them and ask the two questions by hand.';

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

// Twenty rejects a company whose name already exists. Falling over at that point
// used to abandon the whole write, leaving an orphan Person and no deal, so the
// SECOND lead from any domain we already knew never reached the pipeline.
async function findCompanyId(key, name) {
  try {
    const r = await fetch(`${TWENTY_BASE}/rest/companies?filter=name[eq]:${encodeURIComponent(name)}&limit=1`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!r.ok) return null;
    const d = await r.json();
    const rows = (d && d.data && d.data.companies) || [];
    return rows.length && rows[0].id ? rows[0].id : null;
  } catch {
    return null;
  }
}

async function patch(key, object, id, record) {
  const r = await fetch(`${TWENTY_BASE}/rest/${object}/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
  if (!r.ok) throw new Error(`${object} patch ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return id;
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
  // (the field is url_hp; 'website' is a real question now)
  if (clean(body._gotcha) || clean(body.url_hp)) return send(res, 200, { ok: true, skipped: 'bot' });

  const name = clean(body.name, 120);
  const whatsapp = clean(body.whatsapp, 40);
  if (!name || !whatsapp) return send(res, 400, { ok: false, error: 'missing_fields' });

  const env = process.env;
  const fetchImpl = (...a) => fetch(...a);
  const key = env.TWENTY_API_KEY;

  // The form no longer asks for a company: derive it from the website, else use their name.
  const websiteRaw = clean(body.website, 200);
  const companyFromSite = websiteRaw
    .replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').split('.')[0]
    .replace(/[-_]+/g, ' ').trim();
  const company = clean(body.company, 160)
    || (companyFromSite ? companyFromSite.charAt(0).toUpperCase() + companyFromSite.slice(1) : '')
    || name;
  const email = clean(body.email, 160);
  const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const utm = UTM_KEYS
    .map((k) => (clean(body[k], 120) ? `${k}=${clean(body[k], 120)}` : ''))
    .filter(Boolean);
  const utmObj = {};
  for (const k of UTM_KEYS) if (clean(body[k], 120)) utmObj[k.slice(4)] = clean(body[k], 120);
  const fbclid = clean(body.fbclid, 300);
  const tier = ['A', 'B', 'C'].includes(body.tier) ? body.tier : '';
  // Step 1 of the form posts partial: contact captured, questions not answered yet.
  const isPartial = body.partial === true || body.partial === 'true';
  // Step 2 sends back the id we returned, so the same deal is updated, never duplicated.
  const existingId = clean(body.opportunityId, 60);
  const challengeKeys = (Array.isArray(body.challenges) ? body.challenges : [body.challenges]).filter((c) => CHALLENGES[c]);
  const challenges = challengeKeys.map((c) => CHALLENGES[c]);
  const goalKey = GOALS[body.goal] ? body.goal : '';
  const fitReason = clean(body.fitReason, 200);
  const leadNotes = clean(body.notes, 1500);
  const website = websiteRaw;
  // Only a real domain becomes the company's domain in Twenty; an @handle stays in the notes.
  const domain = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(website) && !website.startsWith('@')
    ? (website.startsWith('http') ? website : `https://${website}`) : '';
  const headers = req.headers || {};
  const userAgent = clean(headers['user-agent'], 300);
  // x-forwarded-for is "<visitor>, <proxy>, <proxy>". Meta wants the visitor.
  const clientIp = clean(String(headers['x-forwarded-for'] || '').split(',')[0], 60);
  const journey = cleanJourney(body.journey);

  // Short lines first: the cron (api/cron/booking-sync.js) parses Tier, fbclid and
  // UA back out of statusNotes, so they must survive the 2,500-char cap.
  const notes = [
    `Form: 41labs.ai/ai-closer`,
    website ? `Website: ${website}` : '',
    `WhatsApp enquiries/week: ${ENQUIRIES[body.enquiries] || '-'}`,
    `Average sale: ${SALE[body.saleValue] || '-'}`,
    `Costing them most: ${challenges.length ? challenges.join(', ') : '-'}`,
    `Wants: ${GOALS[goalKey] || '-'}`,
    isPartial ? 'Stage: contact captured, questions not answered' : `Qualified: ${clean(body.qualified, 10) || '-'}`,
    tier ? `Tier: ${tier}${fitReason ? ` (${fitReason})` : ''}` : '',
    utm.length ? `UTM: ${utm.join(' ')}` : '',
    fbclid ? `fbclid=${fbclid}` : '',
    userAgent ? `UA: ${userAgent}` : '',
    journeyNote(journey),
    leadNotes ? `Notes: ${leadNotes}` : '',
  ].filter(Boolean).join('\n');

  // Qualified leads: build a WOW preview on their own site before the demo.
  const nextAction = isPartial
    ? NEXT_PARTIAL
    : (NEXT[tier] || NEXT.B) + (tier !== 'C' && website ? ` Build the WOW preview from ${website} before the call.` : '');

  let oppId = null;
  let crmError = '';
  let result;
  if (!key) {
    crmError = 'CRM not configured';
    result = { ok: false, error: 'crm_not_configured' };
  } else {
    try {
      if (existingId) {
        // Second post from the same visitor: fill in the deal we opened at step 1
        // rather than creating a second one for the same person.
        oppId = await patch(key, 'opportunities', existingId, {
          statusNotes: notes.slice(0, 2500),
          nextAction,
        });
      } else {
        const personId = await create(key, 'people', {
          name: splitName(name),
          phones: { primaryPhoneNumber: whatsapp.replace(/[^\d+]/g, '') },
          ...(email ? { emails: { primaryEmail: email } } : {}),
        });
        // A company we already have is the normal case for a repeat domain, not an error.
        let companyId = null;
        try {
          companyId = await create(key, 'companies', { name: company, ...(domain ? { domainName: { primaryLinkUrl: domain } } : {}) });
        } catch (companyErr) {
          companyId = await findCompanyId(key, company);
          if (!companyId) crmError = `company not linked: ${String(companyErr).slice(0, 120)}`;
        }
        oppId = await create(key, 'opportunities', {
          name: `${company} - 41 Closer (ad landing page)`,
          stage: 'SCREENING',
          productLine: 'CLOSER_41',
          waitingOn: 'US',
          leadSource: `Meta ad landing page${utm.length ? ' | ' + utm.join(' ') : ''}`.slice(0, 500),
          statusNotes: notes.slice(0, 2500),
          nextAction: nextAction,
          firstContactAt: new Date().toISOString(),
          pointOfContactId: personId,
          ...(companyId ? { companyId } : {}),   // a deal with no company beats no deal
        });
      }
      result = { ok: true, id: oppId };
    } catch (e) {
      crmError = String(e).slice(0, 300);
      result = { ok: false, error: 'crm_error', detail: crmError };
    }
  }

  const waDigits = e164Digits(whatsapp);
  const deps = { env, fetchImpl };

  // Back to Meta. Lead for everyone so the pixel keeps learning, QualifiedLead
  // only for the tiers we want more of: that is the event the ad sets optimise
  // on, so a Tier C form-fill must never look like a Tier A. The event_id comes
  // from the browser pixel (ai-closer.js) so the same submit is not counted twice.
  const { firstName, lastName } = splitName(name);
  const capiInput = {
    eventId: clean(body.eventId, 80) || `lead_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    eventTimeSec: Math.floor(Date.now() / 1000),
    sourceUrl: `https://41labs.ai/ai-closer${body.variant === 'sf' ? '-sf' : ''}`,
    email, phone: whatsapp, firstName, lastName,
    fbp: clean(body.fbp, 120), fbc: clean(body.fbc, 300), fbclid, clickMs: Date.now(),
    clientIp, userAgent, tier,
  };
  // A partial is contact details, not a completed lead. Reporting it as a Lead would
  // inflate the conversion count and teach Meta to buy half-finished forms.
  const capiEvents = isPartial ? [] : [buildLeadEvent(capiInput)];
  if (!isPartial && (tier === 'A' || tier === 'B')) capiEvents.push(buildQualifiedLeadEvent(capiInput));

  const [alerts, hermes, meta] = await Promise.all([
    sendLeadAlerts({
      tier,
      name,
      company,
      whatsapp,
      waDigits,
      email,
      enquiries: ENQUIRIES[body.enquiries] || clean(body.enquiries, 40),
      saleValue: SALE[body.saleValue] || clean(body.saleValue, 40),
      jobs: challenges,
      fitReason,
      notes: leadNotes,
      utmContent: utmObj.content || '',
      utmCampaign: utmObj.campaign || '',
      nextAction,
      industry: GOALS[goalKey] || '',
      website,
      whatsappUse: '',
      twentyUrl: oppId ? `${TWENTY_BASE}/object/opportunity/${oppId}` : '',
      crmError,
    }, deps),
    (isPartial || tier === 'C') ? Promise.resolve('skipped_not_qualified') : postHermesIntake({
      event: 'lead_created',
      lead: {
        name,
        phone: waDigits ? `+${waDigits}` : whatsapp,
        email,
        company,
        enquiries: clean(body.enquiries, 40),
        saleValue: clean(body.saleValue, 40),
        challenges: challengeKeys,
        goal: goalKey,
        tier,
        fitReason,
        website,
        notes: leadNotes,
        utm: utmObj,
        fbclid,
        ...(journey ? { journey } : {}),
        twentyOpportunityId: oppId,
      },
    }, deps),
    sendCapiEvent(capiEvents, deps),
  ]);

  return send(res, 200, { ...result, alerts, hermes, meta });
};
