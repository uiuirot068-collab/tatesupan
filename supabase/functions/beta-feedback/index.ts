// TSP-LOOP-006 「β版フィードバック」 Supabase Edge Function (Deno).
//
// 匿名・公開エンドポイント。TateSpun static frontend からのみ呼ばれ、
//   frontend
//     -> this function
//        -> Supabase Storage (private bucket: beta-feedback-images)
//        -> Discord Webhook (feedback / review, 別チャンネル)
//        -> Google Apps Script Web App -> Spreadsheet (気になる事 / review)
//
// canonical record  = Spreadsheet (Apps Script append)
// canonical image    = Supabase private Storage
// Discord            = 通知のみ
//
// SECURITY 不変条件:
//  - 秘密情報（Discord Webhook URL / Apps Script URL・secret / service-role
//    key）は環境変数のみ。レスポンス／ログへ出さない。
//  - CORS は allowlist のみ（`*` 不可）。OPTIONS 対応。
//  - method / body size / MIME + magic bytes / count / 文字数 を必ず再検証。
//  - reportId / receivedAt はサーバ生成（クライアント値は信用しない）。
//  - Discord へは allowed_mentions:{parse:[]}。@everyone/@here/<@id> を無効化。
//  - 原稿本文・タイトル・ドキュメント ID 等は受け取っても無視（スキーマ外）。
//  - IP は rate-limit の一時参照のみ。保存・ログ・下流送信しない。

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

/* ------------------------------ constants ------------------------------ */

// TSP-LOOP-014 — 公開β直前の一時無効化。src/lib/betaFeedback.ts の
// BETA_FEEDBACK_IMAGE_ATTACHMENTS_ENABLED と必ず同じ値にすること
// （verify-beta-feedback.mjs が両者の一致を突き合わせる）。false の間、
// 画像フィールドを含むリクエストは 415 で安全に拒否し、Storage には一切
// 書き込まない。テキストのフィードバック / review は通常どおり受理する。
// 実装（storeImages / bucket / migration / 既存画像）は削除しない。
const IMAGE_ATTACHMENTS_ENABLED = false;

const MAX_FEEDBACK_IMAGES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_REVIEW_NOTE_LENGTH = 2000;
const MAX_BODY_BYTES = MAX_TOTAL_IMAGE_BYTES + 1 * 1024 * 1024; // + payload 余裕

const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedMime = (typeof ALLOWED_IMAGE_MIME)[number];
const EXT: Record<AllowedMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const STORAGE_BUCKET = "beta-feedback-images";

const REVIEW_CHECKLIST_ITEMS = [
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
];

const DEFAULT_ALLOWED_ORIGINS = [
  "https://tatespun.pages.dev",
  "http://localhost:3000",
];

/* ------------------------------ env ------------------------------ */

const env = (k: string) => Deno.env.get(k) ?? "";

const SUPABASE_URL = env("SUPABASE_URL");
const SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const DISCORD_FEEDBACK_WEBHOOK_URL = env("DISCORD_FEEDBACK_WEBHOOK_URL");
const DISCORD_REVIEW_WEBHOOK_URL = env("DISCORD_REVIEW_WEBHOOK_URL");
const GOOGLE_APPS_SCRIPT_URL = env("GOOGLE_APPS_SCRIPT_URL");
const GOOGLE_APPS_SCRIPT_SECRET = env("GOOGLE_APPS_SCRIPT_SECRET");
const ALLOWED_ORIGINS = (env("BETA_FEEDBACK_ALLOWED_ORIGINS")
  ? env("BETA_FEEDBACK_ALLOWED_ORIGINS").split(",").map((s) => s.trim())
  : DEFAULT_ALLOWED_ORIGINS
).filter(Boolean);

/* ------------------------------ helpers ------------------------------ */

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : "";
  const h: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Max-Age": "86400",
  };
  if (allow) h["Access-Control-Allow-Origin"] = allow;
  return h;
}

function json(
  body: unknown,
  status: number,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function sniffImageMime(bytes: Uint8Array): AllowedMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
    bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) return "image/png";
  if (
    bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 &&
    bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) return "image/webp";
  return null;
}

/** Discord メンション無効化。webhook payload に必ず付ける。 */
const ALLOWED_MENTIONS_NONE = { parse: [] as string[] };

function truncateForDiscord(text: string, limit = 1800): { text: string; truncated: boolean } {
  if (text.length <= limit) return { text, truncated: false };
  return { text: text.slice(0, limit), truncated: true };
}

