#!/usr/bin/env python3
"""Rebuild /ai-sales-agent-singapore from one content dict (density plan, Phase 1).
Visible FAQ and FAQPage JSON-LD come from the same list. Vendor and region facts come from page-facts.json.
Owns the terms "ai sales agent singapore" and "ai agents singapore". "whatsapp ai chatbot" belongs to /whatsapp-ai-chatbot.
The twelve-vendor table lives on /blog/best-whatsapp-ai-tools-singapore now."""
import json, re, html, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gates import check
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PAGE = os.path.join(ROOT, "ai-sales-agent-singapore.html")
S = os.path.dirname(os.path.abspath(__file__))
F = json.load(open(os.path.join(S, "page-facts.json")))
for k in ("vendors", "region", "meta_ai"):
    assert F.get(k), f"page-facts.json missing {k}"
WA = "https://wa.me/6580124848?text=Hi%2C%20I%20want%20to%20see%20how%2041%20Closer%20would%20answer%20my%20customers."
DATE_ISO = "2026-10-10T09:00:00+08:00"; DATE_TXT = "10 October 2026"
TITLE = "AI Sales Agent in Singapore, Built and Run for You | 41 Labs"
DESC = "41 Closer is a managed AI sales agent for WhatsApp in Singapore. It answers after-hours enquiries, quotes real prices, qualifies and books. From S$690 a month."
assert len(TITLE) <= 62 and len(DESC) <= 165, (len(TITLE), len(DESC))
G = "color:#22c55e;font-weight:600;"
def a(href, text): return f'<a href="{href}" style="{G}">{text}</a>'

capsule_direct = ("An AI sales agent answers your WhatsApp enquiries like a trained salesperson. "
                  "It replies after hours and says whether the item is available and what it costs. It asks the qualifying question, "
                  "books the appointment or schedules the callback, and follows up until the buyer decides. "
                  "41 Closer is the managed one for Singapore, built and run by 41 Labs.")
capsule_passage = ("Most Singapore businesses lose the sale in the gap between the message and the reply. We tested that gap: one real enquiry sent to 25 Singapore businesses between 8pm and 11pm. "
                   "One replied within five minutes. The median wait for a human reply was 13.3 hours. Four never replied at all. The study is on this site. "
                   "41 Closer answers in seconds, at any hour, on your own business WhatsApp number, and on Pro it reads your live stock and writes orders and bookings back. "
                   "Message +65 8012 4848 and the agent that replies is 41 Closer itself.")
wc = lambda t: len(re.sub(r"<[^>]+>", " ", t).split())
assert 40 <= wc(capsule_direct) <= 60, wc(capsule_direct)
assert 70 <= wc(capsule_passage) <= 130, wc(capsule_passage)

FAQ = [
    ("What is an AI sales agent?",
     "Software that sells over chat the way a trained closer would. It reads each message, works out what the buyer wants, quotes an accurate price, qualifies the buyer and moves the deal to a booking or a payment. A scripted chatbot cannot do that. 41 Closer is a managed one, built and run for you."),
    ("What is the best AI tool to qualify WhatsApp sales enquiries in Singapore?",
     "It depends on who will run it. If someone on your team will build flows and watch the inbox, a DIY platform such as Wati, SleekFlow or respond.io costs less. If nobody will, a managed agent is the better buy. 41 Closer asks the qualifying questions, books the serious buyer and hands over the rest."),
    ("We need AI to handle after-hours WhatsApp enquiries about product availability and price, qualify leads and schedule callbacks for our sales team. What works?",
     "Only an agent that can read your stock. A bot answering from a static list says things are available when they are not. On Pro, 41 Closer reads your live inventory or calendar and quotes the real price. It asks the qualifying question and books the callback or the slot."),
    ("Which AI agent replies to WhatsApp enquiries and quotes prices?",
     "41 Closer does both on its own, on your business number. It quotes from your real price list, applies your rules, and on Pro reads live prices from your own system. For a platform you run yourself, SleekFlow, respond.io and Wati offer WhatsApp AI replies, and we publish honest comparisons of each."),
    ("How much does an AI sales agent cost in Singapore?",
     "41 Closer starts at S$690 a month with the build included. Pro is S$1,490 a month and connects to your own systems. Scale is S$4,300 and Custom starts at S$7,900. One month to start, charged from the day it goes live, then month to month with 30 days notice and no contract. No GST is charged."),
    ("How is this different from Meta's own Business AI on WhatsApp?",
     "Meta's self-serve Business AI answers from your catalogue and past chats and does not connect to a CRM, stock or booking system. If every answer lives in a catalogue, it may be enough, and it starts free. 41 Closer is run by a team, quotes from your price rules, reads live stock on Pro and takes payment."),
    ("Does it work for a business in Malaysia or Indonesia?",
     "Yes, where WhatsApp is the channel, and in both countries it is the most-used app. The setup is the same as in Singapore: your own WhatsApp Business number, built in 48 hours, run by us from Singapore, billed in Singapore dollars. We have no office in either country."),
    ("How fast is it live, and what do I need to give you?",
     "48 hours from your product list. You send your products, prices and a bit about how you sell. We build the agent and you message it yourself before you pay anything. Then one free hour: we show you the platform and connect payments and your WhatsApp number. Billing starts the day it goes live."),
]
for q, ans in FAQ:
    assert "—" not in q + ans and ";" not in ans, q

