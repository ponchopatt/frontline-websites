# Bondi Landscapes — demo

Spec-built demo for a cold call. **Not client work. Not live. Not to be indexed.**

Read `../README.md` before doing anything with this folder.

## Who they are

Bondi Landscapes — landscape design, construction and pool building, based in Bondi Beach,
serving Sydney's Eastern Suburbs.

| | |
|---|---|
| Principal | Antony Aris — licensed landscape contractor **and** licensed pool builder, 20+ years |
| Team named in reviews | Matt, Max, Tom, Sam, Jacob |
| Phone | 0412 154 594 |
| Email | antony@bondilandscapes.com.au |
| Current site | bondilandscapes.com.au (WordPress) |
| Socials | Facebook, Instagram, Houzz, Pinterest |
| Recognition | **2025 Landscape Excellence Awards: Gold Award AND Category Winner**, Residential Construction up to $100,000, for the project "Mediterranean Courtyard". Also Best of Houzz, and a TLA member. |

Their own words, worth keeping: *"one of the best and award-winning boutique pool builders
in Sydney"* and *"a tight-knit, multi-disciplinary team"*.

### The award, confirmed from the certificate

Pat supplied the Landscape Association awards-night photo. The certificate in it reads:
**Bondi Landscapes — Mediterranean Courtyard — Residential Construction up to $100,000**,
carrying both the **Gold Award** and **Category Winner** seals, at the **2025 Landscape
Excellence Awards**. That is a specific, checkable claim and it is now on the page in place
of the vague "Gold, Silver and a Category Winner" that came off their website.

The photo itself is at `assets/Antony-Aris-Landscape-Excellence-Awards-2025.jpg` (the
original is a square social composite; the site uses the top 1080x648 of it, which is the
photograph without the promotional banner underneath). It is the only picture of Antony we
have, and a named face holding a real award does more for a stranger's trust than another
garden shot.

## Why we're calling them

Their live site has an **SEO spam injection**. Verified in page source on 22 Sep 2026:

- 88 instances of "casino", 24 of "kaszinó", 36 of "slot"
- 16+ injected headings in German, Finnish, Hungarian, Polish, Slovak and Slovenian
- Live outbound links to viggoslots.eu, one-casino.fi, lemoncasino.co.hu, vegas.hu.net,
  verdecasino.hu, energycasino.me, newgioco.com

Standard compromised-WordPress pattern, almost certainly via an outdated plugin. It is buried
in the page, so Antony probably has no idea. Google will eventually penalise the domain, and
it also means someone else currently has write access to his site.

Lead the call with the problem, not the pitch. The demo is the fix, not a cold sell.

## Assets

Everything in `assets/` came from **their own website**. The `.jpg` files are the originals;
the `.webp` files are the optimised responsive versions the page actually serves.

Filenames map to real jobs: `40 Stm`, `Bondi Road`, `56 Hastings`, `Griffith Ave`,
`Boundary St Courtyard`, `Rooftop Garden Bondi`, `Wellington St Bondi`,
`Hastings Kitchen Garden`, plus a team photo and a pool build.

**Keep the original `.jpg` files.** bondilandscapes.com.au now returns HTTP 406 to automated
requests, so they may not be re-downloadable.

### Deliberately NOT used

Their Pinterest (112 boards, 108 pins) is an **inspiration account**, not a portfolio —
boards are named "NEW LANDSCAPE INSPO", "Mediterranean Courtyards", "PLANTS", "Garden Lover".
The images on it are other people's projects and other photographers' copyrighted work. One
sampled image was red-brick Melbourne architecture. Using any of it would be spotted
instantly by the owner and would be a licensing problem. Facebook, Instagram and Houzz all
block automated access.

If more of his real work is wanted, ask him for the photo folder on the call.

## Design

Colours come from their real logo, an inline SVG in their page source: slate `#274758`,
wave teal `#4DBFA6` and sun coral `#EF4435`. Teal is the page's single accent; coral
appears only inside the logo. The ground is a near-black `#0A1418`.
(`TLA-Logo-new-1.png` on their site is The Landscape Association's membership badge,
not their logo.)

Fonts are self-hosted in `fonts/`: Big Shoulders Display for headlines (condensed caps)
and Instrument Sans for everything else.

All text/background pairs are verified against WCAG AA using the rendered colour.

## Lead capture

