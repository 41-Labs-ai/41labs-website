#!/usr/bin/env python3
"""
Append Q&A pairs to a page's visible FAQ block AND its FAQPage JSON-LD, keeping
the two byte-identical.

Written for the Sep 2026 fan-out work: we already rank top-10 on ~40 conversational
queries and get cited on none of them, because no single passage on the page IS the
answer. These blocks are that passage, in the query's own phrasing.

  add-faq.py <page.html> <pairs.json>

pairs.json: [{"q": "...", "a": "<p>...</p> or plain text"}, ...]
Idempotent: a question already present (visible or in schema) is skipped.
"""
import json, re, sys, html

def strip_tags(s):
    return html.unescape(re.sub(r'<[^>]+>', '', s)).strip()

def main(page, pairs_file):
    pairs = json.load(open(pairs_file))
    s = open(page, encoding='utf-8').read()

    # --- locate the visible FAQ block ---
    m = re.search(r'<h2[^>]*>\s*(Frequently asked questions|FAQ|[^<]*FAQ[^<]*)\s*</h2>', s, re.I)
    if not m:
        sys.exit(f"{page}: no FAQ <h2> found")

    # Two markup styles exist on this site: bare <h3>/<p> pairs under the FAQ
    # heading, and a <div class="faq-list"> of <div class="faq-item"> wrappers.
    # Match whichever the page uses so the new entries render identically.
    tail = s[m.end():]
    fl = re.search(r'<div class="faq-list">', tail)
    if fl:
        # close of the faq-list div: walk the divs to find its matching close
        i = m.end() + fl.end()
        depth = 1
        for mo in re.finditer(r'<div\b|</div>', s[i:]):
            depth += 1 if mo.group(0).startswith('<div') else -1
            if depth == 0:
                block_end = i + mo.start(); break
        else:
            sys.exit(f"{page}: unbalanced faq-list div")
        style = 'item'
    else:
        nxt = re.search(r'<h2[^>]*>', tail)
        if not nxt:
            sys.exit(f"{page}: could not find the end of the FAQ block")
        block_end = m.end() + nxt.start()
        style = 'plain'

    block = s[m.end():block_end]
    indent = ('\n                ' if style == 'plain' else '')
    existing = {strip_tags(x).lower() for x in re.findall(r'<h3[^>]*>(.*?)</h3>', block, re.S)}

    added, skipped = [], []
    html_add = ''
    for p in pairs:
        if p['q'].strip().lower() in existing:
            skipped.append(p['q']); continue
        ans = p['a'].strip()
        if not ans.startswith('<p'):
            ans = f'<p>{ans}</p>'
        q = html.escape(p["q"])
        if style == 'item':
            html_add += f'<div class="faq-item"><h3>{q}</h3>{ans}</div>'
        else:
            html_add += f'{indent}<h3>{q}</h3>\n{indent}{ans}\n'
        added.append(p)

    if not added:
        print(f"{page}: nothing to add ({len(skipped)} already present)"); return

    # insert at the end of the visible FAQ block
    s = (s[:block_end].rstrip() + html_add + s[block_end:]) if style == 'item' \
        else (s[:block_end].rstrip() + '\n' + html_add + s[block_end:])

    # --- mirror into FAQPage JSON-LD ---
    def patch(mo):
        raw = mo.group(1)
        try: d = json.loads(raw)
        except Exception: return mo.group(0)
        nodes = d if isinstance(d, list) else [d]
        hit = False
        for n in nodes:
            if isinstance(n, dict) and n.get('@type') == 'FAQPage':
                have = {q.get('name','').strip().lower() for q in n.get('mainEntity', [])}
                for p in added:
                    if p['q'].strip().lower() in have: continue
                    n.setdefault('mainEntity', []).append({
                        "@type": "Question", "name": p['q'],
                        "acceptedAnswer": {"@type": "Answer",
                                           "text": strip_tags(p['a'])}})
                    hit = True
        if not hit: return mo.group(0)
        return mo.group(0).replace(raw, json.dumps(d, indent=2, ensure_ascii=False))

    s2 = re.sub(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', patch, s, flags=re.S)
    if s2 == s:
        print(f"  ! {page}: no FAQPage schema updated - check it exists")
    s = s2

    open(page, 'w', encoding='utf-8').write(s)
    print(f"{page}: +{len(added)} Q&A" + (f", {len(skipped)} already present" if skipped else ""))

if __name__ == '__main__':
    if len(sys.argv) != 3: sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
