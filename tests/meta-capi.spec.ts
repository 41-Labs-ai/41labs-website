import { test, expect } from '@playwright/test';
import path from 'path';
import crypto from 'crypto';

// Unit tests for api/_lib/meta-capi.js — the events we send back to Meta so the
// ad account optimises for leads we actually want, not for form-fillers.
//
// The contract that matters:
//   - Lead           every form submit (volume, so Meta keeps learning)
//   - QualifiedLead  Tier A and B only, carrying a value  <- the optimisation event
//   - Schedule       a booked call, carrying a bigger value
// Each one must share an event_id with the browser pixel or Meta counts it twice.

const capi = require(path.join(__dirname, '..', 'api', '_lib', 'meta-capi.js'));

const sha = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

test.describe('user_data match quality', () => {
  test('carries every identifier Meta matches on, hashed where it must be', () => {
    const ev = capi.buildLeadEvent({
      eventId: 'evt-1',
      eventTimeSec: 1757660500,
      phone: '+65 9123 4567',
      email: 'WM@TanAircon.sg',
      firstName: 'Tan',
      lastName: 'Wei Ming',
      fbp: 'fb.1.1757660000000.1234567890',
      fbc: 'fb.1.1757660400123.abc123',
      clientIp: '203.0.113.9',
      userAgent: 'Mozilla/5.0 test',
    });
    // hashed
    expect(ev.user_data.ph).toEqual([sha('6591234567')]);
    expect(ev.user_data.em).toEqual([sha('wm@tanaircon.sg')]);
    expect(ev.user_data.fn).toEqual([sha('tan')]);
    expect(ev.user_data.ln).toEqual([sha('weiming')]);
    // sent in the clear, as Meta requires
    expect(ev.user_data.fbp).toBe('fb.1.1757660000000.1234567890');
    expect(ev.user_data.fbc).toBe('fb.1.1757660400123.abc123');
    expect(ev.user_data.client_ip_address).toBe('203.0.113.9');
    expect(ev.user_data.client_user_agent).toBe('Mozilla/5.0 test');
  });

  test('falls back to building fbc from a raw fbclid when the cookie is missing', () => {
    const ev = capi.buildLeadEvent({ eventId: 'e', eventTimeSec: 1, fbclid: 'abc123', clickMs: 1757660400123 });
    expect(ev.user_data.fbc).toBe('fb.1.1757660400123.abc123');
  });

  test('a real fbc cookie wins over a rebuilt one, because it carries the true click time', () => {
    const ev = capi.buildLeadEvent({
      eventId: 'e', eventTimeSec: 1,
      fbc: 'fb.1.1111111111111.realclick',
      fbclid: 'abc123', clickMs: 1757660400123,
    });
    expect(ev.user_data.fbc).toBe('fb.1.1111111111111.realclick');
  });

  test('omits what it has no data for rather than sending empty hashes', () => {
    const ev = capi.buildLeadEvent({ eventId: 'e', eventTimeSec: 1, phone: '91234567' });
    expect(ev.user_data.ph).toEqual([sha('6591234567')]);
    expect(ev.user_data.em).toBeUndefined();
    expect(ev.user_data.fbp).toBeUndefined();
    expect(ev.user_data.client_ip_address).toBeUndefined();
  });
});

