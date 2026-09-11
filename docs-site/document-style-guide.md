# Document style guide

The style of a 41 Labs document. A document is a short guide that takes one
non-technical reader through one task. Examples: how to share a calendar, how to
connect a payment account, how to give access to a data source.

This page holds the style only. It is the one source for both output formats:

- A PDF, for the file you send.
- An HTML page, for the same guide on a screen or in a browser print.

Build either format from this page. Do not copy a style from an older document,
because an older document can be wrong. Two renderings of the same content must
look the same on A4, page for page.

**How to read a value.** All sizes are points, unless the unit is mm. A type
value of `10 / 15.5` means a size of 10 pt and a line height of 15.5 pt. A rule
value of `2.5` means a line 2.5 pt thick.

---

## 1. What the document may say

Section 1 outranks every other section. A document that breaks a rule here does
not go out, however well it is set.

One document goes to every reader unchanged. The same file is sent to readers
who do not know each other and must not learn of each other. Nothing in a
document may be true of only one reader.

### 1.1 Names

- Name **Hermes** and **41 Labs**. Name no other business and no person.
- No reader's company name, no brand of a reader, no person's name, no job
  title of a named person, no signature.
- No value that belongs to one reader: no email address, no phone number, no
  account id, no workspace name, no token, no price.
- A value that differs per reader is never printed. The step sends the reader to
  the screen where they read their own value.
- Name a third-party product only where the reader must click it, and only by
  the name on the screen. Example: the name of the platform the reader signs
  into.

### 1.2 Voice

- Write to the person who performs the steps. That reader owns the accounts,
  opens the screens and does the clicking.
- Never write about a third party who acts instead of the reader. Cut "the
  client", "their number", "their account", "on their behalf", "the customer".
- Every sentence does one of three things: tell the reader what to do, tell the
  reader what to type, or tell the reader what they will see.

### 1.3 Cut everything else

Delete a sentence that carries any of these:

- Reassurance about a commercial arrangement.
- Who owns an account, a number or an asset, and what that means.
- Why the system is arranged this way, or how it works behind the screen.
- A risk of the arrangement, a policy opinion, or a warning about a party.
- A note addressed to a 41 Labs operator rather than to the reader.
- Sales copy, a benefit, or a comparison with another way of working.

## 2. Colours

| Token | Value | Where it appears |
|---|---|---|
| Green | `#16a34a` | The rule under the header, the step number square, the border of a note |
| Green background | `#f0fdf4` | The background of a note |
| Ink | `#1a1a1a` | All body text, all headings, all table text |
| Muted | `#52525b` | The subtitle, the header text, the footer text, the empty checkbox |
| Rule | `#e4e4e7` | The line between table rows, the line above the footer |
| Amber background | `#fffbeb` | The background of a warning |
| Amber border | `#f59e0b` | The border of a warning |
| Code background | `#f4f4f5` | The background of a code block |

Rules:

- The page is white. There is no dark variant, because this style is for print.
- The brand green is `#4ade80`. It is too light to print on white paper. This
  style uses `#16a34a` instead. Keep this substitution.
- Green is the only accent. Amber marks a warning and nothing else.
- Use no other colour. A screenshot is the only image on the page.

## 3. Type

Helvetica for text. Courier for code. If Helvetica is not available, use the
nearest neutral sans-serif face.

| Role | Size / line height | Weight | Colour |
|---|---|---|---|
| Title | 23 / 27 | Bold | Ink |
| Subtitle | 11.5 / 16 | Regular | Muted |
| Section heading | 13.5 / 17 | Bold | Ink |
| Step heading | 11.5 / 15 | Bold | Ink |
| Body | 10 / 15.5 | Regular | Ink |
| Callout text | 9.2 / 14 | Regular | Ink |
| Table cell | 9.2 / 13.5 | Regular, or bold for a key | Ink |
| Small text | 8.8 / 13 | Regular | Muted |
| Code | 8.6 / 12.5 | Regular | Ink |
| Step number | 9.5 | Bold | White |
| Header and footer | 7.5 | Regular | Muted |

Rules:

