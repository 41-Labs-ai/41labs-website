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
