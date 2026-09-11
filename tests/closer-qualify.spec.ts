import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

// The ICP gate behind the calendar on /ai-closer (closer-qualify.js).
// Rule: enquiry value = weekly enquiries x average sale x 4.3.
//   < S$50k/mo, or simple-FAQ chats under S$100k/mo  -> tier C, WhatsApp triage
//   >= S$100k/mo with 2+ complex jobs                 -> tier A (guarantee-eligible, call first)
//   everything else that passes                        -> tier B
// Low ticket alone never disqualifies (aircon at S$150 passes on volume).

function load() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'closer-qualify.js'), 'utf8');
  const ctx: any = { window: {} };
  vm.runInNewContext(src, ctx);
  return ctx.window.qualify41 as (a: any) => { qualified: boolean; tier: string; value: number; reason: string };
}

const q = load();

test.describe('qualify41: 41 Closer ICP gate', () => {
  test('renovation firm, few but big jobs, quotes + site visits: tier A', () => {
    const r = q({ enquiries: 'under20', saleValue: '5kplus', jobs: ['quotes', 'bookings'], role: 'owner' });
    expect(r.qualified).toBe(true);
    expect(r.tier).toBe('A');
  });

  test('aircon servicing, cheap jobs but 150+ a week with bookings: passes on volume', () => {
    const r = q({ enquiries: '150plus', saleValue: 'under200', jobs: ['bookings'], role: 'owner' });
    expect(r.qualified).toBe(true);
    expect(r.tier).toBe('B');
  });

  test('distributor, 50-150 a week, stock + orders at S$1-5k: tier A', () => {
    const r = q({ enquiries: '50to150', saleValue: '1kto5k', jobs: ['stock', 'orders'], role: 'sales_head' });
    expect(r.tier).toBe('A');
  });

  test('low volume AND low value: WhatsApp triage, not the calendar', () => {
    const r = q({ enquiries: 'under20', saleValue: '200to1k', jobs: ['quotes'], role: 'owner' });
    expect(r.qualified).toBe(false);
    expect(r.tier).toBe('C');
    expect(r.reason).toMatch(/volume/i);
  });

  test('only simple questions and under S$100k/mo: chatbot territory, triage', () => {
    const r = q({ enquiries: '20to50', saleValue: '200to1k', jobs: ['answers'], role: 'owner' });
    expect(r.value).toBeGreaterThanOrEqual(50000);
    expect(r.value).toBeLessThan(100000);
    expect(r.qualified).toBe(false);
    expect(r.reason).toMatch(/simple/i);
  });

  test('simple questions but huge enquiry value still gets a call', () => {
    const r = q({ enquiries: '150plus', saleValue: '1kto5k', jobs: ['answers'], role: 'owner' });
    expect(r.qualified).toBe(true);
  });

  test('role never blocks the calendar on its own', () => {
    const r = q({ enquiries: '20to50', saleValue: '1kto5k', jobs: ['quotes', 'bookings'], role: 'other' });
    expect(r.qualified).toBe(true);
  });

  test('missing or unknown answers fail safe to triage, never throw', () => {
    expect(q({}).qualified).toBe(false);
    expect(q({ enquiries: 'lots', saleValue: '?', jobs: 'quotes' as any }).qualified).toBe(false);
  });
});
