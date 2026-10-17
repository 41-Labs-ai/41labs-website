import { test, expect } from '@playwright/test';

test.describe('FAQ Accordion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Scroll to FAQ section
    await page.locator('#faq').scrollIntoViewIfNeeded();
  });

  test('should expand FAQ answer when clicking question', async ({ page }) => {
    const firstQuestion = page.locator('.faq-question').first();
    const firstAnswer = page.locator('.faq-answer').first();

    // Click to expand
    await firstQuestion.click();

    // Answer should be visible (depending on CSS implementation)
    await expect(firstAnswer).toBeVisible();
  });

  test('should close FAQ answer on a second click', async ({ page }) => {
    const firstItem = page.locator('.faq-item').first();
    const firstQuestion = firstItem.locator('.faq-question');

    // Each question is a native <details>; the open state is the toggle.
    await expect(firstItem).not.toHaveAttribute('open', '');
    await firstQuestion.click();
    await expect(firstItem).toHaveAttribute('open', '');
    await firstQuestion.click();
    await expect(firstItem).not.toHaveAttribute('open', '');
    await expect(firstItem.locator('.faq-answer')).not.toBeVisible();
  });
});

test.describe('Contact Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#book-call').scrollIntoViewIfNeeded();
  });

  test('should display contact form', async ({ page }) => {
    const form = page.locator('#contact-form');
    await expect(form).toBeVisible();
  });

  test('should have all required form fields', async ({ page }) => {
    await expect(page.locator('#contact-name')).toBeVisible();
    await expect(page.locator('#contact-email')).toBeVisible();
    await expect(page.locator('#contact-company')).toBeVisible();
    await expect(page.locator('#contact-challenge')).toBeVisible();
    await expect(page.locator('#contact-details')).toBeVisible();
  });

  test('should have submit button', async ({ page }) => {
    const submitBtn = page.locator('#contact-form button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toContainText(/send message/i);
  });

  test('should require name field', async ({ page }) => {
    const nameInput = page.locator('#contact-name');
    await expect(nameInput).toHaveAttribute('required', '');
  });

  test('should require email field', async ({ page }) => {
    const emailInput = page.locator('#contact-email');
    await expect(emailInput).toHaveAttribute('required', '');
    await expect(emailInput).toHaveAttribute('type', 'email');
  });

  test('should require company field', async ({ page }) => {
    const companyInput = page.locator('#contact-company');
    await expect(companyInput).toHaveAttribute('required', '');
  });

  test('should have challenge dropdown options', async ({ page }) => {
    const challengeSelect = page.locator('#contact-challenge');
    const options = challengeSelect.locator('option');

    expect(await options.count()).toBeGreaterThanOrEqual(6);
  });

  test('should allow filling out form', async ({ page }) => {
    await page.fill('#contact-name', 'Test User');
    await page.fill('#contact-email', 'test@example.com');
    await page.fill('#contact-company', 'Test Company');
    await page.selectOption('#contact-challenge', 'slow-quotes');
    await page.fill('#contact-details', 'This is a test message');

    // Verify values are filled
    await expect(page.locator('#contact-name')).toHaveValue('Test User');
    await expect(page.locator('#contact-email')).toHaveValue('test@example.com');
    await expect(page.locator('#contact-company')).toHaveValue('Test Company');
    await expect(page.locator('#contact-challenge')).toHaveValue('slow-quotes');
    await expect(page.locator('#contact-details')).toHaveValue('This is a test message');
  });
});

test.describe('CTA Buttons', () => {
  test('hero primary CTA opens WhatsApp in a new tab', async ({ page }) => {
    await page.goto('/');

    const heroCtaLink = page.locator('.hero-cta .btn-primary');
    await expect(heroCtaLink).toHaveAttribute('href', /wa\.me/);
    await expect(heroCtaLink).toHaveAttribute('target', '_blank');
  });

  test('CTA-section primary button opens WhatsApp in a new tab', async ({ page }) => {
    await page.goto('/');
    await page.locator('#book-call').scrollIntoViewIfNeeded();

    const ctaLink = page.locator('.cta-content .btn-primary');
    await expect(ctaLink).toHaveAttribute('href', /wa\.me/);
    await expect(ctaLink).toHaveAttribute('target', '_blank');
  });
});
