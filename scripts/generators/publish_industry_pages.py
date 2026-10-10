#!/usr/bin/env python3
"""Build every industry JSON into the site, add hub cards, print the list for llms.txt."""
import json,glob,os,sys,subprocess
S=os.path.dirname(os.path.abspath(__file__)); D=os.path.join(S,"industries")
sys.path.insert(0,S); from build_industry_page import build
cards=[]; lines=[]
for f in sorted(glob.glob(os.path.join(D,"*.json"))):
    if os.path.basename(f).startswith("_"): continue
    C=json.load(open(f)); build(C)
    cards.append({"slug":C["slug"],"title":C["h1"].replace("AI Agent for ","").replace(" in Singapore",""),"desc":C["desc"][:140].rsplit(".",1)[0]+"."})
    lines.append(f'- [{C["h1"]}](https://41labs.ai/industries/{C["slug"]}) — {C["desc"]}')
json.dump(cards,open(os.path.join(S,"hub-cards.json"),"w"),indent=1)
print(subprocess.run([sys.executable,os.path.join(S,"add_hub_cards.py"),os.path.join(S,"hub-cards.json")],capture_output=True,text=True).stdout)
open(os.path.join(S,"llms-industries.txt"),"w").write("\n".join(lines)+"\n"); print(len(cards),"pages built; llms lines in llms-industries.txt")
