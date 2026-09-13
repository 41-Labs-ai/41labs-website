"""Builds the shared pieces of /ai-closer and /ai-closer-sf: the qualify-first form,
the WhatsApp screens (hero + proof chats) and the homepage 'Seen at' strip.
Run: python3 scripts/build_ai_closer.py  (idempotent: replaces marked blocks)."""
import html, json, os, re, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHATS = os.path.expanduser('~/Projects/41closer-marketing/assets/landing-proof-2026-09/chats')

I = {
 'back': '<svg class="wa-back" viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
 'video': '<svg class="wa-act" viewBox="0 0 24 24" stroke-width="1.8" stroke-linejoin="round"><rect x="2.5" y="6" width="13" height="12" rx="3"/><path d="M15.5 10.5l6-3.5v10l-6-3.5z"/></svg>',
 'call': '<svg class="wa-act" viewBox="0 0 24 24" stroke-width="1.8" stroke-linejoin="round"><path d="M5.2 3.5h3l1.6 4.2-2.1 1.5a11 11 0 005.1 5.1l1.5-2.1 4.2 1.6v3a2.4 2.4 0 01-2.6 2.4C9.7 18.8 5.2 14.3 4.7 6.1a2.4 2.4 0 01.5-2.6z"/></svg>',
 'plus': '<svg viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
 'cam': '<svg viewBox="0 0 24 24" stroke-width="1.7" stroke-linejoin="round"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
 'mic': '<svg viewBox="0 0 24 24" stroke-width="1.7" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21"/></svg>',
 'ticks': '<svg class="wa-ticks" viewBox="0 0 16 11"><path d="M1 6l3 3 6-7.5M6.5 8.5l1 1 6.5-8"/></svg>',
 'bar': '<span class="wa-icons"><svg viewBox="0 0 18 11"><rect x="0" y="7" width="3" height="4" rx=".8"/><rect x="5" y="5" width="3" height="6" rx=".8"/><rect x="10" y="2.5" width="3" height="8.5" rx=".8"/><rect x="15" y="0" width="3" height="11" rx=".8"/></svg><svg viewBox="0 0 16 11"><path d="M8 10.5l2.2-2.6a3 3 0 00-4.4 0zM8 3.8a7 7 0 015 2.1l1.4-1.6A9.2 9.2 0 008 1.6a9.2 9.2 0 00-6.4 2.7L3 5.9a7 7 0 015-2.1z"/></svg><svg viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3.2" fill="none" stroke="#111" stroke-opacity=".4"/><rect x="2" y="2" width="17" height="8" rx="2"/><rect x="23.5" y="4" width="1.8" height="4" rx=".9" fill-opacity=".4"/></svg></span>',
}

def fmt(t):
    t = html.escape(t)
    t = re.sub(r'\*([^*\n]+)\*', r'<b>\1</b>', t)
    t = t.replace('[secure payment link]', '<span class="wa-link">[secure payment link]</span>')
    return t.replace('\n', '<br>')

AV_COLOURS = ['#075E54', '#1F6FB2', '#8A5A2B', '#6B3FA0', '#0F766E', '#9A3412', '#3F6212', '#7C2D53', '#1E3A8A']

def screen(name, initials, msgs, status='online', cls='', label='', av=0, verified=False):
    rows = []
    for msg in msgs:
        who, text, time = msg[0], msg[1], msg[2]
        img = msg[3] if len(msg) > 3 else None
        side = 'wa-out' if who == 'customer' else 'wa-in'
        meta = f'<span class="wa-meta">{time} {I["ticks"]}</span>' if who == 'customer' else f'<span class="wa-meta">{time}</span>'
        pic = (f'<img class="wa-pic" src="{img}" alt="" width="520" height="390" loading="lazy">' if img else '')
        rows.append(f'<div class="wa-msg {side}{" wa-has-pic" if img else ""}">{pic}{fmt(text)}{meta}</div>')
    return (f'<div class="wa {cls}" role="img" aria-label="{html.escape(label or ("WhatsApp chat with " + name))}">'
            f'<div class="wa-bar"><span>9:41</span>{I["bar"]}</div>'
            f'<div class="wa-head">{I["back"]}<div class="wa-av" style="background:{AV_COLOURS[av % len(AV_COLOURS)]}">{initials}</div>'
            f'<div class="wa-who"><div class="wa-name">{html.escape(name)}</div><div class="wa-status-line">{status}</div></div>'
            f'{I["video"]}{I["call"]}</div>'
            f'<div class="wa-body"><div class="wa-day">Today</div>{"".join(rows)}</div>'
            f'<div class="wa-input">{I["plus"]}<div class="wa-field"></div>{I["cam"]}{I["mic"]}</div></div>')

