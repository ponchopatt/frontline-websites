# Frontline Websites

Client sites, the demo-site factory, and the design skills used to build them.
Kept separate from the trading project so the two never mix.

---

## Add a client in 5 steps

```
1.  npm run new -- nulook-pools nulookpools.com.au pools
2.  open clients/nulook-pools/config.json and work through the checklist it printed
3.  paste their Google reviews in, word for word
4.  npm run build
5.  npm run check -- nulook-pools        # fix what it says, then send the link
```

That is the whole loop. Step 2 is the only one that takes real time, and the
checklist tells you exactly what to fill in.

**Industries:** `pools` `landscaping` `builders` `granny-flats` `kitchens-joinery`
`bathrooms` `roofing` `air-conditioning` `solar-batteries` `fencing` `concreting`
`decks-pergolas` `glazing`

The industry picks the template, so you never choose one by hand.

---

## The two templates

| | Trust | Quote |
|---|---|---|
| **For** | Big jobs bought on whether they believe you | Mid-size jobs bought on price and speed |
| **Trades** | Pools, builders, extensions, granny flats, landscaping, kitchens, bathrooms | Roofing, air conditioning, solar, fencing, concreting, decks, glazing |
| **Look** | Near-black ground, full-bleed photography, type set big | Bone ground, charcoal sections, one accent that acts |
| **Signature** | The aperture — a photo that opens as you scroll | A price guide that answers in ten seconds |
| **From** | `demos/bondi-landscapes` | `sites/canberra-to-coast-fencing` |

Both designs are kept exactly as they were. `templates/` only holds their content
pulled out into config. The two originals stay where they are and are what the
rebuilds get diffed against.

---

## The commands

```
npm run new -- <slug> <url> <industry>   read their site, write a config and their photos
npm run build                            every client to dist/<slug>/
npm run build -- <slug>                  just one
npm run check                            is this safe to send?
npm run check -- <slug> --draft          same, but ignore the to-confirm list
npm run check -- <slug> --fast           skip Lighthouse
npm run batch -- prospects.csv           run new for a whole list
npm run single                           fold each demo into ONE html file you can open
npm run single:check                     prove those match what deploys
npm test                                 the unit tests
```

### Sending a demo before it is hosted

`npm run single` writes `dist-single/<slug>.html` — the whole demo, photos and
fonts and scripts inlined, in one file. Double-click it and it works: no server,
no internet, nothing to unzip. That is the thing to send yourself before a call,
or to open on a phone.

`npm run single:check` opens each one off disk **with the network switched off**
and compares it to the built site next to it: same words, same images, same
headline font and size, same page height to within 1%, no console errors, at 375,
390, 1440 and once with JavaScript disabled. It is not enough that the single
file renders — nothing may have gone quietly missing when forty files became one.

`dist/<slug>/` is still what deploys. A host serves separate cacheable files; a
data URI cannot be cached, shared between pages, or fetched only when needed.

### What `new` will and will not do

It reads their home, services, about, gallery and contact pages, then pulls out
the name, phone, email, ABN, years in business, suburbs, service names, about
text and licences, and downloads their **own** project photos as webp at 800 and
1800.

Everything it worked out is listed in `_check` and **is not trusted**. `check`
fails while any of it is still there. That is the whole safety model: the
machine is allowed to be wrong, it is not allowed to be quietly wrong.

It will not:
- invent a review, a rating, an award, a licence, a price or a year
- use a stock library photo (it detects them by filename as well as host, and
  sorts their own work first so stock can never become the hero)
- write a config when it learned nothing, which is what a bot-protected site
  looks like from here

Some sites cannot be read at all. SiteGround and Cloudflare challenges bind to
the IP that solved them, and ours rotates. When that happens the tool says so and
you build that one by hand.

### What `check` looks for

**Blockers** — always fail:
placeholder text a visitor could read · missing required fields · a photo that
is not on disk · a phone number that will not dial · a stat that reads as
invented (a round number is a tell) · horizontal scroll at 375 or 390 · the call
button below the fold · the sticky bar sitting over the form's send button ·
console errors · a stock photo that made it onto the page

**To confirm** — anything `new` guessed. Fails too, so nothing goes out on
autopilot. `--draft` lets them through while you are still filling blanks.

