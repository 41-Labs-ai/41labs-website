#!/usr/bin/env python3
"""Rebuild /41-closer from one content dict (density plan, Phase 1).
Keeps the page's own head, CSS, nav, hero and footer. Rebuilds everything between the hero and the footer:
capsule, price block (second on the page), how it starts, what it does, proof, who should not buy, founder, FAQ, CTA.
Facts: 41 Labs/pricing/41-CLOSER-PRICING.md. Rule: no overage price, no Meta fee, no guarantee, no invented number."""
import re, json, html, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gates import check
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PAGE = os.path.join(ROOT, "41-closer.html")
WA = "https://wa.me/6580124848?text=Hi%2C%20I%20want%20to%20see%20how%2041%20Closer%20would%20answer%20my%20customers."
TITLE = "41 Closer | The AI Closer for WhatsApp. It Closes the Deal."
DESC = "The AI Closer: a WhatsApp AI sales agent that answers in seconds, quotes your real prices and takes payment, day and night. Built and run for you. From $690 a month."
assert len(DESC) <= 165, len(DESC)

CAPSULE = ("41 Closer is a managed AI sales agent on your own WhatsApp number. It answers every customer in seconds, at any hour, "
           "quotes from your real prices, asks the one qualifying question, and takes the payment or books the slot. "
           "41 Labs builds it before you pay and runs it for you. From $690 a month, build included.")
CAPSULE_2 = ("We measured the gap it closes. One real enquiry sent to 25 Singapore businesses between 8pm and 11pm: one replied within five minutes, "
             "the median wait was 13.3 hours, four never replied. The study is linked below.")

TIERS = [
    ("Starter", "For one shop or one WhatsApp number.", "$690", "350 new customers",
     ["Answers every message, day and night", "Quotes from your real prices", "Runs on your own WhatsApp number", "We set it up and load your catalogue", "Hands tricky ones to your team"], False),
    ("Pro", "For a real catalogue that needs to close and take payment.", "$1,490", "1,000 new customers",
     ["Everything in Starter", "Connects to your own systems", "Reads live stock and prices", "Writes orders and bookings back", "Takes payment right in the chat"], True),
    ("Scale", "For high volume off one brand.", "$4,300", "3,000 new customers",
     ["Everything in Pro", "Your own account manager", "We tune it for you every month", "Priority support"], False),
]

STEPS = [
    ("You send your list", "Your products and prices, and a bit about how you sell. A photo of the price board or a voice note is fine. That is the only work on your side."),
    ("We build it. You message it before you pay.", "We train it on your prices, give it your voice, and put it on a test number. You message your own agent the way a customer would. Nothing is paid yet."),
    ("One free hour, then live", "We walk you through the platform, connect your payments and your WhatsApp number, and switch it on. Live within 48 hours of your list. Billing starts the day it goes live."),
]

FAQ = [
    ("What is 41 Closer pricing?",
     "Starter is $690 a month, Pro $1,490, Scale $4,300, and Custom from $7,900. The build is included in every plan. Pay monthly by card or bank transfer. One month to start, charged from the day it goes live, then month to month with 30 days notice and no contract. No GST is charged."),
    ("Is there a build fee or a setup fee?",
     "No. We train it on your products and prices, give it your way of talking, connect WhatsApp and switch it on, all inside the plan. The only one-time cost is connecting a system of your own that we have connected before, which is $2,400."),
    ("What do I need to give you?",
     "A list of your products and prices, and a bit about how you sell. We do everything else."),
    ("What happens if I get more customers than my plan?",
     "It keeps answering. We tell you when you reach 70% of your plan and again at the limit, so there are no surprises. You pick the next plan when you are ready."),
    ("Will the price go up later?",
     "Your price stays fixed while you are on the plan. If we ever raise prices, existing clients get 60 days written notice first."),
    ("Does it use my own WhatsApp number?",
     "Yes. It runs on your business WhatsApp number through the WhatsApp Business API. We connect it for you. Your customers see your brand, not ours."),
    ("What languages does it speak?",
     "English and the way Singapore really chats, including a mix of languages. We tune it to sound like your business. If your customers write mainly in another language, ask us before you count on it."),
    ("What if it does not work for me?",
     "You stop. One month is the only commitment you ever make, then month to month with 30 days notice. There is no guarantee attached, because you message your own agent before any money moves. You own the agent and everything it learns, and we never share or sell your data."),
]

