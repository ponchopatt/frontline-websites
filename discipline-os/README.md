# Discipline OS

A personal operating system for five daily questions:

1. Did I start my day correctly?
2. Did I spend time with God?
3. Did I complete the work I committed to?
4. Did I take care of my body?
5. Did I keep my word?

Single user today, multi-tenant safe: every table is locked to `auth.uid() = user_id`.

Next.js 16 (App Router, TypeScript strict) · Tailwind 4 · shadcn/ui · Supabase (Postgres, Auth) ·
Zod · date-fns / date-fns-tz · Lucide.

## What it is now: a personal operating system for your life

Big goals say where I'm going. Weekly goals say what matters now. Daily tasks say what to do. The
scoreboard says whether I actually did it. It's built for an iPhone first (390×844, safe areas,
one hand, portrait), and every screen follows the same few rules: a large title, then grouped
lists of plain rows; one filled button at most; nothing under 44 points to tap or 13 pixels to
read; never a card inside a card; tap a row to open its details in a sheet (drag it down to close).

**The look (Onyx, the default):** cool and quiet, like a well-made watch face. A charcoal-blue
ground with a cold light from above and a fine grain; panels of smoked glass with a hairline of
light along the top; ice-white type in Geist; platinum for the one filled button; a cool mint once
something is kept. Settings → Appearance also has **Sage** (a deep green ground with frosted white
glass, after the "Lightly" journal app), **Spark** (an orange glow across the top of each page,
fading into cream), **Dark** (black and lamplight gold) and **Light**.

**Four tabs, one job each:**

| Tab | Job | What's in it |
|---|---|---|
| **Today** | execute | Everything that matters right now |
| **Goals** | direction | Year → month → week → today, the areas (Imperium, Websites, AI Bot, Fitness, Faith, Personal), and the Business and Week pages |
| **Faith** | spiritual life | Today's reading, Read / Journal / Pray, the journal, past entries. Kept quiet on purpose |
| **You** | reflection and history | Streak, best and this month, then Keep my word and momentum, records and streaks, proof, the weekly review, the work log, habits, settings and "Redo setup" |

**Today** reads top to bottom in order of importance, in about two phone screens:

1. **Header:** "Thursday afternoon · 24 September", one big line for the day's state ("Keep
   going, Angus."), **Keep My Word %** with "13 of 17 kept", the week's average and the streak,
   and this week as seven dots (a tick for each day the word was kept, today lit). ‹ › step to
   earlier days to fill them in.
2. A running timer, when one is running, with Stop.
3. **Up next:** the one thing to do now, why, and the one button that does it (Start the work,
   Done, Close the day). "Something else" steps down the list.
4. **Today's Big 3** and supporting tasks as tick rows. **Add task** takes plain words: "Call 10
   Imperium leads" files itself under Imperium and ties itself to the Leads called counter.
   **Plan my day** suggests a Big 3, a short supporting list and work blocks. Unfinished tasks
   from yesterday and "later" tasks sit folded underneath.
5. **Your day:** Morning, Faith, Fitness, Work, Imperium, Websites, AI Bot, Discipline and the
   Night review, one row each with its number and a ring. Tap one for everything in it, in a
   sheet: the morning routine's ticks; today's reading, Read / Journal / Pray and evening prayer;
   the gym week, cardio minutes and extras; work by business, blocks and sessions; each
   business's counters with − / + and today's target; the AI bot's milestone and steps;
   discipline; and the night review with **Close day** and the day's proof photos.
6. **I'm having a shit day** (see *The daily loop* below).

The **+** beside the tab bar (on Today only) opens **Log something**: Work (start or stop a
timer), Imperium call and Website call (+1 each), Revenue (an amount, for Imperium or Websites),
Cardio (minutes), Gym, Habit (anything still to tick) and Note (kept for later, under the tasks).

**Business** (under Goals): Imperium, Websites and the AI bot, with day, week, month and year
totals for every counter, and where to set weekly targets.

**Week** (under Goals): the weekly scoreboard and Weekly Boss, this week's goals, and the review:
biggest win, biggest failure, main bottleneck, next week's #1.

