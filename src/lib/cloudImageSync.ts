/**
 * TSP-LOOP-007 — クラウド作品の挿絵を72時間だけ private Storage へ一時同期する
 * ための「純粋ロジック」層。React / DOM / Supabase に依存しない。
 *
 * 背景（P1 data-integrity bug）:
 *   従来クラウド保存は title / content / settings のみ DB へ保存し、挿絵は
 *   その端末の IndexedDB にしか無かった。別端末でクラウド作品を開くと画像が
 *   復元されず、PDF/JPG に画像欠損が起こり得た。
 *
 * 契約:
 *   - 本文 content の 【IMG:id:...】 マーカーが canonical。ここから「現在
 *     参照されている画像 id」を取り出し、その集合だけを Storage へ同期する。
 *   - cloud 画像の寿命 = 「画像を含むクラウド保存が *完全成功* した時点から
 *     72 時間」。DB 保存だけ成功では延長しない（refresh 条件は呼び出し側）。
 *   - local IndexedDB の元画像は決して削除しない（cloud 期限切れでも）。
 *
 * このファイルの警告ステートマシンは bookshelf / 作品詳細 / エクスポート
 * 警告の唯一の真実源。時間境界テストは注入した `now` で行う（実時間 sleep
 * 禁止）。
 */

/** cloud 画像の保持時間（時間）。canonical。 */
export const CLOUD_IMAGE_TTL_HOURS = 72;
/** 期限まで何時間を切ったら bookshelf / 詳細に ⚠️ を出すか。canonical。 */
export const CLOUD_IMAGE_WARNING_HOURS = 5;

export const CLOUD_IMAGE_TTL_MS = CLOUD_IMAGE_TTL_HOURS * 60 * 60 * 1000;
export const CLOUD_IMAGE_WARNING_MS = CLOUD_IMAGE_WARNING_HOURS * 60 * 60 * 1000;

/** Storage バケット名（private・専用。feedback 用とは完全に別）。 */
export const MANUSCRIPT_IMAGE_BUCKET = "manuscript-cloud-images";

/** 許可する挿絵の MIME（Storage / manifest 双方で検証）。 */
export const MANUSCRIPT_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
export type ManuscriptImageMime = (typeof MANUSCRIPT_IMAGE_MIME)[number];

export const MANUSCRIPT_IMAGE_EXT: Record<ManuscriptImageMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/* ------------------------------------------------------------------ *
 *  本文マーカーから「現在参照されている画像 id」を取り出す
 * ------------------------------------------------------------------ */

// tategaki.ts の MARKER_PATTERN と同じ 【IMG:<id>:...】 形。id 部分だけ拾う。
// 共有の可変 lastIndex を避けるため、呼ぶたびに新しい RegExp を作る。
function imgIdPattern(): RegExp {
  return /【IMG:([^:：】]+):/g;
}

