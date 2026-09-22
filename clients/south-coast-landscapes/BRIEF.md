# South Coast Landscapes Pty Ltd — brief

Written before the build, from their own site (southcoastlandscapes.com.au, read through
the SiteGround bot challenge with headless Chromium) and from the 24 Google reviews in
`data/google_reviews_top25.json`.

## Who they are

A family-run residential landscaping company in the Illawarra that designs, builds,
maintains and irrigates whole front and back yards — most often the ones a new build or a
renovation has left as bare dirt.

## Owner, key people, years, area, services, job size

- **Owner:** Ryan. Their about page calls him "Founder of South Coast Landscapes". Reviewers
  name him and only him — "Ryan and the team", "We set the challenge to Ryan and his team".
  Surname not published anywhere on the site or in the reviews. **Not stated on the site.**
- **Team:** a crew, unnamed. Reviewers call them "a great team of profesional staff",
  "the entire team were so polite and work so hard", "your work crew were very professional".
  Their about page also mentions a horticulturist on the team.
- **Years trading:** **not confirmed.** The site footer reads "2019", the oldest image in
  their media library sits in a `2013/05` upload folder, and the oldest Google review is
  5 years old. No "established" year is published. Left off the demo entirely.
- **Area:** based in Dapto. Jobs confirmed by their own portfolio and before/after pages in
  Dapto, Figtree, Flinders, Thirroul, Port Kembla, Horsley, Wongawilli, Corrimal, Shell Cove,
  Kiama, Wollongong and Engadine. They describe themselves as "Wollongong Landscaper &
  Illawarra Landscaper".
- **Main services (their four, their order):** design, construction, maintenance, irrigation.
  Construction list, in their words: retaining walls (masonry and timber), excavation,
  drainage, paving, pool coping and surrounds, decks, concreting, levelling and turfing,
  water features. They are a preferred supplier of Reece Irrigation and fit SMART systems
  (they name SkyDrop).
- **Job size:** whole-yard jobs, not garden tidy-ups. Their published projects are complete
  front-and-back landscapes: Besser Block and Tasman Block retaining walls, coloured concrete
  driveways, granite and Himalayan Sandstone pool surrounds, cobblestone paths, merbau
  decking and bench seats, Matilda Buffalo turf, SMART irrigation. No prices published
  anywhere. **No price is shown on the demo.**

## What customers praise, in their words (5 themes)

1. **They turn dirt into a finished yard.** "turn our backyard from a mud pit into a green
   oasis" (BJ Hansen). "take our landscaping from mounds of dirt and turn it into our desired
   front and backyard. And they did not disappoint" (Jimmy M).
2. **They finish off new builds.** "Thankyou for finishing off our house!" (Rachel Micallef).
   "I contact Ryan to give me a quote early 2022. My house was still being built" (Susan Oliver).
3. **Retaining walls are what they get called back for.** "the finished retaining wall,
   including the wood chipped area behind it" (ron lukin). "rendered retaining walls, gardens,
   turf prep/laying, merbau decking, fencing" (Cherie Marsh-Kokles).
4. **The crew, and the site left clean.** "we were impressed with the way they cleaned up the
   site at the end of each work day" (ron lukin). "a great team of profesional staff that
   produced quality work" (BJ Hansen). "The entire team were so polite and work so hard"
   (Rachel Micallef).
5. **The quote and the timeline hold.** "Timelines and budgets were accurate, and the workers
   were extremely punctual" (J Goucher). "professional and caring from the first consultation
   and quote, through to the final discussions when the job was complete" (J Goucher).

## THE ANGLE

**They are the trade that finishes what the builder started.** A new build or a big reno hands
the owner a house and a yard of mounds of dirt; South Coast Landscapes is the crew that turns
that dirt into a finished front and back yard — retaining walls, driveway, turf, planting and
irrigation — and sweeps the site clean every night while they do it.

Hero headline comes straight off this and off Jimmy M's and BJ Hansen's wording:
**"From mounds of dirt to a finished yard."**

## What is weak on their current site — for Pat's call

Read these in order; the first one is the call.

1. **The site has been hacked and is serving SEO spam.** Injected link text sits in the live
   body copy of the home page ("exact https://www.replicawatchesau.com interests plenty of end
   users", a paragraph selling "Aroma King" vape pens, and a block of replica-watch links above
   the footer), the irrigation page ("swiss fk rolex daytona diw 40mm…") and the contact page
   ("sell dj rolex datejust 36mm mens…"). Two spam images were uploaded into their media
   library on the same day — `cannabis-dispensary-toronto1.jpg` and
   `car-on-landscape-of-the-desert.jpg`. This is a live, visible compromise on a business site.
2. **The "OUR WORK" section on the home page is broken and shows nothing.** It prints the raw
   shortcode `[slide-anything id='24801']` where the slider should be. The one place a visitor
   looks for proof is an empty band of text.
