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
   business. Anything unconfirmed goes in `[SQUARE BRACKETS]` and gets listed in that
   demo's README under "To confirm".
5. **If they say yes**, the folder moves to `sites/`, the noindex comes off, and it becomes
   real client work.
6. **If they say no**, delete the folder. Don't sit on someone's branding indefinitely.

## Deploying a demo

Same as any site in this repo: import the repo into Vercel, set **Root Directory** to the
demo's folder, e.g. `demos/bondi-landscapes`. One Vercel project per demo.

Give it a URL that does not impersonate them. `bondi-demo-frontline.vercel.app` is fine.
`bondilandscapes.vercel.app` is not.

## Current demos

| Folder | Business | City | Status |
|---|---|---|---|
| `bondi-landscapes` | Bondi Landscapes | Bondi Beach, Sydney | In build, not yet sent |
| `eurotech-canberra` | Eurotech Canberra | Fyshwick, Canberra | Built, not yet sent |
| `aqua-brothers` | Aqua Brothers Plumbing | Canberra | Built, not yet sent |