/** content 中で実際に参照されている挿絵 id を出現順・重複なしで返す。 */
export function referencedImageIds(content: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of content.matchAll(imgIdPattern())) {
    const id = m[1]?.trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** content が挿絵を1枚でも参照しているか。 */
export function contentHasImages(content: string): boolean {
  return imgIdPattern().test(content);
}

/* ------------------------------------------------------------------ *
 *  Storage パス — user / project / image を安全に分離
 * ------------------------------------------------------------------ */

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

/**
 * 成功アップロードごとに新しい「世代」トークンを生成する。
 * これにより Storage パスが毎回変わり、古い purge 実行が「読み取った世代」の
 * オブジェクトしか消せなくなる（再同期後の新オブジェクトは別パス＝物理的に
 * 触れない）。時刻順に並ぶよう先頭に base36 時刻を置く。
 */
export function newImageGeneration(now: number = Date.now()): string {
  const t = Math.floor(now).toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `g${t}${rand}`;
}

/**
 * Storage オブジェクトキー: `<userId>/<projectId>/<localImageId>/<generation>.<ext>`
 * - 先頭セグメントが所有者 uuid。Storage RLS はこれを auth.uid() と突き合わせる。
 * - `<generation>` は毎回のアップロードで新規（deterministic upsert をやめた）。
 * - 元ファイル名は一切使わない。path traversal 防止に各セグメントを検証。
 */
export function manuscriptImageObjectKey(
  userId: string,
  projectId: string,
  localImageId: string,
  generation: string,
  mime: ManuscriptImageMime
): string {
  for (const seg of [userId, projectId, localImageId, generation]) {
    if (!seg || !SAFE_SEGMENT.test(seg)) {
      throw new Error(`unsafe storage path segment: ${JSON.stringify(seg)}`);
    }
  }
  return `${userId}/${projectId}/${localImageId}/${generation}.${MANUSCRIPT_IMAGE_EXT[mime]}`;
}

/** 1画像ぶんの世代フォルダ（`<uid>/<pid>/<imgId>`）。古い世代の掃除・一覧用。 */
export function manuscriptImageIdPrefix(
  userId: string,
  projectId: string,
  localImageId: string
): string {
  for (const seg of [userId, projectId, localImageId]) {
    if (!seg || !SAFE_SEGMENT.test(seg)) {
      throw new Error(`unsafe storage path segment: ${JSON.stringify(seg)}`);
    }
  }
  return `${userId}/${projectId}/${localImageId}`;
}

/** プロジェクト配下の全画像を指すプレフィックス（削除・一覧用）。 */
export function manuscriptImageProjectPrefix(userId: string, projectId: string): string {
  for (const seg of [userId, projectId]) {
    if (!seg || !SAFE_SEGMENT.test(seg)) {
      throw new Error(`unsafe storage path segment: ${JSON.stringify(seg)}`);
    }
  }
  return `${userId}/${projectId}`;
}

/* ------------------------------------------------------------------ *
 *  マニフェスト行の型（DB: public.manuscript_cloud_images）
 * ------------------------------------------------------------------ */

export interface ManuscriptImageManifestRow {
  project_id: string;
  user_id: string;
  /** 本文マーカーの id（= IndexedDB ImageRecord.id）。復元時に維持する。 */
  local_image_id: string;
  storage_path: string;
  mime: string;
  byte_size: number;
  /** この行が有効な期限（ISO）。プロジェクト内の全行で同一値に保つ。 */
  expires_at: string;
  /** tombstone: 実体が削除済み（purge / 欠損確定）だが行は残す。再同期成功で false。 */
  missing: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * プロジェクト単位の cloud 画像状態。bookshelf / 詳細 / エクスポート警告が
 * これだけを見る（Storage への HEAD 連打はしない）。
 */
export interface ProjectCloudImageStatus {
  /** content が挿絵を参照しているか。false なら期限表示自体を出さない。 */
  hasReferencedImages: boolean;
  /** マニフェスト上の期限（全行共通）。未同期なら null。 */
  expiresAt: number | null;
  /**
   * 実 fetch で 404 / 取得失敗が確定した画像があるか（open / restore 時に
   * 判明したもの。bookshelf は DB の sync_status からこれを受け取る）。
   */
  missing: boolean;
}

/**
 * 一元化した canonical ステータス。UI ごとに独自の条件分岐を増やさず、
 * すべて（本棚デスクトップ hover / モバイル tap / 作品詳細 / エディタ帯 /
 * エクスポートブロック / プレースホルダ）がこの helper だけを見る。
 *
 *  NONE            参照画像なし / 健全で >5h
 *  EXPIRING        有効・残り <=5h
 *  MISSING         期限内なのに Storage 取得不能（想定外欠損）
 *  EXPIRED_DELETED 期限切れ（72h 経過。オブジェクトは削除済み or 削除待ち）
 */
export type CloudImageStatusCode = "NONE" | "EXPIRING" | "MISSING" | "EXPIRED_DELETED";

/** 後方互換の粗いレベル（既存 UI / テストが参照）。 */
export type CloudImageWarningLevel = "none" | "warning" | "missing" | "expired";

export interface CloudImageWarning {
  status: CloudImageStatusCode;
  /** 後方互換。NONE→none / EXPIRING→warning / MISSING→missing / EXPIRED_DELETED→expired */
  level: CloudImageWarningLevel;
  /** EXPIRING のときの残り時間（時間・切り上げ、最低1）。それ以外 null。 */
  hoursRemaining: number | null;
  /** EXPIRING / EXPIRED_DELETED のときの期限時刻（ms）。それ以外 null。 */
  expiresAt: number | null;
}

const LEVEL_OF: Record<CloudImageStatusCode, CloudImageWarningLevel> = {
  NONE: "none",
  EXPIRING: "warning",
  MISSING: "missing",
  EXPIRED_DELETED: "expired",
};

/**
 * 警告ステートマシン（唯一の真実源）。優先順位（§9）:
 *
 *  1. 参照画像なし                         → NONE
 *  2. expiresAt <= now                     → EXPIRED_DELETED
 *       （missing フラグの有無に関わらず。72h 到達＝オブジェクト削除済み扱い。
 *         purge が少し遅れても UI は期限時刻で判定する）
 *  3. missing===true（かつ期限内）          → MISSING（想定外欠損）
 *  4. 期限情報なし（未同期）                 → NONE
 *  5. 0 < 残り <= 5h                        → EXPIRING
 *  6. それ以外（>5h）                        → NONE（健全）
 */
export function computeCloudImageWarning(
  status: ProjectCloudImageStatus,
  now: number
): CloudImageWarning {
  const make = (
    code: CloudImageStatusCode,
    hoursRemaining: number | null = null,
    expiresAt: number | null = null
  ): CloudImageWarning => ({
    status: code,
    level: LEVEL_OF[code],
    hoursRemaining,
    expiresAt,
  });

  if (!status.hasReferencedImages) return make("NONE");

  if (status.expiresAt !== null && status.expiresAt - now <= 0) {
    return make("EXPIRED_DELETED", null, status.expiresAt);
  }
  if (status.missing) {
    return make("MISSING", null, status.expiresAt);
  }
  if (status.expiresAt === null) return make("NONE");

  const remaining = status.expiresAt - now;
  if (remaining <= CLOUD_IMAGE_WARNING_MS) {
    return make(
      "EXPIRING",
      Math.max(1, Math.ceil(remaining / (60 * 60 * 1000))),
      status.expiresAt
    );
  }
  return make("NONE");
}

/** 新しい期限 = 同期完全成功時刻 + 72h。 */
export function nextExpiresAt(syncSucceededAt: number): number {
  return syncSucceededAt + CLOUD_IMAGE_TTL_MS;
}

/* ------------------------------------------------------------------ *
 *  UI 文言（bookshelf tooltip / 作品詳細 / エクスポート警告）
 * ------------------------------------------------------------------ */

/**
 * ⚠️ アイコンの hover / tap / aria-label に出す短い説明。
 * 「元の端末から保存すれば復元できる」とは断定しない（72h 後は cloud も
 * 現端末の local original も無いことがある）。canonical wording は「再配置」。
 */
export function cloudImageWarningLabel(w: CloudImageWarning): string {
  switch (w.status) {
    case "EXPIRING":
      return `削除まであと約${w.hoursRemaining}時間`;
    case "EXPIRED_DELETED":
      return "画像削除済み・再配置をお願いします";
    case "MISSING":
      return "画像を取得できません・再配置をお願いします";
    case "NONE":
      return "";
  }
}

/** 期限切れプレースホルダ／エクスポートブロックで使う本文。 */
export const CLOUD_IMAGE_EXPIRED_HEADLINE = "⚠️ 画像の保存期限が切れています";
export const CLOUD_IMAGE_REPLACE_PROMPT = "画像を再度配置してください";
export const CLOUD_IMAGE_EXPORT_BLOCK_TITLE = "⚠️ 書き出しできません";
export const CLOUD_IMAGE_EXPORT_BLOCK_BODY =
  "保存期限切れ、または取得できない画像があります。画像を再度配置してから書き出してください。";

/** 作品詳細用の1行表示（画像なしなら空文字＝表示しない）。 */
export function cloudImageDetailLine(
  status: ProjectCloudImageStatus,
  now: number,
  formatDateTime: (ms: number) => string
): string {
  const w = computeCloudImageWarning(status, now);
  if (!status.hasReferencedImages) return "";
  switch (w.status) {
    case "MISSING":
      return "⚠️ クラウド画像：取得できません・再配置をお願いします";
    case "EXPIRED_DELETED":
      return "⚠️ クラウド画像：削除済み・再配置をお願いします";
    case "EXPIRING":
      return `⚠️ クラウド画像：削除まであと約${w.hoursRemaining}時間（${formatDateTime(
        w.expiresAt as number
      )}）`;
    case "NONE":
      return status.expiresAt !== null
        ? `クラウド画像：${formatDateTime(status.expiresAt)} まで`
        : "";
  }
}

/* ------------------------------------------------------------------ *
 *  同期プラン — content と「今 cloud にある行」から差分を出す
 * ------------------------------------------------------------------ */

export interface CloudImageSyncPlan {
  /** アップロード（新規 or 差し替え）すべき local image id。 */
  toUpload: string[];
  /** cloud から消すべき（本文がもう参照していない）storage_path。 */
  toDeletePaths: string[];
  /** 本文が参照しているが端末にも cloud にも無い＝アップロード不能な id。 */
  unresolved: string[];
}

/**
 * @param referenced       本文が今参照している画像 id（referencedImageIds）
 * @param locallyAvailable 端末 IndexedDB にデータがある画像 id の集合
 * @param existingRows     現在の cloud マニフェスト行（tombstone 含む）
 */
export function planCloudImageSync(
  referenced: string[],
  locallyAvailable: Set<string>,
  existingRows: Pick<ManuscriptImageManifestRow, "local_image_id" | "storage_path" | "missing">[]
): CloudImageSyncPlan {
  const referencedSet = new Set(referenced);
  const existingById = new Map(existingRows.map((r) => [r.local_image_id, r]));

  const toUpload: string[] = [];
  const unresolved: string[] = [];
  for (const id of referenced) {
    if (locallyAvailable.has(id)) {
      toUpload.push(id);
      continue;
    }
    const row = existingById.get(id);
    if (!row || row.missing) {
      // cloud にも無い or purge 済み tombstone で、端末にも元画像が無い
      // → アップロード不能（期限延長もできない）。
      unresolved.push(id);
    }
    // 端末に無いが有効な cloud オブジェクトがある → そのまま使う（期限は延長）。
  }

  const toDeletePaths: string[] = [];
  for (const row of existingRows) {
    if (!referencedSet.has(row.local_image_id)) toDeletePaths.push(row.storage_path);
  }

  return { toUpload, toDeletePaths, unresolved };
}
