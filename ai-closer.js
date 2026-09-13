// Shared funnel logic for /ai-closer (long form) and /ai-closer-sf (short form).
// Two-step form (contact details first, then the qualifying questions), qualify via
// closer-qualify.js,
// lead to /api/closer-lead + Formspree copy, Pixel Lead / Schedule, calendar step.
//
// Calendar for qualified leads. Set ONE of, before this script loads or here:
//   Google Calendar appointment schedule embed URL (Share > Website embed > iframe src)
//   or a Cal.com link like '41labs/closer-call'.
// Empty = qualified leads see the WhatsApp fallback.
window.BOOKING_URL = window.BOOKING_URL || '';

(function () {
    // ---- Attribution: keep the ad's UTMs and fbclid for this visit ----
    var KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];
    var params = new URLSearchParams(location.search);
    var attr = {};
    try { attr = JSON.parse(sessionStorage.getItem('cl_attr') || '{}'); } catch (e) {}
    KEYS.forEach(function (k) { if (params.get(k)) attr[k] = params.get(k); });
    try { sessionStorage.setItem('cl_attr', JSON.stringify(attr)); } catch (e) {}

    var variant = document.body.getAttribute('data-variant') || 'long';
    function track(name, p) { try { if (window.track41) window.track41(name, p || {}); } catch (e) {} }
    // opts carries { eventID } so the same conversion sent server-side by
    // api/closer-lead.js is deduped instead of double counted.
    function pixel(name, p, opts) { try { if (window.fbq) window.fbq('track', name, p || {}, opts || {}); } catch (e) {} }

    // ---- Booking complete (called by the Cal.com embed; Google bookings are synced server-side) ----
    window.onCloserBooked = function () {
        pixel('Schedule', { content_name: 'ai_closer_call', variant: variant });
        track('book_call_complete', { event_category: 'conversion', cta_id: 'ai_closer', variant: variant });
    };

    var form = document.getElementById('cl-form');
    if (form) initForm(form);

    function initForm(form) {
        var part1 = document.getElementById('cl-part1');
        var part2 = document.getElementById('cl-part2');
        var next = document.getElementById('cl-next');
        var back = document.getElementById('cl-back');
        var jobsError = document.getElementById('cl-jobs-error');
        var tabs = document.querySelectorAll('.cl-tab');

        function setTab(n) { tabs.forEach(function (t, i) { t.classList.toggle('on', i === n - 1); }); }

        // Step 1 is now their DETAILS, step 2 the qualifying questions. Reversed
        // deliberately: once we hold a WhatsApp number, someone who abandons the
        // qualifying questions is still a lead we can message, not an anonymous bounce.
        var partialId = '';      // Twenty opportunity created from step 1, updated on submit

        function validPart1() {
            var ok = true;
            part1.querySelectorAll('input[required]').forEach(function (el) {
                if (ok && !el.checkValidity()) { el.reportValidity(); ok = false; }
            });
            return ok;
        }
        // "random words" get typed here constantly. A real domain or nothing: we build
        // the preview off this, so a bad value costs us a build, not just a bad record.
        var WEBSITE_RE = /^(https?:\/\/)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,24}(\/\S*)?$/i;
        function cleanWebsite(v) {
            // Trim the edges and a stray leading @ only. NEVER strip inner spaces:
            // "tan aircon .sg" would become "tanaircon.sg", a domain they never typed
            // and possibly someone else's.
            return String(v || '').trim().replace(/^@+/, '');
        }
        function validWebsite() {
            var el = document.getElementById('cl-website');
            var err = document.getElementById('cl-website-error');
            if (!el) return true;
            var v = cleanWebsite(el.value);
            if (v && v !== el.value) el.value = v;        // tidy it in place rather than scold them
            var ok = WEBSITE_RE.test(v);
            if (err) err.hidden = ok;
            el.setAttribute('aria-invalid', ok ? 'false' : 'true');
            if (!ok) el.focus({ preventScroll: false });
            return ok;
        }

        function validPart2() {
            var ok = validWebsite();
            if (!ok) return false;
            part2.querySelectorAll('select[required], input[required]').forEach(function (el) {
                if (ok && el.id !== 'cl-website' && !el.checkValidity()) { el.reportValidity(); ok = false; }
            });
            if (ok && !form.querySelector('input[name="challenges"]:checked')) {
                jobsError.hidden = false;
                document.getElementById('cl-jobs').scrollIntoView({ behavior: 'smooth', block: 'center' });
                ok = false;
            }
            return ok;
        }
        function goPart2() {
            if (!validPart1()) return;
            part1.hidden = true; part2.hidden = false; setTab(2);
            track('form_step', { step: 2, cta_id: 'ai_closer', variant: variant });

            // Capture the contact now, before the questions they might abandon.
            var fd = new FormData(form);
            var partial = { partial: true, variant: variant, name: fd.get('name') || '',
                            email: fd.get('email') || '', whatsapp: fd.get('whatsapp') || '' };
            Object.keys(attr).forEach(function (k) { partial[k] = attr[k]; });
            if (window.cl41) partial.journey = window.cl41.journey();
            fetch('/api/closer-lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(partial) })
                .then(function (r) { return r.json(); })
                .then(function (j) { if (j && j.id) partialId = j.id; })
                .catch(function () {});
            if (window.cl41) window.cl41.mark('form_contact_captured', { variant: variant });

            var first = part2.querySelector('select, input');
            if (first) first.focus({ preventScroll: true });
        }
        if (next) next.addEventListener('click', goPart2);
        if (back) back.addEventListener('click', function () { part2.hidden = true; part1.hidden = false; setTab(1); });

        var websiteEl = document.getElementById('cl-website');
        if (websiteEl) websiteEl.addEventListener('input', function () {
            var err = document.getElementById('cl-website-error');
            if (err && !err.hidden && WEBSITE_RE.test(cleanWebsite(websiteEl.value))) err.hidden = true;
        });

        form.addEventListener('change', function (e) {
            if (e.target && e.target.name === 'challenges' && form.querySelector('input[name="challenges"]:checked')) jobsError.hidden = true;
        });

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            if (part2.hidden) { goPart2(); return; }          // Enter pressed on step 1
            if (!validPart1()) { part2.hidden = true; part1.hidden = false; setTab(1); return; }
            if (!validPart2()) return;

            var fd = new FormData(form);
            var data = {};
            fd.forEach(function (v, k) { if (k !== 'challenges') data[k] = v; });
            data.challenges = fd.getAll('challenges');
            data.variant = variant;
            if (partialId) data.opportunityId = partialId;   // update the step 1 record, never duplicate it
            var answers = { enquiries: data.enquiries, saleValue: data.saleValue, challenges: data.challenges, goal: data.goal };

            // qualify41 returns { qualified, tier, reason } (or a bare boolean). Fail open to the calendar.
            var fit = { qualified: true, tier: 'B', reason: '' };
            try {
                var r = typeof window.qualify41 === 'function' ? window.qualify41(answers) : true;
                fit = (r && typeof r === 'object') ? r : { qualified: !!r, tier: r ? 'B' : 'C', reason: '' };
            } catch (err) {}
            var qualified = !!fit.qualified;
            data.qualified = qualified ? 'yes' : 'no';
            data.tier = fit.tier || (qualified ? 'B' : 'C');
            data.fitReason = fit.reason || '';
            Object.keys(attr).forEach(function (k) { data[k] = attr[k]; });

            // One id for this submit, sent to BOTH the browser pixel and our server.
            // Without it Meta counts the pixel Lead and the Conversions API Lead as
            // two conversions and every cost-per-lead number halves. See api/_lib/meta-capi.js.
            var cl = window.cl41;
            data.eventId = (cl && cl.newEventId ? cl.newEventId() : 'lead_' + Date.now());
            if (cl) {
                var ids = cl.ids();
                data.fbp = ids.fbp;
                data.fbc = ids.fbc;
                data.journey = cl.journey();
                cl.mark('lead_submitted', { tier: data.tier, qualified: data.qualified });
            }

            // CRM record (server-side) and the Formspree email copy, both best-effort.
            fetch('/api/closer-lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).catch(function () {});
            var copy = new FormData(form);
            ['qualified', 'tier', 'variant'].forEach(function (k) { copy.append(k, data[k]); });
            copy.append('fit_reason', data.fitReason);
            Object.keys(attr).forEach(function (k) { copy.append(k, attr[k]); });
            fetch(form.action, { method: 'POST', body: copy, headers: { 'Accept': 'application/json' } }).catch(function () {});

            pixel('Lead', { content_name: 'ai_closer_form', qualified: data.qualified, tier: data.tier, variant: variant }, { eventID: data.eventId });
            track('generate_lead', { event_category: 'conversion', cta_id: 'ai_closer', qualified: data.qualified, tier: data.tier, variant: variant });

            var first = (data.name || '').trim().split(/\s+/)[0] || 'there';
            document.querySelectorAll('.cl-first').forEach(function (el) { el.textContent = first; });
            document.getElementById('cl-step1').hidden = true;
            document.getElementById('cl-step2').hidden = false;
            document.getElementById(qualified ? 'cl-book' : 'cl-notyet').hidden = false;
            if (qualified) showCalendar(data);
            var anchor = document.getElementById('qualify') || form;
            anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    // Qualified only. The handoff to our own AI Closer is deliberately shown AFTER the
    // calendar: the booking is the commitment, the WhatsApp conversation is what keeps
    // them warm until the call. Leads who did not qualify never see it.
    // Labels for the prefilled first message. The visitor sends it themselves, which
    // is the whole point: an inbound message opens WhatsApp's 24-hour service window,
    // so the Closer can just talk. No approved template, no server-to-server send.
    var SAY_ENQ = { under20: 'under 20', '20to50': '20 to 50', '50to150': '50 to 150', '150plus': 'over 150' };
    var SAY_SALE = { under500: 'under S$500', '500to2k': 'S$500 to S$2,000', '2kto10k': 'S$2,000 to S$10,000', '10kplus': 'over S$10,000' };
    var SAY_CHALLENGE = { slow: 'replies take too long', afterhours: 'nobody answers after hours',
        followup: 'we forget to follow up', stock: 'checking stock or prices is slow',
        quotes: 'quoting takes too long', volume: 'too many enquiries to handle' };
    var SAY_GOAL = { recover: 'stop losing enquiries we already paid for', faster: 'reply and quote faster',
        scale: 'handle more enquiries without hiring', freeteam: 'free the team from repetitive chats',
        unsure: 'see what it can do' };

    // Everything they just typed, in their own words, so the Closer never asks twice.
    function handoffMessage(data) {
        var first = (data.name || '').trim().split(/\s+/)[0];
        var lines = ['Hi, I just asked for a free 41 Closer demo on your site.'];
        if (first) lines.push('I am ' + first + (data.website ? ' from ' + data.website : '') + '.');
        else if (data.website) lines.push('My site is ' + data.website + '.');

        var vol = SAY_ENQ[data.enquiries], sale = SAY_SALE[data.saleValue];
        if (vol || sale) {
            lines.push('We get ' + (vol || 'a number of') + ' WhatsApp enquiries a week'
                + (sale ? ', average sale ' + sale : '') + '.');
        }
        var pains = (data.challenges || []).map(function (c) { return SAY_CHALLENGE[c]; }).filter(Boolean);
        if (pains.length) lines.push('What costs us most: ' + pains.join(', ') + '.');
        if (SAY_GOAL[data.goal]) lines.push('What I want: ' + SAY_GOAL[data.goal] + '.');
        lines.push('Can we set up a time to go through it?');
        return lines.join('\n');
    }

    // Qualified only. Shown AFTER the calendar: the booking is the commitment, the
    // WhatsApp conversation is what keeps them warm until the call.
    function showHandoff(data) {
        var box = document.getElementById('cl-handoff');
        if (!box) return;
        var link = document.getElementById('cl-wa-handoff');
        if (link) {
            link.href = 'https://wa.me/6580124848?text=' + encodeURIComponent(handoffMessage(data));
            link.addEventListener('click', function () {
                track('closer_handoff_click', { event_category: 'conversion', tier: data.tier, variant: variant });
                if (window.cl41) window.cl41.mark('closer_handoff_click', { tier: data.tier });
            });
        }
        box.hidden = false;
    }

    function showCalendar(data) {
        var url = (window.BOOKING_URL || '').trim();
        var holder = document.getElementById('cl-cal');
        var head = document.getElementById('cl-cal-head');
        showHandoff(data);
        // No calendar configured is fine now: the Closer books the call in chat, so
        // the page never has to apologise for an empty slot.
        if (!url) {
            if (holder) holder.hidden = true;
            if (head) head.hidden = true;
            return;
        }
        if (head) head.hidden = false;

        if (/^https:\/\/calendar\.google\.com\//.test(url)) {
            var f = document.createElement('iframe');
            f.src = url;
            f.title = 'Book your call with Alexander';
            f.loading = 'lazy';
            holder.appendChild(f);
            return;
        }

        var CAL_LINK = url.replace(/^https:\/\/cal\.com\//, '');
        (function (C, A, L) { var p = function (a, ar) { a.q.push(ar); }; var d = C.document; C.Cal = C.Cal || function () { var cal = C.Cal; var ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement('script')).src = A; cal.loaded = true; } if (ar[0] === L) { var api = function () { p(api, arguments); }; var namespace = ar[1]; api.q = api.q || []; if (typeof namespace === 'string') { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ['initNamespace', namespace]); } else p(cal, ar); return; } p(cal, ar); }; })(window, 'https://app.cal.com/embed/embed.js', 'init');
        Cal('init', { origin: 'https://cal.com' });
        Cal('inline', {
            elementOrSelector: '#cl-cal',
            calLink: CAL_LINK,
            config: {
                layout: 'month_view',
                name: data.name || '',
                email: data.email || '',
                notes: ['Website: ' + (data.website || ''), 'Enquiries/week: ' + data.enquiries, 'Avg sale: ' + data.saleValue, 'WhatsApp: ' + data.whatsapp].join(' | ')
            }
        });
        Cal('on', { action: 'bookingSuccessful', callback: function () { window.onCloserBooked(); } });
    }

    // ---- Leak calculator (long form only) ----
    var calc = document.getElementById('leak-calc');
    if (calc) {
        var money = function (n) { return 'S$' + Math.round(n).toLocaleString('en-SG'); };
        var update = function () {
            var enq = +calc.querySelector('[name=lc-enq]').value || 0;
            var late = (+calc.querySelector('[name=lc-late]').value || 0) / 100;
            var sale = +calc.querySelector('[name=lc-sale]').value || 0;
            var close = (+calc.querySelector('[name=lc-close]').value || 0) / 100;
            var lostPerMonth = enq * 4.3 * late * close * sale;
            calc.querySelector('[data-out=late]').textContent = Math.round(enq * 4.3 * late);
            calc.querySelector('[data-out=lost]').textContent = money(lostPerMonth);
            calc.querySelector('[data-out=year]').textContent = money(lostPerMonth * 12);
        };
        calc.addEventListener('input', update);
        update();
    }

    // ---- Hero WhatsApp screens: industry tabs + play-in with "typing..." ----
    function playChat(live) {
        if (!live) return;
        var msgs = live.querySelectorAll('.wa-msg');
        var status = live.querySelector('.wa-status-line');
        var idle = 'online';
        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (live.dataset.played === '1' || reduce) {
            msgs.forEach(function (m) { m.classList.add('show'); });
            if (status) status.textContent = idle;
            return;
        }
        live.dataset.played = '1';
        var t = 400;
        msgs.forEach(function (m) {
            var business = m.classList.contains('wa-in');
            if (business && status) { setTimeout(function () { status.textContent = 'typing...'; }, t); t += 1000; }
            setTimeout(function () { m.classList.add('show'); if (status) status.textContent = idle; }, t);
            t += business ? 850 : 1200;
        });
    }

    var tabs = document.querySelectorAll('.wa-tab');
    var slots = document.querySelectorAll('.wa-slot');
    tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            var key = tab.getAttribute('data-chat');
            tabs.forEach(function (t) { t.classList.toggle('on', t === tab); });
            slots.forEach(function (sl) {
                var on = sl.getAttribute('data-chat') === key;
                sl.hidden = !on;
                sl.classList.toggle('on', on);
                if (on) playChat(sl.querySelector('.wa-live'));
            });
            track('hero_chat_switch', { industry: key, cta_id: 'ai_closer' });
        });
    });
    playChat(document.querySelector('.wa-slot:not([hidden]) .wa-live') || document.querySelector('.wa-live'));
    document.querySelectorAll('.wa:not(.wa-live) .wa-msg').forEach(function (m) { m.classList.add('show'); });

    // ---- Reveal on scroll ----
    if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in-view'); io.unobserve(en.target); } });
        }, { threshold: 0.1 });
        document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
    } else {
        document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in-view'); });
    }

    // ---- Sticky mobile CTA: show after the hero, hide while the form is on screen ----
    var sticky = document.getElementById('sticky');
    var hero = document.querySelector('.hero');
    var qualifyEl = document.getElementById('qualify') || form;
    if (sticky && hero && qualifyEl) {
        window.addEventListener('scroll', function () {
            var q = qualifyEl.getBoundingClientRect();
            var atForm = q.top < window.innerHeight && q.bottom > 0;
            sticky.classList.toggle('show', window.scrollY > hero.offsetHeight * 0.8 && !atForm);
        }, { passive: true });
    }
})();
