import { test, expect, Page } from '@playwright/test';

// closer-analytics.js: who arrived, where they went on the page, how long they
// stayed, and whether any of that survives into the lead.
//
// This is the data the ad account and the sales call both run on, so the tests
// pin the contract rather than the implementation: what ends up in the beacon,
// and what ends up in the /api/closer-lead body.

const QS = '?utm_source=facebook&utm_campaign=41closer_lp_2026-09&utm_content=ad_stalk1&fbclid=abc123';

type Sent = { api: any[]; beacons: any[] };

async function stub(page: Page): Promise<Sent> {
  const sent: Sent = { api: [], beacons: [] };
  await page.route('**/api/closer-lead', async (route) => {
    sent.api.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.route('**/api/track', async (route) => {
    // WebKit does not expose a sendBeacon Blob body to route interception, so the
    // body is null there however we read it. Push null and let the test assert on
    // the body only when the engine gave us one.
    const buf = route.request().postDataBuffer();
    const raw = buf ? buf.toString('utf8') : route.request().postData();
    sent.beacons.push(raw ? JSON.parse(raw) : null);
    await route.fulfill({ status: 204, body: '' });
  });
  await page.route('**/formspree.io/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route(/connect\.facebook\.net|googletagmanager|app\.cal\.com|fonts\.g/, (r) => r.abort());
  await page.addInitScript(() => {
    (window as any).__fbq = [];
    (window as any).fbq = (...args: any[]) => (window as any).__fbq.push(args);
  });
  return sent;
}

async function fillAndSubmit(page: Page, opts: { enquiries?: string; whatsappUse?: string } = {}) {
  await page.selectOption('#cl-industry', 'servicing');
  await page.selectOption('#cl-wa', opts.whatsappUse || 'most');
  await page.selectOption('#cl-enquiries', opts.enquiries || '50to150');
  await page.selectOption('#cl-sale', '200to1k');
  await page.check('input[name="jobs"][value="quotes"]');
  await page.check('input[name="jobs"][value="bookings"]');
  await page.selectOption('#cl-after', 'nobody');
  await page.selectOption('#cl-tried', 'chatbot');
  await page.click('#cl-next');
  await page.fill('#cl-name', 'Tan Wei Ming');
  await page.fill('#cl-whatsapp', '+65 9123 4567');
  await page.fill('#cl-website', 'tanaircon.sg');
  await page.click('#cl-submit');
}

const snapshot = (page: Page) => page.evaluate(() => (window as any).cl41.snapshot());

test.describe('who arrived', () => {
  test('a returning visitor is recognised as the same person across visits', async ({ page }) => {
    await stub(page);
    await page.goto('/ai-closer.html' + QS);
    const first = await snapshot(page);
    expect(first.vid).toMatch(/\w{8}/);
    expect(first.journey.visits).toBe(1);

    await page.goto('/ai-closer.html');
    const second = await snapshot(page);
    expect(second.vid).toBe(first.vid);          // same person
    expect(second.sid).not.toBe(first.sid);      // new page view
    expect(second.journey.visits).toBe(2);
  });

  test('the ad that brought them is kept as first touch even after they come back direct', async ({ page }) => {
    await stub(page);
    await page.goto('/ai-closer.html' + QS);
    await page.goto('/ai-closer.html');          // direct return, no UTMs
    const s = await snapshot(page);
    expect(s.attr.first.utm_content).toBe('ad_stalk1');
    expect(s.attr.first.fbclid).toBe('abc123');
    expect(s.attr.last.utm_content).toBe('ad_stalk1');   // last known ad, not overwritten by a blank
  });

  test('an fbclid in the url becomes an fbc value Meta can match on', async ({ page }) => {
    await stub(page);
    await page.goto('/ai-closer.html' + QS);
    const s = await snapshot(page);
    expect(s.ids.fbc).toMatch(/^fb\.1\.\d{13}\.abc123$/);
  });

  test('the real _fbc cookie wins over one we rebuild, because it has the true click time', async ({ page, context }) => {
    await stub(page);
    await context.addCookies([{ name: '_fbc', value: 'fb.1.1111111111111.realclick', url: 'http://localhost:3000' }]);
    await page.goto('/ai-closer.html' + QS);
    const s = await snapshot(page);
    expect(s.ids.fbc).toBe('fb.1.1111111111111.realclick');
  });

  test('the _fbp cookie is picked up when the pixel has set one', async ({ page, context }) => {
    await stub(page);
    await context.addCookies([{ name: '_fbp', value: 'fb.1.1757660000000.1234567890', url: 'http://localhost:3000' }]);
    await page.goto('/ai-closer.html');
    expect((await snapshot(page)).ids.fbp).toBe('fb.1.1757660000000.1234567890');
  });

  test('a visitor with no ad click and no cookies still records cleanly', async ({ page }) => {
    await stub(page);
    await page.goto('/ai-closer.html');
    const s = await snapshot(page);
    expect(s.ids.fbc).toBe('');
    expect(s.ids.fbp).toBe('');
    expect(s.journey.visits).toBe(1);
  });
});

test.describe('where they went and how long they stayed', () => {
  test('scroll depth is recorded as the deepest point reached, not the current one', async ({ page }) => {
    await stub(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });   // no smooth-scroll animation to race
    await page.goto('/ai-closer.html');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1200);
    const deep = (await snapshot(page)).journey.scroll;
    expect(deep).toBeGreaterThan(80);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1200);
    expect((await snapshot(page)).journey.scroll).toBe(deep);   // still the max
  });

  test('time is attributed to the section actually on screen', async ({ page }) => {
    await stub(page);
    await page.goto('/ai-closer.html');
    await page.locator('#guarantee').scrollIntoViewIfNeeded();
    await page.waitForTimeout(2500);
    const sections: [string, number][] = (await snapshot(page)).journey.sections;
    const seen = Object.fromEntries(sections);
    expect(seen.guarantee).toBeGreaterThanOrEqual(1000);
    expect(seen.hero || 0).toBeLessThan(seen.guarantee);
  });

  test('sections come back ordered by how long they held attention', async ({ page }) => {
    await stub(page);
    await page.goto('/ai-closer.html');
    await page.locator('#guarantee').scrollIntoViewIfNeeded();
    await page.waitForTimeout(2500);
    const sections: [string, number][] = (await snapshot(page)).journey.sections;
    expect(sections.length).toBeGreaterThan(0);
    for (let i = 1; i < sections.length; i++) expect(sections[i - 1][1]).toBeGreaterThanOrEqual(sections[i][1]);
  });

  test('a backgrounded tab does not count as someone reading the page', async ({ page }) => {
    await stub(page);
    await page.goto('/ai-closer.html');
    await page.waitForTimeout(1200);
    const before = (await snapshot(page)).journey.engagedMs;
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(2500);
    const after = (await snapshot(page)).journey.engagedMs;
    expect(after - before).toBeLessThan(1000);      // the hidden seconds were not counted
    expect((await snapshot(page)).journey.ms).toBeGreaterThan(3000);  // wall clock still runs
  });

  test('engaged time never exceeds the wall clock', async ({ page }) => {
    await stub(page);
    await page.goto('/ai-closer.html');
    await page.waitForTimeout(1500);
    const j = (await snapshot(page)).journey;
    expect(j.engagedMs).toBeLessThanOrEqual(j.ms);
  });
});

