-- ============================================================================
-- TateSpun: cloud project count limits (Resident / Light / Unlimited)
-- ============================================================================
-- This file is NOT auto-applied by any tooling in this repo (there is no
-- Supabase CLI / migration runner wired up here). Run it manually in the
-- Supabase SQL editor after review. Nothing in this repo executes it for you.
--
-- Scope:
--   1. Creates public.user_plans (plan storage; a MISSING row for a
--      logged-in user means "resident" -- see AGENTS/CLAUDE instructions
--      for this feature).
--   2. Enables RLS on user_plans: authenticated users may SELECT their own
--      row only. No INSERT/UPDATE/DELETE policy is defined for
--      `authenticated`, so those commands are denied by RLS entirely.
--      Table-level GRANT/REVOKE is set explicitly for all three roles (not
--      left to the project's default privileges): anon gets nothing,
--      authenticated gets SELECT only, service_role gets
--      SELECT/INSERT/UPDATE/DELETE (service_role also bypasses RLS by
--      default in Supabase, so this grant is what actually lets it write --
--      this is intentional, reserved for a future server-side Stripe
--      webhook that upserts plan rows).
--   3. Adds an index on public.projects(user_id).
--   4. Adds a BEFORE INSERT (row-level) trigger on public.projects that
--      enforces the per-plan cloud project count limit, using a per-user
--      transaction-scoped advisory lock to close the race-condition window
--      between two concurrent inserts (e.g. two browser tabs). The trigger
--      function is a no-op unless NEW.user_id matches the caller's own
--      auth.uid() -- see the comment inside the function for why.
--   5. Both new functions have EXECUTE explicitly revoked from
--      public/anon/authenticated: they are only ever meant to run as part
--      of the trigger, never as a directly-callable RPC.
--
-- Explicitly NOT touched:
--   - The 4 existing RLS policies on public.projects (select/insert/update/
--     delete, all `auth.uid() = user_id`) are left completely untouched.
--   - No grants on public.projects are changed.
--   - No UPDATE trigger / limit is added -- editing an existing project is
--     always allowed regardless of count, by construction (this trigger
--     only fires BEFORE INSERT).
--   - No data is deleted, no table is dropped, no TRUNCATE is issued.
--
-- Re-run safety: written to be safe to re-run against the same database
-- (CREATE TABLE/INDEX ... IF NOT EXISTS, CREATE OR REPLACE FUNCTION, DROP
-- POLICY/TRIGGER IF EXISTS + CREATE). Re-running will not delete data, but
-- note CREATE TABLE IF NOT EXISTS will NOT retroactively change the CHECK
-- constraint if the table already exists with a different one.
--
-- Everything below runs as a single transaction (begin ... commit): all DDL
-- in this file (CREATE TABLE/INDEX/POLICY/FUNCTION/TRIGGER, GRANT/REVOKE)
-- is transactional in PostgreSQL, so wrapping it this way means there is no
-- moment where, e.g., the functions/trigger exist but the REVOKEs have not
-- run yet, and a failure partway through leaves no partially-applied state
-- behind -- the whole file either fully applies or fully rolls back.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. user_plans table
-- ----------------------------------------------------------------------------
create table if not exists public.user_plans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null check (plan in ('resident', 'light', 'unlimited')),
  updated_at timestamptz not null default now()
);

comment on table public.user_plans is
  'Cloud plan per user. Absence of a row for a logged-in user means "resident" (free, logged-in). Rows are only expected to be written by service_role (future Stripe webhook) -- see RLS policies on this table.';

alter table public.user_plans enable row level security;

-- Authenticated users may read only their own plan row.
drop policy if exists "user_plans_select_own" on public.user_plans;
create policy "user_plans_select_own"
  on public.user_plans
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Intentionally no insert/update/delete policy for `authenticated`: with RLS
-- enabled and no policy defined for those commands, they are denied outright
-- for that role. Only service_role (bypasses RLS by default in Supabase) can
-- write to this table -- reserved for a future server-side Stripe webhook
-- that upserts { user_id, plan: 'light' | 'unlimited' } after a subscription
-- event. No such webhook exists yet; this migration only prepares the table.

-- Table-level privileges, set explicitly for every role rather than relying
-- on the project's `alter default privileges` configuration (which may or
-- may not grant table access to anon/authenticated/service_role on new
-- tables):
--   - anon: no access to this table at all.
--   - authenticated: SELECT only. INSERT/UPDATE/DELETE are revoked at the
--     grant level in addition to being denied by RLS above (defense in
--     depth -- RLS alone is already sufficient, this just removes any
--     dependency on that being the only line of defense).
--   - service_role: SELECT/INSERT/UPDATE/DELETE, granted explicitly. This
--     is the intended write path for a future server-side Stripe webhook
--     to upsert { user_id, plan: 'light' | 'unlimited' }. service_role also
--     bypasses RLS by default in Supabase, so without RLS to fall back on,
--     this explicit grant is what actually authorizes those writes -- it
--     is deliberately not left implicit.
revoke all on public.user_plans from public;
revoke all on public.user_plans from anon;
revoke all on public.user_plans from authenticated;
revoke all on public.user_plans from service_role;
grant select on public.user_plans to authenticated;
grant select, insert, update, delete on public.user_plans to service_role;


