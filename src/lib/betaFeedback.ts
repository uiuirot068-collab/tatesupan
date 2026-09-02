/**
 * TSP-LOOP-006 「β版フィードバック」 — shared pure model.
 *
 * β 期間限定の匿名フィードバック機能。ここは React / DOM / Deno に依存しない
 * 定数・型・検証ヘルパーだけを持つ。フロント（BetaFeedbackModal /
 * betaFeedbackClient）と検証スクリプト（scripts/verify-beta-feedback.mjs）が
 * これを共有する。Edge Function（supabase/functions/beta-feedback）は Deno
 * のため別ファイルだが、同じ allowlist / 上限値を複製し、verify スクリプトが
 * 両者の一致を突き合わせる。
 *
 * 重要:
 *  - この機能は β 限定。`NEXT_PUBLIC_BETA_FEEDBACK_ENABLED === "true"` の
 *    ときだけ「報告」ボタンが出る。false / 未設定なら通常 UI から到達不能。
 *  - 秘密情報（Discord Webhook / Apps Script URL・secret / Storage 鍵）は
 *    一切クライアントに出さない。フロントは同一 Supabase プロジェクトの
 *    Edge Function だけを叩く。
 *  - 原稿本文・作品タイトル・ドキュメント ID・選択テキスト・アカウント情報は
 *    絶対に自動収集しない。送るのはユーザーが明示入力したものだけ。
 */

/** β フラグ（公開値・secret ではない）。ビルド時に静的置換される。 */
export const BETA_FEEDBACK_ENABLED =
  process.env.NEXT_PUBLIC_BETA_FEEDBACK_ENABLED === "true";

/**
 * TSP-LOOP-014 — 公開 β 直前の一時無効化フラグ。
 *
 * X 公開に伴うスパム／悪質・不適切画像リスクを避けるため、フィードバックの
 * 画像添付を一時的に無効化する。**可逆的な一時措置**であり、実装（アップロード
 * コード / Storage bucket / migration / 既存画像）は一切削除しない。復帰時は
 * ここを `true` に戻し、Edge Function 側の同名フラグと verify の assertion を
 * 併せて戻すだけ。false の間: 添付 UI 非表示・クライアントは画像を送らない・
 * Edge Function は画像付きリクエストを安全に拒否。テキストのフィードバックと
 * review は通常どおり動作する。
 */
export const BETA_FEEDBACK_IMAGE_ATTACHMENTS_ENABLED = false;

/** レポートに載せるアプリバージョン（CI が sha を注入可能）。 */
export const BETA_FEEDBACK_APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0-beta";

export const BETA_FEEDBACK_FUNCTION_PATH = "/functions/v1/beta-feedback";

/* ------------------------------------------------------------------ *
 *  上限値 / allowlist（Edge Function 側でも必ず再検証する）
 * ------------------------------------------------------------------ */

export const MAX_FEEDBACK_IMAGES = 4;
/** 1 枚あたり 5MB。 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** リクエスト内の画像合計 20MB。 */
export const MAX_TOTAL_IMAGE_BYTES = 20 * 1024 * 1024;
/** 本文の最大文字数。 */
export const MAX_MESSAGE_LENGTH = 4000;
/** review メモの最大文字数。 */
export const MAX_REVIEW_NOTE_LENGTH = 2000;

/** 添付を許可する画像 MIME。SVG / HTML / PDF / 任意バイナリは不可。 */
export const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME)[number];

export const ALLOWED_IMAGE_EXT: Record<AllowedImageMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const BETA_FEEDBACK_TYPES = ["feedback", "review"] as const;
export type BetaFeedbackType = (typeof BETA_FEEDBACK_TYPES)[number];

/* ------------------------------------------------------------------ *
 *  マジックバイト（署名）検証 — MIME 偽装した非画像を弾く
 * ------------------------------------------------------------------ */

/**
 * 先頭バイト列から画像 MIME を判定する。判定不能なら null。
 * client / server 双方で使う（server が最終権威）。
 */
export function sniffImageMime(bytes: Uint8Array): AllowedImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  // RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/** 宣言 MIG と実バイト署名が一致し、許可リストにあるか。 */
export function isValidImage(declaredMime: string, bytes: Uint8Array): boolean {
  if (!(ALLOWED_IMAGE_MIME as readonly string[]).includes(declaredMime)) return false;
  const sniffed = sniffImageMime(bytes);
  return sniffed !== null && sniffed === declaredMime;
}