HERO_CHATS = [
    ('servicing', 'Aircon', 'CoolAir Services', 'CA', [
        ('customer', 'Hi, still open? Need 3 aircon units serviced.', '02:02'),
        ('closer', 'Hi! Yes, we can help. Is it a condo or landed, and which area?', '02:02'),
        ('customer', 'Condo, Tampines', '02:03'),
        ('closer', 'Got it. For 3 units in Tampines I can hold Saturday 10am or 2pm. Which works?', '02:03'),
        ('customer', '10am please', '02:03'),
        ('closer', "Done. You're booked for Saturday 10am. I'll send a reminder the day before.", '02:03'),
    ]),
    ('renovation', 'Renovation', 'Meridian Interiors', 'MI', [
        ('customer', 'Hi, how much to redo a 4 room HDB kitchen?', '23:41'),
        ('closer', 'Evening! Happy to help. Are you keeping the current layout, or moving the sink and hob?', '23:41'),
        ('customer', 'Keeping layout. Just cabinets and countertop', '23:42'),
        ('closer', 'That helps. Quartz or sintered stone for the top, and are you after laminate or spray paint carpentry?', '23:42'),
        ('customer', 'Quartz, laminate is fine', '23:43'),
        ('closer', 'Noted. Our designer can do a site measure this week. Thursday 11am or Saturday 2pm?', '23:43'),
        ('customer', 'Saturday', '23:44'),
        ('closer', 'Booked for Saturday 2pm. I have sent the details here and our designer will bring samples.', '23:44'),
    ]),
    ('clinic', 'Clinic', 'Orchard Aesthetics', 'OA', [
        ('customer', 'Do you have any slots this week for a consult?', '21:18'),
        ('closer', 'Hi! Yes. Is this your first visit with us, and what would you like to treat?', '21:18'),
        ('customer', 'First time. Acne scars', '21:19'),
        ('closer', 'Thanks. Our doctor will assess the scar type first, then recommend the right treatment. The consult is S$55 and goes toward your treatment if you proceed.', '21:19'),
        ('customer', 'Ok can. Thursday evening?', '21:20'),
        ('closer', 'Thursday 7pm or 7.30pm are open. Which suits you?', '21:20'),
        ('customer', '7pm', '21:20'),
        ('closer', 'Booked for Thursday 7pm. Our clinic is at Orchard, and I have sent the address here.', '21:21'),
    ]),
    ('car', 'Car rental', 'Lion City Rentals', 'LC', [
        ('customer', 'Hi need a car from 18 to 21 Dec', '01:12'),
        ('closer', 'Hi! Sure. How many passengers, and are you driving into Malaysia?', '01:12'),
        ('customer', '5 pax, yes going JB', '01:13'),
        ('closer', 'Noted. For 5 with Malaysia use I have a Toyota Sienta at S$105 a day, and a Honda Stepwagon at S$135 a day. Both include the Malaysia permit.', '01:13'),
        ('customer', 'Sienta ok. How to confirm?', '01:14'),
        ('closer', 'A S$200 deposit holds it. Here is the secure payment link, and the car is reserved the moment it goes through.', '01:14'),
    ]),
]