/* --- Discord FORUM channel: 新規ポストごとに thread_name 必須（100 字上限） --- */
const DISCORD_THREAD_NAME_MAX = 100;

/** スレッド名用にユーザーテキストを安全化（改行・制御文字・連続空白を除去）。 */
function normalizeThreadText(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampThreadName(name: string): string {
  return name.length <= DISCORD_THREAD_NAME_MAX
    ? name
    : `${name.slice(0, DISCORD_THREAD_NAME_MAX - 1)}…`;
}

/** `気になる事｜<shortId>｜<shortMessage>` / 画像のみなら `…｜画像のみ`。reportId 必須（Sheet 照合用）。 */
function feedbackThreadName(reportId: string, message: string): string {
  const base = `気になる事｜${reportId.slice(0, 8)}｜`;
  const clean = normalizeThreadText(message);
  const tail = clean.length > 0
    ? clean.slice(0, Math.max(1, DISCORD_THREAD_NAME_MAX - base.length))
    : "画像のみ";
  return clampThreadName(base + tail);
}

/** `review｜<shortId>｜<checked>/15`。個人情報はタイトルへ入れない。 */
function reviewThreadName(reportId: string, checkedCount: number): string {
  return clampThreadName(`review｜${reportId.slice(0, 8)}｜${checkedCount}/15`);
}

/**
 * Webhook URL へ `?wait=true` を安全に付与する。Discord が message/thread の
 * 作成受理を返すまで待ち、discordStatus="sent" の精度を上げる。
 * URL 自体は絶対に log しない。
 */
function webhookWithWait(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("wait", "true");
    return u.toString();
  } catch {
    return url;
  }
}

