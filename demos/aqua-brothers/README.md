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
| `media/reel-{540,360}.{webm,mp4}`, `media/reel-poster.webp` | Their Instagram reel of a bathroom walkthrough, 21.4s, tagged as a joint job with Jet Black Tiling & Interiors — credited by name in its caption, no logo used. |

**The hero clip and the reel are two different edits of the same source video** (the
bathroom walkthrough, tagged as a joint job with Jet Black Tiling & Interiors) — the hero is
a 15.2s seamless ping-pong loop of part of it, the reel is the fuller 21.4s cut. The hero's
caption now credits both trades on two lines, matching the reel.

**Deliberately not used:** the three stock photos on their current site (house plans, a
tap, a gas burner), and any suburb, address or job location — none is published anywhere
by them, and the brief for this demo says never to guess one.

**Facebook and Instagram could not be read live from here** (Facebook shows a login wall,
Instagram rate-limits). The photos and video above are the ones Pat downloaded and
supplied directly.

## What's new here (beyond the Eurotech template)

Round 1 added five "big ideas" on top of the original build:

- **The triage console.** Each "What's going on?" answer panel now carries a live SMS
  preview bubble showing the exact text the `sms:` link will send ("To: Michael…", typed in
  character by character), next to a big-type action card with the number as the hero
  element. The same bubble reappears in the quote section's text card, reflecting whatever
  problem was picked above, so the two sections feel connected.
