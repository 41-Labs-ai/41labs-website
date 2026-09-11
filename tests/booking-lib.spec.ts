import { test, expect } from '@playwright/test';
import path from 'path';
import crypto from 'crypto';

// Unit tests for the shared helpers behind the booking pipeline (api/_lib/*).
// Pure functions: no server, no network.

const LIB = path.join(__dirname, '..', 'api', '_lib');
const util = require(path.join(LIB, 'util.js'));
const capi = require(path.join(LIB, 'meta-capi.js'));
const gcal = require(path.join(LIB, 'google-calendar.js'));
const notes = require(path.join(LIB, 'notes.js'));

// Vectors computed independently with `printf '%s' <value> | shasum -a 256`.
const SHA = {
  'test@example.com': '973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b',
  'wm@tanaircon.sg': '99aca33e4d528d64142b3a7933d507112be98cfbc813ad173244e03575574e34',
  '6591234567': 'fd38d3edfeb70b7fb09e74e269d27f6fb24d5c75799b7e3d85604a5965a6623f',
  tan: '0e5123df1126f9d228246647d8cb62fd28bba9fb4e751d1934aef03741052c77',
  weiming: 'daa2d53f4fb2b3c6658d22e6cb30fc4bb8686b490a86d253341f8054f7776c75',
};

test.describe('phone normalisation', () => {
  test('SG 8-digit numbers get the 65 country code', () => {
    expect(util.e164Digits('9123 4567')).toBe('6591234567');
    expect(util.e164Digits('+65 9123-4567')).toBe('6591234567');
    expect(util.e164Digits('(65) 9123 4567')).toBe('6591234567');
  });
  test('foreign numbers with + keep their own code', () => {
    expect(util.e164Digits('+61 412 345 678')).toBe('61412345678');
  });
  test('empty or junk returns empty string', () => {
    expect(util.e164Digits('')).toBe('');
    expect(util.e164Digits('n/a')).toBe('');
    expect(util.e164Digits(undefined)).toBe('');
  });
  test('samePhone matches on the last 8 digits regardless of country code formatting', () => {
    expect(util.samePhone('+6591234567', '9123 4567')).toBe(true);
    expect(util.samePhone('6591234567', '+65 9123 4568')).toBe(false);
    expect(util.samePhone('', '')).toBe(false);
    expect(util.samePhone('1234', '1234')).toBe(false);
  });
});

test.describe('SGT formatting', () => {
  test('formats a UTC instant as Singapore time', () => {
    // 07:00 UTC = 15:00 SGT, a Saturday in Singapore
    expect(util.formatSgt('2026-09-12T07:00:00Z')).toBe('Sat 12 Sep 2026, 3:00pm SGT');
    // 16:30 UTC Friday = 00:30 Saturday SGT (date rolls over)
    expect(util.formatSgt('2026-09-11T16:30:00Z')).toBe('Sat 12 Sep 2026, 12:30am SGT');
  });
});

test.describe('Meta CAPI hashing', () => {
  test('email is trimmed + lowercased then SHA-256', () => {
    expect(capi.hashEmail('  Test@Example.COM ')).toBe(SHA['test@example.com']);
    expect(capi.hashEmail('wm@tanaircon.sg')).toBe(SHA['wm@tanaircon.sg']);
  });
  test('phone is digits with country code then SHA-256', () => {
    expect(capi.hashPhone('+65 9123 4567')).toBe(SHA['6591234567']);
    expect(capi.hashPhone('91234567')).toBe(SHA['6591234567']);
  });
  test('names are lowercased with spaces and punctuation removed', () => {
    expect(capi.hashName(' Tan ')).toBe(SHA.tan);
    expect(capi.hashName('Wei-Ming')).toBe(SHA.weiming);
    expect(capi.hashName('Wei Ming')).toBe(SHA.weiming);
  });
  test('empty values hash to empty (never hash an empty string)', () => {
    expect(capi.hashEmail('')).toBe('');
    expect(capi.hashPhone('')).toBe('');
    expect(capi.hashName('')).toBe('');
  });
});

test.describe('fbc', () => {
  test('format is fb.1.<ms>.<fbclid>', () => {
    expect(capi.buildFbc('abc123', 1757660400123)).toBe('fb.1.1757660400123.abc123');
  });
  test('missing fbclid gives no fbc', () => {
    expect(capi.buildFbc('', 1757660400123)).toBe('');
  });
});

test.describe('Schedule event payload', () => {
  test('has the dedupe id, website source, hashed user data and tier', () => {
    const ev = capi.buildScheduleEvent({
      opportunityId: 'opp-1',
      email: 'wm@tanaircon.sg',
      phone: '+65 9123 4567',
      firstName: 'Tan',
      lastName: 'Wei Ming',
      fbclid: 'abc123',
      clickMs: 1757660400123,
      userAgent: 'Mozilla/5.0 test',
      tier: 'A',
      eventTimeSec: 1757660500,
    });
    expect(ev.event_name).toBe('Schedule');
    expect(ev.event_id).toBe('schedule_opp-1');
    expect(ev.action_source).toBe('website');
    expect(ev.event_source_url).toBe('https://41labs.ai/ai-closer');
    expect(ev.event_time).toBe(1757660500);
    expect(ev.user_data.em).toEqual([SHA['wm@tanaircon.sg']]);
    expect(ev.user_data.ph).toEqual([SHA['6591234567']]);
    expect(ev.user_data.fn).toEqual([SHA.tan]);
    expect(ev.user_data.ln).toEqual([SHA.weiming]);
    expect(ev.user_data.fbc).toBe('fb.1.1757660400123.abc123');
    expect(ev.user_data.client_user_agent).toBe('Mozilla/5.0 test');
    expect(ev.custom_data.tier).toBe('A');
  });
  test('omits fields it has no data for instead of sending empty hashes', () => {
    const ev = capi.buildScheduleEvent({ opportunityId: 'x', phone: '91234567', eventTimeSec: 1 });
    expect(ev.user_data.em).toBeUndefined();
    expect(ev.user_data.fbc).toBeUndefined();
    expect(ev.user_data.fn).toBeUndefined();
    expect(ev.user_data.ph).toEqual([SHA['6591234567']]);
  });
});

