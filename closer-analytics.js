// Journey recorder for /ai-closer. Answers four questions we could not answer before:
//   who arrived and which ad sent them,
//   where they went on the page,
//   how long they actually stayed,
//   and what to hand Meta so it buys more of the leads we want.
//
// Load this BEFORE ai-closer.js. It exposes window.cl41:
//   cl41.snapshot()          -> { vid, sid, ids, attr, journey }
//   cl41.journey()           -> the journey half on its own (goes on the lead)
//   cl41.ids()               -> { fbp, fbc } for Meta match quality
//   cl41.mark(name, params)  -> a named funnel event (GA4 + counted here)
//
// Nothing here blocks rendering and nothing throws into the page: every storage
// read is guarded, because Safari private mode and "block cookies" both make
// localStorage throw rather than return null.
(function () {
    'use strict';

    var SECTION_TICK = 500;     // how often we sample which section is on screen
    var IDLE_MS = 30000;        // no scroll/click/key for this long = not reading
    var BEACON_GAP = 15000;     // never beacon more often than this
    var ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'msclkid'];

    // ---- storage that cannot throw ----
    function ls(key, val) {
        try {
            if (val === undefined) return localStorage.getItem(key);
            localStorage.setItem(key, val);
        } catch (e) {}
        return null;
    }
    function ss(key, val) {
        try {
            if (val === undefined) return sessionStorage.getItem(key);
            sessionStorage.setItem(key, val);
        } catch (e) {}
        return null;
    }
    function jsonGet(store, key) {
        try { return JSON.parse(store(key) || 'null'); } catch (e) { return null; }
    }
    function uid() {
        try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
        return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    }
    function cookie(name) {
        var m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
        return m ? m.pop() : '';
    }

    // ---- identity ----
    // vid = the person, kept across visits. sid = this page view.
    var vid = ls('cl_vid') || (function () { var v = uid(); ls('cl_vid', v); return v; })();
    var sid = uid();
    ss('cl_sid', sid);
    var visits = (parseInt(ls('cl_visits'), 10) || 0) + 1;
    ls('cl_visits', String(visits));

    // ---- attribution: first touch is the ad that found them, last touch is the ad that brought them back ----
    var params = new URLSearchParams(location.search);
    var now = {};
    ATTR_KEYS.forEach(function (k) { if (params.get(k)) now[k] = params.get(k); });
    if (document.referrer && !/^https?:\/\/([^/]*\.)?41labs\.ai/.test(document.referrer)) now.referrer = document.referrer;
    now.landing = location.pathname;
    now.at = new Date().toISOString();

    var hasAd = ATTR_KEYS.some(function (k) { return now[k]; });
    var first = jsonGet(ls, 'cl_first');
    if (!first) { first = now; ls('cl_first', JSON.stringify(first)); }
    // A direct return must not wipe the ad that is paying for this visitor.
    var last = hasAd ? now : (jsonGet(ls, 'cl_last') || first);
    if (hasAd) ls('cl_last', JSON.stringify(now));

    // ---- Meta identifiers ----
    // _fbp and _fbc are set by the pixel. A real _fbc carries the true click time,
    // so it always beats one we rebuild from the fbclid in the URL.
    function metaIds() {
        var fbc = cookie('_fbc');
        var fbclid = now.fbclid || (first && first.fbclid) || '';
        if (!fbc && fbclid) fbc = 'fb.1.' + Date.now() + '.' + fbclid;
        return { fbp: cookie('_fbp') || '', fbc: fbc || '' };
    }

    // ---- the journey ----
    var t0 = Date.now();
    var engagedMs = 0;
    var lastTick = Date.now();
    var lastActive = Date.now();
    var maxScroll = 0;
    var sectionMs = {};          // id -> ms with at least half the section on screen
    var onScreen = {};           // id -> true while intersecting
    var marks = [];              // named funnel events, in order

    function visible() { return document.visibilityState !== 'hidden'; }

    function scrollPct() {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        if (h <= 0) return 100;
        return Math.min(100, Math.max(0, Math.round((window.scrollY / h) * 100)));
    }

    var MILESTONES = [25, 50, 75, 90];
    var hit = {};
    function noteScroll() {
        var p = scrollPct();
        if (p > maxScroll) maxScroll = p;
        MILESTONES.forEach(function (m) {
            if (maxScroll >= m && !hit[m]) { hit[m] = 1; mark('scroll_depth', { depth: m }); }
        });
    }

    ['scroll', 'click', 'keydown', 'pointerdown'].forEach(function (ev) {
        window.addEventListener(ev, function () { lastActive = Date.now(); if (ev === 'scroll') noteScroll(); }, { passive: true });
    });

    // Sampling beats enter/exit timestamps here: a tab that goes to the background
    // never fires an exit, and we would happily bill the visitor for the whole lunch break.
    setInterval(function () {
        var t = Date.now();
        var delta = t - lastTick;
        lastTick = t;
        if (!visible()) return;
        // Sampled, not only on the scroll event: a smooth scroll is still moving
        // when the event fires, and reveal-on-scroll keeps growing the page under us.
        noteScroll();
        if (t - lastActive < IDLE_MS) engagedMs += delta;
        Object.keys(onScreen).forEach(function (id) {
            if (onScreen[id]) sectionMs[id] = (sectionMs[id] || 0) + delta;
        });
    }, SECTION_TICK);

    // This file is loaded from <head> on some pages and from the end of <body> on
    // others, so it must never assume the DOM exists yet. document.body is null in
    // head, and reading it there threw and took the whole recorder down with it.
    function whenReady(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
        else fn();
    }

    whenReady(function () {
        if (!('IntersectionObserver' in window)) return;
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) { onScreen[en.target.id] = en.isIntersecting; });
        }, { threshold: 0.5 });
        document.querySelectorAll('section[id]').forEach(function (el) { io.observe(el); });
    });

    function journey() {
        return {
            ms: Date.now() - t0,
            engagedMs: Math.min(Date.now() - t0, engagedMs),
            scroll: maxScroll,
            visits: visits,
            landing: now.landing,
            referrer: now.referrer || '',
            sections: Object.keys(sectionMs)
                .map(function (id) { return [id, Math.round(sectionMs[id])]; })
                .filter(function (p) { return p[1] > 0; })
                .sort(function (a, b) { return b[1] - a[1]; })
                .slice(0, 12),
            marks: marks.slice(0, 40),
        };
    }

    // GA sets _ga as "GA1.1.<clientId>". Passing the client id server-side lets the
    // beacon land on the SAME GA4 user as the browser hits, instead of inventing a second one.
    function gaClientId() {
        var m = /GA\d\.\d\.(\d+\.\d+)/.exec(cookie('_ga') || '');
        return m ? m[1] : '';
    }

    // ?v= is how the live Meta ads split /41-closer (ecom / industrial / services).
    // It has to win over the page's own label, or the split test cannot be read.
    function variantName() {
        var b = document.body;
        return (params.get('v') || (b && b.getAttribute('data-variant')) || 'long').slice(0, 20);
    }

    function snapshot() {
        return { v: 1, vid: vid, sid: sid, page: location.pathname, variant: variantName(),
                 ga: gaClientId(), ids: metaIds(), attr: { first: first, last: last }, journey: journey() };
    }

    // ---- named funnel events: GA4 now, and kept for the beacon ----
    // track.js is loaded with defer, so window.track41 does not exist yet when this
    // file runs. Without the queue the opening page_view_closer was silently dropped
    // and every session in GA4 was missing its own start.
    var pending = [];
    function flush() {
        if (!window.track41) return;
        while (pending.length) {
            var m = pending.shift();
            try { window.track41(m[0], m[1]); } catch (e) {}
        }
    }
    function mark(name, params) {
        marks.push([name, Math.round((Date.now() - t0) / 1000)]);
        pending.push([name, params || {}]);
        flush();
    }
    // track.js may land after DOMContentLoaded, so try again on both.
    document.addEventListener('DOMContentLoaded', flush);
    window.addEventListener('load', flush);
    var flushTries = 0;
    var flushTimer = setInterval(function () {
        flush();
        if (!pending.length || ++flushTries > 40) clearInterval(flushTimer);
    }, 250);

    // ---- beacon ----
    var lastBeacon = 0;
    function beacon(force) {
        var t = Date.now();
        if (!force && t - lastBeacon < BEACON_GAP) return;
        lastBeacon = t;
        var body = JSON.stringify(snapshot());
        try {
            // text/plain is the CORS-safelisted content type, so the beacon is a simple
            // request everywhere and can never be held up by a preflight during unload.
            // api/track.js parses the JSON regardless of the declared type.
            // sendBeacon returns false when the user agent refuses to queue it (size
            // limits, mostly), so fall through to keepalive fetch when it does.
            if (navigator.sendBeacon && navigator.sendBeacon('/api/track', new Blob([body], { type: 'text/plain;charset=UTF-8' }))) return;
        } catch (e) {}
        try { fetch('/api/track', { method: 'POST', body: body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(function () {}); } catch (e) {}
    }

    document.addEventListener('visibilitychange', function () { if (!visible()) beacon(true); });
    window.addEventListener('pagehide', function () { beacon(true); });

    noteScroll();
    mark('page_view_closer', { variant: variantName(), visit: visits });

    window.cl41 = { snapshot: snapshot, journey: journey, ids: metaIds, mark: mark, beacon: beacon, vid: vid, sid: sid, newEventId: uid };
})();