**Goals** keeps the year → quarter → month → week → today planning, and **Suggest my goals**:
concrete weekly goals ("Call 60 qualified leads this week", never "work harder") built from your
last weeks of numbers, your targets, the hours you have and what you say you want, each with a
one-line reason. Nothing is added until you approve it. Goals can be measured straight from a
counter, so the week's leads goal fills as you log leads.

### The daily loop

Plan → execute → see progress → close the day → review → want to do better tomorrow. The user's
own numbers are the motivation: no quotes, no XP, no coins.

- **The day's state** sits in the greeting: *New day*, *Build the day* (morning), *Keep going*
  (afternoon), *Close it out* (evening), *Day complete* once it's closed.
- **What should I do next?** One action, why it's the one, and a Start button that starts the
  timer (or Done, or Go there). It weighs the Minimum Day first, then a running timer, the
  morning routine first thing, a work target within 45 minutes, the Big 3 in order, overdue and
  left-over tasks, business numbers behind today's target, work hours, supporting tasks, habits
  still due, the AI bot's next step, and in the evening the night review and Close Day. With
  nothing urgent, it points at the week's biggest gap. "Something else" gives the next one down.
  (`src/lib/next-action.ts`.)
- **"One more"** prompts show only when something is nearly done: "18 minutes left. Finish it.",
  "One more call.", "2 minutes left.", "One commitment left.", "One more gym session this week."
  Once it's done it turns sage with a tick and the prompt goes. (`src/lib/gradient.ts`.)
- **Scoreboard bars** fill as things get done and turn sage when a part is complete; the work
  line shows a trophy at the target. Each business counter shows today's target as a bar.
- **I'm having a shit day** switches on the **Minimum Day**: Bible, Prayer, Journal, 20 minutes
  of focused work, gym or 20 minutes of cardio, shower, sleep (change the list in Settings). The
  rest of the day folds away behind "Show the full day". Once every item is done: *Minimum day
  secured. You kept the chain alive.* Keep My Word still counts the whole day, so the number never
  pretends; a secured minimum day keeps the streak alive, and the year view marks it.
- **Close day** is one tap (it stops a running timer; optional habits don't block it) and opens
  the **Day complete** screen: Keep My Word, focused work, commitments kept, tasks and habits
  done, work by business, what got done, records broken, and the **replay**: the day in time
  order from what was already tracked (ticks, work sessions, tasks, counters, proof, the review).
  The summary is stored with the day. "Replay the day" reopens it.
- **Personal records** are spotted the moment they happen (most work in a day or week, most
  leads or calls in a day, best revenue day/week, longest cardio, most gym sessions in a week,
  streak records) and show once: *New personal record: 9h 14m of work today. Previous record:
  8h 42m.* A first time is never a record; there has to be something to beat.
- **Now and then** cards compare today's history with a month or three ago, on every third
  day only, and only from stored numbers.
- **Momentum** and the **Weekly Boss** sit under the scoreboard.

**Progress** (the new tab) has three views: Scoreboard, Trophies and Proof. *Scoreboard*: Keep My Word today, this week and this
month, commitments made / kept / broken, week-by-week and month-by-month; **Momentum** (the
average of Keep My Word, work hours against the target, habits and tasks over the last seven
finished days; rising or falling means 5 points against the week before, and every part is
shown); the **year in squares** (strong, average, poor, not completed; a ring marks a secured
minimum day; tap a day for its numbers and replay, then step to the day before or after); **streaks** for Keep My Word, the morning
routine, Bible, prayer, gym, cardio, the work target and the night review, each on its own card
with its best, how many due days were kept in the last six weeks, and those six weeks as a grid of
dots, so one miss never wipes the picture; and **what you've done**, plain sentences from the history ("You've called 1,284 Imperium
leads."). *Trophies*: personal records as trophy cards, and a shelf per streak with a trophy for each
milestone its best run reached (3, 7, 14, 30, 60, 100, 365 days) and the next one, locked, with
the best so far. Only days actually kept earn them. *Proof*: every proof photo, newest first by day, filtered by today, this week, this
month or all, and by Faith, Gym, Imperium, Websites, Work or Other. The Proof card on Today files
a photo under one of those with one tap.

**Week** opens with the **Weekly Boss**: the week's targets (work hours, Bible and prayer days,
gym and cardio, leads, reels, revenue, demos, calls…) as one fight, actual against target. It's
*defeated* when most targets are hit by the end of the week; otherwise it *survived this one*, and
next week starts from those numbers.

