#!/usr/bin/env python3
"""Submit URLs to IndexNow (api.indexnow.org fans out to Bing and others). Usage: indexnow.py url1 url2 ... or indexnow.py -f urls.txt"""
import json,sys,urllib.request
KEY="eec805d428b297c1cf03891b85603349"
urls=[l.strip() for l in open(sys.argv[2])] if len(sys.argv)>2 and sys.argv[1]=="-f" else sys.argv[1:]
urls=sorted(set(u for u in urls if u.startswith("https://41labs.ai")))
body={"host":"41labs.ai","key":KEY,"keyLocation":f"https://41labs.ai/{KEY}.txt","urlList":urls}
for ep in ("https://api.indexnow.org/indexnow","https://www.bing.com/indexnow"):
    req=urllib.request.Request(ep,data=json.dumps(body).encode(),headers={"Content-Type":"application/json; charset=utf-8"})
    try: print(ep,"->",urllib.request.urlopen(req,timeout=30).status)
    except urllib.error.HTTPError as e: print(ep,"->",e.code)
print(len(urls),"urls")
