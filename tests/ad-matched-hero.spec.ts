import { test, expect, Page } from '@playwright/test';

// The hero shows a sample WhatsApp chat with four industry tabs. Everyone used to see
// the Aircon one first, whichever ad brought them.
//
// cold_carrental is the best ad in the account: it brought Alan Ong and Stark
// Holdings, both car rental, and both landed on an aircon conversation. A car rental
// owner should see a car rental conversation first.

async function open(page: Page, qs = '') {
  const events: string[] = [];
  // The page reports through window.track41, not gtag. Watching gtag here would see
  // nothing, and a "was not reported" test would pass for the wrong reason.
  await page.addInitScript(() => {
    (window as any).__tracked = [];
    Object.defineProperty(window, 'track41', {
      configurable: true,
      get: () => (name: string, p: any) => (window as any).__tracked.push([name, p]),
      set: () => {},
    });
  });
  await page.route(/connect\.facebook\.net|googletagmanager|clarity\.ms|app\.cal\.com/, (r) => r.abort());
  await page.goto('/ai-closer.html' + qs);
  return events;
}

const activeTab = (page: Page) => page.locator('.wa-tab.on').getAttribute('data-chat');
const visibleSlot = (page: Page) =>
  page.locator('.wa-slot:not([hidden])').first().getAttribute('data-chat');

for (const [ad, chat] of [
  ['cold_carrental', 'car'],
  ['cold_reno', 'renovation'],
  ['cold_clinic', 'clinic'],
] as const) {
  test(`${ad} opens on the ${chat} conversation`, async ({ page }) => {
    await open(page, `?utm_source=facebook&utm_content=${ad}`);
    expect(await activeTab(page)).toBe(chat);
    expect(await visibleSlot(page)).toBe(chat);
  });
}

test('an ad with no matching tab keeps the default', async ({ page }) => {
  await open(page, '?utm_source=facebook&utm_content=cold_leak');
  expect(await activeTab(page)).toBe('servicing');
});

test('no ad at all keeps the default', async ({ page }) => {
  await open(page);
  expect(await activeTab(page)).toBe('servicing');
});

test('exactly one tab and one chat are showing', async ({ page }) => {
  await open(page, '?utm_content=cold_carrental');
  await expect(page.locator('.wa-tab.on')).toHaveCount(1);
  await expect(page.locator('.wa-slot:not([hidden])')).toHaveCount(1);
});

// hero_chat_switch means the visitor chose a tab. Picking one for them is not a choice,
// and counting it as one would say the car chat was clicked by every car rental visitor.
test('picking the tab for them is not reported as the visitor switching', async ({ page }) => {
  await open(page, '?utm_content=cold_carrental');
  await page.waitForTimeout(300);
  const switches = await page.evaluate(() =>
    ((window as any).__tracked || []).filter((a: any[]) => a[0] === 'hero_chat_switch'));
  expect(switches).toHaveLength(0);
});

test('they can still switch tabs themselves, and that is reported', async ({ page }) => {
  await open(page, '?utm_content=cold_carrental');
  await page.click('.wa-tab[data-chat="clinic"]');
  expect(await activeTab(page)).toBe('clinic');
  const switches = await page.evaluate(() =>
    ((window as any).__tracked || []).filter((a: any[]) => a[0] === 'hero_chat_switch'));
  expect(switches.length).toBeGreaterThan(0);
});