- Bold marks a screen name, a button, or a value the reader must type. Bold is
  not emphasis. A paragraph of all bold text has no emphasis at all.
- Do not use italic.
- Do not use a heading level below the section heading. A step heading is the
  lowest level.
- Text is black on white. Do not tint body text.

**Screen.** The table above sets the printed page. The HTML page adds a screen
layer on top of it: body type scales to `13 / 20`, the title, headings, callouts
and tables scale with it, and code switches to the system monospace stack. That
layer lives in `@media screen`, so print keeps the sizes above and breaks at the
same place.

## 4. Space

The space below an element:

| Element | Space after |
|---|---|
| Title | 3 |
| Subtitle | 14 |
| Section heading | 7, and 16 above it |
| Body paragraph | 6 |
| List | 4 |
| Small text | 4 |
| Step heading | 4 |
| Step block | 9 |

## 5. Page

A4, portrait, one column. One text frame per page.

| Measure | Value |
|---|---|
| Left and right margin | 22 mm |
| Top margin | 24 mm |
| Bottom margin | 22 mm |
| Content width | 165 mm |
| Indent of a step body | 10 mm |

Every full-width element is 165 mm wide: a callout, a code block, a table, a
screenshot.

## 6. Header and footer

Every page carries the same header and the same footer.

The header has three parts, from the top:

1. The system name and the supplier name, on the left, in capitals, with a
   middle dot between them. Pattern: `HERMES · 41 LABS`. These are the only two
   names the header may carry. Never put a reader's name here.
2. The document name, on the right, in sentence case. It is the short form of
   the title, with `your` and the noun dropped: `Connecting your Stripe account`
   gives `Connecting Stripe`.
3. A green rule below both, 2.5 thick, across the content width.

The footer has three parts, from the top:

1. A grey rule, 0.5 thick, across the content width.
2. `Questions? Reply to your 41 Labs contact.` on the left.
3. The page number on the right. Pattern: `Page N`.

Rules for the page number:

- A PDF prints the number.
- An HTML page cannot count its own pages. It leaves the right side of the
  footer empty, and the print dialog of the browser adds the number.

## 7. Document skeleton

Use this order. Omit a part only if the guide does not need it.

1. Title. Every document names its task the same way: `Connecting your <thing>`.
   Examples: `Connecting your Stripe account`, `Connecting your WhatsApp number`,
   `Connecting your Google Calendar`. The index lists documents by title, so a
   second pattern here splits the list.
2. Subtitle. One sentence naming what the reader will have finished at the end.
3. Opening callout. Only when a fact is needed before step 1, such as the access
   the reader must already hold. Omit it otherwise. It is never reassurance.
4. Section: `Before you start`. One bulleted list of the accounts, the people
   and the time the reader needs.
5. Section: `Step by step`. The numbered steps.
6. Section: `Checklist`. One row for each thing the reader must complete.

## 8. Components

### 8.1 Callout

A tinted box with a coloured bar on the left edge.

| Part | Value |
|---|---|
| Width | 165 mm |
| Left bar | 2.2 thick |
| Padding, top and bottom | 7 |
| Padding, left and right | 9 |
| Text | Callout text |

There are two kinds, and no more:

- A note. Green background, green bar. It gives a fact the reader needs to
  complete the next action.
- A warning. Amber background, amber bar. It marks a step the reader cannot
  undo, or a gap such as a screenshot that is not captured yet.

Keep a callout to 3 sentences. A callout that holds a procedure is a step. A
callout is not a place for the sentences section 1.3 cuts.

### 8.2 Step

A numbered instruction block. Steps run from 1, with no gaps.

| Part | Value |
|---|---|
| Number square | 7.5 mm on each side, green background |
| Number | Step number type, white, centred in the square |
| Heading | Step heading type, beside the square, aligned to the top |
| Body | Below both, indented 10 mm from the left margin |
| Space after the block | 9 |

Rules:

- The heading names the outcome of the step, not the click. Write
  `Confirm the calendars arrived`, not `Check the list`.
- The body can hold paragraphs, lists, callouts, tables, code blocks and
  screenshots.
