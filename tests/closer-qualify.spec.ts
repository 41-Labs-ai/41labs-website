import { test, expect, Page } from '@playwright/test';

// closer-qualify.js no longer decides WHETHER someone books. 13 Sep 2026: everyone
// books while there is capacity. It decides the TIER, which sets the call order, what
// the Telegram alert leads with, and whether Meta hears a QualifiedLead.
//
// The tier is the monthly enquiry value: enquiries a week x 4.3 x average sale.

type Answers = { enquiries?: string; saleValue?: string };
type Verdict = { qualified: boolean; tier: 'A' | 'B' | 'C'; value: number; reason: string };

const ENQ = ['under20', '20to50', '50to150', '150plus'];
const SALE = ['under500', '500to2k', '2kto10k', '10kplus'];

async function load(page: Page) {
  await page.goto('/ai-closer.html');
  return (a: Answers): Promise<Verdict> => page.evaluate((x) => (window as any).qualify41(x), a);
}

test.describe('everyone books', () => {
  test('every combination of answers qualifies', async ({ page }) => {
    const q = await load(page);
    for (const enquiries of ENQ) {
      for (const saleValue of SALE) {
        expect((await q({ enquiries, saleValue })).qualified, `${enquiries}/${saleValue}`).toBe(true);
      }
    }
  });

  test('even junk or missing answers book, and get qualified on the call', async ({ page }) => {
    const q = await load(page);
    for (const a of [{}, { enquiries: 'nonsense', saleValue: 'nonsense' }, { enquiries: '50to150' }]) {
      const v = await q(a as Answers);
      expect(v.qualified).toBe(true);
      expect(v.tier).toBe('C');
      expect(Number.isFinite(v.value)).toBe(true);
    }
  });
});

test.describe('the tier is the monthly enquiry value', () => {
  test('is enquiries a week x 4.3 x average sale', async ({ page }) => {
    const q = await load(page);
    // 50to150 -> 100 a week, 500to2k -> S$1,200 a sale
    expect((await q({ enquiries: '50to150', saleValue: '500to2k' })).value).toBe(Math.round(100 * 4.3 * 1200));
  });

  test('S$1M a month or more is A', async ({ page }) => {
    const q = await load(page);
    for (const a of [{ enquiries: '150plus', saleValue: '500to2k' }, { enquiries: '50to150', saleValue: '2kto10k' }]) {
      const v = await q(a);
      expect(v.value, JSON.stringify(a)).toBeGreaterThanOrEqual(1_000_000);
      expect(v.tier).toBe('A');
    }
  });

  test('S$100k a month or more is B', async ({ page }) => {
    const q = await load(page);
    const v = await q({ enquiries: '50to150', saleValue: '500to2k' });
    expect(v.value).toBeGreaterThanOrEqual(100_000);
    expect(v.value).toBeLessThan(1_000_000);
    expect(v.tier).toBe('B');
  });

  test('below S$100k is C, and says so honestly rather than turning them away', async ({ page }) => {
    const q = await load(page);
    const v = await q({ enquiries: 'under20', saleValue: 'under500' });
    expect(v.tier).toBe('C');
    expect(v.qualified).toBe(true);
    expect(v.reason).toMatch(/pay back/i);
  });

  // This is the case the old volume floor threw away: 35 enquiries a week at S$5,000
  // is S$753k a month walking past. Yacht charter, industrial kit, property.
  test('a low-volume, high-ticket business is not thrown out', async ({ page }) => {
    const q = await load(page);
    const v = await q({ enquiries: '20to50', saleValue: '2kto10k' });
    expect(v.qualified).toBe(true);
    expect(v.tier).toBe('B');
    expect(v.value).toBeGreaterThan(700_000);
  });

  test('the reason carries the figure, so the call can open with it', async ({ page }) => {
    const q = await load(page);
    expect((await q({ enquiries: '150plus', saleValue: '10kplus' })).reason).toMatch(/S\$[\d,]+ a month/);
  });

  test('more volume or a bigger ticket never lowers the tier', async ({ page }) => {
    const q = await load(page);
    const rank = { C: 0, B: 1, A: 2 };
    for (const saleValue of SALE) {
      let last = -1;
      for (const enquiries of ENQ) {
        const t = rank[(await q({ enquiries, saleValue })).tier];
        expect(t, `${enquiries}/${saleValue} went backwards`).toBeGreaterThanOrEqual(last);
        last = t;
      }
    }
  });
});
