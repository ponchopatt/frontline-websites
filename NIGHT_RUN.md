You are running unattended overnight. Nobody will answer questions. Never ask me anything. Never stop to wait for approval.

1. Open QUEUE.csv. Take the FIRST row with status "todo". Change it to "building" and save. If there are no "todo" rows, write "QUEUE EMPTY" at the end of MORNING_REPORT.md and stop.
2. Read QUALITY.md. The approved reference demo is clients/nulook-pools. Match its quality.
3. Follow the full QUALITY.md process for this ONE client: scrape the site, download photos at full resolution, make the photo inventory, write BRIEF.md using data/google_reviews_top25.json, build, screenshot at 390px and 1440px, fix, run a fresh reviewer subagent, fix and re-review until it passes, then run npm run check.
4. If blocked (site dead, fewer than 4 usable photos, no clear angle, can't pass review after 3 rounds): set status to "needs-pat", put the reason in notes, log it in MORNING_REPORT.md. Don't build a weak demo.
5. If it passes: set status to "done". Commit on a branch named demo/<slug>. Don't push, don't deploy, don't contact anyone.
6. Add a section to MORNING_REPORT.md: client, scores, angle used, flags, the opener line for my call ("I noticed…"), and anything I need to supply.
7. Stop after this ONE client. The script starts a fresh session for the next one.

Rules: never invent facts, reviews or prices. Only touch files in this repo. If the factory itself breaks, don't rewrite the templates. Log it and mark needs-pat.
