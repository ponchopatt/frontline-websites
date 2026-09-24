-- Discipline OS — the execution dashboard
--
-- Turns the app into one screen for the day: tasks (with today's Big 3), quick business
-- counters, faith and fitness habits, work by business, one AI-bot milestone, proof photos,
-- and "Keep My Word" as the day's number.
--
-- It reshapes what exists rather than adding a second copy of anything:
--   * daily_goals becomes THE task table. The Big 3 are tasks ranked 1–3. The old
--     daily_priorities rows move in and that table goes.
--   * Bible, Journal and Prayer are morning habits (habits.kind), so ticking them in the
--     morning routine or on the faith card is one tick.
--   * Business numbers are counters (metrics + metric_entries) that roll up by date, and
--     goals can take their progress straight from a counter.
--   * The day's score is Keep My Word: commitments done ÷ commitments made
--     (see public.day_summaries below and src/lib/keep-word.ts).

-- ---------------------------------------------------------------------------
-- Areas: one vocabulary for tasks, counters, work sessions and life areas
-- ---------------------------------------------------------------------------
create or replace function public.is_area(a text)
returns boolean
language sql
immutable
as $$
  select a in ('faith', 'fitness', 'imperium', 'websites', 'trading', 'discipline', 'money', 'other');
$$;

alter table public.life_areas add column key text check (key is null or public.is_area(key));
create unique index life_areas_user_key_uidx on public.life_areas (user_id, key) where key is not null;

create or replace function public.seed_life_areas(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.life_areas where user_id = p_user) then
    insert into public.life_areas (user_id, name, key, sort_order)
    select p_user, a.name, a.key, a.ord
    from (values
      ('Faith', 'faith', 1), ('Fitness', 'fitness', 2), ('Imperium', 'imperium', 3),
      ('Websites', 'websites', 4), ('AI Trading', 'trading', 5), ('Personal discipline', 'discipline', 6),
      ('Money', 'money', 7), ('Health', null, 8), ('Family', null, 9), ('Relationships', null, 10),
      ('Learning', null, 11), ('Other', 'other', 12)
    ) as a (name, key, ord);
    return;
  end if;

  -- Accounts made before areas had keys: key the ones that match, add the businesses.
  update public.life_areas l set key = m.key
  from (values ('faith', 'Faith'), ('fitness', 'Fitness'), ('money', 'Money'),
               ('discipline', 'Personal discipline'), ('other', 'Other')) as m (key, name)
  where l.user_id = p_user and l.key is null and lower(l.name) = lower(m.name)
    and not exists (select 1 from public.life_areas k where k.user_id = p_user and k.key = m.key);

  insert into public.life_areas (user_id, name, key, sort_order)
  select p_user, a.name, a.key, a.ord
  from (values ('Imperium', 'imperium', 3), ('Websites', 'websites', 4), ('AI Trading', 'trading', 5)) as a (name, key, ord)
  where not exists (select 1 from public.life_areas l where l.user_id = p_user and (l.key = a.key or lower(l.name) = lower(a.name)));
end;
$$;

-- ---------------------------------------------------------------------------
-- Profile: the targets the dashboard measures against
-- ---------------------------------------------------------------------------
alter table public.profiles alter column work_target_hours set default 8;
alter table public.profiles alter column streak_threshold set default 80;
alter table public.profiles
  -- ISO weekdays that are work days (1 = Monday). Daily targets spread the week over these.
  add column work_days smallint[] not null default '{1,2,3,4,5}'
    check (work_days <@ '{1,2,3,4,5,6,7}'::smallint[] and cardinality(work_days) between 1 and 7),
  -- Hours a day to give a business, e.g. {"trading": 2}.
  add column area_hour_targets jsonb not null default '{"trading": 2}'::jsonb
    check (jsonb_typeof(area_hour_targets) = 'object'),
  add column bible_plan text not null default 'bible'
    check (bible_plan in ('bible', 'new_testament', 'gospels', 'psalms_proverbs'));

-- ---------------------------------------------------------------------------
-- Habits: a kind for the ones the dashboard knows, and the days they're due
-- ---------------------------------------------------------------------------
alter table public.habits
  add column kind text check (kind in ('bible', 'journal', 'prayer', 'evening_prayer', 'gym', 'cardio')),
  -- ISO weekdays the habit is due. Null: every day. Gym on {1,2,3,4,5} is five days a week.
  add column days smallint[] check (days is null or (days <@ '{1,2,3,4,5,6,7}'::smallint[] and cardinality(days) between 1 and 7));
create unique index habits_user_kind_uidx on public.habits (user_id, kind) where kind is not null and is_active;

create or replace function public.seed_default_habits(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.habits where user_id = p_user) then
    return;
  end if;

  insert into public.habits (user_id, name, category, sort_order, kind, days)
  select p_user, d.name, d.category::public.habit_category, d.sort_order, d.kind, d.days
  from (values
    ('Wake up on time',        'morning',    1, null,             null::smallint[]),
    ('Shower',                 'morning',    2, null,             null),
    ('Make bed',               'morning',    3, null,             null),
    ('Water',                  'morning',    4, null,             null),
    ('Bible',                  'morning',    5, 'bible',          null),
    ('Journal',                'morning',    6, 'journal',        null),
    ('Pray',                   'morning',    7, 'prayer',         null),
    ('Plan day',               'morning',    8, null,             null),
    ('Evening prayer',         'god',        1, 'evening_prayer', null),
    ('Gym',                    'body',       1, 'gym',            '{1,2,3,4,5}'),
    ('Cardio',                 'body',       2, 'cardio',         null),
    ('Protein',                'body',       3, null,             null),
    ('Water target',           'body',       4, null,             null),
    ('Sleep target',           'body',       5, null,             null),
    ('No porn',                'discipline', 1, null,             null),
    ('No pointless scrolling', 'discipline', 2, null,             null),
    ('No procrastination',     'discipline', 3, null,             null)
  ) as d (name, category, sort_order, kind, days);
end;
$$;

-- Accounts seeded with the first defaults: give the matching habits their kind.
update public.habits h set kind = m.kind, days = m.days
from (values ('Bible study', 'morning', 'bible', null::smallint[]),
             ('Journal', 'morning', 'journal', null),
             ('Prayer', 'morning', 'prayer', null),
             ('Gym', 'body', 'gym', '{1,2,3,4,5}'::smallint[]),
             ('Cardio', 'body', 'cardio', null)) as m (name, category, kind, days)
where h.name = m.name and h.category::text = m.category and h.kind is null and h.is_active
  and not exists (select 1 from public.habits k where k.user_id = h.user_id and k.kind = m.kind and k.is_active);

insert into public.habits (user_id, name, category, sort_order, kind)
select p.user_id, 'Evening prayer', 'god', 1, 'evening_prayer'
from public.profiles p
where exists (select 1 from public.habits h where h.user_id = p.user_id)
  and not exists (select 1 from public.habits h where h.user_id = p.user_id and h.kind = 'evening_prayer');

-- ---------------------------------------------------------------------------
-- Counters: the numbers the businesses run on
-- ---------------------------------------------------------------------------
create table public.metrics (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area          text not null check (public.is_area(area)),
  key           text not null check (key ~ '^[a-z][a-z0-9_]{0,39}$'),
  label         text not null check (char_length(btrim(label)) between 1 and 40),
  -- The section it sits in on its business: sales, marketing, revenue, demos, outreach, delivery.
  grp           text check (grp is null or char_length(grp) <= 20),
  unit          text check (unit is null or char_length(unit) <= 20),
  -- sum: a day's number adds to the week (calls). latest: it's a level (demos ready to call).
  aggregation   public.goal_aggregation not null default 'sum',
  daily_target  numeric check (daily_target is null or daily_target >= 0),
  weekly_target numeric check (weekly_target is null or weekly_target >= 0),
  -- Shown on the Today screen (the rest are one tap away on the business page).
  pinned        boolean not null default true,
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, user_id)
);
create unique index metrics_user_area_key_uidx on public.metrics (user_id, area, key);

