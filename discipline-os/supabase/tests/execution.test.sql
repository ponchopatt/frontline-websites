-- pgTAP tests for the execution dashboard: counters, tasks, the AI-bot milestone, proof and
-- Keep My Word's day summaries. Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'a@test.dev', '{"timezone":"Australia/Sydney"}', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.dev', '{"timezone":"Australia/Sydney"}', 'authenticated', 'authenticated');

-- 1–4: seeding
select is((select count(*)::int from public.metrics where user_id = '11111111-1111-1111-1111-111111111111'), 19,
  'a new user gets the Imperium, Websites and cardio counters');
select is((select weekly_target::int from public.metrics where user_id = '11111111-1111-1111-1111-111111111111' and area = 'imperium' and key = 'leads_called'), 50,
  'leads called starts at 50 a week');
select is((select array_agg(kind order by kind) from public.habits where user_id = '11111111-1111-1111-1111-111111111111' and kind is not null),
  array['bible', 'cardio', 'evening_prayer', 'gym', 'journal', 'prayer'],
  'the habits the dashboard knows are marked by kind');
select is((select days from public.habits where user_id = '11111111-1111-1111-1111-111111111111' and kind = 'gym'), '{1,2,3,4,5}'::smallint[],
  'Gym is due five days a week');

create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
insert into ids select 'leads', id from public.metrics where user_id = '11111111-1111-1111-1111-111111111111' and key = 'leads_called';

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- 5–7: counters
select lives_ok($$
  insert into public.metric_entries (metric_id, local_date, value)
  select id, public.user_local_today(auth.uid()), 12 from ids where name = 'leads'
$$, 'a counter takes a number for today');
select throws_ok($$
  insert into public.metric_entries (metric_id, local_date, value)
  select id, public.user_local_today(auth.uid()), 3 from ids where name = 'leads'
$$, '23505', null, 'one number per counter per day');
select throws_ok($$
  insert into public.metric_entries (metric_id, local_date, value)
  select id, public.user_local_today(auth.uid()) + 1, 3 from ids where name = 'leads'
$$, '23514', null, 'no numbers for tomorrow');

-- 8–10: tasks
select lives_ok($$
  insert into public.daily_goals (local_date, title, area, metric_id, quantity, rank)
  select public.user_local_today(auth.uid()), 'Call 10 Imperium leads', 'imperium', id, 10, 1 from ids where name = 'leads'
$$, 'a Big 3 task can be tied to a counter');
select lives_ok($$
  insert into public.daily_goals (local_date, title, due_date) values (null, 'Renew insurance', current_date + 30)
$$, 'a task can be parked for later, with no day');
select throws_ok($$
  insert into public.daily_goals (local_date, title, area) values (public.user_local_today(auth.uid()), 'Somewhere', 'mars')
$$, '23514', null, 'a task''s area is one the dashboard knows');

-- 11–12: the AI bot's one current milestone
select lives_ok($$ insert into public.project_milestones (title) values ('TradingView comparison') $$,
  'a milestone starts with the default steps');
select throws_ok($$ insert into public.project_milestones (title) values ('Second at once') $$, '23505', null,
  'only one milestone is current at a time');

-- 13–14: Keep My Word counts
insert into public.habit_completions (habit_id, local_date)
select id, public.user_local_today(auth.uid()) from public.habits where kind in ('bible', 'prayer');
update public.daily_goals set status = 'done' where title = 'Call 10 Imperium leads';
select is(
  (select tasks_total || '/' || tasks_done from public.day_summaries(public.user_local_today(auth.uid()), public.user_local_today(auth.uid()))),
  '1/1',
  'today''s tasks count as commitments; the parked one doesn''t');
select is(
  (select habits_done from public.day_summaries(public.user_local_today(auth.uid()), public.user_local_today(auth.uid()))),
  2,
  'ticked habits count as kept');

-- 15–16: user B sees none of it
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is(
  (select count(*)::int from public.metric_entries) + (select count(*)::int from public.project_milestones) + (select count(*)::int from public.daily_goals),
  0, 'user B sees none of user A''s numbers, milestone or tasks');
select throws_ok($$
  insert into public.metric_entries (metric_id, local_date, value)
  select id, public.user_local_today(auth.uid()) - 1, 1 from ids where name = 'leads'
$$, '23503', null, 'user B can''t write to user A''s counter');

select * from finish();
rollback;
