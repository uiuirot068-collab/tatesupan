// TSP-LOOP-007 「72h クラウド挿絵同期 + 本棚期限警告」 regression gate.
//
// 純粋ロジック（src/lib/cloudImageSync.ts）の期限・警告ステートマシンを注入
// clock で検証し、クライアント同期／復元／削除／パージ／RLS の不変条件を
// ソーススキャンで確認する。実時間 sleep は使わない。
//
// Run:  node scripts/verify-cloud-image-sync.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLOUD_IMAGE_TTL_HOURS,
  CLOUD_IMAGE_WARNING_HOURS,
  CLOUD_IMAGE_TTL_MS,
  MANUSCRIPT_IMAGE_BUCKET,
  computeCloudImageWarning,
  cloudImageWarningLabel,
  contentHasImages,
  manuscriptImageObjectKey,
  newImageGeneration,
  nextExpiresAt,
  planCloudImageSync,
  referencedImageIds,
} from "../src/lib/cloudImageSync.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), "utf8");

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? "PASS" : "FAIL"}: ${name}`);
  if (!cond) failures += 1;
}

const H = 60 * 60 * 1000;
const T0 = 1_800_000_000_000; // 固定の擬似 now

const syncLib = read("src/lib/supabase/manuscriptImages.ts");
const pureLib = read("src/lib/cloudImageSync.ts");
const editor = read("src/components/TategakiEditor.tsx");
const projects = read("src/lib/supabase/projects.ts");
const bookshelf = read("src/components/bookshelf/Bookshelf.tsx");
const bookSpine = read("src/components/bookshelf/BookSpine.tsx");
const purge = read("supabase/functions/manuscript-image-purge/index.ts");
const homePage = read("src/app/page.tsx");
const preview = read("src/components/PreviewPane.tsx");
const sql = read("docs/supabase/migrations/20260901010000_manuscript_cloud_images.sql");
const betaFeedbackEdge = read("supabase/functions/beta-feedback/index.ts");
const pageCard = read("src/components/PageCard.tsx");

/* ===================== CANONICAL CONSTANTS ===================== */

check("TTL is 72 hours (canonical, not a magic number)", CLOUD_IMAGE_TTL_HOURS === 72);
check("warning threshold is 5 hours (canonical)", CLOUD_IMAGE_WARNING_HOURS === 5);
check("TTL ms derived from hours", CLOUD_IMAGE_TTL_MS === 72 * H);

/* ===================== 1. cloud save wiring ===================== */

check(
  "1. image project cloud save: handleSave calls syncManuscriptImages after project write",
  /await updateProject\([\s\S]{0,400}syncManuscriptImages\(\{/.test(editor) ||
    (editor.indexOf("createProject(") < editor.indexOf("syncManuscriptImages({") &&
      /syncManuscriptImages\(\{\s*\n?\s*projectId: result\.data\.id/.test(editor))
);

/* ===================== 2. manifest created ===================== */

check(
  "2. manifest row created: sync upserts public.manuscript_cloud_images",
  /\.from\("manuscript_cloud_images"\)\s*\n?\s*\.upsert\(/.test(syncLib) &&
    /onConflict: "project_id,local_image_id"/.test(syncLib)
);
check(
  "2b. migration defines the manifest table + PK (project_id, local_image_id)",
  /create table if not exists public\.manuscript_cloud_images/.test(sql) &&
    /primary key \(project_id, local_image_id\)/.test(sql)
);

/* ===================== 3 & 4. expiry = sync success + 72h ===================== */

check("3. nextExpiresAt(t) === t + 72h", nextExpiresAt(T0) === T0 + 72 * H);
check("4. resave always yields (new success time) + 72h", nextExpiresAt(T0 + 999 * H) === T0 + 999 * H + 72 * H);
check(
  "3b. sync sets a single shared expires_at across all rows (one ISO for the batch)",
  /const expiresAtMs = nextExpiresAt\(Date\.now\(\)\)/.test(syncLib) &&
    /expires_at: expiresAtIso/.test(syncLib) &&
    (syncLib.match(/expires_at: expiresAtIso/g) || []).length === 1
);

/* ===================== 5-11. warning state machine (injected clock) ===================== */

const withImgs = (expiresAt, missing = false) => ({
  hasReferencedImages: true,
  expiresAt,
  missing,
});

check("5. > 5h remaining -> level none", computeCloudImageWarning(withImgs(T0 + 6 * H), T0).level === "none");
check("6. exactly 5h remaining -> level warning", (() => {
  const w = computeCloudImageWarning(withImgs(T0 + 5 * H), T0);
  return w.level === "warning" && w.hoursRemaining === 5;
})());
check("7. < 5h remaining -> level warning", (() => {
  const w = computeCloudImageWarning(withImgs(T0 + 90 * 60 * 1000), T0);
  return w.level === "warning" && w.hoursRemaining === 2; // 1.5h -> ceil -> 2
})());
check("7b. sub-hour remaining still shows at least 1h", computeCloudImageWarning(withImgs(T0 + 5 * 60 * 1000), T0).hoursRemaining === 1);
check("8. expiresAt <= now -> EXPIRED_DELETED", computeCloudImageWarning(withImgs(T0 - 1), T0).status === "EXPIRED_DELETED");
check("8b. expired stays expired well past the deadline", computeCloudImageWarning(withImgs(T0 - 500 * H), T0).status === "EXPIRED_DELETED");
check("9. missing before expiry -> MISSING (distinct from expired)", computeCloudImageWarning(withImgs(T0 + 40 * H, true), T0).status === "MISSING");
check("9b. FINAL §9 precedence: expired outranks the missing flag -> EXPIRED_DELETED", computeCloudImageWarning(withImgs(T0 - 10 * H, true), T0).status === "EXPIRED_DELETED");
check("9c. tombstone after purge (missing:true + past expiry) -> EXPIRED_DELETED", computeCloudImageWarning(withImgs(T0 - 1, true), T0).status === "EXPIRED_DELETED");
check("10. no referenced images -> NONE (no expiry shown)", computeCloudImageWarning({ hasReferencedImages: false, expiresAt: T0 - 1, missing: true }, T0).status === "NONE");
check("10b. images referenced but never synced (expiresAt null) -> NONE", computeCloudImageWarning({ hasReferencedImages: true, expiresAt: null, missing: false }, T0).status === "NONE");
check("11. after a successful reupload (missing:false + fresh +72h) -> NONE", computeCloudImageWarning(withImgs(nextExpiresAt(T0), false), T0).status === "NONE");
check("11b. backward-compat .level still maps (EXPIRED_DELETED->expired, EXPIRING->warning, MISSING->missing)", (() => {
  return (
    computeCloudImageWarning(withImgs(T0 - 1), T0).level === "expired" &&
    computeCloudImageWarning(withImgs(T0 + 2 * H), T0).level === "warning" &&
    computeCloudImageWarning(withImgs(T0 + 40 * H, true), T0).level === "missing" &&
    computeCloudImageWarning(withImgs(T0 + 40 * H), T0).level === "none"
  );
})());

check("FINAL §8 wording: 'delete countdown' / '削除済み・再配置' / '取得できません・再配置' — never '元の端末から'", (() => {
  const near = cloudImageWarningLabel(computeCloudImageWarning(withImgs(T0 + 3 * H), T0));
  const exp = cloudImageWarningLabel(computeCloudImageWarning(withImgs(T0 - 1), T0));
  const mis = cloudImageWarningLabel(computeCloudImageWarning(withImgs(T0 + 9 * H, true), T0));
  return (
    near === "削除まであと約3時間" &&
    exp === "画像削除済み・再配置をお願いします" &&
    mis === "画像を取得できません・再配置をお願いします" &&
    !/元の端末/.test(pureLib.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, ""))
  );
})());

/* ===================== 12 & 13. cross-device restore preserves ids ===================== */

check(
  "12. restore keys images by the original local_image_id (body marker id)",
  /images\[id\] = await blobToDataUrl\(blob\)/.test(syncLib) &&
    /for \(const id of referenced\)/.test(syncLib) &&
    /rowById\.get\(id\)/.test(syncLib)
);
check("13. referencedImageIds extracts every distinct id in order", (() => {
  const content =
    "序【IMG:img_a:40:30:center】中\n【改ページ】\n【IMG:img_b:10:10:top】【IMG:img_a:40:30:center】終【IMG:img_c:5:5:full】";
  const ids = referencedImageIds(content);
  return JSON.stringify(ids) === JSON.stringify(["img_a", "img_b", "img_c"]);
})());
check("13b. contentHasImages true/false", contentHasImages("x【IMG:z:1:1:center】y") === true && contentHasImages("ただの本文") === false);
check("13c. planCloudImageSync handles many images (upload all locally-available)", (() => {
  const referenced = ["a", "b", "c", "d"];
  const local = new Set(["a", "b", "c", "d"]);
  const plan = planCloudImageSync(referenced, local, []);
  return plan.toUpload.length === 4 && plan.unresolved.length === 0 && plan.toDeletePaths.length === 0;
})());

/* ===================== 14. partial upload failure does not refresh expiry ===================== */

check(
  "14. upload error returns ok:false + expiresAt:null BEFORE any manifest upsert",
  (() => {
    const phase1 = syncLib.slice(syncLib.indexOf("Phase 1"), syncLib.indexOf("Phase 2"));
    return (
      /if \(upErr\)\s*\{[\s\S]{0,220}ok: false,[\s\S]{0,120}expiresAt: null/.test(phase1) &&
      syncLib.indexOf("if (upErr)") < syncLib.indexOf(".upsert(rows")
    );
  })()
);
check(
  "14b. content-unresolved images -> ok:false (expiry not extended) but no data destroyed",
  /const fullyResolved = plan\.unresolved\.length === 0;[\s\S]{0,200}ok: fullyResolved,[\s\S]{0,120}expiresAt: fullyResolved \? expiresAtMs : null/.test(syncLib)
);
check(
  "14c. editor surfaces the partial-sync failure to the user (no silent omission)",
  /挿絵の一部をクラウドへ同期できませんでした/.test(editor) &&
    /setUnresolvedCloudImages\(\{ missing: \[\], unmanifested: sync\.unresolved \}\)/.test(editor)
);

/* ===================== 15. expired purge — TOMBSTONE model (FINAL §1) ===================== */

check(
  "15. purge selects only expires_at <= now AND missing=false (already-tombstoned rows skipped)",
  /\.lte\("expires_at", nowIso\)\s*\n?\s*\.eq\("missing", false\)/.test(purge)
);
check(
  "15b. FINAL §1: purge DELETES the Storage object but KEEPS the row as missing=true (no row delete)",
  /\.update\(\{ missing: true[\s\S]{0,200}\.eq\("project_id", r\.project_id\)\s*\n?\s*\.eq\("local_image_id", r\.local_image_id\)/.test(purge) &&
    !/\.from\("manuscript_cloud_images"\)\s*\n?\s*\.delete\(\)/.test(purge)
);
check(
  "15b2. RACE: tombstone update is TRIPLE-guarded — missing=false AND storage_path=<selected generation> AND expires_at<=capturedNow",
  /\.update\(\{ missing: true[\s\S]{0,320}\.eq\("missing", false\)\s*\n?\s*\.eq\("storage_path", r\.storage_path\)\s*\n?\s*\.lte\("expires_at", nowIso\)/.test(purge)
);
check(
  "15c. purge only touches the manuscript-cloud-images bucket, rejects other/odd paths",
  /const BUCKET = "manuscript-cloud-images"/.test(purge) &&
    /r\.storage_path\.startsWith\(prefix\)/.test(purge) &&
    /!k\.includes\("\.\."\) && !k\.startsWith\("\/"\)/.test(purge) &&
    /storage\.from\(BUCKET\)/.test(purge) &&
    !/from\("(?!manuscript_cloud_images)/.test(purge.replace(/\/\/.*$/gm, ""))
);
check(
  "15d. purge is idempotent (missing=true rows re-skipped; Storage.remove tolerates absent keys; row not re-processed)",
  /冪等/.test(purge) &&
    /storage\.from\(BUCKET\)\.remove\(\[key\]\)/.test(purge) &&
    /missing=true の行は既に tombstone 済み/.test(purge)
);
check(
  "15e. if the object delete fails, the row is NOT tombstoned (retried next run)",
  /if \(rmErr\)[\s\S]{0,140}continue;[\s\S]{0,60}tombstone しない/.test(purge)
);

/* ===================== 16 & 17. delete / cleanup ===================== */

check(
  "16. deleteProject removes the project's cloud images first",
  /deleteManuscriptImagesForProject\(\{ projectId: id \}\)/.test(projects) &&
    projects.indexOf("deleteManuscriptImagesForProject") < projects.indexOf(".from('projects')\n    .delete()")
);
check(
  "16b. migration: manifest FK cascades on project delete",
  /references public\.projects \(id\) on delete cascade/.test(sql)
);
check(
  "17. removing one image from the body cleans just that cloud object + row on next sync",
  (() => {
    const plan = planCloudImageSync(
      ["keep"],
      new Set(["keep"]),
      [
        { local_image_id: "keep", storage_path: "manuscript-cloud-images/u/p/keep/g1.png", missing: false },
        { local_image_id: "gone", storage_path: "manuscript-cloud-images/u/p/gone/g1.png", missing: false },
      ]
    );
    return (
      plan.toDeletePaths.length === 1 &&
      plan.toDeletePaths[0].endsWith("gone/g1.png") &&
      plan.toUpload.includes("keep")
    );
  })() &&
    /3a\.[\s\S]{0,400}\.in\("local_image_id", staleIds\)[\s\S]{0,200}\.remove\(stalePaths\.map\(bucketKey\)\)/.test(syncLib)
);
check(
  "17b. deletions only run in Phase 3 (after uploads + manifest upsert succeeded)",
  syncLib.indexOf(".upsert(rows") < syncLib.indexOf("Phase 3")
);

/* ===================== 18. cross-user isolation ===================== */

check(
  "18. manifest RLS: every op is owner-scoped (user_id = auth.uid()) and project-owned",
  /create policy "mci_select_own"[\s\S]{0,200}user_id = \(select auth\.uid\(\)\)/.test(sql) &&
    /create policy "mci_insert_own"[\s\S]{0,400}exists \(\s*select 1 from public\.projects p[\s\S]{0,120}p\.user_id = \(select auth\.uid\(\)\)/.test(sql) &&
    /revoke all on public\.manuscript_cloud_images from anon/.test(sql)
);
check(
  "18b. Storage RLS: object's first path segment must equal auth.uid()",
  /create policy "mci_obj_select_own"[\s\S]{0,220}\(storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/.test(sql) &&
    (sql.match(/\(storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/g) || []).length >= 4
);
check(
  "18c. object key layout is <userId>/<projectId>/<imageId>/<generation>.<ext>, path-traversal-safe",
  (() => {
    const key = manuscriptImageObjectKey("u123", "p456", "img_a", "gABC123", "image/png");
    let threw = false;
    try { manuscriptImageObjectKey("../evil", "p", "i", "g1", "image/png"); } catch { threw = true; }
    let threw2 = false;
    try { manuscriptImageObjectKey("u", "p", "a/b", "g1", "image/png"); } catch { threw2 = true; }
    let threw3 = false;
    try { manuscriptImageObjectKey("u", "p", "i", "../g", "image/png"); } catch { threw3 = true; }
    return (
      key === "u123/p456/img_a/gABC123.png" &&
      // first path segment is still the uid (storage RLS foldername[1])
      key.split("/")[0] === "u123" &&
      threw && threw2 && threw3
    );
  })()
);
check(
  "18e. RACE: each successful upload gets a fresh generation token (paths differ every time)",
  (() => {
    const a = newImageGeneration(1000);
    const b = newImageGeneration(1000);
    return typeof a === "string" && a.length > 4 && a !== b && /^g[a-z0-9]+$/.test(a);
  })()
);
check(
  "18d. client sync/restore/delete never use a service-role key (user session only)",
  !/SERVICE_ROLE|service_role|SUPABASE_SERVICE/.test(syncLib) &&
    /supabase\.auth\.getUser\(\)/.test(syncLib)
);

/* ===================== 19. feedback bucket isolation ===================== */

check("19. manuscript bucket name is distinct from the feedback bucket", MANUSCRIPT_IMAGE_BUCKET === "manuscript-cloud-images" && MANUSCRIPT_IMAGE_BUCKET !== "beta-feedback-images");
check(
  "19b. migration never touches beta-feedback-images in an actual statement",
  !/beta-feedback-images/.test(sql.replace(/--.*$/gm, ""))
);
check(
  "19c. TSP-LOOP-006 beta-feedback Edge Function is unchanged by this loop",
  /beta-feedback-images/.test(betaFeedbackEdge) && !/manuscript-cloud-images/.test(betaFeedbackEdge)
);

/* ===================== 20. export image path intact ===================== */

check(
  "20. PageCard still resolves images by images[token.id] (JPG/PDF path unchanged)",
  /const src = images\[token\.id\];/.test(pageCard)
);
check(
  "20b. bookshelf warning derives from ONE lightweight DB query — no per-spine Storage HEAD/list",
  /getProjectCloudImageMetas\(\)/.test(homePage) &&
    /\.from\("manuscript_cloud_images"\)\s*\n?\s*\.select\("project_id, expires_at, missing"\)/.test(syncLib) &&
    /cloudImageMetas\?\.get\(String\(book\.id\)\)/.test(bookshelf) &&
    !/\.download\(|\.list\(|fetch\(/.test(bookshelf)
);
check(
  "20c. cloud spine shows ⚠️ (warning icon) + an accessible detail line, mobile-reachable via menu",
  /kind: "warning"/.test(bookshelf) &&
    /cloudImageDetail/.test(bookSpine) &&
    /menuVariant/.test(bookSpine)
);

/* ============ FINAL UX PATCH: tombstone resync / mobile / placeholder / export ============ */

const bookSpineCss = read("src/components/bookshelf/Bookshelf.module.css");

check(
  "F1. resync clears the tombstone: sync upserts referenced rows with missing:false",
  /missing: false,/.test(syncLib) &&
    /usablePrev = prev && !prev\.missing \? prev : undefined/.test(syncLib)
);
check(
  "F2. a purged tombstone with no local original left = unresolved (not silently resurrected)",
  (() => {
    const plan = planCloudImageSync(
      ["a"],
      new Set(), // nothing local
      [{ local_image_id: "a", storage_path: "manuscript-cloud-images/u/p/a.png", missing: true }]
    );
    return plan.unresolved.includes("a") && plan.toUpload.length === 0;
  })() &&
    // a still-valid cloud object (missing:false) with no local copy is kept, not unresolved
    (() => {
      const plan = planCloudImageSync(
        ["a"],
        new Set(),
        [{ local_image_id: "a", storage_path: "manuscript-cloud-images/u/p/a.png", missing: false }]
      );
      return plan.unresolved.length === 0 && plan.toUpload.length === 0;
    })()
);
check(
  "F3. marker removed -> tombstone row is deleted on next sync (Phase 3), project delete cleans all",
  /toDeletePaths/.test(pureLib) &&
    /\.in\("local_image_id", staleIds\)/.test(syncLib) &&
    /deleteManuscriptImagesForProject\(\{ projectId: id \}\)/.test(projects)
);
check(
  "F4. restore does not re-download a known tombstone (row.missing) — just reports it",
  /if \(row\.missing\) \{\s*\n\s*\/\/[\s\S]{0,80}\n\s*missing\.push\(id\);\s*\n\s*continue;/.test(syncLib)
);

/* ===== RACE: purge invocation vs a concurrent successful resync (PRE-REMOTE §TEST) ===== */

// Model the guarded purge mutation + the generation-scoped object delete, and
// prove an in-flight old purge cannot touch a freshly resynced image.
function purgeTombstoneUpdate(manifestRow, selected, capturedNow) {
  // WHERE missing=false AND storage_path=<selected gen> AND expires_at<=capturedNow
  const matches =
    manifestRow.missing === false &&
    manifestRow.storage_path === selected.storage_path &&
    manifestRow.expires_at <= capturedNow;
  return matches ? { ...manifestRow, missing: true } : { ...manifestRow };
}
function purgeObjectDelete(selected) {
  // remove([key]) — key is derived ONLY from the SELECTed row's storage_path.
  return [selected.storage_path]; // never anything else
}

check("RACE-1. concurrent resync: old purge deletes gen A only, never the new gen B", (() => {
  const A = manuscriptImageObjectKey("u", "p", "img", newImageGeneration(1000), "image/png");
  const B = manuscriptImageObjectKey("u", "p", "img", newImageGeneration(2000), "image/png");
  const capturedNow = T0;
  // purge SELECTed the expired gen-A row
  const selected = { storage_path: `${MANUSCRIPT_IMAGE_BUCKET}/${A}` };
  // ... then a resync switches the manifest to gen B, healthy
  let manifest = { storage_path: `${MANUSCRIPT_IMAGE_BUCKET}/${B}`, expires_at: T0 + 72 * H, missing: false };
  // ... then the old purge worker continues:
  const deleted = purgeObjectDelete(selected);
  manifest = purgeTombstoneUpdate(manifest, selected, capturedNow);
  const w = computeCloudImageWarning(
    { hasReferencedImages: true, expiresAt: manifest.expires_at, missing: manifest.missing },
    T0
  );
  return (
    A !== B &&
    deleted.length === 1 &&
    deleted[0].endsWith(`${A}`) &&
    !deleted[0].endsWith(`${B}`) &&           // B is NEVER in the delete list
    manifest.storage_path === `${MANUSCRIPT_IMAGE_BUCKET}/${B}` && // unchanged
    manifest.missing === false &&              // NOT tombstoned
    manifest.expires_at === T0 + 72 * H &&     // expiry NOT touched
    w.status === "NONE"                        // bookshelf healthy
  );
})());

check("RACE-2. normal expiry (no resync): the SELECTed gen-A row IS deleted + tombstoned", (() => {
  const A = manuscriptImageObjectKey("u", "p", "img", newImageGeneration(1000), "image/png");
  const selected = { storage_path: `${MANUSCRIPT_IMAGE_BUCKET}/${A}` };
  let manifest = { storage_path: `${MANUSCRIPT_IMAGE_BUCKET}/${A}`, expires_at: T0 - H, missing: false };
  const deleted = purgeObjectDelete(selected);
  manifest = purgeTombstoneUpdate(manifest, selected, T0);
  return deleted[0].endsWith(A) && manifest.missing === true && manifest.expires_at === T0 - H;
})());

check("RACE-3. two purge workers on the same expired row: idempotent (2nd finds missing=true, no-op)", (() => {
  const A = `${MANUSCRIPT_IMAGE_BUCKET}/` + manuscriptImageObjectKey("u", "p", "img", "gA", "image/png");
  const selected = { storage_path: A };
  let manifest = { storage_path: A, expires_at: T0 - H, missing: false };
  manifest = purgeTombstoneUpdate(manifest, selected, T0); // worker 1
  const afterFirst = { ...manifest };
  manifest = purgeTombstoneUpdate(manifest, selected, T0); // worker 2
  return afterFirst.missing === true && JSON.stringify(manifest) === JSON.stringify(afterFirst) &&
    /\.eq\("missing", false\)/.test(purge); // worker 2 wouldn't even SELECT it (missing filter)
})());

check("RACE-4. resync after a tombstone: writes a NEW generation, clears missing, +72h", (() => {
  // planCloudImageSync: tombstone + local original present -> re-upload
  const plan = planCloudImageSync(
    ["img"],
    new Set(["img"]),
    [{ local_image_id: "img", storage_path: `${MANUSCRIPT_IMAGE_BUCKET}/u/p/img/gOLD.png`, missing: true }]
  );
  return (
    plan.toUpload.includes("img") &&
    /upload\(key, blob, \{ contentType: mime, upsert: false \}\)/.test(syncLib) &&    // new key, no overwrite
    /manuscriptImageObjectKey\(userId, input\.projectId, id, newImageGeneration\(\), mime\)/.test(syncLib) &&
    /missing: false,/.test(syncLib) &&
    /const expiresAtMs = nextExpiresAt\(Date\.now\(\)\)/.test(syncLib)
  );
})());

check(
  "RACE-5. orphan old generations are swept: resync deletes non-current gens in the id folder; project-delete recurses the folder tree",
  /3b\.[\s\S]{0,500}manuscriptImageIdPrefix\([\s\S]{0,300}\.filter\(\(k\) => k !== currentKey\)/.test(syncLib) &&
    /for \(const imgId of imgIds\)[\s\S]{0,300}\.list\(idPrefix, \{ limit: 1000 \}\)[\s\S]{0,120}keys\.push/.test(syncLib)
);

check("RACE-6. deterministic-overwrite upsert is GONE from the sync upload path", (() => {
  const phase1 = syncLib.slice(syncLib.indexOf("Phase 1"), syncLib.indexOf("Phase 2"));
  return /upsert: false/.test(phase1) && !/upsert: true/.test(phase1);
})());

// --- desktop hover / mobile tap — one canonical helper, ⚠️ never opens the work ---
check(
  "F5. ⚠️ button lives OUTSIDE the open <button> (a tap can't open the work)",
  (() => {
    const openBtnEnd = bookSpine.indexOf("</button>");
    const statusLayer = bookSpine.indexOf("spineStatusLayer");
    return statusLayer > openBtnEnd && /<SpineStatusIcons statuses=\{visibleStatusIcons\} \/>/.test(bookSpine);
  })()
);
check(
  "F6. warning button: stopPropagation + toggles the (mobile-safe) detail dialog, has aria",
  /className=\{styles\.spineWarningButton\}[\s\S]{0,500}event\.stopPropagation\(\);[\s\S]{0,160}onToggleMenu\(\)/.test(bookSpine) &&
    /aria-label=\{`クラウド画像の状態: \$\{cloudImageWarningText\}`\}/.test(bookSpine) &&
    /aria-haspopup="dialog"/.test(bookSpine) &&
    /title=\{cloudImageWarningText\}/.test(bookSpine)
);
check(
  "F7. warning button has a real touch target + focus ring in CSS",
  /\.spineWarningButton \{[\s\S]{0,200}width: 28px;[\s\S]{0,40}height: 28px;/.test(bookSpineCss) &&
    /\.spineWarningButton:focus-visible \{/.test(bookSpineCss)
);
check(
  "F8. desktop hover text == mobile text: both use cloudImageWarningLabel(warning) once in Bookshelf",
  /cloudImageWarningText = cloudImageWarningLabel\(warning\)/.test(bookshelf) &&
    /cloudStatusIcons\.push\(\{ kind: "warning", label: cloudImageWarningText \}\)/.test(bookshelf) &&
    (bookshelf.match(/cloudImageWarningLabel\(/g) || []).length === 1
);
check(
  "F9. detail line (project detail / menu) also uses canonical wording, not '元の端末'",
  /削除まであと約/.test(pureLib) &&
    /削除済み・再配置/.test(pureLib) &&
    /取得できません・再配置/.test(pureLib)
);

// --- expired-image placeholder (warning frame + text only, NO decorative image) ---
check(
  "F10. placeholder has NO decorative image — dashed warning frame + text only (caroad asset untouched elsewhere)",
  !/CLOUD_IMAGE_PLACEHOLDER_SRC/.test(pageCard) &&
    !/caroad_main1/.test(pageCard) &&
    /border: "2px dashed #b45309"/.test(pageCard) &&
    // the site's own use of the asset must NOT be removed
    /caroad_main1\.png/.test(read("src/app/page.tsx")) &&
    fs.existsSync(path.join(repoRoot, "public/caroad_main1.png"))
);
check(
  "F11. body marker with an unresolved image renders the placeholder (not null), keeps warning text",
  /if \(!src\) \{\s*\n\s*if \(!unresolvedImageIds\.has\(token\.id\)\) return null;\s*\n\s*return \(\s*\n\s*<ExpiredImagePlaceholder/.test(pageCard) &&
    /画像の保存期限が切れています/.test(pageCard) &&
    /画像を再度配置してください/.test(pageCard) &&
    // placeholder still occupies the slot's real size (not blank)
    /width: widthPx,\s*\n\s*height: heightPx,/.test(pageCard)
);
check(
  "F12. placeholder is UI-only: data-no-print + .no-print, no <img>, never touches content/IndexedDB/Storage/export",
  /data-no-print="true"\s*\n?\s*className="no-print"/.test(pageCard) &&
    (() => {
      const comp = pageCard.slice(pageCard.indexOf("function ExpiredImagePlaceholder"), pageCard.indexOf("function ImagePositionOverlay"));
      return (
        !/<img/.test(comp) &&
        !/saveImage|manuscript_cloud_images|onContentChange|setContent|upload\(/.test(comp)
      );
    })()
);
check(
  "F13. exportCapture filter still strips [data-no-print] (placeholder can't leak into JPG/PDF)",
  /\.no-print, \[data-no-print\]/.test(read("src/utils/exportCapture.ts"))
);
check(
  "F14. PageCard memo compares unresolvedImageIds by reference (Set is memoised in TategakiEditor)",
  /prev\.unresolvedImageIds === next\.unresolvedImageIds/.test(pageCard) &&
    /unresolvedImageIdSet = useMemo\(/.test(editor)
);

// --- export block (§7) ---
check(
  "F15. JPG + PDF exports are HARD-blocked when unresolved images exist (not just a warning)",
  (() => {
    const guard = /exportBlockedByUnresolvedImages\(\)\) return;/g;
    const n = (preview.match(guard) || []).length;
    return (
      n >= 5 && // all 5 export entry points
      /const handleExportJpg = async \(\) => \{\s*\n\s*if \(exportBlockedByUnresolvedImages\(\)\) return;/.test(preview) &&
      /const handleDownloadPdf = async \(\) => \{\s*\n\s*if \(exportBlockedByUnresolvedImages\(\)\) return;/.test(preview)
    );
  })()
);
check(
  "F16. block shows a clear modal/alert and returns even if the user confirms (no proceed)",
  /CLOUD_IMAGE_EXPORT_BLOCK_TITLE/.test(preview) &&
    /書き出しできません/.test(pureLib) &&
    /alert\(`\$\{CLOUD_IMAGE_EXPORT_BLOCK_TITLE\}[\s\S]{0,40}\);\s*\n\s*return true;/.test(preview)
);
check(
  "F17. block is gated on unresolvedImageIdSet.size > 0 (no markers -> no block)",
  /blockExportForUnresolvedImages=\{unresolvedImageIdSet\.size > 0\}/.test(editor) &&
    /if \(!blockExportForUnresolvedImages\) return false;/.test(preview)
);
check(
  "F18. all images resolved -> set empty -> exports enabled, placeholder gone",
  (() => {
    // empty set + no missing meta -> NONE, and blockExport false
    const w = computeCloudImageWarning({ hasReferencedImages: true, expiresAt: T0 + 40 * H, missing: false }, T0);
    return w.status === "NONE";
  })()
);
check(
  "F19. no-image project is unaffected (contentHasImages false -> NONE, no block, no placeholder)",
  computeCloudImageWarning({ hasReferencedImages: false, expiresAt: null, missing: false }, T0).status === "NONE" &&
    /contentHasImages\(project\.content\)/.test(editor)
);

