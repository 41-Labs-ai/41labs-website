import { test, expect, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// A lane page is the same landing page with the lane's language in six slots. Its whole
// value is continuity: click a fleet ad, read about fleets. Its whole risk is that a
// second copy of the page quietly stops reporting, and we would not notice because the
// base page keeps reporting fine.
//
// So these tests are mostly about the tracking being identical, not the copy.

const BASE = fs.readFileSync(path.join(__dirname, '..', 'ai-closer.html'), 'utf8');
const FLEET = fs.readFileSync(path.join(__dirname, '..', 'ai-closer-fleet.html'), 'utf8');

const sectionIds = (html: string) =>
  [...html.matchAll(/<(?:section|header|article|main)[^>]*id="([^"]+)"/g)].map((m) => m[1]);
const scripts = (html: string) => [...html.matchAll(/<script[^>]*>/g)].map((m) => m[0]);

test.describe('the fleet lane page reports exactly like the page it came from', () => {
  test('every section the journey tracker watches is still there, same ids, same order', () => {
    // closer-analytics.js attributes time to named sections. A missing or renamed id is
    // a blind spot in both the journey data and the Clarity heatmap.
    expect(sectionIds(FLEET)).toEqual(sectionIds(BASE));
    expect(sectionIds(FLEET).length).toBeGreaterThanOrEqual(12);
  });

  test('it loads the same scripts: GA, the pixel, Clarity and the page code', () => {
    expect(scripts(FLEET)).toEqual(scripts(BASE));
  });

  test('it points at the main page as canonical, so the two do not compete', () => {
    expect(FLEET).toContain('<link rel="canonical" href="https://41labs.ai/ai-closer">');
  });

  test('the form is untouched, so a lead lands in the CRM the same way', () => {
    const form = (html: string) => (html.match(/<form[\s\S]*?<\/form>/) || [''])[0];
    expect(form(FLEET)).toBe(form(BASE));
  });
});

test.describe('the fleet lane page says fleet', () => {
  async function open(page: Page, qs = '') {
    await page.route(/connect\.facebook\.net|googletagmanager|clarity\.ms|app\.cal\.com/, (r) => r.abort());
    await page.goto('/ai-closer-fleet.html' + qs);
  }

  test('it opens on the car conversation with no query string at all', async ({ page }) => {
    // The ad carries utm_content, but the page must not depend on it: a stripped or
    // rewritten URL would otherwise show a fleet owner an aircon chat again.
    await open(page);
    expect(await page.locator('.wa-tab.on').getAttribute('data-chat')).toBe('car');
    expect(await page.locator('.wa-slot:not([hidden])').first().getAttribute('data-chat')).toBe('car');
  });

  test('exactly one tab and one conversation are showing', async ({ page }) => {
    await open(page);
    await expect(page.locator('.wa-tab.on')).toHaveCount(1);
    await expect(page.locator('.wa-slot:not([hidden])')).toHaveCount(1);
  });

  test('they can still switch to another business themselves', async ({ page }) => {
    await open(page);
    await page.click('.wa-tab[data-chat="clinic"]');
    expect(await page.locator('.wa-tab.on').getAttribute('data-chat')).toBe('clinic');
  });

  test('the headline and the audience line talk about vehicles, not enquiries in general', async ({ page }) => {
    await open(page);
    await expect(page.locator('h1')).toContainText('booking request');
    await expect(page.locator('.aud')).toContainText('fleets');
  });

  test('the numbers we have not measured for fleets are left alone', () => {
    // The three hero figures and the leak section are measured from real businesses and
    // sourced on the page. A lane may borrow the language. It may not borrow a number.
    const wins = (html: string) => (html.match(/<ul class="hero-wins">[\s\S]*?<\/ul>/) || [''])[0];
    expect(wins(FLEET)).toBe(wins(BASE));
    const leaks = (html: string) => (html.match(/id="proof-1"[\s\S]*?<\/section>/) || [''])[0];
    expect(leaks(FLEET)).toBe(leaks(BASE));
  });
});
