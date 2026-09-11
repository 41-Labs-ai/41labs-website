import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

// The ICP gate behind the calendar on /ai-closer (closer-qualify.js). Order of checks:
//   1. Customers don't message on WhatsApp            -> C (not a Closer business)
//   2. Enquiry value < S$50k/mo (weekly x ticket x 4.3) -> C (low volume AND low value)
//   3. Only simple FAQs and under S$100k/mo            -> C (a basic bot is enough)
//   4. Industry outside our ICP                         -> C, unless >= S$100k/mo with real sales work (B)
//   5. >= S$100k/mo, 2+ complex jobs, most sales start on WhatsApp -> A (guarantee-eligible, call first)
//   6. Everything else that passes                      -> B
// Low ticket alone never disqualifies (aircon at S$150 passes on volume).

function load() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'closer-qualify.js'), 'utf8');
  const ctx: any = { window: {} };
  vm.runInNewContext(src, ctx);
  return ctx.window.qualify41 as (a: any) => { qualified: boolean; tier: string; value: number; reason: string };
}

const q = load();
const base = { industry: 'renovation', whatsappUse: 'most', role: 'owner' };

test.describe('qualify41: 41 Closer ICP gate', () => {
  test('renovation firm, few but big jobs, quotes + site visits: tier A', () => {
    const r = q({ ...base, enquiries: 'under20', saleValue: '5kplus', jobs: ['quotes', 'bookings'] });
    expect(r.qualified).toBe(true);
    expect(r.tier).toBe('A');
  });

  test('aircon servicing, cheap jobs but 150+ a week with bookings: passes on volume', () => {
    const r = q({ ...base, industry: 'servicing', enquiries: '150plus', saleValue: 'under200', jobs: ['bookings'] });
    expect(r.qualified).toBe(true);
    expect(r.tier).toBe('B');
  });

  test('distributor, 50-150 a week, stock + orders at S$1-5k: tier A', () => {
    const r = q({ ...base, industry: 'distributor', enquiries: '50to150', saleValue: '1kto5k', jobs: ['stock', 'orders'], role: 'sales_head' });
    expect(r.tier).toBe('A');
  });

  test('customers do not message on WhatsApp: triage, whatever the numbers', () => {
    const r = q({ ...base, whatsappUse: 'no', enquiries: '150plus', saleValue: '5kplus', jobs: ['quotes', 'bookings'] });
    expect(r.qualified).toBe(false);
    expect(r.tier).toBe('C');
    expect(r.reason).toMatch(/WhatsApp/);
  });

  test('only some sales start on WhatsApp: can pass, but never tier A', () => {
    const r = q({ ...base, whatsappUse: 'some', enquiries: '50to150', saleValue: '1kto5k', jobs: ['quotes', 'bookings'] });
    expect(r.qualified).toBe(true);
    expect(r.tier).toBe('B');
  });

  test('low volume AND low value: WhatsApp triage, not the calendar', () => {
    const r = q({ ...base, enquiries: 'under20', saleValue: '200to1k', jobs: ['quotes'] });
    expect(r.qualified).toBe(false);
    expect(r.tier).toBe('C');
    expect(r.reason).toMatch(/volume/i);
  });

  test('only simple questions and under S$100k/mo: chatbot territory, triage', () => {
    const r = q({ ...base, enquiries: '20to50', saleValue: '200to1k', jobs: ['answers'] });
    expect(r.value).toBeGreaterThanOrEqual(50000);
    expect(r.value).toBeLessThan(100000);
    expect(r.qualified).toBe(false);
    expect(r.reason).toMatch(/simple/i);
  });

  test('simple questions but huge enquiry value still gets a call', () => {
    const r = q({ ...base, enquiries: '150plus', saleValue: '1kto5k', jobs: ['answers'] });
    expect(r.qualified).toBe(true);
  });

  test('industry outside our ICP with ordinary numbers: triage', () => {
    const r = q({ ...base, industry: 'other', enquiries: '20to50', saleValue: '200to1k', jobs: ['quotes', 'bookings'] });
    expect(r.qualified).toBe(false);
    expect(r.reason).toMatch(/industr/i);
  });

  test('industry outside our ICP but big and complex: tier B, worth a look', () => {
    const r = q({ ...base, industry: 'other', enquiries: '50to150', saleValue: '1kto5k', jobs: ['quotes', 'orders'] });
    expect(r.qualified).toBe(true);
    expect(r.tier).toBe('B');
  });

  test('every ICP industry is accepted', () => {
    for (const industry of ['renovation', 'clinic', 'car', 'property', 'education', 'distributor', 'servicing', 'travel', 'retail']) {
      const r = q({ ...base, industry, enquiries: '20to50', saleValue: '1kto5k', jobs: ['quotes'] });
      expect(r.qualified, industry).toBe(true);
    }
  });

  test('role never blocks the calendar on its own', () => {
    const r = q({ ...base, role: 'other', enquiries: '20to50', saleValue: '1kto5k', jobs: ['quotes', 'bookings'] });
    expect(r.qualified).toBe(true);
  });

  test('missing or unknown answers fail safe to triage, never throw', () => {
    expect(q({}).qualified).toBe(false);
    expect(q({ enquiries: 'lots', saleValue: '?', jobs: 'quotes' as any }).qualified).toBe(false);
  });
});