-- ----------------------------------------------------------------------------
-- 2. index on public.projects(user_id)
-- ----------------------------------------------------------------------------
create index if not exists projects_user_id_idx on public.projects (user_id);


-- ----------------------------------------------------------------------------
-- 3. plan -> cloud project insert limit mapping
-- ----------------------------------------------------------------------------
create or replace function public.cloud_project_limit_for_plan(p_plan text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_plan
    when 'resident' then 15
    when 'light' then 30
    when 'unlimited' then null
    else 15
  end;
$$;

comment on function public.cloud_project_limit_for_plan(text) is
  'Max number of cloud projects a plan may INSERT (create). NULL means unlimited. Unknown plan text falls back to the resident limit.';

-- PostgreSQL grants EXECUTE to PUBLIC by default on new functions, which
-- Supabase's PostgREST layer would otherwise expose as a callable RPC
-- endpoint. This function is only ever meant to be called internally by
-- enforce_cloud_project_limit() below (which, as the owner of this
-- function, keeps implicit EXECUTE rights regardless of this revoke).
revoke execute on function public.cloud_project_limit_for_plan(text) from public;
revoke execute on function public.cloud_project_limit_for_plan(text) from anon;
revoke execute on function public.cloud_project_limit_for_plan(text) from authenticated;


-- ----------------------------------------------------------------------------
-- 4. BEFORE INSERT trigger: enforce cloud project count limit per user
-- ----------------------------------------------------------------------------
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
  -- BEFORE ROW triggers run before the projects INSERT policy's WITH CHECK
  -- (auth.uid() = user_id) is evaluated. Without this guard, a crafted
  -- request from an ordinary authenticated session that sets NEW.user_id to
  -- someone else's id would still make it this far, letting this function
  -- read that other user's plan, count their projects, and take an
  -- advisory lock keyed to their id -- all before RLS gets a chance to
  -- reject the row. The eventual RLS rejection would also be
  -- distinguishable from a "cloud_project_limit_reached" rejection, which
  -- would leak whether an arbitrary user_id has reached their plan's limit.
  --
  -- So: if this row's user_id does not match the calling session's own
  -- auth.uid(), skip straight past all of the above (no plan lookup, no
  -- count, no lock) and return the row unchanged. What happens next
  -- depends entirely on who is calling:
  --   - An ordinary `authenticated` session with a spoofed user_id: this
  --     trigger becomes a no-op, and the existing projects INSERT RLS
  --     policy (auth.uid() = user_id) is left as the sole decision maker --
  --     it rejects the row, exactly as if this trigger did not exist. The
  --     cloud limit is still fully enforced for every real self-service
  --     insert, because in that path NEW.user_id always equals auth.uid().
  --   - service_role (or any other trusted server-side path): auth.uid()
  --     is NULL in that context, so this guard is also true and the cloud
  --     limit trigger is skipped. This is intentional, not an oversight:
  --     service_role already bypasses RLS entirely by default in Supabase
  --     (unlike the authenticated case above, there is no RLS policy left
  --     to fall back on), so a service_role insert into public.projects is
  --     a fully trusted administrative path that bypasses both RLS and the
  --     cloud project limit. No such path exists in this app today; this
  --     just documents the behavior should one be added later.
  if NEW.user_id is distinct from auth.uid() then
    return NEW;
  end if;

  -- Serialize concurrent new-project inserts for the same user for the rest
  -- of this transaction, so two simultaneous inserts (e.g. two browser tabs)
  -- cannot both read the same "count so far" and both pass the check below.
  -- hashtextextended() deterministically maps the user_id to a single
  -- bigint lock key; pg_advisory_xact_lock() auto-releases at transaction
  -- end (commit or rollback), so no explicit unlock is required.
  perform pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));

  select up.plan into v_plan
  from public.user_plans up
  where up.user_id = NEW.user_id;

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

comment on function public.enforce_cloud_project_limit() is
  'BEFORE INSERT trigger on public.projects. Blocks a new row once the owning user has reached their plan''s cloud project limit. Only ever fires on INSERT, never on UPDATE, so editing/overwriting an existing project is always allowed regardless of count.';

-- Belt-and-suspenders: a function returning `trigger` can never be invoked
-- directly by any role (Postgres only allows it to run as an actual
-- trigger), and PostgREST never exposes trigger-returning functions as RPC
-- endpoints either way. This revoke changes nothing functionally but keeps
-- this function's grants consistent with cloud_project_limit_for_plan()
-- above, and documents the intent explicitly.
revoke execute on function public.enforce_cloud_project_limit() from public;
revoke execute on function public.enforce_cloud_project_limit() from anon;
revoke execute on function public.enforce_cloud_project_limit() from authenticated;

drop trigger if exists projects_enforce_cloud_limit on public.projects;
create trigger projects_enforce_cloud_limit
  before insert on public.projects
  for each row
  execute function public.enforce_cloud_project_limit();

commit;
