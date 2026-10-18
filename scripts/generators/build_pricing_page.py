#!/usr/bin/env python3
"""Build /pricing, the one page on 41labs.ai that shows 41 Sales Team prices.

Copy is word for word from the site copy deck v2 (18 Oct 2026), section PRICING.
The plan list, the visible FAQ and the JSON-LD (Product + AggregateOffer, FAQPage,
BreadcrumbList) are all written from the same Python data, so they cannot drift.

Rules this page keeps:
- No per-conversation overage fee, no credits, no Meta fees, anywhere.
- No Review or AggregateRating markup.
- The payback calculator (moved from the old homepage) always ends with
  "Worked out from the numbers you entered." and never shows a per-conversation fee.

Run: python3 scripts/generators/build_pricing_page.py  (twice: the second run changes nothing)
"""
from __future__ import annotations

import html
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
PARTIALS = HERE / "partials"
ORIGIN = "https://41labs.ai"
URL = f"{ORIGIN}/pricing"

BOOK = "/ai-closer?utm_source=41labs.ai&utm_medium=organic&utm_campaign=pricing#qualify"
WA_DEMO = "https://wa.me/6580124848?text=Hi%2C%20I%20want%20to%20see%20how%2041%20Closer%20would%20answer%20my%20customers."
WA_NUMBERS = "https://wa.me/6580124848?text=Hi%2041%20Labs%21%20I%27m%20exploring%20AI%20for%20my%20business%20and%20not%20sure%20where%20to%20start."

TITLE = "Pricing: 41 Sales Team AI sales team plans | 41 Labs"
META = ("One monthly plan with the whole AI sales team. The build is free, billing starts the day it goes live, "
        "month to month. Plans from S$299 in Singapore.")

# name, monthly price (int), "from" price?, conversations label, extra line from the deck
PLANS = [
    ("Start", 299, False, "100", "For trying it on your own customers first."),
    ("Starter", 690, False, "350", ""),
    ("Pro", 1490, False, "1,000", ""),
    ("Scale", 4300, False, "3,000", "Adds an account manager and monthly tuning."),
    ("Custom", 7900, True, "6,000", "And up, for many brands or many numbers."),
]

INCLUDES = [
    ('<a href="/41-closer">AI Sales Closer</a>', ""),
    ('<a href="/ai-operations-admin">AI Operations Admin</a>', ""),
    ('<a href="/ai-manager">AI Manager</a>', ""),
    ("AI Leads Generator when it launches", "Coming soon"),
    ("The build", ""),
    ("Your catalogue and prices loaded", ""),
    ("WhatsApp and Messenger", ""),
]

FAQ = [
    ("Is there a setup fee?", "No, the build is included."),
    ("When does billing start?", "The day it goes live."),
    ("Can I stop?", "Yes, 30 days notice."),
    ("What if I get more conversations than my plan?",
     "It never stops answering. We tell you before you reach your plan's limit and help you pick the right plan."),
    ("Do you charge GST?", "No GST is charged."),
]

ICONS = {
    "wa": '<path d="M3 21l1.6-4.8A8.5 8.5 0 1 1 7.8 19.4z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-1.9-1-1 .8c-1-.4-1.9-1.3-2.3-2.3l.8-1-1-1.9z"/>',
    "arrow": '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
}


def icon(name: str, size: int = 18) -> str:
    return (f'<svg viewBox="0 0 24 24" width="{size}" height="{size}" fill="none" stroke="currentColor" '
            f'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONS[name]}</svg>')


def esc(s: str) -> str:
    # Keep apostrophes literal so the visible FAQ matches the FAQPage JSON-LD character for character.
    return html.escape(s, quote=False)


def money(n: int) -> str:
    return f"S${n:,}"


def jsonld(obj: dict) -> str:
    return '    <script type="application/ld+json">' + json.dumps(obj, indent=1, ensure_ascii=False) + "</script>"


def conversations_line(conv: str) -> str:
    return f"about {conv} end-to-end sales conversations a month"


