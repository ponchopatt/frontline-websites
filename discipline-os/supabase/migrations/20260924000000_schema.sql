-- Discipline OS — schema
--
-- Conventions
--   * Every timestamp is timestamptz (UTC on disk). "Which day does this belong to" is a
--     `local_date` column, computed from the user's timezone and day_start_hour
--     (see user_local_date / user_local_today below). Nothing here trusts the client clock.
--   * Every table carries user_id and is locked down by RLS: auth.uid() = user_id.
--   * Child rows point at their parent with a composite (id, user_id) foreign key, so a
--     user cannot attach a row to another user's habit, block or reading even by guessing ids.
--   * Tables marked [V2] exist so the schema is right from day one; V1 has no UI for them.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.habit_category as enum ('morning', 'body', 'discipline', 'god');
create type public.priority_status as enum ('pending', 'done', 'dropped');
create type public.commitment_outcome as enum ('kept', 'broken', 'cancelled', 'pending');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- The local calendar day an instant belongs to, for a timezone and a day that starts at
-- `start_hour` local time. 01:30 with a 04:00 start belongs to the previous day.
-- Works on local wall-clock time, so daylight-saving changes cannot shift the boundary.
create or replace function public.local_date_at(ts timestamptz, tz text, start_hour integer)
returns date
language sql
stable
as $$
  select ((ts at time zone tz) - make_interval(hours => start_hour))::date;
$$;

create or replace function public.is_valid_timezone(tz text)
returns boolean
language sql
stable
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  display_name      text check (display_name is null or char_length(display_name) <= 60),
  timezone          text not null default 'Australia/Sydney',
  day_start_hour    smallint not null default 4 check (day_start_hour between 0 and 23),
  work_target_hours numeric(4, 2) not null default 6 check (work_target_hours between 0 and 16),
  streak_threshold  smallint not null default 70 check (streak_threshold between 1 and 100),
  -- Derived: recomputed from stored days whenever a day is completed, reopened or edited.
  best_streak       integer not null default 0 check (best_streak >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create or replace function public.profiles_validate()
returns trigger
language plpgsql
as $$
begin
  if not public.is_valid_timezone(new.timezone) then
    raise exception 'Unknown timezone: %', new.timezone using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profiles_validate before insert or update of timezone on public.profiles
  for each row execute function public.profiles_validate();

-- The user's local date for an instant / for right now.
create or replace function public.user_local_date(p_user uuid, ts timestamptz)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select public.local_date_at(ts, p.timezone, p.day_start_hour)
  from public.profiles p
  where p.user_id = p_user;
$$;

create or replace function public.user_local_today(p_user uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select public.user_local_date(p_user, now());
$$;

-- ---------------------------------------------------------------------------
-- habits
-- ---------------------------------------------------------------------------
create table public.habits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  category    public.habit_category not null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  archived_at timestamptz,
  updated_at  timestamptz not null default now(),
  unique (id, user_id),
  -- archived <=> inactive, so the two can never disagree
  check ((is_active and archived_at is null) or (not is_active and archived_at is not null))
);
create index habits_user_category_idx on public.habits (user_id, category, sort_order);

-- ---------------------------------------------------------------------------
-- habit_completions
-- ---------------------------------------------------------------------------
create table public.habit_completions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id     uuid not null,
  local_date   date not null,
  completed_at timestamptz not null default now(),
  -- Set when the row was written or changed after its own day had passed (backfill/edit).
  edited_at    timestamptz,
  updated_at   timestamptz not null default now(),
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade
);
-- One completion per habit per day: double taps and retries cannot create duplicates.
create unique index habit_completions_habit_day_uidx on public.habit_completions (habit_id, local_date);
create index habit_completions_user_day_idx on public.habit_completions (user_id, local_date);

-- ---------------------------------------------------------------------------
-- daily_plans — one row per day; holds the stored score once the day is completed
-- ---------------------------------------------------------------------------
create table public.daily_plans (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  local_date      date not null,
  final_score     smallint check (final_score between 0 and 100),
  -- Category breakdown at completion, so history never shifts when habits change later.
  score_breakdown jsonb,
  completed_at    timestamptz,
  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  check ((completed_at is null) = (final_score is null))
);
create unique index daily_plans_user_day_uidx on public.daily_plans (user_id, local_date);

-- ---------------------------------------------------------------------------
-- daily_priorities — exactly three slots per day
-- ---------------------------------------------------------------------------
create table public.daily_priorities (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  local_date   date not null,
  title        text not null check (char_length(btrim(title)) between 1 and 120),
  description  text check (description is null or char_length(description) <= 500),
  status       public.priority_status not null default 'pending',
  position     smallint not null check (position between 1 and 3),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index daily_priorities_user_day_pos_uidx on public.daily_priorities (user_id, local_date, position);

-- ---------------------------------------------------------------------------
-- work_blocks — planned blocks of work for a day (local wall-clock times)
-- ---------------------------------------------------------------------------
create table public.work_blocks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  local_date    date not null,
  task          text not null check (char_length(btrim(task)) between 1 and 120),
  planned_start time,
  planned_end   time,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, user_id),
  check (planned_start is null or planned_end is null or planned_end > planned_start)
);
create index work_blocks_user_day_idx on public.work_blocks (user_id, local_date);

