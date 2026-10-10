#!/usr/bin/env python3
"""Rebuild /whatsapp-ai-chatbot from one content dict (density plan, Phase 1).
Owns the terms "whatsapp ai chatbot singapore", "whatsapp ai" and "ai chatbot singapore".
The three long AI Mode questions on this page rank at positions 2 to 5 and stay, with answers under 60 words."""
import json, re, html, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gates import check
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PAGE = os.path.join(ROOT, "whatsapp-ai-chatbot.html")
WA = "https://wa.me/6580124848?text=Hi%2C%20I%20want%20to%20see%20how%2041%20Closer%20would%20answer%20my%20customers."
DATE_ISO = "2026-10-10T09:00:00+08:00"; DATE_TXT = "10 October 2026"
TITLE = "WhatsApp AI Chatbot in Singapore, Built and Run | 41 Labs"
DESC = "A WhatsApp AI chatbot that answers customers, quotes real prices, qualifies leads and books, on your own number. Built and run by 41 Labs. From S$690 a month."
assert len(TITLE) <= 62 and len(DESC) <= 165, (len(TITLE), len(DESC))
G = "color:#22c55e;font-weight:600;"
def a(href, text): return f'<a href="{href}" style="{G}">{text}</a>'

capsule_direct = ("A WhatsApp AI chatbot answers your customers without a person typing. The good ones read your prices and stock, "
                  "ask the qualifying question, book the slot or send the payment link, and hand the tricky chat to your team. "
                  "41 Closer is the managed one for Singapore: 41 Labs builds it on your business and runs it for you.")
capsule_passage = ("It runs on the official WhatsApp Business API, on your own verified number, so customers see your brand. We tested why it matters with one real enquiry sent to 25 Singapore businesses "
                   "between 8pm and 11pm. One replied within five minutes. The median wait was 13.3 hours, and four never replied. The study is on this site. "
                   "Message +65 8012 4848 at any hour and the chatbot that replies is 41 Closer itself.")
wc = lambda t: len(re.sub(r"<[^>]+>", " ", t).split())
assert 40 <= wc(capsule_direct) <= 60, wc(capsule_direct)
assert 60 <= wc(capsule_passage) <= 110, wc(capsule_passage)

FAQ = [
    ("What is a WhatsApp AI chatbot?",
     "Software that answers your customers on WhatsApp without a person typing. A basic one sends menus. A good one reads your prices and stock, qualifies the buyer, books or takes payment, and hands over when a person is needed. 41 Closer is the managed kind, built and run for you."),
    ("How is it different from the WhatsApp Business auto-reply?",
     "An auto-reply sends one fixed line and the customer still waits for a person. A WhatsApp AI chatbot reads the question and answers it from your catalogue, asks the next question, and books or quotes. If you get a handful of messages a week, the auto-reply is enough and we will say so."),
    ("Can it send quotes and book appointments on WhatsApp?",
     "Yes. It quotes from your price list and your rules, and on Pro it reads live stock and prices from your own system. It books into your calendar or takes a deposit by payment link in the chat, and tells the right person on your team."),
    ("How much does a WhatsApp AI chatbot cost in Singapore?",
     "41 Closer starts at S$690 a month with the build included. Pro is S$1,490 a month and connects to your own systems. One month to start, charged from the day it goes live, then month to month with 30 days notice and no contract. No GST is charged. DIY platforms cost less and you run them yourself."),
    ("We need AI to handle after-hours WhatsApp questions about stock and price, and qualify leads and schedule callbacks for the sales team. What works?",
     "An agent that reads your stock, not a menu bot. On Pro, 41 Closer reads live inventory or your calendar, quotes the real price, asks the qualifying question and books the callback or the slot. Your team wakes up to qualified leads with the answers already captured."),
    ("What is the best WhatsApp AI chatbot for qualifying sales leads and booking appointments?",
     "If someone on your team will build flows and watch the inbox, a DIY platform such as Wati, SleekFlow or respond.io costs less. If nobody will, a managed agent is the better buy. 41 Closer qualifies, books into your calendar and hands over the rest, and we run it."),
    ("Can one WhatsApp AI answer product questions, check stock and flag VIP buyers for a person to follow up?",
     "Yes, on the Pro plan. It answers from your catalogue and checks live stock. It applies the rules you give it, such as order value or a named account, and passes the VIP buyer to a person with the whole chat. Everything else it closes on its own."),
    ("Which vendors can run an AI agent across SMS, WhatsApp and voice with failover to a live agent in Singapore?",
     "Not us. 41 Closer runs on WhatsApp only, with handover to your team inside the chat. For voice and SMS on one platform with live-agent failover, look at respond.io or a Twilio build. We compare the WhatsApp tools a Singapore buyer meets on this site."),
]
for q, ans in FAQ:
    assert "—" not in q + ans and ";" not in ans, q