test.describe('Lead vs QualifiedLead', () => {
  test('Lead carries no value, so Meta does not bid on unscreened form fills', () => {
    const ev = capi.buildLeadEvent({ eventId: 'evt-1', eventTimeSec: 1, tier: 'C' });
    expect(ev.event_name).toBe('Lead');
    expect(ev.event_id).toBe('evt-1');
    expect(ev.action_source).toBe('website');
    expect(ev.custom_data.value).toBeUndefined();
    expect(ev.custom_data.tier).toBe('C');
  });

  test('QualifiedLead carries the expected build revenue behind one qualified lead', () => {
    const ev = capi.buildQualifiedLeadEvent({ eventId: 'evt-1', eventTimeSec: 1, tier: 'A' });
    expect(ev.event_name).toBe('QualifiedLead');
    // different event_id from the Lead, or Meta drops it as a duplicate
    expect(ev.event_id).toBe('evt-1_q');
    expect(ev.custom_data.value).toBe(capi.VALUE_QUALIFIED_LEAD);
    expect(ev.custom_data.currency).toBe('SGD');
    expect(ev.custom_data.tier).toBe('A');
  });

  test('a booked call is worth more than a qualified lead, and both are worth more than nothing', () => {
    expect(capi.VALUE_SCHEDULE).toBeGreaterThan(capi.VALUE_QUALIFIED_LEAD);
    expect(capi.VALUE_QUALIFIED_LEAD).toBeGreaterThan(0);
  });

  // Two different sources of truth, on purpose.
  // QualifiedLead is MODELLED from our own funnel: as of 13 Sep 2026 no ad-attributed
  // lead has ever reached a won stage, so there is no measured rate to use.
  test('QualifiedLead is the modelled base-case rate times the S$9,600 build fee', () => {
    const BUILD_FEE = 9600, BOOKS = 0.05, CLOSES = 0.20;   // 41-CLOSER-NUMBERS.md section 3
    expect(capi.VALUE_QUALIFIED_LEAD).toBe(Math.round(BOOKS * CLOSES * BUILD_FEE));
  });

  // Schedule is SET BY THE ADS CONTRACT, not derived: a flat S$500 to start.
  // Worth knowing it understates a booked call by roughly 4x against our own funnel
  // (20% close x S$9,600 is nearer S$1,900), which is safe for bidding and wrong for
  // reading ROAS. Changing it is an ads-side decision, so the test pins the contract.
  test('Schedule carries the flat S$500 the tracking spec asks for', () => {
    expect(capi.VALUE_SCHEDULE).toBe(500);
  });

  test('Schedule still carries its value and keeps its opportunity-derived id', () => {
    const ev = capi.buildScheduleEvent({ opportunityId: 'opp-1', phone: '91234567', eventTimeSec: 1, tier: 'A' });
    expect(ev.event_name).toBe('Schedule');
    expect(ev.event_id).toBe('schedule_opp-1');
    expect(ev.custom_data.value).toBe(capi.VALUE_SCHEDULE);
    expect(ev.custom_data.currency).toBe('SGD');
  });

  test('the source url follows the page the visitor was actually on', () => {
    const ev = capi.buildLeadEvent({ eventId: 'e', eventTimeSec: 1, sourceUrl: 'https://41labs.ai/ai-closer-sf' });
    expect(ev.event_source_url).toBe('https://41labs.ai/ai-closer-sf');
  });
});

test.describe('sending', () => {
  const okFetch = () => {
    const calls: any[] = [];
    const f = async (url: string, init: any) => {
      calls.push({ url, init, body: JSON.parse(init.body) });
      return { ok: true, status: 200, text: async () => '{}' };
    };
    return { f, calls };
  };

  test('batches several events into one request', async () => {
    const { f, calls } = okFetch();
    const TOKEN = 'EAAsecrettoken123';
    const r = await capi.sendCapiEvent(
      [capi.buildLeadEvent({ eventId: 'a', eventTimeSec: 1 }), capi.buildQualifiedLeadEvent({ eventId: 'a', eventTimeSec: 1 })],
      { env: { META_CAPI_TOKEN: TOKEN }, fetchImpl: f },
    );
    expect(r).toBe('sent');
    expect(calls).toHaveLength(1);
    expect(calls[0].body.data).toHaveLength(2);
    expect(calls[0].init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    // the token must never end up in the URL, where it would land in access logs
    expect(calls[0].url).not.toContain(TOKEN);
  });

  test('a single event still works, and an empty list is not sent at all', async () => {
    const { f, calls } = okFetch();
    expect(await capi.sendCapiEvent(capi.buildLeadEvent({ eventId: 'a', eventTimeSec: 1 }), { env: { META_CAPI_TOKEN: 't' }, fetchImpl: f })).toBe('sent');
    expect(calls[0].body.data).toHaveLength(1);
    expect(await capi.sendCapiEvent([], { env: { META_CAPI_TOKEN: 't' }, fetchImpl: f })).toBe('skipped');
    expect(calls).toHaveLength(1);
  });

  test('no token means skipped, never a thrown error into the request path', async () => {
    const { f } = okFetch();
    expect(await capi.sendCapiEvent(capi.buildLeadEvent({ eventId: 'a', eventTimeSec: 1 }), { env: {}, fetchImpl: f })).toBe('skipped');
  });

  test('a Meta outage is reported, not thrown', async () => {
    const boom = async () => { throw new Error('network'); };
    expect(await capi.sendCapiEvent(capi.buildLeadEvent({ eventId: 'a', eventTimeSec: 1 }), { env: { META_CAPI_TOKEN: 't' }, fetchImpl: boom })).toBe('failed');
  });
});
