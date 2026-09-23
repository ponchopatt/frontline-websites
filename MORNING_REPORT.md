# Morning report

**Live status, updated after every client.** The run hit a usage limit at 16:45
UTC yesterday and restarted this morning under your rule: keep going, no
approvals, every demo must pass an independent review (4.5+ average, nothing
below 4) and `npm run check` before it counts.

## The count

| | |
|---|---|
| **Done — passed review and check** | 2 — sunset-pools (4.5), utopian-landscaping (4.5) |
| **In independent review** | 1 — arizona-roofing (labelled sample photos) |
| **Being reworked** | 2 — lmac (3.5), south-coast-landscapes (4.0) |
| **Being built** | 1 — greenway-landscapes |
| **Part-built** | 1 — dp-landscaping |
| **Not started** | 7 |

Each done demo has its own branch: `demo/sunset-pools`, `demo/utopian-landscaping`.
Nothing touches `main`.

## Invented facts are now impossible, not just caught

`npm run check` fails any page with a fact that has no source. Every number with
a unit, year, price, licence number, owner surname, award or body, and every
credential word (licensed, insured, free consultation, warranty, guarantee,
certified, qualified, fixed price, family-run) must appear word for word in the
config's `_source` evidence or the Google review pull. Run over the four built
demos, it stripped ten claims from South Coast and re-sourced LMAC's warranty
from their installation page. Facts you confirm with an owner go in
`_source.confirmed`, with who and when.

## Four factory bugs, all fixed and pushed

1. **The trust template never declared the `--fl-*` tokens** the shared blocks
   are styled against. Review cards rendered with no background and no border,
   quotes floating above detached grey slabs. On every trust demo.
2. **Quote-template dark sections inherited the light theme's ink**, so the trust
   bar measured **1.06:1** — invisible. It was doing this on
   `canberra-to-coast-fencing`, your own reference client, too.
3. **The stats bar appended "+" to every count**, so a verified 25 reviews
   printed as "25+". QUALITY.md says never round up.
4. **`smsHref` built a text link from any number.** Sunset Pools publish a 1300,
   which cannot receive SMS in Australia — so "Text Ben a photo", the orange
   primary in the sticky bar, the hero and the enquiry block, opened a message
   that would never arrive. It now only renders for a real mobile.

`npm run check` gained two new gates so none of these can come back quietly: it
fails on a CSS custom property that resolves to nothing, and it measures contrast
on every visible piece of text after animations have run. Writing the second one
caught a fifth bug — a hard-coded `#8F959C` disclaimer at 2.66:1 on the dark
panel.

## What to do first

1. **Look at the done demos.** `node tools/single.mjs <slug>` writes one
   self-contained file to `dist-single/<slug>.html` that opens on a phone.
2. **Ring Ryan at South Coast Landscapes today** — his website is hacked. Details
   under his entry below. Worth a call whether or not he ever buys a site.
3. Nothing else is waiting on you. The queue keeps going.

## What Phase 2 is waiting on

The landscaping kit has not been touched. It is still at
`/root/.claude/uploads/1c05bee5-63ff-590e-9d61-19fa7441f3f6/9ff3ab6d-landscaping-kit.zip`
(41 files, 12 briefs numbered 01–12, `TIERS.md`, `DESIGN-RULES.md`, reference
shots). Phase 1 was never emptied, so Phase 2 correctly did not start.

---

## arizona-roofing — IN REVIEW (sample photos)

**Arizona Roofing** · Oscar (Asghar Khan on his site) · 5.0 from 20 · quote template
Lighthouse 93 / 96 / 100. Passes `check`.

Their site has no photos of their own work — the "Our Projects" gallery is theme
stock (a temple in Kyoto, a log cabin). Under your go-ahead the demo uses nine
labelled sample photos of Australian roofs (Unsplash licence and CC0, each
credited in the config), and every one carries a visible "Sample photo" tag.

Headline: "Over six quotes. She picked Oscar." — Pauline Okai-Davies's words.
Do not say "all five-star": her review is four stars.

