#!/usr/bin/env python3
"""Build /ai-manager and /ai-operations-admin, two of the four AIs in 41 Sales Team.

Siblings of /41-closer (the AI Sales Closer). Same site.css components, the shared
header and footer partials read at build time, and one content dict per page so the
visible FAQ and the FAQPage JSON-LD are written from the same strings and cannot drift.

18 Oct 2026 (copy deck v3): all three AI role pages follow one template, built from the
section renderers in this file (build_closer_page.py imports them):
  1 hero with both buttons and a line under each, 2 trust strip (logos for this role),
  3 outcome cards, 4 pain line, 5 its day in numbered stages, 6 handing over to your staff,
  7 today vs with this AI, 8 try it now (Closer) or live after one call (role pages),
  9 FAQ, 10 the other three AIs, then the final band with both buttons.
Copy is word for word from COPY-DECK-v3.md, "AI ROLE PAGE TEMPLATE" and the role sections.

Every feature on these pages was checked in the Hermes code on origin/master
(17 Oct 2026). Anything not live for a client goes under "Coming next" with a
neutral "Coming soon" pill. Do not add a feature here without checking the code.

Run: python3 scripts/generators/build_role_pages.py  (twice: the second run changes nothing)
"""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
PARTIALS = HERE / "partials"
ORIGIN = "https://41labs.ai"

# CTA hrefs copied exactly from 41-closer.html and index.html.
WA_DEMO = "https://wa.me/6580124848?text=Hi%2C%20I%20want%20to%20see%20how%2041%20Closer%20would%20answer%20my%20customers."
# 18 Oct 2026: these pages exist to get a booked call. Every "Book a free call" goes to the qualify form
# on /ai-closer, tagged with the page slug. No prices on these pages: plans live on /pricing.
BOOK_CALL = "/ai-closer?utm_source=41labs.ai&amp;utm_medium=organic&amp;utm_campaign={slug}#qualify"
BOOK_LABEL = "Book a free call"
WA_LABEL = "WhatsApp our AI now"
# Microcopy, copy deck v3 word for word: one line under each button, in the hero and the final band.
BOOK_NOTE = "30 minutes with Alexander. We build your AI before the call. No contract."
WA_NOTE = "It replies in seconds, day or night."
PRICING = "/pricing"
COST_ANSWER = ('It is part of every 41 Sales Team plan, so there is no separate fee. Plans start small and grow with the number '
               'of conversations. See <a href="/pricing">pricing</a>, or we work out the right plan with you on the call.')
FINAL_LEDE = "We build it on your business before we meet. You test it. If you like it, it goes live that day."

# Live after one call: the homepage's three steps (copy deck v2, kept in v3).
LIVE_STEPS = [
    ("Send us your website.", "We build your AI sales team on your products and prices before we meet."),
    ("Test it on the call.", "You message it from your own phone, with your hardest questions."),
    ("It goes live that day.", "We connect your WhatsApp and it starts answering your customers. We keep tuning it with you."),
]

# Try it now: homepage section 7 of copy deck v3, word for word (Closer page only).
TRY_EYEBROW = "Try it now"
TRY_H2 = "Message our AI the way your customer would"
TRY_LEDE = "Our own sales line runs on the same AI you would be buying. Ask it anything."
TRY_STEPS = [
    ('Tap "WhatsApp our AI now".', "WhatsApp opens with a message ready. Press send."),
    ("Ask what you would ask a new supplier.", "How it works, how long setup takes, whether it handles your kind of customer."),
    ("Watch it reply in seconds.", "It asks you a question or two, like a good salesperson would. If you want, it books your call with Alexander."),
]
TRY_NOTE = "+65 8012 4848 \u00b7 We only use your number to reply to you."

# The four AIs, homepage section 6 of copy deck v3, word for word. Section 10 shows the other three.
TEAM_CARDS = [
    ("closer", "chat", "AI Sales Closer", "Answers every enquiry, quotes your prices, books and takes payment.", "/41-closer"),
    ("ops", "clipboard", "AI Operations Admin", "Sends the invoice, saves the details and checks in on the date the customer asked for.", "/ai-operations-admin"),
    ("manager", "chart", "AI Manager", "Shows every sale on one screen and alerts the right person when a customer needs a human.", "/ai-manager"),
    ("leads", "megaphone", "AI Leads Generator", "Will run your Facebook and Instagram ads and send the enquiries straight to your AI sales team.", None),
]
TEAM_LEDE = "They share your one WhatsApp number. Your staff can step into any chat, and the AI picks up again when they finish."

# Trust strip: logo files in /assets/41st/logos/, name tiles (first letter) where there is no logo file.
LOGOS = {
    "WhatsApp": "whatsapp.svg", "Facebook Messenger": "messenger.svg", "Stripe": "stripe.svg",
    "Google Calendar": "googlecalendar.svg", "Google Sheets": "googlesheets.svg",
    "Airwallex": None, "Plato": None, "WESS": None, "Attio": None, "Twenty": None,
}

# Lucide-style line icons, stroke 1.75.
ICONS = {
    "megaphone": '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 8a5 5 0 0 1 0 8"/><path d="M18 5a9 9 0 0 1 0 14"/>',
    "chat": '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    "clipboard": '<rect x="7" y="4" width="10" height="4" rx="1"/><path d="M17 6h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1"/><path d="M9 14l2 2 4-4"/>',
    "chart": '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
    "receipt": '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6"/><path d="M9 12h6"/>',
    "calendar": '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 10h18"/>',
    "repeat": '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    "bell": '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    "users": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
    "send": '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
    "file": '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M9 14h6"/><path d="M9 18h4"/>',
    "hand": '<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>',
    "trend": '<path d="M22 7l-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    "board": '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/>',
    "pulse": '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    "sparkle": '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    "check": '<path d="M5 12l5 5L20 7"/>',
    "lock": '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    "wa": '<path d="M3 21l1.6-4.8A8.5 8.5 0 1 1 7.8 19.4z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-1.9-1-1 .8c-1-.4-1.9-1.3-2.3-2.3l.8-1-1-1.9z"/>',
    "arrow": '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
}


