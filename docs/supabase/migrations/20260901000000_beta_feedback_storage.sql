-- ============================================================================
-- TateSpun: β版フィードバック用 private Storage バケット (TSP-LOOP-006)
-- ============================================================================
-- This file is NOT auto-applied by any tooling in this repo (there is no
-- Supabase CLI / migration runner wired up here — same as
-- 20260809000000_cloud_project_limits.sql). Run it manually in the Supabase
-- SQL editor after review, OR apply the equivalent from the Storage UI
-- (see docs/supabase/beta-feedback-setup.md). Nothing here executes it.
--
-- Scope:
--   1. Creates a PRIVATE Storage bucket `beta-feedback-images` (public =
--      false). Feedback images (気になる事タブのみ) are written here ONLY by
--      the `beta-feedback` Edge Function using the service-role key. The
--      browser never uploads directly and never receives a public URL.
--   2. Sets bucket-level defense in depth: 5 MiB per-object size limit and a
--      JPEG/PNG/WebP MIME allowlist (the Edge Function also re-checks size,
--      count, MIME and magic bytes — this is a second line only).
--   3. Adds NO RLS policy on storage.objects for this bucket. With RLS
--      enabled on storage.objects (Supabase default) and no policy granting
--      anon/authenticated access, every non-service_role read/write/list/
--      delete for this bucket is denied outright. service_role bypasses RLS
--      by default in Supabase, which is the intended (and only) access path.
--
-- Explicitly NOT touched:
--   - No existing bucket is modified except an idempotent "ensure private"
--     on `beta-feedback-images` itself.
--   - No storage.objects policy for any other bucket is added/changed.
--   - No data is deleted, no table is dropped, no TRUNCATE is issued.
--
-- Re-run safety: INSERT ... ON CONFLICT DO NOTHING + guarded UPDATEs. Safe
-- to run repeatedly; it will not delete stored objects.
--
-- Everything runs as one transaction: fully applies or fully rolls back.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. private bucket
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('beta-feedback-images', 'beta-feedback-images', false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. ensure private + bucket-level limits (idempotent, tightening only)
-- ----------------------------------------------------------------------------
update storage.buckets
set public = false
where id = 'beta-feedback-images'
  and public is distinct from false;

update storage.buckets
set file_size_limit = 5242880  -- 5 MiB, matches MAX_IMAGE_BYTES
where id = 'beta-feedback-images'
  and (file_size_limit is null or file_size_limit > 5242880);

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'beta-feedback-images'
  and allowed_mime_types is distinct from array['image/jpeg', 'image/png', 'image/webp'];

-- ----------------------------------------------------------------------------
-- 3. NO RLS policy is created for this bucket, by design.
--    storage.objects has RLS enabled (Supabase default). With no policy for
--    anon/authenticated on rows where bucket_id = 'beta-feedback-images',
--    those roles cannot select/insert/update/delete/list any object in it.
--    The `beta-feedback` Edge Function uses the service-role key, which
--    bypasses RLS — the sole intended access path. Do NOT add a public-read
--    policy here; feedback images must never be publicly reachable.
-- ----------------------------------------------------------------------------

commit;
