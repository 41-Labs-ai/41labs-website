import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load and display correct title', async ({ page }) => {
    // Brand search ("41 labs") and the money phrase both live in the title.
    await expect(page).toHaveTitle(/41 Labs/);
    await expect(page).toHaveTitle(/WhatsApp AI Sales Agent for Singapore/);
    await expect(page).toHaveTitle(/41 Sales Team/);
  });

  test('should display hero section with main heading', async ({ page }) => {
    const heroHeading = page.locator('.hero h1');
    await expect(heroHeading).toBeVisible();
    await expect(heroHeading).toContainText('An AI sales team on your WhatsApp');
  });

  test('hero names the product and its old name once, plainly', async ({ page }) => {
    await expect(page.locator('.hero')).toContainText('41 Sales Team (formerly 41 Closer)');
  });

  test('should display hero CTA button', async ({ page }) => {
    const ctaButton = page.locator('.hero-cta .btn-primary');
    await expect(ctaButton).toBeVisible();
    await expect(ctaButton).toContainText('WhatsApp');
  });

  test('example dashboard is labelled as an example', async ({ page }) => {
    const dash = page.locator('.dash');
    await expect(dash).toBeVisible();
    await expect(dash).toContainText('Example');
    await expect(page.locator('.dash-caption')).toContainText('Example dashboard');
  });

  test('should display social proof stats with their source', async ({ page }) => {
    const statsSection = page.locator('.proof-grid');
    await expect(statsSection).toBeVisible();
    await expect(page.locator('.proof-item')).toHaveCount(4);
    await expect(page.locator('.home-proof .source-line')).toContainText('Measured from our own systems on 13 September 2026');

    // Every hero stat must be substantiable: no invented proof.
    const statText = (await statsSection.innerText()).toLowerCase();
    for (const banned of ['$2m+', '200+ companies', '100% client retention', '100% production']) {
      expect(statText).not.toContain(banned);
    }
  });

  test('should display "What we do" section with the four AIs', async ({ page }) => {
    const section = page.locator('#what-we-do');
    await expect(section).toBeVisible();
    await expect(section.locator('h2')).toContainText('Four AIs');

    const members = section.locator('.member');
    await expect(members).toHaveCount(4);
    for (const name of ['AI Sales Closer', 'AI Operations Admin', 'AI Manager', 'AI Leads Generator']) {
      await expect(section.locator('.member h3', { hasText: name })).toHaveCount(1);
    }
    // Leads Generator is not built: always "Coming soon", never an example of work.
    const leads = section.locator('.member', { hasText: 'AI Leads Generator' });
    await expect(leads).toContainText('Coming soon');
    await expect(leads.locator('.act')).toHaveCount(0);
  });

  test('should display how it works as an example chat that ends paid', async ({ page }) => {
    const how = page.locator('#how-it-works');
    await expect(how).toBeVisible();
    await expect(how.locator('.example-label')).toContainText('Example chat');
    await expect(how.locator('.paid')).toContainText('Paid');
  });

  test('should display the payback calculator', async ({ page }) => {
    await page.locator('#payback').scrollIntoViewIfNeeded();
    await expect(page.locator('#c-n')).toHaveText('2');
    await page.locator('label[for="pScale"]').click();
    await page.locator('label[for="s2000"]').click();
    await expect(page.locator('#c-n')).toHaveText('3');
    await expect(page.locator('#c-math')).toContainText('S$4,300 a month divided by S$2,000');
  });

  test('should display the five plans', async ({ page }) => {
    const rows = page.locator('#pricing .pt-row');
    await expect(rows).toHaveCount(5);
    for (const price of ['S$299', 'S$690', 'S$1,490', 'S$4,300', 'S$7,900']) {
      await expect(page.locator('#pricing')).toContainText(price);
    }
  });

  test('should display FAQ section', async ({ page }) => {
    const faqSection = page.locator('#faq');
    await expect(faqSection).toBeVisible();

    const faqItems = page.locator('.faq-item');
    expect(await faqItems.count()).toBeGreaterThanOrEqual(5);
  });

  test('visible FAQ matches the FAQPage schema word for word', async ({ page }) => {
    const schema = await page.evaluate(() => {
      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
        const j = JSON.parse(s.textContent || '{}');
        if (j['@type'] === 'FAQPage') return j.mainEntity.map((q: any) => [q.name, q.acceptedAnswer.text]);
      }
      return [];
    });
    const visible = await page.locator('.faq-item').evaluateAll((els) =>
      els.map((d) => [d.querySelector('summary')!.textContent!.trim(), d.querySelector('.faq-answer')!.textContent!.trim()]));
    expect(schema.length).toBeGreaterThanOrEqual(5);
    expect(visible).toEqual(schema);
  });

  test('keeps the in-body links to money pages and guides', async ({ page }) => {
    const main = page.locator('main');
    for (const href of [
      '/41-closer', '/blog/what-is-ai-quote-automation', '/blog/ai-automation-services-singapore',
      '/blog/ai-automation-singapore', '/blog/best-ai-consulting-singapore', '/blog/ai-consulting-cost-singapore',
      'locations/singapore.html', '/events', '/industries/construction',
    ]) {
      expect(await main.locator(`a[href="${href}"]`).count(), href).toBeGreaterThan(0);
    }
  });

  test('should display footer with contact info', async ({ page }) => {
    const footer = page.locator('.site-footer');
    await expect(footer).toBeVisible();

    const email = footer.locator('a[href="mailto:alexander@41labs.ai"]');
    await expect(email).toBeVisible();
  });
});