def faq_html():
    items = "".join(f'<div class="faq-item"><h3>{html.escape(q)}</h3><p>{ans}</p></div>' for q, ans in FAQ)
    return f'<section class="section" id="faq"><div class="container" style="max-width:820px;"><div class="section-header"><h2>AI sales agent in Singapore: questions buyers ask</h2></div><div class="faq-list">{items}</div></div></section>'
def faq_ld():
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": re.sub(r"<[^>]+>", "", ans)}} for q, ans in FAQ]}

hc = os.path.join(S, "hub-cards.json")
trade_links = ""
if os.path.exists(hc):
    cards = json.load(open(hc))
    trade_links = ", ".join(f'<a href="/industries/{c["slug"]}" style="{G}">{c["title"].replace("AI Agent for ", "").replace(" in Singapore", "")}</a>' for c in cards)

body = f"""<main id="main">
    <header class="location-hero"><div class="container"><div class="location-hero-content">
        <span class="location-flag"><img src="https://flagcdn.com/w80/sg.png" alt="Singapore flag" class="flag-icon-lg"></span>
        <h1>AI Sales Agent in Singapore: it answers, quotes and books on WhatsApp</h1>
        <p class="location-subtitle">It handles the after-hours WhatsApp enquiries about availability and price, qualifies the lead and schedules the callback for your sales team, on your own number. 41 Labs builds it and runs it.</p>
        <a href="{WA}" class="btn btn-primary btn-large" target="_blank" rel="noopener">Message the agent on WhatsApp</a>
        <p style="margin-top:14px;font-size:14px;opacity:.8;">By Alexander Lee, founder of 41 Labs. Last updated {DATE_TXT}.</p>
    </div></div></header>

    <section class="section" style="padding-top:48px;"><div class="container" style="max-width:820px;">
        <div style="background:rgba(74,222,128,0.06);border-left:3px solid #4ade80;border-radius:12px;padding:28px 32px;font-size:1.05rem;line-height:1.7;"><p style="margin:0 0 16px;"><strong>{capsule_direct}</strong></p><p style="margin:0;">{capsule_passage}</p></div>
    </div></section>

    <section class="section" style="background:#f5f5f7;"><div class="container" style="max-width:880px;"><div class="section-header"><h2>What it costs</h2><p>One price. No hidden fees. The build is included on every plan.</p></div>
        <table class="lp-table"><thead><tr><th>Plan</th><th>A month</th><th>What you get</th></tr></thead><tbody>
        <tr><td><strong>Starter</strong></td><td>S$690</td><td>Answers, quotes from your catalogue, follows up, hands over to your team. One number.</td></tr>
        <tr><td><strong>Pro</strong></td><td>S$1,490</td><td>Everything in Starter, plus it connects to your own systems: reads live stock and prices, writes orders and bookings back, takes payment in the chat.</td></tr>
        <tr><td><strong>Scale</strong></td><td>S$4,300</td><td>Pro, for high volume off one brand.</td></tr>
        <tr><td><strong>Custom</strong></td><td>from S$7,900</td><td>Many brands or many numbers.</td></tr>
        </tbody></table>
        <p style="margin-top:14px;">The only one-time cost is connecting a system of your own that we have connected before, S$2,400. One month to start, charged from the day it goes live. Then month to month with 30 days notice and no contract. No GST is charged. Eligible SMEs can apply the EDGE grant to part of the cost. {a('/41-closer','Plans and terms')}.</p>
    </div></section>

    <section class="section"><div class="container"><div class="section-header"><h2>What Singapore businesses ask us for, in their own words</h2></div><div class="services-grid">
        <a href="#faq" class="service-card"><h3>"Handle after-hours WhatsApp enquiries about availability and price"</h3><p>It answers at 11pm with the real answer: whether the item or slot is available and what it costs, from your catalogue or your live system.</p><span class="service-link">How it answers &rarr;</span></a>
        <a href="/ai-lead-qualification" class="service-card"><h3>"Qualify the lead before my sales team sees it"</h3><p>It asks the one or two questions a salesperson would ask, such as budget, model, dates or location, and passes only the serious buyer through.</p><span class="service-link">Lead qualification &rarr;</span></a>
        <a href="/ai-appointment-booking" class="service-card"><h3>"Schedule the callback, the viewing or the appointment"</h3><p>It books into your calendar or takes the callback time, confirms it in the chat, and tells the right person on your team.</p><span class="service-link">Booking &rarr;</span></a>
        <a href="/41-closer" class="service-card"><h3>"Run it on the number my customers already have"</h3><p>It runs on your own business WhatsApp number through the WhatsApp Business API, with a Singapore number, and we connect it for you.</p><span class="service-link">Plans and terms &rarr;</span></a>
    </div></div></section>

    <section class="section" style="background:#f5f5f7;"><div class="container" style="max-width:880px;"><div class="section-header"><h2>Chatbot, DIY platform, or a managed agent</h2></div>
        <table class="lp-table"><thead><tr><th></th><th>Scripted chatbot</th><th>DIY AI platform</th><th>41 Closer</th></tr></thead><tbody>
        <tr><td><strong>Answers product questions</strong></td><td>From a script</td><td>From a catalogue you upload</td><td>From your catalogue, in your tone</td></tr>
        <tr><td><strong>Quotes a real price</strong></td><td>No</td><td>If you build the flow</td><td>Yes, from your price list and rules</td></tr>
        <tr><td><strong>Reads live stock or availability</strong></td><td>No</td><td>Needs your own integration work</td><td>Yes on Pro, connected by us</td></tr>
        <tr><td><strong>Writes the order or booking back</strong></td><td>No</td><td>Needs your own integration work</td><td>Yes on Pro</td></tr>
        <tr><td><strong>Follows up on its own</strong></td><td>No</td><td>If you build the sequence</td><td>Yes</td></tr>
        <tr><td><strong>Who runs it</strong></td><td>You</td><td>You</td><td>41 Labs</td></tr>
        </tbody></table>
        <p style="margin-top:14px;font-size:15px;">Meta's own Business AI answers from your catalogue and does not connect to a CRM, stock or booking system. The twelve vendors a Singapore buyer will meet are compared on {a('/blog/best-whatsapp-ai-tools-singapore#vendor-table','the WhatsApp AI tools page')}.</p>
    </div></section>

    <section class="section"><div class="container" style="max-width:880px;"><div class="section-header"><h2>How to choose an AI sales agent in Singapore</h2><p>Four checks before you pay for any of them, ours included</p></div>
        <ol style="font-size:1.02rem;line-height:1.75;padding-left:22px;">
            <li><strong>Can it read your stock, prices or calendar, or only a script?</strong> Ask to see it quote a real item from your own list.</li>
            <li><strong>Who runs it after go-live?</strong> A DIY platform is cheaper if someone on your team will build the flows and watch the inbox. If nobody will, buy a managed agent.</li>
            <li><strong>What does it do with the serious buyer?</strong> It should book the slot, send the payment link or hand over to a named person with the whole chat.</li>
            <li><strong>Can you test it before you pay?</strong> Message +65 8012 4848 at any hour. Then we build yours on your own prices and you message that before any money moves.</li>
        </ol>
    </div></section>

    <section class="location-case-study"><div class="container"><div class="case-study-box"><span class="case-study-label">Singapore case study</span><h2>Quotes in 5 minutes instead of 3 hours</h2><p>A Singapore professional services firm moved its quoting to the agent. Quote time went from 3 hours to 5 minutes, errors fell 90% and sales capacity rose 35%.</p><p style="margin-top:10px;">{a('/case-studies/quote-automation-professional-services','Read the case')}.</p></div></div></section>

    <section class="section"><div class="container" style="max-width:880px;"><div class="section-header"><h2>Malaysia, Indonesia and the rest of the region</h2></div>
        <p>WhatsApp is the most-used app in Singapore, Malaysia and Indonesia. 41 Closer works the same way in all three: your own number, built in 48 hours, run from Singapore, billed in Singapore dollars. We have no office in Malaysia or Indonesia. It answers in English and the mixed English customers type. Market pages: {a('/locations/malaysia','Malaysia')}, {a('/locations/indonesia','Indonesia')}, {a('/ai-sales-agent-australia','Australia')}.</p>
        <p style="margin-top:14px;font-size:15px;"><strong>Written for your trade:</strong> sixteen pages, one per kind of business we have sat down with, built from those calls, on {a('/industries','the industries page')}.</p>
    </div></section>

    {faq_html()}

    <section class="section cta-section"><div class="container"><div class="cta-content"><h2>See it answer your customers first</h2><p>Send us your product list. We build your agent before any call, you message it, then one free hour to connect payments and your WhatsApp.</p><a href="{WA}" class="btn btn-primary btn-large" target="_blank" rel="noopener">Message the agent on WhatsApp</a></div></div></section>
    </main>"""

