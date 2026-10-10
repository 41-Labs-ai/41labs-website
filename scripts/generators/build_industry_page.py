#!/usr/bin/env python3
"""Industry page generator for 41labs.ai: one JSON per trade -> industries/<slug>.html.
Shell (head, nav, footer) is taken from ai-sales-agent-singapore.html. Visible FAQ and FAQPage
JSON-LD come from the same list. Refuses em dashes, semicolons in answers, long titles, and
capsules outside the 40-60 / 130-170 word bands.
  build_industry_page.py <content.json> [--check]
"""
import json, re, html, sys, os
ROOT=os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","..")); SHELL=os.path.join(ROOT,"ai-sales-agent-singapore.html")
G="color:#22c55e;font-weight:600;"
def a(h,t): return f'<a href="{h}" style="{G}">{t}</a>'
wc=lambda t: len(re.sub(r"<[^>]+>"," ",t).split())
def esc(s): return html.escape(s,quote=False)
def build(C, check=False):
    slug=C["slug"]; url=f"https://41labs.ai/industries/{slug}"; trade=C["trade"]
    WA="https://wa.me/6580124848?text="+C.get("wa_text","Hi%2C%20I%20want%20to%20see%20how%2041%20Closer%20would%20answer%20my%20customers.")
    TITLE=C["title"]; DESC=C["desc"]; H1=C["h1"]
    assert len(TITLE)<=62,("title",len(TITLE)); assert len(DESC)<=165,("desc",len(DESC))
    assert 40<=wc(C["capsule_direct"])<=60,("direct",wc(C["capsule_direct"])); assert 130<=wc(C["capsule_passage"])<=170,("passage",wc(C["capsule_passage"]))
    blob=json.dumps(C,ensure_ascii=False)
    assert "—" not in blob, "em dash in content"; assert "’" not in blob and "“" not in blob, "curly quote in content"
    for q,ans in C["faq"]: assert ";" not in ans, ("semicolon in answer",q)
    for k in ("enquiries","dialogue","heard","flow","faq"): assert C.get(k), k
    enq="".join(f'<li>"{esc(e)}"</li>' for e in C["enquiries"])
    dlg="".join(f'<div style="margin:6px 0;display:flex;{"justify-content:flex-end" if d["who"]=="agent" else ""}"><div style="max-width:84%;padding:10px 14px;border-radius:14px;background:{"#dcf8c6" if d["who"]=="agent" else "#fff"};border:1px solid rgba(0,0,0,.08);font-size:15px;line-height:1.5;">{esc(d["text"])}</div></div>' for d in C["dialogue"])
    heard="".join(f'<div class="faq-item"><h3>"{esc(h["quote"])}"</h3><p>{h["answer"]}</p></div>' for h in C["heard"])
    flow="".join(f'<li><strong>{esc(s["step"])}.</strong> {s["detail"]}</li>' for s in C["flow"])
    leaks="".join(f"<li>{l}</li>" for l in C.get("leaks",[]))
    faq_vis="".join(f'<div class="faq-item"><h3>{esc(q)}</h3><p>{ans}</p></div>' for q,ans in C["faq"])
    rel="".join(f'<li style="margin-bottom:10px;"><a href="{h}" style="{G}">{esc(t)} &rarr;</a></li>' for h,t in C.get("related",[]))
    sys_row=C.get("systems","Your booking calendar, price list and payment link on Starter. Your own inventory, booking or CRM system read and written on Pro.")
    body=f"""<main id="main">
    <header class="location-hero"><div class="container"><div class="location-hero-content">
        <span class="location-flag"><img src="https://flagcdn.com/w80/sg.png" alt="Singapore flag" class="flag-icon-lg"></span>
        <h1>{esc(H1)}</h1>
        <p class="location-subtitle">{C["hero_sub"]}</p>
        <a href="{WA}" class="btn btn-primary btn-large" target="_blank" rel="noopener">{esc(C.get("cta","Message the agent on WhatsApp"))}</a>
        <p style="margin-top:14px;font-size:14px;opacity:.8;">By Alexander Lee, founder of 41 Labs. Last updated {C["date_txt"]}. Written from our calls with {esc(C["spoke_with"])}.</p>
    </div></div></header>

    <section class="section" style="padding-top:48px;"><div class="container" style="max-width:820px;">
        <div style="background:rgba(74,222,128,0.06);border-left:3px solid #4ade80;border-radius:12px;padding:28px 32px;font-size:1.05rem;line-height:1.7;"><p style="margin:0 0 16px;"><strong>{C["capsule_direct"]}</strong></p><p style="margin:0;">{C["capsule_passage"]}</p></div>
    </div></section>

    <section class="section"><div class="container" style="max-width:880px;"><div class="section-header"><h2>{esc(C.get("h2_enquiries", f"What your WhatsApp looks like at 9pm"))}</h2><p>{esc(C.get("enquiries_intro", f"The messages {trade} told us they get, in the customer's words"))}</p></div>
        <ul style="font-size:1.02rem;line-height:1.8;">{enq}</ul>
        <p style="margin-top:12px;">{C["enquiries_note"]}</p>
    </div></section>

    <section class="section" style="background:#f5f5f7;"><div class="container" style="max-width:720px;"><div class="section-header"><h2>What the agent says back</h2><p>{esc(C.get("dialogue_intro","One exchange, the way it runs on your own WhatsApp number. Prices and names are examples."))}</p></div>
        <div style="background:#ece5dd;border-radius:16px;padding:18px 16px;">{dlg}</div>
        <p style="margin-top:12px;font-size:15px;">{C.get("dialogue_note","Try it on ours first: message +65 8012 4848 at any hour and the agent that replies is 41 Closer.")}</p>
    </div></section>

    <section class="section"><div class="container" style="max-width:880px;"><div class="section-header"><h2>{esc(C.get("h2_flow","What it does inside your sale"))}</h2><p>{esc(C.get("flow_intro","Step by step, in your flow, not a generic chatbot script"))}</p></div>
        <ol style="font-size:1.02rem;line-height:1.8;">{flow}</ol>
        <p style="margin-top:12px;"><strong>What it connects to.</strong> {sys_row}</p>
    </div></section>

    {"<section class=\"section\" style=\"background:#f5f5f7;\"><div class=\"container\" style=\"max-width:880px;\"><div class=\"section-header\"><h2>"+esc(C.get("h2_leaks","Where the money leaks"))+"</h2><p>"+esc(C.get("leaks_intro","What the owners we spoke to told us, and what we measured"))+"</p></div><ul style=\"font-size:1.02rem;line-height:1.8;\">"+leaks+"</ul></div></section>" if leaks else ""}

    <section class="section"><div class="container" style="max-width:820px;"><div class="section-header"><h2>{esc(C.get("h2_heard", f"What {trade} said to us, and our answer"))}</h2><p>{esc(C.get("heard_intro","Paraphrased from our calls. No business is named."))}</p></div><div class="faq-list">{heard}</div></div></section>

    <section class="section" style="background:#f5f5f7;"><div class="container" style="max-width:880px;"><div class="section-header"><h2>What it costs</h2><p>The build is included. The only one-time cost is connecting a system of your own.</p></div>
        <table class="lp-table"><thead><tr><th>Plan</th><th>A month</th><th>For a {esc(C["trade_singular"])}</th></tr></thead><tbody>
        <tr><td><strong>Starter</strong></td><td>S$690</td><td>{C["plan_starter"]}</td></tr>
        <tr><td><strong>Pro</strong></td><td>S$1,490</td><td>{C["plan_pro"]}</td></tr>
        </tbody></table>
        <p style="margin-top:14px;">One month to start, charged from the day it goes live. Then month to month with 30 days notice and no contract. No GST is charged. Eligible Singapore SMEs can apply the EDGE grant, which replaced the EDG on 30 September 2026, to part of the cost. {a('/41-closer','All plans and terms')}.</p>
    </div></section>

    <section class="section" id="faq"><div class="container" style="max-width:820px;"><div class="section-header"><h2>{esc(C.get("h2_faq", f"AI agent for {trade}: questions owners ask"))}</h2></div><div class="faq-list">{faq_vis}</div></div></section>

    <section class="section cta-section"><div class="container"><div class="cta-content"><h2>{esc(C.get("cta_h2","See it answer your customers first"))}</h2><p>{C.get("cta_text","Send us your price list and how you sell. We build your agent before we ever get on a call. Then one free hour: you message your own agent, we show you the platform, and we connect payments and your WhatsApp.")}</p><a href="{WA}" class="btn btn-primary btn-large" target="_blank" rel="noopener">Message 41 Labs on WhatsApp</a><p class="cta-subtext">Singapore, Malaysia, Indonesia · Live in 48 hours · No contract</p></div></div></section>
    {"<div class=\"related-articles\" style=\"margin:48px auto;max-width:760px;padding:28px 32px;background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.18);border-radius:16px;\"><h3 style=\"font-size:18px;font-weight:700;color:#111;margin-bottom:16px;\">Related reading</h3><ul style=\"list-style:none;padding:0;margin:0;\">"+rel+"</ul></div>" if rel else ""}
    </main>"""
    ld_service={"@context":"https://schema.org","@type":"Service","name":f"41 Closer for {trade} in Singapore","serviceType":f"AI sales agent for {trade}","url":url,"description":DESC,"provider":{"@type":"Organization","name":"41 Labs","url":"https://41labs.ai"},"areaServed":[{"@type":"Country","name":"Singapore"},{"@type":"Country","name":"Malaysia"},{"@type":"Country","name":"Indonesia"}],"audience":{"@type":"BusinessAudience","name":esc(C["audience"])},"offers":{"@type":"Offer","price":"690","priceCurrency":"SGD","priceSpecification":{"@type":"UnitPriceSpecification","price":"690","priceCurrency":"SGD","unitText":"month"},"url":"https://41labs.ai/41-closer"}}
    ld_page={"@context":"https://schema.org","@type":"WebPage","url":url,"name":TITLE,"dateModified":C["date_iso"],"datePublished":C.get("date_published",C["date_iso"]),"author":{"@type":"Person","name":"Alexander Lee","url":"https://41labs.ai/about"},"publisher":{"@type":"Organization","name":"41 Labs","url":"https://41labs.ai"},"about":{"@type":"Product","name":"41 Closer","url":"https://41labs.ai/41-closer"}}
    ld_crumb={"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://41labs.ai/"},{"@type":"ListItem","position":2,"name":"Industries","item":"https://41labs.ai/industries"},{"@type":"ListItem","position":3,"name":H1,"item":url}]}
    ld_faq={"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":re.sub(r"<[^>]+>","",ans)}} for q,ans in C["faq"]]}
    def ld(j): return '<script type="application/ld+json">'+json.dumps(j,ensure_ascii=False,indent=1)+'</script>'
    src=open(SHELL,encoding="utf-8").read(); he=src.index("</head>"); head=src[:he]
    head=re.sub(r'\s*<script type="application/ld\+json">.*?</script>','',head,flags=re.S)
    head=head.replace('    <script src="/track.js" defer></script>',"    "+ld(ld_service)+"\n    "+ld(ld_page)+"\n    "+ld(ld_crumb)+"\n    "+ld(ld_faq)+'\n    <script src="/track.js" defer></script>')
    head=re.sub(r"<title>.*?</title>",f"<title>{esc(TITLE)}</title>",head)
    head=re.sub(r'<meta name="description" content="[^"]*">',f'<meta name="description" content="{html.escape(DESC)}">',head)
    head=re.sub(r'<meta name="keywords" content="[^"]*">',f'<meta name="keywords" content="{html.escape(C.get("keywords",""))}">',head)
    head=head.replace("https://41labs.ai/ai-sales-agent-singapore",url)
    for tag in ("og:title","twitter:title"): head=re.sub(rf'(<meta (?:property|name)="{tag}" content=")[^"]*(">)',rf'\g<1>{html.escape(TITLE)}\g<2>',head)
    for tag in ("og:description","twitter:description"): head=re.sub(rf'(<meta (?:property|name)="{tag}" content=")[^"]*(">)',rf'\g<1>{html.escape(DESC)}\g<2>',head)
    rest=src[he:]; m0=rest.index('<main id="main">'); m1=rest.index("</main>")+len("</main>")
    out=head+rest[:m0]+body+rest[m1:]
    assert "\u2014" not in out, "em dash in output"
    assert f'<link rel="canonical" href="{url}">' in out and f'property="og:url" content="{url}"' in out, "canonical or og:url not rewritten"
    assert out.count(url)>=4
    txt=re.sub(r"<[^>]+>"," ",re.sub(r"<script.*?</script>|<style.*?</style>|<nav.*?</nav>|<footer.*?</footer>","",out,flags=re.S))
    words=len(txt.split())
    if check: print(f"{slug}: ok, {words} words, faq {len(C['faq'])}, heard {len(C['heard'])}, enquiries {len(C['enquiries'])}"); return None
    path=os.path.join(ROOT,"industries",slug+".html"); open(path,"w",encoding="utf-8").write(out); print("written",path,len(out),"bytes,",words,"words"); return path
if __name__=="__main__":
    C=json.load(open(sys.argv[1])); build(C, check="--check" in sys.argv)