> **Opener.** I noticed the "Our Projects" gallery on your site shows a temple in
> Kyoto and a log cabin, not one Canberra roof — yet one of your Google reviewers
> got over six quotes and still picked you.

**Ask Oscar for:** six or more photos of his own Canberra jobs (one wide for the
hero); years in business; suburbs; licence and insurance numbers; price ranges
for the six calculator jobs; reply time and hours; and whether the banner should
say Oscar or Asghar.

## sunset-pools — DONE (4.5)

**Sunset Pools** · Ben Thompson · 4.7 from 25 · 1300 000 412 · trust template
Lighthouse 92 / 97 / 100. Branch `demo/sunset-pools`.

Seven independent reviews: 4.0, 4.3, 4.25, 4.08, 4.42, 4.33, **4.5**. Each round
found a factory bug or a claim that went past the source, and each was fixed.
The last reviewer checked every hard fact against Wayback copies of Ben's own
pages — the 132 steps, the SPASA golds, licence 166547C, and that Sunset built
the Strathfield and Wentworth Point pools — and all hold. "What's left is
polish, not risk."

No text button: 1300 numbers cannot receive a text in Australia, so the page
only offers Call.

> **Opener.** I noticed sunsetpools.com.au puts a Cloudflare "checking your
> browser" screen in front of visitors, and while it does, the 132-step Bellevue
> Hill job and your national SPASA golds are nowhere on your home page.

**Ask Ben for:** a photo of himself on a job; a mobile if he wants a text
button; the year he started; OK to name the harbour and Manly clients; typical
spend for a renovation and a new pool; his Google review links; and the
ten-year guarantee in writing.

**Polish left (not blocking):** the harbour-photo section scrolls dark for about
a screen and a half on a phone; the lap-pool statement photo has blurry trees
along the top.

## utopian-landscaping — DONE (4.5)

**Utopian Landscaping and Paving** · Derek · 5.0 from 25 · 0423 814 300 · trust
Lighthouse 91 / 97 / 100. Branch `demo/utopian-landscaping`.

Three reviews: 3.7, 3.58, **4.5**. Fixed along the way: the clipped "utopian"
wordmark (the "p" now has its tail); one property used in five photo slots (now
15 slots, 15 different jobs); promises about Derek his site never makes; and
hidden search data that called Derek the founder and put Queanbeyan, Yass and
Crookwell in the ACT. That last one was a factory bug, fixed for every demo.

> **Opener.** I noticed the title on your homepage — the bit that shows in
> Google and on the browser tab — says "Building Surveyor For Government
> Contracts", which is not what someone searching for a Canberra landscaper
> expects to read first.

**Ask Derek for:** a photo of himself; the original logo; the year he started;
his Google review links; the full text of three shortened reviews; and whether
the gallery 6 lawn is real or synthetic.

Do not lead with "your site is http" — it redirects to https, so it is secure.

## south-coast-landscapes — REWORK (review 4.0, needs 4.5)

**South Coast Landscapes** · Ryan · 4.8 from 24 · 0402 130 046 · trust
Lighthouse 94 / 97 / 100. Passes `check`: no blockers, nothing to confirm.
I predicted this one would be blocked. It was not — the builder got through the
SiteGround challenge on about one attempt in three, with the real user agent and
TLS verification left on.

### Ring Ryan today. Their website is hacked.

Injected SEO spam is sitting in the live body copy of their home, irrigation and
contact pages — replica watches and vapes. Two spam images were uploaded into
their media library in October 2022, and the photo inventory rejected both as
stock before working out why they were there: **a cannabis-leaf close-up and a
4WD on a sand dune**. WordPress running Revolution Slider 5.4.6.2, a known way
in. Footer copyright says 2019.

> **Opener.** I noticed the 'Our Work' band on your home page is printing a line
> of code where your photos should be, and there's replica-watch and vape spam
> sitting in the text just above your footer — meanwhile that professional shoot
> of the Port Kembla and Dapto jobs is buried three clicks deep and your 4.8 from
> 24 reviews isn't on the site at all.