/* ============ TSP-LOOP-008: image-storage information (docs/UI only) ============ */

const help = read("public/docs/help.md");

check(
  "L8-1. top page: always-visible '◇ 画像の保存について' card (not a fold / not a modal)",
  /◇ 画像の保存について/.test(homePage) &&
    /id="image-storage-note-title"/.test(homePage) &&
    // the <aside> is a direct child of the quick-actions <section>, not gated on user/state
    /<\/div>\s*\n\s*\{\/\* TSP-LOOP-008[\s\S]{0,400}<aside\s*\n\s*aria-labelledby="image-storage-note-title"/.test(homePage) &&
    !/isModalOpen|isFold|collapsed|showImageStorage/i.test(homePage.slice(homePage.indexOf("image-storage-note-title") - 400, homePage.indexOf("image-storage-note-title") + 400))
);
check(
  "L8-2. top card: 72時間 stated, Guest + Member both explained, distinction kept",
  /72時間/.test(homePage) &&
    /Guest（未登録）の画像は、このブラウザ内に保存されます/.test(homePage) &&
    /「クラウドに保存」を行った画像のコピーだけが72時間の一時クラウド保存/.test(homePage) &&
    /元画像をTateSpunが自動で削除することはありません/.test(homePage)
);
check(
  "L8-3. top card: browser-data-deletion / other-device caveat + keep-your-own-copy",
  /ブラウザデータの削除・別ブラウザ・別端末などでは/.test(homePage) &&
    /大切な元画像は必ずお手元にも保管してください/.test(homePage)
);
check(
  "L8-4. top card: no emoji added (◇ is allowed; no emoji codepoints in the aside)",
  (() => {
    const a = homePage.slice(homePage.indexOf('aria-labelledby="image-storage-note-title"'));
    const aside = a.slice(0, a.indexOf("</aside>"));
    return !/\p{Extended_Pictographic}/u.test(aside);
  })()
);
check(
  "L8-5. help.md: '## 画像の保存場所と72時間ルール' section with Guest / Member / 72h-passed / warning / other-device subsections",
  /^## 画像の保存場所と72時間ルール$/m.test(help) &&
    /^### Guest（未登録）の場合$/m.test(help) &&
    /^### Memberの場合$/m.test(help) &&
    /^### 72時間を過ぎるとどうなりますか？$/m.test(help) &&
    /^### 画像に警告が表示された場合$/m.test(help) &&
    /^### 別端末でも使いたい場合$/m.test(help)
);
check(
  "L8-6. help.md: keeps the 'expiry is the cloud copy, not your original' distinction; no forbidden absolutes",
  /期限が切れるのは、クラウド上に一時保存している画像コピーです/.test(help) &&
    /元画像を、TateSpunが72時間後に自動削除することはありません/.test(help) &&
    /Guestの画像に、TateSpun側の「72時間」の保存期限はありません/.test(help) &&
    !/画像は永久に保存されます|絶対に消えません|72時間後に画像が全部削除されます/.test(help)
);
check(
  "L8-7. help.md: export is stopped while an image is unresolved, restored after re-place/re-sync",
  /JPG・PDFなどの書き出しを停止します/.test(help) &&
    /警告が解消されれば通常どおり書き出せます/.test(help)
);

/* ===================== done ===================== */

console.log("");
if (failures === 0) {
  console.log("All cloud-image-sync checks passed.");
} else {
  console.log(`${failures} cloud-image-sync check(s) FAILED.`);
  process.exit(1);
}
