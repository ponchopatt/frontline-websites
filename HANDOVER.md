# Handover — demo-site factory

Branch `factory`. **Never touch `main`.** Each passing demo also gets `demo/<slug>`.

## Queue (QUEUE.csv has a note on every row)

| Client | Status |
|---|---|
| sunset-pools | **done** — review 4.5, branch `demo/sunset-pools` |
| utopian-landscaping | **done** — review 4.5, branch `demo/utopian-landscaping` |
| arizona-roofing | rework done, needs a fresh review (was 3.83; both blockers fixed) |
| south-coast-landscapes | rework done, passes check — needs a fresh review (was 4.0) |
| lmac | rework done, passes check — needs a fresh review (was 3.5) |
| greenway-landscapes | built, passes check — needs its first review (photos are weak: nothing over 1200px) |
| dp-landscaping | part-built: photos and a config started, no brief |
| 7 others | todo |

Phase 2 (landscaping kit) not started: `/root/.claude/uploads/…/9ff3ab6d-landscaping-kit.zip`.
Bondi and Canberra to Coast factory rebuilds fail the claim gate (no `_source`);
they need `_source.confirmed` from Pat. The live hand-built sites are untouched.

## Commands

```
npm run new -- <slug> <url> <industry>   scrape, config, photos
npm run build -- <slug>                  build one client to dist/<slug>/
npm run check -- <slug>                  the gate: blockers, to-confirm, Lighthouse
node tools/serve.mjs dist <port>         serve for screenshots
node tools/previews.mjs <slug> [port]    the 3 reviewer screenshots (mobile hero/full/scaled, desktop hero)
node tools/single.mjs <slug>             one self-contained file for a phone
node tools/paint-check.mjs <url>         no-JS, no-GSAP, reduced motion, 375px
node --test tools/test-lib.mjs           factory unit tests
```

## The process, per client

1. Fresh builder subagent: BUILDER_NOTES.md, QUALITY.md, NIGHT_RUN.md steps 2–6.
2. Fresh, separate reviewer subagent scores against the QUALITY.md scorecard.
3. Pass = average 4.5+, nothing below 4, and `npm run check` with no blockers.
4. Fail → rework agent with the findings → new reviewer. Never ship unreviewed.
5. Pass → status `done`, branch `demo/<slug>`, update MORNING_REPORT.md, push.

## Rules

- Never invent facts, reviews or prices. Reviews word for word from
  `data/google_reviews_top25.json`; shortened ones say so on the page.
- Every fact on the page needs a verbatim sentence + URL in `_source` — the
  check fails otherwise. Owner-confirmed facts go in `_source.confirmed`.
- Their own photos only; no two slots from the same job. Under 4 of their own →
  labelled sample photos (Pat's standing approval, 2026-09-23).
- Don't deploy or contact anyone. Screenshots at 390 and 1440 only.

## Live site: Vercel project "frontline-demos"

Plain static files, no build step — same as the other live sites in this repo.

- **Branch:** `demos-live` (its own history, not `factory`). Contains only the
  built output of every shipped demo, plus an index page.
- **Link format:** `<project-domain>.vercel.app/<slug>` — e.g. `/sunset-pools`.
- **Adding a new demo:** after a client passes review and gets `demo/<slug>`,
  rebuild and push `demos-live`:
  ```
  git worktree add /tmp/wt demos-live
  cd /tmp/wt && git rm -rq . && cp -r ../frontline-websites/dist-demos/. .
  git add -A && git commit -m "Refresh shipped demos" && git push
  ```
  (`dist-demos/` comes from `node bin/build-demos-site.js` on `factory` — see
  that file for how it decides which clients are "shipped".) The push alone
  updates the live site; nothing else to touch in Vercel.
- Deployment Protection is off, so links open with no login wall.

## Factory bugs found and fixed

- Trust template lacked the `--fl-*` tokens: review cards unstyled.
- Quote dark sections inherited light ink (1.06:1); `.pg-fine` 2.66:1.
- Text buttons on 1300/landline numbers; 1300 `tel:` links used +61.
- Stats bar: "+" on counts; flush left; 2–3 stats stranded far apart at 1440.
- Marquee hid unique reviews on phones; footer styles leaked into review cards.
- `form{display:grid}` beat `[hidden]`; check server port clashed in parallel.
- Structured data called the owner "founder" and put NSW towns in the ACT.
- "Sample photo" tag covered captions at tablet widths (now top right).
- Quote header left a 57px gap once the demo banner scrolled away.
- Price-guide jobs could empty the form's service menu (check now blocks it).
- No-price guide sent "Price guide: Priced once…" in the enquiry.

## Known, not fixed (polish)

- Pinned aperture section scrolls dark for ~1.5 screens on phones.
- Hero uses `sizes=100vw`, so phones stretch a small file.
- Review loop width at 1920; reduced-motion 3+2 grid leaves an empty cell.
- The claim gate reads visible text only, not the JSON-LD (LMAC's 2024 award is schema-only).
- A service card with no photo collapses and its text overlaps the card above.
- Usage: about 1M tokens per client; the session limit stops all agents at once.
- **`npm run new` can fail with `ERR_CERT_AUTHORITY_INVALID` on every site**, not
  just protected ones, in a container whose Chromium doesn't trust that
  container's TLS-inspecting proxy (confirmed: `curl` and `WebFetch` reach the
  same site fine, only Chromium's own root store rejects the proxy's cert).
  Don't disable TLS verification to fix it. Workaround used this session:
  `curl`/WebFetch to read pages and pull image URLs, `curl -o` to download
  photos, and hand-write config.json off an existing client's shape instead of
  running `npm run new`. If a future session hits this, check
  `curl -sS "$HTTPS_PROXY/__agentproxy/status"` first — it may be specific to
  this container.
