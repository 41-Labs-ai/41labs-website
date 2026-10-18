#!/usr/bin/env python3
"""Build /41-closer, the AI Sales Closer page (one of the four AIs in 41 Sales Team), from this file alone.

17 Oct 2026 redesign: the whole page is generated here (head, shared header, body, shared footer), on the
shared 41 Sales Team stylesheet (assets/41st/site.css). Light, sentence case, WhatsApp-style chats.
SEO rules: URL, canonical, og:url, robots unchanged. Tracking scripts (Meta pixel, GA loader,
closer-analytics.js, track.js, the Contact tracker) are copied verbatim. Every section keeps an id,
because closer-analytics.js attributes time to section[id] / header[id].
Facts: 41 Labs/pricing/41-CLOSER-PRICING.md. Rule: no overage price, no Meta fee, no guarantee, no invented number.
Run twice: the second run must change nothing."""
import re, json, html, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gates import check, visible_text
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
PAGE = os.path.join(ROOT, "41-closer.html")
PARTIALS = os.path.join(HERE, "partials")

# CTA destinations: keep exactly (the live Meta ads and the Contact tracker key off these).
WA = "https://wa.me/6580124848?text=Hi%2C%20I%20want%20to%20see%20how%2041%20Closer%20would%20answer%20my%20customers."
WA_TRY = "https://wa.me/6580124848?text=Hi%2C%20I%20am%20trying%2041%20Closer.%20Show%20me%20how%20you%20would%20handle%20my%20customers."
# 18 Oct 2026: the page exists to get a booked call. Every "Book a call" goes to the qualify form on /ai-closer.
BOOK = "/ai-closer?utm_source=41labs.ai&amp;utm_medium=organic&amp;utm_campaign=ai-sales-closer#qualify"
BOOK_NOTE = "30 minutes with Alexander. We build yours before the call."

TITLE = "AI Sales Closer: WhatsApp AI closer | 41 Sales Team by 41 Labs"
DESC = "The AI Sales Closer answers every WhatsApp enquiry in seconds, quotes your real prices and follows up until the customer pays. Built and run by 41 Labs."
KEYWORDS = "AI Sales Closer, AI closer, 41 Closer, 41 Sales Team, WhatsApp AI sales agent, close more deals WhatsApp, AI sales rep Singapore, done for you WhatsApp sales"
assert len(TITLE) <= 65, len(TITLE)
assert len(DESC) <= 165, len(DESC)

# The homepage team section, if the homepage has one yet.
try:
    TEAM_HREF = "/#team" if 'id="team"' in open(os.path.join(ROOT, "index.html"), encoding="utf-8").read() else "/"
except OSError:
    TEAM_HREF = "/"

# Answer capsule: words kept exactly, product name swapped (AI engines quote this passage).
CAPSULE = ("The AI Sales Closer is a managed AI sales agent on your own WhatsApp number. It answers every customer in seconds, at any hour, "
           "quotes from your real prices, asks the one qualifying question, and takes the payment or books the slot. "
           "41 Labs builds it before you pay and runs it for you.")
CAPSULE_2 = ("We measured the gap it closes. One real enquiry sent to 25 Singapore businesses between 8pm and 11pm: one replied within five minutes, "
             "the median wait was 13.3 hours, four never replied. The study is linked below.")

# Wins: copy deck v2 (18 Oct 2026), words exact. No prices on this page: plans live on /pricing.
WINS = [
    ("message", "Every enquiry answered in seconds.", "Day or night, on your own number."),
    ("check", "Real prices, every time.", "It quotes from your own list, so nothing is guessed."),
    ("clock", "Quiet customers hear back.", "It messages them again on the day they asked for."),
    ("lock", "Payment taken in the chat.", "It sends the link or books the slot, then tells your team."),
]

# The homepage's three steps (copy deck v2): the time and effort levers.
STEPS = [
    ("Send us your website.", "We build your AI sales team on your products and prices before we meet."),
    ("Test it on the call.", "You message it from your own phone, with your hardest questions."),
    ("It goes live that day.", "We connect your WhatsApp and it starts answering your customers. We keep tuning it with you."),
]

