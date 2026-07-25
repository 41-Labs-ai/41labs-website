// Regenerates the static post cards inside #posts-grid in blog.html from posts-index.json.
// The grid is static HTML on purpose (the JS loader broke the blog in March 2026) — run this
// after adding any post to posts-index.json, alongside rebuild-sitemap.js / rebuild-feed.js.
const fs = require('fs');
const path = require('path');

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
// data-category must match a filter button (all/insights/case-studies/ai-systems) or the card only shows under "All"
const FILTER_BUCKET = {
  'insights': 'insights', 'guide': 'insights', 'comparison-guides': 'insights',
  'case-studies': 'case-studies',
  'ai-systems': 'ai-systems', 'whatsapp ai': 'ai-systems', 'services': 'ai-systems',
};
const LABELS = { 'insights': 'Insights', 'case-studies': 'Case Studies', 'ai-systems': 'AI Systems', 'guide': 'Guide', 'comparison-guides': 'Comparison Guides', 'whatsapp ai': 'WhatsApp AI', 'services': 'Services' };

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const posts = JSON.parse(fs.readFileSync(path.join(__dirname, 'posts-index.json'), 'utf8')).posts
  .slice()
  .sort((a, b) => (a.date < b.date ? 1 : -1));

const cards = posts.map((p) => {
  const cat = (p.category || 'insights').toLowerCase();
  const bucket = FILTER_BUCKET[cat] || 'ai-systems';
  const label = LABELS[cat] || 'Insights';
  const d = new Date(p.date + 'T00:00:00');
  const dateLabel = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return `                <article class="post-card" data-category="${bucket}">
                    <a href="blog/${p.slug}" class="post-card-link-wrap">
                        <div class="post-card-content">
                            <div class="post-card-meta">
                                <span class="post-category">${esc(label)}</span>
                                <span class="post-date">${dateLabel}</span>
                            </div>
                            <h3>${esc(p.title)}</h3>
                            <p>${esc(p.excerpt)}</p>
                            <span class="read-more">Read more &rarr;</span>
                        </div>
                    </a>
                </article>`;
}).join('\n');

const file = path.join(__dirname, 'blog.html');
const html = fs.readFileSync(file, 'utf8');
const openTag = '<div class="posts-grid" id="posts-grid">';
const start = html.indexOf(openTag);
if (start === -1) throw new Error('posts-grid open tag not found');
// find the matching closing </div> by depth-scanning from the end of the open tag
let i = start + openTag.length, depth = 1;
const re = /<div\b|<\/div>/g;
re.lastIndex = i;
let m, end = -1;
while ((m = re.exec(html)) !== null) {
  depth += m[0] === '</div>' ? -1 : 1;
  if (depth === 0) { end = m.index; break; }
}
if (end === -1) throw new Error('posts-grid closing tag not found');
const out = html.slice(0, start + openTag.length) + '\n' + cards + '\n            ' + html.slice(end);
fs.writeFileSync(file, out);
console.log(`blog.html grid rebuilt with ${posts.length} cards (was static subset)`);
