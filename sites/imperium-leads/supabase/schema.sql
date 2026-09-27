-- Imperium Leads: one table of JSON documents, the shape the app's db API expects.
-- Paste this into Supabase → SQL Editor → New query → Run. Safe to run again.

create table if not exists public.docs (
  collection text not null,
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

-- Only the shared team login can read or write. Anyone else who signs up (the public key is in
-- the page) is signed in but sees nothing.
alter table public.docs enable row level security;

drop policy if exists "team only" on public.docs;
create policy "team only" on public.docs
  for all to authenticated
  using ((select auth.jwt() ->> 'email') = 'team@imperiumdetailing.com.au')
  with check ((select auth.jwt() ->> 'email') = 'team@imperiumdetailing.com.au');

revoke all on public.docs from anon;
grant select, insert, update, delete on public.docs to authenticated;

-- update(): merge fields into a document in one step (creates it if it isn't there).
create or replace function public.docs_merge(p_collection text, p_id text, p_patch jsonb)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.docs (collection, id, data, updated_at)
  values (p_collection, p_id, p_patch, now())
  on conflict (collection, id)
  do update set data = public.docs.data || excluded.data, updated_at = now();
$$;
revoke execute on function public.docs_merge(text, text, jsonb) from public, anon;
grant execute on function public.docs_merge(text, text, jsonb) to authenticated;

-- Live updates: both phones see a change the moment it's saved.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'docs'
  ) then
    alter publication supabase_realtime add table public.docs;
  end if;
end;
$$;