def icon(name: str, size: int = 18) -> str:
    return (f'<svg viewBox="0 0 24 24" width="{size}" height="{size}" fill="none" stroke="currentColor" '
            f'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONS[name]}</svg>')


def esc(s: str) -> str:
    return html.escape(s, quote=True)


def plain(s: str) -> str:
    """FAQ answers may hold one <a>: the JSON-LD gets the same words without the tag."""
    return re.sub(r"<[^>]+>", "", s)


def answer(s: str) -> str:
    return s if "<a " in s else esc(s)


# ---------------------------------------------------------------- content

TEAM = [
    ("leads", "AI Leads Generator", "/", "megaphone"),
    ("closer", "AI Sales Closer", "/41-closer", "chat"),
    ("ops", "AI Operations Admin", "/ai-operations-admin", "clipboard"),
    ("manager", "AI Manager", "/ai-manager", "chart"),
]

# Stage = (name, owner's pain or None, [what it does]). Copy deck v3 word for word. The deck gives
# no pain line for the two role pages (verified features only), so those stages show none.
PAGES = {
    "ai-operations-admin": {
        "key": "ops",
        "name": "AI Operations Admin",
        "title": "AI Operations Admin: WhatsApp after-sales | 41 Sales Team by 41 Labs",
        "description": "AI Operations Admin by 41 Sales Team runs your WhatsApp after-sales: invoices, booking changes, reminders and check-ins on the dates customers ask for.",
        "keywords": "AI Operations Admin, WhatsApp after-sales, AI receptionist WhatsApp, WhatsApp reminders, booking changes WhatsApp, 41 Sales Team, 41 Closer",
        "eyebrow": "AI Operations Admin for WhatsApp",
        "h1": "AI Operations Admin.",
        "h1_soft": "The work after the sale gets done without you.",
        "sub": "After a customer pays, it sends the invoice, saves their details, handles booking changes when your booking system is connected, and checks in on the date they asked for.",
        "proof": None,
        # Answer capsule (AI engines quote it): JSON-LD description and the passage under the pain line.
        "capsule": "The AI Operations Admin is the part of 41 Sales Team (formerly 41 Closer) that handles the work after a customer pays on WhatsApp. It sends the invoice, saves the details they give, moves or cancels bookings when your booking system is connected, checks in on the date they ask for, and hands a chat to your staff when needed.",
        "logos": ["WhatsApp", "Stripe", "Airwallex", "Google Calendar", "Google Sheets", "Plato", "WESS"],
        "wins_h2": "What you get back.",
        # Outcome cards: deck v3 headlines (no numbers), supporting lines from verified-features.md.
        "wins": [
            ("receipt", None, "Invoice the moment they pay.", "When a customer pays in the chat, the invoice goes back to them on WhatsApp."),
            ("file", None, "Details saved, nothing retyped.", "Dates, addresses and names go on the customer's record as they chat."),
            ("bell", None, "Check-ins on the date they asked for.", "A customer asks to hear back in March, and it checks in then."),
        ],
        "pain": "The sale is made, and then the admin starts: invoices, details, changes, reminders.",
        "stages": [
            ("Paid.", None, ["Sends the invoice when the payment comes in.", "Records the sale.", "Tells your team."]),
            ("Details.", None, ["Saves what the customer tells it.", "Reads the photos and PDFs they send.", "Your team never retypes it."]),
            ("Changes.", None, ["Moves or cancels a booking when your booking system is connected.", "Confirms the change in the chat."]),
            ("Check-ins.", None, ["Messages the customer on the date they asked for.", "Uses approved templates after 24 hours."]),
            ("Past customers.", None, ["Sends your messages to past customers by tag or by date."]),
        ],
        "handover": ["Every new chat gets an owner on your team. Anyone can step in at any time, and the AI waits until they are done."],
        "compare": [
            ("Payment arrives", "Someone sends the invoice later", "Invoice sent straight away"),
            ("Customer sends details", "Copied by hand", "Saved from the chat"),
            ('"Can I change my date?"', "Back and forth with staff", "Done in the chat when your booking system is connected"),
            ('"Remind me next month"', "Easy to forget", "Messaged on that date"),
        ],
        "final_h2": "Hand over the admin after every sale",
        "service_type": "WhatsApp after-sales and operations admin",
        "next": [
            "Collecting documents from every customer, with a checklist you set",
            "A reminder before every booking, sent by itself",
        ],
        "faqs": [
            ("What does the AI Operations Admin do?", "It handles the work after a customer pays on WhatsApp. It sends the invoice, saves the details the customer gives, moves or cancels bookings when your booking system is connected, checks in on the date the customer asks for, and hands the chat to your staff when they are needed."),
            ("Does it send invoices?", "Yes. When a customer pays through the payment link in the chat, the invoice goes back to them on WhatsApp. It also sends one when a customer asks for an invoice for their records."),
            ("Can it change or cancel a booking?", "Yes, when your booking system is connected. It finds the customer's own booking by their WhatsApp number, moves it to a free time or cancels it, and tells them exactly what happened. You can send late changes to your team instead."),
            ("Is it an AI receptionist?", "On WhatsApp, it does a lot of the front desk work after a sale. It sends invoices, saves the details customers give, checks in when they asked, and moves bookings when your booking system is connected. It works on WhatsApp only and does not answer phone calls."),
            ("How do follow-ups work after 24 hours?", "WhatsApp only allows approved messages once a customer has been quiet for 24 hours. We set those messages up on your account for you, so every follow-up still goes out. Nothing goes out in your quiet hours, and it stops for anyone who says stop."),
            ("Can it message my past customers?", "Yes. Pick a tag, such as renewal due, and it messages every customer with that tag. Or pick a date field, such as an expiry date, and each customer gets a reminder when their date comes near. People who opted out are always skipped."),
            ("How much does it cost?", COST_ANSWER),
        ],
    },
    "ai-manager": {
        "key": "manager",
        "name": "AI Manager",
        "title": "AI Manager: AI sales manager on WhatsApp | 41 Sales Team by 41 Labs",
        "description": "AI Manager by 41 Sales Team: a sales dashboard with revenue closed, deals and who needs a reply, and WhatsApp alerts when a customer needs your team.",
        "keywords": "AI Manager, AI sales manager, sales dashboard, WhatsApp sales dashboard, WhatsApp alerts, 41 Sales Team, 41 Closer",
        "eyebrow": "AI sales manager for WhatsApp",
        "h1": "AI Manager.",
        "h1_soft": "Know what WhatsApp brings in, and who needs you.",
        "sub": "It puts every sale on one screen in Singapore dollars, spots bank transfers for your team to confirm, and tells the right person on WhatsApp when a customer needs a human.",
        "proof": None,
        "capsule": "The AI Manager is the part of 41 Sales Team (formerly 41 Closer) that watches your WhatsApp sales for you. Its sales dashboard shows revenue closed, deals closed, your return and who still needs a reply. When a customer needs a person, it alerts the right staff member on WhatsApp, and it tells the admins if nobody answers.",
        "logos": ["WhatsApp", "Stripe", "Airwallex", "Google Sheets", "Attio", "Twenty"],
        "wins_h2": "What you get back.",
        "wins": [
            ("trend", None, "Every sale on one screen.", "In Singapore dollars, with bank transfers it spots for you to confirm."),
            ("bell", None, "The right person alerted.", "On WhatsApp, when a customer needs a human. They swipe-reply and the answer goes to the customer."),
            ("users", None, "Nobody left waiting.", "Admins hear when a chat has no reply in the time you set."),
        ],
        "pain": "You should not have to read every chat to know how your sales are doing.",
        "stages": [
            ("Sales.", None, ["Revenue, deals closed and your return on one screen.", "Your pipeline by stage."]),
            ("Payments you might miss.", None, ["Spots bank transfer and cash sales in the chat.", "Asks your team to confirm them."]),
            ("Customers who need you.", None, ["Alerts the right person on WhatsApp.", "Tells admins when a chat has no reply.", "Reminds again after an hour."]),
            ("Questions.", None, ['Ask it on WhatsApp, for example "How many leads came in this week?"', "Or ask the co-pilot on your dashboard."]),
            ("Your team.", None, ["See how each team member's chats are going."]),
        ],
        "handover": ["When a customer needs a person, the alert says who it is, what they want and links to the chat."],
        "compare": [
            ("How did this week go", "Scroll through chats", "One screen, in Singapore dollars"),
            ("A bank transfer", "Checked later, sometimes missed", "Flagged for your team to confirm"),
            ("A customer waiting for a person", "Nobody notices", "The right person is alerted on WhatsApp"),
            ("Nobody replied", "Found out too late", "Admins are told"),
        ],
        "final_h2": "See your sales without reading every chat",
        "service_type": "AI sales manager and sales dashboard for WhatsApp",
        "next": [
            "A weekly report to you on WhatsApp, every Monday",
            "A quality score for every conversation",
        ],
        "faqs": [
            ("What is the AI Manager?", "It is the part of 41 Sales Team that watches your WhatsApp sales for you. It shows revenue closed, deals and who needs a reply on a sales dashboard, and it alerts the right person on your team on WhatsApp when a customer needs one."),
            ("What does the sales dashboard show?", "Revenue closed, deals closed, your return, and how many leads became sales. Under that, the number of active leads, new leads today, chats that need a reply, and a pipeline board with every customer by stage."),
            ("How does it tell my staff when a customer needs them?", "It sends a WhatsApp alert to the person who owns the chat, with the customer's question and a link to the chat. They swipe-reply the alert, and their answer goes to the customer. If the chat has no owner, every admin gets the alert."),
            ("What happens if nobody answers?", "If the owner has not replied within the wait you set, every admin gets a no reply yet message. If a question still waits on your team after an hour, your admins get a reminder on WhatsApp."),
            ("Can I ask it questions on WhatsApp?", "Yes. Send a plain message to the alert number, such as who is waiting on a reply, or how many leads came in today. It answers from your live data. In the dashboard, the Co-pilot answers the same kind of question in more detail."),
            ("Can my staff see only their own chats?", "Yes. Staff open the inbox on Mine, which shows only the chats they own. Owners and admins see everything, and the dashboard shows how many chats each person owns, how many became sales and how fast they reply."),
            ("How much does it cost?", COST_ANSWER),
        ],
    },
}

