-- ============================================================================
-- SPN-UNIFY-001 — TateSpun cloud project limit follows the SpunTales portal plan
-- ============================================================================
-- TARGET project : vjgxrqgnbgnewfvissgd (SpunTales portal; TateSpun moves here)
-- NOT auto-applied. Run in that project's SQL editor only after なつお's OK.
--
-- Before: the limit came from public.user_plans (TateSpun-only, always empty).
-- After : it comes from public.profiles.plan_tier, the plan the portal's Stripe
--         webhook writes. free -> 'resident' (15), light -> 30, unlimited -> none.
--
-- Also (from 20260912000000_*): projects.updated_at is set by the database on
-- every update, as it already is in the old project.
--
-- public.user_plans is left in place (unused) so a rollback only needs the
-- previous function body (20260903000000_tatespun_into_spuntales.sql §3).
-- One transaction: it fully applies or fully rolls back.
-- ============================================================================

begin;

create or replace function public.enforce_cloud_project_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_limit integer;
  v_count integer;
begin
  -- Same guard as before: only self-service inserts are limited (see
  -- 20260809000000_cloud_project_limits.sql for why).
  if NEW.user_id is distinct from auth.uid() then
    return NEW;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));

  select case pr.plan_tier
           when 'light' then 'light'
           when 'unlimited' then 'unlimited'
           else 'resident'
         end
    into v_plan
  from public.profiles pr
  where pr.id = NEW.user_id;

  if v_plan is null then
    v_plan := 'resident';
  end if;

  v_limit := public.cloud_project_limit_for_plan(v_plan);

  if v_limit is not null then
    select count(*) into v_count
    from public.projects p
    where p.user_id = NEW.user_id;

    if v_count >= v_limit then
      raise exception 'cloud_project_limit_reached'
        using errcode = 'P0001';
    end if;
  end if;

  return NEW;
end;
$$;

revoke execute on function public.enforce_cloud_project_limit() from public;
revoke execute on function public.enforce_cloud_project_limit() from anon;
revoke execute on function public.enforce_cloud_project_limit() from authenticated;

create or replace function public.tatespun_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.tatespun_set_updated_at() from public;
revoke execute on function public.tatespun_set_updated_at() from anon;
revoke execute on function public.tatespun_set_updated_at() from authenticated;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.tatespun_set_updated_at();

commit;
