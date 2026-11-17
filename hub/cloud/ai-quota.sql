-- Run once in Supabase SQL Editor. No browser can edit its own quota.
begin;
create table if not exists public.studio_ai_usage (
 owner_id uuid not null references auth.users(id) on delete cascade,
 usage_date date not null default current_date,
 requests integer not null default 0,
 primary key(owner_id,usage_date)
);
alter table public.studio_ai_usage enable row level security;
revoke all on public.studio_ai_usage from anon,authenticated;
create or replace function public.studio_take_ai_credit() returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
 if auth.uid() is null or not exists(select 1 from public.studio_owners where user_id=auth.uid()) then return false; end if;
 insert into public.studio_ai_usage(owner_id,usage_date,requests)
 values(auth.uid(),current_date,1)
 on conflict(owner_id,usage_date) do update set requests=public.studio_ai_usage.requests+1
 where public.studio_ai_usage.requests<20 returning requests into n;
 return n is not null;
end;
$$;
revoke all on function public.studio_take_ai_credit() from public,anon;
grant execute on function public.studio_take_ai_credit() to authenticated;
commit;
-- Failed/aborted model calls still consume a request to prevent retry abuse.
-- A request cap is not an exact monetary cap. Set provider project limits as well.
