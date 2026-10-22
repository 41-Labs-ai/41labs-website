// Free AI Salesperson Offer: page events, the three-step form and the booking calendar.
// GA4 goes through track.js (window.track41). Meta goes to the pixel AND our server with one
// event id, so Meta deduplicates and still counts the conversion when an ad blocker or iOS eats
// the pixel. The server half is api/meta-event.js and api/lead.js, which forward to the same
// 41labs.ai endpoints /ai-closer uses: the lead lands in Twenty, Alexander gets the alert, and
// the Cal.com booking carries the deal id so the booking cron sends the same Schedule key.
(function () {
    'use strict';
    var PAGE = window.PAGE_REF || 'free-ai-salesperson';
    var CAL_LINK = 'alexander-lee-41labs/closer-call';
    var q = new URLSearchParams(location.search);

    function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }

    // Which hero this visitor saw. ?v=b is the second ad; it sticks for the visit.
    var variant = q.get('v') === 'b' ? 'b' : q.get('v') === 'a' ? 'a' : (ss('fas_v') || 'a');
    ss('fas_v', variant);
    if (q.get('review') === '1') document.body.classList.add('review-on');

    // The ad's ids, kept for the visit. fbclid's landing time stands in for the click time.
    var KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];
    var attr = {};
    try { attr = JSON.parse(ss('fas_attr') || '{}'); } catch (e) { attr = {}; }
    KEYS.forEach(function (k) { if (q.get(k)) attr[k] = q.get(k); });
    if (q.get('fbclid')) attr.fbclid_ts = Date.now();
    ss('fas_attr', JSON.stringify(attr));

    function ga(name, p) {
        var base = { page_ref: PAGE, variant: variant };
        for (var k in (p || {})) base[k] = p[k];
        try { if (window.track41) window.track41(name, base); } catch (e) {}
    }
    function cookie(n) { var m = document.cookie.match('(?:^|; )' + n + '=([^;]*)'); return m ? decodeURIComponent(m[1]) : ''; }
    function metaIds() {
        var fbc = cookie('_fbc');
        if (!fbc && attr.fbclid) fbc = 'fb.1.' + (attr.fbclid_ts || Date.now()) + '.' + attr.fbclid;
        return { fbp: cookie('_fbp'), fbc: fbc };
    }
    function newId(n) { return n + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10); }
    function pixel(n, p, o) { try { if (window.fbq) window.fbq('track', n, p || {}, o || {}); } catch (e) {} }

    var lead = {};
    // Browser and server copies with one id. The value is never set here.
    function metaEvent(name, extra, forcedId) {
        var id = forcedId || newId(name);
        var ids = metaIds();
        pixel(name, extra, { eventID: id });
        try {
            fetch(window.META_API || '/api/meta-event', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
                body: JSON.stringify({
                    name: name, eventId: id, sourceUrl: location.origin + location.pathname,
                    fbp: ids.fbp, fbc: ids.fbc, fbclid: attr.fbclid || '',
                    email: lead.email || '', phone: lead.whatsapp || '', fullName: lead.name || ''
                })
            }).catch(function () {});
        } catch (e) {}
        return id;
    }

    // ---- Hero B for the second ad ----
    if (variant === 'b') {
        var bBtn = document.querySelector('.review [data-ab="b"]');
        if (bBtn) bBtn.click();
        else document.querySelectorAll('.hero .ab').forEach(function (el) { el.hidden = el.dataset.ab !== 'b'; });
    }

    // ---- Every button and link: where on the page it was ----
    function where(el) {
        if (el.closest('.review')) return '';
        if (el.closest('#exit')) return 'exit_offer';
        if (el.closest('#dsticky')) return 'sticky_desktop';
        if (el.closest('.sticky')) return 'sticky_mobile';
        if (el.closest('header.top')) return 'header';
        if (el.closest('.hero')) return 'hero';
        var band = el.closest('.cta-band');
        if (band) return 'band_' + (Array.prototype.indexOf.call(document.querySelectorAll('.cta-band'), band) + 1);
        if (el.closest('.pkg')) return 'package';
        if (el.closest('#book')) return 'final';
        var plan = el.closest('.pc');
        if (plan) { var b = plan.querySelector('.pc-h b'); return 'plan_' + (b ? b.textContent.trim().toLowerCase() : 'card'); }
        if (el.closest('.endcta')) return 'end';
        var sec = el.closest('section');
        var h = sec && sec.querySelector('h1, h2');
        return h ? h.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40) : 'other';
    }
    document.addEventListener('click', function (e) {
        var el = e.target && e.target.closest ? e.target.closest('a, button') : null;
        if (!el) return;
        var loc = where(el);
        if (!loc) return;
        if (el.closest('.seg')) { ga('pricing_period', { period: el.textContent.trim().slice(0, 30) }); return; }
        if (el.id === 'next1' || el.type === 'submit' || el.id === 'exit-no') return;
        var href = el.getAttribute('href') || '';
        var kind = /wa\.me/i.test(href) ? 'whatsapp' : /#book/.test(href) ? 'book' : /pricing/.test(href) ? 'pricing' : 'other';
        if (kind === 'other' && !href) return;
        ga('lp_click', { cta_id: loc, cta_kind: kind, link_text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) });
        if (kind === 'whatsapp') pixel('Contact', { content_name: PAGE, cta: loc, variant: variant }, { eventID: newId('contact') });
    });

    // ---- How far they read ----
    var marks = [25, 50, 75, 90], hit = {};
    window.addEventListener('scroll', function () {
        var d = document.documentElement, pct = (window.scrollY + window.innerHeight) / d.scrollHeight * 100;
        marks.forEach(function (m) { if (pct >= m && !hit[m]) { hit[m] = 1; ga('scroll_depth', { percent: m }); } });
    }, { passive: true });
    if ('IntersectionObserver' in window) {
        var seen = new IntersectionObserver(function (es) {
            es.forEach(function (en) {
                if (!en.isIntersecting) return;
                seen.unobserve(en.target);
                var h = en.target.querySelector('h1, h2');
                ga('section_view', { section: (h ? h.textContent : en.target.id || 'section').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40) });
            });
        }, { threshold: 0.35 });
        document.querySelectorAll('main section, body > section').forEach(function (s) { seen.observe(s); });

        // They watched the demo for 8 seconds: ViewContent, once.
        var stage = document.getElementById('stage');
        var watched = 0, timer = null, sent = false;
        if (stage) new IntersectionObserver(function (es) {
            es.forEach(function (en) {
                if (sent) return;
                if (en.isIntersecting) timer = setInterval(function () {
                    watched += 1;
                    if (watched >= 8 && !sent) { sent = true; clearInterval(timer); metaEvent('ViewContent', { content_name: PAGE + '_demo', variant: variant }); ga('view_demo'); }
                }, 1000);
                else clearInterval(timer);
            });
        }, { threshold: 0.5 }).observe(stage);
    }
    if (PAGE.indexOf('pricing') !== -1) setTimeout(function () { metaEvent('ViewContent', { content_name: PAGE, variant: variant }); }, 8000);

    // ---- Small signals ----
    document.addEventListener('toggle', function (e) {
        var d = e.target;
        if (d.tagName === 'DETAILS' && d.open) { var s = d.querySelector('summary'); ga('faq_open', { question: s ? s.textContent.trim().slice(0, 80) : '' }); }
    }, true);
    var avg = document.getElementById('avg'), calcSent = false;
    if (avg) avg.addEventListener('input', function () { if (!calcSent) { calcSent = true; ga('calculator_used'); } });
    var exit = document.getElementById('exit');
    if (exit && 'MutationObserver' in window) new MutationObserver(function () { if (exit.classList.contains('on')) ga('exit_offer_shown'); }).observe(exit, { attributes: true, attributeFilter: ['class'] });

    // ---- The form: name and WhatsApp first, then the website, then the calendar ----
    var form = document.getElementById('lpform');
    if (!form) return;
    var next1 = document.getElementById('next1');
    var stepTxt = document.getElementById('st-txt');
    var leadId = newId('lead');   // one id for the pixel Lead and the server Lead, so Meta counts it once
    var partial = null;           // the step 1 request; step 2 waits for its deal id
    var captured = false;
    function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
    function base() {
        var ids = metaIds();
        return {
            name: lead.name, whatsapp: lead.whatsapp, eventId: leadId,
            sourceUrl: location.origin + location.pathname,
            fbp: ids.fbp, fbc: ids.fbc, fbclid: attr.fbclid || '',
            utm_source: attr.utm_source || '', utm_medium: attr.utm_medium || '', utm_campaign: attr.utm_campaign || '',
            utm_content: attr.utm_content || '', utm_term: attr.utm_term || '',
            notes: 'Page: Free 1-Call Superhuman Sales Team Launch, ' + location.host + location.pathname + ', hero ' + variant.toUpperCase(),
            url_hp: (form.querySelector('[name=url_hp]') || {}).value || ''
        };
    }
    function post(body) {
        var ctl = 'AbortController' in window ? new AbortController() : null;
        var stop = setTimeout(function () { if (ctl) ctl.abort(); }, 8000);
        return fetch(window.LEAD_API || '/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
            .then(function (r) { clearTimeout(stop); return r.json(); })
            .then(function (j) { if (j && j.id) lead.opportunityId = j.id; return j; })
            .catch(function () { clearTimeout(stop); return null; });
    }

    // Same tiers as /ai-closer (closer-qualify.js): monthly enquiry value =
    // enquiries a week x 4.3 x average sale. A at S$1M a month, B at S$100k, C below.
    var ENQ = { under20: 10, '20to50': 35, '50to150': 100, '150plus': 250 };
    var SALE = { under500: 250, '500to2k': 1200, '2kto10k': 5000, '10kplus': 15000 };
    function qualify(e, s) {
        var value = Math.round((ENQ[e] || 0) * 4.3 * (SALE[s] || 0));
        var money = 'S$' + value.toLocaleString('en-SG');
        if (value >= 1000000) return { tier: 'A', value: value, reason: 'About ' + money + ' a month through WhatsApp. Call this one first' };
        if (value >= 100000) return { tier: 'B', value: value, reason: 'About ' + money + ' a month through WhatsApp. Enough for an AI salesperson to pay for itself' };
        return { tier: 'C', value: value, reason: 'About ' + money + ' a month through WhatsApp. Check it can pay back before quoting' };
    }

    // Step 1 done: name, number and website is a lead. Save it now, so someone who stops at the
    // tier questions is still in the CRM, still alerts Alexander, and still gets a WhatsApp from us.
    function captureContact() {
        if (captured || !form.classList.contains('s2')) return;
        captured = true;
        lead = { name: val('f-name'), whatsapp: val('f-wa'), website: val('f-web') };
        try {
            if (window.fbq && window.FB_PIXEL_ID) window.fbq('init', window.FB_PIXEL_ID, { ph: lead.whatsapp.replace(/\D/g, ''), fn: lead.name.split(/\s+/)[0].toLowerCase() });
        } catch (err) {}
        pixel('Lead', { content_name: PAGE, variant: variant }, { eventID: leadId });
        ga('generate_lead', { event_category: 'conversion', cta_id: 'final_form' });
        ga('lp_form_step', { step: 2 });
        var body = base(); body.partial = 'true'; body.website = lead.website;
        partial = post(body);
    }
    if (next1) next1.addEventListener('click', function () { setTimeout(captureContact, 0); });

    // Step 2: two taps for the tier. Same deal, now complete, then the calendar.
    var busy = false;
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!form.classList.contains('s2') || busy) return;
        var website = lead.website || val('f-web');
        var enq = (form.querySelector('[name=enquiries]:checked') || {}).value || '';
        var sale = (form.querySelector('[name=saleValue]:checked') || {}).value || '';
        if (!website || !enq || !sale) return;
        var q = qualify(enq, sale);
        busy = true;
        lead.website = website;
        ga('lp_form_step', { step: 3 });
        // Tier A and B are the clients we want more of. The server sends Meta a QualifiedLead
        // for them (api/closer-lead.js), never from the browser, so the ad account learns from it.
        ga('lead_tier', { tier: q.tier, monthly_value: q.value });
        (partial || Promise.resolve(null))
            .then(function () {
                var body = base(); body.website = website;
                body.enquiries = enq; body.saleValue = sale;
                body.tier = q.tier; body.qualified = 'true'; body.fitReason = q.reason;
                if (lead.opportunityId) body.opportunityId = lead.opportunityId;
                return post(body);
            })
            .then(openCalendar);
    });

    function openCalendar() {
        form.hidden = true;
        var note = document.querySelector('#book .form-note');
        if (note) note.hidden = true;
        var st3 = document.getElementById('st3'); if (st3) st3.classList.add('on');
        if (stepTxt) stepTxt.textContent = 'Step 3 of 3';
        var wrap = document.getElementById('cal-wrap');
        wrap.hidden = false;
        wrap.scrollIntoView({ block: 'start', behavior: 'smooth' });

        metaEvent('InitiateCheckout', { content_name: PAGE + '_calendar', variant: variant });
        ga('open_calendar', { event_category: 'conversion', cta_id: 'final_form' });

        try {
            (function (C, A, L) { var p = function (a, ar) { a.q.push(ar); }; var d = C.document; C.Cal = C.Cal || function () { var cal = C.Cal; var ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement('script')).src = A; cal.loaded = true; } if (ar[0] === L) { var api = function () { p(api, arguments); }; var namespace = ar[1]; api.q = api.q || []; if (typeof namespace === 'string') { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ['initNamespace', namespace]); } else p(cal, ar); return; } p(cal, ar); }; })(window, 'https://app.cal.com/embed/embed.js', 'init');
            window.Cal('init', { origin: 'https://cal.com' });
            window.Cal('inline', {
                elementOrSelector: '#cal',
                calLink: CAL_LINK,
                config: {
                    layout: 'month_view',
                    name: lead.name,
                    'metadata[opportunityId]': lead.opportunityId || '',
                    'metadata[utm_content]': attr.utm_content || '',
                    'metadata[variant]': variant,
                    notes: ['Website: ' + lead.website, 'WhatsApp: ' + lead.whatsapp].join(' | ')
                }
            });
            window.Cal('on', { action: 'bookingSuccessful', callback: function () { window.onFreeAiBooked(); } });
        } catch (err) {}
        // No calendar after 8 seconds: say what happens next instead of an empty box.
        setTimeout(function () {
            if (!document.querySelector('#cal iframe')) { var fb = document.getElementById('cal-fallback'); if (fb) fb.hidden = false; }
        }, 8000);
    }

    // Booked. Use the same key the booking cron sends for this deal, or Meta counts it twice.
    // With no deal id, stay quiet and let the cron send it.
    var booked = false;
    window.onFreeAiBooked = function () {
        if (booked) return;
        booked = true;
        var done = document.getElementById('cal-done'); if (done) done.hidden = false;
        if (!lead.opportunityId) return;
        metaEvent('Schedule', { content_name: PAGE + '_call', variant: variant }, 'schedule_' + lead.opportunityId);
        ga('book_call_complete', { event_category: 'conversion', cta_id: 'final_form' });
    };
})();
