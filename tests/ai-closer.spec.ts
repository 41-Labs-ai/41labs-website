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