3. **Their 4.8 from 24 Google reviews appears nowhere on the site.** Not a star, not a quote.
4. **Two different addresses.** Footer: "Unit 3/10 Marshall Street, Dapto NSW 2530".
   Contact page: "Unit 48/401 West Dapto Rd, Horsley NSW 2530".
5. **Two different email addresses.** Header and footer sitewide: `info@southcoastlandscapes.net.au`.
   Contact page: `info@southcoastlandscapes.com.au`. One of them is wrong and enquiries to it
   are going nowhere.
6. **It reads abandoned.** Footer copyright "2019", newest blog post June 2020, WordPress theme
   "bostan" with Visual Composer 5.4.2 and Revolution Slider 5.4.6.2 — both years out of date,
   and RevSlider of that vintage is a known way in.
7. **Typos in the sales copy.** "We are your landscaping expect in the following" (twice),
   "let our expect Ryan tailor a system" (both should be "expert"), "preferred suppliers".
8. **The bot challenge in front of the site.** SiteGround serves a "Robot Challenge Screen"
   before the home page. It took repeated attempts to get a page out of it from here. Whatever
   it is doing to bots, it is also standing between a customer on a phone and their work.
9. **Their best photography is buried.** A full professional shoot of four jobs sits on inner
   portfolio pages the home page never sends anyone to.

**Opener for the call:** see the bottom of this file.

## Photo inventory

**Source:** their own WordPress media library and the eight project pages under /portfolio/,
pulled through the challenge with headless Chromium. 252 files downloaded, 148 at 700px or
wider. Every candidate below was opened and looked at, not judged on its filename.

**Ceiling on size:** their largest professional photographs are 1500px wide. The only images
wider than 1600px are phone snaps of jobs in progress (see rejects). **The hero is therefore
1500px, not the 1600px the bar asks for — flagged.** It is sharp at that size and the demo
never asks it to render wider than 1500.

### Used — hero

| File | Source | Size | What it shows |
|---|---|---|---|
| `dapto-poolside-1500.webp` | SCL_230PrincessHwyDapto_IMG_2794.jpg | 1500×1000 | **HERO.** Relaxing Poolside, Dapto. Granite pool coping and paving, frameless glass fence, river-pebble drainage strip, charcoal Tasman Block garden bed, timber pergola and merbau deck behind, turf to the left. Professional shoot, sharp, late afternoon light. |

### Used — gallery (6)

| File | Source | Size | What it shows |
|---|---|---|---|
| `dapto-poolside-*` | IMG_2794 | 1500×1000 | Dapto: pool surrounds in granite tile, glass fence, pebble strip, Tasman Block beds. |
| `portkembla-wall-*` | SCL_207Wentworth_057_low.jpg | 1500×1000 | Port Kembla: reinforced Besser Block retaining wall faced in sandstone stackstone with a hardwood bench seat built into it, turf and cobblestone edge. |
| `portkembla-entry-*` | SCL_207Wentworth_056_low.jpg | 1500×1000 | Port Kembla: the finished Hamptons front — cobblestone path from the gate to the front decking, white picket fence, raised stone beds, turf. |
| `flinders-curve-*` | SCLandscape_1Elizabeth_003.jpg | 1500×1000 | Flinders: curved Tasman Block retaining wall wrapping the front of a new two-storey home, mulched beds, Matilda Buffalo turf. |
| `figtree-turf-*` | SCLandscape_55Redgum_003.jpg | 1500×1000 | Figtree: new Matilda Buffalo lawn with the SMART irrigation running, rendered retaining wall and tropical planting above it. |
| `thirroul-growwall-*` | Thirroul-13.jpg | 1500×1000 | Thirroul: three succulent grow walls mounted on the timber fence, rendered retaining wall, paving and lawn. |

### Used — elsewhere on the page

| File | Source | Size | Where / what it shows |
|---|---|---|---|
| `dapto-pergola-*` | SCL_230PrincessHwyDapto_IMG_2779.jpg | 1500×1000 | Statement section. Dapto: merbau deck under a timber pergola, outdoor table and benches set, sandstone-faced raised bed, pool beyond. Inhabited, not staged. |
| `figtree-turf-1500` | as above | 1500×1000 | Aperture band. |
| `portkembla-bench-*` | SCL_207Wentworth_077_low.jpg | 1500×1000 | Construction service card. Close on the stackstone wall and the merbau bench top. |
| `thirroul-courtyard-*` | Thirroul-25.jpg | 1500×1000 | Design service card. Thirroul: paved courtyard, rendered wall, lawn, grow wall. |
| `thirroul-lawn-*` | Thirroul-2.jpg | 1500×1000 | Maintenance service card. Thirroul: clipped lawn, planting along the timber fence. |
| `figtree-sprinkler-*` | SCLandscape_55Redgum_007.jpg | 1500×1000 | Irrigation service card. Sprinkler head throwing over new turf against a brick home. |
| `dapto-poolwide-1200` | SCL_230PrincessHwyDapto_IMG_2800.jpg | 1500×1000 | Enquiry-form background. Dapto pool and pergola, wide. |
| `ryan-646.webp` | ryan.jpg | 646×852 | Ryan, leaning on the branded ute with the coast behind him. Their own about-page photo. Under 1000px — fine at the size the template renders a portrait, flagged anyway. |
| `logo-scl.webp` | newlogo.png | 400×104 | Their wordmark, white with the green tree mark, already transparent. |

