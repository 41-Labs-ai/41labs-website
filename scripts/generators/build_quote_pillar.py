#!/usr/bin/env python3
"""Rebuild blog/what-is-ai-quote-automation.html as the quote-automation pillar (Google already
ranks this URL for the cluster). FAQ visible + FAQPage schema from one list. No unsourced numbers."""
import re, json, html, os, sys
ROOT=os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","..")); PAGE=os.path.join(ROOT,"blog/what-is-ai-quote-automation.html")
WA="https://wa.me/6580124848?text=Hi%2C%20can%20you%20quote%20me%20for%20"
TITLE="AI Quote Automation: What It Is, How It Works (2026) | 41 Labs"
DESC="AI quote automation reads an enquiry, prices it from your list or systems and sends the quote in minutes. How Singapore firms use it, the cost and the EDGE grant."
H1="AI Quote Automation: What It Is and How Singapore Firms Use It"
EXC="How an AI agent reads an enquiry, prices it from your list or your live systems, and sends the quote in minutes. Who it is for in Singapore, what changed for one client, what it costs, and how the EDGE grant applies."
DATE_ISO="2026-10-09T10:30:00+08:00"
assert len(TITLE)<=62 and len(DESC)<=165,(len(TITLE),len(DESC))
G="color:#22c55e;font-weight:600;"
def a(h,t): return f'<a href="{h}" style="{G}">{t}</a>'
wc=lambda t: len(re.sub(r"<[^>]+>"," ",t).split())
direct=("AI quote automation is software that reads an enquiry, pulls the right prices from your list or your systems, applies your rules, and sends a quote in minutes instead of hours. "
 "In Singapore, 41 Labs does this inside 41 Closer, the WhatsApp sales agent it builds and runs for you.")
passage=("Most quotes in Singapore still start with a WhatsApp message and end two days later with a PDF. The firm that replies first usually wins, and in our test of 25 Singapore businesses, 24 left a 9pm enquiry until the next morning. "
 "41 Closer reads the request, quotes from your price list on the Starter plan or from your live stock and pricing system on Pro, applies your discount and minimum-order rules, and sends the quote in the same chat. It can take the deposit or book the job there too. A person reviews where you want one. "
 "A Singapore professional services firm cut quote time from 3 hours to 5 minutes, with errors down 90% and sales capacity up 35%. "
 "Plans start at S$690 a month with the build included, live in 48 hours, no contract. Eligible Singapore SMEs can apply the EDGE grant. "
 "Message +65 8012 4848 and ask for a quote. The agent that replies is 41 Closer.")
