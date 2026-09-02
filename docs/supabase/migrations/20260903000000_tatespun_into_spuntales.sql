-- ============================================================================
-- TSP-LOOP-017 — TateSpun schema INTO the canonical SpunTales Supabase project
-- ============================================================================
-- TARGET project : vjgxrqgnbgnewfvissgd   (canonical SpunTales — owns Auth)
-- SOURCE / rollback : rgvqquuthovqjqfogfra (old separate TateSpun project)
--
-- NOT auto-applied. Run **in the vjgxrqgnbgnewfvissgd SQL editor** after review.
-- Nothing in this repo executes it.
--
-- >>> HUMAN PRE-CHECK (REQUIRED) <<<
--   The base `public.projects` table + its 4 RLS policies were never committed
--   to this repo (they were created directly in the old rgv dashboard). The
--   `public.projects` block below is RECONSTRUCTED from src/types/database.ts
--   + the app's query patterns + the comments in
--   20260809000000_cloud_project_limits.sql. Before running:
--     1. In the rgv dashboard, dump the real DDL:
--          - Table Editor → projects → "..." → or
--          - SQL editor:  select pg_get_ddl ... / use Supabase schema export
--        and the 4 policies:
--          select * from pg_policies where tablename = 'projects';
--     2. Diff against the `public.projects` block here. If anything differs
--        (column defaults, an updated_at trigger, extra columns, CHECK
--        constraints), FIX THIS FILE to match rgv exactly, then run.
--
-- This file recreates ONLY TateSpun-owned objects. It does NOT touch:
--   public.profiles, public.characters, public.situation_logs,
--   public.kishoutenketsu_logs, public.action_matching_logs, the
--   on_auth_user_created trigger, or any Stripe/portal schema.
--
-- It creates NO data. Row + Storage-object migration is a separate, manual
-- step — see docs/supabase/tatespun-canonical-supabase-migration.md.
--
-- Idempotent (IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS + CREATE).
-- One transaction: fully applies or fully rolls back.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 0. shared helper: set updated_at = now() on UPDATE
--    (portal already defines its own per-table trigger functions; this one is
--     TateSpun-namespaced so it cannot collide.)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 1. public.projects  (RECONSTRUCTED — verify against rgv before running)
-- ----------------------------------------------------------------------------
create table if not exists public.projects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null default '',
  content    text not null default '',
  settings   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.projects is
  'TateSpun cloud manuscripts. One row per cloud-saved 作品. Owned by user_id (auth.users.id). Migrated from project rgvqquuthovqjqfogfra in TSP-LOOP-017.';

alter table public.projects enable row level security;

drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own"
  on public.projects for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own"
  on public.projects for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own"
  on public.projects for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own"
  on public.projects for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.projects from public;
revoke all on public.projects from anon;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.projects to service_role;

create index if not exists projects_user_id_idx on public.projects (user_id);

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.tatespun_set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. public.user_plans  (kept SEPARATE from profiles.plan_tier — LOOP-017 decision)
--    Verbatim from 20260809000000_cloud_project_limits.sql §1.
-- ----------------------------------------------------------------------------
create table if not exists public.user_plans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null check (plan in ('resident', 'light', 'unlimited')),
  updated_at timestamptz not null default now()
);

comment on table public.user_plans is
  'TateSpun cloud plan per user. Absence of a row for a logged-in user means "resident". Kept separate from portal profiles.plan_tier on purpose (naming differs: resident vs free). Written only by service_role (future Stripe webhook).';

alter table public.user_plans enable row level security;

drop policy if exists "user_plans_select_own" on public.user_plans;
create policy "user_plans_select_own"
  on public.user_plans for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.user_plans from public;
revoke all on public.user_plans from anon;
revoke all on public.user_plans from authenticated;
revoke all on public.user_plans from service_role;
grant select on public.user_plans to authenticated;
grant select, insert, update, delete on public.user_plans to service_role;

-- ----------------------------------------------------------------------------
-- 3. cloud project count limit  (verbatim from cloud_project_limits.sql §3–4)
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

revoke execute on function public.cloud_project_limit_for_plan(text) from public;
revoke execute on function public.cloud_project_limit_for_plan(text) from anon;
revoke execute on function public.cloud_project_limit_for_plan(text) from authenticated;

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
  if NEW.user_id is distinct from auth.uid() then
    return NEW;
  end if;

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

revoke execute on function public.enforce_cloud_project_limit() from public;
revoke execute on function public.enforce_cloud_project_limit() from anon;
revoke execute on function public.enforce_cloud_project_limit() from authenticated;

drop trigger if exists projects_enforce_cloud_limit on public.projects;
create trigger projects_enforce_cloud_limit
  before insert on public.projects
  for each row execute function public.enforce_cloud_project_limit();

