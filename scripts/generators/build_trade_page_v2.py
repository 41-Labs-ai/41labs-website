#!/usr/bin/env python3
"""Trade page, density template (Phase 2). Same JSON as build_industry_page.py, half the page:
hero, capsule, enquiries, dialogue, price, six FAQs (three are owner objections, the do-not-buy one always in), CTA.
Usage: build_trade_page_v2.py industries/<slug>.json [--check] [--out path]"""
import json, re, html, sys, os
S = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, S)
from gates import check
ROOT = os.path.abspath(os.path.join(S, "..", "..")); SHELL = os.path.join(ROOT, "ai-sales-agent-singapore.html")
G = "color:#22c55e;font-weight:600;"
def a(h, t): return f'<a href="{h}" style="{G}">{t}</a>'
def esc(s): return html.escape(s, quote=False)
def wc(t): return len(re.sub(r"<[^>]+>", " ", t).split())
COST_FAQ = ("Starter is S$690 a month and Pro is S$1,490 a month, with the build included and no setup fee. Connecting a system we have connected before is a one-time S$2,400. "
            "One month to start, charged from the day it goes live, then month to month with 30 days notice and no contract. No GST is charged.")

def short_passage(p, limit=80):
    out = []
    for s in re.split(r"(?<=[.!?])\s+", p):
        if wc(s) > 28: continue  # list-style sentences stay in the JSON, not on the page
        if wc(" ".join(out + [s])) > limit: break
        out.append(s)
    return " ".join(out)

def pick_faq(C):
    heard = [h for h in C["heard"] if wc(h["answer"]) <= 60]
    heard.sort(key=lambda h: (0 if "do not buy" in h["answer"].lower() or "not buy" in h["answer"].lower() else 1, wc(h["answer"])))
    writer = [(q, ans) for q, ans in C["faq"] if wc(ans) <= 60 and "cost" not in q.lower() and "price" not in q.lower()]
    faq = [(f"How much does 41 Closer cost for a {C['trade_singular']}?", COST_FAQ)]
    faq += writer[:2]
    faq += [(h["quote"], h["answer"]) for h in heard[:3]]
    return faq[:6]

