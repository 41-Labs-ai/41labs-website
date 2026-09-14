import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

/**
 * The sitemap drifted for 51 days before the Sep 2026 audit caught it: six
 * indexable pages were missing (including the quote-automation pillar) and every
 * lastmod was frozen at one date. Nothing tested it, so nothing noticed.
 *
 * These tests assert the sitemap agrees with the pages themselves. Run
 * `npm run rebuild` if one fails - the generator, not the XML, is the fix.
 */

const ROOT = join(__dirname, '..');
const ORIGIN = 'https://41labs.ai';

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.vercel', 'playwright-report', 'test-results',
  'api', 'functions', 'admin', 'assets', 'img', 'logos', 'scripts', 'docs',
  'docs-site', 'deck', 'pitch', 'posts', 'review-ai-closer', 'guide', 'tests',
]);
const SKIP_FILES = new Set([
  '404.html', 'sitemap.html', 'dashboard.html', 'post.html', 'brandbook.html',
]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const abs = join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) out.push(...walk(abs));
    } else if (e.name.endsWith('.html') && !SKIP_FILES.has(e.name)) {
      out.push(abs);
    }
  }
  return out;
}

function slugOf(abs: string): string {
  const rel = relative(ROOT, abs).split(sep).join('/');
  return rel.replace(/index\.html$/, '').replace(/\.html$/, '').replace(/\/$/, '');
}

const isNoindex = (html: string) => {
  const m = html.match(/<meta[^>]+name=["']robots["'][^>]*>/i);
  return !!m && /noindex/i.test(m[0]);
};
const isRedirectStub = (html: string) =>
  /<title>\s*Redirecting/i.test(html) || /window\.location\s*(\.replace|\.href|=)/.test(html);

const sitemapXml = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
const sitemapUrls = new Set(
  [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]),
);

const pages = walk(ROOT).map(abs => {
  const html = readFileSync(abs, 'utf8');
  return { abs, slug: slugOf(abs), html, noindex: isNoindex(html), stub: isRedirectStub(html) };
});

test.describe('sitemap.xml agrees with the pages on disk', () => {
  test('every indexable page is listed', () => {
    const missing = pages
      .filter(p => !p.noindex && !p.stub)
      .map(p => `${ORIGIN}/${p.slug}`)
      .filter(u => !sitemapUrls.has(u));
    expect(missing, 'indexable pages absent from sitemap.xml').toEqual([]);
  });

  test('no noindex or redirect-stub page is listed', () => {
    const leaked = pages
      .filter(p => p.noindex || p.stub)
      .map(p => `${ORIGIN}/${p.slug}`)
      .filter(u => sitemapUrls.has(u));
    expect(leaked, 'pages that must not be in sitemap.xml').toEqual([]);
  });

  test('every listed URL has a page behind it', () => {
    const known = new Set(pages.map(p => `${ORIGIN}/${p.slug}`));
    const dangling = [...sitemapUrls].filter(u => !known.has(u));
    expect(dangling, 'sitemap URLs with no page on disk').toEqual([]);
  });

  test('lastmod is a real date when present, and never all-identical', () => {
    const dates = [...sitemapXml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(m => m[1]);
    for (const d of dates) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // A single date across the whole file means the generator stamped "today"
    // on everything, which is what taught Google to ignore the field before.
    if (dates.length > 10) expect(new Set(dates).size).toBeGreaterThan(1);
  });

  test('every indexable page declares a canonical', () => {
    // noindex pages are deliberately kept out of the index, so a canonical on
    // them signals nothing; only pages we ask Google to index need one.
    const without = pages
      .filter(p => !p.stub && !p.noindex && !/rel=["']canonical["']/i.test(p.html))
      .map(p => `/${p.slug}`);
    expect(without, 'pages missing rel=canonical').toEqual([]);
  });
});
