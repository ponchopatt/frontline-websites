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

## What it is now: a personal execution dashboard

Big goals say where I'm going. Weekly goals say what matters now. Daily tasks say what to do. The
scoreboard says whether I actually did it.

Bottom nav (phone): **Today**, **Business**, **Week**, **Goals**, **Bible**. On a phone, Settings
opens from Today's header, Habits from the habit cards and Settings, and the Work log from the Work
card; on a wide screen all three are in the nav. A **+** button on every
page adds a task; a running work block shows as a bar with Stop on every page.

**Today** reads top to bottom in order of importance:

1. **Header:** greeting, date, and **Keep My Word %** (the day's number) with "13 of 17 kept",
   the week's average and the streak.
2. **Today's Big 3**, then up to a few supporting tasks. **+ Add task** takes plain words: "Call 10
   Imperium leads" files itself under Imperium and ties itself to the Leads called counter.
   **Plan my day** suggests a Big 3, a short supporting list (never 25 tasks) and work blocks for
   the day's hours; untick anything, then "Use this plan". Unfinished tasks from yesterday are
   offered back with one tap.
3. **Scoreboard:** Faith, Fitness, Imperium, Websites, AI Bot, Discipline as x/y, plus Work
   hours against the 8h target. Each one jumps to its card.
4. **Work:** pick Imperium, Websites, AI Trading or Other, then Start / Stop. Today's time per
   business, planned blocks with a Start button each.
5. **Morning** (8 one-tap items, "Morning complete ✓" when done), **Faith** (today's reading from a
   simple plan, Read / Journal / Pray, a journal box, evening prayer and reflection) and
   **Fitness** (gym Mon–Sun strip against 5 a week, cardio done + minutes and x/7, optional
   protein / water / sleep).
6. **Imperium** and **Websites** counters: type a number or tap − / +. Each shows today's target,
   worked out from the week's target and the work days left. The week, month and year totals
   are on the Business page. No CRM.
7. **AI Bot:** the one current milestone, its steps (Implement, Test, Backtest, Compare, Fix,
   Document, Complete milestone) as a %, hours today, and one notes box. No trade journal.
8. **Discipline**, **Goals** (each task's chain Today → Week → Month → Year, tap to open),
   **Proof** (optional photos on any task, a small gallery for the day) and the **Night review**:
   what I accomplished, where I wasted time, where I broke my word, tomorrow's #1, then
   **Complete day**.

**Business:** Imperium (sales, marketing, revenue), Websites and the AI bot, with day, week, month
and year totals for every counter, and where to set weekly targets.

**Week:** the weekly scoreboard (Faith, Fitness, Imperium, Websites, AI Bot numbers for the week),
this week's goals, and the review: biggest win, biggest failure, main bottleneck, next week's #1.

**Goals** keeps the year → quarter → month → week → today planning from before, and adds
**Suggest my goals**: concrete weekly goals ("Call 60 qualified leads this week", never "work
harder") built from your last weeks of numbers, your targets, the hours you have and what you
say you want, each with a one-line reason. Nothing is added until you approve it. Goals can be
measured straight from a counter, so the week's leads goal fills as you log leads.

### Keep My Word

Every day you make commitments; the % is how many you kept.

| Commitment | Kept when |
|---|---|
| Each habit due today (a habit can be set to certain weekdays) | It's ticked |
| Each task planned for today, Big 3 or supporting | It's done (a dropped task counts as broken) |
| The work target, if above 0 | Tracked work reaches it |
| The night review | All four questions are answered |

Tasks parked for "later" don't count until they're given a day. The streak counts days at or
above the streak line (default 80%). Complete Day stores the day's % so later changes never
rewrite it.

### AI goal suggestions

"Suggest my goals" always works from the rules above. If `ANTHROPIC_API_KEY` (or
`ANTHROPIC_AUTH_TOKEN` with `ANTHROPIC_BASE_URL`, for a gateway) is set on the server, Claude
refines those suggestions from the same numbers and your notes; `AI_GOALS_MODEL` changes the
model (default `claude-opus-5`). Any AI error falls back to the rule suggestions. The key is
only read on the server and never sent to the browser.

### On the phone

Add it to the home screen (Share → Add to Home Screen): it has an app icon and opens full screen
with no browser bar.

**Reminders are not built.** The app has no background worker or scheduler, and web push needs a
service worker, push keys and a scheduled job. Worth adding once it runs on Vercel.

## Run it locally

Needs Node 20+ and Docker.

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
| `npm test` | Day boundaries (timezones, 04:00 start, daylight saving), Keep My Word, streaks, counter targets, quick add, the scoreboard, Plan my day, reading plans, goal suggestions; goal health, roll-ups, breakdowns and the goal check — 65 unit tests |
| `npm run db:test` | The database's own rules with pgTAP: seeding, RLS isolation, no future days, locked days, one running timer, no duplicate ticks, one number per counter per day, one current bot milestone, no cross-user references, goal ownership down the hierarchy — 55 tests |
| `npm run test:e2e` | The V1 definition of done, the execution day (quick add → counter finishes the task → work by business → bot milestone → proof photo → weekly scoreboard → Suggest my goals) and the full goal loop (year → months → weeks → Plan my day → done → progress → weekly review). Runs on a phone-sized screen against a production build and local Supabase; run `npm run build` first — 12 tests |
| `npm run typecheck` · `npm run lint` | Types and lint |

## Deploy

1. **Supabase:** create a project. Then from this folder:
   `npx supabase link --project-ref <ref>` and `npx supabase db push`.
2. **Auth settings** (Supabase → Authentication → URL configuration): set **Site URL** to the
   app's address and add `https://<your-app>/auth/confirm` to the redirect URLs. Keep email
   confirmation on or off as you prefer; both flows are handled.
3. **Vercel:** import the repo, set **Root Directory** to `discipline-os`, and add
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase → Project settings →
   API; the anon or publishable key). Optional: the AI settings above. Proof photos use a private
   Supabase Storage bucket, `proof`, which the migrations create.

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
into Keep My Word), never from a counter. Today only joins the streak once it reaches the line. `best_streak` is stored but derived:
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
