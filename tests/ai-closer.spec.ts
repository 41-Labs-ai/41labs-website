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
  await page.fill('#cl-email', 'wm@tanaircon.sg');
  await page.fill('#cl-whatsapp', '+6591234567');
}

// Step 2. Defaults clear both floors (50 enquiries a week, S$500 a sale) so the
// happy path is the default and a test has to opt in to being rejected.
async function fillQualify(page: Page, opts: { enquiries?: string; saleValue?: string; website?: string } = {}) {
  await page.fill('#cl-website', opts.website ?? 'tanaircon.sg');
  await page.selectOption('#cl-enquiries', opts.enquiries || '50to150');
  await page.selectOption('#cl-sale', opts.saleValue || '500to2k');
  await page.check('input[name="challenges"][value="slow"]');
  await page.check('input[name="challenges"][value="afterhours"]');
  await page.selectOption('#cl-goal', 'recover');
}

async function fillForm(page: Page, opts: { enquiries?: string; saleValue?: string; website?: string } = {}) {
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
      await expect(page.locator('#cl-email')).toBeVisible();
      await page.click('#cl-next');
      await expect(page.locator('#cl-part2')).toBeHidden();   // name/number/website are required
      await fillContact(page);
      await page.click('#cl-next');
      await expect(page.locator('#cl-part2')).toBeVisible();
      await expect(page.locator('#cl-part1')).toBeHidden();
      // and the contact is captured immediately, flagged as incomplete
      await expect.poll(() => sent.api.length).toBe(1);
      expect(sent.api[0]).toMatchObject({ partial: true, name: 'Tan Wei Ming', email: 'wm@tanaircon.sg' });
    });

    test('step 1 asks who they are: name, email, number, and nothing else', async ({ page }) => {
      await stubNetwork(page);
      await page.goto(P.path);
      for (const gone of ['#cl-company', '#cl-role', '#cl-industry']) {
        await expect(page.locator(gone)).toHaveCount(0);
      }
      await expect(page.locator('#cl-name')).toBeVisible();
      await expect(page.locator('#cl-email')).toBeVisible();
      await expect(page.locator('#cl-whatsapp')).toBeVisible();
      await expect(page.locator('#cl-part1 #cl-website')).toHaveCount(0);   // the business comes in step 2
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
        name: 'Tan Wei Ming', whatsapp: '+6591234567', website: 'tanaircon.sg',
        enquiries: '150plus', saleValue: '2kto10k', goal: 'recover',
        challenges: ['slow', 'afterhours'],
        tier: 'A', qualified: 'yes', variant: P.variant,
        utm_campaign: '41closer_lp_2026-09', utm_content: 'ad_stalk1', fbclid: 'abc123',
      });
      expect(sent.api[1].fitReason).toBeTruthy();
      expect(await fbqEvents(page)).toContain('Lead');
    });

    // The booking is the whole point of the page. There is no WhatsApp handoff beside
    // it any more: asking someone to message us "can we set up a time" ten seconds after
    // they set up a time read as a page that had not noticed what they just did.
    test('clearing both floors books a time, with nothing competing beside the calendar', async ({ page }) => {
      await stubNetwork(page);
      await page.goto(P.path);
      await fillForm(page);
      await page.click('#cl-submit');
      await expect(page.locator('#cl-book')).toBeVisible();
      await expect(page.locator('#cl-cal-head')).toBeVisible();
      expect(await page.locator('a[href*="wa.me"]').count(), 'no WhatsApp CTA on the booking screen').toBe(0);
    });

    // Nobody is turned away any more: everyone books and the tier carries the judgement.
    test('a small business still books, and is filed as tier C', async ({ page }) => {
      const sent = await stubNetwork(page);
      await page.goto(P.path);
      await fillForm(page, { enquiries: 'under20', saleValue: 'under500' });
      await page.click('#cl-submit');
      await expect(page.locator('#cl-book')).toBeVisible();
      await expect(page.locator('#cl-notyet')).toBeHidden();
      await expect.poll(() => sent.api.length).toBe(2);
      expect(sent.api[1]).toMatchObject({ qualified: 'yes', tier: 'C' });
    });

    test('the low-volume, high-ticket business the old rule threw out now books as B', async ({ page }) => {
      const sent = await stubNetwork(page);
      await page.goto(P.path);
      await fillForm(page, { enquiries: '20to50', saleValue: '2kto10k' });
      await page.click('#cl-submit');
      await expect(page.locator('#cl-book')).toBeVisible();
      await expect.poll(() => sent.api.length).toBe(2);
      expect(sent.api[1]).toMatchObject({ qualified: 'yes', tier: 'B' });
    });

    test('a qualified lead gets the Cal.com embed, not a Google iframe', async ({ page }) => {
      await stubNetwork(page);
      await page.route('**/app.cal.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
      await page.goto(P.path);
      await fillForm(page);
      await page.click('#cl-submit');
      await expect(page.locator('#cl-cal-head')).toBeVisible();
      await expect(page.locator('#cl-cal iframe[src*="calendar.google.com"]')).toHaveCount(0);
      const queued = await page.evaluate(() => (((window as any).Cal || {}).q || []).some((a: any) => a[0] === 'inline'));
      expect(queued, 'the Cal.com inline embed was never requested').toBe(true);
    });

    test('qualified + no booking URL: we promise times, rather than show an empty calendar', async ({ page }) => {
      await stubNetwork(page);
      await page.goto(P.path);
      await page.evaluate(() => { (window as any).BOOKING_URL = ''; });
      await fillForm(page);
      await page.click('#cl-submit');
      await expect(page.locator('#cl-cal-fallback')).toBeVisible();
      await expect(page.locator('#cl-cal-head')).toBeHidden();
      await expect(page.locator('#cl-cal-fallback')).toContainText(/one working day/i);
    });

    test('qualify41 override returning a boolean still routes correctly', async ({ page }) => {
      await stubNetwork(page);
      await page.goto(P.path);
      await page.evaluate(() => { (window as any).qualify41 = () => false; });
      await fillForm(page);
      await page.click('#cl-submit');
      await expect(page.locator('#cl-notyet')).toBeVisible();
    });


    test('a completed booking fires Schedule', async ({ page }) => {
      await stubNetwork(page);
      await stubPixel(page);
      await page.goto(P.path);
      await page.evaluate(() => (window as any).onCloserBooked());
      expect(await fbqEvents(page)).toContain('Schedule');
    });

    // The consent paragraph came off at Alexander's request. We still collect a number
    // and message it, so the field itself has to say so.
    test('the WhatsApp field says what we will do with the number', async ({ page }) => {
      await stubNetwork(page);
      await page.goto(P.path);
      const help = page.locator('#cl-whatsapp ~ .help');
      await expect(help).toBeVisible();
      await expect(help).toContainText(/closer|whatsapp|conversation/i);
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
    const order = ['hero', 'seen', 'numbers', 'get', 'proof-1', 'letter', 'proof-2', 'different', 'why', 'money', 'guarantee', 'fit', 'before-after', 'why-now', 'faq', 'final'];
    const found = order.filter((id) => ids.includes(id));
    expect(found).toEqual(order);
    expect(ids.filter((id) => order.includes(id))).toEqual(order);
  });

  // Alexander's call: a CTA after every major section. The research said 4 to 5 and his
  // own read of the page says more, so the test pins what actually matters instead of
  // the count: one verb, one destination, never a competing offer.
  test('every CTA uses one verb and goes back to the form', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/ai-closer.html');
    const ctas = page.locator('a.btn-cta');
    const n = await ctas.count();
    expect(n).toBeGreaterThanOrEqual(8);
    const hrefs = await ctas.evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    expect(new Set(hrefs)).toEqual(new Set(['#qualify']));
    const words = await ctas.allInnerTexts();
    for (const w of words) expect(w.trim().toLowerCase()).toMatch(/^get my free demo/);
  });

  // The escape hatch under the form is gone: it offered a way out at the exact moment
  // we are asking for their details.
  test('the form offers no alternative to filling it in', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/ai-closer.html');
    expect(await page.locator('.wa-cta-line').count()).toBe(0);
    await expect(page.locator('#cl-part1')).not.toContainText(/prefer to just try it/i);
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
    await expect(page.locator('#hero .hero-sub')).toContainText(/run it for you/i);
  });
});