# ---------------------------------------------------------------- template (shared with build_closer_page.py)

ROLE_CSS = """
        /* AI role page template layer on top of site.css (/41-closer, /ai-operations-admin, /ai-manager). Tokens only. */
        .hero-grid{display:grid;gap:48px;grid-template-columns:1fr;align-items:center}
        @media(min-width:960px){.hero-grid{grid-template-columns:1.05fr .95fr;gap:56px}}
        .hero-grid>*{min-width:0}
        .hero h1{font-size:clamp(34px,4.6vw,52px)}
        .hero h1 .h1-soft{display:block}
        .hero .hero-sub{margin:20px 0 0;max-width:600px}
        .hero .breadcrumb{margin-bottom:16px}
        .proof{display:flex;align-items:flex-start;gap:8px;margin:18px 0 0;font-size:15px;font-weight:500;color:var(--fg)}
        .proof svg{color:var(--primary-text);flex:none;margin-top:3px}
        .cta-pair{display:flex;flex-wrap:wrap;gap:16px 24px;margin-top:28px}
        .cta-col{display:flex;flex-direction:column;align-items:flex-start;gap:8px;min-width:0;flex:0 1 250px}
        .cta-col .note{margin:0;line-height:1.45}
        .cta-pair.center{justify-content:center}
        .cta-pair.center .cta-col{align-items:center;text-align:center}
        @media(max-width:640px){.cta-pair{flex-direction:column;gap:18px}.cta-col{flex:none;max-width:none;width:100%;align-items:stretch;text-align:center}.cta-col .btn{width:100%;justify-content:center}}
        .phone{max-width:380px;margin:0 auto;background:var(--surface);border:1px solid var(--border);border-radius:28px;box-shadow:var(--shadow-overlay);overflow:hidden}
        .phone-top{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border)}
        .phone-av{width:36px;height:36px;border-radius:var(--r-pill);background:var(--primary-soft);color:var(--primary-text);display:grid;place-items:center;flex:none}
        .phone-top b{display:block;font-size:15px;font-weight:600;line-height:1.2}
        .phone-top small{display:block;font-size:12.5px;color:var(--primary-text)}
        .phone .chat{border-radius:0;min-height:360px;padding:16px 14px}
        .paylink{display:flex;align-items:center;gap:8px;margin-top:6px;padding:8px 10px;border-radius:12px;background:rgba(255,255,255,.72);font-weight:500;font-size:14px;color:var(--fg)}
        .paylink svg{color:var(--primary-text);flex:none}
        .chat-event{align-self:center;margin-top:4px;white-space:normal;text-align:center}
        .chat-line{align-self:center;font-size:12px;color:var(--subtle);background:var(--surface);padding:3px 10px;border-radius:var(--r-pill);box-shadow:var(--shadow-raised);text-align:center}
        .hero-caption{text-align:center;font-size:13px;color:var(--subtle);margin:12px 0 0}
        @media(prefers-reduced-motion:no-preference){
            .arrive{opacity:0;transform:translateY(8px);animation:arrive .32s var(--ease) forwards}
            @keyframes arrive{to{opacity:1;transform:none}}
        }
        .dash{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-card);box-shadow:var(--shadow-overlay);padding:18px;max-width:460px;margin:0 auto}
        .dash-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
        .dash-top b{font-size:16px;font-weight:600}
        .dash-tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .dash-tile{border:1px solid var(--border);border-radius:var(--r-panel);padding:12px 14px;background:var(--bg)}
        .dash-tile span{display:block;font-size:12.5px;color:var(--muted)}
        .dash-tile b{display:block;font-size:24px;line-height:1.2;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums;margin-top:2px}
        .dash-tile small{display:block;font-size:12px;color:var(--primary-text);margin-top:2px}
        .dash-h{font-size:13px;font-weight:600;margin:16px 0 8px}
        .dash-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid var(--border);font-size:14px}
        .dash-row .who{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .dash-row .who small{display:block;font-size:12.5px;color:var(--subtle);overflow:hidden;text-overflow:ellipsis}
        .bubble.bot{background:var(--bubble-customer);align-self:flex-start;border-top-left-radius:6px}
        .bubble .who-bot{display:inline-block;font-size:10.5px;font-weight:600;padding:1px 7px;border-radius:var(--r-pill);background:var(--neutral-soft);color:var(--muted);margin-bottom:3px}
        .bubble .who-team{display:inline-block;font-size:10.5px;font-weight:600;padding:1px 7px;border-radius:var(--r-pill);background:rgba(29,78,216,.12);color:var(--info);margin-bottom:3px}
        .team-strip{margin-top:56px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-card);padding:16px;box-shadow:var(--shadow-panel)}
        .ts-label{font-size:14px;color:var(--subtle);margin:0 0 10px 4px}
        .team-strip ul{list-style:none;margin:0;padding:0;display:grid;gap:8px;grid-template-columns:1fr 1fr}
        @media(min-width:900px){.team-strip ul{grid-template-columns:repeat(4,1fr)}}
        .ts-item{display:flex;align-items:center;gap:10px;min-height:52px;height:100%;padding:10px 12px;border-radius:var(--r-panel);border:1px solid var(--border);text-decoration:none;color:var(--fg);font-weight:500;font-size:15px;line-height:1.3;transition:background .12s var(--ease)}
        a.ts-item:hover{background:var(--neutral-soft);color:var(--fg)}
        .ts-item.here{background:var(--primary-soft);border-color:transparent}
        .ts-icon{width:32px;height:32px;border-radius:var(--r-pill);background:var(--neutral-soft);color:var(--muted);display:grid;place-items:center;flex:none}
        .ts-item.here .ts-icon{background:var(--surface);color:var(--primary-text)}
        .ts-text{display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-width:0}
        .ts-text .pill{font-size:11.5px;padding:2px 8px}
        @media(max-width:520px){.ts-item{font-size:14px;padding:10px}.ts-icon{display:none}}
        .center-block{margin-inline:auto}
        /* 2 trust strip: a compact one-row version of the integrations block */
        .trust{padding:28px 0;border-bottom:1px solid var(--border)}
        .trust-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px 20px}
        .trust-label{margin:0;font-size:14px;font-weight:500;color:var(--subtle)}
        .int-grid.trust-grid{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}
        .trust-grid .int-tile{padding:8px 12px;gap:8px;box-shadow:none}
        .trust-grid .int-ic{width:22px;height:22px}
        .trust-grid .int-word{font-size:12px;border-radius:6px}
        .trust-grid .int-name{font-size:14px;white-space:nowrap}
        .trust-more{font-size:14px;font-weight:500;text-decoration:none;display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
        /* 3 outcome cards */
        .wins>.card{display:flex;flex-direction:column}
        .win h3{font-size:19px}
        .win p{margin:8px 0 0;color:var(--muted)}
        .out-num{display:block;font-size:clamp(34px,4vw,46px);line-height:1.05;font-weight:700;letter-spacing:-.03em;font-variant-numeric:tabular-nums;color:var(--fg)}
        .win .out-num+p{margin-top:10px;color:var(--fg);font-size:16.5px}
        .win .pill{align-self:flex-start;margin-top:auto;padding-top:4px}
        .win .pill-wrap{margin-top:auto;padding-top:14px}
        /* 4 pain line */
        .pain{font-size:clamp(26px,3.4vw,38px);line-height:1.2;max-width:880px;margin:0 auto;text-align:center}
        .pain-more{margin-top:32px}
        .pain-more .capsule p{margin:0}
        .pain-more .capsule strong{font-weight:500}
        .capsule-more{margin-top:16px;color:var(--muted)}
        /* 5 its day */
        .day{list-style:none;margin:0 auto;padding:0;display:grid;gap:14px;max-width:960px}
        .stage{display:grid;gap:14px 32px;grid-template-columns:1fr;padding:22px 24px}
        @media(min-width:760px){.stage{grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);align-items:center}.day.compact .stage{grid-template-columns:240px minmax(0,1fr)}}
        .stage-head{display:flex;gap:14px;align-items:flex-start}
        .stage-num{width:36px;height:36px;border-radius:var(--r-pill);background:var(--primary-soft);color:var(--primary-text);display:grid;place-items:center;font-weight:600;font-size:15px;flex:none}
        .stage-head h3{margin:5px 0 0}
        .stage-pain{margin:6px 0 0;color:var(--muted);font-size:16px}
        .stage .checks li{color:var(--fg)}
        @media(max-width:759px){.stage .checks{padding-left:50px}}
        .day.compact .stage-head{align-items:center}
        .day.compact .stage-head h3{margin:0}
        .after-cta{display:flex;justify-content:center;margin-top:32px}
        /* 6 handing over */
        .handover{max-width:860px;margin:0 auto;display:flex;gap:20px;align-items:flex-start;padding:28px}
        .handover .icon-chip{margin:0;flex:none}
        .handover h2{font-size:clamp(24px,3vw,32px)}
        .handover p{margin:12px 0 0;color:var(--muted)}
        @media(max-width:640px){.handover{flex-direction:column;padding:22px}}
        /* 7 today vs */
        .cmp{max-width:900px;margin:0 auto}
        .cmp table{min-width:0;table-layout:fixed}
        .cmp thead th:last-child{color:var(--primary-text)}
        .cmp tbody th{font-size:15px;font-weight:500;color:var(--fg);background:transparent}
        .cmp td{color:var(--muted)}
        .cmp td.with{color:var(--fg);background:rgba(74,222,128,.08)}
        @media(max-width:640px){.cmp table{font-size:14px}.cmp th,.cmp td{padding:10px}.cmp tbody th{font-size:14px}}
        /* 8 steps */
        .step-card .step-num{width:36px;height:36px;border-radius:var(--r-pill);background:var(--primary-soft);color:var(--primary-text);display:grid;place-items:center;font-weight:600;font-size:15px;margin-bottom:16px}
        .step-card h3{font-size:18px}
        .step-card p{margin:8px 0 0;color:var(--muted)}
        ol.grid-3{list-style:none;margin:0;padding:0}
        .try-note{text-align:center;margin:12px 0 0}
        .next-card{max-width:720px;margin:0 auto}
        .next-list{list-style:none;margin:0;padding:0;display:grid;gap:12px}
        .next-list li{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--border);color:var(--fg)}
        .next-list li:last-child{border-bottom:0}
        /* 10 the other three AIs */
        .sib{display:flex;flex-direction:column}
        .sib-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:16px}
        .sib-top .icon-chip{margin:0}
        .sib p{margin:8px 0 0;color:var(--muted)}
        .sib a{margin-top:auto;padding-top:14px;font-weight:500;font-size:15px;text-decoration:none;display:inline-flex;align-items:center;gap:6px}
        .price-line{max-width:720px;margin:24px auto 0;text-align:center;color:var(--muted)}
        .price-line b{color:var(--fg)}
        .final-grid{text-align:center}
        @media(max-width:640px){.cta-band{padding:32px 20px}}
"""


