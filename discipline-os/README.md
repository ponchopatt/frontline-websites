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

## V1 (built)

Auth · Dashboard · Morning routine · Bible block (today's reading + SOAP) · Three priorities ·
Work blocks + live timer · Body and Discipline · Daily score · Night review + Complete Day ·
Streaks and 30-day history. Pages: **Today**, **Habits**, **Bible**, **Work**, **Settings**.

## Goals (built)

A fifth tab, **Goals**, turns a year into today's work: My Life → Year → Quarter → Month → Week →
Today. Plan → Execute → Review → Adjust.

- **My Life:** who I'm becoming, my why, and 11 areas of life (add, rename or hide your own).
- **Yearly goals** with a type (Outcome, Performance, Process, Habit, Milestone, Yes/no), a
  measure, start and target, deadline, priority, and why it matters.
- **Goal check** while you type: specific, measurable, dated, realistic, within your control, has a
  reason. It flags, never blocks. An outcome goal is offered the process goal that drives it
  ("$300k revenue" → "10 focused business-development hours a week").
- **Break down goal:** a year into months (revenue ramps up; a lift climbs in plate-sized steps; a
  weekly habit becomes each month's total; a yes/no goal gets a preparing month and a finishing
  month), then a month into weeks with the activities that drive it. Every suggestion is editable
  and nothing is saved until you approve it. A month or week already under way gets only its share
  of the days left.
- **Week:** "What am I trying to accomplish this week?", major outcomes and supporting tasks, a
  gentle note past 3 majors, what got done, and how much tracked work was on goal-linked blocks.
- **Today:** "What should I do today?" ranks this week's goals by priority, what the year needs,
  what's behind, what's due, what unblocks something, what was missed, and the time left. One tap
  makes them today's Big 3; each priority shows what it supports (Week › Month › Year).
- **Progress** comes from real activity where it can: the work timer for hours, habit ticks for
  habits, finished daily actions for counts, and what you log for money or a lift. It rolls up the
  hierarchy.
- **Health:** On track, At risk, Behind, Not started, Complete — a plain pace check (share done
  against share of time gone, counted from the day the goal was set), always with the numbers.
- **Weekly review:** for each goal, done / partly / not; why (seven reasons); and what next: carry
  forward (what's left moves to next week), modify, replace or cancel. Nothing is deleted.

Not built yet: AI goal suggestions and AI breakdowns, quarterly and year-end reviews.

**V2 — schema only, no UI:** `bible_plans`, `proof_uploads`. Analytics, charts, proof uploads, the
reading-plan builder, notifications and PWA are not built. `commitments` also exists in the schema
with no screen (the "Kept commitments" habit covers it for now).

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
| `npm test` | Day boundaries (timezones, 04:00 start, daylight saving), score weights and redistribution, streak rules; goal health, roll-ups, breakdowns, the goal check and today's ranking — 53 unit tests |
| `npm run db:test` | The database's own rules with pgTAP: seeding, RLS isolation, no future days, locked days, one running timer, no duplicate ticks, no cross-user references, goal ownership down the hierarchy — 39 tests |
| `npm run test:e2e` | The V1 definition of done (one Playwright test per item) and the full goal loop: yearly goal → months → weeks → today's Big 3 → done → progress → weekly review → carried to next week. Runs against a production build and local Supabase; run `npm run build` first |
| `npm run typecheck` · `npm run lint` | Types and lint |

## Deploy

1. **Supabase:** create a project. Then from this folder:
   `npx supabase link --project-ref <ref>` and `npx supabase db push`.
2. **Auth settings** (Supabase → Authentication → URL configuration): set **Site URL** to the
   app's address and add `https://<your-app>/auth/confirm` to the redirect URLs. Keep email
   confirmation on or off as you prefer; both flows are handled.
3. **Vercel:** import the repo, set **Root Directory** to `discipline-os`, and add
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase → Project settings →
   API; the anon or publishable key). No other secrets are needed.

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

**Streaks.** A streak is consecutive days at or above `streak_threshold` (default 70). Days are
scored from stored rows (`public.day_summaries()` counts; `src/lib/score.ts` weighs), never from a
counter. Today only joins the streak once it reaches the line. `best_streak` is stored but derived:
recomputed after completing, reopening or editing an earlier day, or changing settings. No grace
days. A missed day ends the streak and deletes nothing.

**Optimistic UI.** Ticks update on screen immediately, save in the background and roll back with
a readable message if the save fails. Actions take the state you want, not "toggle", and a unique
index on `(habit_id, local_date)` means a double tap can never create two rows.

## The score

| Part | Weight | Counts |
|---|---|---|
| God | 25% | The four Bible checks (Reading, SOAP, Prayer, Application) + any God habits |
| Work | 30% | Minutes worked ÷ the work target, capped at 1 |
| Body | 20% | Body habits |
| Discipline | 20% | Morning routine + discipline habits |
| Reflection | 5% | Night-review questions answered, out of six |

A part with nothing active that day (no body habits, a 0h work target) is left out and its weight
is shared proportionally across the rest. Complete Day stores the score and its breakdown on
`daily_plans`, so later habit changes never rewrite a completed day. A habit counts on the days it
existed: from the day it was created until the day it was archived.

Decisions the brief left open:

- **Morning routine counts towards Discipline.** The weights have no morning slot, and starting
  the day right is discipline.
- **Priorities are not scored.** The brief scores Work by hours; priorities are the plan, and the
  header shows how many are done.
- **Reflection is partial credit:** each answered question is one sixth of 5%.
- **First-time Bible reading is John 1**, then each day suggests the chapter after the last one
  read. Tap Change to pick any book and chapter.

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