**Not built:** an XP or level system (the brief made it optional; Keep My Word and the records
already reward only real execution).

### Focus weeks

Three businesses can't all get deep work at once. At the start of a week, pick one to focus on
(**Pick a focus** on Today, or the **Focus** row at the top of the week's page): the whole week,
or day by day (Imperium Monday to Wednesday, Websites after). The sheet suggests the business
that has had the least of your time in the last two weeks, leaving out last week's focus.

- **The focus gets the deep work.** Its hours for the day are the work target less the others'
  keep-alive (at least an hour). Up next says *Start a deep Websites block*; Plan my day puts its
  work in the Big 3 and lays out a two-hour deep block first.
- **The others stay alive.** Each gets a short keep-alive a day (Imperium 20 minutes, Websites
  20, the AI bot 15; change them in the sheet, 0 leaves one alone). Up next offers *Keep Imperium
  alive: 20 minutes* after the first deep block. Their counter targets wait: on Today they count
  only their keep-alive time, and Plan my day leaves the AI bot's milestone step for its own week.
- **The week's page shows where the time went**: hours per business, and how much of it the focus
  got. Keep My Word is unchanged: it counts total work against the day's work target.

### Keep My Word

Every day you make commitments; the % is how many you kept.

| Commitment | Kept when |
|---|---|
| Each habit due today (a habit can be set to certain weekdays) | It's ticked |
| Each task planned for today, Big 3 or supporting | It's done (a dropped task counts as broken) |
| The work target, if above 0 | Tracked work reaches it |
| The night review | All four questions are answered |

Tasks parked for "later" don't count until they're given a day. The streak counts days at or
above the streak line (default 80%), and secured minimum days. Close Day stores the day's % and
its summary so later changes never rewrite it.

### AI goal suggestions

"Suggest my goals" always works from the rules above. If `ANTHROPIC_API_KEY` (or
`ANTHROPIC_AUTH_TOKEN` with `ANTHROPIC_BASE_URL`, for a gateway) is set on the server, Claude
refines those suggestions from the same numbers and your notes; `AI_GOALS_MODEL` changes the
model (default `claude-opus-5`). Set `AI_ALLOWED_EMAILS` (comma-separated) to limit the AI to
those accounts; everyone else gets the rule suggestions. Any AI error falls back to the rule
suggestions. The key is only read on the server and never sent to the browser.

### First-run setup and the passcode

A new account starts at **Welcome**, one question a screen:

1. **What should we call you?** (Angus unless the account already has a first name.)
2. **Your passcode:** four digits asked for each time the app is opened (1906 to start).
3. **What do you want to achieve?** This year or next, with a suggested goal for Imperium
   revenue, websites sold, the AI trading bot, Bible days, gym sessions, Keep My Word and savings.
   Each is on or off, renamed or re-numbered in place; a year already under way gets its share.
   Every goal is tied to what already measures it: Imperium revenue and websites sold to their
   counters, Bible and gym to their habits, Keep My Word to the days themselves (judged as a
   level against the target, not as a total). Revenue and websites sold count from 1 January, so
   once their counters have entries this year they suggest the full-year number.
4. **Who are you becoming, and why?** (shown on the Goals page.)
5. **What does a good day look like?** Work hours and days, AI bot hours, gym days, cardio
   minutes, the streak line.
6. **What numbers will you hit each week?** Leads, reels, revenue, website calls and demos; Today
   splits them into a target for each work day.

"Skip the rest" is there from step 3 and keeps what's already answered (goals, why, the day's
numbers once that step is passed); the rest keeps its defaults. Everything can be redone from
**Settings → Redo setup**: an area that already has a goal that year is switched off, and no goal
is ever added twice, even if Finish is tapped again after a lost connection.

