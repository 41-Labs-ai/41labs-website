#!/usr/bin/env python3
"""Rebuild /ai-automation-agency-singapore as a 41 Closer page. Visible FAQ and FAQPage
JSON-LD come from one list. No unsourced statistics: every number traces to a 41 Labs page."""
import json, re, html, sys, os
ROOT=os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","..")); PAGE=os.path.join(ROOT,"ai-automation-agency-singapore.html")
WA="https://wa.me/6580124848?text=Hi%2C%20I%20want%20to%20see%20how%2041%20Closer%20would%20answer%20my%20customers."
DATE_ISO="2026-10-09T10:00:00+08:00"; DATE_TXT="9 October 2026"
TITLE="AI Automation Agency in Singapore, Built and Run | 41 Labs"
DESC="41 Labs is a Singapore AI automation agency with one product: 41 Closer, an AI sales agent for WhatsApp we build on your prices and run for you. From S$690 a month."
assert len(TITLE)<=60 and len(DESC)<=165, (len(TITLE),len(DESC))
G="color:#22c55e;font-weight:600;"
def a(href,text): return f'<a href="{href}" style="{G}">{text}</a>'
wc=lambda t: len(re.sub(r"<[^>]+>"," ",t).split())
direct=("An AI automation agency builds the AI that does a process for you and connects it to the systems you already use. "
 "41 Labs is a Singapore agency with one product: 41 Closer, an AI sales agent for WhatsApp. We build it on your prices and tone, "
 "connect it to your stock, booking and payment systems, and run it.")
passage=("The first process worth automating in most Singapore businesses is the sales conversation itself, because that is where the money leaks. "
 "We sent one real enquiry to 25 Singapore businesses between 8pm and 11pm. One replied within five minutes. The median wait for a human reply was 13.3 hours, and four never replied. "
 "41 Closer answers in seconds, quotes from your real price list, books or takes payment, and follows up until the buyer decides. "
 "Unlike a typical agency we do not hand over a system and leave. There is no build fee. You pay from S$690 a month, month to month, no contract, and we keep tuning it. "
 "The only one-time cost is connecting a system of your own, from S$2,400 for a platform we have connected before. "
 "Eligible Singapore SMEs can put the EDGE grant toward it. Test the agent before you talk to us: message +65 8012 4848.")
assert 40<=wc(direct)<=60, wc(direct); assert 130<=wc(passage)<=170, wc(passage)
FAQ=[
 ("What does an AI automation agency do?","It builds the AI that does a process for you and connects it to the systems you already use. Some agencies build a custom system and hand it over. Some resell a platform you configure. 41 Labs builds one thing, the 41 Closer sales agent for WhatsApp, connects it to your stock, booking and payment systems, and runs it."),
 ("How do I choose an AI automation agency in Singapore?","Ask four questions. Who runs it after go-live? Can I test it on my own products before I pay? What does it cost to connect the systems I already use? What happens if I stop? With 41 Labs: we run it, you message your own agent before the first call, connections from S$2,400, and you stop with 30 days notice."),
 ("Is 41 Labs the best AI automation agency in Singapore?","We are one of several good options. If your team will run a platform, Voltade, SleekFlow or respond.io cost less. If you want a custom system you own and maintain, Olano or DoubleAM build those. 41 Labs fits when you want an AI sales agent built on your prices, connected to your systems and run for you."),
 ("How much does an AI automation agency cost in Singapore?","41 Labs charges no build fee. 41 Closer starts at S$690 a month. Pro is S$1,490 and connects to your own systems, Scale is S$4,300, Custom from S$7,900. One month to start, then month to month with 30 days notice and no contract. No GST is charged. Connecting a system of your own is a one-time S$2,400."),
 ("What should a Singapore SME automate first?","The reply. In our test of 25 Singapore businesses, 24 left a 9pm enquiry until the next morning and four never answered. An agent that answers in seconds, quotes a real price and books the job recovers sales you lose today. Quotes come second: one client went from 3 hours to 5 minutes per quote."),
 ("Do you still build custom AI systems beyond the sales agent?","No. 41 Labs sells one product, 41 Closer, and the custom work we do is connecting it to the systems you already run: stock, CRM, booking, payment, quoting rules. If your need is something else, such as document processing on its own. We will tell you so on the first message and point you to someone who does that."),
 ("Can the EDGE grant, formerly EDG, cover it?","The EDG closed on 29 September 2026. Its replacement, the EDGE grant, covers up to 70% of qualifying costs for eligible SMEs and up to 50% for larger companies. We run the eligibility check and help with the paperwork. The grant does not change the monthly price or the no-contract terms."),
 ("Do you work with businesses in Malaysia or Indonesia?","Yes, where WhatsApp is the channel, and in Malaysia and Indonesia it is the most-used app. The setup is the same as in Singapore: your own WhatsApp Business number, built in 48 hours, run by us from Singapore, billed in Singapore dollars. We have no office in either country. If your customers write mainly in Bahasa, ask us first."),
]
for q,ans in FAQ: assert "—" not in q+ans and ";" not in ans, q
def faq_html():
    items="".join(f'<div class="faq-item"><h3>{html.escape(q)}</h3><p>{ans}</p></div>' for q,ans in FAQ)
    return f'<section class="section" id="faq"><div class="container" style="max-width:820px;"><div class="section-header"><h2>AI automation agency in Singapore: questions buyers ask</h2></div><div class="faq-list">{items}</div></div></section>'
