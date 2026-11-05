-- The counter reads usage through the server's service_role key only.
-- Do not grant SELECT to anon/authenticated or add a public RLS policy.
grant select on table public.analysis_quota to service_role;