test.describe('Google service account + JWT', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const sa = { client_email: 'bot@proj.iam.gserviceaccount.com', private_key: pem };

  test('loads inline JSON, base64 JSON, or a file path', () => {
    const json = JSON.stringify(sa);
    expect(gcal.loadServiceAccount(json).client_email).toBe(sa.client_email);
    expect(gcal.loadServiceAccount(Buffer.from(json).toString('base64')).client_email).toBe(sa.client_email);
    const fake = (p: string) => (p === '/keys/sa.json' ? json : '');
    expect(gcal.loadServiceAccount('/keys/sa.json', fake).client_email).toBe(sa.client_email);
    expect(gcal.loadServiceAccount('')).toBeNull();
    expect(gcal.loadServiceAccount('not json')).toBeNull();
  });

  test('signs an RS256 JWT Google will accept', () => {
    const jwt = gcal.signJwt(sa, { scope: 'scope-x', nowSec: 1000, sub: 'alexander@41labs.ai' });
    const [h, p, s] = jwt.split('.');
    const header = JSON.parse(Buffer.from(h, 'base64url').toString());
    const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
    expect(header).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(claims).toEqual({
      iss: sa.client_email, scope: 'scope-x', aud: 'https://oauth2.googleapis.com/token',
      iat: 1000, exp: 4600, sub: 'alexander@41labs.ai',
    });
    const ok = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s, 'base64url'));
    expect(ok).toBe(true);
  });
});

test.describe('booking event detection', () => {
  const ev = {
    id: 'ev1',
    status: 'confirmed',
    summary: '41 Closer demo call (Tan Wei Ming)',
    description: 'Booked by\nTan Wei Ming\nwm@tanaircon.sg\n\nPhone number\n+65 9123 4567\n\nCompany\nTan Aircon',
    attendees: [
      { email: 'alexander@41labs.ai', organizer: true, self: true },
      { email: 'WM@TanAircon.sg' },
    ],
    hangoutLink: 'https://meet.google.com/abc-defg-hij',
    start: { dateTime: '2026-09-12T07:00:00Z' },
    end: { dateTime: '2026-09-12T07:20:00Z' },
  };

  test('matches on title or description, case-insensitive, comma-separated alternatives', () => {
    expect(gcal.isBookingEvent(ev, '41 Closer')).toBe(true);
    expect(gcal.isBookingEvent(ev, '41 closer')).toBe(true);
    expect(gcal.isBookingEvent({ ...ev, summary: 'Lunch', description: '' }, '41 Closer')).toBe(false);
    expect(gcal.isBookingEvent({ ...ev, summary: 'Leak audit (Tan)' }, 'Zzz, leak audit')).toBe(true);
  });
  test('cancelled events are never bookings', () => {
    expect(gcal.isBookingEvent({ ...ev, status: 'cancelled' }, '41 Closer')).toBe(false);
  });
  test('extracts guest emails (not the organiser) and phones from the booking form', () => {
    const c = gcal.extractContacts(ev);
    expect(c.emails).toEqual(['wm@tanaircon.sg']);
    expect(c.phones).toContain('6591234567');
  });
  test('meet link from hangoutLink or conferenceData', () => {
    expect(gcal.meetLink(ev)).toBe('https://meet.google.com/abc-defg-hij');
    expect(gcal.meetLink({ conferenceData: { entryPoints: [{ entryPointType: 'video', uri: 'https://meet.google.com/x' }] } }))
      .toBe('https://meet.google.com/x');
    expect(gcal.meetLink({})).toBe('');
  });
});

test.describe('statusNotes parsing and idempotency markers', () => {
  const n = 'Form: 41labs.ai/ai-closer\nTier: A (High value)\nUTM: utm_source=facebook utm_content=ad_stalk1\nfbclid=abc123\nUA: Mozilla/5.0 test';
  test('parses tier, fbclid, user agent and UTM content', () => {
    expect(notes.parseLeadNotes(n)).toEqual({ tier: 'A', fbclid: 'abc123', userAgent: 'Mozilla/5.0 test', utmContent: 'ad_stalk1', fromLandingPage: true });
  });
  test('markers are added once and can be removed', () => {
    const a = notes.addMarker(n, 'sent:finish_booking');
    expect(notes.hasMarker(a, 'sent:finish_booking')).toBe(true);
    expect(notes.addMarker(a, 'sent:finish_booking')).toBe(a);
    expect(notes.hasMarker(notes.removeMarker(a, 'sent:finish_booking'), 'sent:finish_booking')).toBe(false);
    expect(notes.hasMarker(n, 'sent:finish')).toBe(false);
  });
});
