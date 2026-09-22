# Morning report

**Stopped on a usage limit at 16:45 UTC**, about two hours in. The limit killed
all five agents that were running at once, mid-sentence. Nothing is lost — every
step was committed and pushed to `factory` as it happened — but the queue did not
finish. This is exactly where it got to.

## The count

| | |
|---|---|
| **Built and passing `npm run check`** | 4 — sunset-pools, utopian-landscaping, south-coast-landscapes, lmac |
| **Passed an independent review** | 0 |
| **Failed one and awaiting rework** | 2 — sunset-pools (4.3), utopian-landscaping (3.7) |
| **Awaiting a first review** | 2 — south-coast-landscapes, lmac |
| **Needs you** | 1 — arizona-roofing |
| **Part-built when the limit hit** | 2 — greenway-landscapes, dp-landscaping |
| **Never started** | 7 |

Pass is 4.5+ with nothing below 4. **Every demo failed its first independent
review, and most of what they found was the factory's fault, not the demo's.**
That is the run's real result, and it is worth more than four finished demos
would have been.

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

## What to do first this morning

1. **Look at the four built demos.** `npm run build && node tools/serve.mjs dist 8900`,
   then `http://127.0.0.1:8900/<slug>/`. All four pass `check` with zero blockers
   and an empty to-confirm list.
2. **Ring Ryan at South Coast Landscapes today** — his website is hacked. Details
   under his entry below. That is worth a call whether or not he ever buys a site.
3. **Paste in the reviews you cannot get from the pull** — nothing is waiting on
   that; all four have their reviews in word for word.
4. Resume the queue when you want it. `QUEUE.csv` carries an accurate status and
   a note for every row.

## What Phase 2 is waiting on

The landscaping kit has not been touched. It is still at
`/root/.claude/uploads/1c05bee5-63ff-590e-9d61-19fa7441f3f6/9ff3ab6d-landscaping-kit.zip`
(41 files, 12 briefs numbered 01–12, `TIERS.md`, `DESIGN-RULES.md`, reference
shots). Phase 1 was never emptied, so Phase 2 correctly did not start.

---

## arizona-roofing — NEEDS PAT

**Arizona Roofing Canberra** · Oscar (Asghar Khan) · 5.0 from 20 reviews · 0421 149 431
Blocked after 12 minutes. Not built — no reviewer run.

**Why:** they have no photographs of their own work. Not one. All 40 images on
their site are stock or WordPress theme demo content, so there is no hero and no
gallery, and the floor is four.

This was checked properly rather than taken on trust from the earlier attempt.
The builder pulled their whole media library through `wp-json` (222 entries, 90
unique files), walked the sitemap including all 11 project pages, and opened 40
images at full resolution rather than judging by filename. What the "Our
Projects" gallery actually contains: a Japanese Buddhist temple roof in Kyoto, a
North American log cabin, US asphalt shingles, a Baltic red-metal cottage, and a
South-East Asian steel-frame commercial build. The page titled **"Asghar Khan,
CEO"** carries a stock studio photo of a young woman in a hard hat.

The clincher: all eleven `roof_*.jpg` files share identical XMP metadata — Adobe
Photoshop CC 2015 (Windows), document IDs in one timestamp block, every one
exported at exactly 1200×700. That is a theme author preparing demo content.
Newest upload of any kind in their library is June 2023. Nothing has been added.

The 10 stock files were deleted from `clients/arizona-roofing/assets/` so nothing
can accidentally be built on somebody else's roof. Filenames and contents are
preserved as evidence in `BRIEF.md`.

**Your opener:**
> I noticed the project gallery on your site — the one meant to show your work —
> has a Japanese temple roof and a North American log cabin in it, and the page
> with your name on it, "Asghar Khan, CEO", has a photo of a young woman in a
> hard hat who isn't you.

**The angle, for when the photos arrive:** Oscar quotes it himself, photographs
what is wrong, gives the options, then does the job he quoted. One customer got
over six quotes before picking him; another had him back a second time; all 20
reviews are five stars. Intended headline: *"Six quotes. She picked Oscar."*

**What you need to get from Oscar:**
- **6+ photos of his own finished Canberra roofs.** Phone photos are fine. At least one landscape frame 1600px or wider. This is the blocker; nothing else unblocks it.
- A mix matching what the reviews talk about: a repointed ridge, new gutters and fascia, a valley with clips, a dektite or collar, a full restoration before/after.
- A photo of Oscar himself, to replace the stock woman on his own CEO page.
- Years in business — their site only says "years of industry experience", so it was left out rather than guessed.
- The suburbs he actually covers — no review names one, so any list would be invented.
- Any licence or insurance he can name.
- Every calculator price: restoration, repairs, gutter replacement, gutter guards, roof painting, metal roof repairs. Nothing was invented; `calculator.jobs` is empty.
- Whether he genuinely does commercial work. His site claims it; not one review evidences it.

