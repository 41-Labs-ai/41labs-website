# 41 Labs Partner Link Engine

The real-relationship backlink plan. Every link below comes from a page that a real business owns, that describes a real relationship we have, on a domain that gets real traffic. No bought links. Nothing under $500. No link farms. No PBNs.

This is the David G Quaid rule in practice: the links that build durable authority are partner links, client links, and directory links from pages that themselves rank and get seen by humans. If a link would not exist without a real relationship, it is the kind of link we want.

**Target:** every link points to `https://41labs.ai` (home) or a relevant deep page (`/41-closer`, `/partners`). Anchor text should read naturally, name 41 Labs or 41 Closer, and match the page it sits on.

**House rules for every ask in this doc:** plain English, short sentences, no em dashes, no hype, name a concrete reason, make it a one-click yes.

---

## Do these first (ease x value)

| Priority | Source | Effort | Value | Why it wins |
|---|---|---|---|---|
| 1 | Website48 live client sites (footer credit) | Low. We control the code | High | 20+ live SG business domains, one snippet each, we deploy it ourselves. Set as default on all future builds. |
| 2 | Active referral partners (/partners) | Low. Warm relationship | High | They already promote us. A link is a smaller ask than a referral. |
| 3 | Integration / "works with" partners | Medium. Needs a reply | High | Mutual pages on tool vendor sites (CRM, WhatsApp API, booking) rank for exactly our buyer's searches. |
| 4 | Delivered clients as case studies / "as seen on" | Medium. Needs client sign-off | Medium-High | Client sites and any press they have already rank. A joint case study earns a link both ways. |
| 5 | SG business ecosystem directories (SGTech, SBF, chambers, alumni) | Medium-High. Membership or application | Medium-High | Member directory pages are trusted, SG-relevant, and hard for competitors to fake. |

Start at row 1 because we own the code and can ship 20+ links this week. Rows 2 and 3 run in parallel as outreach.

---

## 1. Website48 client site footer credits

We built these sites. A tasteful footer credit is normal, expected, and honest. Each one is a link from a live Singapore business domain on a page Google already crawls and indexes.

**Why this passes the Quaid rule:** the link sits on a real SG company's live site, in the footer of a page that gets organic and direct traffic, and it describes a true relationship (we built or run the site). It is relevant (SME to AI-vendor), contextual, and it will still be there in two years. This is the opposite of a farm link.

### The exact footer snippet to add

Drop this into the site footer, near the copyright line. Two variants depending on what we did for them.

For sites we built:

```html
<p class="site-credit">
  Website by <a href="https://41labs.ai" rel="noopener" target="_blank">41 Labs</a>
</p>
```

For clients also running an AI system from us (41 Closer, etc.):

```html
<p class="site-credit">
  AI systems by <a href="https://41labs.ai" rel="noopener" target="_blank">41 Labs</a>
</p>
```

Minimal styling so it stays tasteful and does not shout:

```css
.site-credit {
  font-size: 0.8rem;
  opacity: 0.6;
  text-align: center;
  margin-top: 1rem;
}
.site-credit a { color: inherit; text-decoration: underline; }
```

Notes:
- Do **not** use `rel="nofollow"` or `rel="sponsored"`. This is an editorial credit for real work, not a paid placement, so a normal followed link is correct and honest.
- Keep the anchor as "41 Labs" (brand anchor). Do not over-optimise with "AI agency Singapore" anchors across 20 sites. Natural brand anchors are what a real credit looks like and what Quaid's method wants.
- **Make this the default on every future Website48 build.** Add the snippet to the base template so it ships automatically. That turns every new client into a new relevant link with zero extra work.

### The permission note to each client

Short, friendly, opt-out framed. Send by WhatsApp or email.

> Hi [Name], quick one. We add a small "Website by 41 Labs" credit in the footer of the sites we build, same as most web studios do. It is tiny and sits at the very bottom. It helps other business owners find us. Happy for us to add it to yours? If you would rather we didn't, just say and we will leave it off, no problem at all.

