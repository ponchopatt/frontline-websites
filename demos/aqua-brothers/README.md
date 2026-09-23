# Aqua Brothers Plumbing — demo

An unsolicited demo for a cold call. **Not client work.** Read `demos/README.md` first:
it is never indexed, the link stays private, and only the business's own material is used.

Design: Imperium Detailing's system (`sites/imperium-detailing`, read only), carried over
section for section (the same DNA as the Eurotech demo), re-dressed in Aqua Brothers' own
navy and aqua, taken from their logo and Instagram tile.

## Who they are

| | |
|---|---|
| Business | Aqua Brothers Plumbing Pty Ltd. ABN 48 618 843 691. Company since 2017 |
| Owners | **Michael Vaughan** and **Angus O'Brien**, "Canberra born and bred" (their words). Co-owners — not literal brothers |
| Phones | Michael **0421 877 677** (calls and texts) · Angus **0401 140 099**. No office line, no email, no street address |
| Licences | ACT **20171009** · NSW **302135C**. Licensed and insured in ACT and NSW |
| Work | Residential and commercial plumbing, gas fitting, heating and cooling, 24-hour emergencies |
| Area | Canberra and surrounding regions, both sides of the ACT/NSW border |
| Current site | aquabrothersplumbing.com.au |
| Socials | instagram.com/aquabrothersplumbing · facebook.com/aquabrothers.plumbing.94 |

## Worth raising on the call

- **Their live site hasn't changed since 2017.** Footer copyright reads "© 2017", and
  nothing on it is newer than 2018. It runs on GoDaddy's Website Builder with three stock
  photos (house plans, a tap, a gas burner) — none of their own work.
- **The site asks people to "email us your testimonial" but publishes no email address
  anywhere.** There's nowhere to send it.
- **The contact form still asks for a US "Zip Code"** ("Address (Street, City, Zip Code)"),
  a leftover of the American template it was built from.
- **Broken words from the page builder**: "I ncluding footings", "t o remove blockages" —
  stray spaces mid-word that read as sloppy.
- **Almost no proof.** Two testimonials, both from 2018. Their ServiceSeeking profile
  ("5.0 from 3 reviews") has been deleted. No Google Business Profile was found by search.
  Facebook is a personal profile (`aquabrothers.plumbing.94`), not a business Page, so it
  can't collect reviews at all.
- **24-hour emergency service and licences in both ACT and NSW are strong, differentiated
  claims** — and on the current site they're buried halfway down the page in plain text,
  not shown up front.

## Assets — all their own

| File | Source |
|---|---|
| `assets/logo-full-{320,640,1280}.webp`, `assets/logo-mark-{120,240,480}.webp` | Their own logo (the "ABP" mark with the water drop in the A), supplied by Pat as a transparent PNG and re-exported at these sizes. The header uses the mark; the footer column uses the full lockup. |
| `assets/bath-marble-*`, `kitchen-island-*`, `bath-freestanding-*`, `shower-black-*`, `bath-green-*`, `kitchen-black-*`, `house-exterior-*` | Their own completed jobs, from Instagram, supplied by Pat. Cropped to remove Instagram's black bars. |
| `assets/qr-text-michael.svg` | Generated to encode `SMSTO:+61421877677`, so scanning it opens a pre-filled text to Michael. |
| `assets/og-aqua.jpg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-512.png` | Built from the logo mark for link previews and browser tabs. |
| `media/hero-{720,540}.{webm,mp4}`, `media/hero-poster.webp`, `media/hero-blur.webp` | A bathroom walkthrough — a floating vanity under LED strip lighting — from their Instagram, supplied by Pat. Edited to a 15.2s seamless ping-pong loop. |
| `media/reel-{540,360}.{webm,mp4}`, `media/reel-poster.webp` | Their Instagram reel of a bathroom renovation, 21.4s, tagged as a joint job with Jet Black Tiling & Interiors — credited by name in its caption, no logo used. |

**Deliberately not used:** the three stock photos on their current site (house plans, a
tap, a gas burner), and any suburb, address or job location — none is published anywhere
by them, and the brief for this demo says never to guess one.

**Facebook and Instagram could not be read live from here** (Facebook shows a login wall,
Instagram rate-limits). The photos and video above are the ones Pat downloaded and
supplied directly.

## What's new here (beyond the Eurotech template)

- **"What's going on?" problem picker** — five tiles (burst pipe, blocked drain, no hot
  water, smell gas, planning a job). Picking one reveals cautious, general safety advice,
  sets the SMS body used by every text link on the page, and pre-selects the matching job
  type in the quote form. Without JavaScript, all five panels sit visible as a plain list —
  nothing is lost.
- **Bento services grid** with a pointer-follow glow per tile (desktop only) and a
  highlighted 24-hour-emergencies tile with a call button built in.