### Rejected, with the reason — every one was opened and looked at

| File | Size | What it actually showed → why rejected |
|---|---|---|
| `cannabis-dispensary-toronto1.jpg` | 1280×850 | A close-up of a cannabis leaf with water droplets. Stock, and not theirs — uploaded by whatever compromised the site. |
| `car-on-landscape-of-the-desert.jpg` | 870×580 | A 4WD on an orange sand dune. Stock, same hack, nothing to do with landscaping. |
| `IMG_0544-3.jpg` | 3264×2448 | Their widest image. A coastal block mid-job — spread topsoil, rock edging, stepping stones not yet bedded, their ute parked in the middle. Unfinished work. |
| `Screenshot_3.jpg` | 2880×1920 | Second widest. A narrow side courtyard shot from under a carport, with a rendered pillar cutting the frame in half. Real work, bad composition. |
| `IMG_0302.jpg` | 2592×1936 | Third widest. A circular sandstone garden ring in a lawn, with parked cars and neighbours' rooflines across the top. Real, ordinary, no hero. |
| `IMG_1658-e1526442131887.jpg` | 2448×3264 | Portrait. A red stamped-concrete side path with corrugated retaining and bonsai pots. Real, dated-looking, too narrow a subject. |
| `IMG_1062.jpg` | 2291×3055 | Same side path, other end. Same reason. |
| `IMG_4036-e1525236485949.jpg` | 1458×2016 | A fiddle-leaf fig in a pot on a floorboard against a white wall. A blog illustration, not a job. |
| `Fire-Pics.jpg` | 800×800 | A four-up collage of fire-pit photos with visible seams. Composite, not a photograph. |
| `scl.jpg` | 1080×1080 | A four-up collage of garden-lighting images, at least two of them product shots on white. Composite, part stock. |
| `back-edited.jpg` | 1240×827 | Blown out to near-white; the image is gone. |
| `bottom_shadow.png` | 960×6 | A theme gradient strip. |
| `beforejob.jpg`, `IMG_0174`, `IMG_0176`, `IMG_0178` | 713–750px | Genuine "before" photos — bare lawn, a dirt slope, a trampoline on patchy grass, a half-dug pool surround with a wheelbarrow in it. Their work, but they are the problem, not the result. Not used; worth a before/after strip if Ryan wants one. |
| `IMG_0411`, `IMG_0442-2`, `IMG_0522-2`, `IMG_0565-2`, `IMG_0620` | 1000×750 | Jobs in progress — scaffolded pool shell, excavator on a stripped block, fresh concrete pour with the site still a mess, formwork. Real, unfinished. |
| `IMG_0582-2.jpg` | 1000×750 | A finished paved driveway, but their own advertising signboard is planted in the foreground. |
| `Slider-Background-1/2`, `Home3`, `portfolio-top-image`, `top-image-for-about-us` | 1240×350–500 | Their own theme's letterbox banner crops of real jobs — 350–500px tall, already cropped past use. `top-image-for-about-us` is the nicest of them (three branded utes and trailers lined up on a headland) and is worth re-shooting or re-cropping from the original if Ryan still has it. |
| `1.jpg`–`5.jpg` (2019/11) | 285–960px | Small portfolio thumbnails of real jobs — front garden edging, a curved mulch bed. Too small. |
| `About-us-Pic2updated.jpg`, `image8.jpg`, `IMG_0860` | 710–800px | Real finished yards (fire pit and turf; a small plunge pool in a hedge). Under the size a gallery tile needs. Good candidates if Ryan has the originals. |
| `newlogo.png` derivatives, `icons8-*.png`, `default.jpg` | ≤48–600px | Logo and theme furniture. |
| All `-1024x683` / `-768x512` files | — | WordPress's own downsized copies of images already used at full size. |

**Count: 6 usable at gallery quality from 4 separate jobs, plus 7 more of the same standard
used through the page — 13 in all, from 5 jobs. Hero at 1500px, flagged.**

## Call opener

"I noticed the 'Our Work' band on your home page is printing a bit of code instead of your
photos, and there's replica-watch and vape spam sitting in the text above your footer — it
looks like the site's been got at. Meanwhile the professional shoot of the Port Kembla and
Dapto jobs is buried three clicks deep, and your 4.8 from 24 reviews isn't on there at all."
