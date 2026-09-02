# TateSpun → canonical SpunTales Supabase (TSP-LOOP-017)

Move TateSpun onto the **canonical SpunTales project `vjgxrqgnbgnewfvissgd`**
(which already owns SpunTales Auth + `profiles` + the other tools). The old
separate TateSpun project **`rgvqquuthovqjqfogfra`** stays fully intact as the
rollback source until production QA passes.

**Decision (LOOP-017):** keep `public.user_plans` as a separate TateSpun table
in `vjg` — do **not** fold it into `profiles.plan_tier` this loop.

Nothing here is auto-run. Every step is manual (SQL editor / `supabase` CLI /
dashboard). Do the steps **in order**.

---

## 0. Human gates before anything runs

| # | Gate | Where |
|---|---|---|
| G1 | Confirm the exact `NEXT_PUBLIC_SUPABASE_URL` / publishable key currently on the Cloudflare Pages `tatespun` project and in `.env.local` (should be `rgv…`). | Cloudflare dash / local |
| G2 | For each of the 2 TateSpun `auth.users`: record the email and both UUIDs — `OLD` from `rgv…`, `NEW` from `vjg…` (same email). Keep this mapping in a scratch note; **never commit it, never paste UUIDs/emails into a report.** | Both dashboards (Auth → Users) |
| G3 | Dump the real `public.projects` DDL + `pg_policies` from `rgv…` and diff against the reconstructed block in `20260903000000_tatespun_into_spuntales.sql`. Fix that file if it differs. | `rgv…` SQL editor |
| G4 | Confirm `vjg…` has **no** `public.projects` / `public.user_plans` / `public.manuscript_cloud_images` / `manuscript-cloud-images` / `beta-feedback-images` yet (abort if any exists with different shape). | `vjg…` SQL editor |
| G5 | Have the Edge Function secret values ready (do not print): `DISCORD_FEEDBACK_WEBHOOK_URL`, `DISCORD_REVIEW_WEBHOOK_URL`, `GOOGLE_APPS_SCRIPT_URL`, `GOOGLE_APPS_SCRIPT_SECRET`, `BETA_FEEDBACK_ALLOWED_ORIGINS`, `MANUSCRIPT_IMAGE_PURGE_SECRET`. Copy from `rgv…` Edge Function config. | `rgv…` dash |
| G6 | Have the production Resend SMTP creds (host / port / user / pass / sender) ready to enter into `vjg…`. | Resend + `rgv…` dash |

Read-only inventory to capture first (put counts in the loop report, not values):
`select count(*) from public.projects;` / `user_plans` / `manuscript_cloud_images`
in `rgv…`, and object counts for both buckets (Storage UI).

---

## 1. Schema into `vjg…`

Run **`docs/supabase/migrations/20260903000000_tatespun_into_spuntales.sql`** in
the **`vjgxrqgnbgnewfvissgd` SQL editor** (after G3/G4). It is one transaction.

Verify:
```sql
select tablename from pg_tables where schemaname='public'
  and tablename in ('projects','user_plans','manuscript_cloud_images');
select tablename, policyname, cmd from pg_policies
  where tablename in ('projects','user_plans','manuscript_cloud_images') order by 1,3;
select id, public, file_size_limit, allowed_mime_types from storage.buckets
  where id in ('manuscript-cloud-images','beta-feedback-images');
select policyname, cmd from pg_policies where tablename='objects' and policyname like 'mci_obj_%';
-- profiles / characters / *_logs untouched:
select tablename from pg_tables where schemaname='public'
  and tablename in ('profiles','characters','situation_logs','kishoutenketsu_logs','action_matching_logs');
```

---

## 2. Row migration (additive; run in `vjg…` SQL editor)

Use the `rgv…` **project connection string** via `dblink`/`postgres_fdw`, OR
export CSV from `rgv…` and `\copy` in — whichever your access allows. The
pattern below assumes the `rgv…` rows are available as a temp staging table
`rgv_projects` / `rgv_user_plans` / `rgv_mci` in `vjg…` (load them however).

Replace `:OLD1/:NEW1`, `:OLD2/:NEW2` with the G2 mapping (2 users).

