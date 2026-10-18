#!/usr/bin/env python3
"""Build /ai-manager and /ai-operations-admin, two of the four AIs in 41 Sales Team.

Siblings of /41-closer (the AI Sales Closer). Same site.css components, the shared
header and footer partials read at build time, and one content dict per page so the
visible FAQ and the FAQPage JSON-LD are written from the same strings and cannot drift.

Every feature on these pages was checked in the Hermes code on origin/master
(17 Oct 2026). Anything not live for a client goes under "Coming next" with a
neutral "Coming soon" pill. Do not add a feature here without checking the code.

Run: python3 scripts/generators/build_role_pages.py  (twice: the second run changes nothing)
"""
from __future__ import annotations

import html
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
PARTIALS = HERE / "partials"
ORIGIN = "https://41labs.ai"

# CTA hrefs copied exactly from 41-closer.html and index.html.
WA_DEMO = "https://wa.me/6580124848?text=Hi%2C%20I%20want%20to%20see%20how%2041%20Closer%20would%20answer%20my%20customers."
BUILD_CALL = "/#book-call"
PRICING = "/#pricing"

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


# ---------------------------------------------------------------- content

TEAM = [
    ("leads", "AI Leads Generator", "/", "megaphone"),
    ("closer", "AI Sales Closer", "/41-closer", "chat"),
    ("ops", "AI Operations Admin", "/ai-operations-admin", "clipboard"),
    ("manager", "AI Manager", "/ai-manager", "chart"),
]

