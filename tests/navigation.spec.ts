import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  // Desktop nav is hidden behind the menu button on small screens, so pin these
  // to a desktop viewport (the Mobile Navigation block below covers small screens).
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display logo in the header', async ({ page }) => {
    const logo = page.locator('.site-header .site-logo img');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('alt', /41 Sales Team/);
  });

  test('should have top-level navigation items', async ({ page }) => {
    const nav = page.locator('.site-nav');

    await expect(nav.getByRole('link', { name: 'AI Sales Closer' })).toBeVisible();
    await expect(nav.locator('.nav-dd > button', { hasText: 'Solutions' })).toBeVisible();
    await expect(nav.locator('.nav-dd > button', { hasText: 'Industries' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Case studies' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Events' })).toBeVisible();
  });

  test('should have WhatsApp CTA in the header', async ({ page }) => {
    const navCta = page.locator('.site-nav .btn-primary');
    await expect(navCta).toBeVisible();
    await expect(navCta).toContainText('WhatsApp');
    await expect(navCta).toHaveAttribute('href', /wa\.me/);
    await expect(navCta).toHaveAttribute('target', '_blank');
  });

  test('"AI Sales Closer" nav link points to the Closer page', async ({ page }) => {
    const closer = page.locator('.site-nav').getByRole('link', { name: 'AI Sales Closer' });
    await expect(closer).toHaveAttribute('href', /41-closer/);
  });

  test('Case studies nav link navigates to the case studies page', async ({ page }) => {
    await page.locator('.site-nav').getByRole('link', { name: 'Case studies' }).click();
    await expect(page).toHaveURL(/case-studies/);
  });

  test('key homepage sections are present', async ({ page }) => {
    await expect(page.locator('#what-we-do')).toBeAttached();
    await expect(page.locator('#faq')).toBeAttached();
    await expect(page.locator('#book-call')).toBeAttached();
  });
});

test.describe('Mobile Navigation', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should show mobile menu button on small screens', async ({ page }) => {
    await page.goto('/');

    const mobileMenuBtn = page.locator('.nav-toggle');
    await expect(mobileMenuBtn).toBeVisible();
    await expect(mobileMenuBtn).toHaveAttribute('aria-label', /menu/i);
  });

  test('should hide desktop nav links on mobile until the menu opens', async ({ page }) => {
    await page.goto('/');

    const navLinks = page.locator('.site-nav');
    await expect(navLinks).not.toBeVisible();
    await page.locator('.nav-toggle').click();
    await expect(navLinks).toBeVisible();
    await expect(navLinks.getByRole('link', { name: 'AI Sales Closer' })).toBeVisible();
  });
});
