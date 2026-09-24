-- The daily feedback loop: Minimum Day, proof topics for the proof wall, and the extra
-- counts day_summaries returns for streaks, the year view and the close-day summary.

-- ---------------------------------------------------------------------------
-- Minimum Day: the few non-negotiables for a bad day
-- ---------------------------------------------------------------------------
-- A habit marked minimum is one of them. So is some focused work, and the gym or cardio.
alter table public.habits add column minimum boolean not null default false;

alter table public.profiles
  add column minimum_work_minutes smallint not null default 20
    check (minimum_work_minutes between 0 and 240),
  -- Gym or cardio counts as one item of the minimum day.
  add column minimum_fitness boolean not null default true;

-- When Minimum Day was switched on for the day; null when it's off. The day's Keep My Word
-- still counts everything, so switching it on never makes a day look better than it was.
alter table public.daily_plans add column minimum_at timestamptz;

update public.habits
set minimum = true
where is_active
  and (kind in ('bible', 'prayer', 'journal')
       or (category = 'morning' and name = 'Shower')
       or (category = 'body' and name = 'Sleep target'));

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

  insert into public.habits (user_id, name, category, sort_order, kind, days, minimum)
  select p_user, d.name, d.category::public.habit_category, d.sort_order, d.kind, d.days, d.minimum
  from (values
    ('Wake up on time',        'morning',    1, null,             null::smallint[], false),
    ('Shower',                 'morning',    2, null,             null,             true),
    ('Make bed',               'morning',    3, null,             null,             false),
    ('Water',                  'morning',    4, null,             null,             false),
    ('Bible',                  'morning',    5, 'bible',          null,             true),
    ('Journal',                'morning',    6, 'journal',        null,             true),
    ('Pray',                   'morning',    7, 'prayer',         null,             true),
    ('Plan day',               'morning',    8, null,             null,             false),
    ('Evening prayer',         'god',        1, 'evening_prayer', null,             false),
    ('Gym',                    'body',       1, 'gym',            '{1,2,3,4,5}',    false),
    ('Cardio',                 'body',       2, 'cardio',         null,             false),
    ('Protein',                'body',       3, null,             null,             false),
    ('Water target',           'body',       4, null,             null,             false),
    ('Sleep target',           'body',       5, null,             null,             true),
    ('No porn',                'discipline', 1, null,             null,             false),
    ('No pointless scrolling', 'discipline', 2, null,             null,             false),
    ('No procrastination',     'discipline', 3, null,             null,             false)
  ) as d (name, category, sort_order, kind, days, minimum);
end;
$$;
revoke execute on function public.seed_default_habits(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Proof wall: what each photo is proof of
-- ---------------------------------------------------------------------------
alter table public.proof_uploads
  add column topic text not null default 'other'
    check (topic in ('faith', 'gym', 'imperium', 'websites', 'work', 'other'));

-- Existing photos take their topic from the task or habit they were added to.
alter table public.proof_uploads disable trigger proof_uploads_guard_day;
update public.proof_uploads p
set topic = case t.area
  when 'faith' then 'faith'
  when 'fitness' then 'gym'
  when 'imperium' then 'imperium'
  when 'websites' then 'websites'
  when 'trading' then 'work'
  else 'other' end
from public.daily_goals t
where t.id = p.task_id and t.user_id = p.user_id;
update public.proof_uploads p
set topic = case
  when h.kind in ('bible', 'journal', 'prayer', 'evening_prayer') or h.category = 'god' then 'faith'
  when h.kind in ('gym', 'cardio') or h.category = 'body' then 'gym'
  else 'other' end
from public.habits h
where h.id = p.habit_id and h.user_id = p.user_id and p.task_id is null;
alter table public.proof_uploads enable trigger proof_uploads_guard_day;

create index proof_uploads_user_topic_idx on public.proof_uploads (user_id, topic, local_date);

-- ---------------------------------------------------------------------------
-- Day summaries, now with the Minimum Day's own count
-- ---------------------------------------------------------------------------
--   minimum_on     Minimum Day was switched on that day
--   minimum_total  its items: minimum habits due + the work minutes (if set) + gym or cardio (if set)
--   minimum_done   how many of them were done
-- A secured minimum day keeps the Keep My Word streak alive (src/lib/streak.ts); the day's
-- own number is unchanged.
drop function if exists public.day_summaries(date, date);

create function public.day_summaries(p_from date, p_to date)
returns table (
  local_date    date,
  habits_total  integer,
  habits_done   integer,
  tasks_total   integer,
  tasks_done    integer,
  review_done   integer,
  work_minutes  numeric,
  final_score   smallint,
  completed_at  timestamptz,
  minimum_on    boolean,
  minimum_total integer,
  minimum_done  integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with prof as (
    select p.timezone as tz, p.day_start_hour as h, p.minimum_work_minutes as min_work, p.minimum_fitness as min_fit
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
      h.minimum,
      public.local_date_at(h.created_at, prof.tz, prof.h) as from_date,
      case when h.archived_at is null then null
           else public.local_date_at(h.archived_at, prof.tz, prof.h) end as to_date
    from public.habits h
    cross join prof
    where h.user_id = auth.uid()
  ),
  due as (
    select d.local_date, hab.id as habit_id, hab.minimum
    from days d
    join hab on hab.from_date <= d.local_date
      and (hab.to_date is null or hab.to_date > d.local_date)
      and (hab.days is null or extract(isodow from d.local_date)::smallint = any (hab.days))
  ),
  habit_tally as (
    select
      u.local_date,
      count(*)::int as n_total,
      count(c.id)::int as n_done,
      (count(*) filter (where u.minimum))::int as min_total,
      (count(c.id) filter (where u.minimum))::int as min_done
    from due u
    left join public.habit_completions c
      on c.habit_id = u.habit_id and c.local_date = u.local_date and c.user_id = auth.uid()
    group by u.local_date
  ),
  fitness as (
    select c.local_date
    from public.habit_completions c
    join public.habits h on h.id = c.habit_id and h.user_id = c.user_id
    where c.user_id = auth.uid() and c.local_date between p_from and p_to and h.kind in ('gym', 'cardio')
    group by c.local_date
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
    pl.completed_at,
    pl.minimum_at is not null,
    coalesce(ht.min_total, 0)
      + (case when prof.min_work > 0 then 1 else 0 end)
      + (case when coalesce(prof.min_fit, false) then 1 else 0 end),
    coalesce(ht.min_done, 0)
      + (case when prof.min_work > 0 and coalesce(w.minutes, 0) >= prof.min_work then 1 else 0 end)
      + (case when coalesce(prof.min_fit, false) and f.local_date is not null then 1 else 0 end)
  from days d
  left join prof on true
  left join habit_tally ht on ht.local_date = d.local_date
  left join task_tally tt on tt.local_date = d.local_date
  left join review rv on rv.local_date = d.local_date
  left join work w on w.local_date = d.local_date
  left join fitness f on f.local_date = d.local_date
  left join public.daily_plans pl on pl.local_date = d.local_date and pl.user_id = auth.uid()
  order by d.local_date;
$$;

revoke execute on function public.day_summaries(date, date) from public, anon;
grant execute on function public.day_summaries(date, date) to authenticated;
