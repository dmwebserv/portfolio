-- Small additive migration. No change to existing emails or Gmail connection.
begin;
alter table public.studio_mail add column if not exists html_body text;
alter table public.studio_mail add column if not exists presentation jsonb;
commit;