def faq_html():
    items = "".join(f'<details class="clo-faq-item"{" open" if i == 0 else ""}><summary>{html.escape(q)}</summary><p>{html.escape(a)}</p></details>' for i, (q, a) in enumerate(FAQ))
    return f'''<section id="faq" class="clo-section clo-white clo-light">
        <div class="clo-wrap clo-center">
            <span class="clo-eyebrow">Questions</span>
            <h2 class="clo-h2">What buyers ask before they start.</h2>
            <div class="clo-faq">{items}</div>
        </div>
    </section>'''

def faq_ld():
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQ]}

def tier_html(name, who, price, customers, lines, featured):
    badge = '<span class="clo-tier-badge">Most popular</span>' if featured else ""
    lis = "".join(f"<li>{l}</li>" for l in lines)
    return f'''<div class="clo-tier{" featured" if featured else ""}">
                    {badge}
                    <h3 class="clo-tier-name">{name}</h3>
                    <p class="clo-tier-for">{who}</p>
                    <div class="clo-tier-price"><b>{price}</b><span>/month</span></div>
                    <p class="clo-tier-setup">About <b>{customers}</b> a month</p>
                    <ul>{lis}</ul>
                </div>'''

def steps_html():
    return "".join(f'''<div class="clo-step"><div class="clo-step-num">{i}</div><h3>{h}</h3><p>{p}</p></div>''' for i, (h, p) in enumerate(STEPS, 1))

