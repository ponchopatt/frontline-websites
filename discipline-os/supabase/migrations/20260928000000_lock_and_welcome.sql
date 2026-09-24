-- The passcode lock and the first-run setup.

-- ---------------------------------------------------------------------------
-- First-run setup: done once, redone any time from Settings
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column onboarded_at timestamptz,
  -- Mirrors whether app_locks has a row, so a page load only checks the lock when there is one.
  add column passcode_set boolean not null default false;

-- Accounts that already use the app aren't sent through setup.
update public.profiles set onboarded_at = created_at where onboarded_at is null;

-- ---------------------------------------------------------------------------
-- Passcode lock
-- ---------------------------------------------------------------------------
-- A four-digit passcode asked for when the app is opened. It sits on top of the sign-in: it
-- keeps someone holding an unlocked phone out, it doesn't replace the account password.
--
-- The hash, the failed tries and the key that signs unlock tokens live here, where no client
-- can read them (row level security with no policies). Only the functions below touch it.
create table public.app_locks (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  pin_hash      text not null,
  failures      smallint not null default 0,
  blocked_until timestamptz,
  secret        bytea not null default extensions.gen_random_bytes(32),
  updated_at    timestamptz not null default now()
);
alter table public.app_locks enable row level security;
revoke all on public.app_locks from public, anon, authenticated;

-- An unlock token: "<expiry epoch>.<hmac of user and expiry>", good for 12 hours.
create or replace function public.unlock_token(p_user uuid, p_secret bytea)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select e::text || '.' || encode(extensions.hmac(convert_to(p_user::text || '.' || e::text, 'UTF8'), p_secret, 'sha256'), 'hex')
  from (select floor(extract(epoch from now() + interval '12 hours'))::bigint as e) x;
$$;
revoke execute on function public.unlock_token(uuid, bytea) from public, anon, authenticated;

/*
 * Sets (or changes) the passcode. Changing one needs the current one. Returns a fresh unlock
 * token; a new key is made each time, so a change locks every other device.
 */
create or replace function public.set_passcode(p_new text, p_current text default null)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_lock public.app_locks;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  if p_new is null or p_new !~ '^[0-9]{4}$' then
    raise exception 'A passcode is four digits.' using errcode = 'check_violation', hint = 'passcode_format';
  end if;

  select * into v_lock from public.app_locks where user_id = v_user for update;
  if found and (p_current is null or extensions.crypt(p_current, v_lock.pin_hash) <> v_lock.pin_hash) then
    raise exception 'That isn''t your current passcode.' using errcode = 'check_violation', hint = 'passcode_wrong';
  end if;

  insert into public.app_locks (user_id, pin_hash, secret)
  values (v_user, extensions.crypt(p_new, extensions.gen_salt('bf', 8)), extensions.gen_random_bytes(32))
  on conflict (user_id) do update
    set pin_hash = excluded.pin_hash, secret = excluded.secret, failures = 0, blocked_until = null, updated_at = now();
  perform set_config('dos.passcode_change', 'on', true);
  update public.profiles set passcode_set = true where user_id = v_user;
  perform set_config('dos.passcode_change', '', true);

  return public.unlock_token(v_user, (select secret from public.app_locks where user_id = v_user));
end;
$$;

/*
 * Tries the passcode. Returns an unlock token, 'wrong', or 'blocked:<seconds>'. Five wrong
 * tries in a row lock it for a minute, doubling each time after that, up to 15 minutes.
 */