def book_btn(href: str, extra: str = "") -> str:
    return f'<a class="btn btn-primary btn-lg{extra}" href="{href}">{BOOK_LABEL}</a>'


def wa_btn(href: str, size: int = 18) -> str:
    return f'<a class="btn btn-secondary btn-lg" href="{href}" target="_blank" rel="noopener">{icon("wa", size)} {WA_LABEL}</a>'


def cta_pair(book: str, wa: str, center: bool = False) -> str:
    """The two buttons, each with the line under it that says what happens."""
    return (f'<div class="cta-pair{" center" if center else ""}">'
            f'<div class="cta-col">{book_btn(book)}<p class="note">{BOOK_NOTE}</p></div>'
            f'<div class="cta-col">{wa_btn(wa)}<p class="note">{WA_NOTE}</p></div></div>')


def proof_line(text: str | None) -> str:
    return f'<p class="proof">{icon("check", 16)} {esc(text)}</p>' if text else ""


def trust_strip(names: list[str]) -> str:
    """2. Compact one-row integrations strip: same .int-tile markup as partials/integrations.html."""
    tiles = []
    for n in names:
        f = LOGOS[n]
        ic = (f'<img class="int-ic" src="/assets/41st/logos/{f}" alt="" width="28" height="28" loading="lazy">' if f
              else f'<span class="int-ic int-word" aria-hidden="true">{n[0]}</span>')
        tiles.append(f'<li class="int-tile">{ic}<span class="int-name">{esc(n)}</span></li>')
    return f'''<section id="works-with" class="trust section-white" aria-label="Works with what you already use">
        <div class="wrap trust-row">
            <p class="trust-label">Works with what you already use</p>
            <ul class="int-grid trust-grid">{"".join(tiles)}</ul>
            <a class="trust-more" href="/#integrations">See all integrations {icon("arrow", 14)}</a>
        </div>
    </section>'''


