# Builder notes

Read this, `QUALITY.md` and `clients/bondi-landscapes/config.json`. Do not read
`lib/` or `templates/` — everything you need is here.

## Commands

```
npm run new -- <slug> <url> <industry>    scrape, write config, download photos
npm run build -- <slug>                   build ONE client (never run it bare)
npm run check -- <slug>                   the gate
node tools/paint-check.mjs <url>          no-JS, blocked GSAP, reduced motion, 375px
node tools/serve.mjs dist <your port>     serve to screenshot — use your own port
```

## The gate

`check` must return **no blockers and an empty to-confirm list**. It fails on:

- **Any fact with no source.** Every number with a unit, year, price, licence
  number, owner surname, award or body, and every credential word — licensed,
  insured, free consultation, warranty, guarantee, certified, qualified, fixed
  price, family-run — must appear in `_source` or the review pull. Put the
  sentence you read into `_source` with its URL, or take the claim off the page.
  **Never strip `_source`.** Facts Pat confirms with an owner go in
  `_source.confirmed`, with who and when.
- Any `_check` flag left in the config. Verify against their site and remove
  it, or delete the value.
- A rating or count that disagrees with `data/google_reviews_top25.json`.
- Unreadable text, CSS that does not resolve, horizontal scroll, the call
  button below the fold.

## Snags

- `googleReviewsUrl` / `googleWriteReviewUrl`: set both to `""`.
- Reviews come from `best_for_demo`, word for word. `"shortened": true` must be
  marked on the page.
- Text buttons only render for a mobile (04xx). A 1300 or landline gets none.
- Open every photo with the Read tool. A theme's stock image is named
  `banner.jpg` and looks like a job until you look. Fewer than 4 of their own
  = BLOCKED.

## Limits

Only `clients/<your slug>/` and your private scratch folder. No git commands.
No edits to `lib/`, `templates/`, `tools/`, `presets/`, `QUEUE.csv` or
`MORNING_REPORT.md` — if the factory is broken, report it and stop. You have no
Agent tool: self-score, and the loop runs the independent reviewer.

Screenshots at **390 and 1440 only**. No contact sheets.
