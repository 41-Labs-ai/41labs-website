import { test, expect, Page } from '@playwright/test';

// Verifies track.js fires the right GA4 events for every CTA type.
// We read window.dataLayer (the gtag stub queues into it), so this works
// even though real GA is deferred and not loaded in the test.

// Returns all gtag('event', ...) pushes recorded in dataLayer.
async function events(page: Page) {
  return page.evaluate(() => {
    const out: any[] = [];
    for (const item of (window as any).dataLayer || []) {
      // gtag pushes an arguments object: [0]='event', [1]=name, [2]=params
      if (item && item[0] === 'event') out.push({ name: item[1], params: item[2] || {} });
    }
    return out;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  // track.js is deferred — wait until it has installed the gtag stub.
  await page.waitForFunction(() => typeof (window as any).gtag === 'function' && !!(window as any).track41);
});

test('track.js loads and installs gtag stub before GA is present', async ({ page }) => {
  expect(await page.evaluate(() => typeof (window as any).track41)).toBe('function');
  expect(await page.evaluate(() => Array.isArray((window as any).dataLayer))).toBe(true);
});

test('WhatsApp / "Chat with 41 Closer" clicks fire whatsapp_click', async ({ page }) => {
  await page.evaluate(() => {
    const a = document.createElement('a');
    a.href = 'https://wa.me/6580124848?text=hi';
    a.className = 'btn btn-primary';
    a.textContent = 'Chat with 41 Closer';
    a.addEventListener('click', (e) => e.preventDefault()); // stop navigation, listener still fires
    document.body.appendChild(a);
    a.click();
  });
  const ev = (await events(page)).find((e) => e.name === 'whatsapp_click');
  expect(ev, 'whatsapp_click should fire').toBeTruthy();
  expect(ev!.params.event_category).toBe('conversion');
  expect(ev!.params.cta_id).toBe('41_closer');
  expect(ev!.params.link_url).toContain('wa.me');
});

test('clicking deep inside a CTA still attributes to the link (closest)', async ({ page }) => {
  await page.evaluate(() => {
    const a = document.createElement('a');
    a.href = 'https://wa.me/6580124848';
    a.innerHTML = '<span><strong>WhatsApp Us</strong></span>';
    a.addEventListener('click', (e) => e.preventDefault());
    document.body.appendChild(a);
    (a.querySelector('strong') as HTMLElement).click(); // click the inner node
  });
  const ev = (await events(page)).filter((e) => e.name === 'whatsapp_click').pop();
  expect(ev).toBeTruthy();
});

test('mailto and tel clicks fire email_click / phone_click', async ({ page }) => {
  await page.evaluate(() => {
    const m = document.createElement('a');
    m.href = 'mailto:alexander@41labs.ai';
    m.textContent = 'Email us';
    m.addEventListener('click', (e) => e.preventDefault());
    document.body.appendChild(m);
    m.click();
    const t = document.createElement('a');
    t.href = 'tel:+6580124848';
    t.addEventListener('click', (e) => e.preventDefault());
    document.body.appendChild(t);
    t.click();
  });
  const all = await events(page);
  expect(all.find((e) => e.name === 'email_click')?.params.event_label).toBe('alexander@41labs.ai');
  expect(all.find((e) => e.name === 'phone_click')).toBeTruthy();
});

test('generic .btn CTA fires cta_click but menu toggle does not', async ({ page }) => {
  await page.evaluate(() => {
    const b = document.createElement('button');
    b.className = 'btn btn-secondary';
    b.textContent = 'Book a free call';
    document.body.appendChild(b);
    b.click();

    const toggle = document.createElement('button');
    toggle.className = 'mobile-menu-btn';
    toggle.textContent = 'menu';
    document.body.appendChild(toggle);
    toggle.click();
  });
  const all = await events(page);
  const cta = all.find((e) => e.name === 'cta_click');
  expect(cta?.params.cta_id).toBe('book_call');
  // the menu toggle should NOT have produced a second cta_click
  expect(all.filter((e) => e.name === 'cta_click').length).toBe(1);
});

test('GA config is queued before any event (first-interaction conversion clicks are not dropped)', async ({ page }) => {
  // Simulate the failure case: a visitor whose VERY FIRST interaction is a
  // WhatsApp click. If config lands after the event in dataLayer, GA4 drops it.
  await page.evaluate(() => {
    const a = document.createElement('a');
    a.href = 'https://wa.me/6580124848?text=hi';
    a.textContent = 'Chat with 41 Closer';
    a.addEventListener('click', (e) => e.preventDefault());
    document.body.appendChild(a);
    a.click();
  });
  const order = await page.evaluate(() => {
    const dl: any[] = (window as any).dataLayer || [];
    let configIdx = -1, eventIdx = -1;
    dl.forEach((item, i) => {
      if (item && item[0] === 'config' && item[1] === 'G-VQQ49H8N1L' && configIdx === -1) configIdx = i;
      if (item && item[0] === 'event' && eventIdx === -1) eventIdx = i;
    });
    return { configIdx, eventIdx };
  });
  expect(order.configIdx, 'GA config must be present in dataLayer').toBeGreaterThanOrEqual(0);
  expect(order.eventIdx, 'first event must come AFTER config').toBeGreaterThan(order.configIdx);
});

test('form submit fires form_submit', async ({ page }) => {
  await page.evaluate(() => {
    const f = document.createElement('form');
    f.id = 'lead-form';
    f.addEventListener('submit', (e) => e.preventDefault());
    document.body.appendChild(f);
    f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  const ev = (await events(page)).find((e) => e.name === 'form_submit');
  expect(ev).toBeTruthy();
  expect(ev!.params.event_label).toBe('lead-form');
});

// track.js configures GA early with send_page_view:false so click events queue
// safely before gtag.js loads. The deferred loader then configs the SAME id, and
// gtag keeps the first config's setting, so no page_view was ever sent. GA4's
// Pages and screens report was empty site-wide. The loader now sends one explicitly.
test.describe('GA4 page_view', () => {
  for (const path of ['/index.html', '/ai-closer.html', '/41-closer.html']) {
    test(`${path} sends exactly one page_view to GA4`, async ({ page }) => {
      await page.route(/googletagmanager\.com/, (r) =>
        r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
      await page.route(/connect\.facebook\.net|clarity\.ms|fonts\.g/, (r) => r.abort());
      await page.goto(path);
      await page.mouse.click(200, 300);          // the loader waits for first interaction
      await page.waitForTimeout(600);
      const events = await page.evaluate(() =>
        (window as any).dataLayer.map((a: any) => Array.from(a))
          .filter((a: any) => a[0] === 'event' && a[1] === 'page_view'));
      expect(events.length, `page_view count on ${path}`).toBe(1);
    });
  }
});
