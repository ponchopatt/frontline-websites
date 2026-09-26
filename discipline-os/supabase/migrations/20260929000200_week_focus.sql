-- Focus weeks: one business gets the deep work on a day, the others a short keep-alive.
-- A week is chosen as a whole or split (Imperium Monday to Wednesday, Websites after), so the
-- choice is stored per day. Keep-alive minutes are the owner's, one number per business.

-- ---------------------------------------------------------------------------
-- The business in focus on each day that has one
-- ---------------------------------------------------------------------------
create table public.focus_days (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  local_date date not null,
  area       text not null check (area in ('imperium', 'websites', 'trading')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

create trigger focus_days_set_updated_at before update on public.focus_days
  for each row execute function public.set_updated_at();

alter table public.focus_days enable row level security;
create policy "own rows: select" on public.focus_days for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.focus_days for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.focus_days for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows: delete" on public.focus_days for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.focus_days from anon;
grant select, insert, update, delete on public.focus_days to authenticated;

-- ---------------------------------------------------------------------------
-- Minutes a day each business keeps getting while another has the focus (0: none)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column keep_alive_minutes jsonb not null default '{"imperium": 20, "websites": 20, "trading": 15}'::jsonb;

create function public.valid_keep_alive(v jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select jsonb_typeof(v) = 'object'
    and not exists (
      select 1 from jsonb_each(v) e
      where e.key not in ('imperium', 'websites', 'trading')
         or jsonb_typeof(e.value) <> 'number'
         or (e.value)::numeric < 0
         or (e.value)::numeric > 240
    );
$$;

alter table public.profiles
  add constraint profiles_keep_alive_minutes_shape check (public.valid_keep_alive(keep_alive_minutes));