# Visible FAQ and FAQPage JSON-LD are both built from this list, so they always match.
# Answers may hold one <a>: the visible FAQ shows it, the JSON-LD gets the same words without the tag.
FAQ = [
    ("Will it sound like a bot?",
     "No. We train it on your products, your prices and how you talk to customers, and we keep tuning it. You test it yourself before it goes live."),
    ("What do I need to prepare?",
     "Your website. A price list or a voice note helps. We do the rest."),
    ("Does it use my own WhatsApp number?",
     "Yes. It runs on your business WhatsApp number through the WhatsApp Business API. We connect it for you. Your customers see your brand, not ours."),
    ("What languages does it reply in?",
     "Your customer's language. If they write in Chinese, it answers in Chinese."),
    ("What does it cost?",
     'Plans start small and grow with the number of conversations. See <a href="/pricing">pricing</a>, or we work out the right plan with you on the call.'),
    ("What if it does not work for me?",
     "You stop. One month is the only commitment you ever make, then month to month with 30 days notice. There is no guarantee attached, because you message your own agent before any money moves. You own the agent and everything it learns, and we never share or sell your data."),
    ("Is my data safe?",
     "We follow PDPA. If you leave, we export your data and hand it to you."),
]

def plain(a):
    return re.sub(r"<[^>]+>", "", a)

PRODUCT_LD = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "41 Sales Team AI Sales Closer",
    "alternateName": ["41 Closer", "AI Sales Closer"],
    "description": "The AI Sales Closer from 41 Sales Team (formerly 41 Closer) is the AI closer for WhatsApp. Not a chatbot that answers questions, but an AI that closes the deal and takes payment, day and night. A done-for-you WhatsApp AI sales agent built and run by 41 Labs. Live after one call.",
    "brand": {"@type": "Brand", "name": "41 Sales Team", "alternateName": ["41 Closer", "AI Sales Closer"]},
    "manufacturer": {"@type": "Organization", "name": "41 Labs", "url": "https://41labs.ai"}
}

def faq_ld():
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": plain(a)}} for q, a in FAQ]}

def ld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False, indent=1) + "</script>"