MIDDLE = f'''
    <section class="clo-section--tight clo-deep">
        <div class="clo-wrap">
            <p class="clo-lead" style="font-size:1.15rem;"><strong style="color:#fff;">{CAPSULE}</strong></p>
            <p class="clo-lead">{CAPSULE_2} <a href="/blog/whatsapp-response-time-singapore-study" style="color:var(--accent);text-decoration:underline;">Read the study</a>.</p>
        </div>
    </section>

    <section id="plans" class="clo-section clo-deep">
        <div class="clo-wrap clo-center">
            <span class="clo-eyebrow">One price. No hidden fees.</span>
            <h2 class="clo-h2">The build is free. You pay monthly.</h2>
            <p class="clo-lead clo-narrow" style="margin-left:auto;margin-right:auto;">Pick the plan that fits how many customers message you. Every plan includes the build, your own WhatsApp number, and our team running it.</p>
            <div class="clo-tiers">{"".join(tier_html(*t) for t in TIERS)}</div>
            <p class="clo-reassure" style="margin-top:28px;"><b>One plan sits above these.</b> Past about 6,000 new customers a month, or more than one brand, Custom starts at $7,900. Ask us which one fits.</p>
            <p class="clo-reassure" style="margin-top:18px;"><b>No contract.</b> One month to start, charged from the day it goes live, not the day you sign. Month to month after that, 30 days notice. We tell you at 70% of your plan and again at the limit, so there are no shock bills.</p>
            <p class="clo-tiers-note">The customer numbers are estimates. Each plan includes a set amount of usage, and we divide it to show roughly how many new customers that covers. Prices in SGD. No GST is charged. Pay for a year up front and you get twelve months for ten. Eligible Singapore SMEs can apply the EDGE grant, which replaced the EDG on 30 September 2026, to part of the cost. <a href="/41-closer-terms" style="color:rgba(255,255,255,.7);text-decoration:underline;">Plan terms and fair use</a>.</p>
            <p style="margin-top:28px;"><a class="clo-btn-xl" href="{WA}" target="_blank" rel="noopener">Message the agent first, then pick a plan</a></p>
        </div>
    </section>

    <section id="how-it-starts" class="clo-section clo-white clo-light">
        <div class="clo-wrap clo-center">
            <span class="clo-eyebrow">How it starts</span>
            <h2 class="clo-h2">You send a list. We do the rest.</h2>
            <div class="clo-steps">{steps_html()}</div>
        </div>
    </section>

    <section id="see-it-work" class="clo-section clo-light">
        <div class="clo-wrap clo-center">
            <span class="clo-eyebrow">See it in action</span>
            <h2 class="clo-h2">It does not just chat. It closes.</h2>
            <p class="clo-lead clo-narrow" style="margin-left:auto;margin-right:auto;">Three messages your customers send today, and what the agent does with each.</p>
            <div class="clo-ex">
                <div class="clo-ex-card">
                    <span class="clo-ex-tag">Distributor &middot; 2:15am</span>
                    <div class="clo-ex-chat">
                        <div class="clo-ex-b in">Got 200 units of the 12mm bolts? Need them this week.</div>
                        <div class="clo-ex-b out">Yes, 200 in stock. $2,400 the lot, ships today. Want me to lock it in?</div>
                        <div class="clo-ex-b in">Do it.</div>
                    </div>
                    <span class="clo-ex-out">&#10003; Closed &middot; $2,400</span>
                </div>
                <div class="clo-ex-card">
                    <span class="clo-ex-tag">Retail &middot; saved a cold lead</span>
                    <div class="clo-ex-chat">
                        <div class="clo-ex-b in">How much for the leather sofa?</div>
                        <div class="clo-ex-b out">It is $1,890 with free delivery this week. Want me to hold one for you?</div>
                        <div class="clo-ex-b in">Yes please, hold it.</div>
                    </div>
                    <span class="clo-ex-out">&#10003; Saved the sale &middot; $1,890</span>
                </div>
                <div class="clo-ex-card">
                    <span class="clo-ex-tag">Services &middot; books and takes payment</span>
                    <div class="clo-ex-chat">
                        <div class="clo-ex-b in">Any slots this Saturday?</div>
                        <div class="clo-ex-b out">Yes, 2pm Saturday is open. A $50 deposit holds it. Pay here &#128073;</div>
                        <div class="clo-ex-b in">Paid. See you then.</div>
                    </div>
                    <span class="clo-ex-out">&#10003; Booked + paid &middot; Sat 2pm</span>
                </div>
            </div>
            <p class="clo-lead clo-narrow" style="margin:28px auto 0;font-size:1.02rem;">Prices and names above are examples. When a chat gets tricky, or the customer asks for a person, it hands over to your team with the whole history.</p>
        </div>
    </section>

    <section id="not-a-demo" class="clo-section clo-white clo-light">
        <div class="clo-wrap clo-center">
            <span class="clo-eyebrow">Not a demo</span>
            <h2 class="clo-h2">It is already running real businesses.</h2>
            <div class="clo-case">
                <span class="clo-case-badge">Real client &middot; kept private on request</span>
                <div class="clo-case-num">$300,000<span>a month running through 41 Closer at one Singapore industrial supplier</span></div>
                <p>It quotes live from the supplier's own catalogue, replies in seconds day and night, and our team steps in only for the tricky ones. It does not go off script, because we set the guardrails and watch it.</p>
                <p class="clo-case-by">In our published quote-automation case, quote time went from 3 hours to 5 minutes, errors fell 90% and sales capacity rose 35%. <a href="/case-studies/quote-automation-professional-services" style="color:var(--accent);text-decoration:underline;">Read the case</a>.</p>
            </div>
        </div>
    </section>

    <section id="not-for" class="clo-section clo-light">
        <div class="clo-wrap clo-center">
            <span class="clo-eyebrow">Honest limit</span>
            <h2 class="clo-h2">Who should not buy this.</h2>
            <p class="clo-lead clo-narrow" style="margin-left:auto;margin-right:auto;">If you get a handful of enquiries a week and someone answers them the same day, a WhatsApp auto-reply is enough, and we will tell you so. 41 Closer pays for itself when messages arrive after hours, or faster than one person can answer.</p>
        </div>
    </section>

    <section id="founder" class="clo-section clo-white clo-light">
        <div class="clo-wrap clo-center">
            <span class="clo-eyebrow">From the founder</span>
            <h2 class="clo-h2">Why I built this.</h2>
            <div class="clo-founder">
                <p>I watched good businesses lose sales for one reason. The customer messaged, and nobody answered in time. The product was right. The price was right. The reply was slow.</p>
                <p>41 Closer fixes that one thing. It answers every message, every hour, and follows up until the customer buys or says no. We build it, run it, and keep making it better.</p>
                <p>If you do real business on WhatsApp, message the agent and see for yourself. If it impresses you, message me.</p>
                <p class="clo-sign">Alexander Lee<span>Founder, 41 Labs</span></p>
            </div>
        </div>
    </section>

    {faq_html()}

    <section id="start-now" class="clo-section clo-deep">
        <div class="clo-orb g" style="width:500px;height:500px;top:-180px;right:-120px;opacity:.4;"></div>
        <div class="clo-wrap">
            <div class="clo-final-grid">
                <div>
                    <span class="clo-eyebrow">Start now</span>
                    <h2 class="clo-h2">Stop losing sales tonight.</h2>
                    <p class="clo-lead">Message it on WhatsApp right now. Ask it anything your customers ask. Watch it close. Then pick a plan.</p>
                    <a class="clo-btn-xl" href="{WA}" target="_blank" rel="noopener">Chat with it now</a>
                </div>
                <div class="clo-hero-qr">
                    <div class="clo-qr-card">
                        <img src="41-closer-qr.png" alt="Scan to chat with 41 Closer on WhatsApp">
                        <p class="clo-qr-label">Scan to talk to it now</p>
                        <p class="clo-qr-sub">Point your phone camera here. It replies in seconds.</p>
                    </div>
                </div>
            </div>
        </div>
    </section>
'''

