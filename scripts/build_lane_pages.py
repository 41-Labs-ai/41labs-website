"""Builds one pre-rendered landing page per ad lane from ai-closer.html.

Why pre-rendered and not swapped in the browser: a visitor who clicks a fleet ad must
never see the generic headline first and watch it change. That reads as broken on a
phone, which is the opposite of what the page is for.

Every lane keeps the base page's scripts, section ids and form, so GA, the Meta pixel,
closer-analytics and the utm chain behave exactly as they do on /ai-closer.

What is NOT swapped, on purpose: the three hero numbers and the "Where the money leaks"
section. Those are measured from real businesses and sourced on the page. A lane page
may use the lane's language, never a number we have not measured for that lane.

Run: python3 scripts/build_lane_pages.py   (idempotent, rebuilds from the base each time)
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, 'ai-closer.html')
CANONICAL = 'https://41labs.ai/ai-closer'

LANES = {
    'fleet': {
        'ads': ['cold_fleet', 'cold_carrental', 'cold_dealership',
                'cold_lane_fleet_doublebook', 'cold_lane_carrental_afterhours'],
        'chat': 'car',
        'title': 'See What an AI Sales Team Would Do for Your Fleet | 41 Closer',
        'aud': ('Not just a chatbot &middot; for Singapore rental yards, fleets and dealers, '
                'where customers ask what is free and book over WhatsApp'),
        'h1': 'Every booking request answered, checked and confirmed.<br><span class="hl">Even at 2am.</span>',
        'sub': ('We build it on your own vehicle list, connect it to your rates and your calendar, '
                'and run it for you.'),
        'vbox': 'See it work: a Saturday booking request, handled on WhatsApp in minutes',
        'before': [
            'The 11pm booking request waits until morning',
            'By the time you reply they have booked another yard',
            'Two people promise the same vehicle on the same day',
            'Nobody knows which vehicle is out, or who has it',
            'Weekends and public holidays go unanswered',
            "You can't tell which chats turned into a booking",
            'More bookings means hiring another person',
        ],
        'after': [
            'Every booking request answered in seconds, day or night',
            'Availability checked against your own list before anything is promised',
            'One vehicle, one booking, confirmed inside the chat',
            'Rates and deposits quoted from your real price list',
            'Weekends covered without a roster',
            'Weekly numbers on what came in and what it booked',
            'More bookings without another hire, and we run it',
        ],
        'tiles': [
            ('Car rental &amp; dealers', 'Which vehicle is free, rates, deposits'),
            ('Limo &amp; PHV fleets', 'Airport runs, daily and monthly hire'),
            ('Lorry, van &amp; equipment hire', 'Availability, day rates, delivery'),
            ('Workshops &amp; servicing', 'Slots, loan cars, collection times'),
            ('Renovation &amp; interior design', 'Quotes and site visits over WhatsApp'),
            ('Clinics &amp; aesthetics', 'Enquiries after hours, bookings, packages'),
            ('Distributors &amp; suppliers', 'Stock, price and reorder questions'),
            ('Travel &amp; tours', 'Itineraries, quotes and deposits'),
        ],
        'fitnote': ('If customers message you on WhatsApp to ask what is available, what it costs '
                    'or to book a vehicle, and some of those chats get answered late or not at all, '
                    "this is for you. Whether that's 20 enquiries a week or 500."),
    },
}


def sub_once(html, pattern, replacement, what, flags=re.S):
    """Replace exactly one match, or stop. A silent miss ships a half-swapped page."""
    out, n = re.subn(pattern, lambda _m: replacement, html, count=1, flags=flags)
    if n != 1:
        sys.exit(f"build_lane_pages: could not place {what!r} (matched {n} times). "
                 "ai-closer.html changed; update the anchor in this script.")
    return out


def items(lis):
    return ''.join('\n<li>%s</li>' % x for x in lis) + '\n'


def build(slug, lane, base):
    h = base
    h = sub_once(h, r'<title>.*?</title>', '<title>%s</title>' % lane['title'], 'title')
    h = sub_once(h, r'<span class="aud">.*?</span>',
                 '<span class="aud">%s</span>' % lane['aud'], 'audience line')
    h = sub_once(h, r'<h1>.*?</h1>', '<h1>%s</h1>' % lane['h1'], 'headline')
    h = sub_once(h, r'<p class="hero-sub">.*?</p>',
                 '<p class="hero-sub">%s</p>' % lane['sub'], 'hero sub')
    h = sub_once(h, r'<div class="vbox-title">.*?</div>',
                 '<div class="vbox-title">%s</div>' % lane['vbox'], 'demo caption')

    # Open on the lane's conversation. The tabs stay, so a visitor can still switch.
    chat = lane['chat']
    h = sub_once(h, r'<button type="button" class="wa-tab on" data-chat="[a-z]+">',
                 '<button type="button" class="wa-tab" data-chat="servicing">', 'default tab off')
    h = sub_once(h, r'<button type="button" class="wa-tab" data-chat="%s">' % chat,
                 '<button type="button" class="wa-tab on" data-chat="%s">' % chat, 'lane tab on')
    h = sub_once(h, r'<div class="wa-slot on" data-chat="[a-z]+">',
                 '<div class="wa-slot" data-chat="servicing" hidden>', 'default slot off')
    h = sub_once(h, r'<div class="wa-slot" data-chat="%s"( hidden)?>' % chat,
                 '<div class="wa-slot on" data-chat="%s">' % chat, 'lane slot on')

    h = sub_once(h, r'(<div class="before"><h3>Before</h3><ul>).*?(</ul></div>)',
                 '<div class="before"><h3>Before</h3><ul>%s</ul></div>' % items(lane['before']), 'before list')
    h = sub_once(h, r'(<div class="after"><h3>After</h3><ul>).*?(</ul></div>)',
                 '<div class="after"><h3>After</h3><ul>%s</ul></div>' % items(lane['after']), 'after list')

    tiles = ''.join('\n<div class="tile"><b>%s</b><span>%s</span></div>' % t for t in lane['tiles'])
    h = sub_once(h, r'<div class="tiles">.*?</div>\s*(?=<p class="fitnote">)',
                 '<div class="tiles">%s\n</div>\n' % tiles, 'fit tiles')
    h = sub_once(h, r'<p class="fitnote">.*?</p>',
                 '<p class="fitnote">%s</p>' % lane['fitnote'], 'fit note')

    # One organic page, not several near-copies competing with each other.
    h = sub_once(h, r'</title>', '</title>\n<link rel="canonical" href="%s">' % CANONICAL, 'canonical')
    return h


def main():
    base = open(BASE, encoding='utf-8').read()
    for slug, lane in LANES.items():
        out = os.path.join(ROOT, 'ai-closer-%s.html' % slug)
        open(out, 'w', encoding='utf-8').write(build(slug, lane, base))
        print('wrote %s  (ads: %s)' % (os.path.basename(out), ', '.join(lane['ads'])))


if __name__ == '__main__':
    main()
