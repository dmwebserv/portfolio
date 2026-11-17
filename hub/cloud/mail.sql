-- Run in Supabase SQL Editor. Safe to re-run after the previous mail migration. Mail is separate from workspace JSON/backups.
begin;
create table if not exists public.studio_mail (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 project_id text not null,
 direction text not null check(direction in ('outbound','inbound')),
 recipient text not null,
 subject text not null,
 body text not null check(length(body)<=30000),
 dedupe text not null,
 message_id text,
 status text not null check(status in ('queued','sending','accepted','uncertain','failed','received')),
 detail text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(owner_id,dedupe)
);
create unique index if not exists studio_one_first_contact on public.studio_mail(owner_id,project_id) where direction='outbound' and status <> 'failed';
alter table public.studio_mail add column if not exists html_body text;
alter table public.studio_mail add column if not exists presentation jsonb;
alter table public.studio_mail add column if not exists accepted_at timestamptz;
alter table public.studio_mail add column if not exists gmail_checked_at timestamptz;
alter table public.studio_mail add column if not exists gmail_id text;
alter table public.studio_mail add column if not exists thread_id text;
create table if not exists public.studio_gmail_accounts (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 mailbox text not null,
 token_cipher text not null,
 connected_at timestamptz not null default now(),
 last_sync_at timestamptz
);
alter table public.studio_gmail_accounts enable row level security;
revoke all on public.studio_gmail_accounts from public,anon,authenticated;
grant all on public.studio_gmail_accounts to service_role;
alter table public.studio_mail enable row level security;
revoke all on public.studio_mail from anon,authenticated;
grant select,insert on public.studio_mail to authenticated;
drop policy if exists "Owner reads mail" on public.studio_mail;
create policy "Owner reads mail" on public.studio_mail for select to authenticated
 using(owner_id=auth.uid() and exists(select 1 from public.studio_owners where user_id=auth.uid()));
drop policy if exists "Owner queues approved outbound" on public.studio_mail;
create policy "Owner queues approved outbound" on public.studio_mail for insert to authenticated
 with check(owner_id=auth.uid() and direction='outbound' and status='queued' and message_id is null and exists(select 1 from public.studio_owners where user_id=auth.uid()));
-- Atomic claim: concurrent scheduled/manual jobs cannot send the same row.
create or replace function public.studio_claim_mail(mail_id uuid) returns setof public.studio_mail
language sql security definer set search_path='' as $$
 update public.studio_mail set status='sending',updated_at=now()
 where id=mail_id and status='queued' returning *;
$$;
revoke all on function public.studio_claim_mail(uuid) from public,anon,authenticated;
grant execute on function public.studio_claim_mail(uuid) to service_role;
create or replace function public.studio_cancel_mail(mail_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if not exists(select 1 from public.studio_owners where user_id=auth.uid()) then return false; end if;
 update public.studio_mail set status='failed', detail='Cancelled by owner before worker claim.',updated_at=now()
 where id=mail_id and owner_id=auth.uid() and status='queued';
 get diagnostics n = row_count;
 return n=1;
end;
$$;
revoke all on function public.studio_cancel_mail(uuid) from public,anon;
grant execute on function public.studio_cancel_mail(uuid) to authenticated;
commit;
