# Meyers Building Group — brief

Written 2026-09-24, before building. Site read with curl (desktop Chrome user agent) because `npm run new` is broken in this container. Pages read: `/`, `/services`, `/gallery`, `/contact-us`, `/meyers-earth-moving` on https://meyersbuildinggroup.com.au. Wayback Machine was unreachable from this container, so only the live site was used.

## Legitimacy check: PASS (real local builder)
- **ABN 74 092 054 594** (ABR lookup, abr.business.gov.au): entity THOMASELLY PTY LTD, active from 16 May 2000, main business location NSW 2576 (Bowral). Registered business name **Meyers Building Group** from 13 Jun 2018. Older trading names on the same ABN: **Darren Meyers Carpentry** and **Darren Meyers Constructions** (both from 02 Aug 2006).
- **Address**: 7 Robinia Drive, Bowral NSW 2576 (Yellow Pages listing 13022262, same phone, same ABN).
- **Phone**: 0407 917 649 on every page of their site (tel: link), on Google, on Yellow Pages. One mobile, consistent everywhere.
- **Facebook**: facebook.com/meyersbuilding (linked from their contact page); a separate older page "Darren Meyers Constructions | Bowral NSW" shows up in search.
- **Photos**: 7 real phone photos of one finished job (a period cottage with stone walls, pergola, deck, glazed garden rooms and a garage). Not stock, not a template.
- One local operator in Bowral with one mobile and one ABN — not a multi-city lead-gen front.
- Not found: a named person on their own website, a licence number on their site. A web search snippet links Thomaselly Pty Ltd to NSW contractor licence 135713C, but I could not open the NSW register record (it's a JS app), so the number is **not** on the page — Pat to confirm.

## Who they are
A Bowral building company run by Darren Meyers (name from the ABR trading names, not from their website), doing construction, restoration and renovation in the Southern Highlands, plus their own earth moving service. Over 30 years' experience. Job size ranges from a pergola or bathroom up to new homes and commercial builds.

- **Owner**: Darren Meyers (ABR trading names "Darren Meyers Carpentry" / "Darren Meyers Constructions"). No other staff named anywhere.
- **Years**: "With over 30 years experience in construction, restoration & renovation" (home page).
- **Area**: Bowral (Yellow Pages, ABR postcode 2576). Their site only says "well established in the local area" — no suburbs listed, so none are invented.
- **Services** (their /services page): new residential builds (houses and cottages), commercial builds (offices, warehouses, retail), extensions (incl. granny flats), renovations, restorations, kitchen renovations (modern or keeping heritage elements), bathroom renovations, decks, pergolas. Plus Meyers Earth Moving: driveways, in-ground pools, landscaping, retaining walls, site preparation.
- **Proof on their own site**: "80% of our work comes from returning clients and referrals due to our attention to detail and quality of work." "Our polite and friendly team is fully licensed and insured, and will treat your home with care." "We work flexible hours ... and we are happy to do onsite visits."

## Reviews
None. `data/google_reviews_top25.json`: "No Google rating or reviews found." No testimonials on their site either. Reviews section stays empty; no rating or count anywhere. This is Pat's pitch.

## The angle
**Word of mouth.** 80% of their work is returning clients and referrals, after 30+ years of construction, restoration and renovation around Bowral. For a builder with zero Google reviews, that's the honest proof — and exactly the gap a Google review system closes. The hero shows their own finished job: sandstone-and-rubble stone walls, a white pergola over a new deck, and a sage-green period cottage — which fits the Southern Highlands restoration story.

Headline: "Most of our work comes by word of mouth." Sub gives the 80% and 30+ years.

## What's weak on their current site (for the call)
- GoDaddy template; the footer still reads "Copyright © 2018 Construction Company MP Template".
- No suburb, town or address anywhere on the site — Google can't tell it's a Bowral builder.
- No name, no face, no licence number, no ABN. Nothing says who Darren is.
- Their best line (80% repeat and referral work) is buried in paragraph two.
- The services and earth moving pages use black-and-white template stock (an excavator by the sea, a man at a bathtub) instead of their own work.
- The Project Gallery page loads empty without JavaScript; only 7 photos, all 960px wide.
- No Google reviews at all.
- Typos: "Update you're home", "by a restoring".

## Photo inventory (all from img1.wsimg.com/isteam/ip/7811a3ed-…/, full size as uploaded)
All seven are the same property (same sage paint, stone, gravel). All 960px wide or smaller (phone photos, probably downloaded from Facebook). Upscaled 2x with Real-ESRGAN x2plus (proper AI upscaler, max 2x) — **flagged**. No suburb is named on their site for this job, so no caption names one.

| File | Size | Upscaled | Shows | Use |
|---|---|---|---|---|
| IMG_4548.JPG | 960×720 | (superseded, see Finish round) | Front of a sage-green weatherboard cottage, white pergola over a deck, curved stone retaining wall with urns, new lawn, blue sky | Hero |
| IMG_4554.JPG | 960×720 | 1920×1440 | Pergola, deck and stone planter walls with pavers, close up | Service: decks & pergolas |
| IMG_4549.JPG | 960×720 | 1920×1440 | Stone wall in foreground, courtyard of white gravel, panelled glazed room behind | Service: renovations & restorations |
| IMG_4553.JPG | 960×720 | 1920×1440 | Whole cottage across a big garden, pergola and stone walls, cypress trees | Gallery |
| IMG_4550.JPG | 960×720 | 1920×1440 | Long run of panelled timber glazing, gravel path | Gallery |
| blob-12c7c23.png | 960×720 | 1920×1440 | Glazed French-door entry with fanlights, two potted cypresses, gravel | Gallery |
| IMG_4552-f7f6957.JPG | 855×678 | 1710×1356 | Grey garage with white cross-braced door, gravel drive, trees | Gallery |

Left out:
- blob-03f1dbf.png (855×678): black-and-white copy of the garage photo — duplicate.
- blob-6ca1f86.png (1232×852), blob-c9304bd.png (1691×1123), blob-a825065.png (2136×1440): GoDaddy template stock in black and white (a man at a bathtub, two excavators by the sea, an excavator in a quarry). Not theirs.
- No logo image exists (the site logo is typed text in Cinzel).

Slots: hero 1 + services 2 + gallery 4 = 7, every own photo used once. `npm run check` requires 3 services, so the third tile (Earth moving & site prep) uses one labelled CC0 sample: "20140831_161618_resized" by Julie Brunner, https://www.flickr.com/photos/15606079@N08/14926230848 (a Cat track loader on a dirt pad, 1024×576, cropped to 660×456 around the machine). Pat's standing approval (2026-09-23). No statement/aperture section (not enough distinct photos; a statement without a photo left a big empty half on desktop).

Hero treatment: IMG_4548 upscaled to 1920×1440, shadows lifted (gamma 0.72) so the house reads under the dark overlay on phones, and 110px of sky and 110px of lawn trimmed (final 1920×1220).

## What Pat needs from Darren
- Confirm he's happy being named (name comes from the ABR, not his site).
- Licence number (search suggests 135713C for Thomaselly Pty Ltd — confirm).
- Where the photographed job is, and which parts they built.
- More photos: new homes, kitchens, bathrooms, earth moving machine, him on site. Original full-size files rather than Facebook copies.
- Suburbs they work in around the Highlands.

## Finish round (2026-09-24, Pat's call: labelled samples allowed, no upscaling)
Supersedes the upscaling notes above. **All Real-ESRGAN images were deleted.** Nothing on the page is upscaled or brightened.

- **Their own photos (6 used, native 960px or smaller, untouched):** gallery: pergola and stone walls (IMG_4548), cottage and garden (IMG_4553), garden room (IMG_4550), garden room entry (blob-12c7c23); service cards: Renovations & restorations (IMG_4549), Decks & pergolas (IMG_4554). The garage (IMG_4552) is left out so the gallery stays an even 2×2.
- **Samples (4, each tagged "Sample photo", alt generic, never called their work):**
  - Hero: sandstone cottage with dormers and a picket fence, 1800×1200, Rexness, CC BY-SA 2.0, https://www.flickr.com/photos/25287507@N02/5406893693 (heritage plaque blurred).
  - Statement: stone and red-brick cottage with a verandah, 1568×1156, Michael Coghlan, CC BY-SA 2.0, https://www.flickr.com/photos/89165847@N00/35145678841.
  - Aperture: weatherboard cottage with a red iron roof, 2321×1777 (cropped), Michael Coghlan, CC BY-SA 2.0, https://www.flickr.com/photos/89165847@N00/53608915817 (name sign blurred).
  - New homes & extensions card: timber wall frames on a slab, 2048×1536, Peg Syverson, CC BY 2.0, https://www.flickr.com/photos/18045697@N00/1459074925.
- **Sections back:** statement ("Why they come back": quality that lasts, attention to detail, polite team, repeat and referral work) and aperture ("Over 30 years of building, restoring and renovating homes, with our own earth moving"). Both use only sourced facts. Still no licence number, no suburbs and no stats strip.
- **Services:** New homes & extensions, Renovations & restorations, Decks & pergolas. Earth moving now appears in the hero sub, the services intro, the aperture line, process step 4 and the FAQ. A 4th tile sat alone on a second row.
- Hero CTA label is now "Send the details" (the check requires every "Call" label to dial). The call bar still says "Call Darren" and dials 0407 917 649.
- `noGoogleReviews: true` is kept. `npm run check`: READY TO SEND, Lighthouse mobile 93 / 100 / 100. Captures checked at 390×844 and 1440×900 (port 8981).

### Review fixes (after the 4.42 review)
- Service cards: `styles.css` shows each photo in a landscape 4:3 frame with the text beneath. Their own two service photos are offered only as the 960 file. At 1440 the 960 file shows at 416px wide, so it is scaled down, not up. The whole Renovations frame shows, stone wall included.
- Nothing displays above native size at 1x (checked with Playwright at 390 and 1440). The hero offers only 1200/1800 files and the statement only 1200/1568, so the phone's portrait crop isn't stretched. On 2x/3x screens the 960px own photos can't be fully sharp, which is a limit of the files they have.
- Aperture sample replaced: a Federation-style weatherboard bungalow porch with red-brick piers, sbittinger, CC BY 2.0, https://www.flickr.com/photos/82727312@N00/36376433690, served at 1600×900.
- Words: "Our team is fully licensed and insured." The recognition intro now reads "A registered Bowral company, with a polite and friendly team that will treat your home with care." (ABR plus their home page). The "smaller jobs" FAQ is dropped.
- Text-bar label is now "Text Darren", which fits on one line.
- Check: READY TO SEND. Lighthouse mobile 90 / 100 / 100 (the mobile hero is now 1200px, compressed to 89 KB).