- **Two-way quote section**: a text card (big "Text 0421 877 677" button, a scan-to-text QR
  code encoding `SMSTO:+61421877677` on wide/non-touch screens, and an Angus fallback) next
  to the form card, which also carries a "How urgent" segmented control and an inline
  emergency hint when someone marks an emergency job type as urgent today.
- **Drop-shaped step numbers** and a drop-icon motif (bullet markers, marquee separators,
  the pulsing "24-hour" dot) throughout, drawn from the drop inside the logo's A.
- **Recent work**: the Instagram reel as a tall tile beside a photo grid, with a
  keyboard-and-click `<dialog>` lightbox (Esc, close button, click outside, arrow keys,
  focus returns to the thumbnail on close).
- **Two editorial review cards** instead of Imperium/Eurotech's drifting review wall —
  there are only two testimonials to show, and a wall needs dozens to not look empty.

## Judgement calls

- The "Planning a job" tile in the problem picker pre-selects **New build or renovation**
  as the closest job type, since its copy is about renovations/new builds/non-urgent work
  and there's no exact "planning" option in the form's job-type list.
  "Project management" (in the services grid) pre-selects **Something else**, for the same
  reason — organising other trades isn't one of the ten listed job types.
  "24-hour emergencies" (in the services grid) is a bordered/call-button tile, not a link
  into the quote form, since the brief's emergency triage already lives in the picker above.
- The "24 hr" tag in the problem picker is shown on burst pipe/leak, blocked drain/toilet
  and smell gas — the three genuinely time-critical tiles. No hot water and planning a job
  don't carry it.
- "For an emergency, calling is fastest" only appears when urgency is **Today** *and* the
  job type is one of burst pipe/leak, blocked drain/toilet or gas — the same three
  emergency categories as above.

## Behaviour

- Header scrolls away with the hero (never fixed); a phone bar (**Text a photo** ·
  **Call**) and a corner call button on wide screens take over after the hero, and stand
  down over the quote form and the footer's own buttons.
- The hero clip pauses when scrolled off screen, and shows its poster with a play button
  under reduced motion instead of autoplaying — the reel does the same.
- Every element's CSS default is its final state; animation only ever sets a temporary
  starting point. With JavaScript off, everything is visible, including all five problem
  panels.

## Lighthouse

Run on 23 Sep 2026.

| | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| **Mobile** | 94 | 100 | 100 | 66 |
| **Desktop** | 100 | 100 | 100 | 66 |

Mobile: FCP 2.0s, LCP 2.9s, TBT 20ms, CLS 0. Desktop: FCP 0.5s, LCP 0.6s, TBT 0ms, CLS 0.
**SEO 66 is correct**: the only failing audit is "Page is blocked from indexing", which is
the point of a demo.

`tools/paint-check.mjs` passes all six conditions (desktop, 390, 375, no JS, GSAP blocked,
reduced motion) — no missing content, no horizontal scroll, no console errors, no failed
requests at any of them.

## To confirm with Aqua Brothers

| # | What | Currently |
|---|---|---|
| 1 | Opening hours | **Not shown.** Not on their current site either — only "24 Hour Emergency Service Available". |
| 2 | Which number is primary for calls and texts | Michael's 0421 877 677 is used as the primary text/quote number throughout; Angus's 0401 140 099 is offered as an alternative. Confirm this is the right split. |
| 3 | That 24-hour emergency service still runs, and covers both Michael and Angus | Their own claim, carried over as-is. |
| 4 | Service area and NSW towns | "Canberra & Surrounding Regions" and "Licensed in NSW (302135C)" are the only area claims used — no specific NSW towns are named, since none are published. |
| 5 | Roles of Michael and Angus | Both shown simply as "Co-owner" — no further role split (e.g. one doing quotes, one on tools) is claimed. |
| 6 | Web3Forms key | `SITE.formAccessKey` is empty, so the form runs in demo mode and sends nothing over the network. |
| 7 | Permission to use the Instagram photos and video, and to credit Jet Black Tiling & Interiors by name | Photos and the reel were supplied by Pat from their Instagram; the reel's caption credits the tiler by name only, no logo. Confirm both are fine to publish. |
| 8 | Any prices or call-out fee | None shown, matching their current site. Ask if they'd like to publish a pricing philosophy (e.g. "no call-out fee") — never a number, without one confirmed. |
| 9 | Google Business Profile | None found by search from here. Ask Aqua Brothers directly, or have Pat check Google Maps. |

## Deploy

Vercel, Root Directory `demos/aqua-brothers`, no build step. `robots.txt` and
`vercel.json` send noindex on every file. Name the project something that does not
impersonate them, e.g. `aqua-brothers-demo-frontline`.