ld_service = {"@context": "https://schema.org", "@type": "ProfessionalService", "name": "41 Labs, AI sales agents for WhatsApp", "image": "https://41labs.ai/logo-full.png", "url": "https://41labs.ai/ai-sales-agent-singapore", "description": DESC, "address": {"@type": "PostalAddress", "addressCountry": "SG", "addressLocality": "Singapore"}, "areaServed": ["Singapore", "Malaysia", "Indonesia", "Australia"], "telephone": "+65 8012 4848", "priceRange": "S$690 to S$7,900 a month", "sameAs": ["https://www.linkedin.com/in/leejunweialexander/"]}
ld_page = {"@context": "https://schema.org", "@type": "WebPage", "url": "https://41labs.ai/ai-sales-agent-singapore", "name": TITLE, "datePublished": "2026-04-06T09:00:00+08:00", "dateModified": DATE_ISO, "author": {"@type": "Person", "name": "Alexander Lee", "url": "https://41labs.ai/about"}, "publisher": {"@type": "Organization", "name": "41 Labs", "url": "https://41labs.ai"}}
ld_crumb = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "Home", "item": "https://41labs.ai/"}, {"@type": "ListItem", "position": 2, "name": "AI Sales Agent in Singapore", "item": "https://41labs.ai/ai-sales-agent-singapore"}]}
def ld(j): return '<script type="application/ld+json">' + json.dumps(j, ensure_ascii=False, indent=1) + "</script>"