test.describe('the beacon', () => {
  test('the journey is sent when the visitor leaves, without blocking the unload', async ({ page }) => {
    const sent = await stub(page);
    await page.goto('/ai-closer.html' + QS);
    await page.locator('#guarantee').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(() => sent.beacons.length, { timeout: 3000 }).toBeGreaterThan(0);
    const b = sent.beacons[0];
    test.skip(b === null, 'this engine does not expose the beacon body to route interception');
    expect(b.vid).toBeTruthy();
    expect(b.page).toContain('ai-closer');
    expect(b.journey.scroll).toBeGreaterThan(0);
    expect(b.attr.last.utm_content).toBe('ad_stalk1');
  });

  test('the beacon still carries the journey when sendBeacon is unavailable', async ({ page }) => {
    const sent = await stub(page);
    // Older iOS and any browser with sendBeacon disabled fall through to keepalive
    // fetch. That path must send the same payload, not a stripped-down one.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true });
    });
    await page.goto('/ai-closer.html' + QS);
    await page.locator('#guarantee').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(() => sent.beacons.length, { timeout: 3000 }).toBeGreaterThan(0);
    const b = sent.beacons[0];
    expect(b.vid).toBeTruthy();
    expect(b.journey.scroll).toBeGreaterThan(0);
    expect(b.attr.last.utm_content).toBe('ad_stalk1');
  });
});