- **Water-meter digit rollers** replace the count-up on the proof band. Each digit sits in
  its own masked strip and rolls to its resting value (down from 9 for "0 mess left
  behind"), so a year like "2017" never flashes a false intermediate number the way a
  count-up would.
- **Owners' trade cards + a number-led final CTA.** The About cards are built like physical
  business cards — name, "CO-OWNER", the phone number in the wide display face (a `tel:`
  link), the licences along the bottom edge, a faint drop watermark. The footer CTA echoes
  it: "Call Michael / or Angus." over two giant tappable number lines, with Text a photo and
  Free quote alongside.
- **"The pipe."** How it works now sits on a line that fills with water as you scroll
  through it — scrubbed horizontally on desktop, a plain once-off vertical fill on phones
  (no scroll-scrub there, so phone scroll stays smooth). The same hairline motif reappears
  above the footer CTA.
- **An editorial reviews spread.** The King review runs large on the left with a hanging
  quote mark and a drawn aqua underline under "organising the electrical and tiling work
  (such a relief!)"; Karen's sits quieter alongside it. No more matching boxes.

Carried over and reworked from the original build:
- **"What's going on?" problem picker** — five tiles (burst pipe, blocked drain, no hot
  water, gas smell, planning a job). Picking one reveals cautious, general safety advice
  (rewritten this round for the gas tile specifically — see "Judgement calls"), sets the SMS
  body used by every text link on the page, and pre-selects the matching job type in the
  quote form (except "Planning a job", which leaves the job type for the visitor to pick).
  Without JavaScript, all five panels sit visible as a plain list, and the tiles themselves
  stay hidden (they'd otherwise be buttons that do nothing).
- **Bento services grid** with a pointer-follow glow per tile (desktop only), consistent
  icons shared with the picker, and a highlighted 24-hour-emergencies tile with both owners'
  numbers.
- **Two-way quote section**: a text card (big "Text 0421 877 677" button, the SMS preview
  bubble, a scan-to-text QR code encoding `SMSTO:+61421877677` on wide/non-touch screens,
  trust chips and Karen's review, and an Angus fallback) next to the form card, which also
  carries a "How urgent" segmented control and an inline emergency hint when someone marks
  an emergency job type as urgent today. The form keeps itself visible and offers a retry if
  a real submit fails, rather than saying "Got it" when it didn't send.
- **A "Pause motion" toggle** (in the hero's services strip) pauses every marquee, the
  caustic light and both videos in one tap, for WCAG 2.2.2.
- **Recent work**: the Instagram reel as a tall tile beside a 2×2 photo grid (four photos not
  repeated from Services), with a keyboard-and-click `<dialog>` lightbox (Esc, close button,
  click outside, arrow keys, a "1 of 4" counter, focus returns to the thumbnail on close).

## Judgement calls

- The "Planning a job" tile no longer pre-selects a job type in the form (round 1 conversion
  fix): its own copy already asks for a free quote, and guessing "New build or renovation"
  for someone who might be planning a bathroom reno was wrong data. It leaves the form's Job
  type on "Pick the closest" instead.
  "Project management" (in the services grid) still pre-selects **Something else**, since
  organising other trades isn't one of the ten listed job types. "Heating & cooling" (added
  this round, since it's a listed line of work that had no tile) does the same.
  "24-hour emergencies" (in the services grid) is a bordered tile with both owners' call
  buttons, not a link into the quote form, since the brief's emergency triage already lives
  in the picker above.
- The "24 hr" tag in the problem picker is shown on burst pipe/leak, blocked drain/toilet
  and gas smell — the three genuinely time-critical tiles. No hot water and planning a job
  don't carry it.
- "For an emergency, calling is fastest" only appears when urgency is **Today** *and* the
  job type is one of burst pipe/leak, blocked drain/toilet or gas — the same three
  emergency categories as above. The quote form's own success message adds the same line
  when those conditions are met.
- The gas panel's advice follows Evoenergy's own guidance (get out first, then call), and
  adds their public gas-emergency line, **13 19 09** — this is a public safety number, not a
  fact about Aqua Brothers, kept because the lead ruled it in. 000 is for danger to life.
  When the gas tile is selected, the phone bar drops to a single Call button (texting isn't
  the right nudge for a gas smell).
- The job type field in the quote form now starts on "Pick the closest" rather than
  defaulting to "Burst pipe or leak", so an untouched form doesn't send a false emergency.
- "How urgent" starts with nothing selected; the payload records "Not given" if it's left
  that way, rather than us guessing "This week" on the visitor's behalf.

## Behaviour

- Header scrolls away with the hero (never fixed); a phone bar (**Text a photo** ·
  **Call**, Call primary) and a corner call button on wide screens take over after the hero,
  and stand down over the quote form, the picker's answer panels and the footer's own
  buttons. If the gas tile is selected, the phone bar drops to Call only.
  On phones, the hero itself leads with Call (full width), then Text a photo and Free quote
  side by side; desktop keeps Free quote as the primary hero button.
- The hero clip pauses when scrolled off screen, and shows its poster with a play button
  under reduced motion instead of autoplaying — the reel does the same. The reel's poster is
  a separate lazy `<img>` behind the video (not the `poster` attribute), so it doesn't load
  until it nears the screen.
- A "Pause motion" toggle (in the hero's services strip) stops every marquee, the caustic
  light and both videos at once; it's hidden entirely under `prefers-reduced-motion`, which
  already turns everything off.
- Every element's CSS default is its final state; animation only ever sets a temporary
  starting point (`gsap.fromTo(...,{immediateRender:false})` inside a ScrollTrigger). With
  JavaScript off, everything is visible, including all five problem panels — the picker
  tiles themselves stay hidden without JS, since they'd otherwise do nothing.

## Lighthouse

Run on 23 Sep 2026, against `python3 -m http.server` (uncompressed — Vercel serves this
brotli-compressed, which the tech review measured as roughly 21 KiB against this server's
103 KiB at round 0; the page has grown since, see below).

| | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| **Mobile** (3 runs) | 90 · 91 · 90 | 100 · 100 · 100 | 100 · 100 · 100 | 66 |
| **Desktop** | 100 | 100 | 100 | 66 |

Mobile (typical run): FCP ~2.5s, LCP ~3.0s, TBT 60–90ms, CLS 0. Desktop: FCP 0.4s, LCP
0.7s, TBT 0ms, CLS 0. **SEO 66 is correct**: the only failing audit is "Page is blocked from
indexing", which is the point of a demo.

Round 1 added five big ideas and rebuilt several sections, which grew the page from 105 KB
to 155 KB (25 KB to 34.5 KB gzip) and moved mobile Performance from 94 down into the high
80s/low 90s on this uncompressed local server — on Vercel's brotli it should read closer to
the desktop figures. If Pat wants the score pinned back at 94+ before the call, the next
round's easiest lever is trimming unused CSS (Lighthouse estimates ~24 KB unused) rather
than cutting features.

`tools/paint-check.mjs` passes all six conditions (desktop, 390, 375, no JS, GSAP blocked,
reduced motion) — no missing content, no horizontal scroll, no console errors, no failed
requests at any of them. A stricter clipping check (any element whose right edge exceeds
the viewport and isn't inside an `overflow:hidden`/`clip` ancestor — real content, not the
marquees or the caustic glow, which are meant to bleed past their box) also passes at 320,
360, 375, 390, 768, 1024, 1440 and 1920.

## To confirm with Aqua Brothers

| # | What | Currently |
|---|---|---|
| 1 | Opening hours | **Not shown.** Not on their current site either — only "24 Hour Emergency Service Available". |
| 2 | Which number is primary for calls and texts | Michael's 0421 877 677 is used as the primary text/quote number throughout; Angus's 0401 140 099 is offered as an alternative. Confirm this is the right split. |
| 3 | That 24-hour emergency service still runs, and covers both Michael and Angus | Their own claim, carried over as-is. |
| 4 | Service area and NSW towns | "Canberra & Surrounding Regions" and "Licensed in NSW (302135C)" are the only area claims used — no specific NSW towns are named, since none are published. |
| 5 | Roles of Michael and Angus | Both shown simply as "Co-owner" — no further role split (e.g. one doing quotes, one on tools) is claimed, and neither is shown as personally holding a plumbing/gas licence (that's the company's licence). |
| 6 | Web3Forms key | `SITE.formAccessKey` is empty, so the form runs in demo mode and sends nothing over the network. |
| 7 | Permission to use the Instagram photos and video, and to credit Jet Black Tiling & Interiors by name | Photos and the reel were supplied by Pat from their Instagram. The hero clip and the reel are two cuts of the **same** source video (a bathroom walkthrough); the reel's caption credits the tiler by name only, no logo, and the hero's caption now does too (two lines). Confirm both are fine to publish. |
| 8 | Any prices or call-out fee | None shown, matching their current site. Ask if they'd like to publish a pricing philosophy (e.g. "no call-out fee") — never a number, without one confirmed. |
| 9 | Google Business Profile | None found by search from here. Ask Aqua Brothers directly, or have Pat check Google Maps. |
| 10 | Whether Michael and Angus are each individually licensed plumbers and gas fitters | Not claimed — the fact table only says the company is licensed and insured in the ACT and NSW. The lead ruled that the title/meta may keep "Licensed Plumbers & Gas Fitters" (their own wording), but no page copy says either man personally holds a licence, or that they "founded"/"started" the company (their site says it's jointly owned by them, not founded by them). |
| 11 | Dates of the Instagram jobs shown | Not claimed — "Recent" was removed from the hero chip and the Work heading (now "Our work.") since we have no dates. |
| 12 | That the 24-hour emergency service covers the NSW side of the border too | Not distinguished on the page — the proof band and FAQ say "24-hour emergency service" without an area qualifier. |
| 13 | A privacy line for the quote form | The form's fine print now reads "Michael or Angus will call you back on this number." (their own words), replacing an invented "No spam, no sharing your details." If they want a privacy promise, we can add one once they confirm what it is. |
| 14 | Whether they mind "Aqua Brothers" being read as literal brothers | We avoid it: the footer CTA is "Call Michael / or Angus.", not "Call the brothers." |
| 15 | ACT/NSW licence-register URLs | The FAQ now answers "Can I check your licences?" with the licence numbers, but doesn't link out — the register URLs weren't confirmed, so nothing was invented. Add links once Pat has them. |
| 16 | 13 19 09 (Evoenergy's gas emergency line) | Shown in the gas-smell panel on the lead's ruling. It's a public safety number (Evoenergy's ACT gas network line), not a fact about the business — flagging in case Aqua Brothers would rather word this differently. |

## Deploy

Vercel, Root Directory `demos/aqua-brothers`, no build step. `robots.txt` and
`vercel.json` send noindex on every file. Name the project something that does not
impersonate them, e.g. `aqua-brothers-demo-frontline`.
