-- Run in Supabase SQL Editor as project owner. No service-role key is used by the app.
begin;
create table if not exists public.studio_owners (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.studio_owners enable row level security;
revoke all on public.studio_owners from anon, authenticated;
grant select on public.studio_owners to authenticated;
drop policy if exists "Owner can see own allowlist entry" on public.studio_owners;
create policy "Owner can see own allowlist entry" on public.studio_owners
for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.studio_workspaces (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  version integer not null default 0 check (version >= 0),
  projects jsonb not null default '[]'::jsonb,
  constraint studio_projects_array check (jsonb_typeof(projects) = 'array'),
  constraint studio_projects_count check (jsonb_array_length(projects) <= 1000),
  constraint studio_projects_size check (octet_length(projects::text) <= 4000000)
);
alter table public.studio_workspaces enable row level security;
revoke all on public.studio_workspaces from anon, authenticated;
grant select, insert, update on public.studio_workspaces to authenticated;
drop policy if exists "Read own approved workspace" on public.studio_workspaces;
create policy "Read own approved workspace" on public.studio_workspaces for select to authenticated
using (owner_id = (select auth.uid()) and exists (select 1 from public.studio_owners where user_id = (select auth.uid())));
drop policy if exists "Create own approved workspace" on public.studio_workspaces;
create policy "Create own approved workspace" on public.studio_workspaces for insert to authenticated
with check (owner_id = (select auth.uid()) and exists (select 1 from public.studio_owners where user_id = (select auth.uid())));
drop policy if exists "Update own approved workspace" on public.studio_workspaces;
create policy "Update own approved workspace" on public.studio_workspaces for update to authenticated
using (owner_id = (select auth.uid()) and exists (select 1 from public.studio_owners where user_id = (select auth.uid())))
with check (owner_id = (select auth.uid()) and exists (select 1 from public.studio_owners where user_id = (select auth.uid())));
commit;

-- AFTER creating your own Auth user in the dashboard, run separately:
-- insert into public.studio_owners(user_id) values ('YOUR-AUTH-USER-UUID');
-- Never allow public clients to insert their own allowlist entry.