// Everything the recorder measures is worthless if GA never loads. /ai-closer
// shipped for weeks with track.js (which only defines a gtag STUB that queues
// into dataLayer) and no loader for the real gtag.js, so the queue was never
// flushed and the page was invisible in GA4.
test.describe('reaching GA4', () => {
  async function stubGtm(page: Page) {
    const asked: string[] = [];
    await page.route(/googletagmanager\.com/, (route) => {
      asked.push(route.request().url());
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    });
    await page.route('**/api/track', (r) => r.fulfill({ status: 204, body: '' }));
    await page.route(/connect\.facebook\.net|fonts\.g/, (r) => r.abort());
    return asked;
  }

  for (const path of ['/ai-closer.html', '/ai-closer-sf.html']) {
    test(`${path} loads real GA, not just the queueing stub`, async ({ page }) => {
      const asked = await stubGtm(page);
      await page.goto(path);
      await page.mouse.click(200, 300);      // the loader waits for first interaction
      await expect.poll(() => asked.join(' '), { timeout: 8000 }).toContain('gtag/js');
    });
  }

  test('the first mark survives script order instead of being dropped', async ({ page }) => {
    await stubGtm(page);
    await page.goto('/ai-closer.html');
    // closer-analytics.js runs before track.js defines window.track41. The opening
    // page_view_closer must still reach dataLayer, or every session is missing its start.
    const names = await page.evaluate(() =>
      (window as any).dataLayer.map((a: any) => Array.from(a)).filter((a: any) => a[0] === 'event').map((a: any) => a[1]));
    expect(names).toContain('page_view_closer');
  });

  test('a mark carries its parameters through to GA', async ({ page }) => {
    await stubGtm(page);
    await page.goto('/ai-closer.html?utm_content=ad_stalk1');
    const ev = await page.evaluate(() =>
      (window as any).dataLayer.map((a: any) => Array.from(a))
        .filter((a: any) => a[0] === 'event' && a[1] === 'page_view_closer')[0]);
    expect(ev[2]).toMatchObject({ variant: 'long', visit: 1 });
  });
});

// /41-closer is where the live Meta ads actually send people (with ?v=ecom,
// ?v=industrial, ?v=services). It had the same missing-GA bug and no journey
// recorder at all, so the page spending the ad budget was the one we could see
// least. Every CTA on it is a click to WhatsApp, so whatsapp_click by ad variant
// is the whole scoreboard.
test.describe('the page the ads actually point at', () => {
  async function stubGtm(page: Page) {
    const asked: string[] = [];
    await page.route(/googletagmanager\.com/, (route) => {
      asked.push(route.request().url());
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    });
    await page.route('**/api/track', (r) => r.fulfill({ status: 204, body: '' }));
    await page.route(/connect\.facebook\.net|fonts\.g/, (r) => r.abort());
    return asked;
  }

  test('loads real GA, not just the queueing stub', async ({ page }) => {
    const asked = await stubGtm(page);
    await page.goto('/41-closer.html');
    await page.mouse.click(200, 300);
    await expect.poll(() => asked.join(' '), { timeout: 8000 }).toContain('gtag/js');
  });

  test('records the journey, so we can see which part of the page works', async ({ page }) => {
    await stubGtm(page);
    await page.goto('/41-closer.html');
    await page.waitForTimeout(1200);
    const s = await page.evaluate(() => (window as any).cl41?.snapshot());
    expect(s).toBeTruthy();
    expect(s.journey.ms).toBeGreaterThan(0);
  });

  test('its sections are named, or "which part of the page works" has no answer', async ({ page }) => {
    await stubGtm(page);
    await page.goto('/41-closer.html');
    // must match SECTION_SELECTOR in closer-analytics.js: an unobserved block is a
    // blind spot in both the journey data and the Clarity heatmap
    const ids = await page.locator('section[id], header[id], article[id], main[id]')
      .evaluateAll((els) => els.map((e) => e.id));
    expect(ids.length).toBeGreaterThanOrEqual(12);
    expect(ids).toContain('hero');            // the hero is a <header>, not a <section>
    expect(ids).toContain('guarantee');
    expect(ids).toContain('plans');           // pre-existing anchor, must not be renamed
    expect(new Set(ids).size).toBe(ids.length);
    expect(await page.locator('section:not([id])').count()).toBe(0);
  });

  test('time is attributed to a named section here too', async ({ page }) => {
    await stubGtm(page);
    await page.goto('/41-closer.html');
    await page.locator('#guarantee').scrollIntoViewIfNeeded();
    await page.waitForTimeout(2500);
    const sections: [string, number][] = (await page.evaluate(() => (window as any).cl41.snapshot())).journey.sections;
    expect(Object.fromEntries(sections).guarantee).toBeGreaterThanOrEqual(1000);
  });

  test('the ad variant in ?v= is what the page reports, or the split test is unreadable', async ({ page }) => {
    await stubGtm(page);
    await page.goto('/41-closer.html?v=industrial&utm_content=ad_stalk2_11pm');
    const s = await page.evaluate(() => (window as any).cl41.snapshot());
    expect(s.variant).toBe('industrial');
    expect(s.attr.first.utm_content).toBe('ad_stalk2_11pm');
  });

  test('a WhatsApp click is attributed to the ad variant that paid for it', async ({ page }) => {
    await stubGtm(page);
    await page.goto('/41-closer.html?v=ecom');
    // Stop the navigation to WhatsApp but let the event keep bubbling, so track.js's
    // delegated listener still sees the click exactly as it would in the wild.
    await page.evaluate(() => document.addEventListener('click', (e) => e.preventDefault(), true));
    // on mobile the first wa.me link is the nav CTA, hidden behind the menu toggle
    await page.locator('a[href*="wa.me"]:visible').first().click({ force: true, noWaitAfter: true });
    const ev = await page.evaluate(() =>
      (window as any).dataLayer.map((a: any) => Array.from(a))
        .filter((a: any) => a[0] === 'event' && a[1] === 'whatsapp_click')[0]);
    expect(ev).toBeTruthy();
    expect(ev[2].cta_id).toBeTruthy();
  });
});

