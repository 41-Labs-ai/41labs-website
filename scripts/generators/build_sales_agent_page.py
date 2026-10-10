#!/usr/bin/env python3
"""Rebuild /ai-sales-agent-singapore from one content dict so the visible FAQ and the
FAQPage JSON-LD cannot drift. Vendor and region facts come from page-facts.json
(written from research-page-facts.md after reading it); the script refuses to run
without them so a placeholder can never ship."""
import json, re, html, sys, os
ROOT=os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","..")); PAGE=os.path.join(ROOT,"ai-sales-agent-singapore.html")
S=os.path.dirname(os.path.abspath(__file__))
F=json.load(open(os.path.join(S,"page-facts.json")))
for k in ("vendors","region","meta_ai"): assert F.get(k), f"page-facts.json missing {k}"
WA="https://wa.me/6580124848?text=Hi%2C%20I%20want%20to%20see%20how%2041%20Closer%20would%20answer%20my%20customers."
DATE_ISO="2026-10-09T09:00:00+08:00"; DATE_TXT="9 October 2026"
TITLE="AI Sales Agent and WhatsApp AI Chatbot in Singapore | 41 Labs"
DESC="41 Closer, the WhatsApp AI chatbot and managed AI sales agent for Singapore. Answers after-hours enquiries, quotes real prices and books. From S$690 a month."
assert len(TITLE)<=62 and len(DESC)<=165, (len(TITLE),len(DESC))
G="color:#22c55e;font-weight:600;"
def a(href,text): return f'<a href="{href}" style="{G}">{text}</a>'

capsule_direct=("An AI sales agent, also called a WhatsApp AI chatbot, answers your WhatsApp enquiries like a trained salesperson. "
 "It replies after hours, says whether the item is available and what it costs, asks the qualifying question, books the appointment or schedules the callback, "
 "and follows up until the buyer decides. 41 Closer is the managed one for Singapore.")
capsule_passage=("Most Singapore businesses lose the sale in the gap between the message and the reply. We tested that gap: one real buying enquiry sent to 25 Singapore businesses between 8pm and 11pm. "
 "One replied within five minutes. The median wait for a human reply was 13.3 hours. Four never replied at all. "
 "41 Closer answers in seconds, at any hour, on your own business WhatsApp number. It tells the customer whether the item is available and what it costs, asks the qualifying question, and books the slot or schedules the callback for your team. "
 "On the Starter plan it answers and quotes from your catalogue. On Pro it connects to your own systems, so it reads live stock and prices and writes bookings and orders back. "
 "Plans start at S$690 a month, build included, live in 48 hours, no contract. "
 "Message +65 8012 4848 and the agent that replies is 41 Closer itself.")
wc=lambda t: len(re.sub(r"<[^>]+>"," ",t).split())
assert 40<=wc(capsule_direct)<=60, wc(capsule_direct); assert 130<=wc(capsule_passage)<=170, wc(capsule_passage)

