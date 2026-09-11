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
//
// TSP-LOOP-019 hardening:
//  - Cloudflare Turnstile を**必須**。missing / invalid / expired / action 不一致 /
//    hostname 不一致 → 拒否。TURNSTILE_SECRET_KEY 欠如・siteverify 通信失敗は
//    fail-closed。token / secret / siteverify raw は絶対に log しない。
//  - honeypot（bot 専用の非表示フィールド）に値があれば downstream を一切
//    実行せず汎用エラー。
//  - Spreadsheet セルの式インジェクション対策（Apps Script payload のみ。
//    Discord 本文は不変）。

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
// TSP-LOOP-019: Cloudflare Turnstile。secret key はここでのみ読む。フロントの
// src/lib/betaFeedback.ts TURNSTILE_ACTION / isAllowedTurnstileHostname と一致
// させること（verify-beta-feedback.mjs が突き合わせる）。
const TURNSTILE_SECRET_KEY = env("TURNSTILE_SECRET_KEY");
const TURNSTILE_ACTION = "tatespun-feedback";
const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const OFFICIAL_TEST_TURNSTILE_SECRETS = new Set([
  "1x0000000000000000000000000000000AA",
  "2x0000000000000000000000000000000AA",
  "3x0000000000000000000000000000000AA",
]);
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

/* --- TSP-LOOP-019: Turnstile server verification (fail-closed) --- */