src = open(PAGE, encoding="utf-8").read()
head_end = src.index("</head>"); head = src[:head_end]
head = re.sub(r'\s*<script type="application/ld\+json">.*?</script>', "", head, flags=re.S)
head = head.replace('    <script src="/track.js" defer></script>', "    " + ld(ld_service) + "\n    " + ld(ld_page) + "\n    " + ld(ld_crumb) + "\n    " + ld(faq_ld()) + '\n    <script src="/track.js" defer></script>')
head = re.sub(r"<title>.*?</title>", f"<title>{html.escape(TITLE)}</title>", head)
head = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{html.escape(DESC)}">', head)
head = re.sub(r'<meta name="keywords" content="[^"]*">', '<meta name="keywords" content="ai sales agent singapore, ai agents singapore, ai sales agent, whatsapp ai sales agent, ai sales agent for whatsapp, 41 closer">', head)
head = re.sub(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{html.escape(TITLE)}">', head)
head = re.sub(r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{html.escape(DESC)}">', head)
head = re.sub(r'<meta name="twitter:title" content="[^"]*">', f'<meta name="twitter:title" content="{html.escape(TITLE)}">', head)
head = re.sub(r'<meta name="twitter:description" content="[^"]*">', f'<meta name="twitter:description" content="{html.escape(DESC)}">', head)
head = head.replace('<meta name="author" content="41 Labs">', '<meta name="author" content="Alexander Lee">')
rest = src[head_end:]
m0 = rest.index('<main id="main">'); m1 = rest.index("</main>") + len("</main>")
out = head + rest[:m0] + body + rest[m1:]
assert 'rel="canonical" href="https://41labs.ai/ai-sales-agent-singapore"' in out and 'property="og:url" content="https://41labs.ai/ai-sales-agent-singapore"' in out
problems, stats = check(out, max_words=1500, faq=FAQ, price_token="S$690", max_ctas=3)
print(stats)
if problems:
    print("REFUSED:"); [print("  -", p) for p in problems]; sys.exit(1)
if "--check" in sys.argv:
    sys.exit(0)
open(PAGE, "w", encoding="utf-8").write(out)
print("written", PAGE, len(out), "bytes")
