#!/usr/bin/env python3
"""
Replace a plain-text phrase inside a page's FAQ answers, in BOTH the visible HTML
and the mirrored FAQPage JSON-LD, so the two never drift apart.

  edit-faq-text.py <page.html> <edits.json>
edits.json: [{"find": "...", "replace": "..."}, ...]  (plain text, no markup)
"""
import json, sys, re

def main(page, edits_file):
    edits = json.load(open(edits_file))
    s = open(page, encoding='utf-8').read()
    done, missed = 0, []
    for e in edits:
        f, r = e['find'], e['replace']
        n = s.count(f)
        if n == 0:
            missed.append(f[:60]); continue
        s = s.replace(f, r)
        done += n
    open(page, 'w', encoding='utf-8').write(s)
    # both copies must have been hit
    print(f"{page}: {done} replacements" + (f"  MISSED: {missed}" if missed else ""))
    for b in re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', s, re.S):
        json.loads(b)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
