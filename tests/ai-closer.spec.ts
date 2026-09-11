import { test, expect, Page } from '@playwright/test';

// The 41 Closer ad funnel: /ai-closer (long form, event opt-in style, the ad destination)
// and /ai-closer-sf (short form, split-test variant). Both share ai-closer.js.
// These tests pin the mechanics the numbers model depends on: two-step form, Lead on submit,
// ICP gate to the calendar, UTMs to the CRM, Schedule on booking, free-demo offer, no price.

const QS = '?utm_source=facebook&utm_campaign=41closer_lp_2026-09&utm_content=ad_stalk1&fbclid=abc123';
const PAGES = [
  { name: 'long form', path: '/ai-closer.html', variant: 'long' },
  { name: 'short form', path: '/ai-closer-sf.html', variant: 'sf' },
];

async function stubNetwork(page: Page) {
  const sent: { api: any[]; formspree: number } = { api: [], formspree: 0 };
  await page.route('**/api/closer-lead', async (route) => {
    sent.api.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.route('**/formspree.io/**', async (route) => {
    sent.formspree += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.route(/connect\.facebook\.net|googletagmanager|app\.cal\.com|fonts\.g/, (r) => r.abort());
  return sent;
}

async function stubPixel(page: Page) {
  await page.addInitScript(() => {
    (window as any).__fbq = [];
    (window as any).fbq = (...args: any[]) => (window as any).__fbq.push(args);
  });
}

async function fillPart1(page: Page) {
  await page.fill('#cl-name', 'Tan Wei Ming');
  await page.fill('#cl-whatsapp', '+65 9123 4567');
  await page.fill('#cl-company', 'Tan Aircon Services');
}

async function fillForm(page: Page, opts: { enquiries?: string } = {}) {
  await fillPart1(page);
  await page.click('#cl-next');
  await page.selectOption('#cl-role', 'owner');
  await page.selectOption('#cl-enquiries', opts.enquiries || '50to150');
  await page.selectOption('#cl-sale', '200to1k');
  await page.check('input[name="jobs"][value="quotes"]');
  await page.check('input[name="jobs"][value="bookings"]');
}

const fbqEvents = (page: Page) =>
  page.evaluate(() => ((window as any).__fbq || []).filter((a: any[]) => a[0] === 'track').map((a: any[]) => a[1]));

for (const P of PAGES) {
  test.describe(P.name, () => {
    test('ad-only: noindex, message-matched "Not just a chatbot", one form, no nav', async ({ page }) => {
      await stubNetwork(page);
      await page.goto(P.path + QS);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      await expect(page.locator('body')).toContainText('Not just a chatbot');
      await expect(page.locator('form')).toHaveCount(1);
      await expect(page.locator('header nav a')).toHaveCount(0);
      await expect(page.locator('body')).toHaveAttribute('data-variant', P.variant);
    });

    test('offer is a free demo; no price anywhere; guarantee matches the SOW', async ({ page }) => {
      await stubNetwork(page);
      await page.goto(P.path);
      const text = await page.locator('body').innerText();
      expect(text).toMatch(/free/i);
      expect(text).not.toContain('9,600');
      expect(text).not.toContain('1,490');
      expect(text).not.toMatch(/setup fee back|money back|refund/i);
    });

    test('house style: no em dashes, no hype words', async ({ page }) => {
      await stubNetwork(page);
      await page.goto(P.path);
      // Our copy only. Verbatim demo chats (.chatcard) are product output, quoted word for word.
      const text = await page.evaluate(() => {
        const c = document.body.cloneNode(true) as HTMLElement;
        c.querySelectorAll('.chatcard').forEach((n) => n.remove());
        return c.innerText;
      });
      expect(text).not.toContain('—');
      for (const w of ['unlock', 'leverage', 'supercharge', 'seamless', 'game-changing', 'revolutionary']) {
        expect(text.toLowerCase()).not.toContain(w);
      }
    });

    test('step 1 requires name, WhatsApp and company before Next', async ({ page }) => {
      const sent = await stubNetwork(page);
      await page.goto(P.path);
      await page.click('#cl-next');
      await expect(page.locator('#cl-part2')).toBeHidden();
      await fillPart1(page);
      await page.click('#cl-next');
      await expect(page.locator('#cl-part2')).toBeVisible();
      await expect(page.locator('#cl-part1')).toBeHidden();
      expect(sent.api).toHaveLength(0);
    });

    test('Back returns to step 1 with answers kept', async ({ page }) => {
      await stubNetwork(page);
      await page.goto(P.path);
      await fillPart1(page);
      await page.click('#cl-next');
      await page.click('#cl-back');
      await expect(page.locator('#cl-part1')).toBeVisible();
      await expect(page.locator('#cl-name')).toHaveValue('Tan Wei Ming');
    });

    test('submit: lead with UTMs + tier to the CRM, email copy, Lead pixel', async ({ page }) => {
      const sent = await stubNetwork(page);
      await stubPixel(page);
      await page.goto(P.path + QS);
      await fillForm(page);
      await page.click('#cl-submit');
      await expect(page.locator('#cl-step2')).toBeVisible();
      expect(sent.api).toHaveLength(1);
      expect(sent.api[0]).toMatchObject({
        name: 'Tan Wei Ming', whatsapp: '+65 9123 4567', company: 'Tan Aircon Services',
        enquiries: '50to150', saleValue: '200to1k', jobs: ['quotes', 'bookings'],
        tier: 'A', qualified: 'yes', variant: P.variant,
        utm_campaign: '41closer_lp_2026-09', utm_content: 'ad_stalk1', fbclid: 'abc123',
      });
      expect(sent.api[0].fitReason).toBeTruthy();
      expect(sent.formspree).toBe(1);
      expect(await fbqEvents(page)).toContain('Lead');
    });

    test('complexity question is required', async ({ page }) => {
      const sent = await stubNetwork(page);
      await page.goto(P.path);
      await fillPart1(page);
      await page.click('#cl-next');
      await page.selectOption('#cl-role', 'owner');
      await page.selectOption('#cl-enquiries', '50to150');
      await page.selectOption('#cl-sale', '200to1k');
      await page.click('#cl-submit');
      await expect(page.locator('#cl-step2')).toBeHidden();
      await expect(page.locator('#cl-jobs-error')).toBeVisible();
      expect(sent.api).toHaveLength(0);
    });

    test('low volume + low value goes to WhatsApp triage, not the calendar', async ({ page }) => {
      const sent = await stubNetwork(page);
      await page.goto(P.path);
      await fillForm(page, { enquiries: 'under20' });
      await page.click('#cl-submit');
      await expect(page.locator('#cl-notyet')).toBeVisible();
      await expect(page.locator('#cl-book')).toBeHidden();
      expect(sent.api[0]).toMatchObject({ qualified: 'no', tier: 'C' });
    });

    test('qualified + Google booking URL: calendar iframe, no fallback', async ({ page }) => {
      await stubNetwork(page);
      await page.route('**/calendar.google.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>cal</p>' }));
      await page.goto(P.path);
      await page.evaluate(() => { (window as any).BOOKING_URL = 'https://calendar.google.com/calendar/appointments/schedules/TEST?gv=true'; });
      await fillForm(page);
      await page.click('#cl-submit');
      await expect(page.locator('#cl-book')).toBeVisible();
      await expect(page.locator('#cl-cal iframe')).toHaveAttribute('src', /appointments\/schedules\/TEST/);
      await expect(page.locator('#cl-cal-fallback')).toBeHidden();
    });

    test('qualified + no booking URL: WhatsApp fallback', async ({ page }) => {
      await stubNetwork(page);
      await page.goto(P.path);
      await page.evaluate(() => { (window as any).BOOKING_URL = ''; });
      await fillForm(page);
      await page.click('#cl-submit');
      await expect(page.locator('#cl-cal-fallback')).toBeVisible();
    });

    test('qualify41 override returning a boolean still routes correctly', async ({ page }) => {
      await stubNetwork(page);
      await page.goto(P.path);
      await page.evaluate(() => { (window as any).qualify41 = () => false; });
      await fillForm(page);
      await page.click('#cl-submit');
      await expect(page.locator('#cl-notyet')).toBeVisible();
    });

    test('a completed booking fires Schedule', async ({ page }) => {
      await stubNetwork(page);
      await stubPixel(page);
      await page.goto(P.path);
      await page.evaluate(() => (window as any).onCloserBooked());
      expect(await fbqEvents(page)).toContain('Schedule');
    });

    test('consent to be contacted on WhatsApp is stated before step 1', async ({ page }) => {
      await stubNetwork(page);
      await page.goto(P.path);
      await expect(page.locator('#cl-part1')).toContainText(/WhatsApp/);
      await expect(page.locator('#cl-part1 .consent')).toBeVisible();
    });
  });
}

test.describe('long form follows the event opt-in structure', () => {
  test('sections appear in his order', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/ai-closer.html');
    const ids = await page.locator('main > section[id]').evaluateAll((els) => els.map((e) => e.id));
    const order = ['hero', 'seen', 'get', 'proof-1', 'letter', 'proof-2', 'why', 'money', 'weeks', 'guarantee', 'stack', 'fit', 'before-after', 'why-now', 'faq', 'final'];
    const found = order.filter((id) => ids.includes(id));
    expect(found).toEqual(order);
    expect(ids.filter((id) => order.includes(id))).toEqual(order);
  });

  test('every CTA button goes back to the form (his 12-button pattern)', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/ai-closer.html');
    const ctas = page.locator('a.btn-cta');
    expect(await ctas.count()).toBeGreaterThanOrEqual(9);
    const hrefs = await ctas.evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    expect(new Set(hrefs)).toEqual(new Set(['#qualify']));
  });

  test('the founder letter is signed and uses the real stage photo', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/ai-closer.html');
    await expect(page.locator('#letter')).toContainText('Dear fellow business owner');
    await expect(page.locator('#letter')).toContainText('Alexander Lee');
    await expect(page.locator('#letter img')).toHaveAttribute('src', /lp-founder-letter\.webp/);
  });

  test('leak calculator updates the monthly figure', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/ai-closer.html');
    await page.fill('[name=lc-enq]', '100');
    await page.fill('[name=lc-late]', '30');
    await page.fill('[name=lc-sale]', '500');
    await page.fill('[name=lc-close]', '20');
    // 100 x 4.3 x 30% x 20% x 500 = S$12,900 a month
    await expect(page.locator('[data-out=lost]')).toHaveText('S$12,900');
  });

  test('clicking a CTA brings the form into view', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/ai-closer.html');
    await page.locator('#faq a.btn-cta').first().click();
    await expect(page.locator('#cl-name')).toBeInViewport();
  });
});
