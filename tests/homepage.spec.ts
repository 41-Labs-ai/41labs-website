import { test, expect } from '@playwright/test';

const BOOK_URL = '/ai-closer?utm_source=41labs.ai&utm_medium=organic&utm_campaign=home#qualify';

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
    await expect(heroHeading).toContainText('Every WhatsApp enquiry answered in seconds');
  });

  test('hero names the product and its old name once, plainly', async ({ page }) => {
    await expect(page.locator('.hero')).toContainText('41 Sales Team (formerly 41 Closer)');
  });

  test('hero offers Book a call first and Try it on WhatsApp second', async ({ page }) => {
    const book = page.locator('.hero-cta .btn-primary');
    await expect(book).toBeVisible();
    await expect(book).toContainText('Book a call');
    await expect(book).toHaveAttribute('href', BOOK_URL);
    const tryIt = page.locator('.hero-cta .btn-secondary');
    await expect(tryIt).toContainText('Try it on WhatsApp');
    await expect(tryIt).toHaveAttribute('href', /^https:\/\/wa\.me\/6580124848\?text=/);
    await expect(tryIt).toHaveAttribute('target', '_blank');
  });

  test('every "Book a call" button goes to the booking page in the same tab', async ({ page }) => {
    const books = page.locator('main a', { hasText: 'Book a call' });
    expect(await books.count()).toBeGreaterThanOrEqual(3);
    for (const a of await books.all()) {
      await expect(a).toHaveAttribute('href', BOOK_URL);
      expect(await a.getAttribute('target')).toBeNull();
    }
  });

  test('"What changes for you" shows four wins, each with an icon', async ({ page }) => {
    const section = page.locator('#what-changes');
    await expect(section.locator('h2')).toHaveText('What changes for you');
    const cards = section.locator('.win');
    await expect(cards).toHaveCount(4);
    for (const card of await cards.all()) {
      await expect(card.locator('svg')).toHaveCount(1);
      await expect(card.locator('h3')).toHaveCount(1);
    }
  });

  test('example dashboard is labelled as an example', async ({ page }) => {
    const dash = page.locator('.dash');
    await expect(dash).toBeVisible();
    await expect(dash).toContainText('Example');
    await expect(page.locator('.dash-caption')).toContainText('Example dashboard');
  });

  test('should display social proof stats with their source', async ({ page }) => {
    await expect(page.locator('#the-gap h2')).toHaveText('Most enquiries wait until morning');
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

  test('shows no prices: plans and the payback calculator live on /pricing', async ({ page }) => {
    // The homepage exists to get a booked call. Prices and plan names moved to /pricing.
    await expect(page.locator('#pricing')).toHaveCount(0);
    await expect(page.locator('#payback')).toHaveCount(0);
    const text = await page.locator('main').innerText();
    expect(text).not.toContain('S$');
    for (const plan of ['Starter', 'Scale', 'a month']) expect(text).not.toContain(plan);
    for (const meta of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
      expect(await page.locator(meta).getAttribute('content'), meta).not.toContain('S$');
    }
    // The one price line allowed is the FAQ answer that points to /pricing.
    await expect(page.locator('#faq a[href="/pricing"]')).toHaveCount(1);
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
      '/41-closer', '/ai-operations-admin', '/ai-manager', '/ai-sales-agent-singapore', '/services/ai-consulting', '/blog/what-is-ai-quote-automation', '/blog/ai-automation-services-singapore',
      '/blog/ai-automation-singapore', '/blog/best-ai-consulting-singapore', '/blog/ai-consulting-cost-singapore',
      'locations/singapore.html', '/events', '/industries/construction',
    ]) {
      expect(await main.locator(`a[href="${href}"]`).count(), href).toBeGreaterThan(0);
    }
  });

  test('the old #book-call anchor lands on the final booking band', async ({ page }) => {
    const band = page.locator('#book-call');
    await expect(band.locator('h2')).toHaveText('See your own AI sales team on the call');
    await expect(band.locator('.btn-primary')).toHaveAttribute('href', BOOK_URL);
  });

  test('should display footer with contact info', async ({ page }) => {
    const footer = page.locator('.site-footer');
    await expect(footer).toBeVisible();

    const email = footer.locator('a[href="mailto:alexander@41labs.ai"]');
    await expect(email).toBeVisible();
  });
});