def outcome_cards(wins: list, h2: str) -> str:
    """3. Three outcome cards: (icon, number or None, headline, line[, pill])."""
    cards = []
    for w in wins:
        ic, num, h, line = w[:4]
        pill = f'<span class="pill-wrap"><span class="pill">{esc(w[4])}</span></span>' if len(w) > 4 else ""
        if num:
            cards.append(f'<div class="card win"><span class="out-num">{esc(num)}</span><p>{esc(line)}</p>{pill}</div>')
        else:
            cards.append(f'<div class="card win"><span class="icon-chip">{icon(ic, 20)}</span><h3>{esc(h)}</h3><p>{esc(line)}</p>{pill}</div>')
    return f'''<section id="wins" class="section">
        <div class="wrap">
            <div class="section-head center">
                <span class="eyebrow">What changes for you</span>
                <h2>{esc(h2)}</h2>
            </div>
            <div class="grid-3 wins">{"".join(cards)}</div>
        </div>
    </section>'''


def pain_block(line: str, more_html: str) -> str:
    """4. The owner's pain in one large sentence, then the answer capsule under it."""
    return f'''<section id="the-gap" class="section section-white">
        <div class="wrap">
            <h2 class="pain">{esc(line)}</h2>
            <div class="read center-block pain-more">{more_html}</div>
        </div>
    </section>'''


