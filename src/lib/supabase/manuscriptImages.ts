/**
 * TSP-LOOP-007 — 作品挿絵の 72h 一時クラウド同期（クライアント側）。
 *
 * すべて **ログインユーザー自身のセッション**で実行する。service-role キーは
 * 使わない／ブラウザへ出さない。所有権は DB / Storage の RLS が強制する。
 *
 * 純粋ロジック（期限・警告・パス・差分計画）は ../cloudImageSync.ts。
 */
import { createClient } from "./client";
import {
  MANUSCRIPT_IMAGE_BUCKET,
  MANUSCRIPT_IMAGE_MIME,
  manuscriptImageIdPrefix,
  manuscriptImageObjectKey,
  manuscriptImageProjectPrefix,
  newImageGeneration,
  nextExpiresAt,
  planCloudImageSync,
  referencedImageIds,
  type ManuscriptImageManifestRow,
} from "../cloudImageSync";

type Mime = (typeof MANUSCRIPT_IMAGE_MIME)[number];

function dataUrlMime(dataUrl: string): Mime | null {
  const m = /^data:([^;,]+)[;,]/.exec(dataUrl);
  const mime = m?.[1]?.toLowerCase();
  return (MANUSCRIPT_IMAGE_MIME as readonly string[]).includes(mime ?? "")
    ? (mime as Mime)
    : null;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("画像の読み込みに失敗しました"));
    reader.readAsDataURL(blob);
  });
}

export interface SyncManuscriptImagesInput {
  projectId: string;
  /** 保存する本文（【IMG:id】マーカーが canonical）。 */
  content: string;
  /** 端末にデータがある挿絵: id -> dataURL。 */
  localImages: Record<string, string>;
}

export interface SyncManuscriptImagesResult {
  /** 参照画像すべてを cloud に用意でき、manifest を更新できたか。 */
  ok: boolean;
  /** ok のときの新しい期限（ms）。ok=false なら null（期限は延長しない）。 */
  expiresAt: number | null;
  /** 本文が参照するが端末にも cloud にも無く、アップロード不能な id。 */
  unresolved: string[];
  /** 参照画像がそもそも無い（同期不要）。 */
  noImages: boolean;
  error?: string;
}

/**
 * 画像同期。**完全成功時のみ** manifest の expires_at を now+72h へ更新する。
 * 途中失敗時は既存の有効な cloud 画像・manifest を破壊しない。
 */
