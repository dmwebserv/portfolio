-- Run once in Supabase SQL Editor after mail.sql. Preserves existing messages and receipts.
begin;
alter table public.studio_mail drop constraint if exists studio_mail_status_check;
alter table public.studio_mail add constraint studio_mail_status_check check(status in ('queued','sending','accepted','uncertain','failed','received','bounced'));
alter table public.studio_mail add column if not exists resend_of uuid references public.studio_mail(id);
alter table public.studio_mail add column if not exists bounce_reason text;
alter table public.studio_mail add column if not exists bounced_at timestamptz;
drop index if exists public.studio_one_first_contact;
create unique index studio_one_first_contact on public.studio_mail(owner_id,project_id) where direction='outbound' and status not in ('failed','bounced');
-- One replacement per bounced message unless that replacement failed/cancelled/bounced too.
create unique index if not exists studio_one_active_resend on public.studio_mail(owner_id,resend_of) where resend_of is not null and direction='outbound' and status not in ('failed','bounced');
create or replace function public.studio_record_bounce(mail_id uuid,reason text) returns boolean
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if not exists(select 1 from public.studio_owners where user_id=auth.uid()) then return false; end if;
 if reason is null or length(trim(reason))<10 or length(reason)>4000 then return false; end if;
 update public.studio_mail set status='bounced',bounce_reason=trim(reason),bounced_at=now(),updated_at=now()
 where id=mail_id and owner_id=auth.uid() and direction='outbound' and status='accepted';
 get diagnostics n = row_count;
 return n=1;
end;
$$;
revoke all on function public.studio_record_bounce(uuid,text) from public,anon;
grant execute on function public.studio_record_bounce(uuid,text) to authenticated;
-- Definer helper avoids a recursive RLS self-query while restricting lookups to the caller.
create or replace function public.studio_valid_resend(parent_id uuid,project text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.studio_mail p where p.id=parent_id and p.owner_id=auth.uid() and p.project_id=project and p.direction='outbound' and p.status='bounced');
$$;
revoke all on function public.studio_valid_resend(uuid,text) from public,anon;
grant execute on function public.studio_valid_resend(uuid,text) to authenticated;
drop policy if exists "Owner queues approved outbound" on public.studio_mail;
create policy "Owner queues approved outbound" on public.studio_mail for insert to authenticated
 with check(owner_id=auth.uid() and direction='outbound' and status='queued' and message_id is null
 and exists(select 1 from public.studio_owners where user_id=auth.uid())
 and (resend_of is null or public.studio_valid_resend(resend_of,project_id)));
commit;
-- Make the new RPC visible to Supabase/PostgREST without waiting for cache refresh.
notify pgrst, 'reload schema';