Their current site opens on an enquiry form (Name, Email, Phone, Project, "Enquire Now")
and repeats it at the foot of the page, so the form is plainly what the business runs
on. The demo keeps that priority without giving up the hero:

- **Laptop, 1100px and wider:** a quote card sits beside the headline, over the
  photograph, visible on load. Name, Phone, Suburb, What you are after. The headline
  only shrinks when it has to, to leave room for the card.
- **Tablet and phone:** the hero offers *Get a quote* and *Call*, plus *Or text us a
  photo* on a phone. The quote card is the first thing after the hero.
- **Mid-page:** two quote bands, after the gallery and after the reviews.
- **Header:** *Get a quote*. When the card is already on screen it just puts the cursor
  in the first field rather than scrolling.
- **Persistent:** the phone bar reads *Get a quote · Text us · Call*; wide screens get
  the small call button in the corner.
- **Foot of the page:** the full enquiry form, unchanged.

Both forms share one handler. With no `formAccessKey` they run in demo mode and make
no network call at all.

## Their Google reviews — what we actually know

Pat pulled the review list on 22 Sep 2026. Roughly 27 reviews are visible, spanning
eight years, with the owner replying to many of them. Notable:

- **Most recent: three weeks old** (Wayne Towers) and two months old (Amy Land), so the
  profile is live and they are still winning work.
- **Repeat clients**: David Walsh has used them for three separate jobs.
- **Longevity of the work**: Debbie Tan's bamboo screen is still thriving years on.
- **Team named individually by clients**: Max, Tom, Sam, Matt, Jacob.
- **Positioning in a client's own words**: "this small family-run business".
- **Exotic Nurseries' "nearly 10 years" quote is itself eight years old**, so that supply
  relationship now runs to roughly eighteen. Do not repeat the stale number.

### ⚠ There is one 1-star review

**Lars Verheyen**, two years ago, confirmed 1 star: *"I don't like to leave negative reviews
but having hired Bondi Landscapes is a decision I deeply regret and I want to avoid that
others make the same mistake."* It carries two reactions, so people have seen it.

**It is not on the demo and will not be.** Pat will decide how to handle it if and when this
becomes a real build. Nothing to do here.

The only thing it changes for the pitch:

1. **Their rating is not 5.0.** Do not say or imply it is — which is also why no star rating
   appears anywhere on the page.
2. **Do not raise it on the call.** You are ringing about a hacked website.

## To confirm with Antony — every unverified value in one list

Every one of these is a `SITE` value in `index.html`, so each is a single edit.
Nothing on the page invents a number: the prices read `$X,XXX` on purpose, so a
guess can never be mistaken for a quote.

| # | Value | `SITE` key | Currently |
|---|---|---|---|
| 1 | Design fee starting point | `designFeeFrom` | `$X,XXX` — shown in Process step 01 and the FAQ |
| 2 | Typical construction range | `typicalBuildRange` | `$XX,XXX to $XXX,XXX` — shown in the FAQ |
| 3 | Best of Houzz year | `houzzYear` | empty, so no year renders. **Do not invent one.** |
| 4 | Web3Forms key | `formAccessKey` | empty, so both forms run in demo mode |
| 5 | Google rating and review count | — | **deliberately absent.** ~27 reviews, at least one 1-star, so it is not 5.0 |
| 6 | Exotic Nurseries relationship | — | now phrased as a quote from their supplier rather than a year, since the "nearly 10 years" quote is itself eight years old |
| 7 | Current lead time | — | the FAQ now answers honestly instead of carrying a placeholder |
| 8 | Service-area list | `SITE.areas` | 18 Eastern Suburbs suburbs, also feeds the JSON-LD |

## Lighthouse

Run against the built page on 23 Sep 2026, after the quote card went in.

| | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| **Mobile** | 93 | 100 | 100 | 66 |
| **Desktop** | 100 | 100 | 100 | 66 |

Mobile: FCP 1.6s · LCP 3.1s · TBT 40ms · CLS 0. Desktop: LCP 0.8s · CLS 0.

**SEO 66 is correct and must not be "fixed".** The only failing audit is *"Page is
blocked from indexing"* — which is the entire point of a demo carrying someone
else's brand. Every other SEO audit passes. If this ever becomes the real site,
removing the noindex takes it to 100.

## Deploy

Vercel, Root Directory `demos/bondi-landscapes`. Confirm `robots.txt` and `vercel.json` ship
with it. Do not give it a URL that impersonates their domain.
