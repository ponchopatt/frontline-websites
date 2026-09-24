-- pgTAP tests for the daily feedback loop: Minimum Day and proof topics.
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values ('33333333-3333-3333-3333-333333333333', 'c@test.dev', '{"timezone":"Australia/Sydney"}', 'authenticated', 'authenticated');

-- 1–2: the defaults
select is(
  (select array_agg(name order by name) from public.habits where user_id = '33333333-3333-3333-3333-333333333333' and minimum),
  array['Bible', 'Journal', 'Pray', 'Shower', 'Sleep target'],
  'a new user''s minimum day is Bible, Journal, Pray, Shower and Sleep');
select is(
  (select minimum_work_minutes || '/' || minimum_fitness from public.profiles where user_id = '33333333-3333-3333-3333-333333333333'),
  '20/true',
  'plus 20 minutes of focused work and the gym or cardio');

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

create temp view today_row as
  select * from public.day_summaries(public.user_local_today(auth.uid()), public.user_local_today(auth.uid()));

-- 3–4: counted, but off until switched on
select is((select minimum_total from today_row), 7, 'seven minimum-day items: five habits, work, fitness');
select is((select minimum_on from today_row), false, 'Minimum Day is off until switched on');

-- 5–7: switched on, then items ticked
insert into public.daily_plans (local_date, minimum_at) values (public.user_local_today(auth.uid()), now());
select is((select minimum_on from today_row), true, 'switching it on is stored for the day');
insert into public.habit_completions (habit_id, local_date)
select id, public.user_local_today(auth.uid()) from public.habits where kind in ('bible', 'cardio');
select is((select minimum_done from today_row), 2, 'Bible counts, and cardio counts as the fitness item');
select is(
  (select habits_total from today_row) > (select minimum_total from today_row),
  true,
  'Keep My Word still counts the whole day');

-- 8–9: proof topics
select lives_ok($$
  insert into public.proof_uploads (local_date, storage_path)
  values (public.user_local_today(auth.uid()), auth.uid() || '/x.jpg')
$$, 'a photo with no topic is filed under other');
select throws_ok($$
  insert into public.proof_uploads (local_date, storage_path, topic)
  values (public.user_local_today(auth.uid()), auth.uid() || '/y.jpg', 'mars')
$$, '23514', null, 'a proof topic is one the wall knows');

select * from finish();
rollback;
