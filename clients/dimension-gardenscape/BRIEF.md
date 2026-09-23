# Dimension Gardenscape — brief

Built from wayback-machine snapshots of https://dimensiongardenscape.com.au (their live
site returns a SiteGround "Robot Challenge Screen" / sgcaptcha to every automated
request — curl, WebFetch and even the Internet Archive's own crawler all get bounced
to the same JS challenge page, so this brief and config are built entirely from
archived snapshots, Sept 2026) plus `data/google_reviews_top25.json`.

## Who they are

Dimension Gardenscape is a landscape design-and-construction business based at
21 Downey St, Queanbeyan NSW, trading as Canberra-region landscapers. Founder and
director **Trevor Fuller** started as an apprentice greenkeeper 35 years ago, moved
into lawn care at Parliament House, then horticulture and irrigation, ran a weekend
family landscaping business from about 1996, and established Dimension Gardenscape
in its present form in **2007**. Head landscaper is **Peter "Pete" Barton-Browne**,
with the crew for nearly 10 years and 20+ years in horticulture and landscape
construction. Main line is a landline, 02 6297 9040 (matches their Google listing);
Trevor's personal mobile, 0412 437 418, is published on their contact and FAQ pages
for when he's off-site. Services: landscape design, construction, decks, pergolas,
retaining walls, garden art, small/balcony/vertical-wall garden design, wicking beds.
Jobs range from balcony planters to full-property builds (award-tagged Ainslie
project, multi-day Japanese garden with large rock installation per a Google review).

## What's praised (from data/google_reviews_top25.json, best_for_demo + full set)

1. **Communication and follow-through** — "kept us informed throughout the entire
   project" (Shobhana Khanna), "communication was also very smooth" (Mccomas Taylor),
   Trevor personally handles issues ("Trevor was lovely to speak to and dealt with
   any issues we had" — Rachel Heffernan).
2. **On time, on budget** — "quick, efficient... did the job on budget and on time"
   (Mccomas Taylor); repeat/return business implied ("we know who to contact" —
   Rachel Heffernan).
3. **Skilled, friendly crew on bigger builds** — the Japanese garden install with
   large rocks "went like clockwork" over 3 days (V&L Viclach); wicking beds +
   general landscaping praised by name (Mccomas Taylor).
4. **Design quality** — "a combined effort of imagination, plant knowledge and human
   effort" produced a "spectacular" front yard with corten privacy screens
   (Lorraine Cunningham); quote process "clearly explained the materials and
   detailed the labor costs" (Fiona).
5. **Flag for Pat**: a 2-star review 10 months ago ("I would be very wary about
   using Trevor and his team...") is real and sits in the full Google set (not in
   best_for_demo, so it never appears on the demo page, but Pat should read it
   before calling this lead — `google_reviews_top25.json` flags it too).

Google: **4.5 stars, 54 reviews** (from data file — the site's own embedded widget,
last archived, shows a stale 4.2/31, which I did not use anywhere).

## The angle

**A qualified horticultural perspective, not just a construction crew.** Their own
About page opens with "we provide a qualified horticultural perspective on your next
landscape project" and separately states the team's ongoing horticultural
education. Trevor's own background is horticulture-first (greenkeeper → Parliament
House turf → irrigation → landscape design, 2007). They're also members of three
separate professional bodies — Australian Institute of Horticulture, Master
Builders Association ACT (member 12394) and The Landscape Association (member
11956) — more memberships than most Canberra landscaping competitors show. Headline
built on this: design, construction and plant knowledge sitting in the one team,
answerable to three trade bodies, not just a hardscape contractor who buys in
whatever plants are cheapest that week.

## What's weak on their current site (for Pat's call)

1. **The whole site blocks automated visitors**, including Google's and the
   Internet Archive's own crawlers, behind a SiteGround "Robot Challenge Screen."
   That's overkill for a small local business and may also be catching real
   customers on privacy browsers, ad-blockers or older phones.
2. **Fake-looking stat counters** on the homepage — "2860 Projects Completed,"
   "128 Expert Landscapers," "14 Landscaping Awards," "24 Years of Experience" —
   contradict their own prose ("over 30 years") and are implausible for a business
   this size (128 "expert landscapers" is not credible). Looks like unedited
   WordPress theme demo content and undercuts trust rather than building it. None
   of these numbers were used anywhere in the new config.
3. **Several "service" photos are unrelated stock/render images**, not their own
   work: a Hasselblad-shot English courtyard (used on "Landscaping"), a French
   Riviera louvre-pergola render (used on "Pergolas"), a Texas modern front yard
   (used on "Landscaping" elsewhere), a CGI desert pool render credited in its own
   EXIF to "Recent Spaces" (used on "Pool Landscaping"), a Dubai balcony stock photo,
   and a generic block-wall product shot (used on "Retaining Walls"). None of these
   were used in the new build — see photo inventory below.
