"""Builds the shared pieces of /ai-closer and /ai-closer-sf: the qualify-first form,
the WhatsApp screens (hero + proof chats) and the homepage 'Seen at' strip.
Run: python3 scripts/build_ai_closer.py  (idempotent: replaces marked blocks)."""
import html, json, os, re

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

def screen(name, initials, msgs, status='online', cls='', label=''):
    rows = []
    for who, text, time in msgs:
        if who == 'customer':
            rows.append(f'<div class="wa-msg wa-out">{fmt(text)}<span class="wa-meta">{time} {I["ticks"]}</span></div>')
        else:
            rows.append(f'<div class="wa-msg wa-in">{fmt(text)}<span class="wa-meta">{time}</span></div>')
    return (f'<div class="wa {cls}" role="img" aria-label="{html.escape(label or ("WhatsApp chat with " + name))}">'
            f'<div class="wa-bar"><span>9:41</span>{I["bar"]}</div>'
            f'<div class="wa-head">{I["back"]}<div class="wa-av">{initials}</div>'
            f'<div class="wa-who"><div class="wa-name">{html.escape(name)}</div><div class="wa-status-line">{status}</div></div>'
            f'{I["video"]}{I["call"]}</div>'
            f'<div class="wa-body"><div class="wa-day">Today</div>{"".join(rows)}</div>'
            f'<div class="wa-input">{I["plus"]}<div class="wa-field"></div>{I["cam"]}{I["mic"]}</div></div>')

HERO_CHAT = screen('CoolAir Services', 'CA', [
    ('customer', 'Hi, still open? Need 3 aircon units serviced.', '02:02'),
    ('closer', 'Hi! Yes, we can help. Is it a condo or landed, and which area?', '02:02'),
    ('customer', 'Condo, Tampines', '02:03'),
    ('closer', 'Got it. For 3 units in Tampines I can hold Saturday 10am or 2pm. Which works?', '02:03'),
    ('customer', '10am please', '02:03'),
    ('closer', "Done. You're booked for Saturday 10am. I'll send a reminder the day before.", '02:03'),
], cls='wa-live', label='Example WhatsApp chat: a customer enquires at 2am and the 41 Closer books the job')

PROOF = [
    ('jewellery-ring-to-payment.json', 'Jewellery store', 'JS', 'Ring chosen and paid for by payment link, 10pm.'),
    ('fnb-wholesale-reorder-delivery.json', 'Baking supplies', 'BS', 'Trade reorder confirmed with a delivery slot.'),
    ('travel-bhutan-trip-planning.json', 'Bhutan tours', 'BT', 'Trip matched to the right package in 3 minutes.'),
]

def proof_cards():
    out = []
    for f, name, ini, cap in PROOF:
        d = json.load(open(os.path.join(CHATS, f)))
        msgs = [(m['from'], m['text'], m.get('time', '')) for m in d['messages'][:11]]
        out.append(f'<figure class="chatfig reveal">{screen(name, ini, msgs, cls="wa-scroll")}'
                   f'<figcaption class="chatcap">{cap} Demo line, customer details removed.</figcaption></figure>')
    return '\n            '.join(out)

SEEN = '''<p class="seen-label">Proud member of the Singapore A.I. Association &middot; Seen at</p>
            <div class="seen-row">
                <span class="chip"><img src="/logos/saia.png" alt="Singapore A.I. Association" height="28" loading="lazy"></span>
                <span class="chip"><img src="/logos/nrf.jpg" alt="NRF Big Show APAC" height="28" loading="lazy"></span>
                <span class="chip"><img src="/logos/superai.jpg" alt="SuperAI" height="28" loading="lazy"></span>
                <span class="chip"><img src="/logos/stripe.png" alt="Stripe" height="28" loading="lazy"></span>
            </div>'''