- Put the actions of a step in a numbered list inside the body.
- A step never breaks across two pages.

### 8.3 Key and value table

Two columns for short facts, such as the times you propose.

| Part | Value |
|---|---|
| Column one | 45 mm, bold, the key |
| Column two | 120 mm, regular, the value |
| Line between rows | 0.5 thick, rule colour |
| Last row | No line |
| Padding, top and bottom | 6 |

For short keys, use 32 mm and 133 mm.

### 8.4 Checklist

One row for each item the reader ticks by hand.

| Part | Value |
|---|---|
| Column one | 8 mm, an empty square at 13 pt, muted colour |
| Column two | 157 mm, the label |
| Line between rows | 0.5 thick, rule colour |
| Last row | No line |
| Padding, top and bottom | 6 |

Each label repeats a step in the words of the reader, and names the step number
at the end. Example pattern: `<what the reader did> (Step N)`.

### 8.5 Code block

Courier text on the code background.

| Part | Value |
|---|---|
| Width | 165 mm |
| Padding, top and bottom | 6 |
| Padding, left and right | 8 |
| Text | Code type |

Use it for an address, a command, or a value the reader must copy. Do not use it
for a screen name. Do not put a value that belongs to one reader in it.

### 8.6 Lists

- A bulleted list uses small circle bullets and a 12 pt indent.
- A numbered list uses a 14 pt indent. Use it for the actions inside a step.
- One action per item. Keep an item to one sentence.

### 8.7 Screenshot

- Full content width, 165 mm, or less if the picture is small.
- One screenshot for each screen the reader can misread.
- Put a warning callout in place of a screenshot that is not captured yet. Name
  the screen and the control the picture must show.
- A screenshot carries no name, no address and no account id. Mask any value on
  the picture that belongs to one reader.

## 9. Page breaks

- Keep a step on one page.
- Keep a callout on one page.
- Keep a table on one page.
- Keep a screenshot on one page.
- Never leave a section heading alone at the bottom of a page.
- Repeat the header and the footer on every page.

## 10. Words

- Address the reader as "you". Use the active voice.
- Keep an instruction to 20 words. Keep a description to 25 words.
- One term, one meaning. A screen keeps the same name on every page.
- Name a button or a screen exactly as the reader sees it, in bold.
- Write the full address of a page, such as a domain name, in bold body text or
  in a code block. Do not write "click here".
- Which names and which sentences are allowed at all is section 1.

## 11. The HTML page

The PDF is a file you send. The HTML page also has to be found and left again,
so it carries three things the PDF does not. All three are screen only; none of
them reaches the printed page.

1. **A section.** One meta tag in the head, directly after the title:
   `<meta name="doc-category" content="Payment">`. The index groups cards under
   it. The sections in use are `Payment`, `Messaging` and `Calendar`. A document
   with no tag lands under `Other`.
2. **A back link.** The first element inside `<body>`, above the sheet: a
   `.back-bar` holding `<a class="back-link" href="/">← All docs</a>`. It is
   hidden in `@media print`.
3. **A card on the index.** Run `node build-index.cjs` in `docs-site/` after
   adding or renaming a document. It reads the title and the section out of the
   file, so a card and its page can never disagree.

## 12. Check before you send

1. No business name and no person's name appears, other than Hermes and
   41 Labs. Screenshots included.
2. Nothing in the document is true of only one reader.
3. Every sentence tells the reader what to do, what to type, or what they will
   see. No reassurance, no ownership note, no rationale, no operator note.
4. The colours match section 2. The accent is the print green.
5. The type sizes match section 3. Bold marks only a label or a value.
6. The margins and the content width match section 5.
7. The header and the footer are on every page, and the header reads
   `HERMES · 41 LABS`.
8. The steps run from 1, with no gaps, and no step breaks across two pages.
9. Each checklist row names a step number.
10. The PDF and the HTML page break at the same place, page for page.
11. The title follows the pattern in section 7, and the running head carries its
    short form.
12. The HTML page carries a section tag and a back link, and `build-index.cjs`
    has been run.
