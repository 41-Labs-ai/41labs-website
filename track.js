// 41 Labs — event tracking (GA4: G-VQQ49H8N1L, GTM: GTM-WQJF7DK7)
// One delegated listener tracks every CTA on every page (current and future,
// including the runtime-injected floating WhatsApp button).
//
// Works with the site's DEFERRED analytics: GA only loads on first interaction
// or after 4s. We define a gtag stub up front so click events queue into
// dataLayer and are never dropped if a CTA click is the very first interaction.
(function () {
    'use strict';

    // Ensure gtag exists and queues into dataLayer even before gtag.js loads.
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== 'function') {
        window.gtag = function () { window.dataLayer.push(arguments); };
    }

    // Queue GA config at LOAD time so it always precedes click events. Before
    // this, a visitor whose very first interaction was a conversion click had
    // the event pushed to dataLayer ahead of the deferred loader's config, so
    // GA4 dropped it — which is why whatsapp_click barely registered. We send
    // no page_view here (the deferred loader still sends exactly one) and use
    // beacon transport so events survive the tab backgrounding when WhatsApp
    // opens. This queues only — it does NOT load gtag.js early (CWV preserved).
    var GA_MEASUREMENT_ID = 'G-VQQ49H8N1L';
    // Google Ads conversion tracking. Fill AW_ID + WA_CONVERSION_LABEL from the
    // conversion action you create in Google Ads (Goals → Conversions → Website).
    // Leaving these as the REPLACE_ placeholders is safe: the guarded block in the
    // WhatsApp handler simply no-ops until real values are pasted in.
    var AW_ID = 'AW-REPLACE_WITH_CONVERSION_ID';        // e.g. 'AW-123456789'
    var WA_CONVERSION_LABEL = 'REPLACE_WITH_LABEL';     // e.g. 'abcDeFgh12'
    var ADS_READY = AW_ID.indexOf('REPLACE_') === -1 && WA_CONVERSION_LABEL.indexOf('REPLACE_') === -1;

    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID, { send_page_view: false, transport_type: 'beacon' });
    if (ADS_READY) { window.gtag('config', AW_ID); }

    function track(name, params) {
        try { window.gtag('event', name, params || {}); } catch (e) {}
    }
    // Expose for inline page scripts (e.g. the audit flow) that want a safe tracker.
    window.track41 = track;

    function cleanText(el) {
        var t = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
        return t.slice(0, 100);
    }

    // Name the CTA so "Chat with 41 Closer" is distinguishable from other buttons.
    function ctaId(el, href, text) {
        var hay = (text + ' ' + href).toLowerCase();
        if (/closer/.test(hay)) return '41_closer';
        if ((el.getAttribute('aria-label') || '').toLowerCase() === 'whatsapp us' || (el.closest && el.closest('[class*="float"]'))) return 'floating_whatsapp';
        if (el.classList.contains('nav-cta')) return 'nav_cta';
        if (el.classList.contains('hero-cta') || (el.closest && el.closest('.hero'))) return 'hero_cta';
        if (/audit/.test(hay)) return 'free_audit';
        if (/book|call|discovery|demo/.test(hay)) return 'book_call';
        if (/partner|affiliate/.test(hay)) return 'partner';
        return 'other';
    }


    // ---- Where the lead came from -------------------------------------------
    // Every lead reaches us on WhatsApp, and the message used to arrive with no
    // idea which page or campaign produced it. GA saw the click; the conversation
    // did not. We remember first touch for the session and carry it into both.
    var ATTR_KEY = '41l_attr';

    function firstTouch() {
        var saved;
        try { saved = JSON.parse(sessionStorage.getItem(ATTR_KEY) || 'null'); } catch (e) { saved = null; }
        if (saved) return saved;

        var q = new URLSearchParams(location.search);
        var src = q.get('utm_source') || '';
        if (!src) {
            // No utm: infer from the ad click ids, then the referrer, and say
            // nothing rather than guess when there is genuinely nothing to say.
            if (q.get('gclid')) src = 'google';
            else if (q.get('fbclid')) src = 'meta';
            else if (document.referrer) {
                try {
                    var h = new URL(document.referrer).hostname.replace(/^www\./, '');
                    if (h && h !== location.hostname) src = h;
                } catch (e) {}
            }
        }
        var a = {
            source: src,
            medium: q.get('utm_medium') || '',
            campaign: q.get('utm_campaign') || '',
            content: q.get('utm_content') || '',
            landing: location.pathname
        };
        try { sessionStorage.setItem(ATTR_KEY, JSON.stringify(a)); } catch (e) {}
        return a;
    }

    // A short slug for the page the click happened on. "/" becomes "home".
    function pageRef() {
        var seg = location.pathname.replace(/\.html$/, '').split('/').filter(Boolean);
        var last = seg.length ? seg[seg.length - 1] : 'home';
        return last === 'index' ? 'home' : last;
    }

    // Append "(via page - source)" to the prefilled WhatsApp message so the
    // conversation itself says where it came from. Kept short and readable:
    // the customer sees this text before they send it.
    function tagWhatsAppHref(href) {
        var url;
        try { url = new URL(href, location.href); } catch (e) { return href; }
        var ref = pageRef();
        var msg = url.searchParams.get('text') || '';
        if (msg.indexOf('(via ') !== -1) return url.toString();   // already tagged
        var a = firstTouch();
        var bits = [ref];
        if (a.source) bits.push(a.source);
        if (a.campaign) bits.push(a.campaign);
        url.searchParams.set('text', (msg ? msg + ' ' : '') + '(via ' + bits.join(' - ') + ')');
        return url.toString();
    }

    // Record first touch as soon as the page loads. Doing it lazily at click
    // time loses the campaign entirely when someone lands on an ad page, browses
    // to a second page and only then clicks WhatsApp.
    firstTouch();

    document.addEventListener('click', function (e) {
        var el = e.target && e.target.closest ? e.target.closest('a, button') : null;
        if (!el) return;

        var href = el.getAttribute('href') || '';
        var text = cleanText(el);
        var page = location.pathname;

        // WhatsApp — the primary conversion across the site
        if (/wa\.me|whatsapp/i.test(href)) {
            // Rewrite before the browser follows the link, so the prefilled
            // message carries the page and campaign into the conversation.
            var tagged = href;
            if (/wa\.me/i.test(href)) {
                tagged = tagWhatsAppHref(href);
                if (tagged !== href) { try { el.setAttribute('href', tagged); } catch (e) {} }
            }
            var attr = firstTouch();
            track('whatsapp_click', {
                event_category: 'conversion',
                event_label: text || 'whatsapp',
                cta_id: ctaId(el, href, text),
                link_url: tagged,
                page_path: page,
                utm_source: attr.source,
                utm_medium: attr.medium,
                utm_campaign: attr.campaign,
                utm_content: attr.content,
                landing_page: attr.landing
            });
            // Google Ads conversion (separate destination from GA4 above).
            // No-ops until AW_ID + label are filled in. beacon transport so it
            // survives the tab backgrounding when WhatsApp opens.
            if (ADS_READY) {
                track('conversion', {
                    send_to: AW_ID + '/' + WA_CONVERSION_LABEL,
                    value: 50.0,
                    currency: 'SGD',
                    transport_type: 'beacon'
                });
            }
            return;
        }

        // Email
        if (/^mailto:/i.test(href)) {
            track('email_click', { event_category: 'engagement', event_label: href.replace(/^mailto:/i, ''), page_path: page });
            return;
        }

        // Phone
        if (/^tel:/i.test(href)) {
            track('phone_click', { event_category: 'engagement', event_label: href.replace(/^tel:/i, ''), page_path: page });
            return;
        }

        // Generic CTA buttons (btn / cta classes), excluding pure UI toggles
        var cls = el.className || '';
        var isButton = typeof cls === 'string' && /\b(btn|cta)\b/.test(cls);
        var isUiToggle = el.classList.contains('mobile-menu-btn') || (el.closest && el.closest('.mobile-menu-btn'));
        if (isButton && !isUiToggle) {
            track('cta_click', {
                event_category: 'engagement',
                event_label: text || 'cta',
                cta_id: ctaId(el, href, text),
                link_url: href,
                page_path: page
            });
        }
    }, false);

    // Lead / contact form submissions
    document.addEventListener('submit', function (e) {
        var form = e.target;
        if (!form || form.tagName !== 'FORM') return;
        track('form_submit', {
            event_category: 'conversion',
            event_label: form.id || form.getAttribute('name') || form.getAttribute('action') || 'form',
            page_path: location.pathname
        });
    }, true);
})();
