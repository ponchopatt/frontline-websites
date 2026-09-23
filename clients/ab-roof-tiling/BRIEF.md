# AB Roof Tiling — brief

**Status: BUILD.** Their live site is a 2013-era, JS `document.write` "mobile
template" (HTTrack-mirrored from a template called `t33-mobi-BizBlue`), but its
hidden Pranas.NET photo gallery holds 15 real, sharp, full-colour job photos —
the best find of any old-template client so far. See photo inventory below.

---

## Who they are

A small, established Sydney roof-tiling outfit, based at 43 Carefree Rd, North
Narrabeen (Northern Beaches), run by **Tony**. No surname is published anywhere
on the site, in the footer, or in any Google review — use first name only.

- **Owner/crew:** Tony (email `tony@abrooftiling.com.au`, mobile 0417 207 668 —
  matches the Google Business phone in data/google_reviews_top25.json). Reviews
  also name **Shane** as a crew member on at least one job ("Tony, Shane and the
  AB Roof Tiling team..." — Brendon Soo).
- **Years:** "AB Roof Tiling since 1981" appears in the meta description on every
  page, and is repeated in the home page's own body copy: "A reputation for high
  quality roofing installations since 1981..." Two independent on-page sources,
  so it's usable — but I've kept it as "since 1981" rather than computing "45
  years", per the never-invent-a-derived-number instinct.
- **Area:** Northern Beaches and North Shore, per the meta keywords. Confirmed
  by reviews across a wider footprint: Lower North Shore, Eastern Suburbs,
  Birchgrove (Inner West), and a strata job (suburb not named).
- **Services (site nav):** New Roofing, Re-Roofing, Extensions, Roof Repairs.
  Meta description adds "maintenance". About page's "What we offer" list:
  newly built roofs, roof replacements, roofing extensions, repairs.
- **Credential:** "A.B. Roof Tiling is nominated by leading roofing manufacturer
  CSR as a certified roofing specialist installer" — this exact sentence is
  repeated on about.htm, new_roofing.htm, re_roofing.htm, extensions.htm and
  roof_repairs.htm.
- **Rating:** 4.8 from 16 Google reviews (data/google_reviews_top25.json).

## What customers praise, in their words

1. **The whole roof, done in a day.** Site copy: "A.B. Roof Tiling can re-roof
   the average size home in just 1 day" (re_roofing.htm). Two independent
   reviews back this up: "replaced the terracotta tile roof on my Birchgrove
   Semi in one day" (Wayne McMahon); "replaced my entire roof in one day with
   beautiful terracotta tiles" (Chris Andia). This is the strongest, best-
   sourced claim on the whole site — three separate sources agree.
2. **Tony himself, on the tools.** "Tony was great on the tools but great with
   the neighbours" (Hagen Jewell). "Tony and colleague promptly conducted a
   physical inspection..." (Lynette Shedden). "Tony is also very responsive and
   pleasant to deal with" (Wayne McMahon).
3. **They clean up after themselves.** "left the surrounding area cleaner than
   before they arrived" (Chris Andia). "The left the site clean" (Hagen Jewell).
4. **Repeat and long-term customers.** "Tony has been taking care of all my
   roof tile jobs for several years now" (getdeckedout, 2 years ago).
5. **A no-charge, obligation-free assessment**, stated on both extensions.htm
   and roof_repairs.htm.

## THE ANGLE

**A whole roof, replaced in a single day, by Tony's own crew — not subbies —
who leave the site cleaner than they found it.** Backed by the site's own
one-day re-roofing claim AND two independent Google reviews naming specific
suburbs (Birchgrove) and specific results. Since-1981 gives it the longevity
to back the confidence.

Headline used: **"Your whole roof. Done in a day."**
Sub: New roofs, re-roofing, extensions and repairs across the Northern Beaches
and Sydney. Tony's crew since 1981 — they turn up, get it done, and leave the
site clean.

## What is weak on their current site — for Pat's call

This is a genuinely dated site and a strong "before" for a cold call.

1. **Built with 2013-era `document.write` includes** (`header.js`, `menu.js`,
   `pages.js`, `footer.js`, `menu-icons.js`) — nothing renders for a crawler or
   any JS-off view, and it still carries an HTTrack mirror comment on
   testimonials.htm dated 17 Mar 2013.
2. **Active right-click / text-selection blocking script** on every page
   (`pages.js` + inline handler), a dead UX pattern that actively fights the
   visitor.
3. **No mobile-responsive layout beyond the basic viewport tag** — table-based
   layout throughout (`<table class="header">`, `<table class="cornertable">`).
4. **The real photo gallery is buried and undiscoverable.** The 15 genuine job
   photos live in a `gallery.htm` lightbox that isn't linked from the main nav
   (only reachable via a tiny icon in the icon bar) and isn't referenced
   anywhere else on the site — most visitors will never find it.
5. **Google's own listing points at a dead-end page**: `abrooftiling.com.au/
   contact.htm`, not the homepage — flagged in the review data too.
6. **Their 4.8-from-16 Google rating appears nowhere on the site.** Real proof
   they aren't using.
7. **Fax number, not mobile-first contact**, still given equal billing on the
   contact page: "F: (02) 9913 2357".
8. **Embedded Google Maps iframe uses the old `maps.google.com.au/maps?...`
   query format**, likely to be deprecated/unreliable.
9. **No security (site is plain `http`-era in structure, though it does now
   serve over https)**, no HTTPS-only assets check attempted, generic template
   favicon.

## Photo inventory

Two image sources on the live site:

### `wgc_media/photos/0001.jpg`–`0015.jpg` — the real gallery (used)

All 15 opened and reviewed individually. All are genuine, sharp, well-exposed
job photos — a mix of large Sydney homes under construction (roof framing,
sarking, tiling in progress, crew visible on the roof) and finished terracotta/
concrete tile roofs on substantial houses. Native size **750×373 to 750×560**
(the largest the old gallery publishes — well under the 1600px hero ideal, so
the hero image here is below QUALITY.md's usual bar; flagged for Pat, and no
upscaling was applied since only a proper AI upscaler is allowed and none was
available in this session).

| File | Size | What it shows | Used as |
|---|---|---|---|
| 0001.jpg | 750×560 | Brick home, roof trusses/frame stage, scaffolding | (spare) |
| 0002.jpg | 750×448 | Crew on roof laying blue sarking over trusses | Gallery |
| 0003.jpg | 750×560 | Two crew laying sarking on a large tiled roof, ladder | Gallery |
| 0004.jpg | 750×560 | Brick home, finished dark tile roof, pool base forming | (spare) |
| 0005.jpg | 750×560 | Tight geometric shot, finished dark tile hips/ridges, blue sky | **Hero** |
| 0006.jpg | 750×501 | Large rendered estate, dark tile roof, urn/fountain | Gallery |
| 0007.jpg | 750×373 | Single-storey home, grey tile hip roof, columned portico entrance | Gallery |
| 0008.jpg | 750×497 | Large estate, grey tile roof, portico | (spare) |
| 0009.jpg | 750×491 | Estate with courtyard fountain/pool, white tile roof | Gallery |
| 0010.jpg | 750×384 | Large home, dusk, grey tile roof | (spare) |
| 0011.jpg | 750×448 | Portico entrance, grey tile roof, columns | (spare) |
| 0012.jpg | 750×507 | Two-storey estate, dusk, lit windows, dark tile roof | Gallery |
| 0013.jpg | 750×451 | Estate with lake/landscaping, dark tile roof | (spare) |
| 0014.jpg | 750×475 | Classic white mansion, dark tile roof | (spare) |
| 0015.jpg | 750×560 | Modern white home, dark tile roof, blue sky | Gallery |

8 used (1 hero + 7 gallery), well above the 4-photo minimum. 7 held as spares
if Pat wants to swap any in.

### `picts-mobi/*.jpg` — tiny template furniture (not used)

`main-image.jpg` (200×100), `home-left.jpg`/`home-right.jpg` (110×153),
`about-us-1.jpg`/`about-us-2.jpg` (223×114) — small logo-bar/banner filler
images, too small and low-value to use for hero or gallery.

No larger originals exist at any guessable path (`wgc_media/large/`,
`/originals/`, `/full/` all 404); 750px wide is the ceiling this site offers.