def hero_block():
    tabs, screens = [], []
    for i, (key, label, name, ini, msgs) in enumerate(HERO_CHATS):
        on = ' on' if i == 0 else ''
        tabs.append(f'<button type="button" class="wa-tab{on}" data-chat="{key}">{label}</button>')
        screens.append(f'<div class="wa-slot{on}" data-chat="{key}"{"" if i == 0 else " hidden"}>'
                       + screen(name, ini, msgs, cls='wa-live',
                                label=f'Example WhatsApp chat: a customer enquires and the 41 Closer replies for a {label.lower()} business')
                       + '</div>')
    return ('<div class="wa-tabs" role="tablist" aria-label="Pick your kind of business">' + ''.join(tabs) + '</div>'
            + ''.join(screens))

# Proof gallery: 8 short WhatsApp screens, each proving ONE thing. No scrolling.
# source: "Demo line" = verbatim from our own demo builds (customer details and
# product codes redacted, brand-name products avoided). "Example" = written by us.
# Real product photos, from the catalogue images we generated ourselves for the
# ValueMax enrichment pipeline. Names and prices below are the real catalogue rows,
# so the chat quotes a product that actually exists at the price it actually is.
RING = 'assets/closer/chat/ring.webp'
NECKLACE = 'assets/closer/chat/necklace.webp'
BANGLE = 'assets/closer/chat/bangle.webp'
CAR = 'assets/closer/chat/car.webp'

PROOF_CARDS = [
    ("Answers in seconds, at 2am", "", "CoolAir Services", "CA", [
        ("customer", "Hi, still open? Need 3 aircon units serviced.", "02:02"),
        ("closer", "Hi! Yes, we can help. Is it a condo or landed, and which area?", "02:02"),
        ("customer", "Condo, Tampines", "02:03"),
        ("closer", "Got it. For 3 units in Tampines I can hold Saturday 10am or 2pm. Which works?", "02:03"),
    ]),
    ("Knows the product better than a new hire", "", "Steel supplier", "SS", [
        ("customer", "whats the difference between the 4mm and the 5mm", "10:41"),
        ("closer", "Mostly load and price. The 4mm takes about 210kg a span, the 5mm about 340kg, and the 5mm is roughly 22% dearer.\n\nIf it is shelving up to a metre, 4mm is usually enough. Spanning wider than that, I would go 5mm.", "10:41"),
        ("customer", "1.4m span, storing tiles", "10:43"),
        ("closer", "Then 5mm. Tiles are dense and 1.4m is past what the 4mm holds comfortably.", "10:43"),
    ]),
    ("Qualifies before it quotes", "", "Bhutan tours", "BT", [
        ("customer", "I'm planning to travel with my friends (maybe 3 of us) in December. Is that a good time?", "16:13"),
        ("closer", "December is a lovely time to visit Bhutan! The skies are crystal clear and it's quieter than the peak autumn season.\n\nWhat kind of experience are you hoping for, more culture and monasteries, getting out into nature, or a mix of both?", "16:13"),
        ("customer", "We'd like to experience both", "16:14"),
        ("closer", "That's a great combination. Are you and your friends up for some hiking, like the famous Tiger's Nest climb, or do you prefer scenic drives and gentle walks?", "16:14"),
    ]),
    ("Quotes from your live price list", "", "Jewellery store", "JS", [
        ("customer", "i want to buy rings", "22:05"),
        ("closer", "Great, rings it is! What is your budget range, and is this for yourself or a gift?", "22:05"),
        ("customer", "anything below 1k sgd", "22:10"),
        ("closer", "*18K White Gold Diamond Ring* \u2014 S$949\nFour diamonds, 0.14ct total, square set. In stock at two branches.", "22:10", RING),
    ]),
    ("Checks stock before it promises", "", "Building supplies", "BS", [
        ("customer", "got 4mm in stock? need 200pcs by friday", "08:12"),
        ("closer", "Yes. 340 pieces at Woodlands right now, so 200 is fine for Friday.", "08:12"),
        ("customer", "price?", "08:13"),
        ("closer", "At 200 you are on the trade tier: S$4.20 each, S$840 for the lot. Want me to hold them?", "08:13"),
    ]),
    ("Books it and takes the deposit", "", "Lion City Rentals", "LC", [
        ("customer", "Hi need a car from 18 to 21 Dec, 5 pax, going JB", "01:12"),
        ("closer", "Noted. For 5 with Malaysia use I have a *Toyota Sienta* at S$105 a day. The permit is included.", "01:13", CAR),
        ("customer", "Sienta ok. How to confirm?", "01:14"),
        ("closer", "A S$200 deposit holds it. Here is the secure payment link, and the car is reserved the moment it goes through: [secure payment link]", "01:14"),
    ]),
    ("Handles \u201ctoo expensive\u201d without discounting", "", "Orchard Aesthetics", "OA", [
        ("customer", "You are very expensive. Others quote me less", "22:38"),
        ("closer", "I understand it feels that way upfront. Ours is a semi-permanent result, so there is nothing to buy monthly after it.", "22:38"),
        ("customer", "Any discount?", "22:47"),
        ("closer", "Pricing is set by our specialist team, so I can't discount here. The honest way to know if it's worth it is a consult, and that fee goes toward your treatment.", "22:47"),
    ]),
    ("Recommends from the whole catalogue", "", "Jewellery store", "JS", [
        ("customer", "anniversary gift, around 2k, she already has rings", "19:31"),
        ("closer", "Then a necklace is the safer call.\n\n*18K White Gold Diamond Necklace* \u2014 S$2,189\n0.68ct, floral cluster. It sits well with the white gold she already wears.", "19:31", NECKLACE),
        ("customer", "anything under 2k?", "19:33"),
        ("closer", "There is, but at this size the drop in stone quality shows. If 2,189 is close enough I would stay with this one.", "19:33"),
    ]),
    ("Follows up when they go quiet", "", "Meridian Interiors", "MI", [
        ("closer", "Hi Wei, quick one on the kitchen quote I sent Monday. Are you still deciding, or is something in it not quite right?", "10:14"),
        ("customer", "Sorry busy week. Still keen, my wife wants to see other door colours", "12:02"),
        ("closer", "No problem at all. I'll send three colour options in the same price. If one works, our designer can hold Saturday 2pm for the site measure.", "12:02"),
    ]),
]