def opt(v, t): return f'<option value="{v}">{t}</option>'
SELECT_PH = '<option value="" disabled selected>Choose one</option>'
INDUSTRIES = [('renovation','Renovation or interior design'),('clinic','Clinic, aesthetics or dental'),('car','Car rental or car dealer'),
              ('property','Property agency'),('education','Education or tuition'),('distributor','Distributor, wholesale or trade supplier'),
              ('servicing','Servicing (aircon, plumbing, pest control, cleaning)'),('travel','Travel or tours'),('retail','Retail or online shop'),('other','Something else')]

FORM = f'''<form id="cl-form" action="https://formspree.io/f/mvzrzryw" method="POST">
                    <div id="cl-step1">
                        <div class="cl-tabs" aria-hidden="true"><span class="cl-tab on">1. Check if you qualify</span><span class="cl-tab">2. Your details</span></div>
                        <div id="cl-part1">
                            <div class="fields">
                                <div class="field full"><label for="cl-industry">What does your business do?</label>
                                    <select id="cl-industry" name="industry" required>{SELECT_PH}{"".join(opt(v,t) for v,t in INDUSTRIES)}</select></div>
                                <div class="field full"><label for="cl-wa">Do customers message you on WhatsApp before they buy?</label>
                                    <select id="cl-wa" name="whatsappUse" required>{SELECT_PH}{opt("most","Yes, most sales start on WhatsApp")}{opt("some","Some do")}{opt("no","Not really")}</select></div>
                                <div class="field"><label for="cl-enquiries">WhatsApp enquiries a week</label>
                                    <select id="cl-enquiries" name="enquiries" required>{SELECT_PH}{opt("under20","Under 20")}{opt("20to50","20 to 50")}{opt("50to150","50 to 150")}{opt("150plus","Over 150")}</select></div>
                                <div class="field"><label for="cl-sale">Average sale</label>
                                    <select id="cl-sale" name="saleValue" required>{SELECT_PH}{opt("under200","Under S$200")}{opt("200to1k","S$200 to S$1,000")}{opt("1kto5k","S$1,000 to S$5,000")}{opt("5kplus","Over S$5,000")}</select></div>
                                <fieldset class="field full jobs" id="cl-jobs">
                                    <legend>What do those chats usually involve? <span class="opt">(pick all that apply)</span></legend>
                                    <div class="chips">
                                        <label class="chip-opt"><input type="checkbox" name="jobs" value="answers"><span>Answering simple questions</span></label>
                                        <label class="chip-opt"><input type="checkbox" name="jobs" value="quotes"><span>Giving quotes or recommending options</span></label>
                                        <label class="chip-opt"><input type="checkbox" name="jobs" value="bookings"><span>Booking appointments, viewings or site visits</span></label>
                                        <label class="chip-opt"><input type="checkbox" name="jobs" value="stock"><span>Checking stock or prices across many products</span></label>
                                        <label class="chip-opt"><input type="checkbox" name="jobs" value="orders"><span>Taking orders, deposits or payments</span></label>
                                    </div>
                                    <p class="jobs-error" id="cl-jobs-error" hidden>Pick at least one.</p>
                                </fieldset>
                            </div>
                            <button class="btn btn-primary btn-block" id="cl-next" type="button">Next <span class="arrow">&rarr;</span></button>
                        </div>
                        <div id="cl-part2" hidden>
                            <div class="fields">
                                <div class="field"><label for="cl-name">Your name</label><input id="cl-name" name="name" type="text" autocomplete="name" required></div>
                                <div class="field"><label for="cl-whatsapp">WhatsApp number</label><input id="cl-whatsapp" name="whatsapp" type="tel" autocomplete="tel" placeholder="+65" required></div>
                                <div class="field"><label for="cl-company">Company</label><input id="cl-company" name="company" type="text" autocomplete="organization" required></div>
                                <div class="field"><label for="cl-role">Your role</label>
                                    <select id="cl-role" name="role" required>{SELECT_PH}{opt("owner","Owner")}{opt("sales_head","Head of sales")}{opt("manager","Manager")}{opt("other","Other")}</select></div>
                                <div class="field full"><label for="cl-website">Website or Instagram</label><input id="cl-website" name="website" type="text" autocomplete="url" placeholder="yourcompany.com or @yourcompany">
                                    <small class="help">We look at it before the call, so your demo uses your own products and prices.</small></div>
                                <div class="field full"><label for="cl-email">Email <span class="opt">(optional)</span></label><input id="cl-email" name="email" type="email" autocomplete="email"></div>
                                <div class="field full"><label for="cl-notes">Anything we should know? <span class="opt">(optional)</span></label><textarea id="cl-notes" name="notes" placeholder="For example: most chats come in after 9pm"></textarea></div>
                                <div class="hp" aria-hidden="true"><label>Website URL <input type="text" name="url_hp" tabindex="-1" autocomplete="off"></label></div>
                                <input type="hidden" name="_subject" value="New 41 Closer lead (ad landing page)">
                            </div>
                            <p class="consent">After you book, our AI Closer will message you on WhatsApp to confirm and prepare your demo. No spam, no lists.</p>
                            <div class="form-foot">
                                <button class="link-back" id="cl-back" type="button">&larr; Back</button>
                                <button class="btn btn-primary" id="cl-submit" type="submit">Get my free demo <span class="arrow">&rarr;</span></button>
                            </div>
                        </div>
                    </div>

                    <div id="cl-step2" hidden>
                        <div id="cl-book" hidden>
                            <span class="ok-badge">&#10003; You qualify</span>
                            <h3>Pick a time for your free demo.</h3>
                            <p>20 minutes on Google Meet with Alexander. Our AI Closer will WhatsApp you to confirm and ask a few questions so we come prepared.</p>
                            <div id="cl-cal"></div>
                            <ol class="next-steps">
                                <li><b>Our AI Closer WhatsApps you</b> to confirm the time and ask two quick questions, so Alexander comes prepared.</li>
                                <li><b>We run your leak audit</b> before the call: we message your business like a customer and time the reply.</li>
                                <li><b>20 minutes on Google Meet.</b> Your numbers, your audit result, and the Closer handling an enquiry like yours.</li>
                            </ol>
                            <div id="cl-cal-fallback" hidden>
                                <p>Thanks, <span class="cl-first"></span>. We'll WhatsApp you within one working hour to lock in a time.</p>
                                <a class="btn btn-ghost" href="https://wa.me/6580124848?text=Hi%2C%20I%20just%20asked%20for%20the%20free%2041%20Closer%20demo.%20When%20can%20we%20talk%3F">Or message us now</a>
                            </div>
                        </div>
                        <div id="cl-notyet" hidden>
                            <h3>Thanks, <span class="cl-first"></span>.</h3>
                            <p>From your answers, a demo may not be worth your time yet. We'll look at your details and WhatsApp you within one working day either way.</p>
                        </div>
                    </div>
                </form>'''

def replace_block(s, start, end, new):
    a = s.index(start); b = s.index(end, a) + len(end)
    return s[:a] + new + s[b:]

def build(page, hero_chat=True, seen=False, proof=False):
    p = os.path.join(ROOT, page); s = open(p).read()
    s = replace_block(s, '<form id="cl-form"', '</form>', FORM)
    if hero_chat:
        s = replace_block(s, '<!-- WA-HERO -->', '<!-- /WA-HERO -->', '<!-- WA-HERO -->' + HERO_CHAT + '<!-- /WA-HERO -->')
    if seen:
        s = replace_block(s, '<!-- SEEN -->', '<!-- /SEEN -->', '<!-- SEEN -->\n            ' + SEEN + '\n            <!-- /SEEN -->')
    if proof:
        s = replace_block(s, '<!-- PROOF-CHATS -->', '<!-- /PROOF-CHATS -->', '<!-- PROOF-CHATS -->\n            ' + proof_cards() + '\n            <!-- /PROOF-CHATS -->')
    open(p, 'w').write(s)
    print('built', page)

if __name__ == '__main__':
    build('ai-closer.html', seen=True, proof=True)
    build('ai-closer-sf.html')
