# Page generators

Each money page and every trade page is written by a script from a content dict or JSON, so the visible FAQ and the FAQPage schema cannot drift and the page cannot grow past its budget. Run from anywhere; paths resolve relative to this folder.

- `build_sales_agent_page.py` → `/ai-sales-agent-singapore` (vendor and region facts in `page-facts.json`, trade cards from `hub-cards.json`)
- `build_agency_page.py` → `/ai-automation-agency-singapore`
- `build_devco_page.py` → `/ai-development-company-singapore`
- `build_quote_pillar.py` → `/blog/what-is-ai-quote-automation`
- `build_industry_page.py industries/<slug>.json [--check]` → `/industries/<slug>`; `publish_industry_pages.py` builds all, writes `hub-cards.json`, runs `add_hub_cards.py` on `/industries`, writes `llms-industries.txt`
- `qa_industry_json.py` → names, banned words, number sentences across the JSONs
- `indexnow.py` → submit changed URLs

Writer rules for trade pages: `industries/_writer-brief.md`. After any build: `npm run rebuild`, `npx playwright test`, commit, push, `indexnow.py`.
