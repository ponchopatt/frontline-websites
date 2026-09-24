-- pgTAP tests for the passcode lock. Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('44444444-4444-4444-4444-444444444444', 'd@test.dev', '{"timezone":"Australia/Sydney"}', 'authenticated', 'authenticated'),
  ('55555555-5555-5555-5555-555555555555', 'e@test.dev', '{"timezone":"Australia/Sydney"}', 'authenticated', 'authenticated');

create temp table tokens (name text primary key, token text);
grant select, insert, update on tokens to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

-- 1–2: no passcode yet
select is(public.lock_state(null), 'none', 'with no passcode there is no lock');
select throws_ok($$ select public.set_passcode('12a4') $$, '23514', null, 'a passcode is four digits');

-- 3–5: setting one unlocks this device
insert into tokens values ('first', public.set_passcode('1906'));
select matches((select token from tokens where name = 'first'), '^[0-9]+\.[0-9a-f]{64}$', 'setting it returns an unlock token');
select is(public.lock_state((select token from tokens where name = 'first')), 'open', 'the token opens the app');
select is((select passcode_set from public.profiles), true, 'the profile knows there is a passcode');

-- 6–8: only the right passcode opens it, and a forged token doesn't
select is(public.lock_state('4102444800.' || repeat('a', 64)), 'locked', 'a made-up token stays locked');
select is(public.unlock_app('1111'), 'wrong', 'a wrong passcode is refused');
select matches(public.unlock_app('1906'), '^[0-9]+\.[0-9a-f]{64}$', 'the right passcode opens it');

-- 9: five wrong tries in a row lock it for a minute
select public.unlock_app('0000') from generate_series(1, 4);
select is(public.unlock_app('0000'), 'blocked:60', 'five wrong tries in a row lock it for a minute');

-- 10–11: the lock can't be read or switched off around the functions
select throws_ok($$ select pin_hash from public.app_locks $$, '42501', null, 'the passcode hash is out of reach');
update public.profiles set passcode_set = false;
select is((select passcode_set from public.profiles), true, 'the flag can''t be switched off to skip the lock');

-- 12: changing it needs the current one
select throws_ok($$ select public.set_passcode('2222') $$, '23514', null, 'changing it needs the current passcode');

-- 13–14: forgetting it needs a fresh sign-in
select throws_ok($$ select public.reset_passcode('3333') $$, '23514', null, 'resetting it needs a fresh sign-in');
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated","amr":[{"method":"password","timestamp":9999999999}]}';
select matches(public.reset_passcode('3333'), '^[0-9]+\.[0-9a-f]{64}$', 'after signing in again it can be reset');

-- 15: another user has their own (none)
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
select is(public.lock_state((select token from tokens where name = 'first')), 'none', 'another user''s token means nothing here');

select * from finish();
rollback;
