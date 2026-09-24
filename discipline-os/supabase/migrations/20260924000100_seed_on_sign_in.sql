-- Discipline OS — first sign-in seed
--
-- A new account gets a profile and the default habits the moment it is created, so the
-- dashboard is never empty on first load. The timezone comes from the browser at sign-up
-- (raw_user_meta_data.timezone) when it is a real IANA zone; otherwise Australia/Sydney.
-- ensure_profile() does the same for the signed-in user on demand, and is idempotent, so an
-- account created before this migration (or by an admin) is repaired on its first visit.

-- The sign-up trigger calls user_local_date through a definer function; the session trigger
-- runs as the signed-in user, for whom user_local_date only answers about themselves.
alter function public.work_sessions_set_local_date() security definer;
alter function public.work_sessions_set_local_date() set search_path = public;

create or replace function public.seed_default_habits(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only ever seed an account that has never had habits.
  if exists (select 1 from public.habits where user_id = p_user) then
    return;
  end if;

  insert into public.habits (user_id, name, category, sort_order)
  select p_user, d.name, d.category::public.habit_category, d.sort_order
  from (values
    ('Wake on time',           'morning',    1),
    ('No phone on waking',     'morning',    2),
    ('Shower',                 'morning',    3),
    ('Make bed',               'morning',    4),
    ('Water',                  'morning',    5),
    ('Coffee',                 'morning',    6),
    ('Bible study',            'morning',    7),
    ('Prayer',                 'morning',    8),
    ('Journal',                'morning',    9),
    ('Plan the day',           'morning',   10),
    ('Gym',                    'body',       1),
    ('Cardio',                 'body',       2),
    ('Protein target',         'body',       3),
    ('Water target',           'body',       4),
    ('Sleep target',           'body',       5),
    ('No porn',                'discipline', 1),
    ('No pointless scrolling', 'discipline', 2),
    ('No procrastination',     'discipline', 3),
    ('Kept commitments',       'discipline', 4)
  ) as d (name, category, sort_order);
end;
$$;

create or replace function public.create_profile_for(p_user uuid, p_meta jsonb, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz   text := nullif(btrim(coalesce(p_meta ->> 'timezone', '')), '');
  v_name text := nullif(btrim(coalesce(p_meta ->> 'display_name', '')), '');
begin
  if v_tz is null or not public.is_valid_timezone(v_tz) then
    v_tz := 'Australia/Sydney';
  end if;
  if v_name is null and p_email is not null then
    v_name := split_part(p_email, '@', 1);
  end if;

  insert into public.profiles (user_id, display_name, timezone)
  values (p_user, left(v_name, 60), v_tz)
  on conflict (user_id) do nothing;

  perform public.seed_default_habits(p_user);
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.create_profile_for(new.id, new.raw_user_meta_data, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Called by the app for the signed-in user. Safe to call on every visit.
create or replace function public.ensure_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_meta jsonb;
  v_email text;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.profiles where user_id = v_user)
     and exists (select 1 from public.habits where user_id = v_user) then
    return;
  end if;
  select raw_user_meta_data, email into v_meta, v_email from auth.users where id = v_user;
  perform public.create_profile_for(v_user, coalesce(v_meta, '{}'::jsonb), v_email);
end;
$$;

revoke execute on function public.seed_default_habits(uuid) from public, anon, authenticated;
revoke execute on function public.create_profile_for(uuid, jsonb, text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.ensure_profile() from public, anon;
grant execute on function public.ensure_profile() to authenticated;