def day_section(name: str, stages: list, book: str) -> str:
    """5. Its day: numbered stages, each with a name, the owner's pain (when the deck has one) and what it does."""
    items = []
    for i, (st, pain, lines) in enumerate(stages, 1):
        p = f'<p class="stage-pain">{esc(pain)}</p>' if pain else ""
        lis = "".join(f"<li>{esc(x)}</li>" for x in lines)
        items.append(f'<li class="card stage"><div class="stage-head"><span class="stage-num" aria-hidden="true">{i}</span>'
                     f'<div><h3>{esc(st)}</h3>{p}</div></div><ul class="checks">{lis}</ul></li>')
    return f'''<section id="its-day" class="section">
        <div class="wrap">
            <div class="section-head center">
                <span class="eyebrow">Its day</span>
                <h2>What the {name} does, step by step.</h2>
            </div>
            <ol class="day{"" if any(st[1] for st in stages) else " compact"}">{"".join(items)}</ol>
            <div class="after-cta">{book_btn(book)}</div>
        </div>
    </section>'''


def handover_section(paras: list[str]) -> str:
    """6. Handing over to your staff."""
    ps = "".join(f"<p>{esc(x)}</p>" for x in paras)
    return f'''<section id="handover" class="section section-white">
        <div class="wrap">
            <div class="card handover"><span class="icon-chip">{icon("hand", 20)}</span>
                <div><span class="eyebrow">When a person is needed</span><h2>Handing over to your staff</h2>{ps}</div>
            </div>
        </div>
    </section>'''


def compare_section(name: str, rows: list, after: str = "") -> str:
    """7. Today vs with this AI."""
    body = "".join(f'<tr><th scope="row">{esc(a)}</th><td>{esc(b)}</td><td class="with">{esc(c)}</td></tr>' for a, b, c in rows)
    return f'''<section id="compare" class="section">
        <div class="wrap">
            <div class="section-head center">
                <span class="eyebrow">Side by side</span>
                <h2>Today, and with the {name}.</h2>
            </div>
            <div class="table-wrap cmp"><table>
                <thead><tr><th scope="col">What happens</th><th scope="col">Today</th><th scope="col">With the {name}</th></tr></thead>
                <tbody>{body}</tbody>
            </table></div>{after}
        </div>
    </section>'''


def steps_cards(steps: list) -> str:
    return "".join(f'<li class="card step-card"><span class="step-num" aria-hidden="true">{i}</span><h3>{esc(h)}</h3><p>{esc(t)}</p></li>'
                   for i, (h, t) in enumerate(steps, 1))


def try_section(wa: str, sid: str = "try-it") -> str:
    """8a. Try it now (Closer page only): the homepage's three steps."""
    return f'''<section id="{sid}" class="section section-white">
        <div class="wrap">
            <div class="section-head center">
                <span class="eyebrow">{TRY_EYEBROW}</span>
                <h2>{TRY_H2}</h2>
                <p class="lede">{TRY_LEDE}</p>
            </div>
            <ol class="grid-3">{steps_cards(TRY_STEPS)}</ol>
            <div class="after-cta">{wa_btn(wa)}</div>
            <p class="note try-note">{TRY_NOTE}</p>
        </div>
    </section>'''


def live_section(book: str) -> str:
    """8b. Live after one call (role pages)."""
    return f'''<section id="how-it-starts" class="section section-white">
        <div class="wrap">
            <div class="section-head center">
                <span class="eyebrow">How it starts</span>
                <h2>Live after one call.</h2>
            </div>
            <ol class="grid-3">{steps_cards(LIVE_STEPS)}</ol>
            <div class="after-cta">{book_btn(book)}</div>
        </div>
    </section>'''


def faq_section(h2: str, faqs: list, white: bool = False) -> str:
    """9. FAQ, from the same list as the FAQPage JSON-LD."""
    items = "".join(f'<details{" open" if i == 0 else ""}><summary>{esc(q)}</summary><p>{answer(a)}</p></details>'
                    for i, (q, a) in enumerate(faqs))
    return f'''<section id="faq" class="section{" section-white" if white else ""}">
        <div class="wrap">
            <div class="section-head center">
                <span class="eyebrow">Questions</span>
                <h2>{esc(h2)}</h2>
            </div>
            <div class="faq read center-block">{items}</div>
        </div>
    </section>'''


def siblings_section(key: str, after: str = "", white: bool = True) -> str:
    """10. The other three AIs as cards."""
    cards = []
    for k, ic, name, line, href in TEAM_CARDS:
        if k == key:
            continue
        pill = '<span class="pill">Coming soon</span>' if href is None else '<span class="pill pill-good">Live</span>'
        link = f'<a href="{href}">See what it does {icon("arrow", 14)}</a>' if href else ""
        cards.append(f'<div class="card sib"><div class="sib-top"><span class="icon-chip">{icon(ic, 20)}</span>{pill}</div>'
                     f'<h3>{name}</h3><p>{esc(line)}</p>{link}</div>')
    return f'''<section id="the-team" class="section{" section-white" if white else ""}">
        <div class="wrap">
            <div class="section-head center">
                <span class="eyebrow">Your AI sales team</span>
                <h2>The rest of your AI sales team.</h2>
                <p class="lede">{TEAM_LEDE}</p>
            </div>
            <div class="grid-3">{"".join(cards)}</div>{after}
        </div>
    </section>'''


PIXEL = """    <!-- Meta Pixel -->
    <script>
        window.FB_PIXEL_ID = '24659272643698089';
        (function(){
            if(!window.FB_PIXEL_ID || window.FB_PIXEL_ID === 'REPLACE_WITH_PIXEL_ID') return;
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', window.FB_PIXEL_ID);
            fbq('track', 'PageView');
        })();
    </script>"""

ANALYTICS = """    <script>/* deferred analytics for Core Web Vitals: load on first interaction or after 4s. Same loader as /41-closer. */
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
                a.addEventListener('click', function(){ if(window.fbq){ fbq('track','Contact',{content_name:'%s_whatsapp'}); } });
            });
        })();
    </script>"""


def jsonld(obj: dict) -> str:
    return '    <script type="application/ld+json">' + json.dumps(obj, indent=1, ensure_ascii=False) + "</script>"


