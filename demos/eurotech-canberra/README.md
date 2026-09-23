# Eurotech Canberra — demo

An unsolicited demo for a cold call. **Not client work.** Read `demos/README.md` first:
it is never indexed, the link stays private, and only the business's own material is used.

Design: Imperium Detailing's system (`sites/imperium-detailing`, read only), carried over
section for section, with Imperium's blue swapped for Eurotech's lime.

## Who they are

| | |
|---|---|
| Business | Eurotech Canberra, European car specialists |
| Address | 103 Newcastle St, Fyshwick ACT 2609 |
| Workshop | 02 6189 8954 |
| Mobile | 0431 614 455 (the only number that can take a text) |
| Email | service@eurotechcanberra.au |
| Current site | eurotechcanberra.au |
| Socials | facebook.com/eurotechcanberra, instagram.com/eurotech_canberra, youtube.com/@eurotech_canberra |
| Master technician | Vijesh Otto, "VJ" to his customers. 12 years on ultra-exotic cars in Bahrain and Dubai (their words) |
| Brands | Audi, BMW, Mercedes-Benz, Porsche, Volkswagen, Škoda, Cupra, Alfa Romeo, Maserati |

## Worth raising on the call

- **Their live site has another company's name on it.** The EV section reads *"At Static
  Electrics, we facilitate your swift return to the road with our rapid, economical, and
  expert EV charger repair services."* It was pasted from an EV-charger business and
  never edited. The demo's EV card says only what they actually offer.
- **Most of the car photos on their site are stock.** The moody Mercedes grille, the
  Porsche 718 with US plates, the Škoda in an alley, the engine renders. Their own
  workshop photos are far better and are what the demo uses.
- Small copy slips on the live site: "back up an running", "UAE EXPERTISE" as a heading
  for work done in Bahrain and Dubai.

## Assets — all their own

| File | Source |
|---|---|
| `assets/logo-ring.svg`, `logo-mark.svg` | Their logo files from eurotechcanberra.au. `logo-ring.svg` is the same artwork as the PNG Pat supplied, in vector, and sits in the footer. The header uses the mark. |
| `assets/logo-wordmark.svg` | Their stacked logo file (`eurotech-footer-logo.svg`) with its viewBox cropped to the wordmark. Cropped, not redrawn. Lime is their own fill, `#BBCC1A`. |
| `assets/huracan-graded-*`, `huracan-front-*`, `og-eurotech.jpg` | Photos of an orange Huracán under their sign, supplied by Pat. The graded shot leads the gallery and is the link preview; the front-on shot with the Eurotech plate sits beside the address. |
| `assets/*-{480,800,1200}.webp` (the rest) | Their website gallery (the R8, M2, coilovers, tool kits, diagnostics), the Golf R with their plate surround, and the master technician at an engine. |
| `media/hero-{1080,720}.{webm,mp4}` | A 6-second iPhone pass along the Huracán under the sign, supplied by Pat. Cropped to the panel's shape, played forward then reversed so the 11.8s loop never jumps. 1080 for a sharp laptop screen, 720 otherwise; fetched only after the page has loaded. |
| `media/hero-poster.webp`, `hero-blur.webp` | The clip's first frame; `hero-blur` is a 96px copy for the blurred backdrop, which looks identical at 48px blur and weighs 2KB. |
| `media/cayenne-{720,480}.{webm,mp4}`, `cayenne-poster.webp` | Their Instagram reel of a Porsche Cayenne GTS Stage 2 build, supplied by Pat. Cut to 18.4s without the black title cards, cropped above the "@eurotech_canberra" sticker. Plays in the Stage 2 section, fetched only as it nears the screen. |

**Deliberately not used:** every stock photo on their site (see above), the manufacturer
logos (trademarks), the reviewers' profile pictures.

**Facebook and Instagram could not be read from here** (Facebook shows a login wall,
Instagram rate-limits). The only social content used is the reel Pat supplied.

## To confirm with Eurotech

| # | What | Currently |
|---|---|---|
| 1 | Opening hours | **Not shown.** Their site does not list them. |
| 2 | Google rating and review count | **Not shown**, and the review cards carry no stars: nothing confirms what each reviewer gave. |
| 3 | "Reply within 2 business hours, Mon–Fri" | Their own promise from their quote form. Confirm they still stand by it. |
| 4 | Mobile diagnostics across Canberra | Their own claim. Confirm the area. |
| 5 | Which number is primary | Calls go to the workshop line, texts to the mobile. |
| 6 | Web3Forms key | `SITE.formAccessKey` is empty, so the form runs in demo mode and sends nothing. |
| 7 | Reviews | Four, verbatim but trimmed, from their website. Ask for permission to use full reviews and for Google reviews. |
| 8 | Prices | None shown. Imperium leads with from-prices; ask if they will publish any. |

## Behaviour

- Header scrolls away with the hero (Pat's rule after Bondi); a phone bar (*Text us your
  rego · Call*) and a corner call button on wide screens take over after the hero, and
  stand down over the quote form and the footer's buttons.
- The hero clip pauses when scrolled off screen, and does not autoplay under reduced motion.
- Every element's CSS default is its final state; animation only ever sets a temporary
  starting point. With JavaScript off, everything is visible.

## Lighthouse

Run on 23 Sep 2026.

| | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| **Mobile** | 91–93 | 100 | 100 | 66 |
| **Desktop** | 100 | 100 | 100 | 66 |

Mobile varies between runs; LCP 3.1–3.4s (the hero paragraph), TBT 10ms, CLS 0. Desktop LCP 0.7s.
**SEO 66 is correct**: the only failing
audit is "Page is blocked from indexing", which is the point of a demo.

`tools/paint-check.mjs` passes all six conditions (1440, 390, 375, no JS, GSAP blocked,
reduced motion).

## Deploy

Vercel, Root Directory `demos/eurotech-canberra`, no build step. `robots.txt` and
`vercel.json` send noindex on every file. Name the project something that does not
impersonate them, e.g. `eurotech-demo-frontline`.