def proof_cards():
    out = []
    for i, (label, src, name, ini, msgs) in enumerate(PROOF_CARDS):
        out.append(f'<figure class="chatfig reveal"><figcaption class="chatcap chatcap-top">{html.escape(label)}</figcaption>'
                   + screen(name, ini, msgs, cls='wa-card', av=i) + '</figure>')
    return '\n            '.join(out)

SEEN = '''<p class="seen-label">Proud member of the Singapore A.I. Association &middot; Seen at</p>
            <div class="seen-row">
                <span class="chip"><img src="/logos/saia.png" alt="Singapore A.I. Association" height="28" loading="lazy"></span>
                <span class="chip"><img src="/logos/nrf.jpg" alt="NRF Big Show APAC" height="28" loading="lazy"></span>
                <span class="chip"><img src="/logos/superai.jpg" alt="SuperAI" height="28" loading="lazy"></span>
                <span class="chip"><img src="/logos/stripe.png" alt="Stripe" height="28" loading="lazy"></span>
            </div>
            <div class="built">
                <p class="built-label">Built on</p>
                <div class="built-row">
                    <figure class="built-item"><img src="logos/whatsapp.svg" alt="WhatsApp" height="24" loading="lazy"><figcaption>WhatsApp Business Platform</figcaption></figure>
                    <figure class="built-item"><img src="logos/meta.svg" alt="Meta" height="20" loading="lazy"><figcaption>Meta</figcaption></figure>
                    <figure class="built-item"><img src="logos/anthropic.svg" alt="Anthropic" height="20" loading="lazy"><figcaption>Anthropic Claude</figcaption></figure>
                    <figure class="built-item"><img src="logos/googlegemini.svg" alt="Google Gemini" height="20" loading="lazy"><figcaption>Google</figcaption></figure>
                </div>
                <p class="built-label built-label-2">Partners</p>
                <div class="built-row">
                    <figure class="built-item"><img src="logos/stripe.svg" alt="Stripe" height="20" loading="lazy"><figcaption>Stripe</figcaption></figure>
                    <figure class="built-item"><span class="built-word">airwallex</span><figcaption>Airwallex</figcaption></figure>
                </div>
            </div>'''

