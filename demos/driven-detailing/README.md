# Driven Detailing — demo

An unsolicited demo for a pitch. **Not client work.** Read `demos/README.md` first:
it is never indexed, the link stays private, and only the business's own material is used.

Design: Imperium Detailing's approach (`sites/imperium-detailing`, read only): photo,
headline, prices and rating on the first screen, a price picker, before and after,
reviews, then booking, with a call, text and book bar pinned to the bottom on phones.
It's dressed in Driven's own colours, taken from their site's CSS (`#05070c`, `#1a5cff`).
One type family, Archivo, self-hosted. Headings use its wide setting to echo the DRIVEN
wordmark. Everything is in sentence case, so it reads easily.

## Who they are

| | |
|---|---|
| Business | Driven Detailing. ABN 99 285 337 684 |
| Owner | **Sebastian (Seb) Smith**, a Wantirna South local. Detailing "professionally since 2025" (their words) |
| Phone | **0404 714 415** (calls and texts). No email shown anywhere |
| Base | Wantirna South VIC 3152. Fully mobile across south-east Melbourne. Travel fee outside Wantirna South |
| Hours | Mon to Sat 6am to 10pm, Sun 12pm to 10pm. Needs water and power |
| Prices | Maintenance $80/90/100, Signature $120/140/160, Prestige $260/300/320 (sedan/SUV/7-seater). Interior only from $100 and $200. 16 add-ons from $20 |
| Extras | Driven+ monthly membership (10% off, rewards ladder) and a give $30, get $30 referral scheme |
| Current site | drivendetailing.com.au, hand-built and hosted on Hostinger. Booking form is a GoHighLevel form from **Offsider Agency** (`link.offsideragency.com.au`) |
| Socials | instagram.com/drivendetailing.au · facebook.com/p/Driven-Detailing-61594324528065 |

## Worth raising on the call

Their site isn't badly built. It's fairly light, has proper SEO markup and suburb pages.
The problems are about turning visitors into bookings:

- **There's no way to book.** "Book now" opens a 9-field form on a white box that doesn't
  match the site, and it ends with "Seb will get back to you to confirm a time and price".
  Someone ready to book at 9pm has to wait for a reply, and many won't.
- **The phone's first screen sells nothing.** It's the logo, the word DRIVEN, the word
  DETAILING and the tagline, all spaced out in capitals. The photo, the prices and the
  reviews are all below the fold. Their best proof (5.0 from 50+ Google reviews) is two
  thirds of the way down the page.
- **No call or book button stays on screen on a phone.** The header has only a menu
  button, so once you scroll past the top there's no way to act without scrolling back.
- **The page is very long.** 17,846px on a phone, about 21 screens. Each of the 5 packages
  is a tall card in a sideways carousel, the 16 add-ons are a flat numbered list, and the
  Driven+ and referral sections carry a full paragraph of terms on the page.
- **It's hard to read.** Thin, widely spaced capitals and small monospace labels
  ("MOBILE · 2026", "SERVICE MENU · 2026", "E01"–"E16") look like a template, and the
  labels don't tell the customer anything.
- **Prices are hard to compare.** To see what an SUV costs across the three packages, you
  swipe a carousel and read the middle row of each card.

## What the demo does

- **First screen (phone):** their own photo of Seb and the 911, "Your car detailed at
  home or work.", the area and "Open 7 days", the rating, and the three from-prices.
  Tapping a price picks that package below.
- **Price picker:** pick sedan, SUV or 7-seater, and inside and out or interior only. The
  packages show that car's real price, with "What's included" behind a tap. The 16
  add-ons are grouped into outside, protection and inside, behind one tap.
- **Before and after:** one big slider with three of their jobs (paint, interior, wheels).
  Drag anywhere on a phone or a mouse, arrow keys on a keyboard.
- **Reviews:** their three Google reviews, word for word (shortened with "…" where long),
  first name and initial only.
- **Meet Seb, Driven+, referrals, area and hours, FAQ:** their own words, cut down. The
  Driven+ price follows the car picked above. The fine print sits behind a tap.
- **Booking:** 3 short steps (car and suburb, day and time, name and mobile), carried over
  from the price picker. With no booking system behind the demo, the last step opens a
  text to Seb with everything filled in, and shows the message to copy if the texts app
  doesn't open. **On a yes, swap this for an instant booking calendar.** That's the pitch.
- **Phone bar:** Call, Text and Book a detail, always one tap away.

**Testing the booking:** the last step opens a real text to Seb's real number. Don't
press send while testing.

## Numbers

Measured the same way for both (390px phone, cache off, `scratchpad` Playwright script):

| | Their site | Demo |
|---|---|---|
| First screen | 245KB, 9 files | 225KB, 7 files |
| Whole page, scrolled to the end | 856KB, 16 files | 452KB, 11 files |
| Page length on a phone | 17,846px | 8,387px |
| Taps from landing to a booking request | 3 taps then 9 fields, then wait for a reply | 4 fields and 3 taps, then press send |

No sideways scroll at 320, 390, 768, 1024, 1440 or 1920px. Every link and button is at
least 44px tall to tap.

## Assets — all their own

| File | Source |
|---|---|
| `assets/hero-{800,1400}.webp` | Their hero photo (Seb with the white Porsche 911), from their site, resized |
| `assets/seb-{640,1240}.webp` | Their "Meet Seb" photo, from their site |
| `assets/{exterior,interior,wheel}-{before,after}-{600,1000}.webp` | Their before and after photos (Mercedes-Benz GLE, BMW wheel), from their site |
| `assets/logo-{96,192}.webp`, `favicon-32.png`, `apple-touch-icon.png` | Their round logo badge, from their site |
| `assets/og.jpg` | Their own link-preview image, from their site |
| `fonts/archivo-var.woff2` | Archivo (SIL Open Font License), the same file the Frontline landing page uses |

**Instagram wasn't used.** Instagram blocks the sandbox browser without a login, so no
posts were pulled. Their site says every finished car goes to Instagram. From Pat's own
browser, the best extra content to pull is a short reel of a finished car (for a
hero video, like Imperium's) and more before and afters.

## To confirm

- "5.0 from 50+ Google reviews" is their own claim on their site. Check it on Google
  before the call.
- The three reviews and their dates (October, September and July 2026) are as shown on
  their site.
- "Open 7 days" is from their posted hours (Mon to Sat 6am to 10pm, Sun 12pm to 10pm).
- The demo's suburb list is the one in their FAQ.