def schemas() -> str:
    offers = []
    for name, price, is_from, conv, extra in PLANS:
        desc = f"{name} plan, {'from ' if is_from else ''}{money(price)} a month: {conversations_line(conv)}"
        if name == "Custom":
            desc += " and up, for many brands or many numbers"
        desc += ". The whole AI sales team on every plan."
        spec = {"@type": "UnitPriceSpecification", "priceCurrency": "SGD", "unitCode": "MON",
                "unitText": "month"}
        if is_from:
            spec["minPrice"] = str(price)
        else:
            spec["price"] = str(price)
        offers.append({
            "@type": "Offer",
            "name": name,
            "price": str(price),
            "priceCurrency": "SGD",
            "description": desc,
            "url": f"{URL}#plans",
            "availability": "https://schema.org/InStock",
            "priceSpecification": spec,
        })
    product = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": "41 Sales Team",
        "alternateName": ["41 Closer"],
        "description": META,
        "url": URL,
        "image": f"{ORIGIN}/og-image.jpg?v=2",
        "category": "AI sales team for WhatsApp and Facebook Messenger",
        "brand": {"@type": "Brand", "name": "41 Sales Team"},
        "manufacturer": {"@type": "Organization", "name": "41 Labs", "url": ORIGIN},
        "offers": {
            "@type": "AggregateOffer",
            "priceCurrency": "SGD",
            "lowPrice": "299",
            "highPrice": "7900",
            "offerCount": "5",
            "offers": offers,
        },
    }
    faq = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQ
        ],
    }
    crumbs = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{ORIGIN}/"},
            {"@type": "ListItem", "position": 2, "name": "Pricing", "item": URL},
        ],
    }
    return "\n".join(jsonld(o) for o in (product, faq, crumbs))


def plan_cards() -> str:
    out = []
    for name, price, is_from, conv, extra in PLANS:
        frm = '<span class="from">From</span>' if is_from else ""
        extra_html = f'<p class="plan-extra">{esc(extra)}</p>' if extra else ""
        out.append(
            f'<li class="plan" id="plan-{name.lower()}">'
            f'<div class="plan-head"><h3>{name}</h3>'
            f'<p class="plan-price">{frm}<b class="tabular">{money(price)}</b><span class="per">a month</span></p></div>'
            f'<p class="plan-conv">About <b class="tabular">{conv}</b> <span class="nowrap">end-to-end</span> sales conversations a month</p>'
            f'{extra_html}</li>'
        )
    return "\n                ".join(out)


def includes_list() -> str:
    items = []
    for text, pill in INCLUDES:
        pill_html = f' <span class="pill">{pill}</span>' if pill else ""
        items.append(f"<li>{text}{pill_html}</li>")
    return "".join(items)


def faq_html() -> str:
    return "".join(
        f'<details{" open" if i == 0 else ""}><summary>{esc(q)}</summary><p>{esc(a)}</p></details>'
        for i, (q, a) in enumerate(FAQ)
    )


def calc_plan_chips() -> str:
    chips = []
    for name, price, is_from, conv, extra in PLANS:
        if is_from:
            continue  # Custom is quoted on the call, so it has no fixed price to divide.
        checked = " checked" if name == "Starter" else ""
        chips.append(
            f'<input type="radio" name="plan" id="p{name}" value="{price}" data-name="{name}"{checked}>'
            f'<label for="p{name}">{name}<small>{money(price)} a month</small></label>'
        )
    return "\n                            ".join(chips)


HEAD_PIXEL = """    <!-- Meta Pixel -->
    <script>
        window.FB_PIXEL_ID = '24659272643698089';
        (function(){
            if(!window.FB_PIXEL_ID || window.FB_PIXEL_ID === 'REPLACE_WITH_PIXEL_ID') return;
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', window.FB_PIXEL_ID);
            fbq('track', 'PageView');
        })();
    </script>"""

HEAD_ANALYTICS = """    <script>/* deferred analytics for Core Web Vitals: load on first interaction or after 4s. Same loader as /41-closer. */
    (function(){var loaded=false;function load(){if(loaded)return;loaded=true;
      var g=document.createElement('script');g.async=1;g.src='https://www.googletagmanager.com/gtag/js?id=G-VQQ49H8N1L';document.head.appendChild(g);
      window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','G-VQQ49H8N1L');
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WQJF7DK7');}
      var e=['scroll','mousemove','touchstart','click','keydown'];e.forEach(function(n){window.addEventListener(n,load,{once:true,passive:true});});setTimeout(load,4000);})();
    </script>
    <script src="/track.js" defer></script>"""

CONTACT_TRACK = """    <!-- Track WhatsApp clicks as the 'Contact' conversion -->
    <script>
        (function(){
            document.querySelectorAll('a[href*="wa.me/6580124848"]').forEach(function(a){
                a.addEventListener('click', function(){ if(window.fbq){ fbq('track','Contact',{content_name:'pricing_whatsapp'}); } });
            });
        })();
    </script>"""

