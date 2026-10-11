# Xtreme Works — demo

An unsolicited demo for a cold call. **Not client work.** Read `demos/README.md` first:
it is never indexed, the link stays private, and only the business's own material is used.

One static page, no build step and no libraries (every effect is plain browser code).
Built from everything on their website and their Instagram, scraped 11 Oct 2026.

## Who they are

| | |
|---|---|
| Business | Xtreme Works Pty Ltd ("Xtremeworks Pty Ltd" on Instagram and in their page title). Family-owned concreting company |
| Work | Residential, commercial and industrial concreting: excavation, demolition, formwork, steel fixing, placing, finishing, after-care. Kerb and gutter, council crossovers, laybacks, council footpaths |
| Area | Greater Sydney, Western Sydney, the Blue Mountains and surrounding regions ("Pours across NSW" in their hero) |
| People | **Aloha Junior Kolo ("AJ")**, Director/Secretary · **Teufolau Kolo**, Site Manager and Founder · **Daniel Ibrahim**, Operations Manager · **Daniel Tupou**, who says in their brand film that he is a director and a current NRL player for the Sydney Roosters |
| Phone | **0433 597 455** |
| Email | info@xtremeworks.com.au · plans for commercial/industrial to **AJK.xtremeworks@hotmail.com** (their FAQ) |
| Hours | Mon–Sat 7am–6pm, Sun 7am–3pm |
| Claims on their site | 15+ years, 200+ projects, 200+ satisfied clients, 30+ skilled professionals; licensed, insured, AS 3600 |
| Clients (their logo strip) | TOTAL Construction, Patterson Building Group, FORMCOM, Mountview Construction, Jensen Projects |
| Current site | xtremeworks.com.au (Wix) |
| Instagram | instagram.com/xtremeworks.au — 2,594 followers, 17 posts; top reel 235K plays |

## Worth raising on the call

- **Their best marketing isn't on their website.** The brand film with Daniel Tupou has 235,000+
  plays and 15,600 likes on Instagram; the Croydon Park drone reel, the four-part Roselands series
  and AJ's Abbotsford reel are all excellent. None of it is on the site.
- **Almost every photo on their site is stock.** The big "About" photo is from Pexels (its file
  name is still `pexels-huu-loi-nguyen-…`), the three service cards are Wix's free library
  ("Construction Site Cementing", "Building a Bridge" — a bridge they didn't build), and the hero
  video is generic tower-crane footage. Their own 15 job videos are hidden in "Hover to see"
  galleries on two sub-pages.
- **Broken links.** "Industrial Projects → Explore" and a second "Residential Projects" link go
  to a 404 page ("There's Nothing Here..."). **Contact** and **About** in the menu just reload the
  homepage. The FAQ lives at `/about-6`.
- **The careers email is wrong:** the homepage says `info@xtremeworks.com` (no `.au`), so CVs bounce.
- **The social icons don't work.** On the homepage, TikTok and Instagram link nowhere; on the FAQ
  page the Instagram icon goes to **Wix's own Instagram** (instagram.com/wix).
- **The process section (01–04) is headed "RESIDENTIAL PROJECTS"** by mistake.
- Grey text on grey, a navy logo on a grey video, the same quote form twice on one page.
- **Daniel Ibrahim's team photo has a "DeeVid AI" watermark** in the corner.
- **One Instagram caption has the wrong number** (24 Jul 2026: "0443 597 455").
- **Plans go to a Hotmail address.** Builders sending drawings to `AJK.xtremeworks@hotmail.com`
  looks less established than `plans@xtremeworks.com.au` would.

## What the demo does

- **Hero: three bays of their own footage** (pour, screed, finish) on wide screens; on a phone,
  one bay plays all three in a row. A live **open/closed status** in Sydney time from their
  hours. The headline **sets like concrete** on load: each letter hardens from thin to full
  weight, left to right, without the line ever reflowing. Runs once; off under reduced motion.
- **Trusted by** their five client logos and the Patterson Building Group testimonial.
- **"One crew, every stage of the pour"**: six stages in job order, all in their own FAQ words,
  then three lanes (Residential, Commercial & industrial, Council & civil) with their footage.
- **Croydon Park, 1,600 m²**: the number counts up, beside their drone shot of the slab, with
  their own caption quoted.
- **Project Roselands, start to finish**: their four Instagram phases as a scroll story. On
  desktop the clip stage stays put while the phases scroll past and a hi-vis "level line" fills;
  on phones each phase carries its own clip.
- **Finishes + "When can I use my new slab?"**: their seven finishes, and a calculator that takes
  a pour day and gives the walk-on, light-vehicle and full-strength dates from their FAQ
  (24–48 hours, 7 days, 28 days), marking where today sits.
- **"Straight off the slab"**: a wall of ten of their own site clips (they only play on screen),
  and Stage 2 Gymea with their own project list and photos.
- **The crew**: AJ, Teufolau and Daniel Ibrahim, the crew photo, and Daniel Tupou with his own
  quote from the film (linked to Instagram, not re-hosted: it contains NRL broadcast footage).
- **Process 01–04** in their words. **Instagram row** with play counts. **All 36 FAQ answers**
  with topic chips and search (highlights matches).
- **Two-way quote**: homeowners book a site inspection (form); builders get their own checklist
  ("Plans, Site address, Required finishes, Engineering notes, Project timeframes") and an
  "Email the plans" button that opens an email to their plans address with the details filled in.
- Phone bar (Call / Free quote) after the hero; a Pause video button; every clip loads only after
  the page has loaded and plays only while on screen.

Every element's CSS default is its finished state. With JavaScript off, every clip shows its
poster and all 36 FAQ answers are on the page.

## Assets — all their own

| File | Source |
|---|---|
| `assets/logo-navy-*`, `logo-white-*`, `logo-navy.png` | Their logo (transparent PNG from their site), trimmed; the white version is the same artwork recoloured for dark backgrounds |
| `assets/favicon-32.png`, `apple-touch-icon.png`, `icon-512.png`, `og-xtreme.jpg` | Built from their logo; the share card adds a frame of their own trowel footage |
| `assets/team-aj-*`, `team-teufolau-*` | Their team page portraits, cropped |
| `assets/site-daniel-aj-*` | Instagram, 10 Sep 2026 ("Iron Sharpens Iron") — AJ and Daniel Tupou on site |
| `assets/crew-backs-*`, `crew-front-*` | Instagram, 22 Apr 2026 |
| `assets/gymea-*` | Instagram, 15 Jan 2026 ("Stage 2 - Gymea") |
| `assets/reel-*` | Cover frames of their Instagram reels |
| `assets/client-*` | The five client logos from their "Trusted by our clients" strip, white background removed |
| `media/bay-*`, `hero-phone.*` | Their site's residential videos and their Croydon Park reel |
| `media/roselands-1…4` | Their four Project Roselands reels (Mar 2026) |
| `media/croydon.*` | Their Croydon Park reel (Jul 2026), drone shots |
| `media/abbotsford.*` | AJ's Abbotsford reel (May 2026) |
| `media/wall-*` | The 15 project videos on their website (iPhone HDR, tone-mapped to normal colour) |

All audio is stripped. Clips are trimmed to the clean shots: no captions, title cards or logo end
cards from the reels are shown.

**Deliberately not used:** every stock image on their site (the Pexels photo, the Wix library
service photos, the tower-crane hero video), Daniel Ibrahim's AI-watermarked portrait (he gets a
monogram instead), and the brand film itself (linked, not re-hosted, because of the NRL footage in
it). The five oldest Instagram posts weren't reachable without a login.

