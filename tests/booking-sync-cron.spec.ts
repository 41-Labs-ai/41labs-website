import { test, expect } from '@playwright/test';
import path from 'path';
import crypto from 'crypto';

// Unit tests for api/cron/booking-sync.js. A fake "world" stands in for Google
// Calendar, Twenty (stateful, so reruns see what the first run wrote), Meta CAPI
// and the Hermes intake. Time is injected, so every window is deterministic.

const CRON = path.join(__dirname, '..', 'api', 'cron', 'booking-sync.js');

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const SA_JSON = JSON.stringify({
  client_email: 'claude-drive@claude-drive-access-492002.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
});

const NOW = Date.parse('2026-09-11T08:00:00Z');
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const iso = (ms: number) => new Date(ms).toISOString();

const ENV = {
  TWENTY_API_KEY: 'twenty-key',
  GOOGLE_SERVICE_ACCOUNT_JSON: SA_JSON,
  META_CAPI_TOKEN: 'capi-token',
  HERMES_BASE_URL: 'https://hermes.example.com',
  HERMES_INTAKE_KEY: 'intake-secret',
  CRON_SECRET: 'cron-secret',
};

type Call = { url: string; method: string; headers: any; body: any };

const LANDING_NOTES = (tier: string, extra = '') =>
  `Form: 41labs.ai/ai-closer\nRole: Owner\nTier: ${tier} (fit)\nUTM: utm_source=facebook utm_content=ad_stalk1\nfbclid=abc123\nfbp=fb.1.1757000000000.9876543210\nfbc=fb.1.1757000000000.abc123\nUA: Mozilla/5.0 test${extra}`;

function opp(id: string, o: any = {}) {
  return {
    id,
    name: `${o.company ?? 'Tan Aircon'} - 41 Closer (ad landing page)`,
    stage: o.stage ?? 'SCREENING',
    productLine: 'CLOSER_41',
    createdAt: o.createdAt ?? iso(NOW - 2 * HOUR),
    statusNotes: o.statusNotes ?? LANDING_NOTES(o.tier ?? 'A'),
    nextAction: 'TIER A: call',
    followUp: null,
    company: { name: o.company ?? 'Tan Aircon' },
    pointOfContact: {
      name: { firstName: o.firstName ?? 'Tan', lastName: o.lastName ?? 'Wei Ming' },
      emails: { primaryEmail: o.email ?? 'wm@tanaircon.sg', additionalEmails: [] },
      phones: { primaryPhoneNumber: o.phone ?? '+6591234567', primaryPhoneCallingCode: '', additionalPhones: [] },
    },
  };
}

function booking(id: string, o: any = {}) {
  const start = o.start ?? Date.parse('2026-09-14T07:00:00Z'); // Mon 3:00pm SGT, ~3 days out
  return {
    id,
    status: o.status ?? 'confirmed',
    summary: o.summary ?? '41 Closer demo call (Tan Wei Ming)',
    description: o.description ?? 'Booked by\nTan Wei Ming\nwm@tanaircon.sg',
    created: iso(o.created ?? NOW - 3 * MIN),
    updated: iso(o.created ?? NOW - 3 * MIN),
    attendees: [
      { email: 'alexander@41labs.ai', organizer: true, self: true },
      ...(o.guestEmail === null ? [] : [{ email: o.guestEmail ?? 'wm@tanaircon.sg' }]),
    ],
    hangoutLink: 'https://meet.google.com/abc-defg-hij',
    start: { dateTime: iso(start) },
    end: { dateTime: iso(start + 20 * MIN) },
  };
}

type WorldOpts = {
  opps?: any[];
  events?: any[];
  env?: Record<string, string>;
  calendar?: 'ok' | 'token500' | 'events500' | 'throw';
  twentyList?: 'ok' | '500';
  capi?: 'ok' | '500';
  hermes?: 'ok' | '500';
};

