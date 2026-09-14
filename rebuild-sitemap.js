#!/usr/bin/env node
/**
 * Rebuild sitemap.xml from the page tree.
 *
 * Two rules, both deliberate:
 *  1. Pages are DISCOVERED, never listed. The old version carried a hardcoded
 *     `landingPages` array, so every new root landing page was silently left out
 *     (six of them by Sep 2026, including the quote-automation pillar). Anything
 *     that ships is in the sitemap unless it says otherwise.
 *  2. A page opts OUT by carrying `noindex` in its robots meta. That is the same
 *     signal Google reads, so the sitemap can never disagree with the page.
 *
 * lastmod comes from the file's last commit date, not today's date. Stamping
 * everything with today tells Google the whole site changed every deploy, and it
 * learns to ignore the field.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const ORIGIN = 'https://41labs.ai';

// Directories that are not public pages.
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.vercel', 'playwright-report', 'test-results',
  'api', 'functions', 'admin', 'assets', 'img', 'logos', 'scripts', 'docs',
  'docs-site', 'deck', 'pitch', 'posts', 'review-ai-closer', 'guide',
]);

// Files that are never a canonical page.
// post.html is a legacy JS redirect stub; brandbook is an internal asset.
const SKIP_FILES = new Set([
  '404.html', 'sitemap.html', 'dashboard.html', 'post.html', 'brandbook.html',
]);

// Priority by location. Root landing pages outrank blog posts.
const PRIORITY = {
  '': '0.9', blog: '0.8', 'case-studies': '0.8',
  industries: '0.8', services: '0.8', locations: '0.6',
};
const CHANGEFREQ = { '': 'monthly', blog: 'monthly' };

const isNoindex = (html) => {
  const m = html.match(/<meta[^>]+name=["']robots["'][^>]*>/i);
  return !!m && /noindex/i.test(m[0]);
};

// A page's own schema dateModified is the honest answer: someone wrote it on
// purpose when they changed the page.
//
// When a page does not declare one we emit NO lastmod at all. Git dates and file
// mtimes both look authoritative and are both wrong here - a history rewrite in
// Sep 2026 stamped every file with the same day, and mtime only records when the
// repo was checked out. A missing lastmod is neutral to Google; a wrong one
// teaches it to distrust the field across the whole sitemap. The fix for those
// pages is to give them a real dateModified, not to guess on their behalf.
const lastmod = (html) => {
  const declared = html.match(/"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})/);
  return declared ? declared[1] : null;
};

// Redirect stubs render nothing and must never be offered to a crawler.
const isRedirectStub = (html) =>
  /<title>\s*Redirecting/i.test(html) || /window\.location\s*(\.replace|\.href|=)/.test(html);

const walk = (dir, rel = '') => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...walk(abs, rel ? `${rel}/${entry.name}` : entry.name));
    } else if (entry.name.endsWith('.html') && !SKIP_FILES.has(entry.name)) {
      out.push({ abs, rel });
    }
  }
  return out;
};

const urls = [];
const excluded = [];

for (const { abs, rel } of walk(ROOT)) {
  const html = fs.readFileSync(abs, 'utf8');
  const base = path.basename(abs, '.html');
  const slug = base === 'index'
    ? rel                                   // dir index -> /industries
    : (rel ? `${rel}/${base}` : base);      // -> /blog/foo or /about

  if (isNoindex(html)) { excluded.push(`/${slug} (noindex)`); continue; }
  if (isRedirectStub(html)) { excluded.push(`/${slug} (redirect stub)`); continue; }

  urls.push({
    loc: `${ORIGIN}/${slug}`,
    lastmod: lastmod(html),
    changefreq: CHANGEFREQ[rel] || 'monthly',
    priority: slug === '' ? '1.0' : (PRIORITY[rel] || '0.7'),
  });
}

urls.sort((a, b) => a.loc.localeCompare(b.loc));

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `
    <lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
console.log(`Sitemap rebuilt: ${urls.length} URLs`);
const undated = urls.filter(u => !u.lastmod);
console.log(`Excluded ${excluded.length} pages:`);
for (const e of excluded) console.log(`  ${e}`);
if (undated.length) {
  console.log(`\n${undated.length} URLs have no lastmod (no schema dateModified):`);
  for (const u of undated) console.log(`  ${u.loc.replace(ORIGIN, '') || '/'}`);
}
