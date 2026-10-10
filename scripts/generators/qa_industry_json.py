#!/usr/bin/env python3
"""QA every industry JSON: generator check, banned words, client names, guarantee, and list every
sentence that carries a number so it can be traced to a source."""
import json,re,sys,glob,os,subprocess
S=os.path.dirname(os.path.abspath(__file__)); D=os.path.join(S,"industries")
NAMES=["super tec","supertec","wirasana","hertz","ace drive","comfortdelgro","cdg","zig ","stark","aik chin hin"," ach ","terence","atlas steel","future fields","wheat & beyond","wheat and beyond","era international","line 8","hiap heng","sg interior","renohaus","reno house","dmx","chan alex","same page","samepage","druk asia","capyswim","tiffany","valuemax","straits immigration","platinum immigration","fitbeat","fabian","pebbles","acer academy","mindchamps","eaim","klcii","ssa academy","floof","paros","chewbarka","pets eden","birds of paradise","madeleine","electro flash","gjh","new moon","maesthetic","ceramique","sg beauty","master maid","master employment","junese","titanium","kyle","evangeline","derrick","ina ","alan ong","jun ting","jie ling","hai sia","oson","avenue engineering","optimal tech","sptel","livingdna","europace","motherswork","yew aik","continental","carmen","treoo","forkeeps","milly","repair sg","amadeus"]
BANNED=["unlock","leverage","seamless","robust","delve","game changer","game-changer","studies show","typically","cutting-edge","revolutioni","empower","supercharge","effortless","hassle-free","24/7 "," — ","guarantee","s$20k","20,000 in six weeks","best-in-class","world-class"]
ok=True
for f in sorted(glob.glob(os.path.join(D,"*.json"))):
    name=os.path.basename(f)
    if name.startswith("_"): continue
    r=subprocess.run([sys.executable,os.path.join(S,"build_industry_page.py"),f,"--check"],capture_output=True,text=True)
    print("=====",name); print("  generator:", (r.stdout.strip() or r.stderr.strip().split("\n")[-1]))
    if r.returncode!=0: ok=False
    blob=json.dumps(json.load(open(f)),ensure_ascii=False); low=blob.lower()
    hits=[n for n in NAMES if n in low]; 
    if hits: print("  NAMES FOUND:",hits); ok=False
    bh=[b for b in BANNED if b in low]
    if bh: print("  banned/flag words:",bh)
    txt=re.sub(r"<[^>]+>"," ",blob)
    nums=sorted(set(s.strip() for s in re.split(r"(?<=[.!?])\s+|\\n|\",\s*\"",txt) if re.search(r"\d",s) and len(s)<400))
    print(f"  sentences with numbers ({len(nums)}):")
    for s in nums: print("    -",s[:220])
print("\nALL OK" if ok else "\nFIX NEEDED")