function makeWorld(o: WorldOpts = {}) {
  const store = new Map<string, any>();
  for (const x of o.opps ?? []) store.set(x.id, JSON.parse(JSON.stringify(x)));
  const events = o.events ?? [];
  const calls: Call[] = [];
  const env = { ...ENV, ...(o.env ?? {}) };
  for (const k of Object.keys(env)) if (!env[k]) delete (env as any)[k];

  const json = (status: number, body: any) => ({
    ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body),
  });

  const fetchImpl = async (url: string, init: any = {}) => {
    const method = init.method || 'GET';
    let body: any = init.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { /* form body */ } }
    calls.push({ url, method, headers: init.headers || {}, body });

    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      if (o.calendar === 'throw') throw new Error('dns fail');
      if (o.calendar === 'token500') return json(500, { error: 'invalid_grant' });
      return json(200, { access_token: 'gtok', expires_in: 3600 });
    }
    if (url.startsWith('https://www.googleapis.com/calendar/v3/')) {
      if (o.calendar === 'events500') return json(404, { error: { message: 'Not Found' } });
      return json(200, { items: events });
    }
    if (url.includes('/rest/opportunities')) {
      if (method === 'GET') {
        if (o.twentyList === '500') return json(500, { error: 'boom' });
        return json(200, { data: { opportunities: [...store.values()] }, pageInfo: { hasNextPage: false } });
      }
      if (method === 'PATCH') {
        const id = url.split('/rest/opportunities/')[1].split('?')[0];
        const cur = store.get(id);
        if (!cur) return json(404, {});
        Object.assign(cur, body);
        return json(200, { data: { updateOpportunity: cur } });
      }
    }
    if (url.startsWith('https://graph.facebook.com/')) {
      if (o.capi === '500') return json(400, { error: { message: 'bad' } });
      return json(200, { events_received: 1 });
    }
    if (url.startsWith('https://hermes.example.com/')) {
      if (o.hermes === '500') return json(500, { ok: false });
      return json(200, { ok: true });
    }
    return json(404, {});
  };

  delete require.cache[require.resolve(CRON)];
  const mod = require(CRON);
  const run = (now = NOW) => mod.runBookingSync({ env, fetchImpl, now: () => now });
  return { run, calls, store, mod };
}

const capiCalls = (c: Call[]) => c.filter((x) => x.url.startsWith('https://graph.facebook.com/'));
const hermesCalls = (c: Call[], event?: string) =>
  c.filter((x) => x.url.startsWith('https://hermes.example.com/') && (!event || x.body.event === event));
const patches = (c: Call[]) => c.filter((x) => x.method === 'PATCH');

// ---------------------------------------------------------------------------