CALC_JS = """    <script>
    (function(){
      // Payback: plan price divided by average sale, rounded up. Only the numbers the visitor picked.
      var form = document.getElementById('calc');
      if (!form) return;
      function fmt(n){ return n.toLocaleString('en-SG'); }
      function calc(){
        var s = form.querySelector('input[name=sale]:checked'), p = form.querySelector('input[name=plan]:checked');
        if (!s || !p) return;
        var sale = +s.value, price = +p.value, name = p.dataset.name;
        var raw = price / sale, n = Math.max(1, Math.ceil(raw - 1e-9));
        var word = n === 1 ? 'more sale' : 'more sales';
        document.getElementById('c-n').textContent = n;
        document.getElementById('c-unit').innerHTML = word + ' a month<br>covers ' + name + '.';
        document.getElementById('c-sum').textContent = n + ' ' + word + ' a month covers ' + name + '.';
        var r = Math.round(raw * 100) / 100;
        document.getElementById('c-math').textContent = 'S$' + fmt(price) + ' a month divided by S$' + fmt(sale) + ' a sale is ' + r + '. ' + (Number.isInteger(raw) ? 'That is ' + n + '.' : 'Rounded up, that is ' + n + '.');
        document.getElementById('c-fine').textContent = 'Worked out from the numbers you entered.';
      }
      form.addEventListener('change', calc);
      calc();
    })();
    </script>"""

PAGE_CSS = """    <style>
        .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
        .pricing-hero{padding-block:56px 40px}
        .pricing-hero .lede{margin-inline:auto}
        .pricing-hero .btn-row{justify-content:center}
        .pricing-hero .note{margin:14px 0 0}
        .pricing-hero .breadcrumb{margin-bottom:24px}
        .plans-section{padding-top:8px}

        /* plan cards */
        .plans{list-style:none;margin:0;padding:0;display:grid;gap:16px;grid-template-columns:1fr}
        @media(min-width:640px){.plans{grid-template-columns:repeat(2,minmax(0,1fr))}.plans .plan:last-child{grid-column:1/-1}}
        @media(min-width:1080px){.plans{grid-template-columns:repeat(5,minmax(0,1fr))}.plans .plan:last-child{grid-column:auto}}
        .plan{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-card);padding:24px 20px;box-shadow:var(--shadow-panel);display:flex;flex-direction:column;gap:12px;min-width:0}
        .plan h3{font-size:17px;font-weight:600;color:var(--muted)}
        .plan-price{margin:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 8px}
        .plan-price b{font-size:32px;line-height:1.1;font-weight:700;letter-spacing:-.03em;color:var(--fg)}
        .plan-price .from{font-size:14px;color:var(--subtle);font-weight:500;white-space:nowrap}
        .plan-price .per{flex-basis:100%;font-size:14px;color:var(--subtle)}
        .nowrap{white-space:nowrap}
.plan-conv{margin:0;padding-top:12px;border-top:1px solid var(--border);font-size:15px;line-height:1.45;color:var(--muted)}
        .plan-conv b{color:var(--fg)}
        .plan-extra{margin:0;font-size:14px;line-height:1.45;color:var(--subtle)}
        .plan-head{display:flex;flex-direction:column;gap:12px}
        @media(min-width:1080px){.plan-price b{font-size:28px}}
        @media(max-width:639px){
          .plan{padding:20px}
          .plan-head{flex-direction:row;align-items:flex-start;justify-content:space-between;gap:12px}
          .plan-head h3{font-size:19px;color:var(--fg);padding-top:4px}
          .plan-price{justify-content:flex-end;text-align:right}
          .plan-price b{font-size:28px}
        }

        /* definition box and what every plan includes */
        .define{margin-top:24px;display:grid;gap:8px}
        .define h3{font-size:17px}
        .define p{margin:0;color:var(--muted)}
        .incl{margin-top:16px}
        .incl .card h3{margin-bottom:16px}
        .incl .checks li{color:var(--fg)}
        .incl .checks a{color:var(--fg);text-decoration-color:var(--border-strong)}
        .incl .checks a:hover{color:var(--primary-text)}
        .incl .checks .pill{margin-left:6px;vertical-align:1px}
        .terms{display:grid;gap:16px;align-content:start}
        .terms .card-flat p{margin:0;color:var(--muted)}
        .terms .card-flat b{color:var(--fg)}

        /* payback calculator (moved from the old homepage) */
        .calc{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);overflow:hidden;padding:0}
        .calc-in{padding:40px;border-right:1px solid var(--border);margin:0}
        .calc-in fieldset{border:0;padding:0;margin:0 0 28px;min-width:0}
        .calc-in fieldset:last-child{margin-bottom:0}
        .calc-in legend{font-size:15px;font-weight:600;margin-bottom:12px;padding:0}
        .chips{display:flex;flex-wrap:wrap;gap:8px}
        .chips input{position:absolute;opacity:0;pointer-events:none}
        .chips label{display:inline-flex;flex-direction:column;justify-content:center;min-height:44px;padding:6px 16px;border-radius:var(--r-pill);border:1px solid var(--border-strong);background:var(--surface);font-size:15px;font-weight:500;cursor:pointer;line-height:1.2;transition:background .12s var(--ease)}
        .chips label small{font-size:12px;font-weight:400;color:var(--subtle)}
        .chips label:hover{background:var(--neutral-soft)}
        .chips input:checked+label{background:var(--fg);border-color:var(--fg);color:#fff}
        .chips input:checked+label small{color:rgba(255,255,255,.72)}
        .chips input:focus-visible+label{outline:2px solid var(--primary-text);outline-offset:2px}
        .chips.plans-pick{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
        .chips.plans-pick label{border-radius:16px;padding:8px 16px}
        .calc-out{padding:40px;display:flex;flex-direction:column;justify-content:center;background:radial-gradient(360px 240px at 100% 0%,rgba(125,211,252,.22),transparent 70%),radial-gradient(360px 240px at 0% 100%,rgba(74,222,128,.18),transparent 70%),#fbfcfb}
        .calc-out .big{display:flex;align-items:baseline;gap:12px}
        .calc-out .n{font-size:96px;line-height:1;font-weight:600;letter-spacing:-.05em;font-variant-numeric:tabular-nums}
        .calc-out .unit{font-size:24px;font-weight:600;letter-spacing:-.015em;line-height:1.3}
        .calc-out .math{margin:20px 0 0;padding-top:16px;border-top:1px solid var(--border);font-size:14px;color:var(--muted)}
        .calc-out .fine{margin:8px 0 0;font-size:12.5px;color:var(--subtle)}
        .calc-out .btn{margin-top:24px;align-self:flex-start}
        @media(max-width:760px){
          .calc{grid-template-columns:1fr}.calc-in{padding:24px 20px;border-right:0;border-bottom:1px solid var(--border)}
          .calc-out{padding:28px 20px}.calc-out .n{font-size:72px}.calc-out .unit{font-size:20px}
          .chips{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.chips label{padding:6px 14px;font-size:14px}
          .calc-out .btn{align-self:stretch;white-space:normal;text-align:center}
        }

        .center-block{margin-inline:auto}
        @media(max-width:640px){.cta-band{padding:32px 20px}}
    </style>"""