def schemas(slug: str, p: dict) -> str:
    url = f"{ORIGIN}/{slug}"
    service = {
        "@context": "https://schema.org",
        "@type": "Service",
        "name": f"{p['name']} by 41 Sales Team",
        "alternateName": p["name"],
        "serviceType": p["service_type"],
        "description": p["capsule"],
        "url": url,
        "areaServed": {"@type": "Country", "name": "Singapore"},
        "provider": {"@type": "Organization", "name": "41 Labs", "url": ORIGIN},
        "brand": {"@type": "Brand", "name": "41 Sales Team", "alternateName": ["41 Closer"]},
    }
    faq = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": plain(a)}} for q, a in p["faqs"]],
    }
    crumbs = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "41 Sales Team", "item": f"{ORIGIN}/"},
            {"@type": "ListItem", "position": 2, "name": p["name"], "item": url},
        ],
    }
    return "\n".join([jsonld(service), jsonld(faq), jsonld(crumbs)])


def team_strip(key: str) -> str:
    items = []
    for k, name, href, ic in TEAM:
        if k == key:
            items.append(f'<li><span class="ts-item here" aria-current="page"><span class="ts-icon">{icon(ic)}</span>'
                         f'<span class="ts-text"><span class="ts-name">{name}</span><span class="pill pill-good">This page</span></span></span></li>')
        else:
            pill = '<span class="pill">Coming soon</span>' if k == "leads" else ""
            items.append(f'<li><a class="ts-item" href="{href}"><span class="ts-icon">{icon(ic)}</span>'
                         f'<span class="ts-text"><span class="ts-name">{name}</span>{pill}</span></a></li>')
    return ('<div class="team-strip" aria-label="The four AIs in 41 Sales Team">\n'
            '                <p class="ts-label">Part of 41 Sales Team</p>\n'
            f'                <ul>{"".join(items)}</ul>\n            </div>')


def bubble(kind: str, text: str, delay: float | None = None) -> str:
    """kind: in (customer), ai (AI Sales Team), team (staff member), bot (our alert to staff)."""
    attach = ""
    if "|" in text:
        text, ic, label = text.split("|")
        attach = f'<span class="paylink">{icon(ic, 16)} {esc(label)}</span>'
    anim = f' arrive" style="animation-delay:{delay}s' if delay is not None else ""
    if kind == "in":
        return f'<div class="bubble in{anim}">{esc(text)}{attach}</div>'
    if kind == "ai":
        return f'<div class="bubble ai{anim}"><span class="who">AI</span><br>{esc(text)}{attach}</div>'
    if kind == "team":
        return f'<div class="bubble team{anim}"><span class="who-team">You</span><br>{esc(text)}{attach}</div>'
    return f'<div class="bubble bot{anim}"><span class="who-bot">41 Sales Team</span><br>{esc(text)}{attach}</div>'


def hero_visual(key: str) -> str:
    if key == "ops":
        label = ("Example WhatsApp chat: a customer pays $180 and gets the invoice, then asks to move a Saturday "
                 "appointment to Sunday, and the AI moves it and sets a check-in for March.")
        chat = "".join([
            f'<span class="pill pill-good chat-event arrive" style="animation-delay:.2s">{icon("check", 12)} Paid $180</span>',
            bubble("ai", "Thank you, payment received. Here is your invoice.|file|Invoice INV-0142, $180", 0.8),
            bubble("in", "Can I move Saturday to Sunday?", 1.7),
            bubble("ai", "Sunday 25 Oct at 11am is free. Done, you are booked for Sun 11am.", 2.6),
            bubble("in", "Thanks. Remind me about the next one in March?", 3.5),
            bubble("ai", "Sure. I will check in with you on Mon 1 Mar.", 4.3),
            '<span class="chat-line arrive" style="animation-delay:5s">Check-in set for Mon 1 Mar, 9:00am</span>',
        ])
        return (f'<div class="phone" role="img" aria-label="{esc(label)}">\n'
                f'                        <div class="phone-top"><span class="phone-av">{icon("sparkle")}</span>'
                '<span><b>Your WhatsApp</b><small>AI Operations Admin, online</small></span></div>\n'
                f'                        <div class="chat">{chat}</div>\n                    </div>\n'
                '                    <p class="hero-caption">Example chat</p>')
    label = ("Example sales dashboard: this month $18,400 revenue closed, 23 deals closed, a return of 9 times, "
             "and 3 chats that need a reply.")
    rows = [
        ("Grace T.", "Asked for a group price", "Waiting 12m", "pill-warn"),
        ("Ahmad R.", "Wants to change the delivery date", "Waiting 5m", "pill-warn"),
        ("Lim K.", "Paid by bank transfer, please confirm", "Needs confirm", "pill-warn"),
    ]
    row_html = "".join(
        f'<div class="dash-row"><span class="who">{esc(n)}<small>{esc(s)}</small></span><span class="pill {c}">{esc(t)}</span></div>'
        for n, s, t, c in rows)
    tiles = [("Revenue closed", "$18,400", "+$3,200 vs last month"), ("Deals closed", "23", "+4 vs last month"),
             ("Your return", "9x", "this month"), ("Lead to sale", "21%", "first reply in 19s")]
    tile_html = "".join(f'<div class="dash-tile"><span>{a}</span><b>{b}</b><small>{c}</small></div>' for a, b, c in tiles)
    return (f'<div class="dash" role="img" aria-label="{esc(label)}">\n'
            f'                        <div class="dash-top"><b>This month</b><span class="pill pill-good">{icon("check", 12)} Live</span></div>\n'
            f'                        <div class="dash-tiles">{tile_html}</div>\n'
            '                        <p class="dash-h">Needs a reply</p>\n'
            f'                        {row_html}\n                    </div>\n'
            '                    <p class="hero-caption">Example dashboard, the numbers are examples</p>')