```sql
begin;

-- helper: old -> new user id
create temp table _uid_map(old_uid uuid primary key, new_uid uuid not null) on commit drop;
insert into _uid_map values (:'OLD1', :'NEW1'), (:'OLD2', :'NEW2');

-- A. projects  (keep id, remap user_id, keep everything else)
insert into public.projects (id, user_id, title, content, settings, created_at, updated_at)
select p.id, m.new_uid, p.title, p.content, p.settings, p.created_at, p.updated_at
from rgv_projects p join _uid_map m on m.old_uid = p.user_id
on conflict (id) do nothing;   -- abort-safe: never overwrite

-- B. user_plans
insert into public.user_plans (user_id, plan, updated_at)
select m.new_uid, up.plan, up.updated_at
from rgv_user_plans up join _uid_map m on m.old_uid = up.user_id
on conflict (user_id) do nothing;

-- C. manuscript_cloud_images  (remap user_id + rewrite storage_path first UUID)
--    storage_path form: 'manuscript-cloud-images/<uuid>/<projectId>/<localImageId>/<gen>.<ext>'
insert into public.manuscript_cloud_images
  (project_id, user_id, local_image_id, storage_path, mime, byte_size, expires_at, missing, created_at, updated_at)
select
  i.project_id, m.new_uid, i.local_image_id,
  regexp_replace(i.storage_path,
    '^(manuscript-cloud-images/)' || m.old_uid::text || '(/)',
    '\1' || m.new_uid::text || '\2'),
  i.mime, i.byte_size, i.expires_at, i.missing, i.created_at, i.updated_at
from rgv_mci i join _uid_map m on m.old_uid = i.user_id
on conflict (project_id, local_image_id) do nothing;

-- sanity: no row left pointing at an OLD uuid
-- (expect 0)
select count(*) from public.manuscript_cloud_images
  where storage_path ~ ('manuscript-cloud-images/(' || :'OLD1' || '|' || :'OLD2' || ')/');

commit;
```

Do **not** run any `delete`/`update` against `rgv_*` — those are the rollback copy.

---

## 3. Storage object migration (manual, per object)

For each object under `rgv…` bucket `manuscript-cloud-images` with key
`<OLD_UUID>/…`:

1. Download (service-role) from `rgv…` at key `<OLD_UUID>/rest…`.
2. Upload (service-role) to `vjg…` `manuscript-cloud-images` at
   `<NEW_UUID>/rest…` with the **same content-type**, `upsert:false`.
3. Verify: object exists at the `vjg…` key; its byte size == the
   `manuscript_cloud_images.byte_size` for that `(project_id, local_image_id)`;
   the key exactly equals the rewritten `storage_path` minus the
   `manuscript-cloud-images/` prefix.

`beta-feedback-images`: paths are `reportId/uuid.ext` (no user id). If the
bucket is **empty** in `rgv…` → nothing to migrate. If not → copy each object
to the **same key** in `vjg…` (no rewrite).

Do **not** delete `rgv…` objects.

A small Node/Deno script using two `createClient(url, SERVICE_ROLE_KEY)` clients
(one per project) can loop this — service-role keys never leave the operator's
machine, never go in the repo, never in the browser.

---

## 4. Edge Functions into `vjg…`

```
supabase login                                   # human
supabase link --project-ref vjgxrqgnbgnewfvissgd # human
# from this repo:
supabase functions deploy beta-feedback --project-ref vjgxrqgnbgnewfvissgd
supabase functions deploy manuscript-image-purge --project-ref vjgxrqgnbgnewfvissgd
```

- The `beta-feedback` code in the repo already includes the **LOOP-014 server
  rejection** (`IMAGE_ATTACHMENTS_ENABLED = false` → 415 on any image field).
- `supabase/config.toml` already sets `verify_jwt = false` for both.
- Set secrets on `vjg…` (values from G5, never printed/committed):
  ```
  supabase secrets set --project-ref vjgxrqgnbgnewfvissgd \
    DISCORD_FEEDBACK_WEBHOOK_URL=... DISCORD_REVIEW_WEBHOOK_URL=... \
    GOOGLE_APPS_SCRIPT_URL=... GOOGLE_APPS_SCRIPT_SECRET=... \
    BETA_FEEDBACK_ALLOWED_ORIGINS='https://spuntales.net,https://tatespun.pages.dev,http://localhost:3000' \
    MANUSCRIPT_IMAGE_PURGE_SECRET=...
  ```
  (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase.)
