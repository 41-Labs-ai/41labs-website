import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should have proper page title', async ({ page }) => {
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    expect(title).toContain('41 Labs');
  });

  test('should have meta description', async ({ page }) => {
    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute('content', /.+/);
  });

  test('should have alt text on logo images', async ({ page }) => {
    const logoImg = page.locator('.site-logo img');
    await expect(logoImg).toHaveAttribute('alt', /41 Sales Team/i);
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    // Should have exactly one h1
    const h1Elements = page.locator('h1');
    await expect(h1Elements).toHaveCount(1);

    // Should have multiple h2 for sections
    const h2Elements = page.locator('h2');
    expect(await h2Elements.count()).toBeGreaterThanOrEqual(5);
  });

  test('should have aria-label on mobile menu button', async ({ page }) => {
    const mobileMenuBtn = page.locator('.nav-toggle');
    await expect(mobileMenuBtn).toHaveAttribute('aria-label', /menu/i);
  });

  test('the #book-call band has a named booking link', async ({ page }) => {
    // The contact form was replaced by a booking button; it must keep a readable name.
    await page.locator('#book-call').scrollIntoViewIfNeeded();
    const book = page.getByRole('link', { name: 'Book a free call' }).last();
    await expect(book).toBeVisible();
    await expect(book).toHaveAttribute('href', '/ai-closer?utm_source=41labs.ai&utm_medium=organic&utm_campaign=home#qualify');
  });

  test('should have descriptive link text for social links', async ({ page }) => {
    const linkedInLink = page.locator('.site-footer a[aria-label*="LinkedIn"]');
    await expect(linkedInLink.first()).toHaveAttribute('aria-label', /linkedin/i);
  });
});

test.describe('Responsive Design', () => {
  test('should display correctly on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Desktop nav should be visible
    const navLinks = page.locator('.site-nav');
    await expect(navLinks).toBeVisible();

    // Mobile menu should be hidden
    const mobileMenuBtn = page.locator('.nav-toggle');
    await expect(mobileMenuBtn).not.toBeVisible();
  });

  test('should display correctly on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    // Content should still be readable
    const heroHeading = page.locator('.hero h1');
    await expect(heroHeading).toBeVisible();
  });

  test('should display correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Hero should be visible
    const heroHeading = page.locator('.hero h1');
    await expect(heroHeading).toBeVisible();

    // Mobile menu button should be visible
    const mobileMenuBtn = page.locator('.nav-toggle');
    await expect(mobileMenuBtn).toBeVisible();
  });
});

test.describe('SEO', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should have Open Graph meta tags', async ({ page }) => {
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute('content', /.+/);

    const ogDescription = page.locator('meta[property="og:description"]');
    await expect(ogDescription).toHaveAttribute('content', /.+/);

    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveAttribute('content', /.+/);
  });

  test('should have Twitter card meta tags', async ({ page }) => {
    const twitterCard = page.locator('meta[name="twitter:card"]');
    await expect(twitterCard).toHaveAttribute('content', /.+/);
  });

  test('should have canonical URL', async ({ page }) => {
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', /41labs\.ai/);
  });

  test('should have structured data (JSON-LD)', async ({ page }) => {
    const jsonLdScripts = page.locator('script[type="application/ld+json"]');
    expect(await jsonLdScripts.count()).toBeGreaterThanOrEqual(1);
  });
});
