import { test, expect, Page } from '@playwright/test';

// closer-qualify.js decides what happens the moment someone finishes the form:
// book a call now and go straight to the AI Closer, or get held back for a human look.
//
// The rule is deliberately two questions wide (13 Sep 2026):
//   at least 50 WhatsApp enquiries a week  AND  average sale of at least S$500
// Anything else is context for the call, not a gate. These tests pin the boundary,
// because moving it quietly is the difference between filling the calendar with
// buyers and filling it with people we have to let down.

type Answers = { enquiries?: string; saleValue?: string; challenges?: string[]; goal?: string };
type Verdict = { qualified: boolean; tier: 'A' | 'B' | 'C'; value: number; reason: string };

async function load(page: Page) {
  await page.goto('/ai-closer.html');
  return (a: Answers): Promise<Verdict> => page.evaluate((x) => (window as any).qualify41(x), a);
}

const PASS = { enquiries: '50to150', saleValue: '500to2k' };

test.describe('the gate: 50 enquiries a week and S$500 a sale', () => {
  test('both floors met is a pass', async ({ page }) => {
    const q = await load(page);
    const v = await q(PASS);
    expect(v.qualified).toBe(true);
    expect(v.tier).toBe('B');
  });

  test('too few enquiries fails, however big the deals are', async ({ page }) => {
    const q = await load(page);
    for (const enquiries of ['under20', '20to50']) {
      const v = await q({ enquiries, saleValue: '10kplus' });
      expect(v.qualified, `${enquiries} + huge ticket`).toBe(false);
      expect(v.tier).toBe('C');
      expect(v.reason).toMatch(/volume/i);
    }
  });

  test('too small a sale fails, however many enquiries there are', async ({ page }) => {
    const q = await load(page);
    const v = await q({ enquiries: '150plus', saleValue: 'under500' });
    expect(v.qualified).toBe(false);
    expect(v.tier).toBe('C');
    expect(v.reason).toMatch(/cover the fee/i);
  });

  test('failing both says so, rather than blaming one', async ({ page }) => {
    const q = await load(page);
    const v = await q({ enquiries: 'under20', saleValue: 'under500' });
    expect(v.qualified).toBe(false);
    expect(v.reason).toMatch(/under 50 enquiries a week and under S\$500/i);
  });

  test('every bucket at or above both floors passes', async ({ page }) => {
    const q = await load(page);
    for (const enquiries of ['50to150', '150plus']) {
      for (const saleValue of ['500to2k', '2kto10k', '10kplus']) {
        expect((await q({ enquiries, saleValue })).qualified, `${enquiries}/${saleValue}`).toBe(true);
      }
    }
  });
});

test.describe('tiers decide who we call first', () => {
  test('clearing the floor on both is B: book them, no guarantee talk yet', async ({ page }) => {
    const q = await load(page);
    expect((await q(PASS)).tier).toBe('B');
  });

  test('well above the floor on either axis is A', async ({ page }) => {
    const q = await load(page);
    expect((await q({ enquiries: '150plus', saleValue: '500to2k' })).tier).toBe('A');
    expect((await q({ enquiries: '50to150', saleValue: '2kto10k' })).tier).toBe('A');
    expect((await q({ enquiries: '150plus', saleValue: '10kplus' })).tier).toBe('A');
  });

  test('tier A is where the guarantee conversation starts, and says so', async ({ page }) => {
    const q = await load(page);
    expect((await q({ enquiries: '150plus', saleValue: '10kplus' })).reason).toMatch(/guarantee/i);
  });
});

test.describe('the monthly figure we show them', () => {
  test('is enquiries a week x 4.3 x average sale', async ({ page }) => {
    const q = await load(page);
    // 50to150 -> 100 a week, 500to2k -> S$1,200 a sale
    expect((await q(PASS)).value).toBe(Math.round(100 * 4.3 * 1200));
  });

  test('is still reported for someone who does not qualify, so the note has context', async ({ page }) => {
    const q = await load(page);
    expect((await q({ enquiries: 'under20', saleValue: 'under500' })).value).toBeGreaterThan(0);
  });
});

test.describe('it never throws into the page', () => {
  test('missing, empty or junk answers hold rather than crash', async ({ page }) => {
    const q = await load(page);
    for (const a of [{}, { enquiries: 'nonsense', saleValue: 'nonsense' }, { enquiries: '50to150' }]) {
      const v = await q(a as Answers);
      expect(v.qualified).toBe(false);
      expect(v.tier).toBe('C');
      expect(Number.isFinite(v.value)).toBe(true);
    }
  });

  test('industry and tooling no longer change the outcome', async ({ page }) => {
    const q = await load(page);
    // These were gates before. Passing them must not resurrect the old behaviour.
    const base = await q(PASS);
    const withNoise = await q({ ...PASS, ...({ industry: 'something-else', whatsappUse: 'no', jobs: [] } as any) });
    expect(withNoise.qualified).toBe(base.qualified);
    expect(withNoise.tier).toBe(base.tier);
  });
});