For AI-system clients:

> Hi [Name], we usually add a small "AI systems by 41 Labs" line in the footer, right at the bottom of the page. It is discreet and it helps other owners find us when they are looking for the same thing you are running. All good to add it? Say the word if you would prefer not to.

### Client rows

Add the credit to every live production site. Status column is what to do next.

| Client | Live domain | Credit variant | Action |
|---|---|---|---|
| Avenue Engineering | avenue.com.sg | Website by | Add + ask permission |
| Junese See (JSD) | careers.junese.sg | Website by | Add + ask permission |
| P&N International | pnn.com.sg | Website by | Add + ask permission |
| beSecurity | besecurity.biz (draft) | Website by | Add on launch |
| LFHB | (confirm live domain) | Website by | Confirm domain, then add |
| AMAGE | (confirm live domain) | Website by | Confirm domain, then add |
| Valencia Yachts | valenciayachts.com | Website by | Add + ask permission |
| Edenity | edenity.com.sg | Website by | Add + ask permission |
| PC Clinic | pcclinic.com.sg | Website by | Add + ask permission |
| The Real Matters | therealmatters.sg | Website by | Add + ask permission |
| Jernn International | jernn.com | Website by | Add + ask permission |
| Merlionix | merlionix.com | Website by | Add + ask permission |
| Cardiac Centre International | cci.sg | Website by | Add + ask permission |
| Arts Theatre of Singapore | artstheatre.com.sg | Website by | Add + ask permission |
| Christopher Neo | advisorsalliancegroup.com.sg | Website by | Add + ask permission |
| Legacy Transport | (vercel, needs domain) | Website by | Add on custom domain |
| Applied Office Systems | (vercel, needs domain) | Website by | Add on custom domain |
| Emilios Solutions | (vercel, needs domain) | Website by | Add on custom domain |
| Triluxe Holdings | (vercel, needs domain) | Website by | Add on custom domain |
| Apricot Stone Advisory | (vercel, needs domain) | Website by | Add on custom domain |
| RenoHaus | (vercel, needs domain) | Website by | Add on custom domain |
| 365 Auto Assist | (vercel, needs domain) | Website by | Add on custom domain |
| Quoxnt | (vercel, needs domain) | Website by | Add on custom domain |
| DGN Consultancy | (vercel, needs domain) | Website by | Add on custom domain |
| ARTIntrospect | (vercel, needs domain) | Website by | Add on custom domain |
| Emilio's Defect Check | (vercel, needs domain) | Website by | Add on custom domain |

Priority order: the rows with a real custom domain (avenue.com.sg, pnn.com.sg, jernn.com, cci.sg, merlionix.com, valenciayachts.com, edenity.com.sg, pcclinic.com.sg, therealmatters.sg, artstheatre.com.sg, advisorsalliancegroup.com.sg, careers.junese.sg, besecurity.biz) carry the most weight because they are indexed on their own domain, not a vercel.app subdomain. Do those first. A `*.vercel.app` credit is worth little for SEO, so for those clients push to get them onto their own domain first, then the credit becomes valuable.

---

## 2. Active referral partners (/partners)

We run a partner program that pays 20% of first invoice plus 10% recurring for 12 months. Partners already promote us to their clients. Asking them to add a link on their own site is a smaller favour than a referral, and it helps them look credible (they are showing who they work with).

**Why this passes the Quaid rule:** a partner's site is a real business, the link describes a real commercial relationship, and it usually sits on a "partners" or "who we work with" page that their own prospects read. It is contextual and durable.

### The ask