# Lucide-style line icons, stroke 1.75. The sparkle only ever means the AI.
def icon(name, size=20):
    paths = {
        "sparkle": '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
        "megaphone": '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 8a5 5 0 0 1 0 8"/><path d="M18 5a9 9 0 0 1 0 14"/>',
        "message": '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
        "clipboard": '<rect x="7" y="4" width="10" height="4" rx="1"/><path d="M17 6h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1"/><path d="M9 14l2 2 4-4"/>',
        "chart": '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
        "check": '<path d="M5 12l5 5L20 7"/>',
        "lock": '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
        "whatsapp": '<path d="M3 21l1.6-4.8A8.5 8.5 0 1 1 7.8 19.4z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-1.9-1-1 .8c-1-.4-1.9-1.3-2.3-2.3l.8-1-1-1.9z"/>',
        "arrow": '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
        "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    }
    return f'<svg viewBox="0 0 24 24" width="{size}" height="{size}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{paths[name]}</svg>'

def bubble(kind, text, time=None, extra=""):
    who = '<span class="who">AI</span>' if kind == "ai" else ""
    t = f'<span class="t">{time}</span>' if time else ""
    return f'<div class="bubble {kind}{extra}">{who}{"<br>" if who else ""}{text}{t}</div>'

def faq_html():
    items = "".join(f'<details{" open" if i == 0 else ""}><summary>{html.escape(q)}</summary><p>{a if "<a " in a else html.escape(a)}</p></details>' for i, (q, a) in enumerate(FAQ))
    return f'''<section id="faq" class="section">
        <div class="wrap">
            <div class="section-head center">
                <span class="eyebrow">Questions</span>
                <h2>What buyers ask before they start.</h2>
            </div>
            <div class="faq read center-block">{items}</div>
        </div>
    </section>'''

def wins_html():
    return "".join(f'<div class="card win"><span class="icon-chip">{icon(ic, 20)}</span><h3>{h}</h3><p>{p}</p></div>' for ic, h, p in WINS)

def steps_html():
    return "".join(f'''<div class="card step-card"><span class="step-num">{i}</span><h3>{h}</h3><p>{p}</p></div>''' for i, (h, p) in enumerate(STEPS, 1))

def ex_card(tag, msgs, outcome):
    chat = "".join(bubble(k, t) for k, t in msgs)
    return f'''<div class="card ex-card">
                    <p class="ex-tag">{tag}</p>
                    <div class="chat">{chat}</div>
                    <p class="ex-out"><span class="pill pill-good">{icon("check", 12)} {outcome}</span></p>
                </div>'''

TEAM = [
    ("megaphone", "AI Leads Generator", '<span class="pill">Coming soon</span>', False, None),
    ("message", "AI Sales Closer", '<span class="pill pill-good">This page</span>', True, None),
    ("clipboard", "AI Operations Admin", "", False, "/ai-operations-admin"),
    ("chart", "AI Manager", "", False, "/ai-manager"),
]

def team_strip():
    items = []
    for ic, name, pill, here, href in TEAM:
        inner = f'<span class="ts-icon">{icon(ic, 18)}</span><span class="ts-text"><span class="ts-name">{name}</span>{pill}</span>'
        if here:
            items.append(f'<li><span class="ts-item here" aria-current="page">{inner}</span></li>')
        else:
            items.append(f'<li><a class="ts-item" href="{href or TEAM_HREF}">{inner}</a></li>')
    return f'''<div class="team-strip" aria-label="The four AIs in 41 Sales Team">
                <p class="ts-label">Part of 41 Sales Team</p>
                <ul>{"".join(items)}</ul>
            </div>'''

PAGE_CSS = """
        /* /41-closer page layer on top of site.css. Tokens only. */
        .hero-grid{display:grid;gap:48px;grid-template-columns:1fr;align-items:center}
        @media(min-width:960px){.hero-grid{grid-template-columns:1.08fr .92fr;gap:56px}}
        .hero-grid>*{min-width:0}
        .hero h1 .h1-soft{display:block}
        .phone{max-width:380px;margin:0 auto;background:var(--surface);border:1px solid var(--border);border-radius:28px;box-shadow:var(--shadow-overlay);overflow:hidden}
        .phone-top{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border)}
        .phone-av{width:36px;height:36px;border-radius:var(--r-pill);background:var(--primary-soft);color:var(--primary-text);display:grid;place-items:center;flex:none}
        .phone-top b{display:block;font-size:15px;font-weight:600;line-height:1.2}
        .phone-top small{display:block;font-size:12.5px;color:var(--primary-text)}
        .phone .chat{border-radius:0;min-height:372px;padding:16px 14px}
        .chat-day{align-self:center;font-size:12px;color:var(--subtle);background:var(--surface);padding:3px 10px;border-radius:var(--r-pill);box-shadow:var(--shadow-raised)}
        .paylink{display:flex;align-items:center;gap:8px;margin-top:6px;padding:8px 10px;border-radius:12px;background:rgba(255,255,255,.72);font-weight:500;font-size:14px;color:var(--fg)}
        .paylink svg{color:var(--primary-text)}
        .chat-event{align-self:center;margin-top:4px}
        .hero-caption{text-align:center;font-size:13px;color:var(--subtle);margin:12px 0 0}
        @media(prefers-reduced-motion:no-preference){
            .phone .arrive{opacity:0;transform:translateY(8px);animation:arrive .32s var(--ease) forwards}
            @keyframes arrive{to{opacity:1;transform:none}}
        }
        .team-strip{margin-top:56px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-card);padding:16px;box-shadow:var(--shadow-panel)}
        .ts-label{font-size:14px;color:var(--subtle);margin:0 0 10px 4px}
        .ts-label a{font-weight:500}
        .team-strip ul{list-style:none;margin:0;padding:0;display:grid;gap:8px;grid-template-columns:1fr 1fr}
        @media(min-width:900px){.team-strip ul{grid-template-columns:repeat(4,1fr)}}
        .ts-item{display:flex;align-items:center;gap:10px;min-height:52px;padding:10px 12px;border-radius:var(--r-panel);border:1px solid var(--border);text-decoration:none;color:var(--fg);font-weight:500;font-size:15px;line-height:1.3;transition:background .12s var(--ease)}
        a.ts-item:hover{background:var(--neutral-soft);color:var(--fg)}
        .ts-item.here{background:var(--primary-soft);border-color:transparent}
        .ts-icon{width:32px;height:32px;border-radius:var(--r-pill);background:var(--neutral-soft);color:var(--muted);display:grid;place-items:center;flex:none}
        .ts-item.here .ts-icon{background:var(--surface);color:var(--primary-text)}
        .ts-text{display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-width:0}
        .ts-text .pill{font-size:11.5px;padding:2px 8px}
        @media(max-width:520px){.ts-item{font-size:14px;padding:10px}.ts-icon{display:none}}
        .center-block{margin-inline:auto}
        .capsule{font-size:18px}
        .capsule-more{margin-top:16px;color:var(--muted)}
        .cta-note{margin:12px 0 0}
        @media(max-width:640px){.cta-note{text-align:center}}
        .wins{display:grid;gap:16px;grid-template-columns:1fr}
        @media(min-width:640px){.wins{grid-template-columns:1fr 1fr}}
        @media(min-width:1040px){.wins{grid-template-columns:repeat(4,1fr)}}
        .wins>*{min-width:0}
        .win h3{font-size:18px;margin-top:16px}
        .win p{margin:0}
        #not-for .section-head{margin-bottom:0}
        .step-card .step-num{width:36px;height:36px;border-radius:var(--r-pill);background:var(--primary-soft);color:var(--primary-text);display:grid;place-items:center;font-weight:600;font-size:15px;margin-bottom:16px}
        .ex-card{display:flex;flex-direction:column;gap:12px;padding:18px}
        .ex-card .ex-tag{font-size:13.5px;font-weight:500;color:var(--subtle);margin:0}
        .ex-card .chat{flex:1}
        .ex-card .ex-out{margin:0}
        .ex-note{margin:28px auto 0;max-width:720px;text-align:center;color:var(--muted)}
        .case{max-width:860px;margin:0 auto;padding:32px}
        .case-num{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;margin:16px 0 18px}
        .case-num b{font-size:clamp(40px,6vw,56px);line-height:1;font-weight:700;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
        .case-num span{color:var(--muted);font-size:16px;max-width:420px;line-height:1.45}
        .case .case-by{font-size:15px;color:var(--subtle);border-top:1px solid var(--border);padding-top:16px;margin-top:16px}
        .founder-card{max-width:900px;margin:0 auto}
        .founder-card .founder p{color:var(--muted)}
        .founder img{aspect-ratio:4/5}
        .final-grid{display:grid;gap:32px;grid-template-columns:1fr;align-items:center;text-align:left}
        @media(min-width:860px){.final-grid{grid-template-columns:1.3fr .7fr}}
        .final-grid .lede{margin:14px 0 0}
        .final-grid .btn-row{justify-content:flex-start}
        .qr-card{background:var(--bg);border:1px solid var(--border);border-radius:var(--r-panel);padding:20px;text-align:center;max-width:260px;margin:0 auto}
        .qr-card img{width:180px;height:180px;margin:0 auto 12px;border-radius:12px;background:#fff;padding:8px}
        .qr-card p{margin:0}
        .qr-card .qr-label{font-weight:600}
        .qr-card .qr-sub{font-size:13.5px;color:var(--subtle);margin-top:4px}
        @media(max-width:640px){.case{padding:22px}.cta-band{padding:32px 20px}}
"""

HEAD = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{html.escape(TITLE)}</title>
    <meta name="description" content="{html.escape(DESC)}">
    <meta name="keywords" content="{html.escape(KEYWORDS)}">
    <meta name="author" content="41 Labs">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
    <link rel="canonical" href="https://41labs.ai/41-closer">

    <!-- Meta Pixel (paste your Pixel ID below to activate) -->
    <script>
        window.FB_PIXEL_ID = '24659272643698089';
        (function(){{
            if(!window.FB_PIXEL_ID || window.FB_PIXEL_ID === 'REPLACE_WITH_PIXEL_ID') return;
            !function(f,b,e,v,n,t,s){{if(f.fbq)return;n=f.fbq=function(){{n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)}};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', window.FB_PIXEL_ID);
            fbq('track', 'PageView');
        }})();
    </script>

    <!-- Geo Tags -->
    <meta name="geo.region" content="SG">
    <meta name="geo.placename" content="Singapore">

    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://41labs.ai/41-closer">
    <meta property="og:title" content="{html.escape(TITLE)}">
    <meta property="og:description" content="{html.escape(DESC)}">
    <meta property="og:image" content="https://41labs.ai/og-image.jpg?v=2">
    <meta property="og:site_name" content="41 Labs">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{html.escape(TITLE)}">
    <meta name="twitter:description" content="{html.escape(DESC)}">
    <meta name="twitter:image" content="https://41labs.ai/og-image.jpg?v=2">

    <!-- Favicons -->
    <link rel="icon" type="image/png" sizes="32x32" href="logo-icon.png">
    <link rel="icon" type="image/png" sizes="16x16" href="logo-icon.png">
    <link rel="apple-touch-icon" href="logo-icon.png">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
    <link rel="stylesheet" href="/assets/41st/site.css">

    <!-- Product Schema (no offers: prices live on /pricing) -->
    {ld(PRODUCT_LD)}

    <!-- FAQ Schema -->
    {ld(faq_ld())}

    <style>{PAGE_CSS}    </style>
    <script>/* deferred analytics for Core Web Vitals: load on first interaction or after 4s.
    Same loader as the homepage. Without it this page had only the queueing stub in
    track.js, so nothing it recorded ever reached GA4 - on the page the live ads pay for. */
    (function(){{var loaded=false;function load(){{if(loaded)return;loaded=true;
      var g=document.createElement('script');g.async=1;g.src='https://www.googletagmanager.com/gtag/js?id=G-VQQ49H8N1L';document.head.appendChild(g);
      window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}window.gtag=gtag;gtag('js',new Date());gtag('config','G-VQQ49H8N1L');
      (function(w,d,s,l,i){{w[l]=w[l]||[];w[l].push({{'gtm.start':new Date().getTime(),event:'gtm.js'}});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);}})(window,document,'script','dataLayer','GTM-WQJF7DK7');}}
      var e=['scroll','mousemove','touchstart','click','keydown'];e.forEach(function(n){{window.addEventListener(n,load,{{once:true,passive:true}});}});setTimeout(load,4000);}})();
    </script>
    <script src="/closer-analytics.js"></script>
    <script src="/track.js" defer></script>