**More for the call.** Their site is a bought "Roofix" theme with the demo content
left in: four fake staff are still live (Mark Willy, Mark Rocket, Samantha Riley,
Alfred Gilbert), ten blog posts all titled *"10 reason why roofing are factmake
easier"*, and his phone printed wrong on every page as "042 1149431". His 5.0
from 20 reviews appears nowhere on the site — the testimonials shown are theme
demo quotes from stock avatars. He has the best proof a Canberra roofer can have
and is using none of it. An interstitial bot-check also delays every page load.

**Requeue this the moment the photos exist.** `config.json` and `BRIEF.md` are
ready: verified reviews, rating, owner name and phone are all in place.

---

## sunset-pools — REWORK (4.3, needs 4.5)

**Sunset Pools** · Ben Thompson · 4.7 from 25 · 1300 000 412 · trust template
Lighthouse 96 / 97 / 100. Passes `check`: no blockers, nothing to confirm.

Two independent reviews. The first scored 4.0 and found the unstyled review
cards; the second scored 4.3 and confirmed four of five findings resolved, with
**no unsourced claims anywhere on the page**.

**The one blocker left:** at 390px the pinned "Commercial and rooftop" section is
exactly 100vh, and the headline sits at viewport y 751–824 while the sticky call
bar starts at y 771. Two of its three lines are behind the bar the whole time the
section is on screen. Measured at five scroll offsets.

**Worth knowing for the call:** their site serves a Cloudflare challenge, so every
word on the demo came from a Wayback capture dated around 17 April 2026. Ten
claims are quoted page-by-page in `config._source.claimSources` — I challenged
four of them mid-run and every one turned out to be theirs.

> **Opener.** I noticed sunsetpools.com.au is putting a Cloudflare "checking your
> browser" screen in front of visitors — I could not get in at all today from
> three different browsers — and while it is doing that, the 132-step Bellevue
> Hill job and your national SPASA innovation medals are nowhere on your home page.

**Ask Ben for:** a photo of himself on a job over 1200px; **a mobile number** if he
wants the text-a-photo button back; the year he started; permission to name the
harbour rooftop and Manly clients; a typical spend for a renovation and a new
pool; his Google profile and write-a-review URLs; and confirmation of the
ten-year guarantee that appears once on his residential page.

---

## utopian-landscaping — REWORK (3.7, needs 4.5)

**Utopian Landscaping and Paving** · Derek · 5.0 from 25 · 0423 814 300 · trust
Lighthouse 95 / 97 / 100. Passes `check`: no blockers, nothing to confirm.

The reviewer called the copy the best thing on the page and the CTAs excellent,
then said Derek opens it on his phone, sees his own logo with white specks and a
grey halo, then the one gravel courtyard he has ever built — and the first two
seconds undo the rest.

**Five claims that cannot be sourced.** This is the important part, and the
reviewer fetched all five of their pages to check:
- a **"boardwalk"** that appears nowhere on their site
- thank-you notes credited to **the Year 2s** when their page shows Year 2, 4 and 6
- **"not one of them under five stars"** — unknowable from a 5.0 average
- **"working out of Canberra's south"** — inferred from a PO Box
- **St Matthew's named twice**, from one Year 4 student's testimonial, when their
  own gallery calls that job "HF Sensory Playground"

Also: the logo asset is damaged (white drop-shadow squares behind every mark, a
grey fringe on every stroke, the flourish clipped), and `slate-courtyard` is used
as hero, gallery tile 1 and the share card.

> **Opener.** I noticed the title on your homepage — the bit that shows up in
> Google and on the browser tab — says "Building Surveyor For Government
> Contracts", which is probably not what you want people searching for a Canberra
> landscaper to read first.

**Ask Derek for:** a photo of himself (none exists anywhere); the original logo,
vector or high-res; the year he started; his Google profile URL; the full text of
three shortened reviews; Aaron's actual role; whether St Matthew's is right and
whether he is happy to be named; and whether the sensory-garden photos with
children in them could ever be cleared.

**Correction to my own briefing:** I told the builder their `http://` site was a
weakness. It checked — the site 301s to https with HSTS preload, so it is not
insecure. Do not lead with that; Derek could disprove it in ten seconds.

---

## south-coast-landscapes — AWAITING REVIEW (self-scored 4.7)

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

## lmac — AWAITING REVIEW (self-scored 4.67)

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

## greenway-landscapes — PART-BUILT

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