PAGES = {
    "ai-operations-admin": {
        "key": "ops",
        "name": "AI Operations Admin",
        "title": "AI Operations Admin: WhatsApp after-sales | 41 Sales Team by 41 Labs",
        "description": "AI Operations Admin by 41 Sales Team runs your WhatsApp after-sales: invoices, booking changes, reminders and check-ins on the dates customers ask for.",
        "keywords": "AI Operations Admin, WhatsApp after-sales, AI receptionist WhatsApp, WhatsApp reminders, booking changes WhatsApp, 41 Sales Team, 41 Closer",
        "eyebrow": "AI Operations Admin for WhatsApp",
        "h1": "AI Operations Admin.",
        "h1_soft": "After-sales, done on WhatsApp.",
        "capsule": "The AI Operations Admin is the part of 41 Sales Team (formerly 41 Closer) that handles the work after a customer pays on WhatsApp. It sends the invoice, saves the details they give, moves or cancels bookings when your booking system is connected, checks in on the date they ask for, and hands a chat to your staff when needed.",
        "checks": ["Invoice sent the moment they pay", "Check-ins on the date they ask for", "Your staff step in any time"],
        "service_type": "WhatsApp after-sales and operations admin",
        "what_eyebrow": "What it does",
        "what_h2": "The after-sales work it does for you.",
        "what_lede": "Every item below runs on your WhatsApp number today.",
        "features": [
            ("receipt", "Sends the invoice after payment", "When the customer pays through the link in the chat, the invoice goes back to them on WhatsApp. It also sends one whenever a customer asks for it."),
            ("file", "Saves what customers tell it", "Dates, addresses, names and needs go on the customer's record as the chat goes. It also reads the photos and PDFs they send."),
            ("calendar", "Moves and cancels bookings", "When your booking system is connected, it finds the customer's own booking, moves it to a free time or cancels it. Late changes can go to your team instead."),
            ("bell", "Checks in on the date they ask for", "A customer says \"message me after the holidays\". It sets a check-in for that date and sends it then. You see the date in the chat."),
            ("repeat", "Chases quiet customers", "It follows up when a customer goes quiet. After 24 hours it uses WhatsApp-approved messages, which we set up for you. No follow-up goes out in your quiet hours."),
            ("send", "Messages your past customers", "Pick a tag, such as renewal due, and it messages everyone with it. Or set a date field, and each customer gets a reminder when their date comes near."),
            ("users", "Gives each chat an owner", "New chats go to the right person on your team, by country or by taking turns. That person is the first one alerted."),
            ("hand", "Hands a chat to your staff", "Your staff can take over a chat at any time, from the dashboard or from WhatsApp. Type /ai and it carries on."),
        ],
        "example_eyebrow": "See it in action",
        "example_h2": "What happens after they pay.",
        "example_lede": "Three messages your customers send after a sale, and what it does with each.",
        "examples": [
            ("After payment", [("in", "Paid. Can I get the invoice for my company?"), ("ai", "Thank you, payment received. Here is your invoice, INV-0142.|file|Invoice, S$180")], "Invoice sent"),
            ("Booking change, clinic with a connected booking system", [("in", "Can I move my Saturday appointment to Sunday?"), ("ai", "Sunday 25 Oct at 11am is free. Done, your appointment is now Sun 11am.")], "Booking moved"),
            ("A check-in the customer asked for", [("in", "Not now. Message me again in March?"), ("ai", "Sure. I will check in with you on Mon 1 Mar.")], "Check-in set for Mon 1 Mar, 9:00am"),
        ],
        "example_note": "Names, prices and dates above are examples. Moving a booking needs your booking system connected. When a chat needs a person, it goes to your team with the whole history.",
        "flow_lede": "Each AI picks up where the last one stopped, so the customer never has to start again.",
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
            ("How much does it cost?", "It is included in every 41 Sales Team plan, from S$299 a month. There is no separate fee for the AI Operations Admin."),
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
        "h1_soft": "See your sales and who needs you.",
        "capsule": "The AI Manager is the part of 41 Sales Team (formerly 41 Closer) that watches your WhatsApp sales for you. Its sales dashboard shows revenue closed, deals closed, your return and who still needs a reply. When a customer needs a person, it alerts the right staff member on WhatsApp, and it tells the admins if nobody answers.",
        "checks": ["Revenue and deals on one screen", "Alerts on your staff's WhatsApp", "Ask it questions on WhatsApp"],
        "service_type": "AI sales manager and sales dashboard for WhatsApp",
        "what_eyebrow": "What it does",
        "what_h2": "What it watches and tells you.",
        "what_lede": "Every item below is in your dashboard or on your WhatsApp today.",
        "features": [
            ("trend", "A sales dashboard", "Revenue closed, deals closed, your return on the plan and how many leads became sales. Pick this month, a date range or all time."),
            ("receipt", "Counts the sales", "Card payments taken in the chat count by themselves. When a customer says they paid by bank transfer or cash, it spots it and asks you to confirm."),
            ("board", "Your pipeline at a glance", "Every customer sits in a column by stage, so you see who is new, who is deciding and who has paid."),
            ("bell", "Alerts the right person on WhatsApp", "When a customer needs a person, the chat's owner gets a WhatsApp alert first. They swipe-reply the alert and the answer goes to the customer."),
            ("users", "Tells the admins if nobody answers", "If the owner has not replied within the wait you set, 15 minutes unless you change it, every admin gets a no reply yet message with a link to the chat."),
            ("chat", "Answers your questions on WhatsApp", "Send \"who is waiting on a reply?\" or \"how many leads today?\" to the alert number and it answers from your live data."),
            ("sparkle", "A Co-pilot in your dashboard", "Ask in plain words how many leads came in this week, where customers drop off, or what one customer wanted. It reads your own chats and numbers."),
            ("pulse", "Shows how the AI is doing", "The AI Health page shows how often the AI hands a chat to your team, how fast your team answers, and what is still waiting."),
        ],
        "example_eyebrow": "See it in action",
        "example_h2": "What reaches you, and when.",
        "example_lede": "Three moments from a normal day, on your phone and in your dashboard.",
        "examples": [
            ("A customer needs a person", [("bot", "Needs a person: Daniel L. wants a price for 40 units delivered Friday. Swipe-reply this message to answer."), ("team", "S$9 each for 40, delivery Friday is fine."), ("bot", "Sent to Daniel L. Delivered.")], "Answered in 4 minutes"),
            ("Nobody replied in time", [("bot", "No reply yet: Grace T. Mei was alerted 15 minutes ago and has not replied. Open chat.")], "Sent to every admin"),
            ("You ask a question", [("team", "How many leads came in today?"), ("bot", "14 new leads today. 3 are waiting on a reply: Grace T., Ahmad R. and Lim K.")], "Answered from live data"),
        ],
        "example_note": "Names and numbers above are examples. Alerts go to the WhatsApp numbers you list in Settings, and each person can turn their alerts on or off.",
        "flow_lede": "The AI Manager reads what the other AIs do, so you get one picture of the whole week.",
        "next": [
            "A weekly report to you on WhatsApp, every Monday",
            "A quality score for every conversation",
        ],
        "faqs": [
            ("What is the AI Manager?", "It is the part of 41 Sales Team that watches your WhatsApp sales for you. It shows revenue closed, deals and who needs a reply on a sales dashboard, and it alerts the right person on your team on WhatsApp when a customer needs one."),
            ("What does the sales dashboard show?", "Revenue closed, deals closed, your return on the plan, and how many leads became sales. Under that, the number of active leads, new leads today, chats that need a reply, and a pipeline board with every customer by stage."),
            ("How does it tell my staff when a customer needs them?", "It sends a WhatsApp alert to the person who owns the chat, with the customer's question and a link to the chat. They swipe-reply the alert, and their answer goes to the customer. If the chat has no owner, every admin gets the alert."),
            ("What happens if nobody answers?", "If the owner has not replied within the wait you set, every admin gets a no reply yet message. If a question still waits on your team after an hour, your admins get a reminder on WhatsApp."),
            ("Can I ask it questions on WhatsApp?", "Yes. Send a plain message to the alert number, such as who is waiting on a reply, or how many leads came in today. It answers from your live data. In the dashboard, the Co-pilot answers the same kind of question in more detail."),
            ("Can my staff see only their own chats?", "Yes. Staff open the inbox on Mine, which shows only the chats they own. Owners and admins see everything, and the dashboard shows how many chats each person owns, how many became sales and how fast they reply."),
            ("How much does it cost?", "It is included in every 41 Sales Team plan, from S$299 a month. There is no separate fee for the AI Manager."),
        ],
    },
}