create table public.metric_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  metric_id  uuid not null,
  local_date date not null,
  value      numeric not null check (value >= 0 and value < 100000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (metric_id, user_id) references public.metrics (id, user_id) on delete cascade
);
create unique index metric_entries_metric_day_uidx on public.metric_entries (metric_id, local_date);
create index metric_entries_user_day_idx on public.metric_entries (user_id, local_date);

create or replace function public.seed_metrics(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.metrics (user_id, area, key, label, grp, unit, aggregation, daily_target, weekly_target, pinned, sort_order)
  select p_user, m.area, m.key, m.label, m.grp, m.unit, m.agg::public.goal_aggregation, m.daily, m.weekly, m.pinned, m.ord
  from (values
    ('imperium', 'leads_called',   'Leads called',        'sales',     'leads',      'sum',    null::numeric, 50::numeric, true,  1),
    ('imperium', 'follow_ups',     'Follow-ups',          'sales',     'follow-ups', 'sum',    null, null, true,  2),
    ('imperium', 'quotes_sent',    'Quotes sent',         'sales',     'quotes',     'sum',    null, null, false, 3),
    ('imperium', 'bookings',       'Bookings',            'sales',     'bookings',   'sum',    null, null, false, 4),
    ('imperium', 'jobs_completed', 'Jobs',                'sales',     'jobs',       'sum',    null, null, true,  5),
    ('imperium', 'reel_ideas',     'Reel ideas',          'marketing', 'ideas',      'sum',    null, null, true,  6),
    ('imperium', 'reels_filmed',   'Reels filmed',        'marketing', 'reels',      'sum',    null, null, false, 7),
    ('imperium', 'reels_posted',   'Reels posted',        'marketing', 'reels',      'sum',    null, 5,    true,  8),
    ('imperium', 'before_after',   'Before/after posts',  'marketing', 'posts',      'sum',    null, null, false, 9),
    ('imperium', 'stories',        'Stories',             'marketing', 'stories',    'sum',    null, null, false, 10),
    ('imperium', 'revenue',        'Revenue',             'revenue',   '$',          'sum',    null, 5000, true,  11),
    ('websites', 'demos_built',    'Demos built',         'demos',     'demos',      'sum',    null, 10,   true,  1),
    ('websites', 'demos_ready',    'Ready to call',       'demos',     'demos',      'latest', null, null, true,  2),
    ('websites', 'cold_calls',     'Cold calls',          'outreach',  'calls',      'sum',    null, 100,  true,  3),
    ('websites', 'follow_ups',     'Follow-ups',          'outreach',  'follow-ups', 'sum',    null, null, true,  4),
    ('websites', 'closed',         'Closed',              'sales',     'deals',      'sum',    null, null, true,  5),
    ('websites', 'revenue',        'Revenue',             'sales',     '$',          'sum',    null, null, true,  6),
    ('websites', 'delivered',      'Delivered',           'delivery',  'websites',   'sum',    null, null, true,  7),
    ('fitness',  'cardio_minutes', 'Cardio',              null,        'min',        'sum',    20,   null, false, 1)
  ) as m (area, key, label, grp, unit, agg, daily, weekly, pinned, ord)
  on conflict (user_id, area, key) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tasks: daily_goals is the one task table
-- ---------------------------------------------------------------------------
alter table public.daily_goals
  -- Null: "later", not on any day yet, so it isn't a commitment until it's planned.
  alter column local_date drop not null,
  add column area        text check (area is null or public.is_area(area)),
  add column category    text check (category is null or char_length(category) <= 40),
  add column priority    smallint not null default 2 check (priority between 1 and 3),
  add column due_date    date,
  add column notes       text check (notes is null or char_length(notes) <= 1000),
  -- A task tied to a counter ("Call 10 leads") is done when the counter reaches its quantity.
  add column metric_id   uuid,
  add constraint daily_goals_metric_fk foreign key (metric_id, user_id)
    references public.metrics (id, user_id) on delete set null (metric_id);
create index daily_goals_user_later_idx on public.daily_goals (user_id, due_date) where local_date is null;

-- Move the old Big 3 into tasks (the ones that didn't already come from a task).
alter table public.daily_goals disable trigger daily_goals_guard_day;
insert into public.daily_goals (user_id, local_date, title, notes, rank, status, completed_at, created_at, source)
select p.user_id, p.local_date, left(p.title, 140), p.description, p.position, p.status::text::public.daily_goal_status,
       p.completed_at, p.created_at, 'manual'
from public.daily_priorities p
where p.daily_goal_id is null
  and not exists (
    select 1 from public.daily_goals g
    where g.user_id = p.user_id and g.local_date = p.local_date and g.rank = p.position
  );
-- Ones that did: the task takes the slot's position.
update public.daily_goals g set rank = p.position
from public.daily_priorities p
where p.daily_goal_id = g.id and g.rank is distinct from p.position
  and not exists (
    select 1 from public.daily_goals o
    where o.user_id = g.user_id and o.local_date = g.local_date and o.rank = p.position and o.id <> g.id
  );
alter table public.daily_goals enable trigger daily_goals_guard_day;
drop table public.daily_priorities;

-- ---------------------------------------------------------------------------
-- Work: which business the time went to
-- ---------------------------------------------------------------------------
alter table public.work_sessions add column area text check (area is null or area in ('imperium', 'websites', 'trading', 'other'));
alter table public.work_blocks add column area text check (area is null or area in ('imperium', 'websites', 'trading', 'other'));

-- ---------------------------------------------------------------------------
-- AI bot: one current milestone with its steps
-- ---------------------------------------------------------------------------
create table public.project_milestones (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area         text not null default 'trading' check (public.is_area(area)),
  title        text not null check (char_length(btrim(title)) between 1 and 120),
  -- [{"title": "Implement", "done": false}, ...]
  steps        jsonb not null default '[
    {"title": "Implement", "done": false}, {"title": "Test", "done": false},
    {"title": "Backtest", "done": false}, {"title": "Compare", "done": false},
    {"title": "Fix", "done": false}, {"title": "Document", "done": false},
    {"title": "Complete milestone", "done": false}]'::jsonb
    check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 20),
  state        text not null default 'active' check (state in ('active', 'done')),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, user_id)
);
create unique index project_milestones_one_active_uidx on public.project_milestones (user_id, area) where state = 'active';