/* ------------------------------------------------------------------ *
 *  review チェックリスト（§17 の項目と完全一致させる）
 * ------------------------------------------------------------------ */

export const REVIEW_CHECKLIST_ITEMS = [
  "日本語の入力・編集",
  "保存・再読み込み",
  "プレビュー",
  "フォント・縦書き表示",
  "改ページ",
  "ルビ",
  "画像",
  "文章チェックβ",
  "ノンブル",
  "JPG書き出し",
  "PDF書き出し",
  "扉・縦書き奥付・目次",
  "横書き奥付",
  "横書き奥付のページ位置・配置",
  "スマホ表示",
] as const;

export const REVIEW_INTRO =
  "問題なく確認できた項目にチェックしてください。未チェック＝不具合という意味ではありません。";

export const FEEDBACK_GUIDANCE =
  "不具合・気になる事・要望など、思いついたときにお気軽にどうぞ！\n\n匿名で届くので、記名希望者は冒頭にお名前を入れてください！";

export const FEEDBACK_IMAGE_HINT = "必要な場合は画像を4枚まで添付できます。";

export const FEEDBACK_IMAGE_PRIVACY_NOTICE =
  "画像内に個人情報が含まれていないか、送信前にご確認ください。";

export const FEEDBACK_SUCCESS_MESSAGE = "ありがとうございます！届きました。";

export const FEEDBACK_FAILURE_MESSAGE =
  "送信できませんでした。少し時間をおいてもう一度お試しください。";

/* ------------------------------------------------------------------ *
 *  クライアントが送ってよい payload の形（自動収集項目は含めない）
 * ------------------------------------------------------------------ */

export interface BetaFeedbackClientContext {
  appVersion: string;
  /** window.location.pathname 相当。クエリ・ハッシュは含めない。 */
  path: string;
  /** "1280x720" 形式。 */
  viewport: string;
}

export interface FeedbackSubmission {
  type: "feedback";
  message: string;
  images: File[];
}

export interface ReviewSubmission {
  type: "review";
  /** チェックが付いた項目ラベル（REVIEW_CHECKLIST_ITEMS の部分集合）。 */
  checkedItems: string[];
  note: string;
}

export type BetaFeedbackSubmission = FeedbackSubmission | ReviewSubmission;

/** 送信可能か（完全空は不可。文章なし＋画像のみは可）。 */
export function canSubmitFeedback(message: string, imageCount: number): boolean {
  return message.trim().length > 0 || imageCount > 0;
}

/** クライアント側の即時バリデーション（サーバ側が最終権威）。 */
export function validateSubmissionShape(
  submission: BetaFeedbackSubmission
): { ok: true } | { ok: false; reason: string } {
  if (submission.type === "feedback") {
    // TSP-LOOP-014: 添付が一時無効のときは、UI を経由しない画像も弾く。
    if (!BETA_FEEDBACK_IMAGE_ATTACHMENTS_ENABLED && submission.images.length > 0) {
      return { ok: false, reason: "現在、画像の添付は一時的に受け付けていません。" };
    }
    if (!canSubmitFeedback(submission.message, submission.images.length)) {
      return { ok: false, reason: "本文または画像のどちらかを入力してください。" };
    }
    if (submission.message.length > MAX_MESSAGE_LENGTH) {
      return { ok: false, reason: "本文が長すぎます。" };
    }
    if (submission.images.length > MAX_FEEDBACK_IMAGES) {
      return { ok: false, reason: "画像は4枚までです。" };
    }
    let total = 0;
    for (const file of submission.images) {
      if (!(ALLOWED_IMAGE_MIME as readonly string[]).includes(file.type)) {
        return { ok: false, reason: "対応していない画像形式です（JPEG / PNG / WebP のみ）。" };
      }
      if (file.size > MAX_IMAGE_BYTES) {
        return { ok: false, reason: "画像1枚のサイズが大きすぎます（5MBまで）。" };
      }
      total += file.size;
    }
    if (total > MAX_TOTAL_IMAGE_BYTES) {
      return { ok: false, reason: "画像の合計サイズが大きすぎます（20MBまで）。" };
    }
    return { ok: true };
  }

  // review
  if (submission.note.length > MAX_REVIEW_NOTE_LENGTH) {
    return { ok: false, reason: "メモが長すぎます。" };
  }
  const known = new Set<string>(REVIEW_CHECKLIST_ITEMS);
  if (!submission.checkedItems.every((item) => known.has(item))) {
    return { ok: false, reason: "不正なチェック項目です。" };
  }
  return { ok: true };
}
