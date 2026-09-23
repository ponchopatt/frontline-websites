# Karanda Interiors — brief

Written before the build. Every fact below is on their own site
(karanda.com.au), pulled by curl and WebFetch on 2026-09-23, or in
`data/google_reviews_top25.json`. Nothing is inferred beyond what those say.

## Who they are

**A mismatch to flag first:** the task brief names this industry
"kitchens-joinery", but Karanda Interiors is an **interior design studio**,
not a kitchen or cabinetry fabricator. Google's own category for them is
"Interior designer". Their service list is Residential/Commercial/Hospitality
Interior Design, New Builds, Renovations and Developments, Floor Plan
Redesign, Furniture, Lighting & Art Specification, Concept Design, Blinds &
Shutter Studio, Custom Upholstery, In-house Fabric Library — nowhere do they
say they build, supply or install kitchen cabinetry themselves. The
`kitchens-joinery` preset's default process/FAQ ("built in the workshop to
your measurements", "we coordinate plumbing and electrical trades") would be
**false claims** about this business, so I did not use them — the config
overrides `process` and `faq` in full with Karanda's own real four-step
consultation process and their own FAQ answers. The industry field is set as
instructed, but the copy is honest about what they actually do: design,
not fabrication. Several of their real projects (kitchens shown in Sylvania
Villa and Alkira Place Waterfront) do give a genuine kitchens angle for the
photography even though the business itself is a design studio.

A boutique interior design studio based in Sylvania Heights, in Sydney's
Sutherland Shire, run by Toni Ford. They design residential and commercial
interiors — renovations, new builds, floor plans, furniture, lighting,
blinds and shutters, upholstery — end to end from concept to completion.

## Owner and key people

- **Toni Ford** — "Interior Designer F.D.I.A" (a Fellow of the Design
  Institute of Australia). "With over 40 years' experience in the design
  industry Toni can help you with all aspects of your project." She "gives
  back to the industry she loves by serving as a Counselor with the Design
  Institute of Australia." Her interior architecture and design training and
  "comprehensive construction knowledge, enable her to resolve your complex
  floor plan issues." (about page)
- **Jelena Bruce** — "a graduate of Design Centre Enmore," inspired by
  "well-considered interiors that bring warmth and joy to clients." (about
  page)
- **Kasey Pogson** — background as an Executive Assistant, "managing our
  clients, suppliers and trades." (about page)
- **Jannelle Peck** — "background in design, visual arts and management,"
  Design Consultant. (about page)
- No surnames are published for Jelena or Jannelle beyond what's in the URL
  slug/alt text ("Jannelle Peck Design Consultant Karanda Interiors"). Kasey's
  surname "Pogson" comes from the image filename `karanda-kasey.jpg` alt text
  — not stated in body copy, so used cautiously.

## Years / experience

"Karanda Interiors brings over 45 years of uncompromising Interior Design
experience to Sydney" (business-wide, about page). Toni personally: "over 40
years' experience in the design industry" (about page). **No founding year
is published anywhere and none is claimed on the demo.** These are experience
figures, not a "years in business" number, and are used as such.

## Area

Business address: **206 Princes Highway, Sylvania Heights NSW 2224**
(contact page — a real street address, not a PO Box). No explicit "service
area" statement exists on their site. Suburbs are inferred only from their
own published project names on the /projects/ page: Burraneer (Shell Road),
Cronulla (Russo Cronulla, Via Mare Cronulla, Ewos Pde Cronulla), Sylvania
(Sylvania Villa, Sylvania Townhouse), Caringbah (Alkira Place Waterfront,
Caringbah Duplex), Miranda (Westbourne Apartments Miranda — also the David
Murray review), Oyster Bay, Maroubra, Double Bay, Kangaroo Point (Sutherland
Shire). These are used as service-area suburbs because they are documented
project locations, not a stated claim of "we cover X, Y, Z."

## Main services

Straight off /design-services/, in their order: Residential Interior Design,
Commercial Interior Design, Hospitality Interior, New Builds, Renovations and
Developments, Floor Plan Redesign, Furniture, Lighting & Art Specification,
Concept Design, Blinds & Shutter Studio, Custom Upholstery, In-house Fabric
Library.

Pricing (design-services page): "$300(Inc GST) per hour or part thereof will
be charged for all face to face consultations, drafting and sourcing work
with a senior designer and $150(inc GST) with [a junior designer]."
"Commercial packages are available after the initial consultation." "All
pricing quoted is RRP and our supplier names will not be disclosed." These
are used as the priceLines facts.

## What customers praise, in their words

(from `data/google_reviews_top25.json`, `best_for_demo`, 5.0 from 15 Google
reviews)

1. **Toni personally, by name, in almost every review.** "Toni was very
   professional, and her expertise and guidance was well received by
   everyone on the strata committee" / "Toni assisted us in designing our
   dream home. She is very professional and has extensive experience in
   choosing perfect furniture and colors" / "Toni helped us completely
   re-design the floor plan of our house."
2. **Work that lasts and doesn't date.** cm's review (not in best_for_demo
   but corroborating): "has lasted over 10 years and has not dated."
3. **Good value, saves you from mistakes.** "Using karanda helps me from
   making big mistakes. Very good value for money." (Howard Horne)
4. **Trusted on repeat and referral work.** "Worked on many projects with
   the team at Karanda Interiors... Highly recommend." (The Company Of Fire
   — a trade partner, also named on the design-services page as "Joint
   projects with The Company of Fire.")
5. **Commercial/strata and multi-residential trust.** David Murray: "Karanda
   Interiors designed and assisted with the refurbishment of the foyer entry
   area of our apartment complex in Miranda... highly recommend."

