import { test, expect, Page } from '@playwright/test';

// The 41 Closer ad funnel: /ai-closer (long form, event opt-in style, the ad destination)
// and /ai-closer-sf (short form, split-test variant). Both share ai-closer.js.
// These tests pin the mechanics the numbers model depends on: two-step form, Lead on submit,
// ICP gate to the calendar, UTMs to the CRM, Schedule on booking, free-demo offer, no price.

const QS = '?utm_source=facebook&utm_campaign=41closer_lp_2026-09&utm_content=ad_stalk1&fbclid=abc123';
const PAGES = [
  { name: 'long form', path: '/ai-closer.html', variant: 'long' },
  { name: 'short form', path: '/ai-closer-sf.html', variant: 'sf' },
];

async function stubNetwork(page: Page) {
  const sent: { api: any[]; formspree: number } = { api: [], formspree: 0 };
  await page.route('**/api/closer-lead', async (route) => {
    sent.api.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.route('**/formspree.io/**', async (route) => {
    sent.formspree += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.route(/connect\.facebook\.net|googletagmanager|app\.cal\.com|fonts\.g/, (r) => r.abort());
  return sent;
}

async function stubPixel(page: Page) {
  await page.addInitScript(() => {
    (window as any).__fbq = [];
    (window as any).fbq = (...args: any[]) => (window as any).__fbq.push(args);
  });
}

async function fillContact(page: Page) {
  await page.fill('#cl-name', 'Tan Wei Ming');
  await page.fill('#cl-whatsapp', '+65 9123 4567');
  await page.fill('#cl-website', 'tanaircon.sg');
}

// Step 2. Defaults clear both floors (50 enquiries a week, S$500 a sale) so the
// happy path is the default and a test has to opt in to being rejected.
async function fillQualify(page: Page, opts: { enquiries?: string; saleValue?: string } = {}) {
  await page.selectOption('#cl-enquiries', opts.enquiries || '50to150');
  await page.selectOption('#cl-sale', opts.saleValue || '500to2k');
  await page.check('input[name="challenges"][value="slow"]');
  await page.check('input[name="challenges"][value="afterhours"]');
  await page.selectOption('#cl-goal', 'recover');
}

async function fillForm(page: Page, opts: { enquiries?: string; saleValue?: string } = {}) {
  await fillContact(page);
  await page.click('#cl-next');
  await fillQualify(page, opts);
}

const fbqEvents = (page: Page) =>
  page.evaluate(() => ((window as any).__fbq || []).filter((a: any[]) => a[0] === 'track').map((a: any[]) => a[1]));

for (const P of PAGES) {
  test.describe(P.name, () => {
    test('ad-only: noindex, message-matched "Not just a chatbot", one form, no nav', async ({ page }) => {
      await stubNetwork(page);
      await page.goto(P.path + QS);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      await expect(page.locator('body')).toContainText('Not just a chatbot');
      await expect(page.locator('form')).toHaveCount(1);
      await expect(page.locator('header nav a')).toHaveCount(0);
      await expect(page.locator('body')).toHaveAttribute('data-variant', P.variant);
    });

    test('offer is a free demo; no price anywhere; guarantee matches the SOW', async ({ page }) => {
      await stubNetwork(page);
      await page.goto(P.path);
      const text = await page.locator('body').innerText();
      expect(text).toMatch(/free/i);
      expect(text).not.toContain('9,600');
      expect(text).not.toContain('1,490');
      expect(text).not.toMatch(/setup fee back|money back|refund/i);
    });

    test('house style: no em dashes, no hype words', async ({ page }) => {
      await stubNetwork(page);
      await page.goto(P.path);
      // Our copy only. Verbatim demo chats (proof WhatsApp screens) are product output, quoted word for word.
      const text = await page.evaluate(() => {
        const c = document.body.cloneNode(true) as HTMLElement;
        c.querySelectorAll('.chatfig, #proof-2 .wa').forEach((n) => n.remove());
        return c.innerText;
      });
      expect(text).not.toContain('—');
      for (const w of ['unlock', 'leverage', 'supercharge', 'seamless', 'game-changing', 'revolutionary']) {
        expect(text.toLowerCase()).not.toContain(w);
      }
    });

    test('step 1 collects their details, so an abandoned form is still a lead we can message', async ({ page }) => {
      const sent = await stubNetwork(page);
      await page.goto(P.path);
      // the qualifying questions are NOT on screen yet
      await expect(page.locator('#cl-part1 #cl-enquiries')).toHaveCount(0);
      await page.click('#cl-next');
      await expect(page.locator('#cl-part2')).toBeHidden();   // name/number/website are required
      await fillContact(page);
      await page.click('#cl-next');
      await expect(page.locator('#cl-part2')).toBeVisible();
      await expect(page.locator('#cl-part1')).toBeHidden();
      // and the contact is captured immediately, flagged as incomplete
      await expect.poll(() => sent.api.length).toBe(1);
      expect(sent.api[0]).toMatchObject({ partial: true, name: 'Tan Wei Ming', website: 'tanaircon.sg' });
    });

    test('step 1 asks three things only: name, WhatsApp, website', async ({ page }) => {
      await stubNetwork(page);
      await page.goto(P.path);
      for (const gone of ['#cl-company', '#cl-email', '#cl-role', '#cl-industry']) {
        await expect(page.locator(gone)).toHaveCount(0);
      }
      await expect(page.locator('#cl-name')).toBeVisible();
      await expect(page.locator('#cl-whatsapp')).toBeVisible();
      await expect(page.locator('#cl-website')).toHaveAttribute('required', /.*/);
      await expect(page.locator('#cl-part1')).not.toContainText(/instagram/i);
    });

    test('step 2 is the two qualifying questions plus context, and nothing else', async ({ page }) => {
      await stubNetwork(page);
      await page.goto(P.path);
      await fillContact(page);
      await page.click('#cl-next');
      await expect(page.locator('#cl-enquiries')).toBeVisible();
      await expect(page.locator('#cl-sale')).toBeVisible();
      await expect(page.locator('#cl-goal')).toBeVisible();
      expect(await page.locator('input[name="challenges"]').count()).toBeGreaterThanOrEqual(4);
      // the old gates are gone
      for (const gone of ['#cl-wa', '#cl-after', '#cl-tried']) {
        await expect(page.locator(gone)).toHaveCount(0);
      }
    });

    test('Back returns to the details with them kept', async ({ page }) => {
      await stubNetwork(page);
      await page.goto(P.path);
      await fillContact(page);
      await page.click('#cl-next');
      await page.click('#cl-back');
      await expect(page.locator('#cl-part1')).toBeVisible();
      await expect(page.locator('#cl-name')).toHaveValue('Tan Wei Ming');
    });

    test('submit: the full lead, tier and UTMs to the CRM, updating the step 1 record', async ({ page }) => {
      const sent = await stubNetwork(page);
      await stubPixel(page);
      await page.goto(P.path + QS);
      await fillForm(page, { enquiries: '150plus', saleValue: '2kto10k' });
      await page.click('#cl-submit');
      await expect(page.locator('#cl-step2')).toBeVisible();
      await expect.poll(() => sent.api.length).toBe(2);      // partial, then the full lead
      expect(sent.api[1]).toMatchObject({
        name: 'Tan Wei Ming', whatsapp: '+65 9123 4567', website: 'tanaircon.sg',
        enquiries: '150plus', saleValue: '2kto10k', goal: 'recover',
        challenges: ['slow', 'afterhours'],
        tier: 'A', qualified: 'yes', variant: P.variant,
        utm_campaign: '41closer_lp_2026-09', utm_content: 'ad_stalk1', fbclid: 'abc123',
      });
      expect(sent.api[1].fitReason).toBeTruthy();
      expect(sent.formspree).toBe(1);
      expect(await fbqEvents(page)).toContain('Lead');
    });

    test('clearing both floors books a time and hands off to the AI Closer', async ({ page }) => {
      await stubNetwork(page);
      await page.goto(P.path);
      await fillForm(page);
      await page.click('#cl-submit');
      await expect(page.locator('#cl-book')).toBeVisible();
      await expect(page.locator('#cl-handoff')).toBeVisible();
      await expect(page.locator('#cl-wa-handoff')).toHaveAttribute('href', /wa\.me\/6580124848/);
    });

    test('under 50 enquiries a week is held back, and never handed to the AI Closer', async ({ page }) => {
      const sent = await stubNetwork(page);
      await page.goto(P.path);
      await fillForm(page, { enquiries: 'under20' });
      await page.click('#cl-submit');
      await expect(page.locator('#cl-notyet')).toBeVisible();
      await expect(page.locator('#cl-book')).toBeHidden();
      await expect(page.locator('#cl-handoff')).toBeHidden();
      expect(sent.api[1]).toMatchObject({ qualified: 'no', tier: 'C' });
    });

    test('under S$500 a sale is held back too, however many enquiries', async ({ page }) => {
      const sent = await stubNetwork(page);
      await page.goto(P.path);
      await fillForm(page, { enquiries: '150plus', saleValue: 'under500' });
      await page.click('#cl-submit');
      await expect(page.locator('#cl-notyet')).toBeVisible();
      await expect(page.locator('#cl-handoff')).toBeHidden();
      expect(sent.api[1]).toMatchObject({ qualified: 'no', tier: 'C' });
    });

    test('qualified + Google booking URL: calendar iframe, no fallback', async ({ page }) => {
      await stubNetwork(page);
      await page.route('**/calendar.google.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>cal</p>' }));
      await page.goto(P.path);
      await page.evaluate(() => { (window as any).BOOKING_URL = 'https://calendar.google.com/calendar/appointments/schedules/TEST?gv=true'; });
      await fillForm(page);
      await page.click('#cl-submit');
      await expect(page.locator('#cl-book')).toBeVisible();
      await expect(page.locator('#cl-cal iframe')).toHaveAttribute('src', /appointments\/schedules\/TEST/);
      await expect(page.locator('#cl-cal-fallback')).toBeHidden();
    });

    test('qualified + no booking URL: WhatsApp fallback', async ({ page }) => {
      await stubNetwork(page);
      await page.goto(P.path);
      await page.evaluate(() => { (window as any).BOOKING_URL = ''; });
      await fillForm(page);
      await page.click('#cl-submit');
      await expect(page.locator('#cl-cal-fallback')).toBeVisible();
    });

    test('qualify41 override returning a boolean still routes correctly', async ({ page }) => {
      await stubNetwork(page);
      await page.goto(P.path);
      await page.evaluate(() => { (window as any).qualify41 = () => false; });
      await fillForm(page);
      await page.click('#cl-submit');
      await expect(page.locator('#cl-notyet')).toBeVisible();
    });

    test('visitors can message the AI Closer instead of filling the form', async ({ page }) => {
      await stubNetwork(page);
      await page.goto(P.path);
      const chat = page.locator('a.wa-cta').first();
      await expect(chat).toBeVisible();
      await expect(chat).toHaveAttribute('href', /wa\.me\/6580124848/);
      await expect(chat).toContainText(/closer/i);
    });

    test('a completed booking fires Schedule', async ({ page }) => {
      await stubNetwork(page);
      await stubPixel(page);
      await page.goto(P.path);
      await page.evaluate(() => (window as any).onCloserBooked());
      expect(await fbqEvents(page)).toContain('Schedule');
    });

    test('consent to be contacted on WhatsApp is stated next to the contact details', async ({ page }) => {
      await stubNetwork(page);
      await page.goto(P.path);
      // consent sits with the number we are asking for, which is now step 1
      await expect(page.locator('#cl-part1 .consent')).toBeVisible();
      await expect(page.locator('#cl-part1 .consent')).toContainText(/WhatsApp/);
    });

    test('WhatsApp screens look like WhatsApp: customer view, beige wallpaper, green bubbles right, ticks, input bar', async ({ page }) => {
      await stubNetwork(page);
      await page.goto(P.path);
      const wa = page.locator('.wa').first();
      await expect(wa.locator('.wa-head .wa-name')).not.toHaveText('');
      await expect(wa.locator('.wa-head')).toContainText(/business account|online|typing/i);
      await expect(wa.locator('.wa-input')).toBeVisible();
      const bg = await wa.locator('.wa-body').evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg).toBe('rgb(239, 234, 226)');
      const out = wa.locator('.wa-msg.wa-out').first();
      await expect(out).toHaveCSS('background-color', 'rgb(217, 253, 211)');
      await expect(out.locator('.wa-ticks')).toHaveCount(1);
      const inn = wa.locator('.wa-msg.wa-in').first();
      await expect(inn).toHaveCSS('background-color', 'rgb(255, 255, 255)');
      const [ob, ib] = await Promise.all([out.boundingBox(), inn.boundingBox()]);
      expect(ob!.x + ob!.width).toBeGreaterThan(ib!.x + ib!.width); // customer bubbles sit on the right
    });
  });
}

test.describe('long form follows the event opt-in structure', () => {
  test('sections appear in his order', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/ai-closer.html');
    const ids = await page.locator('main > section[id]').evaluateAll((els) => els.map((e) => e.id));
    const order = ['hero', 'seen', 'numbers', 'get', 'proof-1', 'letter', 'proof-2', 'different', 'why', 'money', 'weeks', 'guarantee', 'fit', 'before-after', 'why-now', 'faq', 'final'];
    const found = order.filter((id) => ids.includes(id));
    expect(found).toEqual(order);
    expect(ids.filter((id) => order.includes(id))).toEqual(order);
  });

  test('every CTA button goes back to the form (his 12-button pattern)', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/ai-closer.html');
    const ctas = page.locator('a.btn-cta');
    const n = await ctas.count();
    expect(n).toBeGreaterThanOrEqual(4);
    expect(n).toBeLessThanOrEqual(6);
    const hrefs = await ctas.evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    expect(new Set(hrefs)).toEqual(new Set(['#qualify']));
    const labels = await ctas.evaluateAll((els) => els.map((e) => e.textContent!.replace(/\s+/g, ' ').trim().toLowerCase()));
    expect(new Set(labels).size).toBe(1); // one verb, repeated
    await expect(page.locator('#stack')).toHaveCount(0); // the free-item value stack belongs to a ticket page
  });

  test('the founder letter is signed and uses the real stage photo', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/ai-closer.html');
    await expect(page.locator('#letter')).toContainText('Dear fellow business owner');
    await expect(page.locator('#letter')).toContainText('Alexander Lee');
    await expect(page.locator('#letter img')).toHaveAttribute('src', /lp-founder-letter\.webp/);
  });

  test('leak calculator updates the monthly figure', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/ai-closer.html');
    await page.fill('[name=lc-enq]', '100');
    await page.fill('[name=lc-late]', '30');
    await page.fill('[name=lc-sale]', '500');
    await page.fill('[name=lc-close]', '20');
    // 100 x 4.3 x 30% x 20% x 500 = S$12,900 a month
    await expect(page.locator('[data-out=lost]')).toHaveText('S$12,900');
  });

  test('clicking a CTA brings the form into view', async ({ page }) => {
    await stubNetwork(page);
    await page.emulateMedia({ reducedMotion: 'reduce' }); // instant jump, no smooth-scroll race under parallel load
    await page.goto('/ai-closer.html');
    await page.locator('#faq a.btn-cta').first().click();
    await expect(page.locator('#cl-name')).toBeInViewport();
  });

  test('"Seen at" strip reuses the homepage logos, no role captions', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/ai-closer.html');
    const srcs = await page.locator('#seen .seen-row img').evaluateAll((els) => els.map((e) => e.getAttribute('src')));
    expect(srcs).toEqual(['/logos/saia.png', '/logos/nrf.jpg', '/logos/superai.jpg', '/logos/stripe.png']);
    await expect(page.locator('#seen')).not.toContainText(/chair|day 3|pitch/i);
  });

  test('proof gallery: 6 to 9 short WhatsApp screens, each labelled, none scrolling', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/ai-closer.html');
    const cards = page.locator('#proof-2 .wa');
    const n = await cards.count();
    expect(n).toBeGreaterThanOrEqual(6);
    expect(n).toBeLessThanOrEqual(9);
    expect(await page.locator('#proof-2 .chatcap-top').count()).toBe(n);
    // every screen fits without an inner scrollbar
    const scrolls = await page.locator('#proof-2 .wa-body').evaluateAll((els) =>
      els.map((e) => e.scrollHeight - e.clientHeight));
    expect(Math.max(...scrolls)).toBeLessThanOrEqual(1);
    // each card says where it came from
    const srcs = await page.locator('#proof-2 .chat-src').allInnerTexts();
    expect(srcs.every((t) => /demo line|example/i.test(t))).toBe(true);
  });

  test('mobile: the first form question is reachable within two screens', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile only');
    await stubNetwork(page);
    await page.goto('/ai-closer.html');
    const box = await page.locator('#cl-name').boundingBox();
    const vh = page.viewportSize()!.height;
    expect(box!.y).toBeLessThan(vh * 2);
  });

  test('hero chat switches by industry so it is not one trade only', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/ai-closer.html');
    const tabs = page.locator('#hero .wa-tab');
    expect(await tabs.count()).toBeGreaterThanOrEqual(4);
    const first = await page.locator('#hero .wa-live .wa-msg').first().innerText();
    await tabs.nth(2).click();
    await expect(tabs.nth(2)).toHaveClass(/on/);
    const after = await page.locator('#hero .wa-live .wa-msg').first().innerText();
    expect(after).not.toBe(first);
  });

  test('"Built on" strip shows the platforms we actually run on', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/ai-closer.html');
    const alts = await page.locator('#seen .built img').evaluateAll((els) => els.map((e) => e.getAttribute('alt')));
    expect(alts.join(' ').toLowerCase()).toContain('whatsapp');
    expect(alts.length).toBeGreaterThanOrEqual(4);
  });

  test('counted proof strip, with the measurement stated and no stale SKU claim', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/ai-closer.html');
    expect(await page.locator('#numbers .stat').count()).toBeGreaterThanOrEqual(3);
    await expect(page.locator('#numbers')).toContainText('45,355');
    await expect(page.locator('#numbers .stats-note')).toContainText(/measured/i);
    // 42,000 SKUs was a deprecated index; the live catalogue is 12,868
    const text = await page.locator('body').innerText();
    expect(text).not.toContain('42,000');
    expect(text).toContain('12,868');
  });

  // build_ai_closer.py replaces up to the first </form>, but FORM ends with the CTA
  // AFTER that tag, so every run left the previous copy behind and stacked another.
  for (const p of ['/ai-closer.html', '/ai-closer-sf.html']) {
    test(`${p}: the "try it on WhatsApp" line appears once, not once per build run`, async ({ page }) => {
      await stubNetwork(page);
      await page.goto(p);
      expect(await page.locator('.wa-cta-line').count()).toBe(1);
    });
  }

  // We build the preview and show it on the call. We do not hand over a working
  // Closer, so the page must not promise one. What they genuinely keep is the maths.
  test('the page never promises to hand over the demo itself', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/ai-closer.html');
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/keep the demo/i);
    expect(text).toMatch(/keep the numbers/i);
  });

  // scripts/build_ai_closer.py builds the form with an f-string. Over-escaping the
  // braces once emitted literal {SELECT_PH} and {opt(...)} into two required selects,
  // which would have made the form unsubmittable. Never again, silently.
  for (const p of ['/ai-closer.html', '/ai-closer-sf.html']) {
    test(`${p}: no unrendered generator placeholder reaches the page`, async ({ page }) => {
      await stubNetwork(page);
      await page.goto(p);
      const html = await page.content();
      for (const ghost of ['SELECT_PH', 'FORM_CTA', 'ENQ_OPTS', 'SALE_OPTS', 'GOAL_OPTS', 'CHALLENGE_CHIPS', '{opt(']) {
        expect(html, `${ghost} leaked into ${p}`).not.toContain(ghost);
      }
      // and the selects really do carry options, not a placeholder string
      expect(await page.locator('#cl-sale option').count()).toBeGreaterThanOrEqual(5);
      expect(await page.locator('#cl-enquiries option').count()).toBeGreaterThanOrEqual(5);
    });
  }

  test('differentiation block states the three wedges', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/ai-closer.html');
    const d = page.locator('#different');
    await expect(d).toContainText(/12,868 live products/);      // connected to their systems
    await expect(d).toContainText(/Nothing to learn/i);          // done for you
    await expect(d).toContainText(/S\$20,000 in booked sales/);  // money on the result
    await expect(page.locator('#faq')).toContainText(/different from the WhatsApp tools/i);
    await expect(page.locator('#hero .hero-sub')).toContainText(/don't hand you a chatbot/i);
  });
});