-- ----------------------------------------------------------------------------
-- 4. public.manuscript_cloud_images  (verbatim from 20260901010000_*.sql §1–2)
-- ----------------------------------------------------------------------------
create table if not exists public.manuscript_cloud_images (
  project_id     uuid not null references public.projects (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  local_image_id text not null,
  storage_path   text not null,
  mime           text not null,
  byte_size      bigint not null default 0,
  expires_at     timestamptz not null,
  missing        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (project_id, local_image_id)
);

comment on table public.manuscript_cloud_images is
  'TSP-LOOP-007 manifest for the 72h temporary cloud copy of manuscript 挿絵. Migrated in TSP-LOOP-017; storage_path first UUID segment remapped to the canonical SpunTales user id.';

create index if not exists manuscript_cloud_images_expires_at_idx
  on public.manuscript_cloud_images (expires_at);
create index if not exists manuscript_cloud_images_user_id_idx
  on public.manuscript_cloud_images (user_id);
create index if not exists manuscript_cloud_images_project_id_idx
  on public.manuscript_cloud_images (project_id);

alter table public.manuscript_cloud_images enable row level security;

drop policy if exists "mci_select_own" on public.manuscript_cloud_images;
create policy "mci_select_own"
  on public.manuscript_cloud_images for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "mci_insert_own" on public.manuscript_cloud_images;
create policy "mci_insert_own"
  on public.manuscript_cloud_images for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.projects p
      where p.id = manuscript_cloud_images.project_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "mci_update_own" on public.manuscript_cloud_images;
create policy "mci_update_own"
  on public.manuscript_cloud_images for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.projects p
      where p.id = manuscript_cloud_images.project_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "mci_delete_own" on public.manuscript_cloud_images;
create policy "mci_delete_own"
  on public.manuscript_cloud_images for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.manuscript_cloud_images from public;
revoke all on public.manuscript_cloud_images from anon;
grant select, insert, update, delete on public.manuscript_cloud_images to authenticated;
grant select, insert, update, delete on public.manuscript_cloud_images to service_role;

-- ----------------------------------------------------------------------------
-- 5. Storage buckets + policies
--    manuscript-cloud-images : owner-scoped browser-direct (RLS on first folder
--                              segment). beta-feedback-images : service-role only.
--    (from 20260901000000_*.sql and 20260901010000_*.sql §3)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('manuscript-cloud-images', 'manuscript-cloud-images', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('beta-feedback-images', 'beta-feedback-images', false)
on conflict (id) do nothing;

update storage.buckets set public = false
  where id in ('manuscript-cloud-images', 'beta-feedback-images')
    and public is distinct from false;

update storage.buckets set file_size_limit = 15728640
  where id = 'manuscript-cloud-images'
    and (file_size_limit is null or file_size_limit > 15728640);
update storage.buckets set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']
  where id = 'manuscript-cloud-images'
    and allowed_mime_types is distinct from array['image/jpeg','image/png','image/webp','image/gif'];

update storage.buckets set file_size_limit = 5242880
  where id = 'beta-feedback-images'
    and (file_size_limit is null or file_size_limit > 5242880);
update storage.buckets set allowed_mime_types = array['image/jpeg','image/png','image/webp']
  where id = 'beta-feedback-images'
    and allowed_mime_types is distinct from array['image/jpeg','image/png','image/webp'];

-- manuscript-cloud-images object policies (this bucket only)
drop policy if exists "mci_obj_select_own" on storage.objects;
create policy "mci_obj_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'manuscript-cloud-images'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "mci_obj_insert_own" on storage.objects;
create policy "mci_obj_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'manuscript-cloud-images'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "mci_obj_update_own" on storage.objects;
create policy "mci_obj_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'manuscript-cloud-images'
         and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'manuscript-cloud-images'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "mci_obj_delete_own" on storage.objects;
create policy "mci_obj_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'manuscript-cloud-images'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

-- beta-feedback-images: NO policy — RLS-enabled storage.objects + no policy =
-- every non-service_role op denied. service-role Edge Function is the only path.

commit;

-- ============================================================================
-- After this file applies cleanly to vjg:
--   * Row + object migration:  docs/supabase/tatespun-canonical-supabase-migration.md
--   * Edge Functions:          supabase functions deploy beta-feedback / manuscript-image-purge
--   * pg_cron purge schedule:  recreate pointing at the vjg function
--   * Auth: Redirect URLs + Resend SMTP (human, dashboard)
--   * Frontend: NEXT_PUBLIC_SUPABASE_URL/_ANON_KEY -> vjg (Cloudflare + .env.local)
-- ============================================================================
