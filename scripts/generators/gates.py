"""Shared gates for generated pages (density plan, 10 Oct 2026).
Every generator calls check(html, ...) and refuses to write when a gate fails."""
import re, statistics

WHITELIST = ["WhatsApp Business API", "WhatsApp Business", "WhatsApp", "CRM", "Singapore", "Starter", "Pro plan", "41 Closer", "41 Labs", "EDGE grant", "Shopify", "Amadeus", "catalogue"]

def visible_text(html):
    t = re.sub(r"<script.*?</script>|<style.*?</style>|<nav.*?</nav>|<footer.*?</footer>", "", html, flags=re.S)
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", t)).strip()

def prose_sentences(html):
    """Sentences from <p> and <li> text only (headings, chips, table cells excluded)."""
    t = re.sub(r"<script.*?</script>|<style.*?</style>|<nav.*?</nav>|<footer.*?</footer>", "", html, flags=re.S)
    out = []
    for m in re.finditer(r"<(p|li)(?:\s[^>]*)?>(.*?)</\1>", t, re.S):
        txt = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", m.group(2))).strip()
        for s in re.split(r"(?<=[.!?])\s+", txt):
            s = s.strip()
            if len(s.split()) >= 3:
                out.append(s)
    return out

def _syl(w):
    w = re.sub(r"[^a-z]", "", w.lower())
    if not w:
        return 0
    v = len(re.findall(r"[aeiouy]+", w))
    if w.endswith("e") and v > 1:
        v -= 1
    return max(1, v)

def fk_grade(sentences):
    text = " ".join(sentences)
    for term in WHITELIST:
        text = text.replace(term, "one")
    words = [w for w in text.split() if re.search(r"[a-zA-Z]", w)]
    if not words or not sentences:
        return 0.0
    syl = sum(_syl(w) for w in words)
    return round(0.39 * (len(words) / len(sentences)) + 11.8 * (syl / len(words)) - 15.59, 1)

def check(html, *, max_words, faq, max_faq=8, max_answer_words=60, price_token="$690", price_within=0.25,
          median_sentence=16, max_sentence=28, max_grade=9.0, cta_pattern=r'class="(?:clo-btn-xl|clo-btn-ghost|clo-tier-cta[^"]*|btn btn-primary[^"]*)"[^>]*href="https://wa\.me', max_ctas=3):
    txt = visible_text(html)
    words = txt.split()
    problems = []
    if len(words) > max_words:
        problems.append(f"{len(words)} words, ceiling {max_words}")
    if "—" in html:
        problems.append("em dash present")
    if any(ch in txt for ch in "‘’“”"):
        problems.append("curly quote present")
    i = txt.find(price_token)
    if i < 0:
        problems.append("price not on page")
    elif len(txt[:i].split()) / max(1, len(words)) > price_within:
        problems.append(f"first price at {len(txt[:i].split())/len(words):.0%} of the text, limit {price_within:.0%}")
    if len(faq) > max_faq:
        problems.append(f"{len(faq)} FAQs, limit {max_faq}")
    for q, a in faq:
        n = len(re.sub(r"<[^>]+>", " ", a).split())
        if n > max_answer_words:
            problems.append(f"FAQ answer {n} words: {q[:50]}")
        if ";" in a:
            problems.append(f"semicolon in FAQ: {q[:50]}")
    sents = prose_sentences(html)
    lens = [len(s.split()) for s in sents]
    if lens:
        med = statistics.median(lens)
        if med > median_sentence:
            problems.append(f"median sentence {med} words, limit {median_sentence}")
        longest = max(lens)
        if longest > max_sentence:
            s = sents[lens.index(longest)]
            problems.append(f"sentence of {longest} words: {s[:90]}")
        g = fk_grade(sents)
        if g > max_grade:
            problems.append(f"reading grade {g}, limit {max_grade}")
    ctas = sum(1 for tag in re.findall(r"<a\b[^>]*>", html) if "wa.me" in tag and re.search(r'class="[^"]*(?:clo-btn-xl|clo-btn-ghost|clo-tier-cta|btn-primary)[^"]*"', tag))
    if ctas > max_ctas:
        problems.append(f"{ctas} WhatsApp CTAs, limit {max_ctas}")
    return problems, dict(words=len(words), sentences=len(sents), median_sentence=statistics.median(lens) if lens else 0,
                          max_sentence=max(lens) if lens else 0, grade=fk_grade(sents) if sents else 0, ctas=ctas, faq=len(faq))
