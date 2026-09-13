# 41 Closer Flagship Page — Design Spec

**Date:** 2026-06-21
**Owner:** Alexander (41 Labs)
**Status:** Draft for review

## Goal

Build the flagship product page for **41 Closer**, the WhatsApp AI sales agent (internal codename: Hermes). One job: get the right business owner to scan a code, chat with a live agent on WhatsApp, and leave their number so we can follow up and close them on a high-touch, premium engagement.

This is not a self-service product. It is a white-glove, done-for-you service, priced on impact. The page must read premium and select for serious buyers.

## Success criteria

1. A visitor lands, understands the problem in 5 seconds, and taps or scans through to `wa.me/6580124848`.
2. Every visitor who messages is captured by the existing wacli to 41labs-ops to Attio and inbox pipeline, so we follow up fast.
3. The page reads as premium and selective, not as a cheap software signup.
4. It uses plain language, short sentences, no em dashes, and real numbers.

## Framework

- **Spine: PAS (Problem, Agitate, Solve).** Simplest high-impact structure.
- **Tone: Satterfield (Velvet Rope).** Speak to one specific owner. Price on impact. Whales not minnows. Repel bargain hunters on purpose. Story and proof over feature lists.
- **Numbers: Hormozi.** Show the money they lose now, then the money we make them.

## Writing rules (apply to every line)

- Short sentences. Common words.
- No em dashes. Use periods, commas, or parentheses.
- One concrete example per section. Real dollar or volume figures, never abstract benefit-speak.
- No hype words, no emoji bullets, no "unlock growth" or "leverage AI".

## Running example (anonymized, under NDA)

Use a real client as the example but never name them. Describe generically:

- "One of Singapore's largest industrial hardware distributors."
- A catalogue of more than 40,000 products.
- Their customers are contractors and trade buyers who message WhatsApp asking "do you carry X, what is the price, how much for 200 of them."
- Before: a small counter team answered when they could, replied in hours, and missed every message that came in after closing.
- After: the agent replies in seconds, knows all 40,000 products, quotes from live pricing, builds up the order, and hands staff only what needs a human.
- Impact figure to feature: about 5 hours of staff time saved every day. (CONFIRM exact published figures with Alexander before go-live, since this is client data.)

Do not name the client, their brand, or any identifying product line. "Industrial hardware distributor" is the most specific allowed.

## Page structure (`/41-closer`)

1. **Hero.** Headline: "Your sales team stops at 5pm. Your customers don't." Subline: "Nights, weekends, public holidays. 41 Closer answers every message in seconds, follows up every lead, and closes the sale while your team is off. You do nothing. You make more money." Primary action: scan to chat (desktop QR) or tap to chat (mobile), both to `wa.me/6580124848`. One quiet line of exclusivity: we build these for a handful of businesses at a time.
2. **Problem (real example).** "It is Saturday afternoon. A buyer messages your WhatsApp: how much for 200 of these, and do you have stock. Your sales team went home Friday. The message just sits there. Nobody replies. Nobody follows up."
3. **Agitate (the cost).** "By Monday they have bought from whoever answered first. This happens every night after 5pm, every weekend, every public holiday. That is more than half the week your business is shut to people who are ready to spend. Over a month, that is real money gone."
4. **Solve + benefit table + live demo.** State the benefit hard and plain with a two-column contrast table:

   | Your sales team | 41 Closer |
   |---|---|
   | Stops at 5pm | Answers 24 hours, 7 days |
   | Off on weekends and holidays | Never takes a day off |
   | Forgets to follow up | Follows up every single lead |
   | Replies in hours | Replies in 5 seconds |

   Closing line: "More replies. More follow ups. More sales. You do nothing. We build it, we run it, we tune it." Then a large scan to chat block: "Do not take our word for it. Scan this and talk to one right now." The chat is the proof and the lead capture.
5. **Proof.** The anonymized distributor story: more than 40,000 products, replies in seconds instead of hours, about 5 hours of staff time saved every day. Numbers confirmed with Alexander before go-live.
6. **Who this is for, and who it is not.** Repel minnows. For businesses doing real WhatsApp volume where one sale is worth thousands. Not for someone who wants a cheap chatbot.
7. **Price.** No price tag. We price on what we make you. If the numbers do not work for you, we say so. White-glove framing. Quiet line: we handle the EDG grant paperwork for you.
8. **Founder note.** Signed by Alexander. Why 41 Labs builds these and who it is for.
9. **Final action.** Soft and selective: message the agent, and if it impresses you, let us talk. Repeat the scan to chat. Limited availability line.

## Conversion mechanic

- Link target: `https://wa.me/6580124848?text=<prefilled>`.
- Prefilled message primes the demo agent and tags the lead source. Draft: "Hi, I am trying 41 Closer. Show me how you would handle my customers." (CONFIRM final wording.)
- Desktop: render a QR code (SVG) that points at the link, so the visitor scans with a phone.
- Mobile: a large tap to chat button that opens WhatsApp directly.
- No forms on the page. The WhatsApp message itself is the lead capture.

## Brand and design

- Understated premium. Deep dark background, green accent used sparingly, generous whitespace, confident restraint. No loud gradients, no emoji.
- 41 Labs design system: Inter, green `#4ade80`, dark `#1a1a1a`, rounded cards, soft shadows.
- Static HTML and CSS, matching the rest of `41labs-website`. Mobile first. Test 375px, 768px, 1440px.

## Placement

- New page at `/41-closer` (`41-closer.html`). Clean, on-brand, flagship.
- Keep the existing `ai-sales-agent-singapore.html` live for SEO and link it to the flagship.
- Homepage: add one understated flagship band near the top of `index.html` that sends people to `/41-closer`. 41 Leads and 41 GEO stay as supporting links.

## Verification

- One Playwright test (the repo already uses Playwright):
  - Page renders and returns 200.
  - Both calls to action link to exactly `wa.me/6580124848` (a wrong number loses every lead).
  - The QR element is present on desktop and the tap button on mobile.
- Manual: scan the QR on a real phone and confirm it opens the chat with the prefilled message.

## Out of scope (for now)

- No self-service signup, no pricing tiers, no checkout.
- No buying `41closer.ai` yet. Lives on the existing site.
- No changes to the Hermes app.
- No naming of the NDA client anywhere.

## Open items to confirm with Alexander

1. Final hero headline (keep "Your sales team sleeps. 41 Closer doesn't." or alternative).
2. Final prefilled WhatsApp message wording.
3. Exact published impact numbers for the anonymized example (staff hours saved, any conversion figure).
4. Homepage flagship band now, or ship `/41-closer` first and elevate the homepage after.
