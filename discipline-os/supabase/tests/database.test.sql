-- pgTAP tests for the schema's hard rules. Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Two users, created the way GoTrue creates them (the sign-up trigger fires).
insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'a@test.dev', '{"timezone":"Australia/Sydney"}', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.dev', '{"timezone":"Not/AZone"}', 'authenticated', 'authenticated');

-- 1–4: seeding
select is((select count(*)::int from public.habits where user_id = '11111111-1111-1111-1111-111111111111'), 19,
  'a new user is seeded with the 19 default habits');
select is((select timezone from public.profiles where user_id = '11111111-1111-1111-1111-111111111111'), 'Australia/Sydney',
  'the browser timezone from sign-up is stored');
select is((select timezone from public.profiles where user_id = '22222222-2222-2222-2222-222222222222'), 'Australia/Sydney',
  'an invalid sign-up timezone falls back to Australia/Sydney');
select is((select day_start_hour::int from public.profiles where user_id = '11111111-1111-1111-1111-111111111111'), 4,
  'the day starts at 04:00 by default');

-- 5–6: day boundary maths
select is(public.local_date_at('2026-03-10 14:30:00+00', 'Australia/Sydney', 4), '2026-03-10'::date,
  '01:30 Sydney (UTC+11) belongs to the previous day with a 04:00 start');
select is(public.local_date_at('2026-03-10 17:30:00+00', 'Australia/Sydney', 4), '2026-03-11'::date,
  '04:30 Sydney belongs to the new day');

-- User A's habit id, kept for the cross-user test below.
create temp table a_habit as
  select id from public.habits where user_id = '11111111-1111-1111-1111-111111111111' and name = 'Gym';
grant select on a_habit to authenticated;

-- Act as user A.
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- 7: RLS read isolation
select is((select count(*)::int from public.habits), 19, 'user A sees only their own 19 habits');

-- 8–9: completions are idempotent per habit per day
select lives_ok($$
  insert into public.habit_completions (habit_id, local_date)
  select id, public.local_date_at(now(), 'Australia/Sydney', 4) from public.habits where name = 'Shower'
$$, 'user A can tick a habit today');
select throws_ok($$
  insert into public.habit_completions (habit_id, local_date)
  select id, public.local_date_at(now(), 'Australia/Sydney', 4) from public.habits where name = 'Shower'
$$, '23505', null, 'a second tick of the same habit on the same day is rejected');

-- 10: future days are refused
select throws_ok($$
  insert into public.habit_completions (habit_id, local_date)
  select id, public.local_date_at(now(), 'Australia/Sydney', 4) + 1 from public.habits where name = 'Gym'
$$, '23514', 'You can''t log a day that hasn''t started yet.', 'logging tomorrow is refused');

-- 11: backfilling the past is allowed
select lives_ok($$
  insert into public.habit_completions (habit_id, local_date, edited_at)
  select id, public.local_date_at(now(), 'Australia/Sydney', 4) - 1, now() from public.habits where name = 'Gym'
$$, 'backfilling yesterday is allowed');

-- 12: habits cannot be deleted (archive instead)
select throws_ok($$ delete from public.habits where name = 'Coffee' $$, '42501', null,
  'habits cannot be deleted by the user');

-- 13–14: one running work session
select lives_ok($$ insert into public.work_sessions (started_at) values (now()) $$, 'a work session can start');
select throws_ok($$ insert into public.work_sessions (started_at) values (now()) $$, '23505', null,
  'a second running session is refused');

-- 15: the session's local_date comes from started_at, not the client
select is((select local_date from public.work_sessions where ended_at is null),
  public.local_date_at(now(), 'Australia/Sydney', 4), 'a session''s day is derived from its start time');

-- 16–18: completing a day locks it
select lives_ok($$
  insert into public.daily_plans (local_date, final_score, completed_at)
  values (public.local_date_at(now(), 'Australia/Sydney', 4) - 1, 80, now())
$$, 'yesterday can be completed');
select throws_ok($$
  delete from public.habit_completions where local_date = public.local_date_at(now(), 'Australia/Sydney', 4) - 1
$$, '23514', 'This day is completed. Reopen it to make changes.', 'a completed day cannot be edited');
select lives_ok($$
  update public.daily_plans set completed_at = null, final_score = null
  where local_date = public.local_date_at(now(), 'Australia/Sydney', 4) - 1
$$, 'a completed day can be reopened');

-- 19: completing tomorrow is refused
select throws_ok($$
  insert into public.daily_plans (local_date, final_score, completed_at)
  values (public.local_date_at(now(), 'Australia/Sydney', 4) + 1, 80, now())
$$, '23514', null, 'tomorrow cannot be completed');

-- Act as user B.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

-- 20–22: user B sees none of user A's data
select is((select count(*)::int from public.habit_completions), 0, 'user B sees none of user A''s completions');
select is((select count(*)::int from public.work_sessions), 0, 'user B sees none of user A''s sessions');
select is((select count(*)::int from public.profiles), 1, 'user B sees only their own profile');

-- 23: user B cannot attach a completion to user A's habit, even knowing its id
select throws_ok($$
  insert into public.habit_completions (habit_id, local_date)
  select id, current_date - 2 from a_habit
$$, '23503', null, 'user B cannot tick user A''s habit, even knowing its id');

-- 24: user B cannot write rows as user A
select throws_ok($$
  insert into public.commitments (user_id, local_date, text)
  values ('11111111-1111-1111-1111-111111111111', current_date - 2, 'sneaky')
$$, '42501', null, 'user B cannot insert rows for user A');

select * from finish();
rollback;
