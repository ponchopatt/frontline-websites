-- pgTAP tests for focus weeks: one business a day, keep-alive minutes, and nobody else's rows.
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('55555555-5555-5555-5555-555555555555', 'f@test.dev', '{"timezone":"Australia/Sydney"}', 'authenticated', 'authenticated'),
  ('66666666-6666-6666-6666-666666666666', 'g@test.dev', '{"timezone":"Australia/Sydney"}', 'authenticated', 'authenticated');

-- 1: the default keep-alive
select is(
  (select keep_alive_minutes from public.profiles where user_id = '55555555-5555-5555-5555-555555555555'),
  '{"imperium": 20, "websites": 20, "trading": 15}'::jsonb,
  'a new user keeps each business alive with 20, 20 and 15 minutes');

set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

-- 2–3: a split week, one business a day
insert into public.focus_days (local_date, area) values ('2026-09-28', 'imperium'), ('2026-09-29', 'imperium'), ('2026-10-01', 'websites');
select is((select count(*)::int from public.focus_days), 3, 'three focus days saved');
select throws_ok(
  $$ insert into public.focus_days (local_date, area) values ('2026-09-28', 'websites') $$,
  '23505', null, 'a day has one focus');

-- 4: only the three businesses
select throws_ok(
  $$ insert into public.focus_days (local_date, area) values ('2026-10-02', 'faith') $$,
  '23514', null, 'faith is not a business to focus on');

-- 5–6: keep-alive minutes stay sensible
select lives_ok(
  $$ update public.profiles set keep_alive_minutes = '{"imperium": 30, "websites": 0, "trading": 10}' where user_id = auth.uid() $$,
  'keep-alive minutes can change, and 0 leaves a business alone');
select throws_ok(
  $$ update public.profiles set keep_alive_minutes = '{"imperium": 500}' where user_id = auth.uid() $$,
  '23514', null, 'but not past four hours a day');

-- 7: another user sees none of it
set local request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';
select is((select count(*)::int from public.focus_days), 0, 'another user sees no focus days');

select * from finish();
rollback;