</head>
<body>
'''

HERO_CHAT = "".join([
    bubble("in", "Do you still have 200 units? Need them by Friday.", "2:14 am", ' arrive" style="animation-delay:.3s'),
    bubble("ai", "Yes, 200 in stock. $2,400 for the lot, ships today. Want me to lock it in?", "2:14 am", ' arrive" style="animation-delay:1.2s'),
    bubble("in", "Yes. Send me the payment link.", "2:15 am", ' arrive" style="animation-delay:2.2s'),
    bubble("ai", f'Done. Pay here.<span class="paylink">{icon("lock", 16)} Secure checkout, $2,400</span>', "2:15 am", ' arrive" style="animation-delay:3.1s'),
    f'<span class="pill pill-good chat-event arrive" style="animation-delay:4s">{icon("check", 12)} Paid $2,400</span>',
])

MAIN = f'''<main id="main">

    <header id="hero" class="hero wash">
        <div class="wrap">
            <div class="hero-grid">
                <div>
                    <span class="eyebrow">AI Sales Closer for WhatsApp</span>
                    <h1>AI Sales Closer. <span class="h1-soft">It closes the sale while you sleep.</span></h1>
                    <p class="lede">This is the AI Sales Closer, one of four AIs in 41 Sales Team (formerly 41 Closer). A customer messages your WhatsApp at 2am. It answers in seconds, quotes your price and takes the payment. We build it on your business and run it for you.</p>
                    <div class="btn-row">
                        <a class="btn btn-primary btn-lg" href="{BOOK}">Book a call</a>
                        <a class="btn btn-secondary btn-lg" href="{WA_TRY}" target="_blank" rel="noopener">{icon("whatsapp", 18)} Try it on WhatsApp</a>
                    </div>
                    <p class="note cta-note">{BOOK_NOTE}</p>
                    <ul class="hero-checks">
                        <li>Replies in seconds, day and night</li>
                        <li>Live after one call</li>
                        <li>Month to month, no contract</li>
                    </ul>
                </div>
                <div>
                    <div class="phone" role="img" aria-label="Example WhatsApp chat: a customer asks for 200 units at 2:14am, the AI Sales Closer quotes $2,400, sends a payment link and the customer pays.">
                        <div class="phone-top">
                            <span class="phone-av">{icon("sparkle", 18)}</span>
                            <span><b>Your WhatsApp</b><small>AI Sales Closer, online</small></span>
                        </div>
                        <div class="chat">{HERO_CHAT}</div>
                    </div>
                    <p class="hero-caption">Example chat</p>
                </div>
            </div>
            {team_strip()}
        </div>
    </header>

    <section id="wins" class="section">
        <div class="wrap">
            <div class="section-head center">
                <span class="eyebrow">What changes for you</span>
                <h2>More sales, and your evenings back.</h2>
            </div>
            <div class="wins">{wins_html()}</div>
        </div>
    </section>

    <section id="capsule" class="section-sm section-white">
        <div class="wrap">
            <div class="read center-block">
                <div class="capsule"><p><strong>{CAPSULE}</strong></p></div>
                <p class="capsule-more">{CAPSULE_2} <a href="/blog/whatsapp-response-time-singapore-study">Read the study</a>.</p>
            </div>
        </div>
    </section>

    <section id="how-it-starts" class="section">
        <div class="wrap">
            <div class="section-head center">
                <span class="eyebrow">How it starts</span>
                <h2>Live after one call.</h2>
            </div>
            <div class="grid-3">{steps_html()}</div>
            <div class="btn-row center"><a class="btn btn-primary btn-lg" href="{BOOK}">Book a call</a></div>
        </div>
    </section>

    <section id="see-it-work" class="section section-white">
        <div class="wrap">
            <div class="section-head center">
                <span class="eyebrow">See it in action</span>
                <h2>It closes the sale inside the chat.</h2>
                <p class="lede">Three messages your customers send today, and what the agent does with each.</p>
            </div>
            <div class="grid-3">
                {ex_card("Distributor, 2:15am", [("in", "Got 200 units of the 12mm bolts? Need them this week."), ("ai", "Yes, 200 in stock. $2,400 the lot, ships today. Want me to lock it in?"), ("in", "Do it.")], "Closed, $2,400")}
                {ex_card("Retail, saved a cold lead", [("in", "How much for the leather sofa?"), ("ai", "It is $1,890 with free delivery this week. Want me to hold one for you?"), ("in", "Yes please, hold it.")], "Saved the sale, $1,890")}
                {ex_card("Services, books and takes payment", [("in", "Any slots this Saturday?"), ("ai", f'Yes, 2pm Saturday is open. A $50 deposit holds it.<span class="paylink">{icon("lock", 16)} Pay here</span>'), ("in", "Paid. See you then.")], "Booked, paid, Sat 2pm")}
            </div>
            <p class="ex-note">Prices and names above are examples. When a chat gets tricky, or the customer asks for a person, it hands over to your team with the whole history.</p>
        </div>
    </section>

    <section id="not-a-demo" class="section">
        <div class="wrap">
            <div class="section-head center">
                <span class="eyebrow">Not a demo</span>
                <h2>It is already running real businesses.</h2>
            </div>
            <div class="card case">
                <span class="pill">Real client, kept private on request</span>
                <div class="case-num"><b>$300,000</b><span>of sales every month through the AI Sales Closer at one Singapore industrial supplier</span></div>
                <p>It quotes live from the supplier's own catalogue, replies in seconds day and night, and our team steps in only for the tricky ones. It does not go off script, because we set the guardrails and watch it.</p>
                <p class="case-by">In our published quote-automation case, quote time went from 3 hours to 5 minutes, errors fell 90% and sales capacity rose 35%. <a href="/case-studies/quote-automation-professional-services">Read the case</a>.</p>
            </div>
        </div>
    </section>

    <section id="not-for" class="section section-white">
        <div class="wrap">
            <div class="section-head center">
                <span class="eyebrow">Honest limit</span>
                <h2>Who should not buy this.</h2>
                <p class="lede">If you get a handful of enquiries a week and someone answers them the same day, a WhatsApp auto-reply is enough, and we will tell you so. The AI Sales Closer pays for itself when messages arrive after hours, or faster than one person can answer.</p>
            </div>
        </div>
    </section>

    <section id="founder" class="section">
        <div class="wrap">
            <div class="section-head center">
                <span class="eyebrow">From the founder</span>
                <h2>Why I built this.</h2>
            </div>
            <div class="founder-card">
                <div class="founder">
                    <img src="/assets/closer/lp-founder-letter.webp" alt="Alexander Lee, founder of 41 Labs" width="720" height="1024" loading="lazy">
                    <div>
                        <p>I watched good businesses lose sales for one reason. The customer messaged, and nobody answered in time. The product was right. The price was right. The reply was slow.</p>
                        <p>The AI Sales Closer fixes that one thing. It answers every message, every hour, and follows up until the customer buys or says no. We build it, run it, and keep making it better.</p>
                        <p>If you do real business on WhatsApp, try the agent and see for yourself. Then book a call with me and we build yours.</p>
                        <p class="signoff">Alexander Lee<span>Founder, 41 Labs</span></p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    {faq_html()}

    <section id="start-now" class="section section-white">
        <div class="wrap">
            <div class="cta-band wash">
                <div class="final-grid">
                    <div>
                        <span class="eyebrow">Start now</span>
                        <h2>See it answer your own customers</h2>
                        <p class="lede">We build it on your business before we meet. You test it. If you like it, it goes live that day.</p>
                        <div class="btn-row">
                            <a class="btn btn-primary btn-lg" href="{BOOK}">Book a call</a>
                            <a class="btn btn-secondary btn-lg" href="{WA}" target="_blank" rel="noopener">{icon("whatsapp", 18)} Try it on WhatsApp</a>
                        </div>
                    </div>
                    <div class="qr-card">
                        <img src="41-closer-qr.png" alt="Scan to chat with the AI Sales Closer on WhatsApp" width="228" height="228" loading="lazy">
                        <p class="qr-label">Scan to talk to it now</p>
                        <p class="qr-sub">Point your phone camera here. It replies in seconds.</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

