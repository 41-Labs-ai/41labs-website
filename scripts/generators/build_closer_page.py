#!/usr/bin/env python3
"""Build /41-closer, the AI Sales Closer page (one of the four AIs in 41 Sales Team), from this file alone.

17 Oct 2026 redesign: the whole page is generated here (head, shared header, body, shared footer), on the
shared 41 Sales Team stylesheet (assets/41st/site.css). Light, sentence case, WhatsApp-style chats.
SEO rules: URL, canonical, og:url, robots unchanged. Tracking scripts (Meta pixel, GA loader,
closer-analytics.js, track.js, the Contact tracker) are copied verbatim. Every section keeps an id,
because closer-analytics.js attributes time to section[id] / header[id].
Facts: 41 Labs/pricing/41-CLOSER-PRICING.md. Rule: no overage price, no Meta fee, no guarantee, no invented number.
18 Oct 2026 (copy deck v3): the page follows the AI role page template. The section renderers and the
template CSS live in build_role_pages.py, so the three AI pages cannot drift apart.
Run twice: the second run must change nothing."""
import re, json, html, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gates import check, visible_text
import build_role_pages as rp
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
PAGE = os.path.join(ROOT, "41-closer.html")
PARTIALS = os.path.join(HERE, "partials")

# CTA destinations: keep exactly (the live Meta ads and the Contact tracker key off these).
WA = "https://wa.me/6580124848?text=Hi%2C%20I%20want%20to%20see%20how%2041%20Closer%20would%20answer%20my%20customers."
WA_TRY = "https://wa.me/6580124848?text=Hi%2C%20I%20am%20trying%2041%20Closer.%20Show%20me%20how%20you%20would%20handle%20my%20customers."
# 18 Oct 2026: the page exists to get a booked call. Every "Book a free call" goes to the qualify form on /ai-closer.
BOOK = rp.BOOK_CALL.format(slug="ai-sales-closer")
NAME = "AI Sales Closer"

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

# Copy deck v3 (18 Oct 2026), "AI SALES CLOSER", word for word. No prices on this page: plans live on /pricing.
SUB = ("It answers every WhatsApp enquiry in seconds, at any hour, in your customer's language. It quotes from your real prices, "
       "asks the questions that matter and takes the payment or books the slot.")
PROOF = "19 seconds median first reply on a live Singapore line."
LOGOS = ["WhatsApp", "Facebook Messenger", "Stripe", "Airwallex", "Google Calendar", "Google Sheets", "Plato"]
# Outcome cards. The third uses the same wording as this page's case (it was the "Not a demo" card).
WINS = [
    ("clock", "19 seconds", None, "median first reply"),
    ("clock", "1 in 4", None, "enquiries arrive after hours, and each one gets a reply"),
    ("chart", "$300,000", None, "of sales every month through the AI Sales Closer at one Singapore industrial supplier", "Real client, kept private on request"),
]
PAIN = "A customer who waits until morning has often bought somewhere else by then."
STAGES = [
    ("Answer.", "Customers message when it suits them, often after you close.",
     ["Replies in seconds, day or night.", "Writes in your customer's language.", "Uses your own WhatsApp number."]),
    ("Qualify.", "Not every enquiry is a buyer.",
     ["Asks the one or two questions that matter: date, location, size.", "Then moves straight to the quote."]),
    ("Quote.", '"How much?" is the question that wins or loses the sale.',
     ["Quotes from your real price list.", "Gives the right options for what they asked.", "Never invents a price."]),
    ("Close.", "A yes is only a sale once it is paid or booked.",
     ["Sends the payment link or books the slot.", "Confirms in the chat.", "Tells your team straight away."]),
    ("Follow up.", 'Many customers say "let me think".',
     ["Messages them again on the day they asked for.", "Uses approved WhatsApp templates after 24 hours.", "Stops when they say no."]),
]
HANDOVER = ["When a chat needs a person, your team gets the full chat and a short summary on WhatsApp. One tap turns the AI off "
            "for that chat. When you switch it back on, it reads what your team said and carries on."]