function isAllowedTurnstileHostname(hostname: unknown): boolean {
  const h = (typeof hostname === "string" ? hostname : "").trim().toLowerCase();
  return (
    h === "spuntales.net" ||
    h === "tatespun.pages.dev" ||
    h.endsWith(".tatespun.pages.dev") ||
    (OFFICIAL_TEST_TURNSTILE_SECRETS.has(TURNSTILE_SECRET_KEY) &&
      (h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0"))
  );
}

/**
 * token を Cloudflare siteverify で検証する。secret / token / raw response は
 * 一切 log しない。ユーザー IP は下流へ送らない（remoteip を付けない）。
 * 返り値の `code` は内部診断用のみ——クライアントへは汎用エラーだけ返す。
 */
async function verifyTurnstile(
  token: string,
): Promise<{ ok: true } | { ok: false; retriable: boolean }> {
  if (!TURNSTILE_SECRET_KEY) return { ok: false, retriable: true }; // fail-closed
  if (!token) return { ok: false, retriable: false };

  let data: { success?: boolean; action?: string; hostname?: string } | null = null;
  try {
    const body = new URLSearchParams();
    body.set("secret", TURNSTILE_SECRET_KEY);
    body.set("response", token);
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) return { ok: false, retriable: true }; // fail-closed
    data = await res.json();
  } catch {
    return { ok: false, retriable: true }; // fail-closed
  }

  if (!data || data.success !== true) return { ok: false, retriable: false };
  if (data.action !== TURNSTILE_ACTION) return { ok: false, retriable: false };
  if (!isAllowedTurnstileHostname(data.hostname)) return { ok: false, retriable: false };
  return { ok: true };
}

/**
 * TSP-LOOP-019: Google Sheets / Excel 式インジェクション対策。値が（先頭の
 * 空白・制御文字を除いて）`= + - @` で始まる、またはタブ / CR で始まる場合、
 * アポストロフィを前置してテキストとして扱わせる。内容は削らない。
 * **Apps Script payload を組む時だけ**使う——Discord 本文には適用しない。
 * src/lib/betaFeedback.ts sanitizeSheetCell と同一ロジック。
 */
function sanitizeSheetCell(value: string): string {
  if (typeof value !== "string" || value === "") return value;
  const stripped = value.replace(/^[\s\u0000-\u001f\u0085\u00a0\uFEFF]+/, "");
  if (/^[=+\-@]/.test(stripped) || /^[\t\r]/.test(value)) return `'${value}`;
  return value;
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

const ENVIRONMENT_KEYS = [
  "osFamily", "osVersion", "platform", "deviceClass",
  "browserName", "browserVersion", "engine", "userAgent", "uaBrands", "uaPlatform", "uaMobile",
  "viewportWidth", "viewportHeight", "screenWidth", "screenHeight", "availScreenWidth", "availScreenHeight",
  "devicePixelRatio", "colorDepth", "pixelDepth", "orientation",
  "touch", "maxTouchPoints", "pointerCapability", "hoverCapability", "hardwareConcurrency", "deviceMemoryGb",
  "language", "languages", "timezone", "timezoneOffsetMinutes",
  "online", "cookieEnabled", "connectionEffectiveType", "connectionDownlinkMbps", "connectionRttMs", "connectionSaveData",
  "colorScheme", "reducedMotion", "appVersion", "path", "rendererMode", "rolloutMode", "responsiveMode", "featureFlags",
] as const;
type EnvironmentKey = (typeof ENVIRONMENT_KEYS)[number];
type EnvironmentValue = string | number | boolean | null;
type ClientEnvironment = Partial<Record<EnvironmentKey, EnvironmentValue>>;

function normalizeClientEnvironment(input: unknown): ClientEnvironment {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const raw = input as Record<string, unknown>;
  const result: ClientEnvironment = {};
  for (const key of ENVIRONMENT_KEYS) {
    const item = raw[key];
    if (typeof item === "string") {
      result[key] = item.slice(0, key === "userAgent" ? 500 : 240);
    } else if (typeof item === "boolean") {
      result[key] = item;
    } else if (typeof item === "number" && Number.isFinite(item)) {
      result[key] = item;
    } else if (item === null) {
      result[key] = null;
    }
  }
  return result;
}

function hasRequiredEnvironment(environment: ClientEnvironment): boolean {
  return Boolean(
    environment.browserName &&
    environment.osFamily &&
    environment.appVersion &&
    environment.path &&
    typeof environment.viewportWidth === "number" &&
    typeof environment.viewportHeight === "number"
  );
}

function envValue(value: EnvironmentValue | undefined): string {
  if (value === undefined || value === null || value === "") return "unknown";
  return typeof value === "boolean" ? (value ? "yes" : "no") : String(value);
}

function formatEnvironmentForDiscord(env: ClientEnvironment): string {
  const v = (key: EnvironmentKey) => envValue(env[key]);
  return [
    `OS: ${v("osFamily")} ${v("osVersion")} / platform ${v("platform")}`,
    `Browser: ${v("browserName")} ${v("browserVersion")} / engine ${v("engine")}`,
    `Device: ${v("deviceClass")} / UA mobile ${v("uaMobile")}`,
    `Touch/Input: touch ${v("touch")} (${v("maxTouchPoints")}) / pointer ${v("pointerCapability")} / hover ${v("hoverCapability")}`,
    `Viewport: ${v("viewportWidth")}×${v("viewportHeight")}`,
    `Screen: ${v("screenWidth")}×${v("screenHeight")} / available ${v("availScreenWidth")}×${v("availScreenHeight")}`,
    `Display: DPR ${v("devicePixelRatio")} / color ${v("colorDepth")} / pixel ${v("pixelDepth")} / ${v("orientation")}`,
    `Hardware: CPU ${v("hardwareConcurrency")} / memory ${v("deviceMemoryGb")}GB`,
    `Locale: ${v("language")} / languages ${v("languages")}`,
    `Timezone: ${v("timezone")} / offset ${v("timezoneOffsetMinutes")}min`,
    `Connection: online ${v("online")} / ${v("connectionEffectiveType")} / ${v("connectionDownlinkMbps")}Mbps / RTT ${v("connectionRttMs")}ms / saveData ${v("connectionSaveData")}`,
    `Preferences: color ${v("colorScheme")} / reduced motion ${v("reducedMotion")} / cookies enabled ${v("cookieEnabled")}`,
    `App: ${v("appVersion")} / renderer ${v("rendererMode")} / rollout ${v("rolloutMode")} / responsive ${v("responsiveMode")}`,
    `Path: ${v("path")}`,
    `Feature flags: ${v("featureFlags")}`,
    `UA-CH: ${v("uaBrands")} / platform ${v("uaPlatform")}`,
    `User agent: ${v("userAgent")}`,
  ].join("\n");
}

function truncateForDiscord(text: string, limit = 1800): { text: string; truncated: boolean } {
  if (text.length <= limit) return { text, truncated: false };
  return { text: text.slice(0, limit), truncated: true };
}

// Discord hard-caps a single embed description at 4096 UTF-16 code units —
// exceeding it makes Discord's API reject the whole webhook POST (400),
// silently losing the entire diagnostics block instead of just trimming it.
// Every ENVIRONMENT_KEYS field is already capped (240 chars, 500 for
// userAgent) by normalizeClientEnvironment, but that many fields together
// can still approach the limit; truncate defensively and disclose it rather
// than either risk a rejected request or drop the block outright.
const DISCORD_EMBED_DESCRIPTION_LIMIT = 4000;

function environmentEmbed(environment: ClientEnvironment) {
  const { text, truncated } = truncateForDiscord(
    formatEnvironmentForDiscord(environment),
    DISCORD_EMBED_DESCRIPTION_LIMIT
  );
  return {
    title: "【使用環境】",
    description: truncated ? `${text}\n…(truncated)` : text,
  };
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
  environment: ClientEnvironment,
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
        embeds: [environmentEmbed(environment)],
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
  environment: ClientEnvironment,
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
        embeds: [environmentEmbed(environment)],
        allowed_mentions: ALLOWED_MENTIONS_NONE,
      }),
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

async function appendToSpreadsheet(payload: Record<string, unknown>): Promise<boolean> {
  if (!GOOGLE_APPS_SCRIPT_URL || !GOOGLE_APPS_SCRIPT_SECRET) {
    // This is the canonical success gate (see the two call sites below) —
    // silently returning false here otherwise leaves an operator with only
    // "spreadsheetStatus: failed" and no way to tell "not configured" apart
    // from "misconfigured" or "the endpoint rejected this payload".
    console.error("[beta-feedback] GOOGLE_APPS_SCRIPT_URL/SECRET not configured — every submission will report record_failed");
    return false;
  }
  try {
    const res = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: GOOGLE_APPS_SCRIPT_SECRET, ...payload }),
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      console.error(`[beta-feedback] Apps Script rejected the append: HTTP ${res.status} ${bodyText.slice(0, 500)}`);
      return false;
    }
    const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (j?.ok !== true) {
      console.error(`[beta-feedback] Apps Script returned ok:false — error="${j?.error ?? "unknown"}"`);
    }
    return j?.ok === true;
  } catch (err) {
    console.error("[beta-feedback] fetch to Apps Script threw", err);
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
  let clientContext: unknown = {};
  let turnstileToken = "";
  let honeypot = ""; // TSP-LOOP-019: bot 専用フィールド。値があれば拒否。
  const rawImages: { bytes: Uint8Array; mime: AllowedMime }[] = [];
  const str = (v: unknown) => (typeof v === "string" ? v : "");

  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const payloadRaw = form.get("payload");
      const payload = JSON.parse(typeof payloadRaw === "string" ? payloadRaw : "{}");
      type = String(payload.type ?? "");
      message = typeof payload.message === "string" ? payload.message : "";
      clientContext = payload.clientContext ?? {};
      turnstileToken = str(payload.turnstileToken);
      honeypot = str(payload.website);
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
      turnstileToken = str(payload.turnstileToken);
      honeypot = str(payload.website);
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
  const clientEnvironment = normalizeClientEnvironment(clientContext);
  if (!hasRequiredEnvironment(clientEnvironment)) {
    return json({ ok: false, error: "environment_required" }, 400, origin);
  }

  // TSP-LOOP-019: anti-abuse — Discord / Spreadsheet / Storage いずれの前に。
  // 1) honeypot に値があれば bot。汎用エラーで拒否（詳細は開示しない）。
  if (honeypot.trim() !== "") {
    return json({ ok: false, error: "rejected" }, 400, origin);
  }
  // 2) Turnstile は必須。missing/invalid/expired/action/hostname → 403、
  //    secret 欠如・siteverify 通信失敗 → fail-closed 503。
  const ts = await verifyTurnstile(turnstileToken);
  if (!ts.ok) {
    return json(
      { ok: false, error: "verification_failed" },
      ts.retriable ? 503 : 403,
      origin,
    );
  }

  const appVersion = String(clientEnvironment.appVersion ?? "").slice(0, 64);
  const path = String(clientEnvironment.path ?? "").slice(0, 256);
  const viewport = `${envValue(clientEnvironment.viewportWidth)}×${envValue(clientEnvironment.viewportHeight)}`;

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
    const discordStatus = await notifyDiscordFeedback(reportId, appVersion, message, stored, clientEnvironment);

    // 3. Spreadsheet append (canonical success condition)
    const imagePaths = stored.map((s) => s.path);
    // TSP-LOOP-019: Sheet セルへ渡すユーザー由来文字列だけ式インジェクション
    // 無害化（Discord 本文・reportId/receivedAt はそのまま）。
    const sheetOk = await appendToSpreadsheet({
      type: "feedback",
      receivedAt,
      reportId,
      appVersion: sanitizeSheetCell(appVersion),
      path: sanitizeSheetCell(path),
      viewport: sanitizeSheetCell(viewport),
      environment: sanitizeSheetCell(JSON.stringify(clientEnvironment)),
      message: sanitizeSheetCell(message),
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

  const discordStatus = await notifyDiscordReview(reportId, appVersion, cleanChecked, note, clientEnvironment);

  const sheetOk = await appendToSpreadsheet({
    type: "review",
    receivedAt,
    reportId,
    appVersion: sanitizeSheetCell(appVersion),
    path: sanitizeSheetCell(path),
    viewport: sanitizeSheetCell(viewport),
    environment: sanitizeSheetCell(JSON.stringify(clientEnvironment)),
    checkedCount,
    reviewItems: sanitizeSheetCell(reviewItems),
    note: sanitizeSheetCell(note),
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