-- ---------------------------------------------------------------------------
-- Proof photos: any task or habit, stored privately under the user's own folder
-- ---------------------------------------------------------------------------
alter table public.proof_uploads
  add column task_id uuid,
  add constraint proof_uploads_task_fk foreign key (task_id, user_id)
    references public.daily_goals (id, user_id) on delete set null (task_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proof', 'proof', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "proof: read own" on storage.objects for select to authenticated
  using (bucket_id = 'proof' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "proof: add own" on storage.objects for insert to authenticated
  with check (bucket_id = 'proof' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "proof: remove own" on storage.objects for delete to authenticated
  using (bucket_id = 'proof' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Reviews: a journal line with the reading; the weekly review's four questions
-- ---------------------------------------------------------------------------
alter table public.bible_entries add column journal text check (journal is null or char_length(journal) <= 4000);
alter table public.weekly_reviews
  add column failure    text check (failure is null or char_length(failure) <= 2000),
  add column bottleneck text check (bottleneck is null or char_length(bottleneck) <= 2000);

-- ---------------------------------------------------------------------------
-- Goals can take progress straight from a counter
-- ---------------------------------------------------------------------------
alter type public.progress_source add value if not exists 'metric';

do $$
declare
  t text;
begin
  foreach t in array array['yearly_goals', 'quarterly_goals', 'monthly_goals', 'weekly_goals'] loop
    execute format('alter table public.%I add column metric_id uuid', t);
    execute format(
      'alter table public.%I add constraint %I foreign key (metric_id, user_id) references public.metrics (id, user_id) on delete set null (metric_id)',
      t, t || '_metric_fk');
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers, RLS, grants for the new tables
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['metrics', 'metric_entries', 'project_milestones'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_set_updated_at', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', 'own rows: select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', 'own rows: insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', 'own rows: update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', 'own rows: delete', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

create trigger metric_entries_guard_day before insert or update or delete on public.metric_entries
  for each row execute function public.guard_day();
-- Counters are hidden, never deleted, so their history stays.
revoke delete on public.metrics from authenticated;

-- ---------------------------------------------------------------------------
-- Seeding: new accounts get counters; existing accounts get them now
-- ---------------------------------------------------------------------------
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
  perform public.seed_metrics(p_user);
end;
$$;

-- Called on each visit to repair an account made before a seed existed. Idempotent.
create or replace function public.ensure_setup()
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
  perform public.seed_metrics(auth.uid());
end;
$$;
revoke execute on function public.ensure_setup() from public, anon;
grant execute on function public.ensure_setup() to authenticated;
revoke execute on function public.seed_metrics(uuid) from public, anon, authenticated;

select public.seed_metrics(user_id) from public.profiles;
select public.seed_life_areas(user_id) from public.profiles;

-- ---------------------------------------------------------------------------
-- Day summaries: the counts behind Keep My Word
-- ---------------------------------------------------------------------------
-- A commitment is anything you said you'd do that day:
--   * each habit that existed and was due that day (habits.days),
--   * each task planned for that day (whatever its status: dropped is a broken commitment),
--   * the night review (done when all four questions are answered),
--   * the work target (done when the hours are in) — counted in TypeScript, which knows
--     the target.
drop function if exists public.day_summaries(date, date);

create function public.day_summaries(p_from date, p_to date)
returns table (
  local_date   date,
  habits_total integer,
  habits_done  integer,
  tasks_total  integer,
  tasks_done   integer,
  review_done  integer,
  work_minutes numeric,
  final_score  smallint,
  completed_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with prof as (
    select p.timezone as tz, p.day_start_hour as h
    from public.profiles p
    where p.user_id = auth.uid()
  ),
  days as (
    select gs::date as local_date
    from generate_series(p_from, least(p_to, p_from + 400), interval '1 day') gs
  ),
  hab as (
    select
      h.id,
      h.days,
      public.local_date_at(h.created_at, prof.tz, prof.h) as from_date,
      case when h.archived_at is null then null
           else public.local_date_at(h.archived_at, prof.tz, prof.h) end as to_date
    from public.habits h
    cross join prof
    where h.user_id = auth.uid()
  ),
  due as (
    select d.local_date, hab.id as habit_id
    from days d
    join hab on hab.from_date <= d.local_date
      and (hab.to_date is null or hab.to_date > d.local_date)
      and (hab.days is null or extract(isodow from d.local_date)::smallint = any (hab.days))
  ),
  habit_tally as (
    select u.local_date, count(*)::int as n_total, count(c.id)::int as n_done
    from due u
    left join public.habit_completions c
      on c.habit_id = u.habit_id and c.local_date = u.local_date and c.user_id = auth.uid()
    group by u.local_date
  ),
  task_tally as (
    select t.local_date, count(*)::int as n_total, (count(*) filter (where t.status = 'done'))::int as n_done
    from public.daily_goals t
    where t.user_id = auth.uid() and t.local_date between p_from and p_to
    group by t.local_date
  ),
  review as (
    select
      v.local_date,
      (nullif(btrim(coalesce(v.accomplished, '')), '') is not null
       and nullif(btrim(coalesce(v.wasted_time_on, '')), '') is not null
       and nullif(btrim(coalesce(v.broke_word_where, '')), '') is not null
       and nullif(btrim(coalesce(v.tomorrow_priority, '')), '') is not null)::int as done
    from public.daily_reviews v
    where v.user_id = auth.uid() and v.local_date between p_from and p_to
  ),
  work as (
    select
      s.local_date,
      sum(extract(epoch from (coalesce(s.ended_at, now()) - s.started_at)) / 60.0) as minutes
    from public.work_sessions s
    where s.user_id = auth.uid() and s.local_date between p_from and p_to
    group by s.local_date
  )
  select
    d.local_date,
    coalesce(ht.n_total, 0),
    coalesce(ht.n_done, 0),
    coalesce(tt.n_total, 0),
    coalesce(tt.n_done, 0),
    coalesce(rv.done, 0),
    coalesce(w.minutes, 0),
    pl.final_score,
    pl.completed_at
  from days d
  left join habit_tally ht on ht.local_date = d.local_date
  left join task_tally tt on tt.local_date = d.local_date
  left join review rv on rv.local_date = d.local_date
  left join work w on w.local_date = d.local_date
  left join public.daily_plans pl on pl.local_date = d.local_date and pl.user_id = auth.uid()
  order by d.local_date;
$$;

revoke execute on function public.day_summaries(date, date) from public, anon;
grant execute on function public.day_summaries(date, date) to authenticated;
