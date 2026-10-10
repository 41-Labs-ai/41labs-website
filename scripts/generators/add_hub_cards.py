#!/usr/bin/env python3
"""Add or update industry cards on industries.html from a JSON list [{slug,title,desc}]. Idempotent by slug."""
import json,sys,re,os,html
ROOT=os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","..")); p=os.path.join(ROOT,"industries.html")
cards=json.load(open(sys.argv[1])); s=open(p,encoding="utf-8").read(); n_new=n_upd=0
for c in cards:
    href=f'/industries/{c["slug"]}'
    card=f'<a href="{href}" class="industry-card">\n                        <div class="industry-card-title">{html.escape(c["title"])}</div>\n                        <p class="industry-card-desc">{html.escape(c["desc"])}</p>\n                    </a>'
    m=re.search(rf'<a href="{re.escape(href)}" class="industry-card">.*?</a>',s,re.S)
    if m: s=s[:m.start()]+card+s[m.end():]; n_upd+=1
    else:
        anchor='<a href="/industries/ai-for-renovation-contractors-singapore" class="industry-card">'
        assert anchor in s; s=s.replace(anchor, card+"\n                    "+anchor,1); n_new+=1
open(p,"w",encoding="utf-8").write(s); print(f"hub cards: {n_new} added, {n_upd} updated")