**The passcode** sits on top of the account sign-in: it keeps out someone holding an unlocked
phone. Its hash, failed tries and signing key are in a table no client can read; the database
checks it and hands back a 12-hour unlock token for this browser only (an httpOnly session
cookie, so closing the app locks it). Every page and action checks the token. Five wrong tries
in a row lock it for a minute, doubling up to 15. Forgot it: tap **Forgot your passcode?**,
sign in again with the account password, and the unlock screen offers "Choose a new passcode"
for the next 10 minutes. A sign-in on its own isn't enough: the reset has to be asked for first.
Change it, lock now, or turn it off in **Settings → Passcode**.

### On the phone

Add it to the home screen (Share → Add to Home Screen): it has an app icon and opens full screen
with no browser bar.

**Reminders are not built.** The app has no background worker or scheduler, and web push needs a
service worker, push keys and a scheduled job. Worth adding once it runs on Vercel.

## Run it locally

Needs Node 22.12+ and Docker.

```bash
npm install
npx supabase start          # local Postgres + Auth in Docker
npx supabase db reset       # applies supabase/migrations
cp .env.example .env.local  # then paste API_URL and ANON_KEY from `npx supabase status`
npm run dev                 # http://localhost:3000
```

Sign up with any email: local Supabase does not send confirmation emails.

## Tests

| Command | What it checks |
|---|---|
| `npm test` | Day boundaries (timezones, 04:00 start, daylight saving), Keep My Word, streaks (with minimum days), counter targets, quick add, the scoreboard, Plan my day, reading plans, goal suggestions, What should I do next, "one more" prompts, personal records and when they fire, momentum, the year view, history sentences, now-and-then cards, the Close Day summary and the replay; goal health, roll-ups, breakdowns (from the progress already made), Keep My Word goals and the goal check; habit rates over due days only; safe paging of long histories; setup's goal matching; the Supabase settings check; focus weeks (deep and keep-alive hours, the week in a line, the suggestion, Up next, Plan my day and the scoreboard on a focus day) — 159 unit tests |
| `npm run db:test` | The database's own rules with pgTAP: seeding, RLS isolation, no future days, locked days, one running timer, no duplicate ticks, one number per counter per day, one current bot milestone, Minimum Day counts and proof topics, the passcode lock (unreadable hash, wrong tries and a block that tops out at 15 minutes, forged tokens, change and turn off, reset only after asking and signing in again), no cross-user references or local dates, goal ownership down the hierarchy, focus days (one business a day, keep-alive limits, other users' rows) — 98 tests |
| `npm run test:e2e` | The V1 definition of done, the execution day (quick add → counter finishes the task → work by business → bot milestone → proof photo → weekly scoreboard → Suggest my goals) the full goal loop (year → months → weeks → Plan my day → done → progress → weekly review), a whole day with the browser clock set to morning then evening (morning routine → Big 3 → What should I do next → Start → counters and "one more" → a personal record → cardio → night review → Close day → Day complete and replay → Progress), a Minimum Day that keeps the streak, first-run setup (name, 1906 passcode, goals, why, day, week; skipping, redoing and retrying without doubling goals), the lock (wrong passcode, right passcode, lock now, change, turn off, a forgotten passcode), streaks that end when a day closes under the line, counter goals carried into next week, timers across Close day and other devices, and taps that must hold on a phone (a tick tapped before the page is ready, the journal left without a blur, Back after a change elsewhere, a quick Save, a sheet inside a sheet, the timer bar following a timer), and a focus week (picked from Today, followed by Up next and the day's list, split from the week's page). Runs on a phone-sized screen against a production build and local Supabase; run `npm run build` first. Test 9 checks every page, every Today sheet and the + sheet at 390×844 for sideways scrolling, tap targets under 44px and cut-off names — 38 tests |
| `npm run typecheck` · `npm run lint` | Types and lint |

## Deploy

1. **Supabase:** create a project. Then from this folder:
   `npx supabase link --project-ref <ref>` and `npx supabase db push`.
