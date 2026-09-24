# CJG Pools & Earthworks — brief

Read 2026-09-24 off the live site, www.cjgpoolsandearthworks.com.au, with curl
(generic `Mozilla/5.0` user agent). Every page in the menu, every location page,
and the blog posts that carry job photos. `npm run new` was not run.

## Legitimacy check — passed, real local crew
- **ABN 12 603 200 200** in the footer of every page. ABN Lookup
  (abr.business.gov.au, read 2026-09-24): *CJG EARTHWORKS & POOLS PTY LTD*,
  active since 04 Dec 2014, GST registered, main business location NSW 2620.
  The name and number match the site.
- **One phone number everywhere:** 0413 997 889 in the header, footer, contact
  page and the 2026 blog posts. It matches `google_phone` in
  data/google_reviews_top25.json.
- **A named local base:** "PO Box 450 Calwell ACT 2905", "Based locally in
  Calwell".
- **Named people:** Craig. The site email is craigabsolutepools@hotmail.com, and
  the one Google review names "Craig and his team of quiet achievers, Mick and
  Joel".
- **Real job photos with suburbs:** Weetangera, Throsby (units for Lifestyle
  Homes), Googong, Forrest and Denman Prospect. They're phone shots, the kind
  a trade takes on its own jobs.
- **Industry memberships:** SPASA Australia and the Master Builders
  Association (logos in the footer and wording on 5 pages).
- No sign of a multi-city network: no other cities, no shared call centre, no
  franchise wording. Just one Canberra area.

## Who they are
A Calwell-based (Tuggeranong, ACT) pool builder that also does earthworks. They
build concrete and fibreglass pools, spas and swim spas. They also do site cuts,
excavation, drains, paving and concrete, pool resprays, pool infills,
landscaping and decking. They work across Canberra and into Queanbeyan,
Jerrabomberra and Googong. Jobs run from a pool infill to a new pool with full
surrounds.

- **Craig** runs the business (the review says "Craig and his team"). The site
  email is his too. His surname isn't published, so the page doesn't use one.
- **Mick and Joel**: crew, named in the Google review.
- Years: not given. The site only says "many years of experience" and "years of
  experience", so no number is used. ABN Lookup shows the company since Dec
  2014, but that isn't on their site, so it isn't used on the page.