- **After** the function is live, recreate the pg_cron → pg_net POST to
  `https://vjgxrqgnbgnewfvissgd.functions.supabase.co/manuscript-image-purge`
  with `Authorization: Bearer <MANUSCRIPT_IMAGE_PURGE_SECRET>` (see
  `docs/supabase/manuscript-cloud-images-setup.md`). Disable the old `rgv…`
  cron **last**, only after QA.

---

## 5. Auth config on `vjg…` (dashboard — human)

- **Site URL:** `https://spuntales.net/` (portal root — unchanged from portal's expectation).
- **Redirect URLs:** keep every existing SpunTales entry, **add**:
  - `https://spuntales.net/tatespun/auth/reset-password`
  - `https://spuntales.net/tatespun/**` (covers future TateSpun auth returns)
  - keep `http://localhost:3000/**` if already present for portal dev; add it if
    TateSpun local dev needs it (it does, for recovery testing).
- **Confirm email:** leave OFF (`vjg…` `mailer_autoconfirm` is already `true`).
- **Custom SMTP:** enter the same production **Resend** config used on `rgv…`.
  Sender: `SpunTales <no-reply@spuntales.net>`.
- **Do not remove or reorder** existing SpunTales redirect URLs.

---

## 6. Frontend flip (repo + Cloudflare)

The TateSpun app never hard-codes a project ref — it's `NEXT_PUBLIC_SUPABASE_URL`
/ `NEXT_PUBLIC_SUPABASE_ANON_KEY` only.

- **Cloudflare Pages `tatespun` → Settings → Environment variables (Production):**
  - `NEXT_PUBLIC_SUPABASE_URL = https://vjgxrqgnbgnewfvissgd.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY = <vjg publishable key>` (from `vjg…` API settings)
- **`.env.local`** (operator's machine): same two values.
- Redeploy (push or "Retry deployment").
- Keep `rgv…` values noted for rollback.

`scripts/verify-supabase-project.mjs` (added this loop) checks the URL is the
canonical `vjg…` (or, until the flip, the documented rollback `rgv…`). After the
flip, set `TATESPUN_LOCK_CANONICAL=1` in CI to make `rgv…` a hard failure.

---

## 7. Production QA (all must pass before decommission)

1. **New** SpunTales portal registration → open `spuntales.net/tatespun/` → log
   in with that same account. **No second registration. No "user not found".**
2. `natuoutan` account: TateSpun login with the SpunTales password; cloud
   project save; reload on a 2nd browser → project loads.
3. Developer account: previously-migrated cloud projects appear; open + save OK.
4. Cloud manuscript image: place → cloud save → reopen elsewhere → restores →
   remove → gone. Expired-image placeholder still works.
5. Password recovery from TateSpun → Resend sends → email arrives → link opens
   `/tatespun/auth/reset-password` → new-password form → update → the new
   password works on **both** the portal and TateSpun.
6. Plan limit: create up to 15 cloud projects → 16th blocked with the plan
   dialog. Portal billing / `profiles` unaffected.
7. Feedback: text + review deliver to Discord + Spreadsheet; image UI hidden;
   a hand-crafted multipart image POST → `415 image_attachments_disabled`.
8. Purge function deployed on `vjg…`; cron points at `vjg…`; a manually-expired
   test row gets tombstoned.
9. Portal, Taroad, and the other tools: unchanged (login, data).

---

## 8. Rollback

At any point before decommission:

1. Cloudflare `tatespun` env → back to the `rgv…` URL + anon key. Redeploy
   (or "Rollback to deployment" `15600a4a` or earlier).
2. `.env.local` → back to `rgv…`.
3. Re-enable the `rgv…` purge cron; disable the `vjg…` one.

All `rgv…` tables, buckets, objects, functions, and rows are **never modified**
by this migration — they remain the authoritative copy until QA passes and a
grace period (≥ 1 week) elapses. Only then: decommission `rgv…` TateSpun
objects (or leave them read-only indefinitely).

---

## 9. Known gap

`public.projects` base DDL + its 4 RLS policies are **not** in this repo (see G3
and the header of `20260903000000_tatespun_into_spuntales.sql`). The
reconstruction must be reconciled with the live `rgv…` schema before the schema
step runs. Consider committing the corrected DDL back so the repo is complete.
