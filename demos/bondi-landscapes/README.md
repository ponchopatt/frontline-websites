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

Palette is sampled from their actual project photography — warm sandstone, deep garden
green, pool blue — not from their current site's CSS, which is mostly theme defaults.

Their logo (`TLA-Logo-new-1.png`) is **pure white**, so it is built for dark backgrounds.
That drives the dark hero and header.

All text/background pairs verified against WCAG AA. Brass `#B08D57` passes only on dark
grounds (2.67:1 on bone) so it is never used for text on light sections.

Fonts are self-hosted in `fonts/`: Fraunces (display) and Hanken Grotesk (body).

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
| 4 | Booking link | `frontlineBookingUrl` | `#enquire` — swap for a real Calendly/Cal.com link |
| 5 | Web3Forms key | `formAccessKey` | empty, so the form runs in demo mode |
| 6 | Google rating and review count | — | **deliberately absent.** ~27 reviews, at least one 1-star, so it is not 5.0 |
| 7 | Exotic Nurseries relationship | — | now phrased as a quote from their supplier rather than a year, since the "nearly 10 years" quote is itself eight years old |
| 8 | Current lead time | — | the FAQ now answers honestly instead of carrying a placeholder |
| 9 | Service-area list | `SITE.areas` | 18 Eastern Suburbs suburbs, also feeds the JSON-LD |

## Lighthouse

Run against the built page on 22 Sep 2026.

| | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| **Mobile** | 92 | 100 | 100 | 66 |
| **Desktop** | 100 | 100 | 100 | 66 |

Mobile: FCP 1.9s · LCP 3.2s · TBT 10ms · CLS 0.

**SEO 66 is correct and must not be "fixed".** The only failing audit is *"Page is
blocked from indexing"* — which is the entire point of a demo carrying someone
else's brand. Every other SEO audit passes. If this ever becomes the real site,
removing the noindex takes it to 100.

## Deploy

Vercel, Root Directory `demos/bondi-landscapes`. Confirm `robots.txt` and `vercel.json` ship
with it. Do not give it a URL that impersonates their domain.