def build() -> str:
    header = (PARTIALS / "header.html").read_text(encoding="utf-8").strip()
    footer = (PARTIALS / "footer.html").read_text(encoding="utf-8").strip()
    book = html.escape(BOOK)
    t = html.escape(TITLE, quote=True)
    m = html.escape(META, quote=True)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{t}</title>
    <meta name="description" content="{m}">
    <meta name="keywords" content="41 Sales Team pricing, AI sales team pricing, WhatsApp AI sales agent price Singapore, AI sales agent plans, 41 Closer pricing">
    <meta name="author" content="41 Labs">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
    <link rel="canonical" href="{URL}">

{HEAD_PIXEL}

    <!-- Geo Tags -->
    <meta name="geo.region" content="SG">
    <meta name="geo.placename" content="Singapore">

    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="{URL}">
    <meta property="og:title" content="{t}">
    <meta property="og:description" content="{m}">
    <meta property="og:image" content="https://41labs.ai/og-image.jpg?v=2">
    <meta property="og:site_name" content="41 Labs">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{t}">
    <meta name="twitter:description" content="{m}">
    <meta name="twitter:image" content="https://41labs.ai/og-image.jpg?v=2">

    <!-- Favicons -->
    <link rel="icon" type="image/png" sizes="32x32" href="logo-icon.png">
    <link rel="icon" type="image/png" sizes="16x16" href="logo-icon.png">
    <link rel="apple-touch-icon" href="logo-icon.png">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
    <link rel="stylesheet" href="/assets/41st/site.css">

    <!-- Generated by scripts/generators/build_pricing_page.py. Edit the generator, not this file. -->
{schemas()}
{PAGE_CSS}
{HEAD_ANALYTICS}
</head>
<body>
{header}
<main id="main">

    <header id="hero" class="hero wash pricing-hero">
        <div class="wrap center">
            <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> / <span aria-current="page">Pricing</span></nav>
            <h1>Pricing. <span class="h1-soft">The whole AI sales team on every plan.</span></h1>
            <p class="lede">The build is free. Billing starts the day it goes live. Month to month, 30 days notice, no contract.</p>
            <div class="btn-row">
                <a class="btn btn-primary btn-lg" href="{book}">Book a call</a>
                <a class="btn btn-secondary btn-lg" href="{WA_DEMO}" target="_blank" rel="noopener">{icon("wa")} Try it on WhatsApp</a>
            </div>
            <p class="note">30 minutes with Alexander. We build yours before the call.</p>
        </div>
    </header>

    <section id="plans" class="section plans-section" aria-labelledby="plans-h">
        <div class="wrap">
            <h2 id="plans-h" class="sr">Plans</h2>
            <ul class="plans">
                {plan_cards()}
            </ul>

            <div class="capsule define">
                <h3>What an end-to-end sales conversation is.</h3>
                <p>One customer, worked from their first message until they pay or decide not to. It qualifies every enquiry first, so the effort goes into customers who are ready to buy. The numbers are estimates: a short chat uses less of the plan, a long one with photos uses more.</p>
            </div>

            <div class="grid-2 incl">
                <div class="card">
                    <h3>Every plan includes</h3>
                    <ul class="checks">{includes_list()}</ul>
                </div>
                <div class="terms">
                    <div class="card-flat"><p><b>One-time fees:</b> only for connecting your own systems (CRM, booking, stock). Quoted per system on the call.</p></div>
                    <div class="card-flat"><p><b>Annual:</b> pay ten months, get twelve. Never required.</p></div>
                </div>
            </div>
        </div>
    </section>

    <section id="payback" class="section section-white">
        <div class="wrap">
            <div class="section-head">
                <span class="eyebrow">Your numbers</span>
                <h2>How many extra sales pay for it</h2>
                <p class="lede">Pick your average sale and a plan. We divide the plan price by your sale and round up.</p>
            </div>
            <div class="card calc">
                <form class="calc-in" id="calc" onsubmit="return false">
                    <fieldset>
                        <legend>Your average sale</legend>
                        <div class="chips">
                            <input type="radio" name="sale" id="s200" value="200"><label for="s200">S$200</label>
                            <input type="radio" name="sale" id="s500" value="500" checked><label for="s500">S$500</label>
                            <input type="radio" name="sale" id="s1000" value="1000"><label for="s1000">S$1,000</label>
                            <input type="radio" name="sale" id="s2000" value="2000"><label for="s2000">S$2,000</label>
                        </div>
                    </fieldset>
                    <fieldset>
                        <legend>Your plan</legend>
                        <div class="chips plans-pick">
                            {calc_plan_chips()}
                        </div>
                    </fieldset>
                </form>
                <div class="calc-out">
                    <div class="big" aria-hidden="true"><span class="n" id="c-n">2</span><span class="unit" id="c-unit">more sales a month<br>covers Starter.</span></div>
                    <p class="sr" id="c-sum" aria-live="polite">2 more sales a month covers Starter.</p>
                    <p class="math" id="c-math">S$690 a month divided by S$500 a sale is 1.38. Rounded up, that is 2.</p>
                    <p class="fine" id="c-fine">Worked out from the numbers you entered.</p>
                    <a href="{WA_NUMBERS}" target="_blank" rel="noopener" class="btn btn-secondary">Talk through your numbers on WhatsApp</a>
                </div>
            </div>
        </div>
    </section>

    <section id="faq" class="section">
        <div class="wrap">
            <div class="section-head center">
                <span class="eyebrow">Questions</span>
                <h2>What owners ask about pricing.</h2>
            </div>
            <div class="faq read center-block">{faq_html()}</div>
        </div>
    </section>

    <section id="start-now" class="section" style="padding-top:0">
        <div class="wrap">
            <div class="cta-band wash">
                <h2>Find the plan that fits on the call</h2>
                <div class="btn-row">
                    <a class="btn btn-primary btn-lg" href="{book}">Book a call</a>
                </div>
            </div>
        </div>
    </section>

</main>
{footer}

{CONTACT_TRACK}
{CALC_JS}
</body>
</html>
"""


def main() -> None:
    out = ROOT / "pricing.html"
    text = build()
    for bad in ("—", "‘", "’", "“", "”"):
        assert bad not in text, f"banned character {bad!r} in pricing.html"
    old = out.read_text(encoding="utf-8") if out.exists() else None
    if old != text:
        out.write_text(text, encoding="utf-8")
        print(f"wrote {out.relative_to(ROOT)}")
    else:
        print(f"unchanged {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
