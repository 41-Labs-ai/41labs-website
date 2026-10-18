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

    await expect(nav.locator('.nav-dd > button', { hasText: 'Your AI team' })).toBeVisible();
    await expect(nav.locator('.nav-dd > button', { hasText: 'Solutions' })).toBeVisible();
    await expect(nav.locator('.nav-dd > button', { hasText: 'Industries' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Case studies' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Events' })).toBeVisible();
  });

  // 18 Oct 2026: the sticky header carries the main action, a booked call (every top US site does).
  // WhatsApp stays one tap away through the floating button.
  test('header main button books a call, WhatsApp stays one tap away', async ({ page }) => {
    const navCta = page.locator('.site-nav .btn-primary');
    await expect(navCta).toBeVisible();
    await expect(navCta).toHaveText('Book a free call');
    await expect(navCta).toHaveAttribute('href', /\/ai-closer\?.*utm_campaign=header#qualify/);
    await expect(page.locator('a.wa-float')).toHaveAttribute('href', /wa\.me/);
  });

  test('"Your AI team" menu links each live AI to its page', async ({ page }) => {
    // The links sit in a closed dropdown, so they are checked by href rather than by visible role.
    const team = page.locator('.site-nav .nav-dd', { hasText: 'Your AI team' });
    await expect(team.locator('a[href="/41-closer"]')).toHaveText('AI Sales Closer');
    await expect(team.locator('a[href="/ai-operations-admin"]')).toHaveText('AI Operations Admin');
    await expect(team.locator('a[href="/ai-manager"]')).toHaveText('AI Manager');
    // Not built yet, so it is named but never linked.
    await expect(team.locator('a', { hasText: 'Leads Generator' })).toHaveCount(0);
    await expect(team).toContainText('Coming soon');
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
    await expect(navLinks.locator('.nav-dd > button', { hasText: 'Your AI team' })).toBeVisible();
  });
});