## To confirm with Xtreme Works

| # | What | Currently |
|---|---|---|
| 1 | Daniel Tupou: role, and permission to feature him | Shown as "Director at Xtreme Works, and a current NRL player for the Sydney Roosters" — his own words in their film. He is not on their team page. |
| 2 | Years in the industry | The site says **15+ years**; the film says **"20 years in the industry"**. The demo uses 15+. |
| 3 | "200+ projects", "30+ crew" | Their own homepage numbers, carried over. "200+ satisfied clients" is left out (it repeats the project count). |
| 4 | Permission to use the Instagram footage and photos, and the client logos | All from their own accounts and site. |
| 5 | Where the hero's three bays were filmed | Not claimed. The bays are labelled only by step (Pour, Screed, Finish). |
| 6 | Licence numbers | None published; the demo says "Licensed & insured" and "Works to AS 3600", their own words. Add numbers if they have them. |
| 7 | Plans email | Uses `AJK.xtremeworks@hotmail.com` from their FAQ. Suggest a domain address. |
| 8 | Careers email | The demo uses `info@xtremeworks.com.au`, assuming the `.com` on their site is a typo. |
| 9 | The testimonial | Quoted verbatim: "…and a genuinely great people to deal with." Ask Patterson if the "a" can go. |
| 10 | "About six tennis courts" | Our comparison, not theirs: 1,600 m² ÷ 260.9 m² (a doubles court) ≈ 6.1. Drop it if they'd rather not. |
| 11 | Instagram play counts | As of 11 Oct 2026, labelled "as of October 2026". They'll go stale. |
| 12 | Web3Forms key | `SITE.formAccessKey` is empty, so the homeowner form runs in demo mode and sends nothing. |
| 13 | Finish swatches | Drawn in CSS, labelled as drawings. Swap for photos of their own finishes when they have them. |

## Checks

- `tools/paint-check.mjs` passes all six conditions (desktop, 390, 375, no JS, GSAP blocked,
  reduced motion): no missing content, no horizontal scroll, no console errors, no failed requests.
  Run it with `CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` in this sandbox.
- Lighthouse (local `python3 -m http.server`, uncompressed): **mobile 94 · 100 · 100**,
  **desktop 100 · 100 · 100** (Performance · Accessibility · Best Practices). SEO 66 is correct:
  the only failing audit is "Page is blocked from indexing", which is the point of a demo.

## Deploy

Vercel, Root Directory `demos/xtreme-works`, no build step. `robots.txt` and `vercel.json` send
noindex on every file.

**Name the Vercel project `xtreme-works-demo-frontline`**, or update the hard-coded URLs: the
OG/Twitter tags (`og:url`, `og:image`, `twitter:image`) and the JSON-LD block (`url`, `logo`,
`image`) all point at `https://xtreme-works-demo-frontline.vercel.app/`.
