# Bondi Landscapes — demo

Spec-built demo for a cold call. **Not client work. Not live. Not to be indexed.**

Read `../README.md` before doing anything with this folder.

## Who they are

Bondi Landscapes — landscape design, construction and pool building, based in Bondi Beach,
serving Sydney's Eastern Suburbs.

| | |
|---|---|
| Principal | Antony Aris — licensed landscape contractor **and** licensed pool builder, 20+ years |
| Team named in reviews | Matt, Jacob, Max |
| Phone | 0412 154 594 |
| Email | antony@bondilandscapes.com.au |
| Current site | bondilandscapes.com.au (WordPress) |
| Socials | Facebook, Instagram, Houzz, Pinterest |
| Recognition | Landscape Association Gold / Silver / Category Winner, Best of Houzz, TLA member |

Their own words, worth keeping: *"one of the best and award-winning boutique pool builders
in Sydney"* and *"a tight-knit, multi-disciplinary team"*.

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

## To confirm with Antony before this could ever go live

- [ ] Google rating and review count — **not confirmed**, deliberately left out rather than guessed
- [ ] Years in business — his site says 16+ in the meta description and 20+ in the body; which?
- [ ] Whether the named projects can be used publicly, and their real job names
- [ ] Form destination — needs a Web3Forms access key, or point it at his inbox
- [ ] Service area list — currently a sensible Eastern Suburbs list, not his actual coverage
- [ ] Any pricing or timeframe claims

## Deploy

Vercel, Root Directory `demos/bondi-landscapes`. Confirm `robots.txt` and `vercel.json` ship
with it. Do not give it a URL that impersonates their domain.
