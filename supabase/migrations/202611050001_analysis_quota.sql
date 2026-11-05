-- Run once in the Supabase SQL editor. No changes to existing user data tables.
begin;
create table if not exists public.analysis_quota (
  day date not null,
  kind text not null check (kind in ('analyze', 'article')),
  subject text not null,
  used integer not null default 0,
  last_used timestamptz,
  primary key (day, kind, subject)
);
alter table public.analysis_quota enable row level security;
revoke all on public.analysis_quota from public, anon, authenticated;

create or replace function public.consume_analysis_quota(p_user uuid, p_kind text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'UTC')::date;
  v_global integer;
  v_user integer;
  v_last timestamptz;
  v_user_limit integer;
  v_global_limit integer;
  v_cooldown interval;
begin
  if p_user is null or p_kind is null or p_kind not in ('analyze', 'article') then
    raise exception 'Invalid quota request';
  end if;
  v_user_limit := case when p_kind = 'analyze' then 5 else 20 end;
  v_global_limit := case when p_kind = 'analyze' then 100 else 500 end;
  v_cooldown := case when p_kind = 'analyze' then interval '30 seconds' else interval '5 seconds' end;
  -- Fixed lock order: global first, then user. Parallel Vercel instances share it.
  insert into public.analysis_quota(day, kind, subject) values (v_day, p_kind, 'global') on conflict do nothing;
  select used into v_global from public.analysis_quota
    where day = v_day and kind = p_kind and subject = 'global' for update;
  if v_global >= v_global_limit then return false; end if;
  insert into public.analysis_quota(day, kind, subject) values (v_day, p_kind, p_user::text) on conflict do nothing;
  select used, last_used into v_user, v_last from public.analysis_quota
    where day = v_day and kind = p_kind and subject = p_user::text for update;
  if v_user >= v_user_limit or v_last > now() - v_cooldown then return false; end if;
  update public.analysis_quota set used = used + 1, last_used = now()
    where day = v_day and kind = p_kind and subject in ('global', p_user::text);
  return true;
end;
$$;
revoke all on function public.consume_analysis_quota(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_analysis_quota(uuid, text) to service_role;
commit;
-- Optional maintenance: remove quota rows older than 30 days via a scheduled job.