-- ---------------------------------------------------------------------------
-- work_sessions — a running timer is a row with ended_at null
-- ---------------------------------------------------------------------------
create table public.work_sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  work_block_id       uuid,
  -- The day the session counts towards: the local date it started on.
  local_date          date not null,
  started_at          timestamptz not null default now(),
  ended_at            timestamptz,
  accomplishment_note text check (accomplishment_note is null or char_length(accomplishment_note) <= 1000),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  foreign key (work_block_id, user_id) references public.work_blocks (id, user_id) on delete set null (work_block_id),
  check (ended_at is null or ended_at >= started_at)
);
-- Only one running session per user.
create unique index work_sessions_one_open_uidx on public.work_sessions (user_id) where ended_at is null;
create index work_sessions_user_day_idx on public.work_sessions (user_id, local_date);

-- local_date always follows started_at, whatever the client sends.
create or replace function public.work_sessions_set_local_date()
returns trigger
language plpgsql
as $$
begin
  new.local_date := public.user_local_date(new.user_id, new.started_at);
  if new.local_date is null then
    raise exception 'No profile for user' using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Bible
-- ---------------------------------------------------------------------------
-- [V2] reading plans. Readings can point at a plan later.
create table public.bible_plans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.bible_readings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id      uuid,
  local_date   date not null,
  book         text not null check (char_length(book) between 1 and 40),
  chapter      smallint not null check (chapter between 1 and 150),
  passage      text check (passage is null or char_length(passage) <= 80),
  is_completed boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, user_id),
  foreign key (plan_id, user_id) references public.bible_plans (id, user_id) on delete set null (plan_id)
);
create unique index bible_readings_user_day_uidx on public.bible_readings (user_id, local_date);

create table public.bible_entries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reading_id       uuid not null,
  local_date       date not null,
  scripture_notes  text check (scripture_notes is null or char_length(scripture_notes) <= 4000),
  observation      text check (observation is null or char_length(observation) <= 4000),
  application      text check (application is null or char_length(application) <= 4000),
  prayer           text check (prayer is null or char_length(prayer) <= 4000),
  obey_today       text check (obey_today is null or char_length(obey_today) <= 500),
  -- The one-tap checks on the dashboard: Reading lives on bible_readings.is_completed.
  soap_done        boolean not null default false,
  prayer_done      boolean not null default false,
  application_done boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (reading_id, user_id) references public.bible_readings (id, user_id) on delete cascade
);
create unique index bible_entries_reading_uidx on public.bible_entries (reading_id);
create index bible_entries_user_day_idx on public.bible_entries (user_id, local_date);

-- ---------------------------------------------------------------------------
-- commitments
-- ---------------------------------------------------------------------------
create table public.commitments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  local_date date not null,
  text       text not null check (char_length(btrim(text)) between 1 and 200),
  outcome    public.commitment_outcome not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index commitments_user_day_idx on public.commitments (user_id, local_date);

-- ---------------------------------------------------------------------------
-- [V2] proof_uploads
-- ---------------------------------------------------------------------------
create table public.proof_uploads (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  local_date   date not null,
  storage_path text not null,
  category     public.habit_category,
  habit_id     uuid,
  note         text check (note is null or char_length(note) <= 500),
  uploaded_at  timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete set null (habit_id)
);
create index proof_uploads_user_day_idx on public.proof_uploads (user_id, local_date);