/* --- best-effort in-memory rate limit (per isolate, IP は保存しない) --- */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 6;
const rateBucket = new Map<string, number[]>();

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`beta-feedback:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest).slice(0, 8)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function isRateLimited(req: Request): Promise<boolean> {
  const ip =
    req.headers.get("cf-connecting-ip") ??
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  if (!ip) return false;
  const key = await hashIp(ip); // 一時的なハッシュ。保存も下流送信もしない。
  const now = Date.now();
  const hits = (rateBucket.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  rateBucket.set(key, hits);
  if (rateBucket.size > 5000) rateBucket.clear(); // 暴走ガード
  return hits.length > RATE_MAX;
}

/* ------------------------------ downstream ------------------------------ */

interface StoredImage {
  /** 永続参照。beta-feedback-images/<reportId>/<uuid>.<ext> */
  path: string;
  bytes: Uint8Array;
  mime: AllowedMime;
}

async function storeImages(
  supabase: ReturnType<typeof createClient>,
  reportId: string,
  images: { bytes: Uint8Array; mime: AllowedMime }[],
): Promise<{ ok: boolean; stored: StoredImage[] }> {
  const stored: StoredImage[] = [];
  for (const img of images) {
    const key = `${reportId}/${crypto.randomUUID()}.${EXT[img.mime]}`;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(key, img.bytes, { contentType: img.mime, upsert: false });
    if (error) {
      // 途中まで作った object を掃除する。
      await cleanupImages(supabase, stored.map((s) => s.path));
      return { ok: false, stored: [] };
    }
    stored.push({ path: `${STORAGE_BUCKET}/${key}`, bytes: img.bytes, mime: img.mime });
  }
  return { ok: true, stored };
}

async function cleanupImages(
  supabase: ReturnType<typeof createClient>,
  paths: string[],
): Promise<void> {
  if (paths.length === 0) return;
  const keys = paths.map((p) => p.replace(`${STORAGE_BUCKET}/`, ""));
  try {
    await supabase.storage.from(STORAGE_BUCKET).remove(keys);
  } catch {
    // best-effort
  }
}

async function notifyDiscordFeedback(
  reportId: string,
  appVersion: string,
  message: string,
  images: StoredImage[],
): Promise<"sent" | "failed" | "skipped"> {
  if (!DISCORD_FEEDBACK_WEBHOOK_URL) return "skipped";
  const { text: safeMsg, truncated } = truncateForDiscord(message.trim());
  const bodyText =
    `【TateSpun β / 気になる事】\n\n` +
    `ID: ${reportId}\n` +
    `Version: ${appVersion}\n\n` +
    `本文：\n${safeMsg || "（本文なし・画像のみ）"}` +
    (truncated ? "\n\n…（全文はスプレッドシートを確認）" : "");

  try {
    const form = new FormData();
    form.set(
      "payload_json",
      JSON.stringify({
        // FORUM channel: 1 feedback = 1 新規スレッド。thread_name 必須。
        thread_name: feedbackThreadName(reportId, message),
        content: bodyText,
        allowed_mentions: ALLOWED_MENTIONS_NONE,
      }),
    );
    images.slice(0, MAX_FEEDBACK_IMAGES).forEach((img, i) => {
      form.set(
        `files[${i}]`,
        new Blob([img.bytes], { type: img.mime }),
        `image${i + 1}.${EXT[img.mime]}`,
      );
    });
    const res = await fetch(webhookWithWait(DISCORD_FEEDBACK_WEBHOOK_URL), {
      method: "POST",
      body: form,
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

async function notifyDiscordReview(
  reportId: string,
  appVersion: string,
  checkedItems: string[],
  note: string,
): Promise<"sent" | "failed" | "skipped"> {
  if (!DISCORD_REVIEW_WEBHOOK_URL) return "skipped";
  const checkedSet = new Set(checkedItems);
  const lines = REVIEW_CHECKLIST_ITEMS.map(
    (item) => `${checkedSet.has(item) ? "✅" : "⬜"} ${item}`,
  ).join("\n");
  const { text: safeNote } = truncateForDiscord(note.trim(), 1200);
  const checkedCount = new Set(checkedItems).size;
  const bodyText =
    `【TateSpun β / review】\n\n` +
    `ID: ${reportId}\n` +
    `Version: ${appVersion}\n\n` +
    `${lines}\n\n` +
    `メモ：\n${safeNote || "（なし）"}`;
  try {
    const res = await fetch(webhookWithWait(DISCORD_REVIEW_WEBHOOK_URL), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // FORUM channel: 1 review = 1 新規スレッド。thread_name 必須。
        thread_name: reviewThreadName(reportId, checkedCount),
        content: bodyText,
        allowed_mentions: ALLOWED_MENTIONS_NONE,
      }),
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

async function appendToSpreadsheet(payload: Record<string, unknown>): Promise<boolean> {
  if (!GOOGLE_APPS_SCRIPT_URL || !GOOGLE_APPS_SCRIPT_SECRET) return false;
  try {
    const res = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: GOOGLE_APPS_SCRIPT_SECRET, ...payload }),
    });
    if (!res.ok) return false;
    const j = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return j?.ok === true;
  } catch {
    return false;
  }
}

/* ------------------------------ handler ------------------------------ */

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, origin);
  }
  // allowlist 外 origin は拒否（ブラウザからの実リクエストは弾かれる）。
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return json({ ok: false, error: "origin_not_allowed" }, 403, origin);
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength && contentLength > MAX_BODY_BYTES) {
    return json({ ok: false, error: "payload_too_large" }, 413, origin);
  }

  if (await isRateLimited(req)) {
    return json({ ok: false, error: "rate_limited" }, 429, origin);
  }

  const reportId = crypto.randomUUID();
  const receivedAt = new Date().toISOString();

  // ---- parse ----
  let type: string;
  let message = "";
  let checkedItems: string[] = [];
  let note = "";
  let clientContext: { appVersion?: string; path?: string; viewport?: string } = {};
  const rawImages: { bytes: Uint8Array; mime: AllowedMime }[] = [];

  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const payloadRaw = form.get("payload");
      const payload = JSON.parse(typeof payloadRaw === "string" ? payloadRaw : "{}");
      type = String(payload.type ?? "");
      message = typeof payload.message === "string" ? payload.message : "";
      clientContext = payload.clientContext ?? {};
      let total = 0;
      for (let i = 0; i < MAX_FEEDBACK_IMAGES; i++) {
        const f = form.get(`image${i}`);
        if (!(f instanceof File)) continue;
        // TSP-LOOP-014: 添付が一時無効の間は、画像付きリクエストを安全に拒否
        // （Storage には触れない）。テキストのみのリクエストはここを通らない。
        if (!IMAGE_ATTACHMENTS_ENABLED) {
          return json({ ok: false, error: "image_attachments_disabled" }, 415, origin);
        }
        const buf = new Uint8Array(await f.arrayBuffer());
        total += buf.byteLength;
        if (buf.byteLength > MAX_IMAGE_BYTES || total > MAX_TOTAL_IMAGE_BYTES) {
          return json({ ok: false, error: "image_too_large" }, 413, origin);
        }
        const sniffed = sniffImageMime(buf);
        if (!sniffed || !(ALLOWED_IMAGE_MIME as readonly string[]).includes(f.type) || sniffed !== f.type) {
          return json({ ok: false, error: "invalid_image" }, 415, origin);
        }
        rawImages.push({ bytes: buf, mime: sniffed });
      }
    } else if (ct.includes("application/json")) {
      const payload = await req.json();
      type = String(payload.type ?? "");
      message = typeof payload.message === "string" ? payload.message : "";
      checkedItems = Array.isArray(payload.checkedItems)
        ? payload.checkedItems.filter((x: unknown): x is string => typeof x === "string")
        : [];
      note = typeof payload.note === "string" ? payload.note : "";
      clientContext = payload.clientContext ?? {};
    } else {
      return json({ ok: false, error: "unsupported_content_type" }, 415, origin);
    }
  } catch {
    return json({ ok: false, error: "bad_request" }, 400, origin);
  }

  if (type !== "feedback" && type !== "review") {
    return json({ ok: false, error: "unknown_type" }, 400, origin);
  }
  if (rawImages.length > MAX_FEEDBACK_IMAGES) {
    return json({ ok: false, error: "too_many_images" }, 400, origin);
  }

  const appVersion = String(clientContext.appVersion ?? "").slice(0, 64);
  const path = String(clientContext.path ?? "").slice(0, 256);
  const viewport = String(clientContext.viewport ?? "").slice(0, 32);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  /* --------------------------- feedback --------------------------- */
  if (type === "feedback") {
    message = message.slice(0, MAX_MESSAGE_LENGTH);
    if (message.trim().length === 0 && rawImages.length === 0) {
      return json({ ok: false, error: "empty" }, 400, origin);
    }

    // 1. images -> private Storage (canonical)
    let stored: StoredImage[] = [];
    if (rawImages.length > 0) {
      const result = await storeImages(supabase, reportId, rawImages);
      if (!result.ok) {
        console.error(
          JSON.stringify({ reportId, imageStorageStatus: "failed", spreadsheetStatus: "skipped", discordStatus: "skipped" }),
        );
        return json({ ok: false, error: "storage_failed" }, 502, origin);
      }
      stored = result.stored;
    }

    // 2. Discord notification (best-effort)
    const discordStatus = await notifyDiscordFeedback(reportId, appVersion, message, stored);

    // 3. Spreadsheet append (canonical success condition)
    const imagePaths = stored.map((s) => s.path);
    const sheetOk = await appendToSpreadsheet({
      type: "feedback",
      receivedAt,
      reportId,
      appVersion,
      path,
      viewport,
      message,
      images: imagePaths,
      discordStatus,
    });

    console.error(
      JSON.stringify({
        reportId,
        imageStorageStatus: rawImages.length > 0 ? "ok" : "none",
        spreadsheetStatus: sheetOk ? "ok" : "failed",
        discordStatus,
      }),
    );

    if (!sheetOk) {
      // canonical record が作れなかった -> success 扱いにしない。
      // 孤立 object を掃除して、ユーザーには再送を促す。
      await cleanupImages(supabase, imagePaths);
      return json({ ok: false, error: "record_failed" }, 502, origin);
    }

    // Discord のみ失敗でも record はあるので accepted。
    return json({ ok: true, reportId }, 200, origin);
  }

  /* ---------------------------- review ---------------------------- */
  note = note.slice(0, MAX_REVIEW_NOTE_LENGTH);
  const known = new Set(REVIEW_CHECKLIST_ITEMS);
  const cleanChecked = checkedItems.filter((x) => known.has(x));
  const checkedCount = cleanChecked.length;
  const reviewItems = REVIEW_CHECKLIST_ITEMS
    .map((item) => `${cleanChecked.includes(item) ? "✅" : "⬜"} ${item}`)
    .join("\n");

  const discordStatus = await notifyDiscordReview(reportId, appVersion, cleanChecked, note);

  const sheetOk = await appendToSpreadsheet({
    type: "review",
    receivedAt,
    reportId,
    appVersion,
    path,
    viewport,
    checkedCount,
    reviewItems,
    note,
    discordStatus,
  });

  console.error(
    JSON.stringify({
      reportId,
      imageStorageStatus: "none",
      spreadsheetStatus: sheetOk ? "ok" : "failed",
      discordStatus,
    }),
  );

  if (!sheetOk) {
    return json({ ok: false, error: "record_failed" }, 502, origin);
  }
  return json({ ok: true, reportId }, 200, origin);
});