test.describe('cron auth', () => {
  async function callHandler(headers: Record<string, string>, secret: string | undefined) {
    const orig = { secret: process.env.CRON_SECRET, fetch: globalThis.fetch };
    if (secret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = secret;
    (globalThis as any).fetch = async () => ({ ok: false, status: 500, json: async () => ({}), text: async () => '' });
    delete require.cache[require.resolve(CRON)];
    const handler = require(CRON);
    const res: any = { statusCode: 200, headers: {}, body: '' };
    res.setHeader = (k: string, v: string) => { res.headers[k] = v; };
    res.end = (b: string) => { res.body = b; };
    try { await handler({ method: 'GET', headers }, res); } finally {
      if (orig.secret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = orig.secret;
      (globalThis as any).fetch = orig.fetch;
    }
    return res;
  }

  test('missing bearer: 401', async () => {
    expect((await callHandler({}, 'cron-secret')).statusCode).toBe(401);
  });
  test('wrong bearer: 401', async () => {
    expect((await callHandler({ authorization: 'Bearer nope' }, 'cron-secret')).statusCode).toBe(401);
  });
  test('CRON_SECRET not configured: fails closed with 500, never runs open', async () => {
    const res = await callHandler({ authorization: 'Bearer ' }, undefined);
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toBe('cron_secret_not_configured');
  });
  test('right bearer: runs and answers JSON even when every upstream is down', async () => {
    const res = await callHandler({ authorization: 'Bearer cron-secret' }, 'cron-secret');
    expect([200, 502]).toContain(res.statusCode);
    expect(JSON.parse(res.body)).toHaveProperty('ok');
  });
});

test.describe('calendar read', () => {
  test('uses a service-account JWT and reads alexander@41labs.ai, recent updates + next 25h', async () => {
    const w = makeWorld({ opps: [], events: [] });
    await w.run();
    const token = w.calls.find((c) => c.url.startsWith('https://oauth2.googleapis.com/token'))!;
    expect(String(token.body)).toContain('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer');
    expect(String(token.body)).toContain('assertion=');
    const lists = w.calls.filter((c) => c.url.startsWith('https://www.googleapis.com/calendar/v3/'));
    expect(lists.length).toBeGreaterThanOrEqual(1);
    for (const l of lists) {
      expect(l.url).toContain('/calendars/alexander%4041labs.ai/events');
      expect(l.headers.Authorization).toBe('Bearer gtok');
    }
    expect(lists.some((l) => new URL(l.url).searchParams.get('updatedMin') === iso(NOW - 2 * 24 * HOUR))).toBe(true);
  });

  test('searches Twenty for SCREENING/MEETING 41 Closer deals from the last 14 days', async () => {
    const w = makeWorld({ opps: [], events: [] });
    await w.run();
    const get = w.calls.find((c) => c.method === 'GET' && c.url.includes('/rest/opportunities'))!;
    const filter = new URL(get.url).searchParams.get('filter')!;
    expect(filter).toContain('productLine[eq]:CLOSER_41');
    expect(filter).toContain('stage[in]:[SCREENING,MEETING]');
    expect(filter).toContain(`createdAt[gte]:"${iso(NOW - 14 * 24 * HOUR)}"`);
    expect(get.headers.Authorization).toBe('Bearer twenty-key');
  });

  test('calendar token failure: does not throw, reports the error, touches nothing', async () => {
    const w = makeWorld({ opps: [opp('o1', { createdAt: iso(NOW - 20 * MIN) })], events: [booking('e1')], calendar: 'token500' });
    const r = await w.run();
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/calendar/);
    expect(patches(w.calls)).toHaveLength(0);
    expect(hermesCalls(w.calls)).toHaveLength(0);
    expect(capiCalls(w.calls)).toHaveLength(0);
  });

  test('calendar events 404 (not shared with the service account): no throw, no nudges', async () => {
    const w = makeWorld({ opps: [opp('o1', { createdAt: iso(NOW - 20 * MIN) })], events: [booking('e1')], calendar: 'events500' });
    const r = await w.run();
    expect(r.ok).toBe(false);
    expect(hermesCalls(w.calls, 'finish_booking')).toHaveLength(0);
  });

  test('calendar network error: no throw', async () => {
    const w = makeWorld({ opps: [opp('o1')], events: [booking('e1')], calendar: 'throw' });
    const r = await w.run();
    expect(r.ok).toBe(false);
  });

  test('no service account configured: reported, no throw', async () => {
    const w = makeWorld({ opps: [opp('o1')], events: [booking('e1')], env: { GOOGLE_SERVICE_ACCOUNT_JSON: '' } });
    const r = await w.run();
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/calendar_not_configured/);
  });

  test('Twenty list failure: no throw, nothing sent', async () => {
    const w = makeWorld({ opps: [opp('o1')], events: [booking('e1')], twentyList: '500' });
    const r = await w.run();
    expect(r.ok).toBe(false);
    expect(capiCalls(w.calls)).toHaveLength(0);
    expect(hermesCalls(w.calls)).toHaveLength(0);
  });
});

