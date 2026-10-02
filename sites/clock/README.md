# Imperium Clock

The rebuild of the timesheet. One page, three tabs, no build step, no framework.

    index.html            the whole app — clock, jobs, timesheet, admin
    app.js                the clock, the timesheet and admin
    jobs.js               the Jobs tab: job checklists from the SOPs
    sop.js                the checklist rules (what a job gets, progress, sign-off)
    sops.json             the SOPs, with a How to do it for each step, service goals and prices
    config.js             the endpoint, the codes, the rates, the pay week, date maths
    tokens.css            the palette and type scale
    jobs.css              the look of the Jobs tab and the checklist
    fonts.css, fonts/     the two typefaces, served from here rather than Google
    sw.js                 caches the app itself, so it opens with no signal
    apps-script.gs        the Google Sheets backend (version 2: shifts and job checklists)
    manifest.webmanifest  what makes "Add to Home Screen" open it like an app
    test/                 node --test test/*.test.js (not deployed)

**It writes to the same Google Sheet as `../hours`** — same endpoint, same rows.
Both can run at once while you decide which to keep. Nothing has to be moved.

---

## Why it looks like that

The old page was a near-black screen with one bright blue accent. That is the
look every dark app defaults to, which is exactly why it read as generic.

This one is built as an **instrument** instead — the cluster of a good car at
night. The ground is warm graphite rather than blue-black, the bezel is brushed
metal, and time runs in **amber**, because that is the colour of a gauge that is
live. Imperium blue is still there, kept small, doing identity work: the tab
indicator, focus rings, links.

One element is allowed to be bold — the dial — and everything around it is
deliberately quiet. There is exactly **one** piece of motion the app performs on
its own, and it fires on the press of Start: the bezel lights tick by tick
around the face, roughly half a second, then stops. Finishing puts it out the
other way, faster, because an exit should never take as long as an arrival.
Nothing fades up on scroll.

The readout is a row of 0–9 strips behind one-character windows, so a change
rolls the way a mechanical counter does. The window is 0.45em wide because that
is what a tabular digit actually measures in Big Shoulders at weight 700.

---

## What it does

- **Start / Finish.** Two taps, and the dial tells you which state you are in
  from across a driveway.
- **Forgot to press start?** Start the shift 15, 30, 45, 60, 90 or 120 minutes
  ago, or at a time you pick.
- **Log a whole day.** For the evening nobody pressed anything. Pick the day,
  set the hours, save. **No times are recorded**, because there weren't any — it
  shows as *"Hours logged, no times"* and counts towards the week like any other
  shift.
- **On the clock now.** Who else is working, and for how long.
- **Timesheet.** Everyone, newest first, grouped by day with a daily total.
- **Admin.** Hours and pay per person per pay week, previous/next week, the CSV,
  crew and rates, add a past shift, edit or delete anything.

### Jobs: the SOPs as a checklist

**Start a job** at the car, pick the service (or two), and the checklist for
that service is built from the SOPs: the rules for every job, the service's
steps in order, the clips to film, the handover, and the sign-off. Paint
correction and ceramic coating stop the exterior steps at the rinse after clay,
as the SOPs say.

- **Tick** each step with the big round button. Every tick has a name and a
  time on it. Tap the words to open **How to do it**: a plain explanation of
  the step, plus *Add a note* and *Skip this step* (a skip needs a reason).
- **The gauge** at the top is the clock's dial counting steps instead of hours.
  **Up next** at the bottom always takes you to the next step not done.
- **Tools on the steps that need them:** paint readings per panel (flags
  anything under 80 microns or with a jump over 30), which pad and polish combo
  worked, stages done, the warranty record (works out the annual check date),
  and the handover helper with the right pitch for the job and Copy buttons.
- **The second check.** The sign-off list opens once every step is done or
  skipped, and it can't be ticked by whoever did most of the job: hand the
  phone over and pick their name. Then **Sign off**, then **Mark job done**.
  Signed off means closed: steps can't be changed unless admin reopens it.
- **Admin (1906)** can let a job through without the check, with a written
  reason that stays on the job; reopen a job; delete one; see the last 30 days
  (skipped steps, clips filmed, pitches, sign-offs) and the jobs not signed off
  this pay week; **edit the SOPs** (steps, How to do it, which lists each
  service gets, time goals, paint limits); and **download the SOPs** as
  markdown, in the same layout as the original Appendix.

- **Job summary for the group chat.** *Summary* at the top of a job (and
  *Send the summary to the group* once it's done) makes a picture: the car,
  the service, steps done out of steps (say 46/46 for a full detail), each
  stage, clips filmed, the second check, anything skipped and why, and every
  note. **Copy image**, then paste it into the Imperium group chat. On a phone
  that won't copy pictures from a web page, *Share* sends it straight to an
  app, or hold your finger on the picture to copy or save it.

- **Time goals.** Each service has one: exterior 45 min to 1 hour, interior
  1 to 1.5 hours, full detail 2 to 3 hours, maintenance 1 to 1.5 hours, paint
  correction 2 to 3 hours, ceramic coating 4 to 5 hours (two services add up).
  The job shows the time so far against the goal, from the first tick on the
  day, then how long it took. It's on the summary picture too. Admin can
  change the goals under Edit the SOPs > Services.
- **Maintenance wash** has its own list for regulars (front-only clay, sealant
  where it's needed, front seats in full, back seats where needed, door jambs a
  dry wipe if they're clean), both sign-off lists, and no pitch, review ask,
  review texts or cards.
- **Door knocking**, optional on every job: the bonus ($25 a detail, $40 paint
  correction, $75 ceramic, once booked and paid), the steps, a script with ice
  breakers, and the **instant quote**. Nothing in it counts towards the job.
- **Price calculator** on the Jobs tab: the same prices as the website's
  instant quote, by car size and service, with the $75 condition range on full
  and interior details.

A job keeps its own copy of the lists it started with. Editing an SOP changes
new jobs only. Two phones can work the same job: each tick is saved on its own,
and the later tick wins.

**New SOP wording reaches phones and the sheet by itself.** `sops.json`
carries a version. When the app opens with older SOPs, every SOP nobody has
edited in the app is replaced with the new wording, once, and saved to the
sheet. One that was edited in the app is kept as it is, and Admin says which;
new services, goals and prices are still added. Jobs already started keep the
lists they started with.

**The How to do it notes were written for the app.** The SOP lines themselves
are the Appendix plus Pat's changes (October 2026); the explanations under them
are extra.
Angus should read them over, and can change any of them under Admin > Edit the
SOPs.

### One step for Pat: update the Google script

Checklists are stored in the same Google Sheet as the hours, in three new tabs
(Jobs, Job lists, SOPs). The old script doesn't know about them, so:

1. Open the Imperium Hours spreadsheet → **Extensions → Apps Script**.
2. Select everything in the editor and delete it. Paste in all of
   `apps-script.gs` from this folder. **Save**.
3. **Deploy → Manage deployments** → the pencil on the current deployment →
   **Version: New version** → **Deploy**. The URL stays the same, so nothing
   else changes.

Until that's done the Jobs tab still works, but each phone keeps its own
checklists and the strip says *On this phone only*. The app never sends a
checklist to the old script, because the old script would file it under
Shifts. The moment the new one is live, the next open (or a tap on the strip)
sends each phone's checklists up to the sheet.

Everything the timesheet did before is unchanged.

### Works with no signal — all the way from a cold start

Three things make that true, and all three are needed:

1. **The app itself is cached** (`sw.js`), so tapping the icon in a dead spot
   opens the lock screen instead of Safari's "no internet" page.
2. **The phone remembers what the sheet last said** — the crew list and the
   shifts — so there are names to pick and a running shift still shows.
3. **Every change goes into a queue** on the phone and is sent when there is
   service. The queue survives the app being closed.

So: no bars, open the app, unlock, pick your name, tap Start. The dial runs. The
strip at the top says *No signal — showing what the timesheet last said*, and
how many changes are waiting. The moment there are bars they go up.

Under the old build a save in a dead spot simply failed, and the natural
response — tap Start again — created a double.

Two rules keep the queue honest. Because an Apps Script POST can answer with
what looks like an error **even when the write succeeded**, nothing trusts the
reply: after every send the sheet is re-read and the row is checked — its start
*and* finish, not just that it exists. And the queue is emptied by identity,
never by position, so a Finish tapped while the Start is still in the air is
never thrown away.

Only the app's own files are ever cached. The sheet is always read live.

### The lock screen, and who is holding the phone

**Every fresh open starts on the keypad.** The code is kept only for the
session, so switching to Messages and back does not ask again, but opening the
app from the home screen does. A running shift is never touched by any of this:
it lives in the sheet, and the dial picks it straight back up.

**The name is asked once per unlock.** Phones get handed around, so the app
never silently stays as the last person. The last name is highlighted — one tap
for the common case — and the picker says who is already on the clock and since
when. The lock in the header is there for everyone, not just admin.

| Code | Who | What they get |
| --- | --- | --- |
| **0000** | The crew | Clock, Jobs, Timesheet. Their name, their hours, the shift list, the checklists. |
| **1906** | Admin | All of that, plus the Admin tab: pay, crew, rates, edit, delete, CSV, job numbers, the SOP editor. |

On 0000 the Admin tab is not in the page at all — not before the sheet loads,
not after — and the checks are on the actions as well as the buttons. **It is
still a lid, not a lock** — both codes are in the page. The link is the real
key; only give it to people who should have it.

Change them in `config.js`.

### Things worth knowing

- Pay weeks run **Wednesday to Tuesday**. Week edges are calendar days, not
  7×24 hours, so the two nights a year Canberra changes clocks never double-count
  or drop a shift.
- Times come from each phone's own clock, so keep phones on automatic time.
- A finish earlier than the start is read as a shift that ran past midnight.
- Anything over 20 hours is rejected as a typo.
- Delete asks first, in a panel drawn by the page — never the browser's own
  pop-up, which an embedded viewer blocks and silently answers "no".
- A job note that starts with `=` is written to the sheet as text, not a
  formula, and the CSV does the same. Nothing typed into the app can run
  anything in the spreadsheet.
- If the same shift is edited from two phones while one of them is offline, the
  last one to reach the sheet wins. Rare, and it is visible on the timesheet.

### Checking it

    node --test test/*.test.js

runs the checklist rules and the real `apps-script.gs` against a pretend
spreadsheet: the SOPs export word for word as `test/fixtures/sops.md`, the
services get the right lists, the prices match the menu, older SOPs upgrade
without losing edits, the second check can't be done by the main worker, ticks from two
phones merge, a job that won't fit in a cell is refused, and the old script
files nothing for a job.

---

## Putting it up

Plain static files, so any host works. On Vercel: **Add New → Project** → import
the repo → set **Root Directory** to `sites/clock` → Deploy. `vercel.json` already
sets `noindex`, and `.vercelignore` keeps the tests off the site.

Then send the crew the link and one line:

> **iPhone:** open in Safari → Share → *Add to Home Screen*.
> **Android:** open in Chrome → ⋮ → *Add to Home screen*.

It opens full screen with the Imperium mark, on the keypad, and asks who is holding it.
