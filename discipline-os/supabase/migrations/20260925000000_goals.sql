-- Discipline OS — goal planning: Identity → Year → (Quarter) → Month → Week → Day → Execution
--
-- Each level is its own table and points at the level above with a composite (id, user_id)
-- foreign key, so a goal can only hang under its owner's goals. Progress, health and the
-- breakdown suggestions are computed in src/lib/goals from these rows plus real execution data
-- (work sessions, habit completions, completed daily actions); nothing here stores a derived
-- percentage that could drift.
--
-- Existing tables are only extended, never reshaped:
--   goals            ([V2] table)  holds the My Life statements: kind 'becoming' and 'why'
--   weekly_reviews   ([V2] table)  gains the weekly reflection fields
--   daily_priorities (V1)          can point at the daily goal it came from

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.goal_type as enum ('outcome', 'performance', 'process', 'habit', 'milestone', 'binary');
create type public.goal_state as enum ('draft', 'active', 'completed', 'missed', 'cancelled');
-- How the target is expressed: a total for the period, or a rate.
create type public.goal_cadence as enum ('total', 'per_week', 'per_month');
-- How values combine up the hierarchy: revenue adds up; a bench press is the latest level.
create type public.goal_aggregation as enum ('sum', 'latest');
-- Where the current value comes from.
create type public.progress_source as enum ('manual', 'children', 'work_hours', 'habit', 'actions', 'milestones');
create type public.daily_goal_status as enum ('pending', 'done', 'dropped');
create type public.miss_reason as enum (
  'underestimated_time', 'too_ambitious', 'procrastination', 'unexpected_event',
  'no_longer_matters', 'poor_planning', 'other'
);
create type public.miss_decision as enum ('carry_forward', 'modify', 'replace', 'cancel');
create type public.review_outcome as enum ('completed', 'partial', 'missed');

-- ---------------------------------------------------------------------------
-- My Life: statements live in the existing goals table, one row per kind
-- ---------------------------------------------------------------------------
create unique index goals_user_kind_uidx on public.goals (user_id, kind);

-- ---------------------------------------------------------------------------
-- life_areas
-- ---------------------------------------------------------------------------
create table public.life_areas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 40),
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index life_areas_user_name_uidx on public.life_areas (user_id, lower(name));

create or replace function public.seed_life_areas(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.life_areas where user_id = p_user) then
    return;
  end if;
  insert into public.life_areas (user_id, name, sort_order)
  select p_user, a.name, a.ord
  from (values
    ('Faith', 1), ('Business', 2), ('Money', 3), ('Career', 4), ('Health', 5), ('Fitness', 6),
    ('Relationships', 7), ('Family', 8), ('Learning', 9), ('Personal discipline', 10), ('Other', 11)
  ) as a (name, ord);
end;
$$;