def faq_html():
    items = "".join(f'<div class="faq-item"><h3>{html.escape(q)}</h3><p>{ans}</p></div>' for q, ans in FAQ)
    return f'<section class="section" id="faq"><div class="container" style="max-width:820px;"><div class="section-header"><h2>WhatsApp AI chatbot: questions buyers ask</h2></div><div class="faq-list">{items}</div></div></section>'
def faq_ld():
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": re.sub(r"<[^>]+>", "", ans)}} for q, ans in FAQ]}

body = f"""<main id="main">
    <header class="location-hero"><div class="container"><div class="location-hero-content">
        <span class="location-flag"><img src="https://flagcdn.com/w80/sg.png" alt="Singapore flag" class="flag-icon-lg"></span>
        <h1>WhatsApp AI Chatbot in Singapore: it answers, quotes and books on your own number</h1>
        <p class="location-subtitle">Your customers message at 11pm about availability and price. 41 Closer answers in seconds, qualifies the lead, books the slot, and hands the tricky ones to your team. 41 Labs builds it and runs it.</p>
        <a href="{WA}" class="btn btn-primary btn-large" target="_blank" rel="noopener">Message the chatbot on WhatsApp</a>
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
        <p style="margin-top:14px;">The only one-time cost is connecting a system of your own that we have connected before, S$2,400. One month to start, charged from the day it goes live. Then month to month with 30 days notice and no contract. No GST is charged. {a('/41-closer','Plans and terms')}.</p>
    </div></section>

    <section class="location-services"><div class="container"><div class="section-header"><h2>What a WhatsApp AI chatbot does inside one sale</h2></div><div class="services-grid">
        <a href="/ai-sales-agent-singapore" class="service-card"><h3>Answers in seconds, all day</h3><p>Every enquiry gets a reply at 9pm or on a Sunday, in your tone, from your own catalogue.</p><span class="service-link">The AI sales agent &rarr;</span></a>
        <a href="/blog/what-is-ai-quote-automation" class="service-card"><h3>Quotes your real prices</h3><p>It quotes from your price list and your rules. On Pro it reads live stock and prices from your own system.</p><span class="service-link">Quote automation &rarr;</span></a>
        <a href="/ai-appointment-booking" class="service-card"><h3>Books the slot or takes the deposit</h3><p>It writes the booking into your calendar or sends the payment link, and tells the right person on your team.</p><span class="service-link">Booking &rarr;</span></a>
        <a href="/ai-lead-qualification" class="service-card"><h3>Hands over when a person is needed</h3><p>It asks the qualifying question first. The serious buyer, or anyone who asks for a person, reaches your team with the whole chat.</p><span class="service-link">Lead qualification &rarr;</span></a>
    </div></div></section>

    <section class="section" style="background:#f5f5f7;"><div class="container" style="max-width:880px;"><div class="section-header"><h2>Menu bot, DIY platform, or a managed chatbot</h2></div>
        <table class="lp-table"><thead><tr><th></th><th>Menu bot</th><th>DIY AI platform</th><th>41 Closer</th></tr></thead><tbody>
        <tr><td><strong>Answers product questions</strong></td><td>From a script</td><td>From a catalogue you upload</td><td>From your catalogue, in your tone</td></tr>
        <tr><td><strong>Quotes a real price</strong></td><td>No</td><td>If you build the flow</td><td>Yes, from your price list and rules</td></tr>
        <tr><td><strong>Reads live stock or availability</strong></td><td>No</td><td>Needs your own integration work</td><td>Yes on Pro, connected by us</td></tr>
        <tr><td><strong>Books or takes payment in the chat</strong></td><td>No</td><td>Needs your own integration work</td><td>Yes on Pro</td></tr>
        <tr><td><strong>Who runs it</strong></td><td>You</td><td>You</td><td>41 Labs</td></tr>
        </tbody></table>
        <p style="margin-top:14px;font-size:15px;">Meta's own Business AI answers from your catalogue and does not connect to a CRM, stock or booking system. The twelve WhatsApp tools a Singapore buyer will meet are compared on {a('/blog/best-whatsapp-ai-tools-singapore#vendor-table','the WhatsApp AI tools page')}.</p>
    </div></section>

    <section class="section"><div class="container" style="max-width:880px;"><div class="section-header"><h2>How it starts</h2></div>
        <ol style="font-size:1.02rem;line-height:1.75;padding-left:22px;">
            <li><strong>You send your list.</strong> Products, prices and a bit about how you sell. A photo of the price board or a voice note is fine.</li>
            <li><strong>We build it and you message it before you pay.</strong> It goes on a test number first. You ask it what your customers ask.</li>
            <li><strong>One free hour, then live.</strong> We walk you through the platform, connect payments and your WhatsApp number, and switch it on. Live within 48 hours of your list. Billing starts the day it goes live.</li>
        </ol>
    </div></section>

    <section class="location-case-study"><div class="container"><div class="case-study-box"><span class="case-study-label">Singapore case study</span><h2>Quotes in 5 minutes instead of 3 hours</h2><p>A Singapore professional services firm moved its quoting to the agent. Quote time went from 3 hours to 5 minutes, errors fell 90% and sales capacity rose 35%.</p><p style="margin-top:10px;">{a('/case-studies/quote-automation-professional-services','Read the case')}. The 25-business reply-time test is in {a('/blog/whatsapp-response-time-singapore-study','the study')}.</p></div></div></section>

    {faq_html()}

    <section class="section cta-section"><div class="container"><div class="cta-content"><h2>Want it answering your WhatsApp tonight?</h2><p>Send us your product list. We build your chatbot before any call, you message it, then one free hour to connect payments and your WhatsApp.</p><a href="{WA}" class="btn btn-primary btn-large" target="_blank" rel="noopener">Message the chatbot on WhatsApp</a></div></div></section>
    </main>"""