def opt(v, t): return f'<option value="{v}">{t}</option>'
SELECT_PH = '<option value="" disabled selected>Choose one</option>'

# Contact FIRST, then qualify. Deliberate reversal (13 Sep 2026): capturing the number
# before the qualifying questions means a half-finished form is still a lead we can
# message, instead of an anonymous bounce. Industry is not asked at all, because the
# website tells us. Email is not asked, because the conversation happens on WhatsApp.
CHALLENGES = [
    ('slow', 'Replies take too long'),
    ('afterhours', 'Nobody answers after hours'),
    ('followup', 'We forget to follow up'),
    ('stock', 'Checking stock or prices is slow'),
    ('quotes', 'Quoting takes too much time'),
    ('volume', 'Too many enquiries to handle'),
]
GOALS = [
    ('recover', 'Stop losing enquiries we already paid for'),
    ('faster', 'Reply and quote faster'),
    ('scale', 'Handle more enquiries without hiring'),
    ('freeteam', 'Free the team from repetitive chats'),
    ('unsure', 'Not sure yet, want to see what it can do'),
]

FORM_CTA = '''<p class="wa-cta-line">Prefer to just try it? <a class="wa-cta" href="https://wa.me/6580124848?text=Hi%2C%20I%20want%20to%20see%2041%20Closer%20handle%20my%20kind%20of%20enquiry.">Chat with our own AI Closer on WhatsApp</a></p>'''

ENQ_OPTS = SELECT_PH + ''.join(opt(v, t) for v, t in [
    ('under20', 'Under 20'), ('20to50', '20 to 50'), ('50to150', '50 to 150'), ('150plus', 'Over 150')])
SALE_OPTS = SELECT_PH + ''.join(opt(v, t) for v, t in [
    ('under500', 'Under S$500'), ('500to2k', 'S$500 to S$2,000'),
    ('2kto10k', 'S$2,000 to S$10,000'), ('10kplus', 'Over S$10,000')])
GOAL_OPTS = SELECT_PH + ''.join(opt(v, t) for v, t in GOALS)
CHALLENGE_CHIPS = ''.join(
    f'<label class="chip-opt"><input type="checkbox" name="challenges" value="{v}"><span>{html.escape(t)}</span></label>'
    for v, t in CHALLENGES)