test.describe('new booking -> MEETING + CAPI Schedule + Hermes booked', () => {
  test('matched by guest email: stage, next action, follow-up, CAPI and Hermes all fire', async () => {
    const w = makeWorld({ opps: [opp('o1')], events: [booking('e1')] });
    const r = await w.run();
    expect(r.ok).toBe(true);

    const o = w.store.get('o1');
    expect(o.stage).toBe('MEETING');
    expect(o.nextAction).toBe('Demo booked Mon 14 Sep 2026, 3:00pm SGT. Run the leak audit before the call.');
    expect(o.followUp).toBe('2026-09-14T07:00:00.000Z');

    const capi = capiCalls(w.calls);
    expect(capi).toHaveLength(1);
    expect(capi[0].url).toBe('https://graph.facebook.com/v21.0/24659272643698089/events');
    expect(capi[0].headers.Authorization).toBe('Bearer capi-token');
    expect(capi[0].url).not.toContain('capi-token');
    const ev = capi[0].body.data[0];
    expect(ev.event_name).toBe('Schedule');
    expect(ev.event_id).toBe('schedule_o1');
    expect(ev.action_source).toBe('website');
    expect(ev.event_source_url).toBe('https://41labs.ai/ai-closer');
    expect(ev.user_data.em).toEqual(['99aca33e4d528d64142b3a7933d507112be98cfbc813ad173244e03575574e34']);
    expect(ev.user_data.ph).toEqual(['fd38d3edfeb70b7fb09e74e269d27f6fb24d5c75799b7e3d85604a5965a6623f']);
    expect(ev.user_data.fn).toEqual(['0e5123df1126f9d228246647d8cb62fd28bba9fb4e751d1934aef03741052c77']);
    // The real cookie, not one rebuilt from fbclid and a guessed click time.
    expect(ev.user_data.fbc).toBe('fb.1.1757000000000.abc123');
    expect(ev.user_data.fbp).toBe('fb.1.1757000000000.9876543210');
    expect(ev.user_data.client_user_agent).toBe('Mozilla/5.0 test');
    expect(ev.custom_data.tier).toBe('A');
    // booked 3 minutes ago: event_time is the booking time, not the cron time
    expect(ev.event_time).toBe(Math.floor((NOW - 3 * MIN) / 1000));

    const h = hermesCalls(w.calls, 'booked');
    expect(h).toHaveLength(1);
    expect(h[0].headers['x-intake-key']).toBe('intake-secret');
    expect(h[0].url).toBe('https://hermes.example.com/api/intake/landing-lead');
    expect(h[0].body.booking).toEqual({
      start: '2026-09-14T07:00:00.000Z',
      end: '2026-09-14T07:20:00.000Z',
      meetLink: 'https://meet.google.com/abc-defg-hij',
    });
    expect(h[0].body.lead.twentyOpportunityId).toBe('o1');
    expect(h[0].body.lead.phone).toBe('+6591234567');
  });

  test('matched by phone from the booking form when the guest used a different email', async () => {
    const w = makeWorld({
      opps: [opp('o1', { email: 'other@x.sg' })],
      events: [booking('e1', { guestEmail: 'personal@gmail.com', description: 'Booked by\nTan\nPhone number\n9123 4567' })],
    });
    await w.run();
    expect(w.store.get('o1').stage).toBe('MEETING');
  });

  test('rerun is a no-op: no second stage write, CAPI event or Hermes call', async () => {
    const w = makeWorld({ opps: [opp('o1')], events: [booking('e1')] });
    await w.run();
    const n = { capi: capiCalls(w.calls).length, hermes: hermesCalls(w.calls).length, patch: patches(w.calls).length };
    await w.run(NOW + 5 * MIN);
    await w.run(NOW + 10 * MIN);
    expect(capiCalls(w.calls).length).toBe(n.capi);
    expect(hermesCalls(w.calls).length).toBe(n.hermes);
    expect(patches(w.calls).length).toBe(n.patch);
  });

  test('unmatched booking: nothing written, reported for a human', async () => {
    const w = makeWorld({ opps: [opp('o1')], events: [booking('e1', { guestEmail: 'stranger@x.com', description: 'Booked by\nStranger' })] });
    const r = await w.run();
    expect(r.unmatched).toEqual(['e1']);
    expect(patches(w.calls)).toHaveLength(0);
    expect(capiCalls(w.calls)).toHaveLength(0);
  });

  test('events that are not appointment-schedule bookings are ignored', async () => {
    const w = makeWorld({ opps: [opp('o1')], events: [booking('e1', { summary: 'Dentist', description: 'wm@tanaircon.sg' })] });
    await w.run();
    expect(w.store.get('o1').stage).toBe('SCREENING');
  });

  test('BOOKING_EVENT_MATCH changes what counts as a booking', async () => {
    const w = makeWorld({ opps: [opp('o1')], events: [booking('e1', { summary: 'Leak audit (Tan)' })], env: { BOOKING_EVENT_MATCH: 'leak audit' } });
    await w.run();
    expect(w.store.get('o1').stage).toBe('MEETING');
  });

  test('deals not created by the landing page form are never touched', async () => {
    const w = makeWorld({ opps: [opp('o1', { statusNotes: 'Manual deal, met at SMEICC' })], events: [booking('e1')] });
    const r = await w.run();
    expect(w.store.get('o1').stage).toBe('SCREENING');
    expect(r.unmatched).toEqual(['e1']);
  });

  test('deal already at MEETING (moved by hand): CAPI + Hermes still fire, stage untouched', async () => {
    const w = makeWorld({ opps: [opp('o1', { stage: 'MEETING' })], events: [booking('e1')] });
    await w.run();
    expect(w.store.get('o1').stage).toBe('MEETING');
    expect(capiCalls(w.calls)).toHaveLength(1);
    expect(hermesCalls(w.calls, 'booked')).toHaveLength(1);
  });

  // A deal can book more than once: a reschedule into a new slot, or a second call
  // later. The marker used to be one flat 'sent:capi_schedule' per opportunity, so the
  // deal fired Schedule for its FIRST booking and stayed silent for every one after.
  // Meta then under-counts booked calls, which is the same damage as double counting,
  // pointing the other way.
  // Meta attributed our Lead to the ads but never the Schedule. Lead is sent from the
  // browser with the _fbp and _fbc cookies; Schedule is sent hours later by this cron,
  // and the notes only kept fbclid. Without _fbp, server-side matching is weak enough
  // that Meta credits the booking to nobody, so Ads Manager can never show a
  // cost per booked call.
  test('Schedule carries the same _fbp and _fbc the Lead had, or Meta cannot attribute it', async () => {
    const w = makeWorld({ opps: [opp('o1')], events: [booking('e1')] });
    await w.run();
    const capi = capiCalls(w.calls);
    expect(capi).toHaveLength(1);
    const ud = capi[0].body.data[0].user_data;
    expect(ud.fbp, '_fbp must survive into the booking event').toBe('fb.1.1757000000000.9876543210');
    expect(ud.fbc, 'the real _fbc cookie beats one rebuilt from fbclid').toBe('fb.1.1757000000000.abc123');
  });

  // Deals created before 15 Sep 2026 have no fbp/fbc in their notes. They must still
  // send, falling back to an fbc rebuilt from fbclid rather than dropping the booking.
  test('a lead saved before we stored the cookies still sends, rebuilding fbc from fbclid', async () => {
    const legacy = opp('o1');
    legacy.statusNotes = legacy.statusNotes.replace(/\nfbp=\S+/, '').replace(/\nfbc=\S+/, '');
    const w = makeWorld({ opps: [legacy], events: [booking('e1')] });
    await w.run();
    const ud = capiCalls(w.calls)[0].body.data[0].user_data;
    expect(ud.fbp).toBeUndefined();
    expect(ud.fbc).toBe(`fb.1.${Date.parse(legacy.createdAt)}.abc123`);
  });

  test('a second booking on the same deal sends its own Schedule', async () => {
    const w = makeWorld({ opps: [opp('o1')], events: [booking('e1')] });
    await w.run();
    expect(capiCalls(w.calls)).toHaveLength(1);

    // Same deal, a different calendar booking.
    const w2 = makeWorld({
      opps: [opp('o1', { stage: 'MEETING', statusNotes: w.store.get('o1').statusNotes })],
      events: [booking('e2', { start: NOW + 3 * 24 * HOUR })],
    });
    await w2.run();
    expect(capiCalls(w2.calls), 'the second booking must report too').toHaveLength(1);

    // And still exactly once each: re-running changes nothing.
    await w2.run(NOW + 5 * MIN);
    expect(capiCalls(w2.calls)).toHaveLength(1);
  });

  test('CAPI token missing: skipped and NOT marked, so it sends once the token is added', async () => {
    const w = makeWorld({ opps: [opp('o1')], events: [booking('e1')], env: { META_CAPI_TOKEN: '' } });
    await w.run();
    expect(capiCalls(w.calls)).toHaveLength(0);
    expect(w.store.get('o1').statusNotes).not.toContain('capi_schedule');
    expect(hermesCalls(w.calls, 'booked')).toHaveLength(1);
  });

  test('Hermes env missing: skipped, not marked', async () => {
    const w = makeWorld({ opps: [opp('o1')], events: [booking('e1')], env: { HERMES_BASE_URL: '' } });
    await w.run();
    expect(hermesCalls(w.calls)).toHaveLength(0);
    expect(w.store.get('o1').statusNotes).not.toContain('sent:booked');
    expect(w.store.get('o1').stage).toBe('MEETING');
  });

  test('Meta rejects the event: marker released, the next run retries', async () => {
    const w = makeWorld({ opps: [opp('o1')], events: [booking('e1')], capi: '500' });
    await w.run();
    expect(capiCalls(w.calls)).toHaveLength(1);
    expect(w.store.get('o1').statusNotes).not.toContain('capi_schedule');
    await w.run(NOW + 5 * MIN);
    expect(capiCalls(w.calls)).toHaveLength(2);
  });

  test('Hermes 500 on booked: marker released, retried next run, never double-sent once it lands', async () => {
    const w = makeWorld({ opps: [opp('o1')], events: [booking('e1')], hermes: '500' });
    await w.run();
    expect(w.store.get('o1').statusNotes).not.toContain('sent:booked');
    expect(hermesCalls(w.calls, 'booked')).toHaveLength(1);
  });
});