export async function syncManuscriptImages(
  input: SyncManuscriptImagesInput
): Promise<SyncManuscriptImagesResult> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) {
    return { ok: false, expiresAt: null, unresolved: [], noImages: false, error: "not signed in" };
  }
  const referenced = referencedImageIds(input.content);

  if (referenced.length === 0) {
    // 参照画像なし → プロジェクト配下の cloud 画像を全撤去（best-effort）。
    await deleteManuscriptImagesForProject({ projectId: input.projectId }).catch(() => {});
    return { ok: true, expiresAt: null, unresolved: [], noImages: true };
  }

  const { data: existing, error: listErr } = await supabase
    .from("manuscript_cloud_images")
    .select("local_image_id, storage_path, mime, missing")
    .eq("project_id", input.projectId);
  if (listErr) {
    return { ok: false, expiresAt: null, unresolved: [], noImages: false, error: listErr.message };
  }
  const existingRows = existing ?? [];

  const locallyAvailable = new Set(
    Object.keys(input.localImages).filter((id) => dataUrlMime(input.localImages[id]) !== null)
  );
  const plan = planCloudImageSync(referenced, locallyAvailable, existingRows);

  // --- Phase 1: upload。**成功ごとに新しい世代パス**へ書く（deterministic
  //     upsert はやめた）。これで古い purge 実行は「読み取った世代」しか
  //     消せず、この同期で作る新オブジェクトへは物理的に触れられない。
  //     どれか失敗したら中断。既存 manifest / 既存オブジェクトは不変。
  const uploadedMeta: Record<
    string,
    { path: string; mime: Mime; size: number; previousPath?: string }
  > = {};
  const existingByIdMapEarly = new Map(existingRows.map((r) => [r.local_image_id, r]));
  for (const id of plan.toUpload) {
    const dataUrl = input.localImages[id];
    const mime = dataUrlMime(dataUrl);
    if (!mime) continue;
    let key: string;
    try {
      key = manuscriptImageObjectKey(userId, input.projectId, id, newImageGeneration(), mime);
    } catch (e) {
      return {
        ok: false,
        expiresAt: null,
        unresolved: plan.unresolved,
        noImages: false,
        error: e instanceof Error ? e.message : "unsafe path",
      };
    }
    const blob = await dataUrlToBlob(dataUrl);
    const { error: upErr } = await supabase.storage
      .from(MANUSCRIPT_IMAGE_BUCKET)
      .upload(key, blob, { contentType: mime, upsert: false });
    if (upErr) {
      return {
        ok: false,
        expiresAt: null,
        unresolved: plan.unresolved,
        noImages: false,
        error: upErr.message,
      };
    }
    uploadedMeta[id] = {
      path: `${MANUSCRIPT_IMAGE_BUCKET}/${key}`,
      mime,
      size: blob.size,
      previousPath: existingByIdMapEarly.get(id)?.storage_path,
    };
  }

  // --- Phase 2: manifest upsert（1 バッチ = 原子的）。全参照行を同一 expires_at へ。
  const expiresAtMs = nextExpiresAt(Date.now());
  const expiresAtIso = new Date(expiresAtMs).toISOString();
  const nowIso = new Date().toISOString();
  const existingByIdMap = new Map(existingRows.map((r) => [r.local_image_id, r]));

  const rows = referenced
    .map((id) => {
      const up = uploadedMeta[id];
      const prev = existingByIdMap.get(id);
      // tombstone（missing=true）は実体が無い → 新規 upload が無ければ復活させない。
      const usablePrev = prev && !prev.missing ? prev : undefined;
      const path = up?.path ?? usablePrev?.storage_path;
      const mime = up?.mime ?? usablePrev?.mime;
      if (!path || !mime) return null; // unresolved（端末にも有効な cloud にも無い）
      return {
        project_id: input.projectId,
        user_id: userId,
        local_image_id: id,
        storage_path: path,
        mime,
        byte_size: up?.size ?? 0,
        expires_at: expiresAtIso,
        missing: false,
        updated_at: nowIso,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) {
    return {
      ok: false,
      expiresAt: null,
      unresolved: plan.unresolved,
      noImages: false,
      error: "no uploadable images",
    };
  }

  const { error: upsertErr } = await supabase
    .from("manuscript_cloud_images")
    .upsert(rows, { onConflict: "project_id,local_image_id" });
  if (upsertErr) {
    return {
      ok: false,
      expiresAt: null,
      unresolved: plan.unresolved,
      noImages: false,
      error: upsertErr.message,
    };
  }

  // --- Phase 3: 掃除（すべて best-effort。manifest は上で正）。
  const bucketKey = (p: string) => p.replace(`${MANUSCRIPT_IMAGE_BUCKET}/`, "");

  // 3a. 参照されなくなった画像 → 行削除 + オブジェクト削除。
  const stalePaths = plan.toDeletePaths;
  if (stalePaths.length > 0) {
    const staleIds = existingRows
      .filter((r) => stalePaths.includes(r.storage_path))
      .map((r) => r.local_image_id);
    await supabase
      .from("manuscript_cloud_images")
      .delete()
      .eq("project_id", input.projectId)
      .in("local_image_id", staleIds)
      .then(() => {}, () => {});
    await supabase.storage
      .from(MANUSCRIPT_IMAGE_BUCKET)
      .remove(stalePaths.map(bucketKey))
      .then(() => {}, () => {});
  }

  // 3b. 再アップロードした画像の「古い世代」を掃除。manifest は既に新世代を
  //     指しているので、古い世代オブジェクトは孤児。世代フォルダを列挙して
  //     現行世代以外をすべて削除する（1画像あたり数個・軽量）。
  for (const id of Object.keys(uploadedMeta)) {
    const currentKey = bucketKey(uploadedMeta[id].path);
    let prefix: string;
    try {
      prefix = manuscriptImageIdPrefix(userId, input.projectId, id);
    } catch {
      continue;
    }
    const { data: listed } = await supabase.storage
      .from(MANUSCRIPT_IMAGE_BUCKET)
      .list(prefix, { limit: 100 });
    const orphanKeys = (listed ?? [])
      .map((o) => `${prefix}/${o.name}`)
      .filter((k) => k !== currentKey);
    if (orphanKeys.length > 0) {
      await supabase.storage.from(MANUSCRIPT_IMAGE_BUCKET).remove(orphanKeys).then(
        () => {},
        () => {}
      );
    }
  }

  const fullyResolved = plan.unresolved.length === 0;
  return {
    ok: fullyResolved,
    expiresAt: fullyResolved ? expiresAtMs : null,
    unresolved: plan.unresolved,
    noImages: false,
  };
}

export interface RestoreManuscriptImagesResult {
  /** 復元できた画像: 元の local id -> dataURL（本文マーカーと一致）。 */
  images: Record<string, string>;
  /** manifest にあるが Storage から取得できなかった id（case E: missing）。 */
  missing: string[];
  /** 本文が参照するが manifest にも無い id（未同期）。 */
  unmanifested: string[];
  expiresAt: number | null;
  error?: string;
}

/**
 * 別端末でクラウド作品を開いたときの画像復元。元の image id を維持する。
 * 取得失敗した行は manifest 側で missing=true にする（bookshelf が拾える）。
 */
export async function restoreManuscriptImages(
  projectId: string,
  content: string
): Promise<RestoreManuscriptImagesResult> {
  const supabase = createClient();
  const referenced = referencedImageIds(content);
  if (referenced.length === 0) {
    return { images: {}, missing: [], unmanifested: [], expiresAt: null };
  }

  const { data, error } = await supabase
    .from("manuscript_cloud_images")
    .select("local_image_id, storage_path, expires_at, missing")
    .eq("project_id", projectId);
  if (error) {
    return { images: {}, missing: [], unmanifested: referenced, expiresAt: null, error: error.message };
  }
  const rows = data ?? [];
  const rowById = new Map(rows.map((r) => [r.local_image_id, r]));
  const expiresAt = rows.length > 0
    ? Math.min(...rows.map((r) => new Date(r.expires_at).getTime()))
    : null;

  const images: Record<string, string> = {};
  const missing: string[] = [];
  const unmanifested: string[] = [];
  const newlyMissing: string[] = [];

  for (const id of referenced) {
    const row = rowById.get(id);
    if (!row) {
      unmanifested.push(id);
      continue;
    }
    if (row.missing) {
      // 既に tombstone（purge 済み or 既知欠損）。取りに行かない。
      missing.push(id);
      continue;
    }
    const key = row.storage_path.replace(`${MANUSCRIPT_IMAGE_BUCKET}/`, "");
    const { data: blob, error: dlErr } = await supabase.storage
      .from(MANUSCRIPT_IMAGE_BUCKET)
      .download(key);
    if (dlErr || !blob) {
      missing.push(id);
      newlyMissing.push(id);
      continue;
    }
    try {
      images[id] = await blobToDataUrl(blob);
    } catch {
      missing.push(id);
      newlyMissing.push(id);
    }
  }

  // 実体が取れなかった行だけ tombstone 化（expires_at は変えない）。
  if (newlyMissing.length > 0) {
    await supabase
      .from("manuscript_cloud_images")
      .update({ missing: true, updated_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .in("local_image_id", newlyMissing)
      .then(() => {}, () => {});
  }

  return { images, missing, unmanifested, expiresAt };
}

export interface ProjectCloudImageMeta {
  expiresAt: number | null;
  missing: boolean;
}

/**
 * bookshelf 用: ユーザーの全 manifest 行を **1 クエリ**で取り、プロジェクト
 * ごとに集約する。Storage への HEAD は一切発行しない。
 */
export async function getProjectCloudImageMetas(): Promise<Map<string, ProjectCloudImageMeta>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("manuscript_cloud_images")
    .select("project_id, expires_at, missing");
  const out = new Map<string, ProjectCloudImageMeta>();
  if (error || !data) return out;
  for (const row of data) {
    const t = new Date(row.expires_at).getTime();
    const cur = out.get(row.project_id);
    if (!cur) {
      out.set(row.project_id, { expiresAt: t, missing: Boolean(row.missing) });
    } else {
      out.set(row.project_id, {
        expiresAt: cur.expiresAt === null ? t : Math.min(cur.expiresAt, t),
        missing: cur.missing || Boolean(row.missing),
      });
    }
  }
  return out;
}

export interface DeleteManuscriptImagesInput {
  projectId: string;
}

/**
 * プロジェクト配下の cloud 画像（Storage オブジェクト + manifest 行）を撤去。
 * 他プロジェクト・他ユーザーには触れない（prefix と RLS で二重に保証）。
 * project 行自体を消す場合、manifest は FK cascade で消えるが、Storage は
 * cascade しないため呼び出し側がこれを呼ぶ。
 */
export async function deleteManuscriptImagesForProject(
  input: DeleteManuscriptImagesInput
): Promise<{ ok: boolean }> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { ok: false };
  const prefix = manuscriptImageProjectPrefix(userId, input.projectId);

  // まず現在の行から正確な object キー（現行世代）を得る。
  const { data: rows } = await supabase
    .from("manuscript_cloud_images")
    .select("local_image_id, storage_path")
    .eq("project_id", input.projectId);

  const keys = (rows ?? []).map((r) =>
    r.storage_path.replace(`${MANUSCRIPT_IMAGE_BUCKET}/`, "")
  );

  // 世代フォルダ構造（<uid>/<pid>/<imgId>/<gen>.<ext>）を 2 段掘って、
  // 古い世代・孤児も含めてすべて拾う（best-effort）。
  const imgIds = new Set<string>((rows ?? []).map((r) => r.local_image_id));
  const { data: subfolders } = await supabase.storage
    .from(MANUSCRIPT_IMAGE_BUCKET)
    .list(prefix, { limit: 1000 });
  for (const entry of subfolders ?? []) {
    // ファイル（旧フラット形式の名残）ならそのまま、フォルダなら 1 段掘る。
    if (entry.id === null || entry.metadata == null) imgIds.add(entry.name);
    else keys.push(`${prefix}/${entry.name}`);
  }
  for (const imgId of imgIds) {
    let idPrefix: string;
    try {
      idPrefix = manuscriptImageIdPrefix(userId, input.projectId, imgId);
    } catch {
      continue;
    }
    const { data: gens } = await supabase.storage
      .from(MANUSCRIPT_IMAGE_BUCKET)
      .list(idPrefix, { limit: 1000 });
    for (const g of gens ?? []) keys.push(`${idPrefix}/${g.name}`);
  }

  const uniqueKeys = [...new Set(keys)];
  if (uniqueKeys.length > 0) {
    await supabase.storage.from(MANUSCRIPT_IMAGE_BUCKET).remove(uniqueKeys).then(
      () => {},
      () => {}
    );
  }
  await supabase
    .from("manuscript_cloud_images")
    .delete()
    .eq("project_id", input.projectId)
    .then(() => {}, () => {});

  return { ok: true };
}

export type { ManuscriptImageManifestRow };
