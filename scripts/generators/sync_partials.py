"""Re-paste the shared header and footer into hand-written pages.

Generated pages pick the partials up on their next build. Hand-written pages
(homepage, About, the AI role pages) carry a pasted copy, so run this after
editing scripts/generators/partials/*.html. Running it twice changes nothing.
"""
import os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
PAGES = ["index.html", "about.html"]  # the AI role pages are built by build_role_pages.py, which reads the partials itself
header = open(os.path.join(HERE, "partials", "header.html"), encoding="utf-8").read().strip()
footer = open(os.path.join(HERE, "partials", "footer.html"), encoding="utf-8").read().strip()
FOOT_RE = re.compile(r'<footer class="site-footer">.*?<script src="/assets/41st/site\.js" defer></script>', re.S)
HEAD_RE = re.compile(r'<header class="site-header">.*?</header>', re.S)
for name in PAGES:
    path = os.path.join(ROOT, name)
    if not os.path.exists(path):
        continue
    s = open(path, encoding="utf-8").read()
    n = HEAD_RE.sub(lambda m: header, s, count=1)
    n = FOOT_RE.sub(lambda m: footer, n, count=1)
    if n != s:
        open(path, "w", encoding="utf-8").write(n)
        print("synced", name)
    else:
        print("unchanged", name)