assert 40<=wc(direct)<=60,wc(direct); assert 130<=wc(passage)<=170,wc(passage)
FAQ=[
 ("What is AI quote automation?","Software that reads an incoming enquiry, whether a WhatsApp message, an email or a PDF, pulls the right prices and rules from your own list or systems, and drafts an accurate quote in minutes. A person checks it where you want a check. 41 Labs runs it inside 41 Closer, a WhatsApp sales agent built on your products and prices."),
 ("How do I automate quotations over WhatsApp for a Singapore supplier?","Give the agent your price list and your rules, such as minimum order, trade discount and delivery charge by zone. It then answers each WhatsApp enquiry with a priced quote, asks for the missing detail when the customer has not given quantity or delivery address, and sends the order to you or writes it into your system. On the 41 Closer Pro plan it reads live stock, so it never quotes an item you do not have. Setup is 48 hours from your product list."),
 ("Can it quote from my product catalogue, or does it need my systems connected?","Both are possible. On Starter it quotes from a catalogue and price list you give us, which suits a business whose prices change a few times a year. On Pro it connects to your own inventory, ERP or pricing system, reads live prices and stock, and writes the order back. Connecting a system we have connected before is a one-time cost from S$2,400."),
 ("How much time does it save?","One Singapore professional services client went from about 3 hours per quote to about 5 minutes, with errors down 90% and the sales team handling 35% more volume without new hires. The bigger saving is the enquiries you stop losing: in our test, 24 of 25 Singapore businesses left a 9pm enquiry until the next morning, and the customer had often bought elsewhere by then."),
 ("What does AI quote automation cost in Singapore, and does the EDGE grant apply?","It is part of 41 Closer. Starter is S$690 a month and quotes from your catalogue. Pro is S$1,490 a month and connects to your own systems. The build is included, there is no setup fee, and the only one-time cost is connecting a system of your own, from S$2,400. One month to start, then month to month with 30 days notice and no contract. No GST is charged. The EDG closed on 29 September 2026. Eligible Singapore SMEs can apply its replacement, the EDGE grant, to part of the cost, up to 70% of qualifying costs, and we run the eligibility check."),
 ("Does it work for renovation and interior fit-out contractors?","For the enquiry and the first quote, yes: it prices from your rate card, asks for the unit size and scope, and sends an indicative quote the same evening instead of three days later. A quote that depends on a site measurement still needs your site visit, and the agent says so and books it. It does not invent a measurement to close a sale."),
 ("How accurate is it?","It quotes only from the prices and rules you give it, so it does not make up a price. The usual errors in manual quoting are copy and paste mistakes and old price lists, and those go away because there is one list and the agent reads it. Where a quote needs judgement, you set it to hand over to a person with the whole conversation."),
 ("How long until it is live?","48 hours from the day you send your product list and prices. Connecting your own stock or pricing system adds time, scoped per system. Before you commit to anything we build your agent and you message it yourself, then we spend one free hour showing you the platform and connecting payments and your WhatsApp."),
]
for q,ans in FAQ: assert "—" not in q+ans and ";" not in ans
faq_vis="".join(f"<h3>{html.escape(q)}</h3>\n<p>{ans}</p>\n" for q,ans in FAQ)
faq_ld={"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":ans}} for q,ans in FAQ]}
src=open(PAGE,encoding="utf-8").read()
fig=re.search(r'<figure style="margin:0 0 28px;">.*?</figure>',src,re.S).group(0)
fig=fig.replace("AI quote automation uses artificial intelligence to generate accurate quotes in minutes instead of hours. Learn how it works, who it&#x27;s for, and what results to expect.","An enquiry arrives, the agent prices it from your list or your systems, and the quote goes back in the same chat.")
body=f"""<div class="post-content">
                {fig}
<div style="background:rgba(74,222,128,0.06);border-left:3px solid #4ade80;border-radius:12px;padding:24px 28px;margin:0 0 28px;line-height:1.7;"><p style="margin:0 0 14px;"><strong>{direct}</strong></p><p style="margin:0;">{passage}</p></div>
<p style="font-size:0.9rem;color:#6b6b6b;">Last updated 9 October 2026. First published February 2026. This page replaces our earlier Singapore quote-automation page, which now points here.</p>

<h2>What AI quote automation is</h2>
<p>The manual version: a salesperson reads the request, looks up each product, checks the price list, works out quantities and discounts, formats a document, checks it, and sends it. For a complex product that is two to four hours, and the customer has often messaged two other suppliers in the meantime.</p>
<p>The automated version: the agent reads the request, pulls the prices, applies your rules, and sends the quote. If the request is missing something, it asks. If the quote needs a person, it hands over with the whole conversation. The time is minutes, and it happens at 9pm as well as 9am.</p>

<h2>How it works over WhatsApp</h2>
<ol>
<li><strong>It reads the enquiry.</strong> A message, a photo of a parts list, a PDF. It works out what is being asked for and asks one question if a detail is missing, such as quantity or delivery address.</li>
<li><strong>It prices it.</strong> From the catalogue and price list you gave us (Starter), or from your live stock and pricing system (Pro), so it never quotes an item you do not have.</li>
<li><strong>It applies your rules.</strong> Trade tiers, minimum order, delivery by zone, what needs approval. The rules are written down once and applied every time.</li>
<li><strong>It sends the quote and closes.</strong> In the same chat, with a payment link or a booking where that fits. Then it follows up until the buyer decides. Where you want a person to check first, it waits for them.</li>
</ol>

<h2>Which Singapore businesses need it most</h2>
<p>The firms that quote by hand and quote often.</p>
<ul>
<li><strong>Renovation and construction.</strong> You price from drawings, BOQs and site measurements. The agent prices the first quote from your rate card the same evening and books the site visit for the rest. {a('/blog/ai-quoting-construction-singapore','AI quoting for construction and renovation in Singapore')}.</li>
<li><strong>Freight and logistics.</strong> Rates change weekly across carriers and lanes. The agent reads the shipment details and quotes from the current rate sheet. {a('/blog/ai-freight-forwarding-quote-automation','AI freight quote automation')}.</li>
<li><strong>Suppliers and manufacturers.</strong> Parts lists, catalogues, customer-specific pricing. The agent applies the right tier and margin without the copy-paste errors. {a('/industries/ai-for-suppliers-distributors-singapore','AI for suppliers and distributors')}.</li>
</ul>
<p>A simple test: if a quote takes an hour or more, and you send many every week, the maths is on your side.</p>

<h2>What results can you expect</h2>
<p>One number we publish because it is ours. A Singapore professional services firm had its sales team spending 40% of their time on quotes. After we connected an AI agent to their price list and rules:</p>
<table class="lp-table"><thead><tr><th>Metric</th><th>Before</th><th>After</th></tr></thead><tbody>
<tr><td>Time per quote</td><td>About 3 hours</td><td>About 5 minutes</td></tr>
<tr><td>Quote errors</td><td>Regular</td><td>Down 90%</td></tr>
<tr><td>Sales capacity</td><td>Baseline</td><td>Up 35%, no new hires</td></tr>
</tbody></table>
<p>{a('/case-studies/quote-automation-professional-services','Read the case study')}. The other number that matters is reply time. We sent one real enquiry to 25 Singapore businesses between 8pm and 11pm: one replied within five minutes, the median wait was 13.3 hours, four never replied. {a('/blog/whatsapp-response-time-singapore-study','The full study')}.</p>

<h2>What it costs in Singapore, and the EDGE grant</h2>
<p>Quote automation is part of {a('/41-closer','41 Closer')}, not a separate project. Starter is S$690 a month and quotes from your catalogue. Pro is S$1,490 a month and connects to your own systems. The build is included. The only one-time cost is connecting a system of your own, from S$2,400 for a platform we have connected before. One month to start, then month to month with 30 days notice and no contract. No GST is charged. The EDG closed on 29 September 2026. Eligible Singapore SMEs can apply its replacement, the EDGE grant, to part of the cost, up to 70% of qualifying costs, and we run the eligibility check.</p>

<h2>How to start</h2>
<p>Send us your product list and your pricing rules. We build your agent before we get on a call. You message it and ask it for a quote. Then one free hour: we show you the platform, connect payments and your WhatsApp number, and it goes live, usually within 48 hours of the product list arriving.</p>
<p>Try the one we run for ourselves first: <a href="{WA}" style="{G}" target="_blank" rel="noopener">WhatsApp +65 8012 4848</a> and ask for a quote.</p>

<h2>Common questions about AI quote automation</h2>
{faq_vis}
            </div>"""