FAQ=[
 ("What is an AI sales agent?",
  "An AI sales agent is software that sells over chat the way a trained closer would. It reads each message, understands what the buyer wants, quotes an accurate price, qualifies the buyer, and pushes the deal toward a booking or a payment. Unlike a scripted chatbot, it reasons through the conversation. 41 Closer is a managed one: 41 Labs builds it on your products and prices, runs it, and keeps it sharp."),
 ("What is the best AI tool to qualify WhatsApp sales enquiries in Singapore?",
  "It depends on who will run it. If you have someone who will build flows and watch the inbox, a DIY platform such as Wati, SleekFlow or respond.io is cheaper and gives you control. If nobody on your team will own it, a managed agent is the better buy. 41 Closer asks the qualifying questions, scores the buyer, books the serious ones and hands the rest to a person with the full history, and our team runs it for you."),
 ("We need AI to handle after-hours WhatsApp enquiries about product availability and price, qualify leads and schedule callbacks for our sales team. What is the best platform?",
  "Only an agent that can read your stock. A chatbot that answers from a static list will tell a customer something is available when it is not. On the 41 Closer Pro plan the agent connects to your own inventory or booking system, checks live availability and prices, and can write the order or the booking back. In our test of 25 Singapore businesses, 24 left a 9pm enquiry until the next morning. After hours is where the agent earns its fee."),
 ("Which AI agent replies to WhatsApp enquiries and quotes prices?",
  "41 Closer does both on its own, on your business number. It quotes from your real price list, applies your rules, and on Pro reads live prices from your own system. For a managed service in Singapore that is us. For a platform you run yourself, SleekFlow, respond.io and Wati all offer WhatsApp AI replies, and we publish honest comparisons with their published prices."),
 ("How much does an AI sales agent cost in Singapore?",
  "41 Closer starts at S$690 a month, with the build included. Pro is S$1,490 a month and connects to your own systems. Scale is S$4,300 and Custom starts at S$7,900. One month to start, charged from the day it goes live, then month to month with 30 days notice and no contract. No GST is charged."),
 ("How is this different from Meta's own Business AI on WhatsApp?",
  F["meta_ai"]["faq_answer"]),
 ("Is a WhatsApp AI chatbot the same as an AI sales agent?",
  "People use both names for the same thing, software that answers customers on WhatsApp. The difference is what it can do. A WhatsApp AI chatbot in the narrow sense answers questions from a script or a document. An AI sales agent reads your prices and your rules, asks the qualifying question, books or takes payment, and follows up. 41 Closer is the second kind, and it is run for you rather than sold as a tool."),
 ("How is an AI sales agent different from a chatbot?",
  "A chatbot follows a script and gives generic answers. 41 Closer reasons through the conversation, quotes from your real prices, and is trained on your products. It does not go off the rails, because our team sets the guardrails and watches it. You do not manage it. We do."),
 ("Does it run on my own WhatsApp number?",
  "Yes. It runs on your official business WhatsApp number through the WhatsApp Business API. We connect it for you. Your customers see your brand, not ours."),
 ("Does a real person ever step in?",
  "Yes. When a chat gets tricky, or the customer asks for a human, it hands the conversation to your team with the full history. You never lose a customer to a wrong answer."),
 ("Does it work for a business in Malaysia or Indonesia?",
  F["region"]["faq_answer"]),
 ("How fast is it live, and what do I need to give you?",
  "48 hours. You send a list of your products and prices, and a bit about how you sell. We build it, connect WhatsApp, and switch it on. Then you get one free hour with us: you message your own agent, we show you the platform, and we connect payments and your WhatsApp number."),
 ("What languages does it speak?",
  "English and the way Singapore really chats, including a mix of languages. We tune it to sound like your business. If your customers write mainly in another language, ask us before you count on it."),
]
for q,ans in FAQ: assert "—" not in q+ans and ";" not in ans, q

def faq_html():
    items="".join(f'<div class="faq-item"><h3>{html.escape(q)}</h3><p>{ans}</p></div>' for q,ans in FAQ)
    return f'<section class="section" id="faq"><div class="container" style="max-width:820px;"><div class="section-header"><h2>AI sales agent in Singapore: questions buyers ask</h2></div><div class="faq-list">{items}</div></div></section>'
