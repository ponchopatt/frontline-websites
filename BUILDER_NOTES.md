# Builder notes — read this instead of reading the factory

Written for the overnight run. The first builder agent spent twenty minutes
reading `lib/`, `templates/` and `presets/` to work out what is written below.
Nobody needs to do that again. Read this, `QUALITY.md`, and
`clients/bondi-landscapes/config.json`, and you know enough to build.

## The five commands

```
npm run new -- <slug> <url> <industry>   scrape their site, write a config and their photos
npm run build -- <slug>                  build JUST that client (never run it bare — it rebuilds everyone)
npm run check -- <slug>                  the gate. No blockers AND an empty to-confirm list
node tools/paint-check.mjs               no-JS, blocked-GSAP, reduced-motion and 375px
node tools/serve.mjs dist <port>         serve dist/ so you can screenshot it
```

Use the port you were given, not 8900. Other agents are serving at the same time.

## The config

`clients/<slug>/config.json`, merged over `presets/_base.json` then
`presets/<industry>.json`. Objects merge; **arrays replace whole** — four FAQs in
your config means four, not your four plus the preset's six.

Copy the shape from `clients/bondi-landscapes/config.json`. Every field is
optional except the ones `check` names, and **every section hides when empty** —
no empty headings, no `0` counters, no dead buttons. Leaving something out is
always safe. Making something up never is.

## The snags, in the order they will bite you

**`_check` is the gate.** `npm run new` flags everything it guessed in a
`_check` array. `check` fails while any entry remains. For each one: verify it
against their own website and delete it from the array, or delete the value it
guards. Never delete the flag while keeping an unverified value — that is the one
move this whole safety model exists to prevent.

**`googleReviewsUrl` / `googleWriteReviewUrl` cannot be derived.** Set both to
`""` and drop them from `_check`. The checker only objects if exactly one of the
pair is set.

**The rating and the count come from `data/google_reviews_top25.json`**, keyed by
your slug, and nowhere else. `check` compares your config against that file and
blocks on any disagreement. A 5.0 the file confirms passes. Below 4.7 the rating
and count are both hidden on purpose — that is not a bug, and the note in
`check` explains it.

**Reviews come from the same file**, from `best_for_demo`, word for word, names
as published. 4–6 of them, varied. Never edit a review's wording. Never write
one. `"shortened": true` means Google cut it off — allowed in a demo, and it goes
in the report as something to replace before the site goes live.

**Stock photos are the failure that kills the pitch.** Filename and host
detection cannot see a photo a WordPress or Duda theme shipped — those are named
`banner.jpg` and `h6-about-img2.png` and look like a photo of a job until you
open them. Two of the first four prospects had no photos of their own work at
all, and only looking found it. **Open every image with the Read tool and look at
it.** An owner recognises a stock photo of somebody else's pool instantly and the
call is over.

**Phone numbers.** `toE164` and `formatAuPhone` in `lib/render.js` handle the
odd spacing scraped off a site. A number that will not dial is a blocker.

## What you may not touch

Only `clients/<your slug>/`. Not `lib/`, `templates/`, `bin/`, `tools/`,
`presets/`, `QUEUE.csv`, `MORNING_REPORT.md`, another client's folder, or any
git command at all — the loop that launched you owns git and the queue. If the
factory itself is broken, say so in your report and stop. Do not rewrite a
template to get your demo to pass.

## What "done" means

`npm run check -- <slug>` comes back with no blockers and an empty to-confirm
list, Lighthouse mobile is 90+ performance and 95+ accessibility, and a fresh
reviewer agent that did not build the thing scores the six QUALITY.md items at
4.5+ average with nothing below 4.

SEO scores in the 60s on purpose. The only failing audit is "page is blocked from
indexing", which is the entire point of a demo carrying someone else's brand.
