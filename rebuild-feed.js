const fs = require('fs');
const path = require('path');

// Get all blog articles
const blogDir = path.join(__dirname, 'blog');
const files = fs.readdirSync(blogDir).filter(f => f.endsWith('.html'));

const items = [];

for (const file of files) {
  const slug = file.replace('.html', '');
  const html = fs.readFileSync(path.join(blogDir, file), 'utf8');
  
  // Extract title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const title = titleMatch ? titleMatch[1].replace(' | 41 Labs', '').trim() : slug;
  
  // Extract description
  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/);
  const desc = descMatch ? descMatch[1] : '';
  
  // Extract date from article:published_time or datePublished
  const dateMatch = html.match(/article:published_time"\s+content="([^"]+)"/) ||
                    html.match(/"datePublished":\s*"([^"]+)"/);
  const pubDate = dateMatch ? new Date(dateMatch[1]).toUTCString() : new Date().toUTCString();
  
  // Extract category
  const catMatch = html.match(/"articleSection":\s*"([^"]+)"/);
  const category = catMatch ? catMatch[1] : 'Insights';
  
  items.push({ slug, title, desc, pubDate, category });
}

// Sort by date descending
items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

// The newest article's date, not the clock. A clock stamp changes feed.xml on
// every rebuild, so CI's "generated files are up to date" check could never pass.
const now = items.length ? items[0].pubDate : new Date(0).toUTCString();

let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>41 Labs Blog</title>
    <link>https://41labs.ai/blog</link>
    <description>Practical insights on AI systems, automation, and operational efficiency for B2B businesses in Southeast Asia.</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="https://41labs.ai/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>https://41labs.ai/logo-full.png</url>
      <title>41 Labs Blog</title>
      <link>https://41labs.ai</link>
    </image>
`;

for (const item of items) {
  xml += `
    <item>
      <title>${item.title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</title>
      <link>https://41labs.ai/blog/${item.slug}</link>
      <guid isPermaLink="true">https://41labs.ai/blog/${item.slug}</guid>
      <pubDate>${item.pubDate}</pubDate>
      <dc:creator>Alexander Lee</dc:creator>
      <category>${item.category}</category>
      <description>${item.desc.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</description>
    </item>
`;
}

xml += `
  </channel>
</rss>`;

fs.writeFileSync(path.join(__dirname, 'feed.xml'), xml);
console.log(`RSS feed rebuilt with ${items.length} articles`);