# body boundaries: from <div class="post-content"> to the related/CTA section
i=src.index('<div class="post-content">')
j=min([k for k in (src.find('<div class="related-articles"',i), src.find('<section class="section cta-section">',i)) if k>0])
# step back to the closing </div> of post-content: the last '</div>' before j
k=src.rfind("</div>",i,j)+len("</div>")
out=src[:i]+body+src[k:]
# header block
out=re.sub(r'<span class="post-date">[^<]*</span>','<span class="post-date">Updated October 2026</span>',out,count=1)
out=re.sub(r'<span class="post-read-time">[^<]*</span>','<span class="post-read-time">7 min read</span>',out,count=1)
out=re.sub(r'(<header class="post-header">.*?<h1>).*?(</h1>)',rf'\g<1>{html.escape(H1)}\g<2>',out,count=1,flags=re.S)
out=re.sub(r'<p class="post-excerpt">.*?</p>',f'<p class="post-excerpt">{html.escape(EXC)}</p>',out,count=1,flags=re.S)
# head
out=re.sub(r"<title>.*?</title>",f"<title>{html.escape(TITLE)}</title>",out,count=1)
out=re.sub(r'<meta name="description" content="[^"]*">',f'<meta name="description" content="{html.escape(DESC)}">',out,count=1)
for tag in ("og:title","twitter:title"): out=re.sub(rf'(<meta (?:property|name)="{tag}" content=")[^"]*(">)',rf'\g<1>{html.escape(TITLE)}\g<2>',out)
for tag in ("og:description","twitter:description"): out=re.sub(rf'(<meta (?:property|name)="{tag}" content=")[^"]*(">)',rf'\g<1>{html.escape(DESC)}\g<2>',out)
# schema: Article headline/description/dateModified; add FAQPage
def fix_ld(m):
    try: j=json.loads(m.group(1))
    except: return m.group(0)
    if j.get("@type")=="FAQPage": return ""  # drop last build's block so the generator is idempotent
    if j.get("@type")=="Article":
        j["headline"]=H1; j["description"]=DESC; j["dateModified"]=DATE_ISO; j["about"]={"@type":"Product","name":"41 Closer","url":"https://41labs.ai/41-closer"}
    if j.get("@type")=="WebPage": j["dateModified"]=DATE_ISO; j["name"]=TITLE
    return '<script type="application/ld+json">'+json.dumps(j,ensure_ascii=False,indent=1)+'</script>'
out=re.sub(r'<script type="application/ld\+json">(.*?)</script>',fix_ld,out,flags=re.S)
assert '"FAQPage"' not in out
out=out.replace('<script src="/track.js" defer></script>','<script type="application/ld+json">'+json.dumps(faq_ld,ensure_ascii=False,indent=1)+'</script>\n    <script src="/track.js" defer></script>',1)
out=out.replace('href="/ai-quote-automation-singapore"','href="/blog/what-is-ai-quote-automation"')
assert "—" not in out and 'href="/ai-quote-automation-singapore"' not in out
if "--check" in sys.argv:
    txt=re.sub(r"<[^>]+>"," ",re.sub(r"<script.*?</script>|<style.*?</style>|<nav.*?</nav>|<footer.*?</footer>","",out,flags=re.S)); print("words:",len(txt.split()),"faq",len(FAQ)); sys.exit()
open(PAGE,"w",encoding="utf-8").write(out); print("written",len(out))