4. **The on-page Google reviews widget is stale** (4.2 from 31 reviews on the last
   archived snapshot) against a live 4.5 from 54 — undersells them versus reality.
5. **No photo on the whole site clears 2600px wide**, and several of their best real
   project shots are square Instagram-style crops around 800–1000px, which limits a
   full-bleed hero treatment. Flagged; used the sharpest wide one available.

## Photo inventory (all pulled from wayback-machine snapshots of their own
`wp-content/uploads`, opened and eyeballed one by one; none are stock — the stock
ones found are listed separately below and were **not** used)

Used in the new build (13 photos, converted to `.webp`, multiple widths):

| File in `assets/` | Source / project | What it shows | Native size |
|---|---|---|---|
| `japanese-pergola-*.webp` | `IMG_0105-scaled.jpg`, undated project | Upward angle on a hand-built timber pergola/gazebo roof, exposed joinery, blue sky | 2560×1707 — **hero** |
| `deakin-blossom-swing-*.webp` | Deakin project (`Deakin14.jpg`) | Backyard swing seat under a blossoming ornamental tree | 800×800 — statement |
| `firepit-evening-*.webp` | `IMG_0277-wfire.jpg` | Corten-edged fire pit at dusk, Adirondack chairs, colorbond fencing | 1203×803 — aperture (below the 1600px ideal, flagged, cropped well) |
| `ainslie-pond-courtyard-*.webp` | Award-tagged Ainslie project | Courtyard path past a raised pond, established planting | 800×800 — service photo (Landscape design) |
| `ngunnawal-curved-deck-*.webp` | Ngunnawal project | Curved hardwood deck, red gravel surround | 1000×1000 — service photo (Decks & pergolas) |
| `ngunnawal-corten-wall-*.webp` | Ngunnawal project | Corten-steel retaining wall, new turf, brick home behind | 1000×1000 — service photo (Retaining walls) |
| `wicking-bed-construction-*.webp` | `Wicking-Beds-scaled.jpg` | Wicking garden bed mid-build: liner, overflow pipe, spirit level | 2560×1462 — service photo (Wicking beds) |
| `ainslie-stone-wall-planters-*.webp` | Award-tagged Ainslie project | Dry-stone retaining wall/bench seat, black woven planters | 800×800 — gallery |
| `deakin-front-garden-*.webp` | Deakin project | Front garden bed, daffodils and native grasses, rendered home | 800×800 — gallery |
| `harrison-courtyard-*.webp` | Harrison "play space" project | Paved courtyard, white Adirondack chairs, pool cover | 800×800 — gallery |
| `sherlock-courtyard-*.webp` | "Sherlock" rear-garden project | Minimalist paved courtyard, modern render home | 800×800 — gallery |
| `sherlock-terraces-*.webp` | "Sherlock" rear-garden project | Terraced lawn and retaining, two-storey home behind | 800×800 — gallery |
| `garden-art-statue-*.webp` | `IMG_0095-scaled.jpg` | Weathered stone garden statue, backyard setting | 2560×1707 — gallery |

Logo: `logo-dimension-gardenscape.png` (787×352, green script wordmark, colour) and
`logo-dimension-gardenscape-white.png` (same, white-on-transparent for dark
backgrounds) — both their own logo files. Brand green sampled off the logo itself:
`#289848` (darker, "Gardenscape") and `#60a848` (lighter, "Dimension").

**Excluded as stock/not theirs** (found archived under the same `wp-content/uploads`
folder, opened and confirmed not their work): `150610_No16_0158-1.jpg` (English
brick-walled courtyard, Hasselblad EXIF, stock-agency filename pattern), `Pool-Landscaping.jpg`
(photorealistic CGI desert-pool render, EXIF copyright "Recent Spaces"),
`Decks-or-Decking-scaled.jpg` (American vinyl-sided suburban deck), `Garden-Art-Canberra-scaled.jpg`
(white-picket cottage garden, non-Australian), `Landscaping.jpg` (modern Texas-style
front yard), `Garden-Design.jpg` (generic glossy hosta-terrace stock shot), `Retaining-Walls.jpg`
(generic block-wall product texture shot), `Pergola.jpg` (French Riviera louvre
pergola with palm tree, non-Australian architecture), `Dubai-Fall-Balcony-Garden...jpg`
(named for Dubai), `pexels-pixabay-158028.jpg` (Pexels/Pixabay filename). None used.

**No stock/sample photos were needed** — 13 real photos cleared the "sharp, real,
not tiny" bar, well above the 4-minimum / 6-ideal gallery target, so
`photos.stockApproved` was not used.