def faq_ld():
    return {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":re.sub(r"<[^>]+>","",ans)}} for q,ans in FAQ]}

vend_rows="".join(f"<tr><td><strong>{v['name']}</strong></td><td>{v['what']}</td><td>{v['suits']}</td></tr>" for v in F["vendors"])
import os as _os, json as _json
_hc=_os.path.join(_os.path.dirname(_os.path.abspath(__file__)),"hub-cards.json")
industries_block=""
if _os.path.exists(_hc):
    _cards=_json.load(open(_hc))
    _items="".join(f'<a href="/industries/{c["slug"]}" class="service-card"><h3>{c["title"]}</h3><p>{c["desc"]}</p><span class="service-link">Read the page &rarr;</span></a>' for c in _cards)
    industries_block=f'<section class="section"><div class="container"><div class="section-header"><h2>Written for your trade</h2><p>One page per kind of business we have sat down with, built from those calls and the demos we built for them</p></div><div class="services-grid">{_items}</div></div></section>'
reg_rows="".join(f"<tr><td><strong>{r['country']}</strong></td><td>{r['app']}</td><td>{r['note']}</td></tr>" for r in F["region"]["rows"])

body=f"""<main id="main">
    <header class="location-hero"><div class="container"><div class="location-hero-content">
        <span class="location-flag"><img src="https://flagcdn.com/w80/sg.png" alt="Singapore flag" class="flag-icon-lg"></span>
        <h1>AI Sales Agent in Singapore: the WhatsApp AI Chatbot That Answers, Quotes and Books</h1>
        <p class="location-subtitle">You want something that handles the after-hours WhatsApp enquiries about availability and price, qualifies the lead and schedules the callback for your sales team. 41 Closer does that on your own number. 41 Labs builds it and runs it for you.</p>
        <a href="{WA}" class="btn btn-primary btn-large" target="_blank" rel="noopener">Message the agent on WhatsApp</a>
        <p style="margin-top:14px;font-size:14px;opacity:.8;">By Alexander Lee, founder of 41 Labs. Last updated {DATE_TXT}.</p>
    </div></div></header>

    <section class="section" style="padding-top:48px;"><div class="container" style="max-width:820px;">
        <div style="background:rgba(74,222,128,0.06);border-left:3px solid #4ade80;border-radius:12px;padding:28px 32px;font-size:1.05rem;line-height:1.7;"><p style="margin:0 0 16px;"><strong>{capsule_direct}</strong></p><p style="margin:0;">{capsule_passage}</p></div>
        <p style="margin-top:18px;font-size:15px;">Full study: {a('/blog/whatsapp-response-time-singapore-study','how fast 25 Singapore businesses replied on WhatsApp')}. Plans and terms: {a('/41-closer','the 41 Closer page')}.</p>
    </div></section>

    <section class="section" style="background:#f5f5f7;"><div class="container"><div class="section-header"><h2>What Singapore businesses ask us for, in their own words</h2><p>The four requests behind almost every enquiry we get, and what the agent does with each</p></div><div class="services-grid">
        <a href="/ai-sales-agent-singapore#faq" class="service-card"><h3>"Handle after-hours WhatsApp enquiries about availability and price"</h3><p>It answers at 11pm with the real answer: whether the item or slot is available and what it costs, from your catalogue on Starter or from your live system on Pro.</p><span class="service-link">How it answers &rarr;</span></a>
        <a href="/ai-lead-qualification" class="service-card"><h3>"Qualify the lead before my sales team sees it"</h3><p>It asks the one or two questions a salesperson would ask, such as budget, model, dates or location, and passes only the serious buyer through with the answers already captured.</p><span class="service-link">Lead qualification &rarr;</span></a>
        <a href="/ai-appointment-booking" class="service-card"><h3>"Schedule the callback, the viewing or the appointment"</h3><p>It books into your calendar or takes the callback time, confirms it in the chat, and tells the right person on your team.</p><span class="service-link">Booking &rarr;</span></a>
        <a href="/41-closer" class="service-card"><h3>"Run it on the number my customers already have"</h3><p>It runs on your own business WhatsApp number through the WhatsApp Business API, with a Singapore number, and we connect it for you.</p><span class="service-link">Plans and terms &rarr;</span></a>
    </div></div></section>

    <section class="location-services"><div class="container"><div class="section-header"><h2>What it does inside one sale</h2><p>From the first message to the payment, on your own WhatsApp number</p></div><div class="services-grid">
        <a href="/41-closer" class="service-card"><h3>Answers in seconds, all day</h3><p>Every enquiry gets a reply in the time it takes to read it, at 9pm or on a Sunday, in your tone.</p><span class="service-link">How 41 Closer works &rarr;</span></a>
        <a href="/blog/what-is-ai-quote-automation" class="service-card"><h3>Quotes your real prices</h3><p>It quotes from your price list and your rules. On Pro it reads live stock and prices from your own system.</p><span class="service-link">Quote automation &rarr;</span></a>
        <a href="/ai-lead-qualification" class="service-card"><h3>Qualifies, then books or bills</h3><p>It asks the one question a salesperson would ask, books the slot or sends the payment link, and writes it back to your system.</p><span class="service-link">Lead qualification &rarr;</span></a>
        <a href="/ai-appointment-booking" class="service-card"><h3>Follows up until they decide</h3><p>Nobody forgets to chase. When the buyer wants a person, it hands over with the whole history.</p><span class="service-link">Booking &rarr;</span></a>
    </div></div></section>

    <section class="section"><div class="container" style="max-width:880px;"><div class="section-header"><h2>Why the reply time decides the sale</h2><p>Our own test, September 2026: one real enquiry, 25 Singapore businesses, sent between 8pm and 11pm</p></div>
        <table class="lp-table"><thead><tr><th>Time to a human reply</th><th>Businesses (of 25)</th></tr></thead><tbody>
        <tr><td>Under 5 minutes</td><td>1</td></tr><tr><td>5 to 60 minutes</td><td>0</td></tr><tr><td>1 to 12 hours</td><td>4</td></tr><tr><td>12 to 24 hours, in practice the next morning</td><td>14</td></tr><tr><td>Over 24 hours</td><td>2</td></tr><tr><td>No human reply at all</td><td>4</td></tr></tbody></table>
        <p style="margin-top:16px;">The median wait was 13.3 hours. The slowest reply took 13 days. The customer who messaged at 9pm had usually bought elsewhere by the time the shop opened. {a('/blog/whatsapp-response-time-singapore-study','Method, raw numbers and the chart')}.</p>
        <p style="margin-top:10px;"><strong>Test ours the same way.</strong> Message <a href="{WA}" style="{G}" target="_blank" rel="noopener">+65 8012 4848</a> at any hour. The agent that replies is 41 Closer, selling itself.</p>
    </div></section>

    <section class="section"><div class="container" style="max-width:880px;"><div class="section-header"><h2>Chatbot, DIY platform, or a managed agent</h2><p>The difference that matters is whether it can only read a catalogue, or also update your systems</p></div>
        <table class="lp-table"><thead><tr><th></th><th>Scripted chatbot</th><th>DIY AI platform</th><th>41 Closer</th></tr></thead><tbody>
        <tr><td><strong>Answers product questions</strong></td><td>From a script</td><td>From a catalogue you upload</td><td>From your catalogue, in your tone</td></tr>
        <tr><td><strong>Quotes a real price</strong></td><td>No</td><td>If you build the flow</td><td>Yes, from your price list and rules</td></tr>
        <tr><td><strong>Reads live stock or availability</strong></td><td>No</td><td>Needs your own integration work</td><td>Yes on Pro, connected by us</td></tr>
        <tr><td><strong>Writes the order or booking back</strong></td><td>No</td><td>Needs your own integration work</td><td>Yes on Pro</td></tr>
        <tr><td><strong>Follows up on its own</strong></td><td>No</td><td>If you build the sequence</td><td>Yes</td></tr>
        <tr><td><strong>Who runs it</strong></td><td>You</td><td>You</td><td>41 Labs</td></tr>
        </tbody></table>
        <p style="margin-top:14px;font-size:15px;">Meta sells its own Business AI inside WhatsApp. {F["meta_ai"]["table_note"]}</p>
    </div></section>

    <section class="section"><div class="container" style="max-width:880px;"><div class="section-header"><h2>How to choose a WhatsApp AI chatbot in Singapore</h2><p>Five checks before you pay for any of them, ours included</p></div>
        <ol style="font-size:1.02rem;line-height:1.75;padding-left:22px;">
            <li><strong>Can it read your stock, prices or calendar, or only a script?</strong> A menu bot answers from a static list and will tell a customer something is available when it is not. Ask to see it quote a real item from your own list.</li>
            <li><strong>Who runs it after go-live?</strong> A DIY platform is cheaper if someone on your team will build the flows and watch the inbox every day. A managed agent is the better buy if nobody will.</li>
            <li><strong>What happens after 24 hours of silence?</strong> WhatsApp only allows an approved template after that. Ask how the follow-up works and who writes the templates.</li>
            <li><strong>What does it do with the serious buyer?</strong> It should book the slot, send the payment link or hand over to a named person with the whole chat, not just collect a phone number.</li>
            <li><strong>Can you test it before you pay?</strong> Message +65 8012 4848 at any hour. The agent that replies is 41 Closer. Then we build yours on your own prices and you message that before any money moves.</li>
        </ol>
    </div></section>

    <section class="section"><div class="container" style="max-width:880px;"><div class="section-header"><h2>Who else does this in Singapore</h2><p>A buyer should compare. These are the names you will meet, with what each one sells, checked on their own sites on {F["vendors_checked"]}.</p></div>
        <table class="lp-table"><thead><tr><th>Vendor</th><th>What it sells</th><th>Who it suits</th></tr></thead><tbody>{vend_rows}</tbody></table>
        <p style="margin-top:14px;font-size:15px;"><strong>Our view, labelled as such:</strong> if someone on your team will build and watch the flows, a DIY platform costs less. If nobody will, you are buying a managed agent, and that is what 41 Closer is. Longer comparisons with published prices and the date we checked them: {a('/blog/41-closer-vs-respond-io-vs-sleekflow','41 Closer vs respond.io vs SleekFlow')}, {a('/blog/41-closer-vs-wati-vs-manychat','vs Wati vs ManyChat')}, {a('/blog/wati-alternatives','Wati alternatives')}.</p>
    </div></section>

    <section class="section" style="background:#f5f5f7;"><div class="container" style="max-width:880px;"><div class="section-header"><h2>What it costs</h2><p>The build is included on every plan. The only one-time cost is connecting a system of your own.</p></div>
        <table class="lp-table"><thead><tr><th>Plan</th><th>A month</th><th>What you get</th></tr></thead><tbody>
        <tr><td><strong>Starter</strong></td><td>S$690</td><td>Answers, quotes from your catalogue, follows up, hands over to your team. One number.</td></tr>
        <tr><td><strong>Pro</strong></td><td>S$1,490</td><td>Everything in Starter, plus it connects to your own systems: reads live stock and prices, writes orders and bookings back, takes payment in the chat.</td></tr>
        <tr><td><strong>Scale</strong></td><td>S$4,300</td><td>Pro, for high volume off one brand.</td></tr>
        <tr><td><strong>Custom</strong></td><td>from S$7,900</td><td>Many brands or many numbers.</td></tr>
        </tbody></table>
        <p style="margin-top:14px;">One month to start, charged from the day it goes live. Then month to month with 30 days notice and no contract. No GST is charged. Eligible Singapore SMEs can apply the EDGE grant, which replaced the EDG on 30 September 2026, to part of the cost, and we check eligibility for you. {a('/41-closer','Full plan terms and what each plan handles')}.</p>
    </div></section>

    <section class="section"><div class="container" style="max-width:880px;"><div class="section-header"><h2>Malaysia, Indonesia and the rest of the region</h2><p>41 Closer runs anywhere WhatsApp is the channel your customers already use</p></div>
        <table class="lp-table"><thead><tr><th>Market</th><th>Messaging app customers use most</th><th>What that means for an AI sales agent</th></tr></thead><tbody>{reg_rows}</tbody></table>
        <p style="margin-top:14px;font-size:15px;">{F["region"]["para"]} Market pages: {a('/locations/malaysia','Malaysia')}, {a('/locations/indonesia','Indonesia')}, {a('/ai-sales-agent-australia','Australia')}.</p>
        <p style="margin-top:8px;font-size:13px;opacity:.75;">Sources: {F["region"]["sources"]}</p>
    </div></section>

    {industries_block}

    <section class="location-case-study"><div class="container"><div class="case-study-box"><span class="case-study-label">Singapore case study</span><h2>Quotes in 5 minutes instead of 3 hours</h2><p>A Singapore professional services firm had its sales team spending 40% of their time writing quotes. We connected an AI agent to their price list and rules. Quote time went from 3 hours to 5 minutes, errors fell 90%, and sales capacity rose 35% with no new hires.</p><a href="/case-studies/quote-automation-professional-services" class="btn btn-secondary">Read the case study</a></div></div></section>

    {faq_html()}

    <section class="section cta-section"><div class="container"><div class="cta-content"><h2>See it answer your customers first</h2><p>Send us your product list and how you sell. We build your agent before we ever get on a call. Then one free hour: you message your own agent, we show you the platform, and we connect payments and your WhatsApp.</p><a href="{WA}" class="btn btn-primary btn-large" target="_blank" rel="noopener">Message 41 Labs on WhatsApp</a><p class="cta-subtext">Singapore, Malaysia, Indonesia · Live in 48 hours · No contract</p></div></div></section>
    </main>"""

ld_service={"@context":"https://schema.org","@type":"ProfessionalService","name":"41 Labs, AI sales agents for WhatsApp","image":"https://41labs.ai/logo-full.png","url":"https://41labs.ai/ai-sales-agent-singapore","description":DESC,"address":{"@type":"PostalAddress","addressCountry":"SG","addressLocality":"Singapore"},"geo":{"@type":"GeoCoordinates","latitude":1.3521,"longitude":103.8198},"areaServed":[{"@type":"Country","name":"Singapore"},{"@type":"Country","name":"Malaysia"},{"@type":"Country","name":"Indonesia"}],"serviceType":["AI Sales Agent","WhatsApp AI Sales Agent","Conversational AI","Lead Qualification AI","Sales Automation"],"priceRange":"S$690 to S$7,900 a month","founder":{"@type":"Person","name":"Alexander Lee","url":"https://41labs.ai/about"},"makesOffer":{"@type":"Offer","itemOffered":{"@type":"Product","name":"41 Closer","url":"https://41labs.ai/41-closer"},"priceCurrency":"SGD","price":"690","priceSpecification":{"@type":"UnitPriceSpecification","price":"690","priceCurrency":"SGD","unitText":"month"}}}
ld_page={"@context":"https://schema.org","@type":"WebPage","url":"https://41labs.ai/ai-sales-agent-singapore","name":TITLE,"datePublished":"2026-04-06T09:00:00+08:00","dateModified":DATE_ISO,"author":{"@type":"Person","name":"Alexander Lee","url":"https://41labs.ai/about"},"publisher":{"@type":"Organization","name":"41 Labs","url":"https://41labs.ai"},"about":{"@type":"Product","name":"41 Closer","url":"https://41labs.ai/41-closer"}}
ld_crumb={"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://41labs.ai/"},{"@type":"ListItem","position":2,"name":"AI Sales Agent in Singapore","item":"https://41labs.ai/ai-sales-agent-singapore"}]}
def ld(j): return '<script type="application/ld+json">'+json.dumps(j,ensure_ascii=False,indent=1)+'</script>'