-- ---------------------------------------------------------------------------
-- daily_reviews — the night review
-- ---------------------------------------------------------------------------
create table public.daily_reviews (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  local_date        date not null,
  accomplished      text check (accomplished is null or char_length(accomplished) <= 2000),
  wasted_time_on    text check (wasted_time_on is null or char_length(wasted_time_on) <= 2000),
  broke_word_where  text check (broke_word_where is null or char_length(broke_word_where) <= 2000),
  sought_god        text check (sought_god is null or char_length(sought_god) <= 2000),
  grateful_for      text check (grateful_for is null or char_length(grateful_for) <= 2000),
  tomorrow_priority text check (tomorrow_priority is null or char_length(tomorrow_priority) <= 120),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index daily_reviews_user_day_uidx on public.daily_reviews (user_id, local_date);

-- ---------------------------------------------------------------------------
-- [V2] weekly_reviews, goals
-- ---------------------------------------------------------------------------
create table public.weekly_reviews (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start_date     date not null,
  focus_for_next_week text check (focus_for_next_week is null or char_length(focus_for_next_week) <= 2000),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index weekly_reviews_user_week_uidx on public.weekly_reviews (user_id, week_start_date);

create table public.goals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text not null check (char_length(kind) between 1 and 40),
  content    text check (content is null or char_length(content) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index goals_user_idx on public.goals (user_id, kind);

-- ---------------------------------------------------------------------------
-- Day guard: no future days, and a completed day is read-only until reopened
-- ---------------------------------------------------------------------------
create or replace function public.guard_day()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_today date;
begin
  if tg_op = 'DELETE' then
    r := old;
  else
    r := new;
  end if;

  if tg_op <> 'DELETE' then
    v_today := public.user_local_today(r.user_id);
    if v_today is not null and r.local_date > v_today then
      raise exception 'You can''t log a day that hasn''t started yet.'
        using errcode = 'check_violation', hint = 'future_day';
    end if;
  end if;

  if exists (
    select 1 from public.daily_plans p
    where p.user_id = r.user_id and p.local_date = r.local_date and p.completed_at is not null
  ) then
    raise exception 'This day is completed. Reopen it to make changes.'
      using errcode = 'check_violation', hint = 'day_locked';
  end if;

  -- An update may also move a row to another day; check where it came from too.
  if tg_op = 'UPDATE' and old.local_date is distinct from new.local_date and exists (
    select 1 from public.daily_plans p
    where p.user_id = old.user_id and p.local_date = old.local_date and p.completed_at is not null
  ) then
    raise exception 'This day is completed. Reopen it to make changes.'
      using errcode = 'check_violation', hint = 'day_locked';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- daily_plans itself: never in the future; completing/reopening is what changes it.
create or replace function public.guard_plan_day()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date;
begin
  v_today := public.user_local_today(new.user_id);
  if v_today is not null and new.local_date > v_today then
    raise exception 'You can''t complete a day that hasn''t started yet.'
      using errcode = 'check_violation', hint = 'future_day';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'habits', 'habit_completions', 'daily_plans', 'daily_priorities', 'work_blocks',
    'work_sessions', 'bible_plans', 'bible_readings', 'bible_entries', 'commitments',
    'proof_uploads', 'daily_reviews', 'weekly_reviews', 'goals'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t
    );
  end loop;

  foreach t in array array[
    'habit_completions', 'daily_priorities', 'work_blocks', 'bible_readings', 'bible_entries',
    'commitments', 'daily_reviews', 'proof_uploads'
  ] loop
    execute format(
      'create trigger %I before insert or update or delete on public.%I for each row execute function public.guard_day()',
      t || '_guard_day', t
    );
  end loop;
end;
$$;

-- work_sessions: set local_date first (trigger names fire alphabetically), then guard it.
create trigger work_sessions_a_set_local_date before insert or update of started_at on public.work_sessions
  for each row execute function public.work_sessions_set_local_date();
create trigger work_sessions_b_guard_day before insert or update or delete on public.work_sessions
  for each row execute function public.guard_day();

create trigger daily_plans_guard_day before insert or update on public.daily_plans
  for each row execute function public.guard_plan_day();

-- ---------------------------------------------------------------------------
-- Row Level Security — auth.uid() = user_id on every table, no exceptions
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.habits            enable row level security;
alter table public.habit_completions enable row level security;
alter table public.daily_plans       enable row level security;
alter table public.daily_priorities  enable row level security;
alter table public.work_blocks       enable row level security;
alter table public.work_sessions     enable row level security;
alter table public.bible_plans       enable row level security;
alter table public.bible_readings    enable row level security;
alter table public.bible_entries     enable row level security;
alter table public.commitments       enable row level security;
alter table public.proof_uploads     enable row level security;
alter table public.daily_reviews     enable row level security;
alter table public.weekly_reviews    enable row level security;
alter table public.goals             enable row level security;

-- profiles: created by the sign-up trigger; the user can read and update their own.
create policy "own profile: select" on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own profile: update" on public.profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- habits: no delete policy on purpose. Archiving keeps history; deleting is not offered.
create policy "own habits: select" on public.habits
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own habits: insert" on public.habits
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own habits: update" on public.habits
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Everything else: full CRUD on your own rows only.
do $$
declare
  t text;
begin
  foreach t in array array[
    'habit_completions', 'daily_plans', 'daily_priorities', 'work_blocks', 'work_sessions',
    'bible_plans', 'bible_readings', 'bible_entries', 'commitments', 'proof_uploads',
    'daily_reviews', 'weekly_reviews', 'goals'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      'own rows: select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      'own rows: insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      'own rows: update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      'own rows: delete', t);
  end loop;
end;
$$;

-- Explicit grants: signed-in users only. The anon role gets nothing.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke delete on public.habits from authenticated;
revoke insert, delete on public.profiles from authenticated;

revoke execute on function public.user_local_date(uuid, timestamptz) from public, anon;
revoke execute on function public.user_local_today(uuid) from public, anon;