// With no BOOKING_URL the qualified screen used to read "Pick a time" above an
// empty space and then "we'll WhatsApp you instead". That is the single
// highest-intent moment in the funnel; it must not contradict itself.
test.describe('the qualified screen when no calendar is configured', () => {
  test('does not invite them to pick a time when there is nothing to pick', async ({ page }) => {
    const sent = { api: [] as any[] };
    await page.route('**/api/closer-lead', (r) => {
      sent.api.push(JSON.parse(r.request().postData() || '{}'));
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.route('**/formspree.io/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route(/connect\.facebook\.net|googletagmanager|app\.cal\.com|fonts\.g/, (r) => r.abort());
    await page.goto('/ai-closer.html');
    await page.evaluate(() => { (window as any).BOOKING_URL = ''; });

    await page.fill('#cl-name', 'Tan Wei Ming');
    await page.fill('#cl-email', 'wm@tanaircon.sg');
    await page.fill('#cl-whatsapp', '+6591234567');
    await page.click('#cl-next');
    await page.fill('#cl-website', 'tanaircon.sg');
    await page.selectOption('#cl-enquiries', '50to150');
    await page.selectOption('#cl-sale', '500to2k');
    await page.check('input[name="challenges"][value="slow"]');
    await page.selectOption('#cl-goal', 'recover');
    await page.click('#cl-submit');

    await expect(page.locator('#cl-book')).toBeVisible();
    await expect(page.locator('#cl-cal-head')).toBeHidden();     // no "Pick a time"
    await expect(page.locator('#cl-cal-fallback')).toBeVisible();  // we say what happens next
    await expect(page.locator('#cl-cal-fallback')).toContainText(/one working day/i);
  });
});


// The website drives the preview build, so free text here costs a real build.
test.describe('the website field only accepts a website', () => {
  const open2 = async (page: any) => {
    await page.route('**/api/closer-lead', (r: any) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"id":"x"}' }));
    await page.route('**/formspree.io/**', (r: any) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route(/connect\.facebook\.net|googletagmanager|app\.cal\.com|fonts\.g/, (r: any) => r.abort());
    await page.goto('/ai-closer.html');
    await page.fill('#cl-name', 'Tan Wei Ming');
    await page.fill('#cl-email', 'wm@tanaircon.sg');
    await page.fill('#cl-whatsapp', '+6591234567');
    await page.click('#cl-next');
  };

  for (const bad of ['my company', 'aircon servicing singapore', 'facebook', '@tanaircon', 'https://', 'tan aircon .sg']) {
    test(`rejects "${bad}"`, async ({ page }) => {
      await open2(page);
      await page.fill('#cl-website', bad);
      await page.selectOption('#cl-enquiries', '50to150');
      await page.selectOption('#cl-sale', '500to2k');
      await page.check('input[name="challenges"][value="slow"]');
      await page.selectOption('#cl-goal', 'recover');
      await page.click('#cl-submit');
      await expect(page.locator('#cl-website-error')).toBeVisible();
      await expect(page.locator('#cl-step2')).toBeHidden();
    });
  }

  for (const good of ['tanaircon.sg', 'www.tanaircon.sg', 'https://tanaircon.sg', 'https://tanaircon.com.sg/aircon-servicing']) {
    test(`accepts "${good}"`, async ({ page }) => {
      await open2(page);
      await page.fill('#cl-website', good);
      await page.selectOption('#cl-enquiries', '50to150');
      await page.selectOption('#cl-sale', '500to2k');
      await page.check('input[name="challenges"][value="slow"]');
      await page.selectOption('#cl-goal', 'recover');
      await page.click('#cl-submit');
      await expect(page.locator('#cl-website-error')).toBeHidden();
      await expect(page.locator('#cl-book')).toBeVisible();
    });
  }

  test('tidies a stray @ or spaces instead of scolding them', async ({ page }) => {
    await open2(page);
    await page.fill('#cl-website', '  @tanaircon.sg ');
    await page.selectOption('#cl-enquiries', '50to150');
    await page.selectOption('#cl-sale', '500to2k');
    await page.check('input[name="challenges"][value="slow"]');
    await page.selectOption('#cl-goal', 'recover');
    await page.click('#cl-submit');
    await expect(page.locator('#cl-website')).toHaveValue('tanaircon.sg');
    await expect(page.locator('#cl-book')).toBeVisible();
  });
});

// Booking the call is the single action on this screen. Nothing sits beside it.
test.describe('a qualified lead is sent to the calendar', () => {
  test('the Cal.com embed is requested, and it is the only thing on offer', async ({ page }) => {
    await page.route('**/api/closer-lead', (r: any) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"id":"deal-1"}' }));
    await page.route('**/api/meta-event', (r: any) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    await page.route('**/formspree.io/**', (r: any) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/app.cal.com/**', (r: any) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.route(/connect\.facebook\.net|googletagmanager|fonts\.g/, (r: any) => r.abort());
    await page.goto('/ai-closer.html');
    await page.fill('#cl-name', 'Tan Wei Ming');
    await page.fill('#cl-email', 'wm@tanaircon.sg');
    await page.fill('#cl-whatsapp', '+6591234567');
    await page.click('#cl-next');
    await page.fill('#cl-website', 'tanaircon.sg');
    await page.selectOption('#cl-enquiries', '150plus');
    await page.selectOption('#cl-sale', '2kto10k');
    await page.check('input[name="challenges"][value="slow"]');
    await page.selectOption('#cl-goal', 'recover');
    await page.click('#cl-submit');

    await expect(page.locator('#cl-cal-head')).toBeVisible();
    const queued = await page.evaluate(() => (((window as any).Cal || {}).q || []).some((a: any) => a[0] === 'inline'));
    expect(queued).toBe(true);
    // The Cal.com config carries what they typed, so nothing is retyped in the booking.
    const cfg = await page.evaluate(() => (((window as any).Cal || {}).q || []).find((a: any) => a[0] === 'inline')?.[1]?.config);
    expect(cfg.notes).toContain('tanaircon.sg');
    expect(cfg.email).toBe('wm@tanaircon.sg');
    expect(await page.locator('a[href*="wa.me"]').count(), 'nothing competes with the booking').toBe(0);
  });
});

// Contract: 41closer-marketing/ads/2026-09-batch/CONVERSION-TRACKING-SPEC.md.
// Every conversion must fire on BOTH sides with the SAME id. If the ids ever diverge,
// Meta counts one conversion as two and every cost-per-booked-call figure halves.
test.describe('Meta conversions fire from both sides with one id', () => {
  async function setup(page: any) {
    const api: any[] = [];
    await page.route('**/api/closer-lead', (r: any) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"id":"x"}' }));
    await page.route('**/api/meta-event', (r: any) => {
      api.push(JSON.parse(r.request().postData() || '{}'));
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.route('**/formspree.io/**', (r: any) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/app.cal.com/**', (r: any) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.route(/connect\.facebook\.net|googletagmanager|app\.cal\.com|fonts\.g/, (r: any) => r.abort());
    await page.addInitScript(() => {
      (window as any).__fbq = [];
      (window as any).fbq = (...a: any[]) => (window as any).__fbq.push(a);
    });
    return api;
  }

  const pixelCall = (page: any, name: string) =>
    page.evaluate((n: string) => ((window as any).__fbq || []).find((a: any[]) => a[0] === 'track' && a[1] === n), name);

  test('InitiateCheckout fires when the calendar opens, on both sides, same id', async ({ page }) => {
    const api = await setup(page);
    await page.goto('/ai-closer.html');
    await page.fill('#cl-name', 'Tan Wei Ming');
    await page.fill('#cl-email', 'wm@tanaircon.sg');
    await page.fill('#cl-whatsapp', '+6591234567');
    await page.click('#cl-next');
    await page.fill('#cl-website', 'tanaircon.sg');
    await page.selectOption('#cl-enquiries', '50to150');
    await page.selectOption('#cl-sale', '500to2k');
    await page.check('input[name="challenges"][value="slow"]');
    await page.selectOption('#cl-goal', 'recover');
    await page.click('#cl-submit');

    await expect.poll(async () => page.evaluate(() =>
      ((((window as any).Cal || {}).q) || []).some((a: any) => a[0] === 'inline')), { timeout: 8000 }).toBe(true);
    const px = await pixelCall(page, 'InitiateCheckout');
    expect(px, 'pixel InitiateCheckout').toBeTruthy();
    await expect.poll(() => api.filter((e) => e.name === 'InitiateCheckout').length).toBe(1);
    const srv = api.find((e) => e.name === 'InitiateCheckout');
    expect(srv.eventId).toBe(px[3].eventID);              // the dedup key
    expect(srv.email).toBe('wm@tanaircon.sg');            // advanced matching
    expect(srv.phone).toBe('+6591234567');
    expect(srv.sourceUrl).toContain('/ai-closer');
  });

  // The one that matters. api/cron/booking-sync.js sends Schedule for the same booking
  // with the deterministic id schedule_<opportunityId>. If the browser mints a random
  // uuid instead, the two never deduplicate and Meta counts one booked call as two,
  // which halves every cost-per-booking figure. So the browser MUST use the same key.
  test('a real Cal.com booking uses the same id the cron will send, not a fresh uuid', async ({ page }) => {
    const api = await setup(page);
    await page.goto('/ai-closer.html');
    await page.fill('#cl-name', 'Tan Wei Ming');
    await page.fill('#cl-email', 'wm@tanaircon.sg');
    await page.fill('#cl-whatsapp', '+6591234567');
    await page.click('#cl-next');
    await page.fill('#cl-website', 'tanaircon.sg');
    await page.selectOption('#cl-enquiries', '150plus');
    await page.selectOption('#cl-sale', '2kto10k');
    await page.check('input[name="challenges"][value="slow"]');
    await page.selectOption('#cl-goal', 'recover');
    await page.click('#cl-submit');

    // Fire it the way Cal.com does: through the callback the page registered, with no
    // arguments. Calling onCloserBooked('schedule_x') by hand would prove nothing.
    await expect.poll(async () => page.evaluate(() =>
      ((((window as any).Cal || {}).q) || []).some((a: any) =>
        a[0] === 'on' && a[1] && a[1].action === 'bookingSuccessful')), { timeout: 8000 }).toBe(true);
    await page.evaluate(() => {
      const entry = (((window as any).Cal || {}).q || []).find((a: any) =>
        a[0] === 'on' && a[1] && a[1].action === 'bookingSuccessful');
      entry[1].callback({});
    });

    const px = await pixelCall(page, 'Schedule');
    expect(px, 'pixel Schedule').toBeTruthy();
    await expect.poll(() => api.filter((e) => e.name === 'Schedule').length).toBe(1);
    const srv = api.find((e) => e.name === 'Schedule');
    expect(srv.eventId, 'browser and server must agree').toBe(px[3].eventID);
    // /api/closer-lead was stubbed to return id "x".
    expect(px[3].eventID, 'must be the deal-derived key the cron also uses').toBe('schedule_x');
  });

  test('Schedule fires from the browser too, so it can deduplicate', async ({ page }) => {
    const api = await setup(page);
    await page.goto('/ai-closer.html');
    await page.evaluate(() => (window as any).onCloserBooked());
    const px = await pixelCall(page, 'Schedule');
    expect(px).toBeTruthy();
    await expect.poll(() => api.filter((e) => e.name === 'Schedule').length).toBe(1);
    expect(api.find((e) => e.name === 'Schedule').eventId).toBe(px[3].eventID);
  });

  // Cal.com renders its own confirmation (time, Meet link, the notes we passed) inside
  // the embed, so the page must not add a second competing call to action underneath it.
  test('confirming the booking leaves no WhatsApp CTA behind', async ({ page }) => {
    await setup(page);
    await page.goto('/ai-closer.html');
    await page.fill('#cl-name', 'Tan Wei Ming');
    await page.fill('#cl-email', 'wm@tanaircon.sg');
    await page.fill('#cl-whatsapp', '+6591234567');
    await page.click('#cl-next');
    await page.fill('#cl-website', 'tanaircon.sg');
    await page.selectOption('#cl-enquiries', '150plus');
    await page.selectOption('#cl-sale', '2kto10k');
    await page.check('input[name="challenges"][value="slow"]');
    await page.selectOption('#cl-goal', 'recover');
    await page.click('#cl-submit');

    await expect(page.locator('#cl-cal-head')).toBeVisible();
    await page.evaluate(() => (window as any).onCloserBooked());
    expect(await page.locator('a[href*="wa.me"]').count()).toBe(0);
  });

  test('ViewContent fires once the demo has been on screen a while', async ({ page }) => {
    const api = await setup(page);
    await page.goto('/ai-closer.html');
    await page.locator('.vbox').scrollIntoViewIfNeeded();
    await expect.poll(() => api.filter((e) => e.name === 'ViewContent').length, { timeout: 8000 }).toBe(1);
    const px = await pixelCall(page, 'ViewContent');
    expect(api.find((e) => e.name === 'ViewContent').eventId).toBe(px[3].eventID);
  });
});

// The calendar is the conversion. If BOOKING_URL is ever emptied or the ?gv=true is
// dropped, the page silently stops being able to take a booking and InitiateCheckout
// and Schedule both stop firing, with no error anywhere.

// A typo'd email or an invented number costs us the whole lead silently: we build the
// preview and send it nowhere. type="email" only checks for an @, so these go further.
test.describe('the form checks the email and the number are real', () => {
  const open1 = async (page: any) => {
    await page.route('**/api/closer-lead', (r: any) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"id":"x"}' }));
    await page.route(/connect\.facebook\.net|googletagmanager|fonts\.g|calendar\.google\.com/, (r: any) => r.abort());
    await page.goto('/ai-closer.html');
    await page.fill('#cl-name', 'Tan Wei Ming');
  };
  const tryIt = async (page: any, email: string, phone: string) => {
    await page.fill('#cl-email', email);
    await page.fill('#cl-whatsapp', phone);
    await page.click('#cl-next');
  };

  for (const bad of ['wm@tanaircon', 'wm at tanaircon.sg', 'wm@.sg', '@tanaircon.sg', 'wm@tanaircon..sg']) {
    test(`rejects the email "${bad}"`, async ({ page }) => {
      await open1(page);
      await tryIt(page, bad, '+6591234567');
      await expect(page.locator('#cl-email-error')).toBeVisible();
      await expect(page.locator('#cl-part2')).toBeHidden();
    });
  }

  test('refuses a throwaway inbox, because the demo goes there', async ({ page }) => {
    await open1(page);
    await tryIt(page, 'someone@mailinator.com', '+6591234567');
    await expect(page.locator('#cl-email-error')).toContainText(/actually read/i);
  });

  test('suggests the fix for a near-miss domain instead of just refusing', async ({ page }) => {
    await open1(page);
    await tryIt(page, 'wm@gmial.com', '+6591234567');
    await expect(page.locator('#cl-email-error')).toContainText('wm@gmail.com');
  });

  for (const [phone, why] of [['9123', 'too short'], ['11111111', 'repeated'], ['12345678', 'sequential'], ['71234567', 'SG must start 8 or 9'], ['abc12345', 'letters']] as [string, string][]) {
    test(`rejects the number "${phone}" (${why})`, async ({ page }) => {
      await open1(page);
      await tryIt(page, 'wm@tanaircon.sg', phone);
      await expect(page.locator('#cl-whatsapp-error')).toBeVisible();
      await expect(page.locator('#cl-part2')).toBeHidden();
    });
  }

  for (const good of ['+65 9123 4567', '91234567', '6591234567', '+44 7700 900123', '(65) 8123-4567']) {
    test(`accepts the number "${good}"`, async ({ page }) => {
      await open1(page);
      await tryIt(page, 'wm@tanaircon.sg', good);
      await expect(page.locator('#cl-whatsapp-error')).toBeHidden();
      await expect(page.locator('#cl-part2')).toBeVisible();
    });
  }

  test('tidies the number in place rather than scolding them', async ({ page }) => {
    await open1(page);
    await tryIt(page, 'wm@tanaircon.sg', '+65 9123-4567');
    await expect(page.locator('#cl-whatsapp')).toHaveValue('+6591234567');
  });

  test('the error clears as soon as they fix it', async ({ page }) => {
    await open1(page);
    await tryIt(page, 'wm@tanaircon', '+6591234567');
    await expect(page.locator('#cl-email-error')).toBeVisible();
    await page.fill('#cl-email', 'wm@tanaircon.sg');
    await expect(page.locator('#cl-email-error')).toBeHidden();
  });
});

// Every lead has to reach Alexander twice, finished or not. Telegram alone means a
// half-filled form is gone the moment the notification scrolls off his phone.
test.describe('a lead always reaches him two ways', () => {
  test('a partial sends both the CRM post and an email copy', async ({ page }) => {
    const sent = await stubNetwork(page);
    await page.goto('/ai-closer.html');
    await page.fill('#cl-name', 'Tan Wei Ming');
    await page.fill('#cl-email', 'wm@tanaircon.sg');
    await page.fill('#cl-whatsapp', '+6591234567');
    await page.click('#cl-next');
    await expect.poll(() => sent.api.length).toBe(1);
    expect(sent.api[0].partial).toBe(true);
  });

  test('finishing the form sends a second pair, not a silent update', async ({ page }) => {
    const sent = await stubNetwork(page);
    await page.goto('/ai-closer.html');
    await page.fill('#cl-name', 'Tan Wei Ming');
    await page.fill('#cl-email', 'wm@tanaircon.sg');
    await page.fill('#cl-whatsapp', '+6591234567');
    await page.click('#cl-next');
    await page.fill('#cl-website', 'tanaircon.sg');
    await page.selectOption('#cl-enquiries', '150plus');
    await page.selectOption('#cl-sale', '2kto10k');
    await page.check('input[name="challenges"][value="slow"]');
    await page.selectOption('#cl-goal', 'recover');
    await page.click('#cl-submit');
    await expect.poll(() => sent.api.length).toBe(2);
    expect(sent.api[1].tier).toBe('A');
  });
});

test.describe('the audience band names who this is for', () => {
  test('carries the revenue band and the buying behaviour', async ({ page }) => {
    await stubNetwork(page);
    await page.goto('/ai-closer.html');
    const aud = page.locator('#hero .aud');
    await expect(aud).toContainText(/S\$300k to S\$5M a year/);
    await expect(aud).toContainText(/WhatsApp/);
    await expect(aud).toContainText(/Not just a chatbot/);   // ad message match
  });
});

// The Google appointment schedule is set to 30 minutes. If the page ever promises a
// different length, the visitor books expecting one thing and gets another, and the
// mismatch is invisible until someone complains on the call.
test.describe('the call length matches the calendar', () => {
  for (const path of ['/ai-closer.html', '/ai-closer-sf.html']) {
    test(`${path} promises 30 minutes, nothing else`, async ({ page }) => {
      await stubNetwork(page);
      await page.goto(path);
      const text = await page.locator('body').innerText();
      expect(text, 'a stale call length is still on the page').not.toMatch(/\b20[- ]minute|\b20 minutes\b/i);
      expect(text).toMatch(/30 minutes/);
    });
  }
});

// Google's appointment iframe is cross-origin and sends the page no booking callback.
// Waiting for one left the visitor staring at an unchanged screen after booking, which
// is exactly what Alexander hit on his own test.

// Cal.com replaced the Google appointment schedule. Google gave no booking callback, no
// prefill and no way to pass an identifier, which is what forced the polling endpoint and
// the email matching. These pin the three things that made the switch worth it.
test.describe('the booking step is Cal.com, prefilled and identified', () => {
  const reach = async (page: any) => {
    await page.route('**/api/closer-lead', (r: any) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"id":"deal-123"}' }));
    await page.route('**/api/meta-event', (r: any) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    await page.route('**/formspree.io/**', (r: any) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/app.cal.com/**', (r: any) => r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.__calEmbedLoaded=1;' }));
    await page.route(/connect\.facebook\.net|googletagmanager|fonts\.g/, (r: any) => r.abort());
    await page.goto('/ai-closer.html?utm_content=ad_x');
    await page.fill('#cl-name', 'Tan Wei Ming');
    await page.fill('#cl-email', 'wm@tanaircon.sg');
    await page.fill('#cl-whatsapp', '+6591234567');
    await page.click('#cl-next');
    await page.fill('#cl-website', 'tanaircon.sg');
    await page.selectOption('#cl-enquiries', '150plus');
    await page.selectOption('#cl-sale', '2kto10k');
    await page.check('input[name="challenges"][value="slow"]');
    await page.selectOption('#cl-goal', 'recover');
    await page.click('#cl-submit');
    await page.waitForTimeout(900);
  };

  test('points at the 41 Closer event type, not a Google schedule', async ({ page }) => {
    await reach(page);
    const url = await page.evaluate(() => (window as any).BOOKING_URL);
    expect(url).toBe('alexander-lee-41labs/closer-call');
    expect(url).not.toContain('calendar.google.com');
  });

  test('prefills name and email, so the booking email cannot drift from the deal', async ({ page }) => {
    await reach(page);
    const cfg = await page.evaluate(() => {
      const q = (window as any).Cal && (window as any).Cal.q || [];
      const inline = q.find((a: any) => a[0] === 'inline');
      return inline && inline[1] && inline[1].config;
    });
    expect(cfg.name).toBe('Tan Wei Ming');
    expect(cfg.email).toBe('wm@tanaircon.sg');
  });

  test('carries the deal id through, so matching is exact rather than guessed', async ({ page }) => {
    await reach(page);
    const cfg = await page.evaluate(() => {
      const q = (window as any).Cal && (window as any).Cal.q || [];
      const inline = q.find((a: any) => a[0] === 'inline');
      return inline && inline[1] && inline[1].config;
    });
    expect(cfg['metadata[opportunityId]']).toBe('deal-123');
    expect(cfg['metadata[tier]']).toBe('A');
    expect(cfg['metadata[utm_content]']).toBe('ad_x');
  });

  test('nothing polls a booking-check endpoint any more', async ({ page }) => {
    let polled = 0;
    await page.route('**/api/booking-check**', (r: any) => { polled++; return r.fulfill({ status: 404, body: '' }); });
    await reach(page);
    await page.waitForTimeout(2500);
    expect(polled).toBe(0);
  });
});

// The deal id is what makes a booking match its deal exactly instead of being guessed at
// by email. It arrives from the lead POST, so the calendar has to wait for it: building
// the embed first sent Cal.com an empty opportunityId, which is the one field that matters.
test.describe('the booking carries the deal id', () => {
  test('waits for the lead response before building the embed', async ({ page }) => {
    await page.route('**/api/closer-lead', async (r: any) => {
      await new Promise((res) => setTimeout(res, 400));          // a realistically slow API
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"id":"deal-xyz"}' });
    });
    await page.route('**/api/meta-event', (r: any) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    await page.route('**/formspree.io/**', (r: any) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/app.cal.com/**', (r: any) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.route(/connect\.facebook\.net|googletagmanager|fonts\.g/, (r: any) => r.abort());
    await page.goto('/ai-closer.html');
    await page.fill('#cl-name', 'Tan Wei Ming');
    await page.fill('#cl-email', 'wm@tanaircon.sg');
    await page.fill('#cl-whatsapp', '+6591234567');
    await page.click('#cl-next');
    await page.fill('#cl-website', 'tanaircon.sg');
    await page.selectOption('#cl-enquiries', '150plus');
    await page.selectOption('#cl-sale', '2kto10k');
    await page.check('input[name="challenges"][value="slow"]');
    await page.selectOption('#cl-goal', 'recover');
    await page.click('#cl-submit');

    await expect.poll(async () => page.evaluate(() => {
      const q = (((window as any).Cal || {}).q) || [];
      const i = q.find((a: any) => a[0] === 'inline');
      return i && i[1] && i[1].config && i[1].config['metadata[opportunityId]'];
    }), { timeout: 6000 }).toBe('deal-xyz');
  });

  test('a hanging CRM never leaves them staring at no calendar', async ({ page }) => {
    await page.route('**/api/closer-lead', () => {});             // never answers
    await page.route('**/api/meta-event', (r: any) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    await page.route('**/formspree.io/**', (r: any) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/app.cal.com/**', (r: any) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.route(/connect\.facebook\.net|googletagmanager|fonts\.g/, (r: any) => r.abort());
    await page.goto('/ai-closer.html');
    await page.fill('#cl-name', 'Tan Wei Ming');
    await page.fill('#cl-email', 'wm@tanaircon.sg');
    await page.fill('#cl-whatsapp', '+6591234567');
    await page.click('#cl-next');
    await page.fill('#cl-website', 'tanaircon.sg');
    await page.selectOption('#cl-enquiries', '150plus');
    await page.selectOption('#cl-sale', '2kto10k');
    await page.check('input[name="challenges"][value="slow"]');
    await page.selectOption('#cl-goal', 'recover');
    await page.click('#cl-submit');
    // the 2.5s cap fires and the calendar appears anyway, just unmatched
    await expect(page.locator('#cl-cal-head')).toBeVisible({ timeout: 6000 });
  });
});