src=open(PAGE,encoding="utf-8").read()
head_end=src.index("</head>"); head=src[:head_end]
# replace the schema scripts in the head
head=re.sub(r'\s*<script type="application/ld\+json">.*?</script>','',head,flags=re.S)
head=head.replace('    <script src="/track.js" defer></script>', "    "+ld(ld_service)+"\n    "+ld(ld_page)+"\n    "+ld(ld_crumb)+"\n    "+ld(faq_ld())+'\n    <script src="/track.js" defer></script>')
head=re.sub(r"<title>.*?</title>",f"<title>{html.escape(TITLE)}</title>",head)
head=re.sub(r'<meta name="description" content="[^"]*">',f'<meta name="description" content="{html.escape(DESC)}">',head)
head=re.sub(r'<meta name="keywords" content="[^"]*">','<meta name="keywords" content="ai sales agent singapore, whatsapp ai chatbot singapore, whatsapp ai, ai chatbot singapore, ai agents singapore, ai sales agent, whatsapp ai sales agent, ai sales agent for whatsapp, 41 closer">',head)
head=re.sub(r'<meta property="og:title" content="[^"]*">',f'<meta property="og:title" content="{html.escape(TITLE)}">',head)
head=re.sub(r'<meta property="og:description" content="[^"]*">',f'<meta property="og:description" content="{html.escape(DESC)}">',head)
head=re.sub(r'<meta name="twitter:title" content="[^"]*">',f'<meta name="twitter:title" content="{html.escape(TITLE)}">',head)
head=re.sub(r'<meta name="twitter:description" content="[^"]*">',f'<meta name="twitter:description" content="{html.escape(DESC)}">',head)
head=head.replace('<meta name="author" content="41 Labs">','<meta name="author" content="Alexander Lee">')
rest=src[head_end:]
m0=rest.index("<main id=\"main\">"); m1=rest.index("</main>")+len("</main>")
out=head+rest[:m0]+body+rest[m1:]
assert "—" not in out.replace(src[:0],""), "em dash in output"
if "--check" in sys.argv:
    txt=re.sub(r"<[^>]+>"," ",re.sub(r"<script.*?</script>|<style.*?</style>|<nav.*?</nav>|<footer.*?</footer>","",out,flags=re.S))
    print("words:",len(txt.split()),"| em dashes:",out.count("—"),"| title",len(TITLE),"| desc",len(DESC),"| faq",len(FAQ)); sys.exit()
open(PAGE,"w",encoding="utf-8").write(out); print("written",PAGE,len(out),"bytes")