def faq_ld(): return {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":re.sub(r"<[^>]+>","",ans)}} for q,ans in FAQ]}
body=f"""<main id="main">
    <header class="location-hero"><div class="container"><div class="location-hero-content">
        <span class="location-flag"><img src="https://flagcdn.com/w80/sg.png" alt="Singapore flag" class="flag-icon-lg"></span>
        <h1>AI Automation Agency in Singapore</h1>
        <p class="location-subtitle">Most agencies build you a system and hand it over. 41 Labs builds your AI sales agent for WhatsApp, connects it to your systems, and runs it. From S$690 a month, build included.</p>
        <a href="{WA}" class="btn btn-primary btn-large" target="_blank" rel="noopener">Message the agent on WhatsApp</a>
        <p style="margin-top:14px;font-size:14px;opacity:.8;">By Alexander Lee, founder of 41 Labs. Last updated {DATE_TXT}.</p>
    </div></div></header>

    <section class="section" style="padding-top:48px;"><div class="container" style="max-width:820px;">
        <div style="background:rgba(74,222,128,0.06);border-left:3px solid #4ade80;border-radius:12px;padding:28px 32px;font-size:1.05rem;line-height:1.7;"><p style="margin:0 0 16px;"><strong>{direct}</strong></p><p style="margin:0;">{passage}</p></div>
        <p style="margin-top:18px;font-size:15px;">The product page: {a('/41-closer','41 Closer, plans and terms')}. The sales-agent page: {a('/ai-sales-agent-singapore','AI sales agent in Singapore')}. Australia: {a('/ai-automation-agency-australia','our Australia page')}.</p>
    </div></section>

    <section class="location-services"><div class="container"><div class="section-header"><h2>What to automate first</h2><p>In the order the money comes back</p></div><div class="services-grid">
        <a href="/ai-sales-agent-singapore" class="service-card"><h3>1. The reply</h3><p>Every WhatsApp enquiry answered in seconds, at 9pm or on a Sunday, in your tone. This is where most Singapore businesses lose the sale.</p><span class="service-link">AI sales agent &rarr;</span></a>
        <a href="/blog/what-is-ai-quote-automation" class="service-card"><h3>2. The quote</h3><p>Quoted from your real price list and rules. One client went from 3 hours to 5 minutes a quote, errors down 90%.</p><span class="service-link">Quote automation &rarr;</span></a>
        <a href="/ai-appointment-booking" class="service-card"><h3>3. The booking and the payment</h3><p>Booked into your calendar or paid by link, in the same chat, and written back to your system.</p><span class="service-link">Booking &rarr;</span></a>
        <a href="/ai-lead-qualification" class="service-card"><h3>4. The follow-up</h3><p>Chased until the buyer decides, then handed to a person with the whole history when it should be.</p><span class="service-link">Lead qualification &rarr;</span></a>
    </div></div></section>

    <section class="section"><div class="container" style="max-width:880px;"><div class="section-header"><h2>A typical AI agency and 41 Labs</h2><p>The difference is what happens after go-live</p></div>
        <table class="lp-table"><thead><tr><th></th><th>Typical AI agency</th><th>41 Labs</th></tr></thead><tbody>
        <tr><td><strong>What you buy</strong></td><td>A custom system you then own and maintain, or a platform you configure</td><td>An AI sales agent built on your prices, connected to your systems, and run by us</td></tr>
        <tr><td><strong>How you pay</strong></td><td>A project fee, then a retainer or your own staff time</td><td>Monthly from S$690, build included, no contract</td></tr>
        <tr><td><strong>Proof before paying</strong></td><td>Slides and a demo of someone else's data</td><td>We build your agent before the first call. You message it.</td></tr>
        <tr><td><strong>Connecting your systems</strong></td><td>An integration project, scoped and quoted</td><td>From S$2,400 one-time for a platform we have connected before</td></tr>
        <tr><td><strong>After go-live</strong></td><td>Handover</td><td>We keep tuning it and watch it</td></tr>
        <tr><td><strong>If it is not working</strong></td><td>Depends on the contract</td><td>30 days notice, no contract</td></tr>
        </tbody></table>
    </div></section>

    <section class="section"><div class="container" style="max-width:880px;"><div class="section-header"><h2>Why the reply is first</h2><p>Our own test, September 2026: one real enquiry, 25 Singapore businesses, sent between 8pm and 11pm</p></div>
        <table class="lp-table"><thead><tr><th>Time to a human reply</th><th>Businesses (of 25)</th></tr></thead><tbody>
        <tr><td>Under 5 minutes</td><td>1</td></tr><tr><td>5 to 60 minutes</td><td>0</td></tr><tr><td>1 to 12 hours</td><td>4</td></tr><tr><td>12 to 24 hours, in practice the next morning</td><td>14</td></tr><tr><td>Over 24 hours</td><td>2</td></tr><tr><td>No human reply at all</td><td>4</td></tr></tbody></table>
        <p style="margin-top:16px;">Median wait 13.3 hours. {a('/blog/whatsapp-response-time-singapore-study','Method, raw numbers and the chart')}. Test ours the same way: message <a href="{WA}" style="{G}" target="_blank" rel="noopener">+65 8012 4848</a> at any hour and the agent that replies is 41 Closer.</p>
    </div></section>

    <section class="location-case-study"><div class="container"><div class="case-study-box"><span class="case-study-label">Singapore case study</span><h2>From 3 hours to 5 minutes per quote</h2><p>A Singapore professional services firm had its sales team spending 40% of their time writing quotes. We connected an AI agent to their price list and rules. Quote time went from 3 hours to 5 minutes, errors fell 90%, and sales capacity rose 35% with no new hires.</p><a href="/case-studies/quote-automation-professional-services" class="btn btn-secondary">Read the case study</a></div></div></section>

    <section class="location-grant"><div class="container"><div class="grant-box"><h2>The EDGE grant can cover part of it</h2><p>Eligible Singapore SMEs can apply the <strong>EDGE grant</strong>, which replaced the EDG on 30 September 2026, to an AI project, up to 70% of qualifying costs. We run the eligibility check and help with the paperwork. It does not change the monthly price or the no-contract terms.</p><a href="{WA}" style="color:#22c55e;font-weight:600;" target="_blank" rel="noopener">Ask about EDGE eligibility &rarr;</a></div></div></section>

    {faq_html()}

    <section class="section cta-section"><div class="container"><div class="cta-content"><h2>Tell us the one process costing you most</h2><p>If it is the sales conversation, we build your agent before we ever get on a call. Then one free hour: you message your own agent, we show you the platform, and we connect payments and your WhatsApp. If it is something else, we will say so on the first message.</p><a href="{WA}" class="btn btn-primary btn-large" target="_blank" rel="noopener">Message 41 Labs on WhatsApp</a><p class="cta-subtext">Singapore, Malaysia, Indonesia · Live in 48 hours · No contract</p></div></div></section>
    </main>"""
ld_service={"@context":"https://schema.org","@type":"ProfessionalService","name":"41 Labs, AI automation agency in Singapore","image":"https://41labs.ai/logo-full.png","url":"https://41labs.ai/ai-automation-agency-singapore","description":DESC,"address":{"@type":"PostalAddress","addressCountry":"SG","addressLocality":"Singapore"},"geo":{"@type":"GeoCoordinates","latitude":1.3521,"longitude":103.8198},"areaServed":[{"@type":"Country","name":"Singapore"},{"@type":"Country","name":"Malaysia"},{"@type":"Country","name":"Indonesia"}],"serviceType":["AI Automation Agency","AI Sales Agent","WhatsApp Automation","Sales Automation"],"priceRange":"S$690 to S$7,900 a month","founder":{"@type":"Person","name":"Alexander Lee","url":"https://41labs.ai/about"},"makesOffer":{"@type":"Offer","itemOffered":{"@type":"Product","name":"41 Closer","url":"https://41labs.ai/41-closer"},"priceCurrency":"SGD","price":"690","priceSpecification":{"@type":"UnitPriceSpecification","price":"690","priceCurrency":"SGD","unitText":"month"}}}
ld_page={"@context":"https://schema.org","@type":"WebPage","url":"https://41labs.ai/ai-automation-agency-singapore","name":TITLE,"dateModified":DATE_ISO,"author":{"@type":"Person","name":"Alexander Lee","url":"https://41labs.ai/about"},"publisher":{"@type":"Organization","name":"41 Labs","url":"https://41labs.ai"},"about":{"@type":"Product","name":"41 Closer","url":"https://41labs.ai/41-closer"}}
ld_crumb={"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://41labs.ai/"},{"@type":"ListItem","position":2,"name":"AI Automation Agency in Singapore","item":"https://41labs.ai/ai-automation-agency-singapore"}]}
def ld(j): return '<script type="application/ld+json">'+json.dumps(j,ensure_ascii=False,indent=1)+'</script>'
src=open(PAGE,encoding="utf-8").read(); head_end=src.index("</head>"); head=src[:head_end]
head=re.sub(r'\s*<script type="application/ld\+json">.*?</script>','',head,flags=re.S)
assert '    <script src="/track.js" defer></script>' in head
head=head.replace('    <script src="/track.js" defer></script>', "    "+ld(ld_service)+"\n    "+ld(ld_page)+"\n    "+ld(ld_crumb)+"\n    "+ld(faq_ld())+'\n    <script src="/track.js" defer></script>')
head=re.sub(r"<title>.*?</title>",f"<title>{html.escape(TITLE)}</title>",head)
head=re.sub(r'<meta name="description" content="[^"]*">',f'<meta name="description" content="{html.escape(DESC)}">',head)
head=re.sub(r'<meta name="keywords" content="[^"]*">','<meta name="keywords" content="ai automation agency singapore, ai agency singapore, ai automation singapore, whatsapp ai sales agent, 41 closer">',head)
for tag in ("og:title","twitter:title"): head=re.sub(rf'(<meta (?:property|name)="{tag}" content=")[^"]*(">)',rf'\g<1>{html.escape(TITLE)}\g<2>',head)
for tag in ("og:description","twitter:description"): head=re.sub(rf'(<meta (?:property|name)="{tag}" content=")[^"]*(">)',rf'\g<1>{html.escape(DESC)}\g<2>',head)
head=head.replace('<meta name="author" content="41 Labs">','<meta name="author" content="Alexander Lee">')
rest=src[head_end:]; m0=rest.index('<main id="main">'); m1=rest.index("</main>")+len("</main>")
out=head+rest[:m0]+body+rest[m1:]
assert "—" not in out
if "--check" in sys.argv:
    txt=re.sub(r"<[^>]+>"," ",re.sub(r"<script.*?</script>|<style.*?</style>|<nav.*?</nav>|<footer.*?</footer>","",out,flags=re.S)); print("words:",len(txt.split()),"| faq",len(FAQ),"| title",len(TITLE),"| desc",len(DESC)); sys.exit()

import sys as _sys, os as _os
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from gates import check as _check
_problems, _stats = _check(out, max_words=1500, faq=FAQ, price_token="S$690", max_ctas=3)
print(_stats)
if _problems:
    print("REFUSED:"); [print("  -", p) for p in _problems]; _sys.exit(1)
if "--check" in _sys.argv: _sys.exit(0)

open(PAGE,"w",encoding="utf-8").write(out); print("written",len(out),"bytes")
