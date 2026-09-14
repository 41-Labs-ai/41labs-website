import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

/**
 * Guards the fixes from Curt/Aerobic's 28 Jul 2026 site-fix report.
 *
 * Everything asserted here was live on 41labs.ai and had to be removed:
 * invented testimonials, self-serving review markup, and stats with no
 * source. These are trust and Google-manual-action risks, not style nits.
 *
 * Scope = the public site. Sales decks and the brandbook are excluded
 * because they are separate assets tracked separately.
 */

const EXCLUDE = /(^|\/)(node_modules|test-results|playwright-report|deck)\//;
const EXCLUDE_FILE = /(41-closer-deck|brandbook)\.html$/;

function siteFiles(exts: string[]): string[] {
  return execSync('git ls-files', { encoding: 'utf-8' })
    .split('\n')
    .filter(Boolean)
    .filter((f) => exts.some((e) => f.endsWith(e)))
    .filter((f) => !EXCLUDE.test(f) && !EXCLUDE_FILE.test(f))
    .filter((f) => existsSync(f));
}

function visibleText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

// Personas invented for testimonial copy. None is a real 41 Labs client.
const INVENTED_PEOPLE = [
  'James Tan', 'Sarah Lee', 'Michael Reyes',
  'Wei Lin', 'Priya Sharma', 'Rina Hartono',
];

// Claims with no source on any page, and contradicted by our own numbers.
const UNBACKED_CLAIMS = [
  '$2M+', '200+ companies', '100% client retention',
  '100% production', 'leading AI agent development company',
];

test('no invented testimonial personas anywhere on the public site', () => {
  const offenders: string[] = [];
  for (const f of siteFiles(['.html', '.json', '.txt', '.js'])) {
    const src = readFileSync(f, 'utf-8');
    for (const name of INVENTED_PEOPLE) {
      if (src.includes(name)) offenders.push(`${f} -> ${name}`);
    }
  }
  expect(offenders, 'invented testimonial personas must not be published').toEqual([]);
});

test('no unbacked headline claims anywhere on the public site', () => {
  const offenders: string[] = [];
  for (const f of siteFiles(['.html', '.json', '.txt'])) {
    const src = readFileSync(f, 'utf-8');
    for (const claim of UNBACKED_CLAIMS) {
      if (src.includes(claim)) offenders.push(`${f} -> ${claim}`);
    }
  }
  expect(offenders, 'every published stat needs a source').toEqual([]);
});

test('no self-serving review or rating markup in JSON-LD', () => {
  const offenders: string[] = [];
  for (const f of siteFiles(['.html'])) {
    const src = readFileSync(f, 'utf-8');
    for (const m of src.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      if (/"@type"\s*:\s*"Review"/.test(m[1])) offenders.push(`${f} -> Review`);
      if (/"aggregateRating"/.test(m[1])) offenders.push(`${f} -> aggregateRating`);
    }
  }
  expect(offenders, 'unsupported review markup risks a Google manual action').toEqual([]);
});

test('every FAQPage schema has its questions visible on the page', () => {
  const offenders: string[] = [];
  for (const f of siteFiles(['.html'])) {
    const src = readFileSync(f, 'utf-8');
    if (!src.includes('"FAQPage"')) continue;
    const questions = [...src.matchAll(/"@type"\s*:\s*"Question"\s*,\s*"name"\s*:\s*"([^"]{10,200})"/g)]
      .map((m) => m[1]);
    if (questions.length === 0) continue;
    const body = visibleText(src);
    const hidden = questions.filter((q) => !body.includes(q.toLowerCase().slice(0, 45)));
    if (hidden.length === questions.length) offenders.push(`${f} (${questions.length} hidden)`);
  }
  expect(offenders, 'FAQ content must be visible on the page it is marked up on').toEqual([]);
});

test('all JSON-LD parses', () => {
  const offenders: string[] = [];
  for (const f of siteFiles(['.html'])) {
    for (const m of readFileSync(f, 'utf-8')
      .matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try { JSON.parse(m[1]); } catch (e) { offenders.push(`${f}: ${(e as Error).message}`); }
    }
  }
  expect(offenders).toEqual([]);
});

test('og:url matches the canonical URL', () => {
  const offenders: string[] = [];
  for (const f of siteFiles(['.html'])) {
    const src = readFileSync(f, 'utf-8');
    const canonical = src.match(/rel="canonical"\s+href="(https:\/\/41labs\.ai\/[^"]*)"/);
    const og = src.match(/property="og:url"\s+content="([^"]+)"/);
    if (canonical && og && og[1] !== canonical[1]) offenders.push(`${f}: ${og[1]} != ${canonical[1]}`);
  }
  expect(offenders).toEqual([]);
});