> Hi [Name], thanks again for being part of the 41 Labs partner program. Quick favour that helps both of us. If you have a partners page or a footer on your site, would you add a link to us? It signals to your clients that you have a real AI delivery team behind you, and it helps the right people find us. Here is a line you can drop in:
>
> AI systems and WhatsApp sales agents by our partner [41 Labs](https://41labs.ai).
>
> If you would rather link to the product directly, the 41 Closer page is [41labs.ai/41-closer](https://41labs.ai/41-closer). Either is great. Thank you.

**Requested anchor and URL:**
- Anchor: "41 Labs" -> `https://41labs.ai`
- Or product anchor: "41 Closer" -> `https://41labs.ai/41-closer`

Snippet they can paste:

```html
<p>AI systems and WhatsApp sales agents by our partner
  <a href="https://41labs.ai" rel="noopener" target="_blank">41 Labs</a>.
</p>
```

---

## 3. Integration and tool partners ("works with")

41 Closer plugs into other tools: WhatsApp Business API providers, CRMs, calendar and booking tools. Every one of those vendors runs an integrations directory or a "works with" page. Those pages rank for exactly what our buyers search ("[CRM] WhatsApp integration", "book appointments over WhatsApp"). A mutual cross-link there is high value and mutually beneficial.

**Why this passes the Quaid rule:** vendor integration pages are high-authority, high-traffic, and topically dead-on. The link exists because there is a genuine technical integration. It is the strongest non-client link type available to us.

### Targets (by category)

- **WhatsApp Business API providers** 41 Closer sends and receives on: Meta WhatsApp Cloud API, and any BSP we route through (360dialog, Twilio, Wati, Gupshup, Respond.io). Their app directories and "built with our API" showcases.
- **CRMs** we sync into: Twenty (our own stack, we can self-list in their community/showcase), plus HubSpot, Pipedrive, GoHighLevel marketplaces if we support them.
- **Calendar / booking:** Google Calendar, Calendly, Cal.com integration listings.

### The outreach

> Hi [Team], we build 41 Closer, a managed WhatsApp AI sales agent used by Singapore businesses, and it runs on [your product]. We would like to add a "works with [your product]" section on our site with a link to you, and we would love a spot in your integrations directory or partners page in return. We can supply a logo, a one-line description, and a short setup guide our shared users would find useful. Who is the right person to set this up?

**Requested anchor and URL for them to use:**
- Anchor: "41 Closer, a WhatsApp AI sales agent" -> `https://41labs.ai/41-closer`

**Our side of the mutual link:** build a `/integrations` or "works with" block on 41labs.ai listing each partner, linking to them. That gives us a real page to point to in the ask, which makes the yes easy.

---

## 4. Delivered clients: case studies and "as seen on"

We have 30+ delivered projects across many industries. Some of those clients have their own press, awards, or ranking sites. A joint case study earns a link in two directions: they link to the case study, we link to them, and if the client has press, that press can mention us too.

**Why this passes the Quaid rule:** a case study is a real story about real work. The client links to it because it makes them look good. If the client site or their press already ranks, the link carries real traffic and relevance. Nothing manufactured.

### The ask (to the client)

> Hi [Name], we would like to write up what we built for [Company] as a short case study on our site, with your logo and a couple of lines on the result. It is good visibility for [Company] too, and we will link straight to your site from it. If you are open to it, could we also add a small "Our AI/website partner: 41 Labs" line on your site or in a news post? Happy to draft both so it is a two-minute review for you.

**Requested anchor and URL:**
- On the client site: "41 Labs" -> `https://41labs.ai`, or "41 Closer" -> `https://41labs.ai/41-closer` if it was an AI build.
- We link back to their live site from the case study on `41labs.ai/case-studies`.

**Where the press angle applies:** clients with existing media coverage or industry-body membership (for example CCI in healthcare, Merlionix in cleantech, Arts Theatre in arts) are the best targets, because a mention on a ranking press or association page is worth far more than a footer credit.

---

## 5. Singapore business ecosystem directories

Membership and partner directories run by trusted SG bodies. These are relevant (SG business), trusted (established orgs), and hard for competitors to spoof. Founder Alexander Lee's alumni networks add another genuine relationship channel.

**Why these pass the Quaid rule:** they are real member directories on established, indexed domains. A listing exists because there is a real membership or relationship. Not a link farm, not a paid drop.

### Concrete targets and how to get listed

| Target | What it is | How to get the link |
|---|---|---|
| **SGTech** (sgtech.org.sg) | Singapore's tech industry association. Member directory lists each member company with a profile and website link. | Apply for SGTech membership as a tech/AI company. Complete the member profile with the 41labs.ai link. Highest-relevance SG tech directory link available. |
| **Singapore Business Federation** (sbf.org.sg) | National apex business body. Member directory. | Apply for SBF membership (SMEs qualify). Add company profile with website. Broad SG business authority. |
| **Enterprise Singapore / EDG vendor ecosystem** | Government grant scheme. Pre-approved solution providers get listed as vendors SMEs can engage. | Apply to become a pre-approved digital solution provider (PSG / EDG vendor). Listing on the gov solution finder is a trusted, high-intent link and a lead source. Strongest but most paperwork. |
| **Local chambers** (SICC, SCCCI, and the relevant bilateral chambers) | Chamber member directories. | Join the chamber that fits (Singapore International Chamber of Commerce, or SCCCI for the Chinese business network). Member listing includes a website link. |
| **BNI / networking chapters** | Referral networking groups. Chapter member pages list businesses and sites. | Join a local BNI or similar chapter. Member profile page links to the site. Also a direct referral channel. |
| **Founder alumni network** | Alexander Lee's university/school alumni directory or founder community. | Add 41 Labs to the alumni business directory or founder-community member listing. Genuine relationship, easy yes. |
| **Startup / accelerator directories** | If 41 Labs has any accelerator, grant, or programme affiliation. | Get listed in that programme's portfolio/alumni page. Portfolio pages rank and carry weight. |

### The ask (where a directory needs a human nudge)

For alumni networks, chambers, and any partner-run directory where you email a person:

> Hi [Name], I run 41 Labs, a Singapore AI company (we build WhatsApp sales agents and custom AI for SMEs). I would like to be listed in the [directory name]. Here are the details: company name 41 Labs, website https://41labs.ai, one-line description "Managed AI sales agents and custom AI systems for Singapore businesses." Let me know if you need anything else from me. Thank you.

**Requested anchor and URL everywhere in this section:**
- Anchor: "41 Labs" -> `https://41labs.ai`

Priority within this section: SGTech first (most relevant, membership is straightforward), then a chamber and the alumni network in parallel (fast, relationship-based), then the Enterprise Singapore vendor listing last because it is the most paperwork but also the highest value and a lead source in its own right.

---

## Anchor text discipline (applies to all sections)

- Default to the brand anchor "41 Labs" or the product anchor "41 Closer". These read naturally and are what real relationship links look like.
- Do not roll out keyword-stuffed anchors ("best AI agency Singapore") across many sites. A pattern of identical commercial anchors is the fingerprint of a bought-link scheme, which is exactly what Quaid's method avoids.
- Vary naturally: some "41 Labs", some "41 Closer", some "our AI partner 41 Labs". Let it look human, because it is.
- Every followed link should be editorial (given because the relationship is real). Reserve `nofollow`/`sponsored` for genuinely paid placements, which we are not doing here.

---

## Sections covered

1. Website48 client site footer credits (snippet, permission note, 26-row client table, default-on-future-builds rule)
2. Active referral partners (/partners) link ask
3. Integration / "works with" tool partners (WhatsApp BSPs, CRMs, calendar/booking) mutual cross-link
4. Delivered clients: joint case studies and "as seen on" cross-links
5. SG business ecosystem: SGTech, SBF, Enterprise Singapore/EDG, chambers, BNI, founder alumni network

Plus a "do these first" ease-x-value priority table at the top and an anchor-text discipline section to keep the whole engine inside Quaid's rules.
