# Forest Joinery — Brief

## Who they are
Forest Joinery is a one-owner cabinet-making and joinery business based in Cromer, on
Sydney's Northern Beaches (36/1-5 Thew Parade, Cromer NSW 2099). Founder Dave Gerson
personally quotes, draws, builds and installs custom kitchens, bathrooms, laundries,
wardrobes, home offices, entertainment units and bespoke joinery — a genuine
fabricator/installer, not a design-only studio (their own Process page describes Dave's
team doing the "Expert Craftsmanship" and "Flawless Installation" stages, and Dave
personally signing off the "Quality Finish"). Fully licensed and insured, NSW Licence
Number 338298C. Google category: "Cabinet maker". No ABN, no trading hours and no
founding year/years-in-business figure are published anywhere on their site, so none of
those are claimed on the demo.

**Industry check**: the queue tagged this "kitchens-joinery" and, unlike the recent
karanda-interiors mismatch (an interior design studio wrongly tagged the same way), that
tag holds up here — confirmed by reading their own Bespoke Furniture and Process pages,
not just the Google category label.

## What's praised (from data/google_reviews_top25.json, "forest-joinery", 5.0 from 6
reviews)
- **Personal, hands-on service from Dave himself** — named directly in 3 of the 6 pulled
  reviews (Pamela Carr, Jeremy Ungar, Lynda Tate).
- **Quality and reliability** — "highest quality work", "great quality and service",
  "outstanding service and finished product".
- **Delivered on time, reasonably priced** — "delivered a great product on time and well
  priced" (Pamela Carr); "highest quality work at a reasonable fee" (Jeremy Ungar).
- **Professional and patient approach, extra storage achieved** (Lynda Tate).
- Their own site's (non-Google) testimonials add a further theme worth noting even
  though it isn't in the Google pull: **honest, proactive advice** — one client (Phillip,
  matching the shortened "Phillip W" Google review) wrote in detail that Dave "wasn't
  afraid to tell us if something wasn't the best idea or the most practical solution"
  and suggested better alternatives instead of just building to the plans. This is used
  in the demo's statement copy, sourced to their own testimonials page, not presented as
  a Google review.

## The angle
**"Honest advice, honest joinery."** Dave runs every job personally from quote to
final fix, and — per their own strongest testimonial — will tell a client when their
plan could be improved rather than just building what's on the page. Paired with
"fully licensed and insured, Licence Number 338298C" as the hard proof point. This beats
a generic "quality craftsmanship" angle because it's specific, differentiated, and
directly sourced to a real client's words.

## What's weak on their current site
- No photo of Dave anywhere (site, Houzz profile, or reviews) — flagged in
  `photos.owner._comment`. First thing to ask him for.
- No trading hours, ABN or years-in-business published — the demo shows none of these
  rather than guessing.
- Their homepage buries the actual differentiator (Dave's personal, honest-advice
  approach) inside a testimonials carousel rather than stating it directly — the demo's
  statement section pulls it forward.
- The logo is only published at 148×63px — too small to serve at native size in a
  header; flagged in `business.logo._comment`, and a larger source should be requested
  from Dave.
- Only 6 Google reviews behind the 5.0 rating, despite "50+ reviews on Houzz" — a real,
  separate credential worth surfacing (used as its own card, never merged into the
  Google count).
- Two of the photos in the "Warriwood Makeover" project gallery are "before" shots of
  the client's old kitchen, not Forest Joinery's work — excluded from the demo.

## Photo inventory (all downloaded from st.hzcdn.com, Forest Joinery's own Houzz-hosted
CDN, at the largest size Houzz serves for each image; none are stock)

| File | Project | Size | Used as | Notes |
|---|---|---|---|---|
| bayview-kitchen-island.jpg | Bayview Kitchen and Entry | 2560×1920 | Hero | Curved fluted island, white stone benchtop, sharp, bright, well composed |
| forestville-new-kitchen.jpg | Forestville – New Kitchen | 2560×1708 | Statement | Matte black + light timber, garden view through picture window |
| family-home-tv-unit.jpg | Custom Family Home Fit Out | 2560×1708 | Aperture | Oak veneer bookshelf/TV unit against a navy wall — striking, shows range beyond kitchens |
| beacon-hill-fitout.jpg | Beacon Hill – House Fitout | 1280×960 | Owner section | White shiplap TV/fireplace wall with floating shelves; stands in for a portrait of Dave, which doesn't exist |
| bayview-corner-display.jpg | Bayview Kitchen and Entry | 1920×2560 | Gallery + services (wardrobes) | Curved fluted corner display cabinet, glass shelves |
| bayview-twin-cabinets.jpg | Bayview Kitchen and Entry | 1920×2560 | Gallery + enquiry background | Matching fluted cabinets flanking a hallway door |
| forestville-pullout-storage.jpg | Forestville – New Kitchen | 2560×1708 | Gallery | Pull-out pot/appliance storage, fully extended, functional detail shot |
| family-home-staircase.jpg | Custom Family Home Fit Out | 1708×2560 | Gallery | Oak timber battening, handrail and glass balustrade panel |
| warriwood-ensuite.jpg | Warriwood Makeover | 1920×2560 | Gallery | Curved fluted ensuite vanity |
| waverton-vanity.jpg | Waverton Bathroom | 756×1008 | Gallery + services (bathrooms) | Double vanity; smaller file (no larger size served by Houzz), used as a small tile only |

**Excluded**: two "before" photos of the client's old cream-laminate kitchen from the
Warriwood Makeover project (not Forest Joinery's finished work), and the About page's
generic TV-wall photo (redundant with family-home-tv-unit, which is sharper and more
distinctive).

**Total: 10 real, sharp, distinct photos** across 6 different finished projects — above
the 6-ideal / 4-minimum bar. No stock photos used; `photos.stockApproved` is absent from
config.json.

## Reviews used
All 6 from `data/google_reviews_top25.json` → `forest-joinery` → `best_for_demo`, word
for word, names as published. "Phillip W" is marked `shortened: true` in the source data
and carries the "Google review, shortened" source line on the page.

## Flags for Pat
1. **No photo of Dave** — ask him for a headshot or a photo of him on the tools.
2. **Logo is tiny (148×63px)** — ask for a larger export or the original vector file.
3. **No ABN, trading hours or years-in-business published** — none of these are on the
   demo; if Dave wants them shown, get the real numbers from him first.
4. Landline (02) 9159 6229 exists alongside the mobile 0472 507 755 — the demo uses the
   mobile throughout (matches Google's listed number and enables the text button); worth
   double-checking with Dave which he'd rather have as primary.
