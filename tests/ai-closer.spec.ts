import { test, expect, Page } from '@playwright/test';

// /ai-closer is the ad-only landing page: one form, then a booked call.
// These tests pin the funnel mechanics the numbers model depends on:
// Lead fires on submit, qualified visitors see the calendar, UTMs reach the CRM,
// and a booking fires Schedule.

const URL = '/ai-closer.html?utm_source=facebook&utm_campaign=41closer_lp_2026-09&utm_content=ad_stalk1&fbclid=abc123';

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
  // Block third-party scripts so tests are fast and offline-safe.
  await page.route(/connect\.facebook\.net|googletagmanager|app\.cal\.com|fonts\.g/, (r) => r.abort());
  return sent;
}

async function stubPixel(page: Page) {
  await page.addInitScript(() => {
    (window as any).__fbq = [];
    (window as any).fbq = (...args: any[]) => (window as any).__fbq.push(args);
  });
}

async function fillForm(page: Page) {
  await page.fill('#cl-name', 'Tan Wei Ming');
  await page.fill('#cl-whatsapp', '+65 9123 4567');
  await page.fill('#cl-company', 'Tan Aircon Services');
  await page.selectOption('#cl-role', 'owner');
  await page.selectOption('#cl-enquiries', '50to150');
  await page.selectOption('#cl-sale', '200to1k');
  await page.check('input[name="jobs"][value="quotes"]');
  await page.check('input[name="jobs"][value="bookings"]');
}

const fbqEvents = (page: Page) =>
  page.evaluate(() => ((window as any).__fbq || []).filter((a: any[]) => a[0] === 'track').map((a: any[]) => a[1]));

test('page is ad-only: noindex, message-matched headline, one form', async ({ page }) => {
  await stubNetwork(page);
  await page.goto(URL);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('h1')).toContainText('Not just a chatbot');
  await expect(page.locator('form')).toHaveCount(1);
  await expect(page.locator('header nav a')).toHaveCount(0); // no site nav = no exits
});

test('copy follows house style: no em dashes, no banned hype words', async ({ page }) => {
  await stubNetwork(page);
  await page.goto(URL);
  const text = await page.locator('body').innerText();
  expect(text).not.toContain('—');
  for (const w of ['unlock', 'leverage', 'supercharge', 'seamless', 'game-changing', 'revolutionary']) {
    expect(text.toLowerCase()).not.toContain(w);
  }
});

test('hero CTA takes you to the form', async ({ page }) => {
  await stubNetwork(page);
  await page.goto(URL);
  await page.click('a[href="#qualify"]');
  await expect(page.locator('#cl-name')).toBeInViewport();
});

test('submit: sends lead with UTMs to the CRM, emails a copy, fires Lead', async ({ page }) => {
  const sent = await stubNetwork(page);
  await stubPixel(page);
  await page.goto(URL);
  await fillForm(page);
  await page.click('#cl-submit');
  await expect(page.locator('#cl-step2')).toBeVisible();

  expect(sent.api).toHaveLength(1);
  expect(sent.api[0]).toMatchObject({
    name: 'Tan Wei Ming',
    whatsapp: '+65 9123 4567',
    company: 'Tan Aircon Services',
    enquiries: '50to150',
    saleValue: '200to1k',
    utm_campaign: '41closer_lp_2026-09',
    utm_content: 'ad_stalk1',
    fbclid: 'abc123',
  });
  expect(['yes', 'no']).toContain(sent.api[0].qualified);
  // 50-150/wk x S$200-1k with quotes + bookings = ~S$258k/mo -> tier A
  expect(sent.api[0].jobs).toEqual(['quotes', 'bookings']);
  expect(sent.api[0].tier).toBe('A');
  expect(sent.api[0].fitReason).toBeTruthy();
  expect(sent.formspree).toBe(1);
  expect(await fbqEvents(page)).toContain('Lead');
});

test('required fields block submit', async ({ page }) => {
  const sent = await stubNetwork(page);
  await page.goto(URL);
  await page.click('#cl-submit');
  await expect(page.locator('#cl-step2')).toBeHidden();
  expect(sent.api).toHaveLength(0);
});

