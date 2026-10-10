# Content JSON for build_industry_page.py (one file per trade)

Every field is plain English, no em dashes, no curly quotes, no semicolons inside FAQ answers. Every number must come from the inventory file (verbatim or anonymised) or from a 41 Labs page. Prices in a sample dialogue must be labelled as examples by the intro text, never presented as a client's real rate.

{
 "slug": "ai-for-car-rental-companies-singapore",      // URL: /industries/<slug>; reuse an existing slug when the trade already has a page
 "trade": "car rental companies",                      // plural, lower case, used in headings
 "trade_singular": "car rental company",
 "audience": "Car rental and private-hire fleet operators in Singapore",
 "spoke_with": "three car rental and private-hire fleet operators in Singapore",   // honest count, no names
 "title": "AI Agent for Car Rental Companies in Singapore | 41 Labs",   // <= 62 chars
 "desc": "...",                                          // <= 165 chars, benefit first
 "h1": "AI Agent for Car Rental Companies in Singapore",
 "hero_sub": "You rent cars to drivers who message at 11pm asking 'got car?'. 41 Closer answers...",   // call the owner out directly, 1 to 2 sentences
 "keywords": "ai agent for car rental singapore, ...",
 "date_txt": "10 October 2026", "date_iso": "2026-10-10T09:00:00+08:00",
 "capsule_direct": "...",    // 40 to 60 words: what the agent does for THIS trade, 41 Closer named once
 "capsule_passage": "...",   // 130 to 170 words: their enquiry pattern, the leak, what the agent does in their flow, Starter vs Pro, price, test line
 "enquiries": ["got car this weekend?", "..."],         // 6 to 10 messages in the customer's words, from the calls
 "enquiries_note": "<p>...</p> one paragraph: what these have in common and why nobody answers them at 9pm (from the calls)",
 "dialogue": [{"who":"customer","text":"..."},{"who":"agent","text":"..."}],   // 6 to 10 turns, mirrors the demo flow we built
 "flow": [{"step":"It answers the availability question","detail":"..."}, ...],   // 4 to 5 steps specific to this trade
 "systems": "What it reads and writes for this trade on Starter vs Pro (fleet sheet, booking calendar, PayNow, POS...)",
 "leaks": ["<li-ready sentence with a sourced number>", ...],   // optional, only sourced numbers (calls, the study, the case)
 "heard": [{"quote":"paraphrased objection in the owner's words","answer":"honest answer, 2 to 4 sentences"}],   // 4 to 6
 "plan_starter": "what Starter does for this trade", "plan_pro": "what Pro adds for this trade (which system it reads/writes)",
 "faq": [["question in the buyer's phrasing","answer, 2 to 5 sentences, no semicolons"], ...],   // 6 to 8
 "related": [["/blog/whatsapp-response-time-singapore-study","How fast 25 Singapore businesses replied on WhatsApp"], ...]
}
