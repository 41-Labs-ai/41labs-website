// Shared funnel logic for /ai-closer (long form) and /ai-closer-sf (short form).
// Two-step form (details, then WhatsApp questions), ICP qualify (closer-qualify.js),
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
    function pixel(name, p) { try { if (window.fbq) window.fbq('track', name, p || {}); } catch (e) {} }

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

        function validPart1() {
            var ok = true;
            part1.querySelectorAll('input[required]').forEach(function (el) {
                if (ok && !el.checkValidity()) { el.reportValidity(); ok = false; }
            });
            return ok;
        }
        function goPart2() {
            if (!validPart1()) return;
            part1.hidden = true; part2.hidden = false; setTab(2);
            track('form_step', { step: 2, cta_id: 'ai_closer', variant: variant });
            var first = part2.querySelector('select, input');
            if (first) first.focus({ preventScroll: true });
        }
        if (next) next.addEventListener('click', goPart2);
        if (back) back.addEventListener('click', function () { part2.hidden = true; part1.hidden = false; setTab(1); });

        form.addEventListener('change', function (e) {
            if (e.target && e.target.name === 'jobs' && form.querySelector('input[name="jobs"]:checked')) jobsError.hidden = true;
        });

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            if (part2.hidden) { goPart2(); return; }          // Enter pressed on step 1
            if (!form.checkValidity()) { form.reportValidity(); return; }
            if (!form.querySelector('input[name="jobs"]:checked')) {
                jobsError.hidden = false;
                document.getElementById('cl-jobs').scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }

            var fd = new FormData(form);
            var data = {};
            fd.forEach(function (v, k) { if (k !== 'jobs') data[k] = v; });
            data.jobs = fd.getAll('jobs');
            data.variant = variant;
            var answers = { enquiries: data.enquiries, saleValue: data.saleValue, role: data.role, jobs: data.jobs };

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

            // CRM record (server-side) and the Formspree email copy, both best-effort.
            fetch('/api/closer-lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).catch(function () {});
            var copy = new FormData(form);
            ['qualified', 'tier', 'variant'].forEach(function (k) { copy.append(k, data[k]); });
            copy.append('fit_reason', data.fitReason);
            Object.keys(attr).forEach(function (k) { copy.append(k, attr[k]); });
            fetch(form.action, { method: 'POST', body: copy, headers: { 'Accept': 'application/json' } }).catch(function () {});

            pixel('Lead', { content_name: 'ai_closer_form', qualified: data.qualified, tier: data.tier, variant: variant });
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

    function showCalendar(data) {
        var url = (window.BOOKING_URL || '').trim();
        var holder = document.getElementById('cl-cal');
        if (!url) { holder.hidden = true; document.getElementById('cl-cal-fallback').hidden = false; return; }

        // Google Calendar appointment schedule: plain iframe. It can't tell the page when a
        // booking lands, so booked calls are picked up by the server-side booking sync.
        if (/^https:\/\/calendar\.google\.com\//.test(url)) {
            var f = document.createElement('iframe');
            f.src = url;
            f.title = 'Book your free demo with Alexander';
            f.loading = 'lazy';
            holder.appendChild(f);
            return;
        }

        // Cal.com: inline embed with prefill and a booking callback (fires Schedule).
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
                notes: [data.company, 'Enquiries/week: ' + data.enquiries, 'Avg sale: ' + data.saleValue, 'WhatsApp: ' + data.whatsapp].join(' | ')
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

    // ---- Hero chat plays in ----
    var msgs = document.querySelectorAll('.chat .msg');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    msgs.forEach(function (m, i) { if (reduce) m.classList.add('show'); else setTimeout(function () { m.classList.add('show'); }, 400 + i * 700); });

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
