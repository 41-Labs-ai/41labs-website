import { test, expect, Page } from '@playwright/test';

/**
 * Every lead reaches us through WhatsApp, and until now the message arrived with
 * no idea which page or campaign produced it. 781 wa.me links across the site
 * carried zero attribution. GA knew the click happened; the conversation did not.
 *
 * These tests pin both halves: the campaign that brought someone to the site is
 * remembered for the session, and it travels into the WhatsApp message itself.
 */

async function events(page: Page) {
  return page.evaluate(() => {
    const out: any[] = [];
    for (const item of (window as any).dataLayer || []) {
      if (item && item[0] === 'event') out.push({ name: item[1], params: item[2] || {} });
    }
    return out;
  });
}

// Adds a wa.me link, clicks it without navigating, returns the href as it stood
// at click time (after any rewrite) plus the decoded prefilled text.
async function clickWa(page: Page, href = 'https://wa.me/6580124848?text=Hi%20there') {
  return page.evaluate((h) => {
    const a = document.createElement('a');
    a.href = h;
    a.className = 'btn btn-primary';
    a.textContent = 'WhatsApp us';
    a.addEventListener('click', (e) => e.preventDefault());
    document.body.appendChild(a);
    a.click();
    const finalHref = a.href;
    const text = new URL(finalHref).searchParams.get('text') || '';
    return { finalHref, text };
  }, href);
}

const ready = (page: Page) =>
  page.waitForFunction(() => typeof (window as any).gtag === 'function' && !!(window as any).track41);

test.describe('WhatsApp link attribution', () => {
  test('a wa.me link carries the page it was clicked from into the message', async ({ page }) => {
    await page.goto('/blog/wati-alternatives.html');
    await ready(page);
    const { text } = await clickWa(page);
    expect(text).toContain('Hi there');          // the original message survives
    expect(text).toMatch(/wati-alternatives/);   // and now says where it came from
  });

  test('the campaign that brought them to the site travels into the message', async ({ page }) => {
    await page.goto('/index.html?utm_source=meta&utm_medium=paid&utm_campaign=closer_sep');
    await ready(page);
    const { text } = await clickWa(page);
    expect(text).toContain('meta');
  });

  test('first touch survives navigating to another page before clicking', async ({ page }) => {
    await page.goto('/index.html?utm_source=meta&utm_campaign=closer_sep');
    await ready(page);
    await page.goto('/blog/wati-alternatives.html');   // no utm on this URL
    await ready(page);
    const { text } = await clickWa(page);
    expect(text).toContain('meta');
  });

  test('the GA event carries the same source, so GA and WhatsApp agree', async ({ page }) => {
    await page.goto('/index.html?utm_source=meta&utm_medium=paid&utm_campaign=closer_sep');
    await ready(page);
    await clickWa(page);
    const ev = (await events(page)).find((e) => e.name === 'whatsapp_click');
    expect(ev).toBeTruthy();
    expect(ev!.params.utm_source).toBe('meta');
    expect(ev!.params.utm_campaign).toBe('closer_sep');
    expect(ev!.params.page_path).toBeTruthy();
  });

  test('a direct visit still gets the page, and says nothing misleading about source', async ({ page }) => {
    await page.goto('/index.html');
    await ready(page);
    const { text } = await clickWa(page);
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('null');
  });

  test('the reference is appended once, not on every click', async ({ page }) => {
    await page.goto('/blog/wati-alternatives.html');
    await ready(page);
    const first = await clickWa(page);
    const second = await page.evaluate(() => {
      const a = document.querySelector('a.btn.btn-primary[href*="wa.me"]') as HTMLAnchorElement;
      a.click(); a.click();
      return new URL(a.href).searchParams.get('text') || '';
    });
    expect((second.match(/wati-alternatives/g) || []).length).toBe(1);
    expect(first.text).toBeTruthy();
  });

  test('a non-WhatsApp link is left completely alone', async ({ page }) => {
    await page.goto('/index.html?utm_source=meta');
    await ready(page);
    const href = await page.evaluate(() => {
      const a = document.createElement('a');
      a.href = 'https://example.com/pricing?text=hello';
      a.addEventListener('click', (e) => e.preventDefault());
      document.body.appendChild(a); a.click();
      return a.href;
    });
    expect(href).toBe('https://example.com/pricing?text=hello');
  });
});
