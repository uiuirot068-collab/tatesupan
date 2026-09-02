/**
 * TSP-LOOP-006 — フロントから Edge Function を叩く送信ロジックだけを分離。
 *
 * - 呼び先は「同一 Supabase プロジェクトの Edge Function」ただ 1 つ。
 *   Discord Webhook / Google Apps Script / Storage 鍵には一切触れない。
 * - 送るのはユーザーが明示入力したものと clientContext（appVersion / path /
 *   viewport）のみ。原稿・タイトル・ドキュメント ID などは決して含めない。
 * - サーバのエラー本文（stack / secret を含みうる）をそのまま UI へ出さない。
 */
import {
  BETA_FEEDBACK_APP_VERSION,
  BETA_FEEDBACK_FUNCTION_PATH,
  BETA_FEEDBACK_IMAGE_ATTACHMENTS_ENABLED,
  type BetaFeedbackClientContext,
  type BetaFeedbackSubmission,
} from "./betaFeedback";

function readClientContext(): BetaFeedbackClientContext {
  let path = "";
  let viewport = "";
  try {
    // クエリ文字列・ハッシュは載せない（作品 ID などが混じらないように）。
    path = window.location.pathname;
    viewport = `${window.innerWidth}x${window.innerHeight}`;
  } catch {
    // SSR / 制限環境。空のまま送る。
  }
  return { appVersion: BETA_FEEDBACK_APP_VERSION, path, viewport };
}

function functionUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !base.startsWith("http")) return null;
  return `${base.replace(/\/$/, "")}${BETA_FEEDBACK_FUNCTION_PATH}`;
}

/**
 * フィードバック / review を送信する。
 * 成功なら `{ ok: true }`、失敗なら `{ ok: false }`（詳細はログのみ、UI へは
 * 汎用文言）。呼び出し側は失敗時に入力内容を保持する。
 */
export async function submitBetaFeedback(
  submission: BetaFeedbackSubmission
): Promise<{ ok: boolean }> {
  const url = functionUrl();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { ok: false };
  }

  const context = readClientContext();

  let body: BodyInit;
  const headers: Record<string, string> = {
    // Supabase API Gateway 用（anon key は公開値・RLS 前提で安全）。
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };

  if (submission.type === "feedback") {
    const form = new FormData();
    form.set(
      "payload",
      JSON.stringify({
        type: "feedback",
        message: submission.message,
        clientContext: context,
      })
    );
    // TSP-LOOP-014: 添付が一時無効の間は、submission に画像があっても送らない。
    if (BETA_FEEDBACK_IMAGE_ATTACHMENTS_ENABLED) {
      submission.images.slice(0, 4).forEach((file, i) => {
        form.set(`image${i}`, file, file.name || `image${i}`);
      });
    }
    body = form;
    // multipart の boundary はブラウザに任せる（Content-Type を手で付けない）。
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({
      type: "review",
      checkedItems: submission.checkedItems,
      note: submission.note,
      clientContext: context,
    });
  }

  try {
    const res = await fetch(url, { method: "POST", headers, body });
    if (!res.ok) return { ok: false };
    const json = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return { ok: json?.ok === true };
  } catch {
    return { ok: false };
  }
}