</main>
'''

TAIL = '''
    <!-- Track WhatsApp clicks as the 'Contact' conversion -->
    <script>
        (function(){
            document.querySelectorAll('a[href*="wa.me/6580124848"]').forEach(function(a){
                a.addEventListener('click', function(){ if(window.fbq){ fbq('track','Contact',{content_name:'pricing_whatsapp'}); } });
            });
        })();
    </script>
</body>
</html>
'''

def partial(name):
    return open(os.path.join(PARTIALS, name), encoding="utf-8").read().rstrip("\n") + "\n"

out = HEAD + partial("header.html") + MAIN + partial("footer.html") + TAIL
assert out.count('"FAQPage"') == 1 and out.count("<h1") == 1
# 1500 -> 1550 on 17 Oct 2026: the Start plan card (S$299) was added. Plans left this page on 18 Oct (1081 words), so down to 1150.
# No prices on this page (18 Oct brief): the price-position gate now pins the /pricing link line in the FAQ instead.
problems, stats = check(out, max_words=1150, faq=FAQ, max_ctas=3, price_token="See pricing", price_within=1.0)
for bad in ("S$", "$299", "$690", "a month", "From $"):
    if bad in visible_text(out):
        problems.append(f"price wording {bad!r} on a page that must show no prices")
for bad in ("—", "‘", "’", "“", "”"):
    if bad in out:
        problems.append(f"forbidden character {bad!r}")
print(stats)
if "--text" in sys.argv:
    print(visible_text(out))
if problems:
    print("REFUSED:"); [print("  -", p) for p in problems]; sys.exit(1)
if "--check" in sys.argv:
    sys.exit(0)
old = open(PAGE, encoding="utf-8").read() if os.path.exists(PAGE) else ""
if old == out:
    print("unchanged", PAGE)
else:
    open(PAGE, "w", encoding="utf-8").write(out)
    print("written", PAGE, len(out), "bytes")
