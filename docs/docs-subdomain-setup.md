# docs.41labs.ai — setup

Public host for operator runbooks. Separate Vercel project on the same repo, so
the marketing site (`41labs.ai`, project `41labs-website`) is untouched.

## Layout

```
docs-site/                            # deploy root for docs.41labs.ai
  index.html                          # runbook index (cards are generated)
  build-index.cjs                     # regenerates the cards from hermes/**/*.html
  document-style-guide.md             # the style every guide is set in
  hermes/
    connect-stripe.html               # → /hermes/connect-stripe
    whatsapp-onboarding-runbook.html  # → /hermes/whatsapp-onboarding-runbook
    private/druk-asia/...html         # per-client, listed with a tag
  assets/fonts.css                    # saved Google Fonts CSS (gstatic URLs)
  robots.txt                          # Disallow: /
  vercel.json                         # cleanUrls + security headers + X-Robots-Tag
```

One folder per product/system (`hermes/`, and whatever comes next); `assets/` is
shared and referenced by absolute path (`/assets/fonts.css`) so pages work at
any depth.

The index is generated, not hand-written. `build-index.cjs` walks the whole
`hermes/` tree, subdirectories included, and writes one card per page between
the `DOCS:START` and `DOCS:END` markers in `index.html`. A card takes its
heading from the page's `<title>` and its section from the page's
`<meta name="doc-category">`, so the index cannot drift from the pages. Pages
under `hermes/private/` are listed like any other, with a `Client-specific` tag.

`docs/` (this folder) stays internal — it is listed in the root `.vercelignore`,
as is `docs-site` so the main project never serves it at `41labs.ai/docs-site/*`.

## Source of the runbook page

`docs/hermes/` holds the raw "save page as complete" capture of a Claude
artifact: the outer HTML is claude.ai chrome, the real document is the iframe
`..._files/saved_resource.html`.
`docs-site/hermes/whatsapp-onboarding-runbook.html` is that iframe's `<body>`
lifted into a standalone page (title/link/style moved to `<head>`, `./css2`
repointed at `/assets/fonts.css`). Images are inline base64, so the page is
self-contained (~2.5 MB).

To add another saved page, repeat that extraction, drop it in the folder for its
system, give it a `doc-category` meta tag and the back link, then run
`node build-index.cjs` from `docs-site/`. `document-style-guide.md` section 11
lists what an HTML page carries beyond the printed document.

## Vercel project (one-time, dashboard)

1. Vercel → Add New → Project → import `41Labs/41labs-website`.
2. Framework Preset **Other**; **Root Directory = `docs-site`**. Static pages
   only. The project that actually carries the domain is
   **`41labs-website-e8w2`** — Vercel auto-named it on import, because
   `41labs-website` was taken by the marketing site. Both projects build from
   this one repo; they differ only in Root Directory.
3. Deploy. Verify on the `*.vercel.app` URL.
4. Project → Settings → Domains → add `docs.41labs.ai`. Vercel then shows the
   DNS record it expects.

## Cloudflare DNS

Add in the `41labs.ai` zone:

| Type  | Name   | Content                 | Proxy                 |
|-------|--------|-------------------------|-----------------------|
| CNAME | `docs` | `cname.vercel-dns.com`  | DNS only (grey cloud) |

Keep it **DNS only**. Orange-cloud proxying in front of Vercel breaks the
domain-verification and certificate issuance flow unless Cloudflare SSL mode is
Full (strict) and Vercel has already issued the cert. Verification usually
completes within a few minutes; then `https://docs.41labs.ai` serves the index.

## Notes

- Both the meta tag and the `X-Robots-Tag` header set `noindex, nofollow`, and
  `robots.txt` disallows everything — these are operator docs, not marketing
  pages. Drop those three if a page should ever rank.
- The subdomain is unlisted, not access-controlled. Anyone with the URL can read
  it. The index lists every page under `hermes/`, `private/` included, so a
  per-client guide is one click from the index rather than hidden behind an
  unguessable filename. Treat the whole site as readable by anyone who reaches
  it. If a guide must not be, put Vercel Password Protection (Deployment
  Protection) on the `41labs-website-e8w2` project — a random filename is not
  access control.
- `cleanUrls: true` means `/hermes/whatsapp-onboarding-runbook` works without `.html`.