test.describe('what reaches the lead', () => {
  test('the lead carries the journey, so the call knows what they actually read', async ({ page }) => {
    const sent = await stub(page);
    await page.goto('/ai-closer.html' + QS);
    await page.locator('#guarantee').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    await fillAndSubmit(page);
    await expect.poll(() => sent.api.length, { timeout: 3000 }).toBe(1);
    const j = sent.api[0].journey;
    expect(j.ms).toBeGreaterThan(0);
    expect(j.scroll).toBeGreaterThan(0);
    expect(Array.isArray(j.sections)).toBe(true);
    expect(j.visits).toBe(1);
  });

  test('the lead carries the cookies Meta matches on, which the server cannot read itself', async ({ page, context }) => {
    const sent = await stub(page);
    await context.addCookies([{ name: '_fbp', value: 'fb.1.1757660000000.1234567890', url: 'http://localhost:3000' }]);
    await page.goto('/ai-closer.html' + QS);
    await fillAndSubmit(page);
    await expect.poll(() => sent.api.length, { timeout: 3000 }).toBe(1);
    expect(sent.api[0].fbp).toBe('fb.1.1757660000000.1234567890');
    expect(sent.api[0].fbc).toMatch(/^fb\.1\.\d{13}\.abc123$/);
  });

  test('one event id goes to both the pixel and the server, or Meta counts the lead twice', async ({ page }) => {
    const sent = await stub(page);
    await page.goto('/ai-closer.html' + QS);
    await fillAndSubmit(page);
    await expect.poll(() => sent.api.length, { timeout: 3000 }).toBe(1);

    const pixelCalls = await page.evaluate(() => (window as any).__fbq.filter((a: any[]) => a[0] === 'track' && a[1] === 'Lead'));
    expect(pixelCalls).toHaveLength(1);
    const eventID = pixelCalls[0][3]?.eventID;
    expect(eventID).toBeTruthy();
    expect(sent.api[0].eventId).toBe(eventID);
  });

  test('a lead that does not qualify still reports, so we can see what the ads are buying', async ({ page }) => {
    const sent = await stub(page);
    await page.goto('/ai-closer.html' + QS);
    await fillAndSubmit(page, { whatsappUse: 'no', enquiries: 'under20' });
    await expect.poll(() => sent.api.length, { timeout: 3000 }).toBe(1);
    expect(sent.api[0].qualified).toBe('no');
    expect(sent.api[0].tier).toBe('C');
    expect(sent.api[0].eventId).toBeTruthy();
  });
});