- Free consultation: stated on About, Pool, Services and Contact ("We offer a
  free consultation service where we visit your home, assess the landscape and
  talk you through a range of options").
- Timelines (their Jul 2026 blog post): fibreglass "about four to six weeks";
  concrete "around three to four months". ACT approval: "We handle the approval
  process".

## What customers praise
There's only one Google review (5.0 from 1, Kerry G). Pat's note: *pitch getting
more reviews as part of the deal.*
1. **They rescue jobs.** "stepped in to rescue us after we'd been left in the
   lurch with a drainage job."
2. **Named crew, quiet workers.** "Craig and his team of quiet achievers, Mick
   and Joel".
3. **They take on work outside pools.** The full review says a drainage job
   "was not their usual type or scale of project". The demo uses only the
   `best_for_demo` wording, marked shortened.

## The angle
**"Pools, and the earthworks behind them."** It's in the business name, and it's
what the site shows once you dig into the blog. The same multi-skilled team
does the pool, the site cut, the excavation, the drains and the paving, and can
do several on one job ("We can also carry out multiple tasks on the one job –
poolbuilding, landscaping and paving for example"). The one review is about exactly
that: a drainage rescue.

## What's weak on their current site (for Pat's call)
- **The homepage has no real jobs on it.** It shows eleven "pool design" tiles
  all dated *June 29, 2016* (Classic, Oz, Miami, Caesar…). These look like
  manufacturer range photos, some with Queensland-style palms. Their real
  Canberra jobs (Weetangera, Throsby, Googong, Forrest, Denman Prospect) are
  buried in two blog posts from 2019 and 2022.
- **The earthworks half of the name is nearly invisible.** There's no
  earthworks page. Site cuts and drains appear once, in a 2019 blog post.
- **No reviews on the site**, and only 1 on Google.
- **The email is a Hotmail address called "craigabsolutepools"**, which reads
  like a different business.
- **No tap-to-call and no text button.** The number is plain text on every page (no tel: link in the HTML), and the contact form has a CAPTCHA.
- **The blog contradicts itself on build time.** The 2018 post says "five to
  six months" and the 2026 post says three to four months for concrete. Several
  blog images are Shutterstock.
- **No builder or pool licence number anywhere.** In the ACT that's the first
  thing a careful buyer looks for.
- Typos: "rejuvnate", "contactors", "compliment".

## Photo inventory
All 60 files in their WordPress media library were listed (wp-json/wp/v2/media).
Every candidate was downloaded at its full published size and opened. Nothing
reaches 1600px. Their own job photos are phone shots, 359–1000px wide. **No file
is upscaled**, but the hero still displays enlarged (see below).

**Used: their own jobs, one slot each (rework 2026-09-24)**

| File on their site | Size | Shows | Slot |
|---|---|---|---|
| 2020/03/newpool.jpg | 600×400 | Finished pool, yellow house, blue pergola. It sits in the "Concrete Pool Respray Forrest, ACT" block of the 2019 post: same tile band, cobalt pot and hedge as the after-shot | hero |
| 2022/05/New-Canberra-Pool.jpg | 480×640 | "Concrete Pool in Weetangera": paved concrete pool, solar cover | statement (native, on a mat) |
| 2022/05/googong-pool.jpg | 428×571 | "New Pool in Googong": crew setting a pool, formwork round it | services: new pools |
| 2020/03/site-cut1.jpg | 360×480 | Excavator on a pegged-out block. It's in the 2019 post's media but not shown under a named job, so no suburb is claimed | services: site cuts |
| 2020/03/pool-infill-2.jpg | 437×573 | "Filling In A Swimming Pool": after, terracotta paving over it | services: paving, resprays and infills |
| 2020/03/pool-infill-1.jpg | 437×573 | "Filling In A Swimming Pool": slab poured over mesh | owner (native, on a mat) |
| 2022/05/canberra-pool.jpg | 1000×639 | Lead photo of "Our Latest Pools in Canberra": tiled concrete pool, stone wall, travertine | gallery (a true 852×639 crop) |
| 2022/05/Throsby-Pool.jpg | 462×563 | "Fibreglass Pool in Throsby": shell arriving at the units | gallery |
| 2020/03/newpool2.jpg | 360×480 | Forrest respray, before | gallery |
| 2020/03/newpool1.jpg | 360×480 | Forrest respray, after | gallery |
| 2020/03/site-cut-denman2.jpg | 359×247 | "Site Cut Denman Prospect": benched and cleared | gallery |
| 2020/03/pool-infill.jpg | 599×399 | Pool infill: the old pool, before | gallery |

**How big they display.** No file is upscaled. The gallery, statement and
owner slots never show a photo above its real size: each file sits on a mat in
the page's card colour, sized to the slot. **Two slots still stretch a small
file**, because the template fills them edge to edge:
- **The hero** (600px wide): about 2.1x on a phone and 2.4x at 1440. It was
  moved off canberra-pool.jpg because that photo has a pink pool float behind
  the headline. A float-free crop of it left a deck chair as the subject, at
  2.5x.
- **The excavator service card** (360px): about 1.16x.

**Held back**
- 2020/03/paving.jpg and paving1.jpg (Concrete & Paving Forrest): real, but
  small (480×308) and landscape, so they'd display tiny on a mat.
- 2020/03/site-cut-denman.jpg and site-cut.jpg: near-duplicates of the
  site-cut shots already used.
- 2020/03/pool-building.jpg (fibreglass shell in sand): possibly theirs, but it
  sits on a generic cost article with no job named, so it's left out.

**Not theirs, not used**
- The 11 "pool design" images (2016/06: Classic, Contemporary, Oz, Miami, Lap,
  Hunter, Harvest, Caesar, Urban, Spa, Swim Spa; 931×512) plus the 2016/02
  service images. These are range or catalogue shots with no job or suburb, some
  with tropical planting. The "Urban" text reads like manufacturer copy ("We
  are pleased to officially unveil the latest addition").
- Shutterstock files (2017/05, 2017/08, 2017/09, 2023/02) and stock-looking
  blog art (2017/05 woman in pool, 2018/06 excavation, 2018/10, 2018/11,
  2019/03 kids at fence, 2021/02 modern pool, cordyline, agave).
- Theme and slider leftovers: revslider/*, 2016/02/background.jpg (a city
  skyline), and 2010/09 pool1–4-header.jpg (uploaded before the company existed;
  old theme headers).

**No sample photos needed.** There are 12 real ones, each in one slot.

## What Pat needs from Craig
1. **The original photos off the phone** (or the Facebook page they mention).
   Every photo on their site is a web-shrunk copy of 360–1000px. The originals
   would make this demo properly sharp.
2. **Their ACT builder or pool licence number**, so it can go on the page.
3. **Craig's surname and role**, if he wants them used.
4. **More Google reviews.** One review is the biggest gap. It's the pitch.

## Finish round (2026-09-24, after the final review at 3.83)

Pat now allows labelled sample photos. The review held this back on photos
(Hero 3, Photos 3): every photo they have online is a small web copy, so the
600px hero was enlarged 2.1–2.4x and looked smeared, and the matted gallery
cards read as thumbnails. The "No sample photos needed" line above is
superseded.

**Two sample photos, in the two large slots only.** Both are from the same
Flickr set, CC BY 2.0, by billjacobus1 (a backyard concrete pool being built,
2006). Originals are 2048×1536, downloaded from live.staticflickr.com, used at
native size or smaller, never upscaled. Each has `sample: true`, `license`,
`sourceUrl` and `credit`, and the page tags it "Sample photo". The alt text
describes the photo only and makes no claim about CJG, Craig or Canberra.
`photos.stockApproved` = Pat, 2026-09-24.

| Slot | File | Source | Shows |
|---|---|---|---|
| Hero | sample-pool-steel-1600/2048.webp, plus a 740w portrait crop for phones | flickr.com/photos/67513462@N00/125509297 | A concrete pool dug out with steel and plumbing in, spa ring at one end. This is "Pools, and the earthworks behind them" in one frame. |
| Statement (4:5) | sample-pool-dig-720/1229.webp | flickr.com/photos/67513462@N00/125509027 | Three workers in a freshly dug pool. They are not CJG's crew, and nothing on the page says they are. |

The phone hero file is a portrait crop (x 900–1720 of the original), so a phone
at 1–1.75x never gets a landscape file enlarged to portrait height. At 2–3x
the browser picks the 1600 file. `object-position: 72% 50%` keeps the spa ring
in frame either way.

**Their own photos now go only where they stay sharp at native size.**
- **Gallery:** no mats. Six 3:2 cards cut at native pixels. The grid in
  `clients/cjg-pools/styles.css` is one column on a phone (about 350px), two
  from 480px and three from 900px (389px at 1440). Nothing shows above about
  1.08x (the 360px Forrest files and the Denman Prospect file, at 1440 only).
  Weetangera moved here from the statement slot. The pool-infill "before" card
  was dropped: infill already has a service card and the owner photo.
  Order: Latest build, Weetangera, Throsby, Forrest before, Forrest after,
  Denman Prospect. The work intro now names them in that order.
- **Lightbox:** `object-fit: scale-down`, so a 360px photo opens at 360px
  instead of being stretched across the screen.
- **Service cards and owner photo:** unchanged (native, excavator card about
  1.16x at 1440).
- **Share image:** still their own 600px Forrest shot. A stock photo in a link
  preview would carry no "Sample" tag.
- Deleted the matted tile files and pool-infill-before files the page no longer
  uses.

**Other review points**
- The one review shows once, as a still card (not a belt), now set at reading
  size (client CSS for a lone card). Word for word from `best_for_demo`,
  marked "Google review, shortened". It isn't in a pull quote.
- There's no `<br>` or markup in any escaped field. The only `<br>`/`<em>` are
  in headline fields, which the template splits into lines.
- "Call Craig" (sticky bar, call dock) dials tel:+61413997889. "Talk to Craig"
  is `copy.ctaLabel` and goes to the form.
- The copy and facts are unchanged apart from the work intro.

**Checked:** `npm run check -- cjg-pools` shows no blockers and READY TO SEND
(Lighthouse mobile 92 / 97 / 100). Playwright captures at 390×844 (1x and 3x)
and 1440×900 show no horizontal overflow, the hero sharp at both sizes with
the tag bottom right, and the lightbox at native size.

**Still needed from Craig:** his own originals, above all a pool at the dig or
steel stage for the hero. Swap out both samples before this goes live. Also his
licence number and more Google reviews.
