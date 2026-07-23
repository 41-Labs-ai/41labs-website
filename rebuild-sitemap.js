const fs = require('fs');
const path = require('path');

const today = new Date().toISOString().split('T')[0];

const urls = [];

// Root pages
const rootPages = ['index.html', 'about.html', 'blog.html', 'case-studies.html', 'process.html', 'privacy.html', 'terms.html', 'audit.html', 'events.html'];
for (const page of rootPages) {
  if (fs.existsSync(path.join(__dirname, page))) {
    const slug = page === 'index.html' ? '' : page.replace('.html', '');
    urls.push({ loc: `https://41labs.ai/${slug}`, priority: page === 'index.html' ? '1.0' : '0.7', changefreq: 'weekly' });
  }
}

// Blog articles
const blogDir = path.join(__dirname, 'blog');
const blogFiles = fs.readdirSync(blogDir).filter(f => f.endsWith('.html'));
for (const file of blogFiles) {
  const slug = file.replace('.html', '');
  urls.push({ loc: `https://41labs.ai/blog/${slug}`, priority: '0.8', changefreq: 'monthly' });
}

// Commercial GEO/AEO landing pages (root-level)
const landingPages = ['41-closer', 'ai-automation-agency-singapore', 'ai-development-company-singapore', 'ai-sales-agent-singapore', 'ai-for-ecommerce', 'whatsapp-ai-chatbot', 'ai-appointment-booking', 'whatsapp-automation-singapore', 'ai-automation-agency-australia', 'ai-sales-agent-australia'];
for (const slug of landingPages) {
  if (fs.existsSync(path.join(__dirname, slug + '.html'))) {
    urls.push({ loc: `https://41labs.ai/${slug}`, priority: '0.9', changefreq: 'monthly' });
  }
}
// Pillar hub page
if (fs.existsSync(path.join(__dirname, 'ai-guide-singapore.html'))) {
  urls.push({ loc: 'https://41labs.ai/ai-guide-singapore', priority: '0.9', changefreq: 'monthly' });
}

// Case study pages
const csDir = path.join(__dirname, 'case-studies');
if (fs.existsSync(csDir)) {
  const csFiles = fs.readdirSync(csDir).filter(f => f.endsWith('.html') && f !== 'index.html');
  for (const file of csFiles) {
    const slug = file.replace('.html', '');
    urls.push({ loc: `https://41labs.ai/case-studies/${slug}`, priority: '0.8', changefreq: 'monthly' });
  }
}

// Industry pages
const indDir = path.join(__dirname, 'industries');
if (fs.existsSync(indDir)) {
  const indFiles = fs.readdirSync(indDir).filter(f => f.endsWith('.html'));
  for (const file of indFiles) {
    const slug = file.replace('.html', '');
    urls.push({ loc: `https://41labs.ai/industries/${slug}`, priority: '0.8', changefreq: 'monthly' });
  }
}

// Service pages
const svcDir = path.join(__dirname, 'services');
if (fs.existsSync(svcDir)) {
  const svcFiles = fs.readdirSync(svcDir).filter(f => f.endsWith('.html'));
  for (const file of svcFiles) {
    const slug = file.replace('.html', '');
    urls.push({ loc: `https://41labs.ai/services/${slug}`, priority: '0.8', changefreq: 'monthly' });
  }
}

// Location pages
const locDir = path.join(__dirname, 'locations');
if (fs.existsSync(locDir)) {
  const locFiles = fs.readdirSync(locDir).filter(f => f.endsWith('.html'));
  for (const file of locFiles) {
    const slug = file.replace('.html', '');
    urls.push({ loc: `https://41labs.ai/locations/${slug}`, priority: '0.6', changefreq: 'monthly' });
  }
}

let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

for (const url of urls) {
  xml += `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>
`;
}

xml += `</urlset>`;

fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), xml);
console.log(`Sitemap rebuilt with ${urls.length} URLs`);