## THE ANGLE

**Forty years of Toni Ford's own eye, on every job — not a junior handed
the file.**

Their site says it themselves: Toni personally has "over 40 years'
experience in the design industry," resolves "complex floor plan issues"
herself using "interior architecture and design training, and comprehensive
construction knowledge," and is a Counselor with the Design Institute of
Australia. The reviews back it up unprompted — five of six best-for-demo
reviews name Toni personally, not "the team" or "Karanda." That personal,
decades-deep design judgment — on floor plans, on materials, on finishes
that "lasted over 10 years and has not dated" — is the one thing a newer
studio or a project manager handing your job to a junior cannot offer.

Hero headline: **"Forty years of getting it right, on your project."**
(Or similar — see config for exact wording.)

## What's weak on their current site — for Pat's call

1. **No phone link or clear CTA above the fold** on a heavily
   JavaScript-dependent RevSlider homepage — the hero is a slow slideshow,
   not a clear call to action.
2. **The Houzz badges (5 of them) and "Best of Houzz"-style icons have no
   readable label** in the raw HTML (`alt=""` on most), so the actual
   claim behind each badge can't be verified from the page alone — none are
   used on the demo as a specific claim, only the plain Houzz profile link.
3. **Pricing is buried** on the design-services page in body text, easy to
   miss, and undifferentiated from services copy.
4. **Generic, could-be-anyone service blurbs** ("Bring your ideas to life...
   evoke the moods that speak to you") — the demo rewrites these in Karanda's
   and Toni's actual voice, grounded in what she and the team specifically
   say about themselves.
5. **No prominent review/testimonial section on their own site at all** —
   the 5.0/15 Google rating and the reviews that name Toni personally are
   currently invisible to a visitor unless they leave the site to check
   Google.
6. **The "Click here to Watch it on 9NOW" link** (to 9now.com.au/dream-homes-
   revealed) sits in the header on every page with no context — no episode,
   date or description of what was shown. Used on the demo only as a soft,
   modest mention ("as seen on Nine's Dream Homes Revealed"), not as a
   headline claim, because nothing more specific is published.

## Photo inventory

16 photos pulled at full resolution from their own CDN
(karanda.com.au/wp-content/uploads/...), all their own project photography
or their own team photo. Every one opened and looked at with the Read tool.
None are theme stock or manufacturer renders — all show real, specific rooms
with real furniture, real views and (in two cases) a client's own dog.

| File | Size | What it shows |
|---|---|---|
| `toni.jpg` | 525×788 | Toni Ford, professional black-and-white portrait headshot. Owner slot. |
| `alkira-place-waterfront.jpg` | 1920×1286 | **Kitchen.** Alkira Place Waterfront (Smith, Caringbah): navy-blue island with integrated wine fridge, white marble benchtop, pendant light. Sharp, well-lit. **Hero.** |
| `sylvania-villa.jpg` | 1920×2550 | **Kitchen.** Sylvania Villa (Lewis): shaker-style white cabinetry, black tapware, oak floor. Portrait orientation. Statement slot. |
| `coast-ave-penthouse.jpg` | 1920×1741 | Kitchen/dining nook, Coast Ave Penthouse (Marlow, Cronulla): built-in banquette-style yellow chairs, breakfast bar. |
| `home1.jpg` | 1920×1257 | Living room, Kangaroo Point: fireplace/TV wall, sectional sofa, floor-to-ceiling glass onto the harbour. Used on the homepage slider on their live site. Aperture slot. |
| `shell-rd-burraneer.jpg` | 1300×892 | Living room, Shell Road Burraneer: stone-clad fireplace wall, leather armchairs, client's two dogs on the rug. Gallery. |
| `russo-cronulla.jpg` | 1300×867 | Dining room, Russo Cronulla: statement pendant cluster over a 10-seat table, marble waterfall-edge island in the background. Gallery. |
| `via-mare-cronulla.jpg` | 1920×1133 | Exterior/architecture, Via Mare Cronulla: a period weatherboard home with a glazed conservatory addition. Gallery. |
| `double-bay-apartments.jpg` | 1920×1339 | Living/balcony, Double Bay Apartments: neutral sectional, roller blinds, harbour-district balcony view. Gallery. |
| `ella-ave.jpg` | 1920×1318 | Exterior, Ella Ave: a renovated Federation-style home with a glazed pavilion addition, pergola and outdoor dining. Gallery. |
| `monochrome-house.jpg` | 1920×1280 | Living room, Monochrome House: black-and-white palette, textured wallpaper feature wall, gas fireplace. Gallery. |
| `westbourne-miranda.jpg` | 1920×1280 | Foyer/lift lobby, Westbourne Apartments Miranda — matches David Murray's review ("refurbishment of the foyer entry area of our apartment complex in Miranda"). Used to pair with that review. |
| `oyster-bay-family-home.jpg` | 1920×1344 | Outdoor kitchen/entertaining deck, Oyster Bay: stainless BBQ, integrated fridges, timber batten wall. Held in reserve / usable as an extra gallery tile. |
| `logo1.png` | 646×646 | Their own logo mark (circular), used as-is — their own artwork, not recreated. |
| `bgtoni.jpg` | 1920×1217 | **Not used as a photo.** This is their own homepage slider background — Toni's portrait deliberately faded to near-white for text overlay. Kept only as a source reference, not shown as a real photo on the demo. |
| `hero-l1050510.jpg` | 1300×865 | Hallway with statue-canyon artwork, held in reserve (smaller than the chosen hero). |

**Used: 12 real project/owner photos across hero, statement, aperture, owner,
gallery (8 tiles) — well above the 6-ideal / 4-minimum bar. All sharp, all
their own, no stock.**