src = open(PAGE, encoding="utf-8").read()
hero_end = src.find("</header>", src.find('class="clo-deep clo-hero')) + len("</header>")
footer_start = src.find("<footer")
assert hero_end > 0 and footer_start > hero_end
pre, post = src[:hero_end], src[footer_start:]
# hero: drop the unsourced close-rate chip, keep the hero buttons (price anchor + demo)
pre = pre.replace('<span class="clo-chip"><i></i> 64.1% of chats end in a sale</span>', '<span class="clo-chip"><i></i> Replies in seconds, day and night</span>')
pre = pre.replace('<span class="clo-eyebrow" style="display:block;">The AI Closer &middot; not a chatbot</span>', '<span class="clo-eyebrow" style="display:block;">The AI Closer for WhatsApp &middot; not a chatbot</span>')
# head
pre = re.sub(r"<title>.*?</title>", f"<title>{html.escape(TITLE)}</title>", pre, count=1)
pre = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{html.escape(DESC)}">', pre, count=1)
for tag in ("og:title", "twitter:title"):
    pre = re.sub(rf'(<meta (?:property|name)="{tag}" content=")[^"]*(">)', rf'\g<1>{html.escape(TITLE)}\g<2>', pre)
for tag in ("og:description", "twitter:description"):
    pre = re.sub(rf'(<meta (?:property|name)="{tag}" content=")[^"]*(">)', rf'\g<1>{html.escape(DESC)}\g<2>', pre)
def fix_ld(m):
    try:
        j = json.loads(m.group(1))
    except Exception:
        return m.group(0)
    if j.get("@type") == "FAQPage":
        return '<script type="application/ld+json">' + json.dumps(faq_ld(), ensure_ascii=False, indent=1) + "</script>"
    return m.group(0)
pre = re.sub(r'<script type="application/ld\+json">(.*?)</script>', fix_ld, pre, flags=re.S)
assert pre.count('"FAQPage"') == 1

out = pre + "\n" + MIDDLE + "\n    " + post
problems, stats = check(out, max_words=1500, faq=FAQ, max_ctas=3)
print(stats)
if problems:
    print("REFUSED:"); [print("  -", p) for p in problems]; sys.exit(1)
if "--check" in sys.argv:
    sys.exit(0)
open(PAGE, "w", encoding="utf-8").write(out)
print("written", PAGE, len(out), "bytes")