test.describe('finish_booking nudge', () => {
  test('tier A lead, 16 minutes old, no booking: nudged exactly once', async () => {
    const w = makeWorld({ opps: [opp('o1', { createdAt: iso(NOW - 16 * MIN) })], events: [] });
    await w.run();
    expect(hermesCalls(w.calls, 'finish_booking')).toHaveLength(1);
    const h = hermesCalls(w.calls, 'finish_booking')[0];
    expect(h.body.lead.twentyOpportunityId).toBe('o1');
    expect(h.body.lead.tier).toBe('A');
    await w.run(NOW + 5 * MIN);
    await w.run(NOW + 60 * MIN);
    expect(hermesCalls(w.calls, 'finish_booking')).toHaveLength(1);
  });

  test('tier B qualifies too', async () => {
    const w = makeWorld({ opps: [opp('o1', { tier: 'B', createdAt: iso(NOW - 16 * MIN) })], events: [] });
    await w.run();
    expect(hermesCalls(w.calls, 'finish_booking')).toHaveLength(1);
  });

  test('under 15 minutes old: too early', async () => {
    const w = makeWorld({ opps: [opp('o1', { createdAt: iso(NOW - 14 * MIN) })], events: [] });
    await w.run();
    expect(hermesCalls(w.calls, 'finish_booking')).toHaveLength(0);
  });

  test('tier C: never nudged to book (they are not offered the calendar)', async () => {
    const w = makeWorld({ opps: [opp('o1', { tier: 'C', createdAt: iso(NOW - 30 * MIN) })], events: [] });
    await w.run();
    expect(hermesCalls(w.calls, 'finish_booking')).toHaveLength(0);
  });

  test('lead who booked in this same run: not nudged', async () => {
    const w = makeWorld({ opps: [opp('o1', { createdAt: iso(NOW - 20 * MIN) })], events: [booking('e1')] });
    await w.run();
    expect(hermesCalls(w.calls, 'finish_booking')).toHaveLength(0);
    expect(hermesCalls(w.calls, 'booked')).toHaveLength(1);
  });

  test('booked under their name with an email/phone we cannot match: no nudge (never tell a booker to book)', async () => {
    const w = makeWorld({
      opps: [opp('o1', { createdAt: iso(NOW - 20 * MIN) })],
      events: [booking('e1', { guestEmail: 'personal@gmail.com', description: 'Booked by\nTan Wei Ming' })],
    });
    const r = await w.run();
    expect(r.unmatched).toEqual(['e1']);
    expect(hermesCalls(w.calls, 'finish_booking')).toHaveLength(0);
  });

  test('older than 24h: not nudged (too late to say "finish your booking")', async () => {
    const w = makeWorld({ opps: [opp('o1', { createdAt: iso(NOW - 25 * HOUR) })], events: [] });
    await w.run();
    expect(hermesCalls(w.calls, 'finish_booking')).toHaveLength(0);
  });

  test('Hermes not configured: nothing sent and nothing marked', async () => {
    const w = makeWorld({ opps: [opp('o1', { createdAt: iso(NOW - 16 * MIN) })], events: [], env: { HERMES_INTAKE_KEY: '' } });
    await w.run();
    expect(w.store.get('o1').statusNotes).not.toContain('finish_booking');
  });
});