def build(C, check_only=False, out_path=None):
    slug = C["slug"]; url = f"https://41labs.ai/industries/{slug}"; trade = C["trade"]
    WA = "https://wa.me/6580124848?text=" + C.get("wa_text", "Hi%2C%20I%20want%20to%20see%20how%2041%20Closer%20would%20answer%20my%20customers.")
    TITLE = C["title"]; DESC = C["desc"]; H1 = C["h1"]
    assert len(TITLE) <= 62 and len(DESC) <= 165, (len(TITLE), len(DESC))
    FAQ = pick_faq(C)
    passage = short_passage(C["capsule_passage"])
    enq = "".join(f'<li>"{esc(e)}"</li>' for e in C["enquiries"][:8])
    dlg = "".join(f'<div style="margin:6px 0;display:flex;{"justify-content:flex-end" if d["who"]=="agent" else ""}"><div style="max-width:84%;padding:10px 14px;border-radius:14px;background:{"#dcf8c6" if d["who"]=="agent" else "#fff"};border:1px solid rgba(0,0,0,.08);font-size:15px;line-height:1.5;">{esc(d["text"])}</div></div>' for d in C["dialogue"][:8])
    faq_vis = "".join(f'<div class="faq-item"><h3>{esc(q)}</h3><p>{ans}</p></div>' for q, ans in FAQ)
    body = f"""<main id="main">
    <header class="location-hero"><div class="container"><div class="location-hero-content">
        <span class="location-flag"><img src="https://flagcdn.com/w80/sg.png" alt="Singapore flag" class="flag-icon-lg"></span>
        <h1>{esc(H1)}</h1>
        <p class="location-subtitle">{C["hero_sub"]}</p>
        <a href="{WA}" class="btn btn-primary btn-large" target="_blank" rel="noopener">{esc(C.get("cta","Message the agent on WhatsApp"))}</a>
        <p style="margin-top:14px;font-size:14px;opacity:.8;">By Alexander Lee, founder of 41 Labs. Last updated {C["date_txt"]}. Written from our calls with {esc(C["spoke_with"])}.</p>
    </div></div></header>

    <section class="section" style="padding-top:48px;"><div class="container" style="max-width:820px;">
        <div style="background:rgba(74,222,128,0.06);border-left:3px solid #4ade80;border-radius:12px;padding:28px 32px;font-size:1.05rem;line-height:1.7;"><p style="margin:0 0 16px;"><strong>{C["capsule_direct"]}</strong></p><p style="margin:0;">{passage}</p></div>
    </div></section>

    <section class="section" style="background:#f5f5f7;"><div class="container" style="max-width:880px;"><div class="section-header"><h2>What it costs</h2><p>One price. No hidden fees. The build is included.</p></div>
        <table class="lp-table"><thead><tr><th>Plan</th><th>A month</th><th>For a {esc(C["trade_singular"])}</th></tr></thead><tbody>
        <tr><td><strong>Starter</strong></td><td>S$690</td><td>{C["plan_starter"]}</td></tr>
        <tr><td><strong>Pro</strong></td><td>S$1,490</td><td>{C["plan_pro"]}</td></tr>
        </tbody></table>
        <p style="margin-top:14px;">One month to start, charged from the day it goes live. Then month to month with 30 days notice and no contract. No GST is charged. {a('/41-closer','All plans and terms')}.</p>
    </div></section>

    <section class="section"><div class="container" style="max-width:880px;"><div class="section-header"><h2>{esc(C.get("h2_enquiries", "What your WhatsApp looks like at 9pm"))}</h2><p>{esc(C.get("enquiries_intro", f"The messages {trade} told us they get, in the customer's words"))}</p></div>
        <ul style="font-size:1.02rem;line-height:1.8;">{enq}</ul>
    </div></section>

    <section class="section" style="background:#f5f5f7;"><div class="container" style="max-width:720px;"><div class="section-header"><h2>What the agent says back</h2><p>{esc(C.get("dialogue_intro","One exchange, the way it runs on your own WhatsApp number. Prices and names are examples."))}</p></div>
        <div style="background:#ece5dd;border-radius:16px;padding:18px 16px;">{dlg}</div>
        <p style="margin-top:12px;font-size:15px;">Try it on ours first: message +65 8012 4848 at any hour and the agent that replies is 41 Closer.</p>
    </div></section>

    <section class="section" id="faq"><div class="container" style="max-width:820px;"><div class="section-header"><h2>{esc(C.get("h2_faq", f"AI agent for {trade}: what owners ask us, and what they said"))}</h2><p>Paraphrased from our calls. No business is named.</p></div><div class="faq-list">{faq_vis}</div></div></section>

    <section class="section cta-section"><div class="container"><div class="cta-content"><h2>{esc(C.get("cta_h2","See it answer your customers first"))}</h2><p>{C.get("cta_text","Send us your price list and how you sell. We build your agent before we ever get on a call. Then one free hour: you message your own agent, we show you the platform, and we connect payments and your WhatsApp.")}</p><a href="{WA}" class="btn btn-primary btn-large" target="_blank" rel="noopener">Message 41 Labs on WhatsApp</a><p class="cta-subtext">Singapore, Malaysia, Indonesia · Live in 48 hours · No contract</p></div></div></section>
    </main>"""
    ld_service = {"@context": "https://schema.org", "@type": "Service", "name": f"41 Closer for {trade} in Singapore", "serviceType": f"AI sales agent for {trade}", "url": url, "description": DESC, "provider": {"@type": "Organization", "name": "41 Labs", "url": "https://41labs.ai"}, "areaServed": [{"@type": "Country", "name": "Singapore"}, {"@type": "Country", "name": "Malaysia"}, {"@type": "Country", "name": "Indonesia"}], "audience": {"@type": "BusinessAudience", "name": esc(C["audience"])}, "offers": {"@type": "Offer", "price": "690", "priceCurrency": "SGD", "priceSpecification": {"@type": "UnitPriceSpecification", "price": "690", "priceCurrency": "SGD", "unitText": "month"}, "url": "https://41labs.ai/41-closer"}}
    ld_page = {"@context": "https://schema.org", "@type": "WebPage", "url": url, "name": TITLE, "dateModified": C["date_iso"], "datePublished": C.get("date_published", C["date_iso"]), "author": {"@type": "Person", "name": "Alexander Lee", "url": "https://41labs.ai/about"}, "publisher": {"@type": "Organization", "name": "41 Labs", "url": "https://41labs.ai"}, "about": {"@type": "Product", "name": "41 Closer", "url": "https://41labs.ai/41-closer"}}
    ld_crumb = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "Home", "item": "https://41labs.ai/"}, {"@type": "ListItem", "position": 2, "name": "Industries", "item": "https://41labs.ai/industries"}, {"@type": "ListItem", "position": 3, "name": H1, "item": url}]}
    ld_faq = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": re.sub(r"<[^>]+>", "", ans)}} for q, ans in FAQ]}
    def ld(j): return '<script type="application/ld+json">' + json.dumps(j, ensure_ascii=False, indent=1) + "</script>"
    src = open(SHELL, encoding="utf-8").read(); he = src.index("</head>"); head = src[:he]
    head = re.sub(r'\s*<script type="application/ld\+json">.*?</script>', "", head, flags=re.S)
    head = head.replace('<script src="/track.js" defer></script>', ld(ld_service) + "\n    " + ld(ld_page) + "\n    " + ld(ld_crumb) + "\n    " + ld(ld_faq) + '\n    <script src="/track.js" defer></script>', 1)
    head = re.sub(r"<title>.*?</title>", f"<title>{esc(TITLE)}</title>", head)
    head = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{html.escape(DESC)}">', head)
    head = re.sub(r'<meta name="keywords" content="[^"]*">', f'<meta name="keywords" content="{html.escape(C.get("keywords",""))}">', head)
    head = head.replace("https://41labs.ai/ai-sales-agent-singapore", url)
    for tag in ("og:title", "twitter:title"): head = re.sub(rf'(<meta (?:property|name)="{tag}" content=")[^"]*(">)', rf'\g<1>{html.escape(TITLE)}\g<2>', head)
    for tag in ("og:description", "twitter:description"): head = re.sub(rf'(<meta (?:property|name)="{tag}" content=")[^"]*(">)', rf'\g<1>{html.escape(DESC)}\g<2>', head)
    rest = src[he:]; m0 = rest.index('<main id="main">'); m1 = rest.index("</main>") + len("</main>")
    out = head + rest[:m0] + body + rest[m1:]
    assert f'<link rel="canonical" href="{url}">' in out
    relax = "--allow-long" in sys.argv
    problems, stats = check(out, max_words=1400, faq=FAQ, price_token="S$690", max_ctas=3, max_sentence=(200 if relax else 28))
    if relax:
        from gates import prose_sentences
        longs = [s for s in prose_sentences(out) if len(s.split()) > 28]
        print(f"long sentences ({len(longs)}):"); [print("   ", len(s.split()), "w:", s[:110]) for s in longs]
    print(slug, stats)
    if problems:
        print("REFUSED:"); [print("  -", p) for p in problems]; return None
    if check_only: return None
    path = out_path or os.path.join(ROOT, "industries", slug + ".html")
    open(path, "w", encoding="utf-8").write(out); print("written", path); return path

if __name__ == "__main__":
    args = [x for x in sys.argv[1:] if not x.startswith("--")]
    outp = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else None
    C = json.load(open(args[0]))
    ok = build(C, check_only="--check" in sys.argv, out_path=outp)
    sys.exit(0 if ok or "--check" in sys.argv else 1)