2. **Auth settings** (Supabase → Authentication → URL configuration): set **Site URL** to the
   app's address and add `https://<your-app>/auth/confirm` to the redirect URLs. Keep email
   confirmation on or off as you prefer; both flows are handled. Once your own account exists,
   turn off **Authentication → Sign In / Providers → Allow new users to sign up**: this is a
   one-person app, and the passcode belongs to an account, so it can't stop a stranger making
   their own. Also turn on **Secure password change**.
3. **Vercel:** import the repo, set **Root Directory** to `discipline-os`, and add
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase → Project settings →
   API; the anon or publishable key). Optional: the AI settings above. Proof photos use a private
   Supabase Storage bucket, `proof`, which the migrations create.

## Keeping it up to date

- **Every change is checked.** `.github/workflows/discipline-os.yml` runs on each pull request,
  and each push to `main`, that touches `discipline-os/`: lint, types and unit tests, then the database tests,
  a check that `database.types.ts` matches the migrations, a production build and the full
  browser suite against a local Supabase. A red run means don't merge.
- **Updates come to you.** Dependabot (`.github/dependabot.yml`) opens a pull request against
  `main` each Monday with minor and patch updates grouped; the checks run on it; merge it when
  they're green. Major versions are left out: do those by hand when the tools around them
  (Next.js's lint config, Vercel's Node version) support them.
- **App changes go live on their own.** With Vercel connected to the repo, every push to `main`
  deploys. A phone that kept the old version open (a home-screen app comes back as it was left)
  reloads itself the first time a button reaches the new server, so buttons never go quiet after
  a release. On Vercel's Pro plan, **Settings → Deployment Protection → Skew Protection** makes
  that seamless: an open page keeps talking to the version it loaded. Coming back to the app
  after five minutes away fetches the screen again, so a new day or a change made on another
  device shows without a reload, and a tap made while a page is still loading is kept and
  played once it's ready.
- **Database changes go live on their own, once connected.** Add a new file to
  `supabase/migrations/` (never edit one that's already live). Its name must sort after the
  newest file already there: until 29 September 2026 `npx supabase migration new` makes an
  earlier name, so rename it (for example `20260929000200_<name>.sql`). Make each change safe for
  the code that's live now (add columns; don't rename or drop them in the same release), because
  the app can deploy a few minutes before its migration runs. After the checks pass on `main`,
  `.github/workflows/discipline-os-migrate.yml` runs `supabase db push` against the live project.
  It does nothing until three repository secrets are set: `SUPABASE_ACCESS_TOKEN` (Supabase →
  Account → Access tokens), `SUPABASE_PROJECT_REF` (the project's reference id) and
  `SUPABASE_DB_PASSWORD`. Without them, run `npx supabase db push` from this folder yourself.
- **Before merging by hand:** `npm run lint && npm run typecheck && npm test && npm run db:test`,
  then `npm run build && npm run test:e2e` with local Supabase running.

## How the hard parts are solved

**What counts as a day.** Each profile has an IANA `timezone` (taken from the browser at sign-up,
default `Australia/Sydney`) and a `day_start_hour` (default 4). A tick at 01:30 belongs to the day
before. Timestamps are `timestamptz`; the day is a `local_date` column worked out on the server
from the wall clock in the user's timezone (`src/lib/day.ts`, mirrored by
`public.local_date_at()` in SQL), so daylight saving can't move the boundary. The browser clock is
only used to draw a running timer.

**The timer.** Starting writes a `work_sessions` row with `ended_at` null. On load the app finds
the open row and shows elapsed time from `started_at`, recomputed every second, never counted up
in memory, so refreshes, closed tabs and other devices can't lose time. A partial unique index
allows one open session per user; starting another asks first. After 8 hours a running session is
flagged with a prompt to set the real end time.

**Editing the past.** Any earlier day since the account started opens from the arrows, the 30-day
strip or the calendar. Ticks made after their day has passed carry `edited_at`, shown as "edited".
The database refuses any write dated after the user's today (`guard_day` trigger), and refuses
changes to a completed day until it is reopened.