# ---------------------------------------------------------------- render

CSS = """
        /* role page layer on top of site.css (siblings of /41-closer). Tokens only. */
        .hero-grid{display:grid;gap:48px;grid-template-columns:1fr;align-items:center}
        @media(min-width:960px){.hero-grid{grid-template-columns:1.05fr .95fr;gap:56px}}
        .hero-grid>*{min-width:0}
        .hero h1 .h1-soft{display:block}
        .hero .capsule{margin-top:24px;max-width:640px}
        .hero .capsule strong{font-weight:500}
        .hero h1{font-size:clamp(34px,4.6vw,52px)}
        @media(max-width:640px){.hero .capsule{font-size:16px;padding:16px 18px}}
        .hero .breadcrumb{margin-bottom:16px}
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
        .feat h3{font-size:18px}
        .ex-card{display:flex;flex-direction:column;gap:12px;padding:18px}
        .ex-card .ex-tag{font-size:13.5px;font-weight:500;color:var(--subtle);margin:0}
        .ex-card .chat{flex:1}
        .ex-card .ex-out{margin:0}
        .ex-note{margin:28px auto 0;max-width:720px;text-align:center;color:var(--muted)}
        .bubble.bot{background:var(--bubble-customer);align-self:flex-start;border-top-left-radius:6px}
        .bubble .who-bot{display:inline-block;font-size:10.5px;font-weight:600;padding:1px 7px;border-radius:var(--r-pill);background:var(--neutral-soft);color:var(--muted);margin-bottom:3px}
        .bubble .who-team{display:inline-block;font-size:10.5px;font-weight:600;padding:1px 7px;border-radius:var(--r-pill);background:rgba(29,78,216,.12);color:var(--info);margin-bottom:3px}
        .flow{list-style:none;margin:0;padding:0;display:grid;gap:16px;grid-template-columns:1fr}
        @media(min-width:760px){.flow{grid-template-columns:1fr 1fr}}
        @media(min-width:1040px){.flow{grid-template-columns:repeat(4,1fr)}}
        .flow li{display:flex;flex-direction:column;gap:8px}
        .flow .card{height:100%;display:flex;flex-direction:column;gap:8px}
        .flow .card.here{border:2px solid var(--primary)}
        .flow-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .flow-top .icon-chip{margin:0}
        .flow .card h3{margin:0}
        .flow .card a{font-weight:500;font-size:15px;text-decoration:none;margin-top:auto}
        .next-card{max-width:720px;margin:0 auto}
        .next-list{list-style:none;margin:0;padding:0;display:grid;gap:12px}
        .next-list li{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--border);color:var(--fg)}
        .next-list li:last-child{border-bottom:0}
        .price-line{max-width:720px;margin:24px auto 0;text-align:center;color:var(--muted)}
        .price-line b{color:var(--fg)}
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
        .final-grid{text-align:center}
        @media(max-width:640px){.cta-band{padding:32px 20px}}
"""

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
        "offers": {"@type": "Offer", "priceCurrency": "SGD", "price": "299",
                   "description": "Included in every 41 Sales Team plan, from S$299 a month.", "url": f"{ORIGIN}/#pricing"},
    }
    faq = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in p["faqs"]],
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
        label = ("Example WhatsApp chat: a customer pays S$180 and gets the invoice, then asks to move a Saturday "
                 "appointment to Sunday, and the AI moves it and sets a check-in for March.")
        chat = "".join([
            f'<span class="pill pill-good chat-event arrive" style="animation-delay:.2s">{icon("check", 12)} Paid S$180</span>',
            bubble("ai", "Thank you, payment received. Here is your invoice.|file|Invoice INV-0142, S$180", 0.8),
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
    label = ("Example sales dashboard: this month S$18,400 revenue closed, 23 deals closed, a return of 9 times "
             "the plan, and 3 chats that need a reply.")
    rows = [
        ("Grace T.", "Asked for a group price", "Waiting 12m", "pill-warn"),
        ("Ahmad R.", "Wants to change the delivery date", "Waiting 5m", "pill-warn"),
        ("Lim K.", "Paid by bank transfer, please confirm", "Needs confirm", "pill-warn"),
    ]
    row_html = "".join(
        f'<div class="dash-row"><span class="who">{esc(n)}<small>{esc(s)}</small></span><span class="pill {c}">{esc(t)}</span></div>'
        for n, s, t, c in rows)
    tiles = [("Revenue closed", "S$18,400", "+S$3,200 vs last month"), ("Deals closed", "23", "+4 vs last month"),
             ("Your return", "9x", "on your plan"), ("Lead to sale", "21%", "first reply in 19s")]
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
    other = "ai-manager" if key == "ops" else "ai-operations-admin"
    other_name = PAGES[other]["name"]

    checks = "".join(f"<li>{esc(c)}</li>" for c in p["checks"])
    features = "".join(
        f'<div class="card feat"><span class="icon-chip">{icon(ic, 20)}</span><h3>{esc(h)}</h3><p>{esc(t)}</p></div>'
        for ic, h, t in p["features"])

    ex_cards = []
    for tag, msgs, out in p["examples"]:
        ex_cards.append(
            '<div class="card ex-card">'
            f'<p class="ex-tag">{esc(tag)}</p>'
            f'<div class="chat">{"".join(bubble(k, t) for k, t in msgs)}</div>'
            f'<p class="ex-out"><span class="pill pill-good">{icon("check", 12)} {esc(out)}</span></p></div>')

    flow_items = [
        ("leads", "megaphone", "AI Leads Generator", "Brings new enquiries from your ads.", None, None),
        ("closer", "chat", "AI Sales Closer", "Answers every enquiry, quotes and takes the payment.", "/41-closer", "See the AI Sales Closer"),
        ("ops", "clipboard", "AI Operations Admin", "Handles the work after payment: invoices, changes and check-ins.", "/ai-operations-admin", "See the AI Operations Admin"),
        ("manager", "chart", "AI Manager", "Shows you what came in, what was paid and what needs you.", "/ai-manager", "See the AI Manager"),
    ]
    flow = []
    for k, ic, name, text, href, link in flow_items:
        here = k == key
        if k == "leads":
            pill = '<span class="pill">Coming soon</span>'
        elif here:
            pill = '<span class="pill pill-good">This page</span>'
        else:
            pill = '<span class="pill pill-good">Live</span>'
        a = f'<a href="{href}">{link} {icon("arrow", 14)}</a>' if href and not here else ""
        flow.append(f'<li><div class="card{" here" if here else ""}"><div class="flow-top"><span class="icon-chip">{icon(ic, 20)}</span>{pill}</div>'
                    f'<h3>{name}</h3><p>{text}</p>{a}</div></li>')

    nxt = "".join(f'<li><span>{esc(n)}</span><span class="pill">Coming soon</span></li>' for n in p["next"])
    faq_html = "".join(
        f'<details{" open" if i == 0 else ""}><summary>{esc(q)}</summary><p>{esc(a)}</p></details>'
        for i, (q, a) in enumerate(p["faqs"]))

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

    <style>{CSS}    </style>
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
                    <div class="capsule"><p><strong>{esc(p['capsule'])}</strong></p></div>
                    <div class="btn-row">
                        <a class="btn btn-primary btn-lg" href="{BUILD_CALL}">Book your build call</a>
                        <a class="btn btn-secondary btn-lg" href="{WA_DEMO}" target="_blank" rel="noopener">{icon('wa')} Try it on WhatsApp</a>
                    </div>
                    <ul class="hero-checks">{checks}</ul>
                </div>
                <div>
                    {hero_visual(key)}
                </div>
            </div>
            {team_strip(key)}
        </div>
    </header>

    <section id="what-it-does" class="section section-white">
        <div class="wrap">
            <div class="section-head center">
                <span class="eyebrow">{esc(p['what_eyebrow'])}</span>
                <h2>{esc(p['what_h2'])}</h2>
                <p class="lede">{esc(p['what_lede'])}</p>
            </div>
            <div class="grid-2">{features}</div>
        </div>
    </section>

    <section id="see-it-work" class="section">
        <div class="wrap">
            <div class="section-head center">
                <span class="eyebrow">{esc(p['example_eyebrow'])}</span>
                <h2>{esc(p['example_h2'])}</h2>
                <p class="lede">{esc(p['example_lede'])}</p>
            </div>
            <div class="grid-3">{"".join(ex_cards)}</div>
            <p class="ex-note">{esc(p['example_note'])}</p>
        </div>
    </section>

    <section id="the-team" class="section section-white">
        <div class="wrap">
            <div class="section-head center">
                <span class="eyebrow">How it works with the other AIs</span>
                <h2>Four AIs, one sales team.</h2>
                <p class="lede">{esc(p['flow_lede'])} Read how an <a href="/ai-sales-agent-singapore">AI sales agent works in Singapore</a>.</p>
            </div>
            <ul class="flow">{"".join(flow)}</ul>
            <p class="price-line"><b>Included in every plan, from S$299 a month.</b> <a href="{PRICING}">See the plans</a>. Next, see the <a href="/{other}">{other_name}</a>.</p>
        </div>
    </section>

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

    <section id="faq" class="section section-white">
        <div class="wrap">
            <div class="section-head center">
                <span class="eyebrow">Questions</span>
                <h2>What owners ask about the {p['name']}.</h2>
            </div>
            <div class="faq read center-block">{faq_html}</div>
        </div>
    </section>

    <section id="start-now" class="section">
        <div class="wrap">
            <div class="cta-band wash">
                <div class="final-grid">
                    <span class="eyebrow">Start now</span>
                    <h2>See it on your own business.</h2>
                    <p class="lede">Book a build call and we build it from your website before we meet. Or message the AI Sales Closer on WhatsApp right now.</p>
                    <div class="btn-row">
                        <a class="btn btn-primary btn-lg" href="{BUILD_CALL}">Book your build call</a>
                        <a class="btn btn-secondary btn-lg" href="{WA_DEMO}" target="_blank" rel="noopener">{icon('wa')} Chat with it now</a>
                    </div>
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


def main() -> None:
    for slug, p in PAGES.items():
        out = ROOT / f"{slug}.html"
        text = build(slug, p)
        old = out.read_text() if out.exists() else None
        if old != text:
            out.write_text(text)
            print(f"wrote {out.relative_to(ROOT)}")
        else:
            print(f"unchanged {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