test('complexity question is required: at least one box must be ticked', async ({ page }) => {
  const sent = await stubNetwork(page);
  await page.goto(URL);
  await page.fill('#cl-name', 'Tan Wei Ming');
  await page.fill('#cl-whatsapp', '+65 9123 4567');
  await page.fill('#cl-company', 'Tan Aircon Services');
  await page.selectOption('#cl-role', 'owner');
  await page.selectOption('#cl-enquiries', '50to150');
  await page.selectOption('#cl-sale', '200to1k');
  await page.click('#cl-submit');
  await expect(page.locator('#cl-step2')).toBeHidden();
  expect(sent.api).toHaveLength(0);
});

test('real rule: low volume and low value goes to WhatsApp triage', async ({ page }) => {
  const sent = await stubNetwork(page);
  await page.goto(URL);
  await fillForm(page);
  await page.selectOption('#cl-enquiries', 'under20');
  await page.click('#cl-submit');
  await expect(page.locator('#cl-notyet')).toBeVisible();
  expect(sent.api[0]).toMatchObject({ qualified: 'no', tier: 'C' });
});

test('qualify41 may return a plain boolean (override) or the rule object', async ({ page }) => {
  await stubNetwork(page);
  await page.goto(URL);
  await page.evaluate(() => { (window as any).qualify41 = () => ({ qualified: false, tier: 'C', reason: 'x' }); });
  await fillForm(page);
  await page.click('#cl-submit');
  await expect(page.locator('#cl-notyet')).toBeVisible();
});

test('Google Calendar booking page embeds as an iframe when BOOKING_URL is Google', async ({ page }) => {
  await stubNetwork(page);
  await page.route('**/calendar.google.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>cal</p>' }));
  await page.goto(URL);
  await page.evaluate(() => { (window as any).BOOKING_URL = 'https://calendar.google.com/calendar/appointments/schedules/TEST?gv=true'; });
  await fillForm(page);
  await page.click('#cl-submit');
  const frame = page.locator('#cl-cal iframe');
  await expect(frame).toHaveAttribute('src', /calendar\.google\.com\/calendar\/appointments\/schedules\/TEST/);
  await expect(page.locator('#cl-cal-fallback')).toBeHidden();
});

test('no BOOKING_URL: qualified visitor sees the WhatsApp fallback', async ({ page }) => {
  await stubNetwork(page);
  await page.goto(URL);
  await page.evaluate(() => { (window as any).BOOKING_URL = ''; });
  await fillForm(page);
  await page.click('#cl-submit');
  await expect(page.locator('#cl-cal-fallback')).toBeVisible();
});

test('price is not on the page; guarantee matches the SOW wording', async ({ page }) => {
  await stubNetwork(page);
  await page.goto(URL);
  const text = await page.locator('body').innerText();
  expect(text).not.toContain('9,600');
  expect(text).not.toContain('1,490');
  expect(text).toContain('up to six more weeks');
  expect(text).not.toMatch(/setup fee back|money back|refund/i);
});

test('qualified visitor sees the calendar step', async ({ page }) => {
  await stubNetwork(page);
  await page.goto(URL);
  await page.evaluate(() => { (window as any).qualify41 = () => true; });
  await fillForm(page);
  await page.click('#cl-submit');
  await expect(page.locator('#cl-book')).toBeVisible();
  await expect(page.locator('#cl-notyet')).toBeHidden();
});

test('not-yet-qualified visitor gets the WhatsApp follow-up message instead', async ({ page }) => {
  await stubNetwork(page);
  await page.goto(URL);
  await page.evaluate(() => { (window as any).qualify41 = () => false; });
  await fillForm(page);
  await page.click('#cl-submit');
  await expect(page.locator('#cl-notyet')).toBeVisible();
  await expect(page.locator('#cl-book')).toBeHidden();
});

test('a completed booking fires Schedule', async ({ page }) => {
  await stubNetwork(page);
  await stubPixel(page);
  await page.goto(URL);
  await page.evaluate(() => (window as any).onCloserBooked());
  expect(await fbqEvents(page)).toContain('Schedule');
});