COMPARE = [
    ("A message at 11pm", "Waits until morning", "Answered in seconds"),
    ('"How much?"', "Someone looks it up", "Quoted from your price list"),
    ('"Let me think"', "Often forgotten", "Messaged again on the day they asked for"),
    ("A tricky complaint", "Gets a guess", "Goes straight to the right person"),
]
FINAL_H2 = "See it answer your own customers"

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

# The role page template CSS (build_role_pages.py), plus the QR card in this page's final band.
PAGE_CSS = rp.ROLE_CSS + """        /* /41-closer extras */
        .final-grid{display:grid;gap:32px;grid-template-columns:1fr;align-items:center;text-align:left}
        @media(min-width:860px){.final-grid{grid-template-columns:1.3fr .7fr}}
        .final-grid .lede{margin:14px 0 0}
        .qr-card{background:var(--bg);border:1px solid var(--border);border-radius:var(--r-panel);padding:20px;text-align:center;max-width:260px;margin:0 auto}
        .qr-card img{width:180px;height:180px;margin:0 auto 12px;border-radius:12px;background:#fff;padding:8px}
        .qr-card p{margin:0}
        .qr-card .qr-label{font-weight:600}
        .qr-card .qr-sub{font-size:13.5px;color:var(--subtle);margin-top:4px}
        @media(max-width:640px){.final-grid{text-align:center}.qr-card{display:none}}
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

CAPSULE_HTML = (f'<div class="capsule"><p><strong>{CAPSULE}</strong></p></div>'
                f'<p class="capsule-more">{CAPSULE_2} <a href="/blog/whatsapp-response-time-singapore-study">Read the study</a>.</p>')

MAIN = f'''<main id="main">

    <header id="hero" class="hero wash">
        <div class="wrap">
            <div class="hero-grid">
                <div>
                    <span class="eyebrow">AI Sales Closer for WhatsApp</span>
                    <h1>AI Sales Closer. <span class="h1-soft">It closes the sale while you sleep.</span></h1>
                    <p class="lede hero-sub">{html.escape(SUB, quote=False)}</p>
                    {rp.proof_line(PROOF)}
                    {rp.cta_pair(BOOK, WA_TRY)}
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

    {rp.trust_strip(LOGOS)}

    {rp.outcome_cards(WINS, "More sales, and your evenings back.")}

    {rp.pain_block(PAIN, CAPSULE_HTML)}

    {rp.day_section(NAME, STAGES, BOOK)}

    {rp.handover_section(HANDOVER)}

    {rp.compare_section(NAME, COMPARE, f'<div class="after-cta">{rp.book_btn(BOOK)}</div>')}

    {rp.try_section(WA_TRY)}

    {rp.faq_section("What buyers ask before they start.", FAQ)}

    {rp.siblings_section("closer")}

    <section id="start-now" class="section">
        <div class="wrap">
            <div class="cta-band wash">
                <div class="final-grid">
                    <div>
                        <span class="eyebrow">Start now</span>
                        <h2>{FINAL_H2}</h2>
                        <p class="lede">{rp.FINAL_LEDE}</p>
                        {rp.cta_pair(BOOK, WA)}
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
# 1150 -> 1300 on 18 Oct 2026: copy deck v3 role template (its day, handover, today vs, try it now) targets 900 to 1,300 words.
# No prices on this page (18 Oct brief): the price-position gate now pins the /pricing link line in the FAQ instead.
problems, stats = check(out, max_words=1300, faq=FAQ, max_ctas=3, price_token="See pricing", price_within=1.0)
# Main button: exact label and href, at least 3 times in the page body (the header button is extra).
n_book = MAIN.count(rp.book_btn(BOOK))
if n_book < 3:
    problems.append(f"{n_book} '{rp.BOOK_LABEL}' buttons in the page body, need 3")
if MAIN.count(f'target="_blank" rel="noopener">{rp.icon("wa", 18)} {rp.WA_LABEL}</a>') < 2:
    problems.append(f"'{rp.WA_LABEL}' must be in the hero and the final band")
for bad in (";", "!"):
    if bad in html.unescape(visible_text(MAIN)):
        problems.append(f"{bad!r} in the visible copy")
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