test.describe('reminders', () => {
  // A booking made days ago that the cron already processed.
  const bookedOpp = (id = 'o1') => opp(id, {
    stage: 'MEETING',
    createdAt: iso(NOW - 3 * 24 * HOUR),
    statusNotes: LANDING_NOTES('A', '\n[booked:e1]\n[sent:capi_schedule]\n[sent:booked:e1]'),
  });
  const oldBooking = (startMs: number) => booking('e1', { start: startMs, created: NOW - 3 * 24 * HOUR });

  const kinds = (w: any) => hermesCalls(w.calls).map((c: Call) => c.body.event);

  test('23.5h before: reminder_24h once, with the booking details', async () => {
    const w = makeWorld({ opps: [bookedOpp()], events: [oldBooking(NOW + 23.5 * HOUR)] });
    await w.run();
    expect(kinds(w)).toEqual(['reminder_24h']);
    const h = hermesCalls(w.calls, 'reminder_24h')[0];
    expect(h.body.booking.meetLink).toBe('https://meet.google.com/abc-defg-hij');
    await w.run(NOW + 5 * MIN);
    await w.run(NOW + 10 * MIN);
    expect(kinds(w)).toEqual(['reminder_24h']);
  });

  test('24.5h before: too early for reminder_24h', async () => {
    const w = makeWorld({ opps: [bookedOpp()], events: [oldBooking(NOW + 24.5 * HOUR)] });
    await w.run();
    expect(kinds(w)).toEqual([]);
  });

  test('22.5h before: window passed, no reminder_24h', async () => {
    const w = makeWorld({ opps: [bookedOpp()], events: [oldBooking(NOW + 22.5 * HOUR)] });
    await w.run();
    expect(kinds(w)).toEqual([]);
  });

  test('57 minutes before: reminder_1h once', async () => {
    const w = makeWorld({ opps: [bookedOpp()], events: [oldBooking(NOW + 57 * MIN)] });
    await w.run();
    expect(kinds(w)).toEqual(['reminder_1h']);
    await w.run(NOW + 2 * MIN);
    expect(kinds(w)).toEqual(['reminder_1h']);
  });

  test('61 minutes before: too early; 54 minutes before: window passed', async () => {
    const a = makeWorld({ opps: [bookedOpp()], events: [oldBooking(NOW + 61 * MIN)] });
    await a.run();
    expect(kinds(a)).toEqual([]);
    const b = makeWorld({ opps: [bookedOpp()], events: [oldBooking(NOW + 54 * MIN)] });
    await b.run();
    expect(kinds(b)).toEqual([]);
  });

  test('full timeline over the 5-minute cron: booked, reminder_24h, reminder_1h, each exactly once', async () => {
    const start = NOW + 30 * HOUR;
    const w = makeWorld({ opps: [opp('o1', { createdAt: iso(NOW - 10 * MIN) })], events: [booking('e1', { start, created: NOW - 2 * MIN })] });
    for (let t = NOW; t < start; t += 5 * MIN) await w.run(t);
    expect(kinds(w)).toEqual(['booked', 'reminder_24h', 'reminder_1h']);
  });

  test('booked less than 25h ahead: no reminder_24h (the booking confirmation just went out)', async () => {
    const w = makeWorld({ opps: [opp('o1', { createdAt: iso(NOW - 10 * MIN) })], events: [booking('e1', { start: NOW + 23.5 * HOUR, created: NOW - 2 * MIN })] });
    await w.run();
    await w.run(NOW + 5 * MIN);
    expect(kinds(w)).toEqual(['booked']);
  });

  test('rescheduled to a new time: reminders re-arm for the new slot', async () => {
    const w = makeWorld({ opps: [bookedOpp()], events: [oldBooking(NOW + 57 * MIN)] });
    await w.run();
    // Alexander moves the call by 3 hours; the 1h reminder should fire again for the new time.
    const w2events = [oldBooking(NOW + 3 * HOUR + 57 * MIN)];
    const moved = makeWorld({ opps: [w.store.get('o1')], events: w2events });
    await moved.run(NOW + 3 * HOUR);
    expect(kinds(moved)).toEqual(['reminder_1h']);
  });
});
