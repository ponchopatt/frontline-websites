-- Fixes from the final audit: a measured "keep my word" goal, carried goals that keep their
-- counter, a lock that can't be reset without asking, a capped lockout wait, and a local-date
-- helper that only answers for the caller.

-- ---------------------------------------------------------------------------
-- Goals: "Keep my word on 85% of days" is measured from the days themselves
-- ---------------------------------------------------------------------------
alter type public.progress_source add value if not exists 'keep_word';

-- ---------------------------------------------------------------------------
-- A weekly goal carried forward keeps the counter that measures it
-- ---------------------------------------------------------------------------
update public.weekly_goals c
set metric_id = p.metric_id
from public.weekly_goals p
where c.carried_from_id = p.id
  and c.progress_source = 'metric'
  and c.metric_id is null
  and p.metric_id is not null;

-- ---------------------------------------------------------------------------
-- The local-date helper answers only for the signed-in user (or for triggers and jobs, which
-- run without one). Triggers pass new.user_id, which row level security already ties to them.
-- ---------------------------------------------------------------------------
create or replace function public.user_local_date(p_user uuid, ts timestamptz)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select public.local_date_at(ts, p.timezone, p.day_start_hour)
  from public.profiles p
  where p.user_id = p_user
    and (auth.uid() is null or p_user = (select auth.uid()));
$$;
revoke execute on function public.user_local_date(uuid, timestamptz) from public, anon;

-- ---------------------------------------------------------------------------
-- Passcode: the lockout wait tops out at 15 minutes however many wrong tries
-- ---------------------------------------------------------------------------
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

  update public.app_locks set failures = least(failures + 1, 1000) where user_id = v_user returning * into v_lock;
  if v_lock.failures >= 5 then
    -- 1, 2, 4, 8, then 15 minutes. The exponent is capped before anything is cast to an integer.
    v_wait := least(900, 60 * power(2, least(v_lock.failures - 5, 4)))::int;
    update public.app_locks set blocked_until = now() + make_interval(secs => v_wait) where user_id = v_user;
    return 'blocked:' || v_wait;
  end if;
  return 'wrong';
end;
$$;

-- ---------------------------------------------------------------------------
-- Passcode: a forgotten one is replaced only after asking for it and then signing in again
-- ---------------------------------------------------------------------------
-- A sign-in on its own isn't enough: the one made just before setting a passcode would
-- otherwise let anyone holding the phone choose a new one for the next 10 minutes.
alter table public.app_locks add column reset_requested_at timestamptz;

/* "Forgot your passcode?": noted before signing out, so the next sign-in can replace it. */
create or replace function public.request_passcode_reset()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  update public.app_locks set reset_requested_at = now() where user_id = auth.uid();
end;
$$;

/*
 * True when this session may choose a new passcode without the old one: a sign-in in the last
 * 10 minutes that came after a reset was asked for and after the passcode was last set.
 */
create or replace function public.can_reset_passcode()
returns boolean
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_signed_in bigint;
  v_lock public.app_locks;
begin
  if v_user is null then
    return false;
  end if;
  select max((a ->> 'timestamp')::bigint) into v_signed_in
  from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
  where a ->> 'method' in ('password', 'otp', 'magiclink', 'oauth');
  if v_signed_in is null or v_signed_in < extract(epoch from now() - interval '10 minutes') then
    return false;
  end if;
  select * into v_lock from public.app_locks where user_id = v_user;
  if not found then
    return true;
  end if;
  return v_lock.reset_requested_at is not null
    and v_signed_in > floor(extract(epoch from v_lock.reset_requested_at))
    and v_signed_in > floor(extract(epoch from v_lock.updated_at));
end;
$$;

create or replace function public.reset_passcode(p_new text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  if not public.can_reset_passcode() then
    raise exception 'Sign in again to reset your passcode.' using errcode = 'check_violation', hint = 'passcode_reauth';
  end if;
  if p_new is null or p_new !~ '^[0-9]{4}$' then
    raise exception 'A passcode is four digits.' using errcode = 'check_violation', hint = 'passcode_format';
  end if;

  insert into public.app_locks (user_id, pin_hash, secret)
  values (v_user, extensions.crypt(p_new, extensions.gen_salt('bf', 8)), extensions.gen_random_bytes(32))
  on conflict (user_id) do update
    set pin_hash = excluded.pin_hash, secret = excluded.secret, failures = 0, blocked_until = null,
        reset_requested_at = null, updated_at = now();
  perform set_config('dos.passcode_change', 'on', true);
  update public.profiles set passcode_set = true where user_id = v_user;
  perform set_config('dos.passcode_change', '', true);
  return public.unlock_token(v_user, (select secret from public.app_locks where user_id = v_user));
end;
$$;

-- A change with the current passcode also clears any reset that was asked for.
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
    set pin_hash = excluded.pin_hash, secret = excluded.secret, failures = 0, blocked_until = null,
        reset_requested_at = null, updated_at = now();
  perform set_config('dos.passcode_change', 'on', true);
  update public.profiles set passcode_set = true where user_id = v_user;
  perform set_config('dos.passcode_change', '', true);

  return public.unlock_token(v_user, (select secret from public.app_locks where user_id = v_user));
end;
$$;

revoke execute on function public.request_passcode_reset() from public, anon;
revoke execute on function public.can_reset_passcode() from public, anon;
grant execute on function public.request_passcode_reset() to authenticated;
grant execute on function public.can_reset_passcode() to authenticated;
