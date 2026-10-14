import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The public onboarding guide (W48-736).
 *
 * The Hermes app already links to https://41labs.ai/get-started-guide and to the
 * anchors below: the WhatsApp invite, the top of Get started, each step, each
 * WhatsApp error and the owner reminders. Renaming an anchor or the address
 * breaks those links in the field, so these tests pin both.
 */

const ANCHORS = [
  'pay', 'fix-declined', 'fix-dropped',
  'whatsapp', 'fix-closed-business', 'fix-closed-number', 'fix-closed-code', 'fix-pin', 'fix-meta-error',
  'keep-the-app',
  'called-in', 'fix-ai-number',
];

const HELP_WHATSAPP = 'https://wa.me/6580124848';

test.describe('Get started guide', () => {
  test('loads at /get-started-guide with a title, description and canonical', async ({ page }) => {
    const res = await page.goto('/get-started-guide');
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toContainText('3 steps');
    expect(await page.title()).toContain('41 Labs');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{50,}/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://41labs.ai/get-started-guide');
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Get Started Guide/);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://41labs.ai/get-started-guide');
  });

  test('every anchor the app links to exists exactly once', async ({ page }) => {
    await page.goto('/get-started-guide');
    for (const id of ANCHORS) {
      await expect(page.locator(`[id="${id}"]`), `#${id}`).toHaveCount(1);
    }
  });

  test('each anchor opens at its section', async ({ page }) => {
    for (const id of ANCHORS) {
      // A fresh load each time: the app opens the guide from outside, never by an in-page hash change.
      await page.goto('about:blank');
      await page.goto(`/get-started-guide#${id}`);
      await expect(page.locator(`[id="${id}"]`), `#${id}`).toBeInViewport();
    }
  });

  test('every Help on WhatsApp button goes to the 41 Labs number', async ({ page }) => {
    await page.goto('/get-started-guide');
    const links = page.getByRole('link', { name: 'Help on WhatsApp', exact: true });
    expect(await links.count()).toBeGreaterThanOrEqual(1);
    for (const href of await links.evaluateAll((els) => els.map((e) => e.getAttribute('href')))) {
      expect(href).toBe(HELP_WHATSAPP);
    }
    await expect(page.locator('#help-whatsapp')).toBeVisible();
  });

  test('every picture has alt text, lazy loading and its real size', async ({ page }) => {
    await page.goto('/get-started-guide');
    const imgs = await page.locator('main img').evaluateAll((els) =>
      els.map((e) => ({
        src: e.getAttribute('src'),
        alt: e.getAttribute('alt') || '',
        loading: e.getAttribute('loading'),
        width: e.getAttribute('width'),
        height: e.getAttribute('height'),
      })),
    );
    expect(imgs.length).toBe(12);
    for (const img of imgs) {
      expect(img.alt.length, img.src!).toBeGreaterThan(20);
      expect(img.loading, img.src!).toBe('lazy');
      expect(Number(img.width), img.src!).toBeGreaterThan(0);
      expect(Number(img.height), img.src!).toBeGreaterThan(0);
    }
    // width/height must match the file, or the page jumps as pictures load.
    for (const img of imgs) {
      const buf = readFileSync(join(__dirname, '..', img.src!.replace(/^\//, '')));
      // VP8 lossy WebP: frame size at bytes 26-29 (14 bits each).
      const w = buf.readUInt16LE(26) & 0x3fff;
      const h = buf.readUInt16LE(28) & 0x3fff;
      expect(`${img.width}x${img.height}`, img.src!).toBe(`${w}x${h}`);
    }
  });

  test('every WhatsApp fix says "usually" or "most often"', async ({ page }) => {
    await page.goto('/get-started-guide');
    for (const id of ['fix-closed-business', 'fix-closed-number', 'fix-closed-code', 'fix-pin', 'fix-meta-error']) {
      const text = (await page.locator(`#${id}`).innerText()).toLowerCase();
      expect(text.includes('usually') || text.includes('most often'), `#${id}`).toBe(true);
    }
  });

  test('nothing scrolls sideways at 375px, even with a long business name and a Chinese name', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/get-started-guide');
    // Worst-case copy from the brief: a long unbroken business name and a Chinese name.
    await page.evaluate(() => {
      const p = document.createElement('p');
      p.id = 'worst-case';
      p.textContent = 'Pick the account for Lim’sHardwareSupplyAndBuildingMaterialsTradingPteLtdJalanBesarBranch, '
        + '林德华五金建材贸易有限公司林德华五金建材贸易有限公司.';
      document.querySelector('#fix-closed-business')!.appendChild(p);
    });
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBe(clientWidth);
    const box = await page.locator('#worst-case').boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  });
});
