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
    // 18 Oct 2026: the H1 says in plain words what the product is and does (the YC pattern).
    await expect(heroHeading).toContainText('Your AI sales team for WhatsApp');
    await expect(heroHeading).toContainText('answers, quotes, books and gets paid');
  });

  test('hero names who it is for and carries one proof number', async ({ page }) => {
    await expect(page.locator('.hero-eyebrow')).toHaveText('For Singapore businesses that sell on WhatsApp');
    await expect(page.locator('.hero-proof')).toContainText('19 seconds median first reply on a live Singapore line.');
  });

  test('hero offers "Book a free call" first and "WhatsApp our AI now" second, each with a line that says what happens', async ({ page }) => {
    const book = page.locator('.hero-cta .btn-primary');
    await expect(book).toBeVisible();
    await expect(book).toHaveText('Book a free call');
    await expect(book).toHaveAttribute('href', BOOK_URL);
    const tryIt = page.locator('.hero-cta .btn-secondary');
    await expect(tryIt).toHaveText('WhatsApp our AI now');
    await expect(tryIt).toHaveAttribute('href', /^https:\/\/wa\.me\/6580124848\?text=/);
    await expect(tryIt).toHaveAttribute('target', '_blank');
    const micro = page.locator('.hero-cta .cta-micro');
    await expect(micro.nth(0)).toHaveText('30 minutes with Alexander. We build your AI before the call. No contract.');
    await expect(micro.nth(1)).toHaveText('It replies in seconds, day or night.');
  });

  test('one main action: "Book a free call" repeats at least 4 times, same words, same link, same tab', async ({ page }) => {
    const books = page.locator('main a.btn-primary');
    expect(await books.count()).toBeGreaterThanOrEqual(4);
    for (const a of await books.all()) {
      await expect(a).toHaveText('Book a free call');
      await expect(a).toHaveAttribute('href', BOOK_URL);
      expect(await a.getAttribute('target')).toBeNull();
    }
    // The old labels are gone everywhere on the page.
    const text = await page.locator('body').innerText();
    for (const old of ['Book a call', 'Try it on WhatsApp']) expect(text).not.toContain(old);
  });

  test('every WhatsApp button says "WhatsApp our AI now" and opens a new tab', async ({ page }) => {
    const wa = page.locator('main a.btn[href*="wa.me/6580124848"]');
    expect(await wa.count()).toBeGreaterThanOrEqual(3);
    for (const a of await wa.all()) {
      await expect(a).toHaveText('WhatsApp our AI now');
      await expect(a).toHaveAttribute('target', '_blank');
    }
  });

  test('sections run in the framework order', async ({ page }) => {
    const ids = await page.locator('main > section').evaluateAll((els) => els.map((e) => e.id));
    expect(ids).toEqual(['', 'trust', 'what-it-does', 'try-it', 'for-you', 'the-gap', 'what-we-do', 'compare', 'live',
      'proof', 'integrations', 'founder', 'risk', 'faq', 'book-call']);
  });

  test('trust strip sits right under the hero with the systems he uses and where we were seen', async ({ page }) => {
    const trust = page.locator('#trust');
    await expect(trust.locator('.trust-label')).toHaveText('Works with what you already use');
    await expect(trust.locator('.trust-logos li')).toHaveCount(8);
    await expect(trust.locator('a[href="#integrations"]')).toContainText('See all integrations');
    await expect(trust).toContainText('Member of the Singapore A.I. Association. Seen at NRF APAC and SuperAI.');
  });

  test('"This is for me" names six trades, each linking to its industry page', async ({ page }) => {
    const sec = page.locator('#for-you');
    await expect(sec.locator('h2')).toHaveText('Built for owners whose customers WhatsApp before they buy');
    const cards = sec.locator('.trade');
    await expect(cards).toHaveCount(6);
    for (const card of await cards.all()) {
      await expect(card.locator('a.go')).toHaveAttribute('href', /^\/industries\/ai-for-.+-singapore$/);
      await expect(card.locator('a.go')).toContainText('See how it works for');
    }
    await expect(sec.locator('a[href="/industries"]')).toHaveText('See all 30 industries');
  });

  test('the problem shows the three choices an owner has today, then the fourth', async ({ page }) => {
    const sec = page.locator('#the-gap');
    await expect(sec.locator('.choice')).toHaveCount(3);
    await expect(sec.locator('.fourth')).toContainText('41 Sales Team is a fourth choice.');
    await expect(sec.locator('a.btn-primary')).toHaveText('Book a free call');
  });

  test('Try it now says exactly what happens in three numbered steps', async ({ page }) => {
    const sec = page.locator('#try-it');
    await expect(sec.locator('h2')).toHaveText('Message our AI the way your customer would');
    const steps = sec.locator('.try-step');
    await expect(steps).toHaveCount(3);
    await expect(steps.nth(0).locator('h3')).toHaveText('Tap "WhatsApp our AI now".');
    await expect(sec.locator('a.btn')).toHaveText('WhatsApp our AI now');
    await expect(sec.locator('.cta-micro')).toHaveText('+65 8012 4848 · We only use your number to reply to you.');
  });

  test('Today vs table has six rows and reads as cards on a phone', async ({ page }) => {
    const table = page.locator('#compare .table-wrap table');
    await expect(table.locator('thead th')).toHaveText(['What happens', 'Today', 'With 41 Sales Team']);
    await expect(table.locator('tbody tr')).toHaveCount(6);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await table.locator('tbody tr').first().evaluate((el) => getComputedStyle(el).display)).toBe('block');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test('integrations block is on the page with live and coming-soon systems', async ({ page }) => {
    const sec = page.locator('#integrations');
    await expect(sec.locator('h2')).toHaveText('Works with what you already use');
    expect(await sec.locator('.int-grid:not(.int-grid-soon) .int-tile').count()).toBeGreaterThanOrEqual(8);
    await expect(sec.locator('.int-grid-soon')).toBeAttached();
  });

  test('what you risk lists the four plain promises', async ({ page }) => {
    await expect(page.locator('#risk .risk')).toHaveText([
      'We build it before you pay, and you test it on the call.',
      'Billing starts the day it goes live.',
      'Month to month. Stop any time with 30 days notice.',
      'No contract and no setup fee.',
    ]);
  });

  test('no horizontal scroll at phone width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test('"What it does for you" lists the eight jobs right under the trust strip, each with an icon', async ({ page }) => {
    const section = page.locator('#what-it-does');
    const jobs = section.locator('.job');
    await expect(jobs).toHaveCount(8);
    for (const job of await jobs.all()) {
      await expect(job.locator('svg')).toHaveCount(1);
      await expect(job.locator('h3')).toHaveCount(1);
    }
    await expect(section.getByRole('link', { name: 'Book a free call' })).toHaveAttribute('href', /utm_campaign=home#qualify/);
  });

  test('example dashboard is labelled as an example', async ({ page }) => {
    const dash = page.locator('.dash');
    await expect(dash).toBeVisible();
    await expect(dash).toContainText('Example');
    await expect(page.locator('.dash-caption')).toContainText('Example dashboard');
  });

  test('should display social proof stats with their source', async ({ page }) => {
    await expect(page.locator('#the-gap h2')).toHaveText('Most enquiries wait until morning');
    await expect(page.locator('#proof h2')).toHaveText('Results from live lines');
    await expect(page.locator('#proof .case-card')).toContainText('$300,000');
    await expect(page.locator('#proof .case-card')).toContainText('of sales every month through the AI Sales Closer at one Singapore industrial supplier');
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
    await expect(leads.locator('a')).toHaveCount(0);
    // Each live AI links to its own page.
    for (const href of ['/41-closer', '/ai-operations-admin', '/ai-manager']) {
      await expect(section.locator(`a.see[href="${href}"]`)).toHaveText('See what it does');
    }
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
    expect(await page.content()).not.toContain('S$');
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
    expect(schema.length).toBe(9);
    expect(visible).toEqual(schema);
    expect(schema.map((q: string[]) => q[0])).toContain('How long does setup take?');
  });

  test('keeps the in-body links to money pages and guides', async ({ page }) => {
    const main = page.locator('main');
    for (const href of [
      '/41-closer', '/ai-operations-admin', '/ai-manager', '/ai-sales-agent-singapore', '/services/ai-consulting', '/blog/what-is-ai-quote-automation', '/blog/ai-automation-services-singapore',
      '/blog/ai-automation-singapore', '/blog/best-ai-consulting-singapore', '/blog/ai-consulting-cost-singapore',
      'locations/singapore.html', '/events', '/industries', '/industries/ai-for-aesthetic-clinics-singapore',
    ]) {
      expect(await main.locator(`a[href="${href}"]`).count(), href).toBeGreaterThan(0);
    }
  });

  test('the old #book-call anchor lands on the final booking band', async ({ page }) => {
    const band = page.locator('#book-call');
    await expect(band.locator('h2')).toHaveText('See your own AI sales team on the call');
    await expect(band.locator('.btn-primary')).toHaveAttribute('href', BOOK_URL);
    await expect(band.locator('.btn-primary')).toHaveText('Book a free call');
    await expect(band.locator('.btn-secondary')).toHaveText('WhatsApp our AI now');
    await expect(band.locator('.cta-micro')).toHaveText(['30 minutes with Alexander. We build your AI before the call. No contract.', 'It replies in seconds, day or night.']);
  });

  test('should display footer with contact info', async ({ page }) => {
    const footer = page.locator('.site-footer');
    await expect(footer).toBeVisible();

    const email = footer.locator('a[href="mailto:alexander@41labs.ai"]');
    await expect(email).toBeVisible();
  });
});
