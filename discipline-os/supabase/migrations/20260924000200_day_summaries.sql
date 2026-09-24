-- Discipline OS — per-day summaries for history, streaks and the 30-day view.
--
-- Counts only. The weighting (and the redistribution rule for empty categories) lives in one
-- place, src/lib/score.ts, and is applied to these counts, so the dashboard's live score and
-- every historical score come from the same code.
--
-- A habit counts towards a day when it existed on that day: created on or before it, and not
-- archived on or before it. Adding a habit today does not rewrite last week; archiving one does
-- not erase it from the days it was used.

create or replace function public.day_summaries(p_from date, p_to date)
returns table (
  local_date       date,
  morning_total    integer,
  morning_done     integer,
  body_total       integer,
  body_done        integer,
  discipline_total integer,
  discipline_done  integer,
  god_total        integer,
  god_done         integer,
  bible_done       integer,
  review_filled    integer,
  work_minutes     numeric,
  final_score      smallint,
  completed_at     timestamptz
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
      h.category,
      public.local_date_at(h.created_at, prof.tz, prof.h) as from_date,
      case when h.archived_at is null then null
           else public.local_date_at(h.archived_at, prof.tz, prof.h) end as to_date
    from public.habits h
    cross join prof
    where h.user_id = auth.uid()
  ),
  active as (
    select d.local_date, hab.id as habit_id, hab.category
    from days d
    join hab on hab.from_date <= d.local_date and (hab.to_date is null or hab.to_date > d.local_date)
  ),
  done as (
    select a.local_date, a.category, count(c.id)::int as n_done, count(*)::int as n_total
    from active a
    left join public.habit_completions c
      on c.habit_id = a.habit_id and c.local_date = a.local_date and c.user_id = auth.uid()
    group by a.local_date, a.category
  ),
  bible as (
    select
      r.local_date,
      (r.is_completed::int
        + coalesce(e.soap_done::int, 0)
        + coalesce(e.prayer_done::int, 0)
        + coalesce(e.application_done::int, 0)) as n_done
    from public.bible_readings r
    left join public.bible_entries e on e.reading_id = r.id
    where r.user_id = auth.uid() and r.local_date between p_from and p_to
  ),
  review as (
    select
      v.local_date,
      ((nullif(btrim(coalesce(v.accomplished, '')), '') is not null)::int
       + (nullif(btrim(coalesce(v.wasted_time_on, '')), '') is not null)::int
       + (nullif(btrim(coalesce(v.broke_word_where, '')), '') is not null)::int
       + (nullif(btrim(coalesce(v.sought_god, '')), '') is not null)::int
       + (nullif(btrim(coalesce(v.grateful_for, '')), '') is not null)::int
       + (nullif(btrim(coalesce(v.tomorrow_priority, '')), '') is not null)::int) as n_filled
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
    coalesce(max(dn.n_total) filter (where dn.category = 'morning'), 0),
    coalesce(max(dn.n_done)  filter (where dn.category = 'morning'), 0),
    coalesce(max(dn.n_total) filter (where dn.category = 'body'), 0),
    coalesce(max(dn.n_done)  filter (where dn.category = 'body'), 0),
    coalesce(max(dn.n_total) filter (where dn.category = 'discipline'), 0),
    coalesce(max(dn.n_done)  filter (where dn.category = 'discipline'), 0),
    coalesce(max(dn.n_total) filter (where dn.category = 'god'), 0),
    coalesce(max(dn.n_done)  filter (where dn.category = 'god'), 0),
    coalesce(max(b.n_done), 0),
    coalesce(max(rv.n_filled), 0),
    coalesce(max(w.minutes), 0),
    max(pl.final_score),
    max(pl.completed_at)
  from days d
  left join done dn on dn.local_date = d.local_date
  left join bible b on b.local_date = d.local_date
  left join review rv on rv.local_date = d.local_date
  left join work w on w.local_date = d.local_date
  left join public.daily_plans pl on pl.local_date = d.local_date and pl.user_id = auth.uid()
  group by d.local_date
  order by d.local_date;
$$;

revoke execute on function public.day_summaries(date, date) from public, anon;
grant execute on function public.day_summaries(date, date) to authenticated;