def build(slug: str, p: dict) -> str:
    header = (PARTIALS / "header.html").read_text().rstrip("\n")
    footer = (PARTIALS / "footer.html").read_text().rstrip("\n")
    key = p["key"]
    url = f"{ORIGIN}/{slug}"
    book = BOOK_CALL.format(slug=slug)
    nxt = "".join(f'<li><span>{esc(n)}</span><span class="pill">Coming soon</span></li>' for n in p["next"])
    capsule = f'<div class="capsule"><p><strong>{esc(p["capsule"])}</strong></p></div>'
    price_line = (f'<p class="price-line"><a href="{PRICING}"><b>Part of every 41 Sales Team plan.</b></a> '
                  'Read how an <a href="/ai-sales-agent-singapore">AI sales agent works in Singapore</a>.</p>')

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{esc(p['title'])}</title>
    <meta name="description" content="{esc(p['description'])}">
    <meta name="keywords" content="{esc(p['keywords'])}">
    <meta name="author" content="41 Labs">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
    <link rel="canonical" href="{url}">

{PIXEL}

    <!-- Geo Tags -->
    <meta name="geo.region" content="SG">
    <meta name="geo.placename" content="Singapore">

    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="{url}">
    <meta property="og:title" content="{esc(p['title'])}">
    <meta property="og:description" content="{esc(p['description'])}">
    <meta property="og:image" content="https://41labs.ai/og-image.jpg?v=2">
    <meta property="og:site_name" content="41 Labs">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{esc(p['title'])}">
    <meta name="twitter:description" content="{esc(p['description'])}">
    <meta name="twitter:image" content="https://41labs.ai/og-image.jpg?v=2">

    <!-- Favicons -->
    <link rel="icon" type="image/png" sizes="32x32" href="logo-icon.png">
    <link rel="icon" type="image/png" sizes="16x16" href="logo-icon.png">
    <link rel="apple-touch-icon" href="logo-icon.png">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
    <link rel="stylesheet" href="/assets/41st/site.css">

    <!-- Generated by scripts/generators/build_role_pages.py. Edit the generator, not this file. -->
{schemas(slug, p)}

    <style>{ROLE_CSS}    </style>
{ANALYTICS}
</head>
<body>
{header}
<main id="main">

    <header id="hero" class="hero wash">
        <div class="wrap">
            <div class="hero-grid">
                <div>
                    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">41 Sales Team</a> / <span aria-current="page">{p['name']}</span></nav>
                    <span class="eyebrow">{esc(p['eyebrow'])}</span>
                    <h1>{esc(p['h1'])} <span class="h1-soft">{esc(p['h1_soft'])}</span></h1>
                    <p class="lede hero-sub">{esc(p['sub'])}</p>
                    {proof_line(p['proof'])}
                    {cta_pair(book, WA_DEMO)}
                </div>
                <div>
                    {hero_visual(key)}
                </div>
            </div>
            {team_strip(key)}
        </div>
    </header>

    {trust_strip(p['logos'])}

    {outcome_cards(p['wins'], p['wins_h2'])}

    {pain_block(p['pain'], capsule)}

    {day_section(p['name'], p['stages'], book)}

    {handover_section(p['handover'])}

    {compare_section(p['name'], p['compare'])}

    {live_section(book)}

    <section id="coming-next" class="section">
        <div class="wrap">
            <div class="section-head center">
                <span class="eyebrow">Coming next</span>
                <h2>What we are building next.</h2>
                <p class="lede">These are not live yet. We will add them to this page when they are.</p>
            </div>
            <div class="card next-card"><ul class="next-list">{nxt}</ul></div>
        </div>
    </section>

    {faq_section(f"What owners ask about the {p['name']}.", p['faqs'], white=True)}

    {siblings_section(key, price_line, white=False)}

    <section id="start-now" class="section section-white">
        <div class="wrap">
            <div class="cta-band wash">
                <div class="final-grid">
                    <span class="eyebrow">Start now</span>
                    <h2>{esc(p['final_h2'])}</h2>
                    <p class="lede">{FINAL_LEDE}</p>
                    {cta_pair(book, WA_DEMO, center=True)}
                </div>
            </div>
        </div>
    </section>

</main>
{footer}

{CONTACT_TRACK % slug.replace('-', '_')}
</body>
</html>
"""


def visible(page: str) -> str:
    t = re.sub(r"<script.*?</script>|<style.*?</style>|<nav.*?</nav>|<footer.*?</footer>", "", page, flags=re.S)
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", t)))


# 18 Oct 2026: copy deck v3 asks for 900 to 1,300 visible words per role page (the old pages read too short).
MAX_WORDS = 1300
MIN_BOOK_CTAS = 3


def gate(slug: str, text: str) -> list[str]:
    seen = visible(text)
    problems = [f"{w!r} in the visible text (no prices, plain punctuation)"
                for w in ("S$", "$299", "$690", "a month", "From $", "—", ";", "!", "‘", "’", "“", "”") if w in seen]
    words = len(seen.split())
    if words > MAX_WORDS:
        problems.append(f"{words} visible words, ceiling {MAX_WORDS}")
    book = BOOK_CALL.format(slug=slug)
    n_book = len(re.findall(rf'<a class="btn btn-primary[^"]*" href="{re.escape(book)}">{BOOK_LABEL}</a>', text))
    if n_book < MIN_BOOK_CTAS:
        problems.append(f"{n_book} '{BOOK_LABEL}' buttons to {book}, need {MIN_BOOK_CTAS}")
    if text.count(f'target="_blank" rel="noopener">{icon("wa", 18)} {WA_LABEL}</a>') < 2:
        problems.append(f"'{WA_LABEL}' must be in the hero and the final band")
    faq_ld = json.loads(re.search(r'<script type="application/ld\+json">(\{[^<]*?"FAQPage".*?)</script>', text, re.S).group(1))
    for q in faq_ld["mainEntity"]:
        if f"<summary>{esc(q['name'])}</summary>" not in text:
            problems.append(f"FAQ schema question not visible: {q['name']}")
    return problems


def main() -> None:
    for slug, p in PAGES.items():
        out = ROOT / f"{slug}.html"
        text = build(slug, p)
        problems = gate(slug, text)
        if problems:
            raise SystemExit(f"REFUSED {slug}: " + "; ".join(problems))
        print(f"{slug}: {len(visible(text).split())} visible words")
        old = out.read_text() if out.exists() else None
        if old != text:
            out.write_text(text)
            print(f"wrote {out.relative_to(ROOT)}")
        else:
            print(f"unchanged {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