**Streaks.** A streak is consecutive days at or above `streak_threshold` (default 80). Days are
scored from stored rows (`public.day_summaries()` counts; `src/lib/keep-word.ts` turns the counts
into Keep My Word), never from a counter. Today only joins the streak once it reaches the line; a day closed below it counts as missed straight away. `best_streak` is stored but derived:
recomputed after completing, reopening or editing an earlier day, or changing settings. No grace
days. A missed day ends the streak and deletes nothing.

**Optimistic UI.** Ticks update on screen immediately, save in the background and roll back with
a readable message if the save fails. Actions take the state you want, not "toggle", and a unique
index on `(habit_id, local_date)` means a double tap can never create two rows.

## Decisions

- **One task list.** The old "three priorities" and goal "daily actions" were two lists for the
  same thing; they're now one `daily_goals` table. Big 3 is rank 1–3. Old priorities were moved
  across by the migration.
- **One tick per faith habit.** Bible, Journal and Pray are habits that show in both the morning
  routine and the Faith card, so ticking one ticks both. The four Bible check boxes and SOAP are
  gone; the journal is one text box.
- **The night review is four questions**, down from six.
- **Keep My Word replaced the weighted score**, so the number means one thing: promises kept.
- **Counters are numbers per day**, one row per counter per day. Week, month and year are sums
  (or the latest value, for "demos ready to call"). A new account's first week target is cut to
  the days left.
- **A task tied to a counter** finishes itself when the counter reaches its number, and ticking
  the task brings the counter up to it.
- **First-time Bible reading is John 1**, or the start of the chosen plan (whole Bible, New
  Testament, Gospels, Psalms and Proverbs). Tap Change to pick any chapter.

## Schema additions beyond the brief

`profiles.best_streak` (derived) · `daily_plans.score_breakdown` · `work_sessions.local_date`
(set by trigger from `started_at`) · `bible_entries.local_date` plus `soap_done`, `prayer_done`,
`application_done` for the one-tap checks · `bible_readings.plan_id` (for V2 plans) · `updated_at`
and its trigger on every table · composite `(id, user_id)` foreign keys so rows can only point at
their owner's parents. Habits have no delete permission at all: archiving is the only way out.

Goals add `life_areas`, `yearly_goals`, `quarterly_goals`, `monthly_goals`, `weekly_goals`,
`daily_goals`, `goal_milestones`, `goal_dependencies`, `goal_reviews` and `goal_suggestions`, each
level pointing at its parent with an owner-checked foreign key. `daily_priorities.daily_goal_id`
links a priority to the action it came from, so finishing one finishes the other. `weekly_reviews`
gains `wins`, `lessons` and `completed_at`.

The execution dashboard adds `metrics` and `metric_entries` (counters), `project_milestones` (the
AI bot's current milestone and its steps), a `key` on `life_areas`, `area`, `category`,
`priority`, `due_date`, `notes` and `metric_id` on `daily_goals` (whose `local_date` can now be
empty, for "later"), `kind` and `days` on `habits`, `area` on work sessions and blocks,
`work_days`, `area_hour_targets` and `bible_plan` on `profiles`, `task_id` on `proof_uploads` with
a private `proof` storage bucket, `journal` on `bible_entries`, `failure` and `bottleneck` on
`weekly_reviews`, and `metric_id` on the goal tables. `daily_priorities` was merged into
`daily_goals` and dropped.

Focus weeks add `focus_days` (one business a day: `imperium`, `websites` or `trading`) and
`profiles.keep_alive_minutes` (minutes a day per business, 0 to 240).

The daily loop adds `habits.minimum`, `profiles.minimum_work_minutes` and `minimum_fitness`,
`daily_plans.minimum_at`, and `proof_uploads.topic`. `day_summaries()` also returns
`minimum_on`, `minimum_total` and `minimum_done`. Close Day stores its summary (numbers,
achievements, records) in `daily_plans.score_breakdown`. Everything else (streaks, records,
momentum, the year, the replay) is worked out from rows that already existed.

The passcode and first-run setup add `app_locks` (no client access at all; only the passcode
functions read it), `profiles.onboarded_at` and `profiles.passcode_set` (guarded by a trigger so
it can't be switched off from outside those functions), and the functions `set_passcode`,
`unlock_app`, `lock_state`, `reset_passcode` and `remove_passcode`.
