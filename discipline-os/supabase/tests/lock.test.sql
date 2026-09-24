-- pgTAP tests for the passcode lock. Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('44444444-4444-4444-4444-444444444444', 'd@test.dev', '{"timezone":"Australia/Sydney"}', 'authenticated', 'authenticated'),
  ('55555555-5555-5555-5555-555555555555', 'e@test.dev', '{"timezone":"Australia/Sydney"}', 'authenticated', 'authenticated');

create temp table tokens (name text primary key, token text);
grant select, insert, update on tokens to authenticated;

-- A session's claims, signed in `ago` before now (null: no sign-in method at all).
create function pg_temp.claims(p_user uuid, ago interval) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', p_user, 'role', 'authenticated',
    'amr', case when ago is null then '[]'::json
                else json_build_array(json_build_object('method', 'password', 'timestamp', floor(extract(epoch from now() - ago))::bigint)) end
  )::text, true);
$$;

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

-- 10–11: the wait doubles, then stays at 15 minutes however many wrong tries
reset role;
update public.app_locks set blocked_until = null where user_id = '44444444-4444-4444-4444-444444444444';
set local role authenticated;
select is(public.unlock_app('0000'), 'blocked:120', 'the next wrong try waits two minutes');
reset role;
update public.app_locks set failures = 60, blocked_until = null where user_id = '44444444-4444-4444-4444-444444444444';
set local role authenticated;
select is(public.unlock_app('0000'), 'blocked:900', 'the wait tops out at 15 minutes');
reset role;
update public.app_locks set failures = 0, blocked_until = null where user_id = '44444444-4444-4444-4444-444444444444';
set local role authenticated;

-- 12–13: the lock can't be read or switched off around the functions
select throws_ok($$ select pin_hash from public.app_locks $$, '42501', null, 'the passcode hash is out of reach');
update public.profiles set passcode_set = false;
select is((select passcode_set from public.profiles), true, 'the flag can''t be switched off to skip the lock');

-- 14: changing it needs the current one
select throws_ok($$ select public.set_passcode('2222') $$, '23514', null, 'changing it needs the current passcode');

-- 15–17: a fresh sign-in alone can't replace it, not even the one made just before setting it
select throws_ok($$ select public.reset_passcode('3333') $$, '23514', null, 'resetting it needs a sign-in');
select pg_temp.claims('44444444-4444-4444-4444-444444444444', interval '-1 second');
select is(public.can_reset_passcode(), false, 'a fresh sign-in without asking for a reset can''t replace it');
select throws_ok($$ select public.reset_passcode('3333') $$, '23514', null, 'so the reset is refused');

-- 18–20: asking, then signing in again, allows one reset
select public.request_passcode_reset();
select is(public.can_reset_passcode(), true, 'after asking and signing in again it can be replaced');
insert into tokens values ('reset', public.reset_passcode('3333'));
select is(public.lock_state((select token from tokens where name = 'reset')), 'open', 'the new passcode opens it');
select throws_ok($$ select public.reset_passcode('4444') $$, '23514', null, 'one request allows one reset');

-- 21: a sign-in older than 10 minutes is too old, even after asking
reset role;
update public.app_locks set reset_requested_at = now() - interval '20 minutes' where user_id = '44444444-4444-4444-4444-444444444444';
set local role authenticated;
select pg_temp.claims('44444444-4444-4444-4444-444444444444', interval '11 minutes');
select throws_ok($$ select public.reset_passcode('4444') $$, '23514', null, 'a sign-in 11 minutes ago is too old');

-- 22–23: a change with the current passcode locks every other device
insert into tokens values ('changed', public.set_passcode('4444', '3333'));
select is(public.lock_state((select token from tokens where name = 'reset')), 'locked', 'the old token no longer opens it');
select is(public.lock_state((select token from tokens where name = 'changed')), 'open', 'the new token does');

-- 24–25: turning it off needs the current one
select throws_ok($$ select public.remove_passcode('3333') $$, '23514', null, 'turning it off needs the current passcode');
select public.remove_passcode('4444');
select is(public.lock_state(null), 'none', 'the current one turns it off');

-- 26–27: another user has their own (none), and can't read someone else's local date
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
select is(public.lock_state((select token from tokens where name = 'first')), 'none', 'another user''s token means nothing here');
select is(public.user_local_today('44444444-4444-4444-4444-444444444444'), null, 'another user''s local date is not shown');

select * from finish();
rollback;