**Flagged:** the hero is 1500px against the 1600px bar — their professional
shoots stop there and everything wider is a phone snap. Their email and street
address are deliberately off the page: their site publishes two of each and
contradicts itself.

**Ask Ryan for:** which email is live (`.net.au` or `.com.au`); which address is
current (Marshall St Dapto or West Dapto Rd Horsley); one landscape photo 1600px
or wider; years trading and his licence number; a price band; the full text of
four shortened reviews; and his surname if he is happy for it to appear.

---

## lmac — REWORK (review 3.5, needs 4.5)

**Lower Mountains AirConditioning** · Andrew and Anthea Strathdee · 4.8 from
**331** reviews · (02) 4735 6411 · quote template
Lighthouse 97 / 96 / 100. Passes `check`: no blockers, nothing to confirm.

331 reviews is six times the next best in the queue, and it appears nowhere on
their own website. Third-generation family business, same Emu Plains shopfront
since 1988. Every one of ~45 factual claims on the page is quoted from their own
site in `config._source`.

> **Opener.** I noticed your homepage has a few hundred words of foreign-language
> casino links injected into it, sitting a couple of paragraphs under the bit
> about Andrew's grandfather — and while I was in there I saw the Installation
> page still has "Lorem Ipsum is simply dummy text" on it.

Softer version if that is too blunt to lead with: *"You've got 331 Google reviews
at 4.8 — the most of any trade I've looked at out your way — and that number
doesn't appear anywhere on your own website."*

**The one real weakness:** they have no photograph of a finished installation
anywhere. The gallery is honestly titled "The people who do the work" and shows
team, fleet and showroom. Their 28 suburb landing pages all use the same stock
and AI-generated split-system renders.

**Ask Andy for:** every price (split, multi-split, ducted, service call-out, Air
Clean Filters); **whether a quote is free and whether there is a call-out fee** —
their site never says, so all "free quote" wording was removed; photos of
finished work; a high-resolution logo; their Google profile URL; their ABN; and
confirmation that 14 staff is still current and that he is happy for staff faces
and first names to be published.

---

## greenway-landscapes — BUILDING

**Greenway Landscapes** · Trent · 5.0 from 16 · 0418 607 124 · trust
Brief written, config written, photos downloaded. Not built — the builder was
killed mid-run. Resume from where it is; nothing needs redoing.

---

## dp-landscaping — PART-BUILT

**DP Landscaping & Design** · Dale · 5.0 from 10 · 0402 469 118 · trust
Photos downloaded, config started, no brief. Killed mid-run.

The angle is already clear from the reviews and no competitor can copy it: his
customers keep him for years. *"15 years ago, Dale landscaped our property & has
continued to maintain the gardens ever since."* *"Dale has worked with us for 10
years."* Neither is a years-in-business number and neither should become one.

---

## Not started

horgan-building · nb-earthmoving · karanda-interiors · forest-joinery ·
ab-roof-tiling · dimension-gardenscape · great-southern-pools

horgan-building already exists as a client from the earlier test build and passes
`check` with its verified 5.0 from 5 in place; it needs the full QUALITY.md
treatment rather than a rebuild from nothing.

---

## Notes for whoever runs this next

- **Builder agents have no Agent tool.** Four of them wasted time discovering
  that. The fresh-reviewer step belongs to the loop, not the builder.
- **The shared scratchpad is not isolated.** Two agents found each other's
  downloads overwriting their own. Give each builder a private subdirectory.
- **Four concurrent builders is the ceiling on 4 cores**, and Lighthouse run
  concurrently reports depressed numbers. Verify performance serially.
- **`clients/*/shots/` is gitignored** — a full-page phone screenshot is 10 MB of
  undeltable PNG. `node tools/previews.mjs <slug>` writes a small webp set
  instead, including the whole page as a readable contact sheet.
