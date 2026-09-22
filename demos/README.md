# demos

Unsolicited demo sites built for cold-call pitches. **Not client work.**

These are separate from `sites/` on purpose. `sites/` holds work we were paid to do.
This folder holds work we built on spec, for businesses that have not hired us and may
never hire us.

## The rule for everything in here

Every demo carries a real business's name, logo and photography. So:

1. **Never let a demo get indexed.** Every folder ships a `robots.txt` with `Disallow: /`
   and a `vercel.json` sending `X-Robots-Tag: noindex, nofollow, noarchive, noimageindex`.
   Check both are present before you deploy one. A demo that outranks or gets mistaken for
   the real business's site is a serious problem for them and for us.
2. **Keep the link private.** Send it to the owner directly. Don't post it, don't put it in
   a portfolio, don't share it as a public example.
3. **Only use the business's own material.** Their real photos, their real copy, their real
   reviews. Never stock images, never AI-generated photos, and never images scraped from
   their Pinterest or from other businesses — inspiration boards are full of other people's
   copyrighted work, and an owner spots a stranger's garden immediately.
4. **Never invent a fact.** No made-up review counts, star ratings, prices or years in
   business. Anything unconfirmed goes in the client's `config.json` marked
   `"_check": true`, and `npm run check` refuses to pass a demo while any of it is
   still there.

   This used to say to put unconfirmed values in `[SQUARE BRACKETS]`. It does not any
   more, because a visitor could read them — `[Confirm with Antony.]` sat on the Bondi
   demo, and so did `$X,XXX`. A value nobody has confirmed now renders as nothing at
   all: the sentence that would have carried it is hidden, so there is no stub and no
   sentence with a hole in it.

5. **A Google rating only goes on a page at 4.7 or above**, and the review count goes
   with it. Below that the number works against the pitch, and a count with no rating
   beside it reads as a rating being hidden. Bondi Landscapes is the case that set it:
   roughly 27 reviews with one confirmed 1-star, so their demo shows no rating and lets
   the reviews speak instead.
6. **If they say yes**, the folder moves to `sites/`, the noindex comes off, and it becomes
   real client work.
7. **If they say no**, delete the folder. Don't sit on someone's branding indefinitely.

## Deploying a demo

**New demos are not built here.** They are built by the factory at the repo root —
`npm run new`, then `npm run build`, which writes every client to `dist/<slug>/`. One
Vercel project serves all of them, so a new demo needs no new project and no new
settings. See the root README.

The folders in here are the hand-built originals that the two templates came from.
`bondi-landscapes` is the trust template's original and is what the rebuilt version gets
diffed against, so leave it alone unless you mean to change the template.

If you do deploy one of these folders on its own: import the repo into Vercel and set
**Root Directory** to the demo's folder. Turn Deployment Protection off, or the owner
hits a Vercel login screen instead of their site.

Give it a URL that does not impersonate them. `bondi-demo-frontline.vercel.app` is fine.
`bondilandscapes.vercel.app` is not.

## Current demos

| Folder | Business | City | Status |
|---|---|---|---|
| `bondi-landscapes` | Bondi Landscapes | Bondi Beach, Sydney | In build, not yet sent. Also the trust template's original. |

Demos built by the factory live in `clients/<slug>/` at the repo root, not here.
