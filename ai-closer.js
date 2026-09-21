// Shared funnel logic for /ai-closer (long form) and /ai-closer-sf (short form).
// Two-step form (contact details first, then the qualifying questions), qualify via
// closer-qualify.js,
// lead to /api/closer-lead + Formspree copy, Pixel Lead / Schedule, calendar step.
//
// Booking for qualified leads: Cal.com, event type "41 Closer" (30 min).
// Deliberately NOT a Google appointment schedule. Google's iframe is cross-origin and
// gives no booking callback, no prefill and no way to pass an identifier through, which
// forced a polling endpoint, email matching in the cron, and asking people for details
// they had already typed. Cal.com fires bookingSuccessful, prefills from what we know,
// and carries the deal id through as metadata, so the match is exact.
window.BOOKING_URL = window.BOOKING_URL || 'alexander-lee-41labs/closer-call';

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

    // ---- Meta conversions: every event fires on BOTH sides with one id ----
    // Contract: 41closer-marketing/ads/2026-09-batch/CONVERSION-TRACKING-SPEC.md.
    // The pixel dies to ad blockers and iOS; the server copy survives. Sharing the id is
    // what stops Meta counting the same conversion twice and halving every cost figure.
    var lastLead = {};                     // what we know about them, for advanced matching
    function metaEvent(name, extra, forcedId) {
        var cl = window.cl41;
        var id = forcedId || (cl && cl.newEventId ? cl.newEventId() : name + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));
        var ids = cl ? cl.ids() : { fbp: '', fbc: '' };
        pixel(name, extra || {}, { eventID: id });
        try {
            fetch('/api/meta-event', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
                body: JSON.stringify({
                    name: name, eventId: id, sourceUrl: location.origin + location.pathname,
                    fbp: ids.fbp, fbc: ids.fbc, fbclid: attr.fbclid || '',
                    email: lastLead.email || '', phone: lastLead.whatsapp || '',
                    fullName: lastLead.name || '', tier: lastLead.tier || '',
                }),
            }).catch(function () {});
        } catch (e) {}
        return id;
    }

    // Booking confirmed in the browser. Google bookings never reach this, so they are
    // caught server-side by api/cron/booking-sync.js instead.
    var bookedAlready = false;
    window.onCloserBooked = function (sharedId) {
        if (bookedAlready) return;      // Cal.com can fire its callback more than once
        bookedAlready = true;
        metaEvent('Schedule', { content_name: 'ai_closer_call', variant: variant }, sharedId);
        track('book_call_complete', { event_category: 'conversion', cta_id: 'ai_closer', variant: variant });
    };

    // Best effort only. Google does not document a booking message from the appointment
    // iframe, so this may never fire. If it ever does, we get the browser-side Schedule
    // and can deduplicate it against the cron's copy. The cron is the one we rely on.
    window.addEventListener('message', function (e) {
        if (!/^https:\/\/calendar\.google\.com$/.test(e.origin)) return;
        var body = typeof e.data === 'string' ? e.data : JSON.stringify(e.data || '');
        if (/book|confirm|scheduled/i.test(body)) window.onCloserBooked();
    });

    // They reached the demo and stayed on it. Engagement, no value.
    (function viewContentOnce() {
        var demo = document.querySelector('.vbox') || document.getElementById('proof-2');
        if (!demo || !('IntersectionObserver' in window)) return;
        var fired = false;
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (fired || !en.isIntersecting) return;
                fired = true; io.disconnect();
                setTimeout(function () { metaEvent('ViewContent', { content_name: 'ai_closer_demo', variant: variant }); }, 3000);
            });
        }, { threshold: 0.5 });
        io.observe(demo);
    })();

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

        // A typo'd email or a made-up number costs us the lead silently: the demo is built
        // and sent nowhere. type="email" only checks for an @, so these go further.
        var EMAIL_RE = /^[^\s@,;:<>()\[\]\\]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,24}$/i;
        // Throwaway inboxes: they will never read the confirmation, so the build is wasted.
        var BURNER = /(^|\.)(mailinator|guerrillamail|10minutemail|tempmail|temp-mail|yopmail|trashmail|sharklasers|dispostable|maildrop|throwaway|fakeinbox|getnada)\./i;
        // The common near-misses. We suggest rather than reject: they might be real.
        var TYPOS = { 'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmail.co': 'gmail.com',
            'gmail.con': 'gmail.com', 'hotmial.com': 'hotmail.com', 'hotmail.co': 'hotmail.com',
            'yahooo.com': 'yahoo.com', 'yaho.com': 'yahoo.com', 'outlok.com': 'outlook.com' };

        function fieldError(id, msg) {
            var el = document.getElementById(id);
            var err = document.getElementById(id + '-error');
            if (err) { err.textContent = msg || ''; err.hidden = !msg; }
            if (el) el.setAttribute('aria-invalid', msg ? 'true' : 'false');
            if (msg && el) el.focus({ preventScroll: false });
            return !msg;
        }

        function validEmail() {
            var el = document.getElementById('cl-email');
            if (!el) return true;
            var v = el.value.trim().replace(/^mailto:/i, '');
            if (v !== el.value) el.value = v;
            if (!EMAIL_RE.test(v)) return fieldError('cl-email', 'That email does not look right. Check for a typo.');
            var domain = v.split('@')[1].toLowerCase();
            if (BURNER.test(domain + '.')) return fieldError('cl-email', 'Please use an email you actually read. Your demo goes there.');
            if (TYPOS[domain]) return fieldError('cl-email', 'Did you mean ' + v.split('@')[0] + '@' + TYPOS[domain] + '?');
            return fieldError('cl-email', '');
        }

        // Singapore mobiles are 8 digits starting 8 or 9. Anything else has to look like a
        // real international number, and obvious filler (11111111, 12345678) is refused.
        function validPhone() {
            var el = document.getElementById('cl-whatsapp');
            if (!el) return true;
            var raw = el.value.trim().replace(/[\s()\-.]/g, '');
            if (raw !== el.value) el.value = raw;
            if (!/^\+?\d+$/.test(raw)) return fieldError('cl-whatsapp', 'Digits only, with the country code if you are outside Singapore.');
            var digits = raw.replace(/^\+/, '');
            if (/^65/.test(digits) && digits.length === 10) digits = digits.slice(2);
            if (digits.length === 8 && !/^[89]/.test(digits)) {
                return fieldError('cl-whatsapp', 'A Singapore mobile starts with 8 or 9.');
            }
            if (digits.length < 8 || digits.length > 15) {
                return fieldError('cl-whatsapp', 'That number looks too ' + (digits.length < 8 ? 'short' : 'long') + '. Include the country code.');
            }
            if (/^(\d)\1+$/.test(digits) || /^(012345678|123456789|12345678)/.test(digits)) {
                return fieldError('cl-whatsapp', 'That is not a real number. Your Closer messages you here.');
            }
            return fieldError('cl-whatsapp', '');
        }

        function validPart1() {
            // Our own checks run FIRST. The browser's native email bubble fires on things
            // like "wm at tanaircon.sg" and replaces our message with a generic one, so the
            // visitor gets a different explanation depending on how wrong they were.
            var ok = true;
            part1.querySelectorAll('input[required]').forEach(function (el) {
                if (ok && el.id !== 'cl-email' && el.id !== 'cl-whatsapp' && !el.checkValidity()) {
                    el.reportValidity(); ok = false;
                }
            });
            if (!ok) return false;
            if (!document.getElementById('cl-email').value.trim()) return fieldError('cl-email', 'We need an email to send your demo to.');
            if (!document.getElementById('cl-whatsapp').value.trim()) return fieldError('cl-whatsapp', 'We need a number for your Closer to message.');
            return validEmail() && validPhone();
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

        [['cl-email', validEmail], ['cl-whatsapp', validPhone]].forEach(function (pair) {
            var el = document.getElementById(pair[0]);
            if (!el) return;
            el.addEventListener('input', function () {
                var err = document.getElementById(pair[0] + '-error');
                if (err && !err.hidden) pair[1]();
            });
        });

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
            lastLead = { name: data.name, email: data.email, whatsapp: data.whatsapp, tier: data.tier };
            data.eventId = (cl && cl.newEventId ? cl.newEventId() : 'lead_' + Date.now());
            if (cl) {
                var ids = cl.ids();
                data.fbp = ids.fbp;
                data.fbc = ids.fbc;
                data.journey = cl.journey();
                cl.mark('lead_submitted', { tier: data.tier, qualified: data.qualified });
            }

            // CRM record, server-side. The email copy is sent from there too.
            // The deal id is what makes the booking match exactly instead of being guessed
            // at by email, so the calendar waits for it. Capped at 2.5s: a visitor staring
            // at a blank slot is worse than a booking we have to match by hand.
            var dealReady = new Promise(function (resolve) {
                var done = false;
                var finish = function () { if (!done) { done = true; resolve(); } };
                setTimeout(finish, 2500);
                fetch('/api/closer-lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
                    .then(function (r) { return r.json(); })
                    .then(function (j) { if (j && j.id) data.opportunityId = j.id; })
                    .catch(function () {})
                    .then(finish);
            });

            pixel('Lead', { content_name: 'ai_closer_form', qualified: data.qualified, tier: data.tier, variant: variant }, { eventID: data.eventId });
            track('generate_lead', { event_category: 'conversion', cta_id: 'ai_closer', qualified: data.qualified, tier: data.tier, variant: variant });

            var first = (data.name || '').trim().split(/\s+/)[0] || 'there';
            document.querySelectorAll('.cl-first').forEach(function (el) { el.textContent = first; });
            document.getElementById('cl-step1').hidden = true;
            document.getElementById('cl-step2').hidden = false;
            document.getElementById(qualified ? 'cl-book' : 'cl-notyet').hidden = false;
            if (qualified) {
                dealReady.then(function () { showCalendar(data); });
            }
            var anchor = document.getElementById('qualify') || form;
            anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    function showCalendar(data) {
        var url = (window.BOOKING_URL || '').trim();
        var holder = document.getElementById('cl-cal');
        var head = document.getElementById('cl-cal-head');
        // Show it straight away. Google's appointment iframe is cross-origin and gives
        // the page no booking callback, so waiting for one leaves the visitor staring at
        // an unchanged screen after they book. Bookings are caught server-side instead,
        // by api/cron/booking-sync.js.
        // No calendar configured: say we will come back with times rather than leaving
        // the visitor staring at an empty slot.
        if (!url) {
            if (holder) holder.hidden = true;
            if (head) head.hidden = true;
            var fb = document.getElementById('cl-cal-fallback');
            if (fb) fb.hidden = false;
            return;
        }
        if (head) head.hidden = false;
        // The early optimisation proxy: enough volume on day one to train the ad set
        // before Schedule reaches the ~15-25 a week it needs.
        metaEvent('InitiateCheckout', { content_name: 'ai_closer_calendar', variant: variant });
        track('open_calendar', { event_category: 'conversion', cta_id: 'ai_closer', variant: variant });

        var CAL_LINK = url.replace(/^https:\/\/cal\.com\//, '');
        (function (C, A, L) { var p = function (a, ar) { a.q.push(ar); }; var d = C.document; C.Cal = C.Cal || function () { var cal = C.Cal; var ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement('script')).src = A; cal.loaded = true; } if (ar[0] === L) { var api = function () { p(api, arguments); }; var namespace = ar[1]; api.q = api.q || []; if (typeof namespace === 'string') { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ['initNamespace', namespace]); } else p(cal, ar); return; } p(cal, ar); }; })(window, 'https://app.cal.com/embed/embed.js', 'init');
        Cal('init', { origin: 'https://cal.com' });
        Cal('inline', {
            elementOrSelector: '#cl-cal',
            calLink: CAL_LINK,
            config: {
                layout: 'month_view',
                // Prefilled, so they never retype what they just gave us and the booking
                // email can never drift from the one on the deal.
                name: data.name || '',
                email: data.email || '',
                // Carried through to the webhook: the exact deal this booking belongs to.
                'metadata[opportunityId]': data.opportunityId || '',
                'metadata[tier]': data.tier || '',
                'metadata[utm_content]': attr.utm_content || '',
                notes: ['Website: ' + (data.website || ''), 'Enquiries/week: ' + (data.enquiries || ''), 'Avg sale: ' + (data.saleValue || ''), 'WhatsApp: ' + (data.whatsapp || '')].join(' | ')
            }
        });
        // Use the SAME key api/cron/booking-sync.js will send for this deal, or Meta
        // counts one booked call twice. With no deal id we stay quiet and let the cron
        // send it: a second id here is worse than a few minutes of delay there.
        Cal('on', { action: 'bookingSuccessful', callback: function () {
            if (!data.opportunityId) return;
            window.onCloserBooked('schedule_' + data.opportunityId);
        } });
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
    function showChat(key) {
        tabs.forEach(function (t) { t.classList.toggle('on', t.getAttribute('data-chat') === key); });
        slots.forEach(function (sl) {
            var on = sl.getAttribute('data-chat') === key;
            sl.hidden = !on;
            sl.classList.toggle('on', on);
            if (on) playChat(sl.querySelector('.wa-live'));
        });
    }
    tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            var key = tab.getAttribute('data-chat');
            showChat(key);
            // Only a real click is reported. Picking the chat for them below is not a choice.
            track('hero_chat_switch', { industry: key, cta_id: 'ai_closer' });
        });
    });

    // Open on the conversation that matches the ad they came from. Everyone used to see
    // the Aircon chat first; cold_carrental, the best ad in the account, sent two car
    // rental owners to an aircon conversation. Ads with no matching chat keep the default.
    var AD_CHAT = { cold_carrental: 'car', cold_reno: 'renovation', cold_clinic: 'clinic' };
    var fromAd = '';
    try { fromAd = new URLSearchParams(location.search).get('utm_content') || attr.utm_content || ''; } catch (e) {}
    var matched = AD_CHAT[fromAd];
    if (matched && document.querySelector('.wa-tab[data-chat="' + matched + '"]')) {
        showChat(matched);
    } else {
        playChat(document.querySelector('.wa-slot:not([hidden]) .wa-live') || document.querySelector('.wa-live'));
    }
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