FORM = f'''<form id="cl-form" action="https://formspree.io/f/mvzrzryw" method="POST">
                    <div id="cl-step1">
                        <div class="cl-tabs" aria-hidden="true"><span class="cl-tab on">1. Who you are</span><span class="cl-tab">2. Your business</span></div>
                        <div id="cl-part1">
                            <div class="fields">
                                <div class="field full"><label for="cl-name">Your name</label>
                                    <input id="cl-name" name="name" type="text" autocomplete="name" required></div>
                                <div class="field full"><label for="cl-email">Email</label>
                                    <input id="cl-email" name="email" type="email" autocomplete="email" placeholder="you@company.com" required></div>
                                <div class="field full"><label for="cl-whatsapp">WhatsApp number</label>
                                    <input id="cl-whatsapp" name="whatsapp" type="tel" autocomplete="tel" placeholder="+65" required>
                                    <small class="help">Your Closer picks up the conversation here.</small></div>
                                <div class="hp" aria-hidden="true"><label>Website URL <input type="text" name="url_hp" tabindex="-1" autocomplete="off"></label></div>
                                <input type="hidden" name="_subject" value="New 41 Closer lead (ad landing page)">
                            </div>
                            <button class="btn btn-primary btn-block" id="cl-next" type="button">Next <span class="arrow">&rarr;</span></button>
                        </div>
                        <div id="cl-part2" hidden>
                            <div class="fields">
                                <div class="field full"><label for="cl-website">Your website</label>
                                    <input id="cl-website" name="website" type="text" inputmode="url" autocomplete="url" placeholder="yourcompany.com" required
                                           aria-describedby="cl-website-help cl-website-error">
                                    <small class="help" id="cl-website-help">We build your Closer on it, so it answers with your own products and prices.</small>
                                    <p class="jobs-error" id="cl-website-error" hidden>That does not look like a website. Try something like yourcompany.com</p></div>
                                <div class="field"><label for="cl-enquiries">WhatsApp enquiries a week</label>
                                    <select id="cl-enquiries" name="enquiries" required>{ENQ_OPTS}</select></div>
                                <div class="field"><label for="cl-sale">Average sale</label>
                                    <select id="cl-sale" name="saleValue" required>{SALE_OPTS}</select></div>
                                <fieldset class="field full jobs" id="cl-jobs">
                                    <legend>What is costing you most? <span class="opt">(pick all that apply)</span></legend>
                                    <div class="chips">{CHALLENGE_CHIPS}</div>
                                    <p class="jobs-error" id="cl-jobs-error" hidden>Pick at least one.</p>
                                </fieldset>
                                <div class="field full"><label for="cl-goal">What would make this worth doing?</label>
                                    <select id="cl-goal" name="goal" required>{GOAL_OPTS}</select></div>
                            </div>
                            <div class="form-foot">
                                <button class="link-back" id="cl-back" type="button">&larr; Back</button>
                                <button class="btn btn-primary" id="cl-submit" type="submit">See if we can help <span class="arrow">&rarr;</span></button>
                            </div>
                        </div>
                    </div>

                    <div id="cl-step2" hidden>
                        <div id="cl-book" hidden>
                            <span class="ok-badge">&#10003; You qualify</span>
                            <div id="cl-cal-head">
                                <h3>Pick a time. We build your Closer before we meet.</h3>
                                <p>20 minutes on Google Meet with Alexander. Your own products, your own prices, your numbers.</p>
                            </div>
                            <div id="cl-cal"></div>
                            <div id="cl-handoff" hidden>
                                <p class="handoff-lead"><b>Booked.</b> One more thing: say hello to your Closer on WhatsApp. Everything you told us is already in the message, and you get to watch it work before the call.</p>
                                <a class="btn btn-primary btn-block" id="cl-wa-handoff" href="https://wa.me/6580124848" target="_blank" rel="noopener">Message now <span class="arrow">&rarr;</span></a>
                            </div>
                            <div id="cl-cal-fallback" hidden>
                                <p>Thanks, <span class="cl-first"></span>. Message your Closer on WhatsApp and it will put a time in Alexander's calendar for you.</p>
                            </div>
                        </div>
                        <div id="cl-notyet" hidden>
                            <h3>Thanks, <span class="cl-first"></span>.</h3>
                            <p>From your answers, building you a Closer may not pay for itself yet. We'll look properly and come back to you within one working day either way, with the numbers we worked out on your business.</p>
                        </div>
                    </div>
                </form>'''

def replace_block(s, start, end, new):
    a = s.index(start); b = s.index(end, a) + len(end)
    return s[:a] + new + s[b:]

def build(page, hero_chat=True, seen=False, proof=False):
    p = os.path.join(ROOT, page); s = open(p).read()
    s = replace_block(s, '<form id="cl-form"', '</form>', FORM)
    # The "Prefer to just try it?" line is gone: it offered an escape route at the exact
    # moment we want their details. This sweeps up every copy, including the duplicates an
    # earlier bug left behind, and any stale {FORM_CTA} placeholder.
    s = re.sub(r'\s*(?:<p class="wa-cta-line">.*?</p>|\{FORM_CTA\})', '', s, flags=re.S)
    if hero_chat:
        s = replace_block(s, '<!-- WA-HERO -->', '<!-- /WA-HERO -->', '<!-- WA-HERO -->' + hero_block() + '<!-- /WA-HERO -->')
    if seen:
        s = replace_block(s, '<!-- SEEN -->', '<!-- /SEEN -->', '<!-- SEEN -->\n            ' + SEEN + '\n            <!-- /SEEN -->')
    if proof:
        s = replace_block(s, '<!-- PROOF-CHATS -->', '<!-- /PROOF-CHATS -->', '<!-- PROOF-CHATS -->\n            ' + proof_cards() + '\n            <!-- /PROOF-CHATS -->')
    open(p, 'w').write(s)
    print('built', page)

if __name__ == '__main__':
    build('ai-closer.html', seen=True, proof=True)
    build('ai-closer-sf.html')
