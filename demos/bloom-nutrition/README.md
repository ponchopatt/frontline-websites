# Bloom Nutrition — speed demo

An unsolicited demo for a pitch. **Not client work.** Read `demos/README.md` first:
it is never indexed, the link stays private, and only the business's own material is used.

What it is: bloomnu.com's homepage rebuilt section for section, same content and same look,
as one static page with no apps or trackers. The pitch is speed. Everything a shopper can do
still works: product links, flavour swatches and "Add To Cart" all go to Bloom's real store.

## The numbers (Lighthouse mobile, measured 12 Oct 2026)

| | bloomnu.com (live) | This demo |
|---|---|---|
| Performance score | 25–26 | 100 |
| Largest Contentful Paint | 35.8–39.0 s | 1.4–1.5 s |
| Total Blocking Time | 15.8–17.9 s | 0 ms |
| First Contentful Paint | 5.0–8.4 s | 0.9 s |
| Accessibility · Best Practices | 95 · 73 | 100 · 100 |
| Requests on load (phone) | 445 | 24 |
| Page weight on load (phone) | 6.3 MB | 0.15 MB |
| Third-party hosts | 65 | 0 |

The demo's SEO score is 66 because it ships noindex on purpose. Bloom's is 92.
Lighthouse runs with `node tools/lh.mjs <url>` from the repo root (slow 4G, 4x CPU slowdown).
The demo was measured from a local server with brotli, the way Vercel serves it.

## What REA found on their live homepage

A HAR of the homepage loaded as an iPhone, inspected with REA (`rea inspect-web-network-capture`):

- **4.6 MB of the 6.3 MB is JavaScript**, in 232 script requests. Images are only 0.8 MB.
  The slowness is code, not photos.
- **Google Tag Manager alone is 1.4 MB.** Then Facebook (457 KB), Okendo reviews (331 KB),
  Alia pop-ups (462 KB across two hosts), Klaviyo (283 KB), UserWay, Intelligems, FullStory,
  Clarity, Pinterest, Attentive and more: 65 outside hosts on one page load.
- **The hero is one PNG with the headline baked into the picture,** offered up to 5760 px wide.
  The page has no `<h1>` at all.
- **Three paid fonts** (Gazpacho, TT Travels, Timesquare) plus Poppins and the pop-up's own fonts:
  10 font files, 293 KB.
- **A full-screen pop-up** (Alia, "mystery discount" with a countdown) covers the whole page
  on phones before anything else is visible.
- The customer videos load an outside widget (Novel) and start downloading video as soon as
  the section is near.

## What the demo does instead

- **Hero headline is live text** (a real `<h1>`). The banner photos are cropped where the
  baked-in text began (desktop x 0–1440 of 2659; phone y 262 down), so the jars stay and the
  words are crisp, readable by Google and quick to show.
- **Every image is AVIF with a WebP fallback,** at 2–4 widths, and the browser picks the
  smallest that fits. Below-the-fold images load lazily. The hero is preloaded per screen size.
- **Fonts:** Bloom's three paid fonts are licensed to bloomnu.com, so the demo uses free
  look-alikes: Fraunces Black (soft) for Gazpacho and Poppins for the rest. That's 33 KB, with
  fallback metrics so nothing jumps when they load.
- **No third-party scripts at all.** About 5 KB of the demo's own JavaScript, inline.
- **Flavour swatches work:** tapping one swaps the photo (loaded from Bloom's CDN only on tap),
  flavour, pack size, price and the cart link. Sold-out flavours show a strike and "Sold Out".
- **"Add To Cart"** links to `bloomnu.com/cart/add?id=<variant>`, which puts the item in Bloom's
  real cart. On their own domain this would be an AJAX add with the cart drawer.
- **The Shop menu** is rebuilt as one panel: the same eight categories plus four best-seller
  tiles. Its images load only when it opens.
- **Videos:** posters only. Nothing downloads until someone taps play, then the full clip
  streams from the same Cloudinary files the Novel widget uses.
- **The quiz pop-up** keeps Bloom's four choices but waits 12 seconds, shows once per visit,
  and never covers the page on arrival. It makes no discount promise and collects nothing;
  the real "mystery discount" lives in Alia.
- **Newsletter form is demo mode:** it sends nothing and says so.

## Assets — all their own

| File | Source |
|---|---|
| `assets/favicon.svg` | Their favicon (the "B" with leaves), decoded from the data URL in their page head. |
| Logo (inline `<symbol id="logo">`) | `bloomnu-logo.svg` from their CDN; the paths only, coloured with `currentColor`. |
| `assets/hero-d-*`, `hero-m-*` | Their "Fitness Starter Kit" banners (`ACQbundle1-Desktop.png`, `ACQbundle-1-Mobile_1.png`), cropped to remove the baked-in text. |
| `assets/p-*` | The best-seller product photos from the homepage slider (800 px PNGs). |
| `assets/sw-*` | Their flavour swatch icons, rasterised to 72 px WebP. |
| `assets/save-d-*`, `save-m-*` | Subscribe & Save box photos (`save-desktopxl_2.png`, `save-mob_1.png`). |
| `assets/cat-*` | The four "Bloom Into Your Best Self" tiles. |
| `assets/founder-*` | `mari-about-desktop_4.png`, Mari Llewellyn with her name tag (baked in by Bloom). |
| `assets/r-*` | The retailer logos from their scrolling bar, trimmed and resized to 64 px tall. |
| `assets/bev-d-*`, `bev-m-*` | Bloom Pop and Sparkling Energy cans (`bev-desktop_1.png`, `bev-mobile_1.png`). |
| `assets/ugc-*` | First frames of the six customer videos in their Novel widget (Cloudinary `benovel`). |
| `assets/s-*` | Their footer social icons. |
| `fonts/*` | Fraunces and Poppins from Google Fonts (SIL Open Font License), Latin subset. |

Prices, flavours, pack sizes, variant IDs and sold-out states come from each product's public
`bloomnu.com/products/<handle>.js`, read on 12 Oct 2026. All copy is theirs, word for word,
except the quiz heading and line ("What are you looking for?" / "Let us know and we'll point
you to the right Bloom.") and the demo notes.

## To confirm

- Prices and stock change. Re-read the product `.js` files before sending the link.
- The Shop menu's right-hand tiles are product photos, not the lifestyle shots Bloom uses there.
- Quiz choices map to: Fitness Fuel → `/collections/gym-supplements`, Gut Health →
  Gut Health & Beauty Duo, Energy Boost → `/collections/energy`, I'm not sure → their quiz page.
  There is no gut-health collection URL; the duo is the closest named product.

## Worth raising on the call

- A shopper on a mid-range phone waits about 36 seconds for the hero (Lighthouse, slow 4G).
  Most never see it.
- The phone pop-up appears before the products do.
- The hero headline is inside an image: no `<h1>` for Google, and it blurs on large screens.
- 65 outside hosts on one page. Every one is a script to keep up to date, a privacy question,
  and time on the main thread.
