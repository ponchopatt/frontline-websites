-- pgTAP tests for the goal hierarchy. Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'a@test.dev', '{}', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.dev', '{}', 'authenticated', 'authenticated');

select is((select count(*)::int from public.life_areas where user_id = '11111111-1111-1111-1111-111111111111'), 12,
  'a new user gets the twelve areas of life');

create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok($$
  with y as (
    insert into public.yearly_goals (year, title, goal_type, unit, start_value, target_value, life_area_id)
    select 2027, 'Build a $300k business', 'outcome', '$', 0, 300000, id from public.life_areas where key = 'imperium'
    returning id
  ) insert into ids select 'year', id from y
$$, 'user A creates a yearly goal in an area of life');

select lives_ok($$
  with m as (
    insert into public.monthly_goals (month_start, parent_yearly_goal_id, title, unit, target_value)
    select '2027-01-01', id, 'Generate $10k', '$', 10000 from ids where name = 'year' returning id
  ) insert into ids select 'month', id from m
$$, 'a monthly goal hangs under the yearly goal');

select throws_ok($$
  insert into public.monthly_goals (month_start, title) values ('2027-01-15', 'Mid-month')
$$, '23514', null, 'a monthly goal starts on the first of a month');

select lives_ok($$
  with w as (
    insert into public.weekly_goals (week_start, parent_monthly_goal_id, title, unit, target_value)
    select '2027-01-04', id, 'Follow up with leads', 'leads', 30 from ids where name = 'month' returning id
  ) insert into ids select 'week', id from w
$$, 'a weekly goal hangs under the monthly goal');

select throws_ok($$
  insert into public.weekly_goals (week_start, title) values ('2027-01-06', 'Wednesday start')
$$, '23514', null, 'a week starts on a Monday');

select lives_ok($$
  insert into public.daily_goals (local_date, parent_weekly_goal_id, title, quantity, rank)
  select public.local_date_at(now(), 'Australia/Sydney', 4), id, 'Follow up with leads', 15, 1 from ids where name = 'week'
$$, 'a daily action hangs under the weekly goal');

select throws_ok($$
  insert into public.daily_goals (local_date, title, rank)
  values (public.local_date_at(now(), 'Australia/Sydney', 4), 'Another first', 1)
$$, '23505', null, 'there is one #1 a day');

select throws_ok($$
  insert into public.daily_goals (local_date, title)
  values (public.local_date_at(now(), 'Australia/Sydney', 4) + 1, 'Tomorrow')
$$, '23514', null, 'daily actions follow the no-future-days rule');

select throws_ok($$ delete from public.life_areas where name = 'Other' $$, '42501', null,
  'areas of life are hidden, not deleted');

select lives_ok($$
  insert into public.goals (kind, content) values ('becoming', 'A man who keeps his word.')
$$, 'My Life statements are stored');

select lives_ok($$
  insert into public.goal_reviews (period, period_start, weekly_goal_id, outcome)
  select 'week', '2027-01-04', id, 'partial' from ids where name = 'week'
  on conflict (weekly_goal_id) do update set outcome = excluded.outcome;
  insert into public.goal_reviews (period, period_start, weekly_goal_id, outcome)
  select 'week', '2027-01-04', id, 'completed' from ids where name = 'week'
  on conflict (weekly_goal_id) do update set outcome = excluded.outcome;
$$, 'a weekly review can be saved again (upsert on the goal)');

-- User B
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is((select count(*)::int from public.yearly_goals) + (select count(*)::int from public.daily_goals), 0,
  'user B sees none of user A''s goals');

select throws_ok($$
  insert into public.monthly_goals (month_start, parent_yearly_goal_id, title)
  select '2027-02-01', id, 'Hijack' from ids where name = 'year'
$$, '23503', null, 'user B cannot hang a goal under user A''s goal');

select throws_ok($$
  insert into public.goal_dependencies (level, blocker_id, blocked_id)
  select 'weekly', w.id, gen_random_uuid() from ids w where w.name = 'week'
$$, '23503', null, 'dependencies must join two of your own goals');

select * from finish();
rollback;
