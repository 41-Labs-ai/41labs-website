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

test.describe('Book a call', () => {
  // The old contact form at #book-call was replaced by the booking band. Old links
  // to /#book-call still land there, and a visitor can book from it.
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#book-call').scrollIntoViewIfNeeded();
  });

  test('the #book-call band has a visible booking button', async ({ page }) => {
    const book = page.locator('#book-call .btn-primary');
    await expect(book).toBeVisible();
    await expect(book).toContainText('Book a call');
    await expect(book).toHaveAttribute('href', '/ai-closer?utm_source=41labs.ai&utm_medium=organic&utm_campaign=home#qualify');
  });
});

test.describe('CTA Buttons', () => {
  test('hero primary CTA books a call in the same tab', async ({ page }) => {
    await page.goto('/');

    const heroCtaLink = page.locator('.hero-cta .btn-primary');
    await expect(heroCtaLink).toHaveAttribute('href', /^\/ai-closer\?.*#qualify$/);
    expect(await heroCtaLink.getAttribute('target')).toBeNull();
  });

  test('hero and CTA-band "Try it on WhatsApp" open WhatsApp in a new tab', async ({ page }) => {
    await page.goto('/');

    for (const sel of ['.hero-cta .btn-secondary', '#book-call .btn-secondary']) {
      const link = page.locator(sel);
      await expect(link).toContainText('Try it on WhatsApp');
      await expect(link).toHaveAttribute('href', /wa\.me\/6580124848\?text=/);
      await expect(link).toHaveAttribute('target', '_blank');
    }
  });
});
