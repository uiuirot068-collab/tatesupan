-- ============================================================================
-- TateSpun: 作品挿絵の 72h 一時クラウド同期 (TSP-LOOP-007)
-- ============================================================================
-- NOT auto-applied by any tooling in this repo (same as the other files in
-- this directory). Run manually in the Supabase SQL editor after review, or
-- reproduce the bucket from the Storage UI. Nothing here executes it.
--
-- Scope:
--   1. public.manuscript_cloud_images — per (project, local image id) manifest
--      linking a body 【IMG:id】 marker to a private Storage object + a shared
--      per-project expires_at (now + 72h, refreshed only on a fully successful
--      image sync). Never touches public.projects, its policies, or `content`.
--   2. RLS on that table: an authenticated user may CRUD only their own rows
--      AND only for a project they own. anon: no access.
--   3. Private Storage bucket `manuscript-cloud-images` (public = false), with
--      storage.objects policies restricting every operation to objects whose
--      first path segment equals the caller's auth.uid(). Separate from the
--      β-feedback bucket in every way.
--   4. Indexes for the scheduled purge (expires_at) and per-user lookups.
--
-- Explicitly NOT touched:
--   - public.projects (columns, RLS, grants, triggers) — unchanged.
--   - public.user_plans — unchanged.
--   - beta-feedback-images bucket / its policies — unchanged.
--   - No data deleted, no table dropped, no TRUNCATE.
--
-- Re-run safety: CREATE ... IF NOT EXISTS, DROP POLICY IF EXISTS + CREATE,
-- guarded UPDATEs. Safe to run repeatedly; will not delete stored objects.
-- Everything is one transaction: fully applies or fully rolls back.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. manifest table
-- ----------------------------------------------------------------------------
create table if not exists public.manuscript_cloud_images (
  project_id     uuid not null references public.projects (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  local_image_id text not null,
  storage_path   text not null,
  mime           text not null,
  byte_size      bigint not null default 0,
  -- Shared per-project image expiry. Kept identical across all rows of a
  -- project on each successful sync. The scheduled purge and the UI both
  -- treat this as canonical (UI shows "expired" at this instant even if the
  -- cron purge runs a little later).
  expires_at     timestamptz not null,
  -- TOMBSTONE flag. Set true when the object no longer exists but the row
  -- must stay so the bookshelf can keep showing "画像削除済み・再配置":
  --   * the scheduled purge deleted the object at the 72h mark, or
  --   * a client confirmed the object is unfetchable before expiry.
  -- The row is only ever physically deleted when the body 【IMG】 marker is
  -- removed and re-saved, or the whole project is deleted. Reset to false on
  -- the next fully successful sync that re-uploads the image.
  missing        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (project_id, local_image_id)
);

comment on table public.manuscript_cloud_images is
  'TSP-LOOP-007: per-project manifest for the 72h temporary cloud copy of manuscript 挿絵. One row per body 【IMG:id】 currently referenced. expires_at is shared across a project''s rows and is the canonical expiry for UI + purge.';

create index if not exists manuscript_cloud_images_expires_at_idx
  on public.manuscript_cloud_images (expires_at);
create index if not exists manuscript_cloud_images_user_id_idx
  on public.manuscript_cloud_images (user_id);
create index if not exists manuscript_cloud_images_project_id_idx
  on public.manuscript_cloud_images (project_id);

alter table public.manuscript_cloud_images enable row level security;

-- ----------------------------------------------------------------------------
-- 2. RLS — owner-only, and only for a project the caller owns
-- ----------------------------------------------------------------------------
drop policy if exists "mci_select_own" on public.manuscript_cloud_images;
create policy "mci_select_own"
  on public.manuscript_cloud_images
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "mci_insert_own" on public.manuscript_cloud_images;
create policy "mci_insert_own"
  on public.manuscript_cloud_images
  for insert
  to authenticated
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
  on public.manuscript_cloud_images
  for update
  to authenticated
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
  on public.manuscript_cloud_images
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.manuscript_cloud_images from public;
revoke all on public.manuscript_cloud_images from anon;
grant select, insert, update, delete on public.manuscript_cloud_images to authenticated;
grant select, insert, update, delete on public.manuscript_cloud_images to service_role;

-- ----------------------------------------------------------------------------
-- 3. private Storage bucket
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('manuscript-cloud-images', 'manuscript-cloud-images', false)
on conflict (id) do nothing;

update storage.buckets
set public = false
where id = 'manuscript-cloud-images'
  and public is distinct from false;

update storage.buckets
set file_size_limit = 15728640  -- 15 MiB per manuscript image
where id = 'manuscript-cloud-images'
  and (file_size_limit is null or file_size_limit > 15728640);

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'manuscript-cloud-images'
  and allowed_mime_types is distinct from array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- storage.objects policies for THIS bucket only. Every op requires the
-- object's first path segment to equal the caller's uid. anon gets nothing.
-- Object key layout (TSP-LOOP-007 race-safety): a fresh generation token per
-- successful upload, never a deterministic overwrite —
--   <userId>/<projectId>/<localImageId>/<generation>.<ext>
-- manuscript_cloud_images.storage_path is the canonical pointer to the current
-- generation. An old purge run can only ever remove the generation it SELECTed,
-- so a concurrently re-synced image (new generation, new path) is untouchable.
drop policy if exists "mci_obj_select_own" on storage.objects;
create policy "mci_obj_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'manuscript-cloud-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "mci_obj_insert_own" on storage.objects;
create policy "mci_obj_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'manuscript-cloud-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "mci_obj_update_own" on storage.objects;
create policy "mci_obj_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'manuscript-cloud-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'manuscript-cloud-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "mci_obj_delete_own" on storage.objects;
create policy "mci_obj_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'manuscript-cloud-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;