create or replace function public.unlock_app(p_pin text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_lock public.app_locks;
  v_wait integer;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  select * into v_lock from public.app_locks where user_id = v_user for update;
  if not found then
    return 'none';
  end if;
  if v_lock.blocked_until is not null and v_lock.blocked_until > now() then
    return 'blocked:' || ceil(extract(epoch from v_lock.blocked_until - now()))::int;
  end if;
  if p_pin is not null and p_pin ~ '^[0-9]{4}$' and extensions.crypt(p_pin, v_lock.pin_hash) = v_lock.pin_hash then
    update public.app_locks set failures = 0, blocked_until = null where user_id = v_user;
    return public.unlock_token(v_user, v_lock.secret);
  end if;

  update public.app_locks set failures = failures + 1 where user_id = v_user returning * into v_lock;
  if v_lock.failures >= 5 then
    v_wait := least(900, 60 * power(2, v_lock.failures - 5)::int);
    update public.app_locks set blocked_until = now() + make_interval(secs => v_wait) where user_id = v_user;
    return 'blocked:' || v_wait;
  end if;
  return 'wrong';
end;
$$;

/* 'none' with no passcode, 'open' for a valid unexpired token, else 'locked'. */
create or replace function public.lock_state(p_token text)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_secret bytea;
  v_exp bigint;
begin
  if v_user is null then
    return 'locked';
  end if;
  select secret into v_secret from public.app_locks where user_id = v_user;
  if not found then
    return 'none';
  end if;
  if p_token is null or p_token !~ '^[0-9]{1,12}\.[0-9a-f]{64}$' then
    return 'locked';
  end if;
  v_exp := split_part(p_token, '.', 1)::bigint;
  if v_exp < extract(epoch from now()) then
    return 'locked';
  end if;
  if encode(extensions.hmac(convert_to(v_user::text || '.' || v_exp::text, 'UTF8'), v_secret, 'sha256'), 'hex') = split_part(p_token, '.', 2) then
    return 'open';
  end if;
  return 'locked';
end;
$$;

/*
 * Forgot it: after signing in again with the account password (within the last 10 minutes,
 * read from the session's own token), a new passcode can be set without the old one.
 */
create or replace function public.reset_passcode(p_new text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_signed_in bigint;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  select max((a ->> 'timestamp')::bigint) into v_signed_in
  from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
  where a ->> 'method' in ('password', 'otp', 'magiclink', 'oauth');
  if v_signed_in is null or v_signed_in < extract(epoch from now() - interval '10 minutes') then
    raise exception 'Sign in again to reset your passcode.' using errcode = 'check_violation', hint = 'passcode_reauth';
  end if;
  if p_new is null or p_new !~ '^[0-9]{4}$' then
    raise exception 'A passcode is four digits.' using errcode = 'check_violation', hint = 'passcode_format';
  end if;

  insert into public.app_locks (user_id, pin_hash, secret)
  values (v_user, extensions.crypt(p_new, extensions.gen_salt('bf', 8)), extensions.gen_random_bytes(32))
  on conflict (user_id) do update
    set pin_hash = excluded.pin_hash, secret = excluded.secret, failures = 0, blocked_until = null, updated_at = now();
  perform set_config('dos.passcode_change', 'on', true);
  update public.profiles set passcode_set = true where user_id = v_user;
  perform set_config('dos.passcode_change', '', true);
  return public.unlock_token(v_user, (select secret from public.app_locks where user_id = v_user));
end;
$$;

/* Turns the passcode off, with the current one. */
create or replace function public.remove_passcode(p_current text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_lock public.app_locks;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  select * into v_lock from public.app_locks where user_id = v_user for update;
  if not found then
    return;
  end if;
  if p_current is null or extensions.crypt(p_current, v_lock.pin_hash) <> v_lock.pin_hash then
    raise exception 'That isn''t your current passcode.' using errcode = 'check_violation', hint = 'passcode_wrong';
  end if;
  delete from public.app_locks where user_id = v_user;
  perform set_config('dos.passcode_change', 'on', true);
  update public.profiles set passcode_set = false where user_id = v_user;
  perform set_config('dos.passcode_change', '', true);
end;
$$;

revoke execute on function public.set_passcode(text, text) from public, anon;
revoke execute on function public.unlock_app(text) from public, anon;
revoke execute on function public.lock_state(text) from public, anon;
revoke execute on function public.remove_passcode(text) from public, anon;
revoke execute on function public.reset_passcode(text) from public, anon;
grant execute on function public.reset_passcode(text) to authenticated;
grant execute on function public.set_passcode(text, text) to authenticated;
grant execute on function public.unlock_app(text) to authenticated;
grant execute on function public.lock_state(text) to authenticated;
grant execute on function public.remove_passcode(text) to authenticated;

-- passcode_set is only changed by the functions above: an update from anywhere else keeps the
-- old value, so the flag can't be switched off to skip the lock.
create or replace function public.guard_passcode_flag()
returns trigger
language plpgsql
as $$
begin
  if new.passcode_set is distinct from old.passcode_set and coalesce(current_setting('dos.passcode_change', true), '') <> 'on' then
    new.passcode_set := old.passcode_set;
  end if;
  return new;
end;
$$;
create trigger profiles_guard_passcode_flag before update on public.profiles
  for each row execute function public.guard_passcode_flag();