-- New accounts get areas with their habits; existing accounts get them now.
create or replace function public.create_profile_for(p_user uuid, p_meta jsonb, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz   text := nullif(btrim(coalesce(p_meta ->> 'timezone', '')), '');
  v_name text := nullif(btrim(coalesce(p_meta ->> 'display_name', '')), '');
begin
  if v_tz is null or not public.is_valid_timezone(v_tz) then
    v_tz := 'Australia/Sydney';
  end if;
  if v_name is null and p_email is not null then
    v_name := split_part(p_email, '@', 1);
  end if;
  insert into public.profiles (user_id, display_name, timezone)
  values (p_user, left(v_name, 60), v_tz)
  on conflict (user_id) do nothing;
  perform public.seed_default_habits(p_user);
  perform public.seed_life_areas(p_user);
end;
$$;

select public.seed_life_areas(user_id) from public.profiles;

-- Called by the goal pages; safe on every visit.
create or replace function public.ensure_life_areas()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  perform public.seed_life_areas(auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- Goal tables. Every level shares the same core columns.
-- ---------------------------------------------------------------------------
create table public.yearly_goals (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  year             smallint not null check (year between 2000 and 2100),
  life_area_id     uuid,
  title            text not null check (char_length(btrim(title)) between 1 and 140),
  description      text check (description is null or char_length(description) <= 2000),
  why              text check (why is null or char_length(why) <= 2000),
  success          text check (success is null or char_length(success) <= 500),
  goal_type        public.goal_type not null default 'outcome',
  metric           text check (metric is null or char_length(metric) <= 60),
  unit             text check (unit is null or char_length(unit) <= 20),
  cadence          public.goal_cadence not null default 'total',
  aggregation      public.goal_aggregation not null default 'sum',
  progress_source  public.progress_source not null default 'children',
  start_value      numeric,
  target_value     numeric,
  current_value    numeric,
  habit_id         uuid,
  priority         smallint not null default 2 check (priority between 1 and 3),
  state            public.goal_state not null default 'active',
  deadline         date,
  sort_order       integer not null default 0,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, user_id),
  foreign key (life_area_id, user_id) references public.life_areas (id, user_id) on delete set null (life_area_id),
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete set null (habit_id)
);
create index yearly_goals_user_year_idx on public.yearly_goals (user_id, year);

create table public.quarterly_goals (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  year                  smallint not null check (year between 2000 and 2100),
  quarter               smallint not null check (quarter between 1 and 4),
  parent_yearly_goal_id uuid,
  life_area_id          uuid,
  title                 text not null check (char_length(btrim(title)) between 1 and 140),
  description           text check (description is null or char_length(description) <= 2000),
  why                   text check (why is null or char_length(why) <= 2000),
  success               text check (success is null or char_length(success) <= 500),
  goal_type             public.goal_type not null default 'outcome',
  metric                text check (metric is null or char_length(metric) <= 60),
  unit                  text check (unit is null or char_length(unit) <= 20),
  cadence               public.goal_cadence not null default 'total',
  aggregation           public.goal_aggregation not null default 'sum',
  progress_source       public.progress_source not null default 'children',
  start_value           numeric,
  target_value          numeric,
  current_value         numeric,
  habit_id              uuid,
  priority              smallint not null default 2 check (priority between 1 and 3),
  state                 public.goal_state not null default 'active',
  deadline              date,
  sort_order            integer not null default 0,
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (id, user_id),
  foreign key (parent_yearly_goal_id, user_id) references public.yearly_goals (id, user_id) on delete cascade,
  foreign key (life_area_id, user_id) references public.life_areas (id, user_id) on delete set null (life_area_id),
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete set null (habit_id)
);
create index quarterly_goals_user_period_idx on public.quarterly_goals (user_id, year, quarter);

create table public.monthly_goals (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month_start              date not null check (extract(day from month_start) = 1),
  parent_yearly_goal_id    uuid,
  parent_quarterly_goal_id uuid,
  life_area_id             uuid,
  title                    text not null check (char_length(btrim(title)) between 1 and 140),
  description              text check (description is null or char_length(description) <= 2000),
  why                      text check (why is null or char_length(why) <= 2000),
  success                  text check (success is null or char_length(success) <= 500),
  goal_type                public.goal_type not null default 'outcome',
  metric                   text check (metric is null or char_length(metric) <= 60),
  unit                     text check (unit is null or char_length(unit) <= 20),
  cadence                  public.goal_cadence not null default 'total',
  aggregation              public.goal_aggregation not null default 'sum',
  progress_source          public.progress_source not null default 'children',
  start_value              numeric,
  target_value             numeric,
  current_value            numeric,
  habit_id                 uuid,
  priority                 smallint not null default 2 check (priority between 1 and 3),
  state                    public.goal_state not null default 'active',
  deadline                 date,
  sort_order               integer not null default 0,
  completed_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (id, user_id),
  foreign key (parent_yearly_goal_id, user_id) references public.yearly_goals (id, user_id) on delete cascade,
  foreign key (parent_quarterly_goal_id, user_id) references public.quarterly_goals (id, user_id) on delete set null (parent_quarterly_goal_id),
  foreign key (life_area_id, user_id) references public.life_areas (id, user_id) on delete set null (life_area_id),
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete set null (habit_id)
);
create index monthly_goals_user_month_idx on public.monthly_goals (user_id, month_start);
create index monthly_goals_parent_idx on public.monthly_goals (parent_yearly_goal_id);

create table public.weekly_goals (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Monday of the week.
  week_start             date not null check (extract(isodow from week_start) = 1),
  parent_monthly_goal_id uuid,
  -- A major outcome for the week (1–3 recommended) or a supporting task under one.
  is_major               boolean not null default true,
  carried_from_id        uuid,
  life_area_id           uuid,
  title                  text not null check (char_length(btrim(title)) between 1 and 140),
  description            text check (description is null or char_length(description) <= 2000),
  why                    text check (why is null or char_length(why) <= 2000),
  success                text check (success is null or char_length(success) <= 500),
  goal_type              public.goal_type not null default 'process',
  metric                 text check (metric is null or char_length(metric) <= 60),
  unit                   text check (unit is null or char_length(unit) <= 20),
  cadence                public.goal_cadence not null default 'total',
  aggregation            public.goal_aggregation not null default 'sum',
  progress_source        public.progress_source not null default 'actions',
  start_value            numeric,
  target_value           numeric,
  current_value          numeric,
  habit_id               uuid,
  priority               smallint not null default 2 check (priority between 1 and 3),
  state                  public.goal_state not null default 'active',
  deadline               date,
  sort_order             integer not null default 0,
  completed_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (id, user_id),
  foreign key (parent_monthly_goal_id, user_id) references public.monthly_goals (id, user_id) on delete cascade,
  foreign key (carried_from_id, user_id) references public.weekly_goals (id, user_id) on delete set null (carried_from_id),
  foreign key (life_area_id, user_id) references public.life_areas (id, user_id) on delete set null (life_area_id),
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete set null (habit_id)
);
create index weekly_goals_user_week_idx on public.weekly_goals (user_id, week_start);
create index weekly_goals_parent_idx on public.weekly_goals (parent_monthly_goal_id);

-- Daily goals are the day's actions: what gets done, not just planned.
create table public.daily_goals (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null default auth.uid() references auth.users (id) on delete cascade,
  local_date             date not null,
  parent_weekly_goal_id  uuid,
  title                  text not null check (char_length(btrim(title)) between 1 and 140),
  -- How much this action moves its weekly goal when done (15 leads, 3 hours). Null counts as 1.
  quantity               numeric check (quantity is null or quantity > 0),
  unit                   text check (unit is null or char_length(unit) <= 20),
  estimated_minutes      integer check (estimated_minutes is null or estimated_minutes between 1 and 960),
  -- 1–3: today's Big 3, in order. Null: a supporting task.
  rank                   smallint check (rank between 1 and 3),
  status                 public.daily_goal_status not null default 'pending',
  source                 text not null default 'manual' check (source in ('manual', 'suggested', 'carried')),
  carried_from_id        uuid,
  work_block_id          uuid,
  completed_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (id, user_id),
  foreign key (parent_weekly_goal_id, user_id) references public.weekly_goals (id, user_id) on delete set null (parent_weekly_goal_id),
  foreign key (carried_from_id, user_id) references public.daily_goals (id, user_id) on delete set null (carried_from_id),
  foreign key (work_block_id, user_id) references public.work_blocks (id, user_id) on delete set null (work_block_id)
);
create index daily_goals_user_day_idx on public.daily_goals (user_id, local_date);
create index daily_goals_parent_idx on public.daily_goals (parent_weekly_goal_id);
create unique index daily_goals_rank_uidx on public.daily_goals (user_id, local_date, rank) where rank is not null;

-- A mission slot can point at the daily goal it came from, so ticking it moves the goal.
alter table public.daily_priorities add column daily_goal_id uuid;
alter table public.daily_priorities
  add constraint daily_priorities_daily_goal_fk
  foreign key (daily_goal_id, user_id) references public.daily_goals (id, user_id) on delete set null (daily_goal_id);

-- ---------------------------------------------------------------------------
-- Milestones (for milestone goals, yearly or monthly)
-- ---------------------------------------------------------------------------
create table public.goal_milestones (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  yearly_goal_id  uuid,
  monthly_goal_id uuid,
  title           text not null check (char_length(btrim(title)) between 1 and 140),
  due_date        date,
  done            boolean not null default false,
  completed_at    timestamptz,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (num_nonnulls(yearly_goal_id, monthly_goal_id) = 1),
  foreign key (yearly_goal_id, user_id) references public.yearly_goals (id, user_id) on delete cascade,
  foreign key (monthly_goal_id, user_id) references public.monthly_goals (id, user_id) on delete cascade
);
create index goal_milestones_yearly_idx on public.goal_milestones (yearly_goal_id);
create index goal_milestones_monthly_idx on public.goal_milestones (monthly_goal_id);

-- ---------------------------------------------------------------------------
-- Dependencies: "this has to happen before that", at one level
-- ---------------------------------------------------------------------------
create table public.goal_dependencies (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  level      text not null check (level in ('yearly', 'monthly', 'weekly')),
  blocker_id uuid not null,
  blocked_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (blocker_id <> blocked_id),
  unique (level, blocker_id, blocked_id)
);
create index goal_dependencies_user_idx on public.goal_dependencies (user_id, level);

-- Both ends must be the user's own goals at that level.
create or replace function public.goal_dependencies_validate()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_table text := new.level || '_goals';
  v_count integer;
begin
  execute format('select count(*) from public.%I where user_id = $1 and id in ($2, $3)', v_table)
    into v_count using new.user_id, new.blocker_id, new.blocked_id;
  if v_count <> 2 then
    raise exception 'Both goals must be yours and at the same level' using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;
create trigger goal_dependencies_validate before insert or update on public.goal_dependencies
  for each row execute function public.goal_dependencies_validate();

-- ---------------------------------------------------------------------------
-- Reviews: what happened to each goal at the end of its period
-- ---------------------------------------------------------------------------
create table public.goal_reviews (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  period          text not null check (period in ('week', 'month', 'quarter', 'year')),
  period_start    date not null,
  weekly_goal_id  uuid,
  monthly_goal_id uuid,
  yearly_goal_id  uuid,
  target_value    numeric,
  actual_value    numeric,
  outcome         public.review_outcome not null,
  reason          public.miss_reason,
  reason_note     text check (reason_note is null or char_length(reason_note) <= 1000),
  decision        public.miss_decision,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (num_nonnulls(weekly_goal_id, monthly_goal_id, yearly_goal_id) = 1),
  foreign key (weekly_goal_id, user_id) references public.weekly_goals (id, user_id) on delete cascade,
  foreign key (monthly_goal_id, user_id) references public.monthly_goals (id, user_id) on delete cascade,
  foreign key (yearly_goal_id, user_id) references public.yearly_goals (id, user_id) on delete cascade
);
-- One review per goal. Not partial: upserts target these columns, and nulls never collide anyway.
create unique index goal_reviews_weekly_uidx on public.goal_reviews (weekly_goal_id);
create unique index goal_reviews_monthly_uidx on public.goal_reviews (monthly_goal_id);
create unique index goal_reviews_yearly_uidx on public.goal_reviews (yearly_goal_id);
create index goal_reviews_user_period_idx on public.goal_reviews (user_id, period, period_start);

-- ---------------------------------------------------------------------------
-- Suggestions awaiting approval (AI or rules). Nothing here is active until accepted.
-- ---------------------------------------------------------------------------
create table public.goal_suggestions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  level      text not null check (level in ('yearly', 'quarterly', 'monthly', 'weekly', 'daily')),
  source     text not null default 'rules' check (source in ('rules', 'ai')),
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
  payload    jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index goal_suggestions_user_idx on public.goal_suggestions (user_id, status, level);

-- ---------------------------------------------------------------------------
-- Weekly reflection (extends the existing [V2] weekly_reviews table)
-- ---------------------------------------------------------------------------
alter table public.weekly_reviews
  add column wins         text check (wins is null or char_length(wins) <= 2000),
  add column lessons      text check (lessons is null or char_length(lessons) <= 2000),
  add column completed_at timestamptz;

-- ---------------------------------------------------------------------------
-- Triggers and RLS
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'life_areas', 'yearly_goals', 'quarterly_goals', 'monthly_goals', 'weekly_goals', 'daily_goals',
    'goal_milestones', 'goal_dependencies', 'goal_reviews', 'goal_suggestions'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t);
    execute format('alter table public.%I enable row level security', t);
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
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

-- A day's actions follow the day rules: no future days, and a completed day is read-only.
create trigger daily_goals_guard_day before insert or update or delete on public.daily_goals
  for each row execute function public.guard_day();

-- Life areas, like habits, are hidden rather than deleted: goals keep pointing at them.
revoke delete on public.life_areas from authenticated;

revoke execute on function public.seed_life_areas(uuid) from public, anon, authenticated;
revoke execute on function public.ensure_life_areas() from public, anon;
grant execute on function public.ensure_life_areas() to authenticated;