ld_service = {"@context": "https://schema.org", "@type": "ProfessionalService", "name": "41 Labs, WhatsApp AI chatbots for Singapore businesses", "image": "https://41labs.ai/logo-full.png", "url": "https://41labs.ai/whatsapp-ai-chatbot", "description": DESC, "address": {"@type": "PostalAddress", "addressCountry": "SG", "addressLocality": "Singapore"}, "areaServed": ["Singapore", "Malaysia", "Indonesia"], "telephone": "+65 8012 4848", "priceRange": "S$690 to S$7,900 a month"}
ld_page = {"@context": "https://schema.org", "@type": "WebPage", "url": "https://41labs.ai/whatsapp-ai-chatbot", "name": TITLE, "dateModified": DATE_ISO, "author": {"@type": "Person", "name": "Alexander Lee", "url": "https://41labs.ai/about"}, "publisher": {"@type": "Organization", "name": "41 Labs", "url": "https://41labs.ai"}}
ld_crumb = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "Home", "item": "https://41labs.ai/"}, {"@type": "ListItem", "position": 2, "name": "WhatsApp AI Chatbot", "item": "https://41labs.ai/whatsapp-ai-chatbot"}]}
def ld(j): return '<script type="application/ld+json">' + json.dumps(j, ensure_ascii=False, indent=1) + "</script>"

src = open(PAGE, encoding="utf-8").read()
head_end = src.index("</head>"); head = src[:head_end]
head = re.sub(r'\s*<script type="application/ld\+json">.*?</script>', "", head, flags=re.S)
assert '<script src="/track.js" defer></script>' in head
head = head.replace('<script src="/track.js" defer></script>', ld(ld_service) + "\n    " + ld(ld_page) + "\n    " + ld(ld_crumb) + "\n    " + ld(faq_ld()) + '\n    <script src="/track.js" defer></script>', 1)
head = re.sub(r"<title>.*?</title>", f"<title>{html.escape(TITLE)}</title>", head)
head = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{html.escape(DESC)}">', head)
head = re.sub(r'<meta name="keywords" content="[^"]*">', '<meta name="keywords" content="whatsapp ai chatbot singapore, whatsapp ai, ai chatbot singapore, whatsapp ai agent, whatsapp chatbot for business, whatsapp automation singapore, 41 closer">', head)
for tag in ("og:title", "twitter:title"):
    head = re.sub(rf'(<meta (?:property|name)="{tag}" content=")[^"]*(">)', rf'\g<1>{html.escape(TITLE)}\g<2>', head)
for tag in ("og:description", "twitter:description"):
    head = re.sub(rf'(<meta (?:property|name)="{tag}" content=")[^"]*(">)', rf'\g<1>{html.escape(DESC)}\g<2>', head)
rest = src[head_end:]
m0 = rest.index('<main id="main">'); m1 = rest.index("</main>") + len("</main>")
out = head + rest[:m0] + body + rest[m1:]
assert 'rel="canonical" href="https://41labs.ai/whatsapp-ai-chatbot"' in out
problems, stats = check(out, max_words=1500, faq=FAQ, price_token="S$690", max_ctas=3)
print(stats)
if problems:
    print("REFUSED:"); [print("  -", p) for p in problems]; sys.exit(1)
if "--check" in sys.argv:
    sys.exit(0)
open(PAGE, "w", encoding="utf-8").write(out)
print("written", PAGE, len(out), "bytes")