Then Lighthouse mobile. **SEO scores in the 60s on purpose** — the only failing
audit is "page is blocked from indexing", which is the entire point of a demo
carrying someone else's brand.

---

## Rules the code enforces

- **Nothing is invented.** No made-up reviews, ratings, prices or years. A value
  nobody has confirmed renders as nothing at all — the sentence that would have
  carried it is hidden, so there is no stub and no sentence with a hole in it.
- **A Google rating only shows at 4.7 or above**, and the review count goes with
  it. Below that the number works against the pitch, and a count with no rating
  beside it reads as a rating being hidden. Bondi Landscapes set this rule: ~27
  reviews, one confirmed 1-star, so their page carries no rating at all and the
  reviews themselves do the work.
- **Only their own photos.** Stock is excluded and flagged.
- **Every section hides when empty.** No empty headings, no "0" counters, no
  button that goes nowhere.
- **The page works with no JavaScript.** Headline, subhead, hero image and a call
  button all paint on the first frame. GSAP is enhancement only: CSS defaults are
  the final states and GSAP only ever sets a temporary from-state.
- **Mobile first.** Tested at 375 and 390. 44px tap targets, no horizontal
  scroll, the sticky bar never over the send button.

---

## Demo safety

While `live` is `false`, every demo ships:

- `noindex` in the page **and** as a response header, plus a `robots.txt`
- a footer line: *this is a demo built by Frontline Systems as a proposal for
  &lt;business&gt;, and it is not their live site*
- a slim dismissible banner naming who it was prepared for, which **`?clean=1`
  removes** so you can show the same URL mid-call without the pitch on it
- a form that validates, shows the real success message, says plainly that
  nothing was sent, and **makes no network call at all**

Set `live: true` and all of it comes off.

To turn the form on for real, put a [Web3Forms](https://web3forms.com) access key
in `form.accessKey`. Then it posts, shows a loading state, and on failure names
their phone number rather than dead-ending.

---

## Hosting

One Vercel project for all of them.

1. Import this repo. Leave **Root Directory** empty — the root `vercel.json`
   already sets `buildCommand: npm run build` and `outputDirectory: dist`.
2. **Settings → Deployment Protection → turn it off.** Otherwise every prospect
   hits a Vercel login screen instead of their demo. This is the one that bites.
3. Demos land at `<project>.vercel.app/<slug>`, and `/` lists them all.

Point a real domain at it later without rebuilding anything.

---

## Layout

```
clients/<slug>/config.json     one file per client, plus their assets/
presets/                       _base plus 13 industries; the client overrides both
templates/trust|quote/         template.js renders, styles.css, page.js runs in the browser
lib/blocks/                    the blocks both templates share
lib/                           config, render, build, scrape, images, check
bin/                           new, build, check, batch
tools/                         paint-check, interact-check, compare, lighthouse
demos/                         hand-built demos — the design reference
sites/                         paid client work
dist/                          build output (gitignored)
dist-single/                   one-file copies for sending (gitignored)
```

**Merge order:** `presets/_base.json` → `presets/<industry>.json` → the client's
own file. Objects merge, **arrays replace whole** — four FAQs in a client config
means four, not their four plus the preset's six.

---

## The client sites

| Folder | Client | What it is | Live at |
|---|---|---|---|
| `sites/imperium-detailing` | Imperium Detailing | Mobile car detailing, Canberra. Next.js, many pages. | imperiumdetailing.com.au |
| `sites/canberra-to-coast-fencing` | Canberra to Coast Fencing | Colorbond fencing. One page, static. Also the quote template's original. | not live yet |
| `sites/crossroads-church` | Crossroads Christian Church | ~50 pages from a Python generator. | not live yet |
| `sites/frontline-systems` | Frontline Systems | Our own site. | frontlinesystems.com.au |
| `sites/clock` | Imperium Detailing | Staff clock-in app. | not live yet |

Those are built and deployed as they always were — one Vercel project each, Root
Directory set to the site's folder. The factory does not touch them.

---

## The design skills

`.claude/skills/` holds the 10 skills used on these builds, so they travel with
the work. They load on their own when a job matches. Nothing to install.
