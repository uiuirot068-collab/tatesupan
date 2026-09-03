// TSP-LOOP-006 「β版フィードバック」 regression gate.
//
// β 限定・匿名・画像最大4枚の簡易フィードバック機能。ここでは pure モデル
// (src/lib/betaFeedback.ts) の不変条件と、フロント／Edge Function ソースの
// セキュリティ・ルーティング・UI 不変条件をソーススキャンで検証する。
//
// Run:  node scripts/verify-beta-feedback.mjs
// Node 組み込みの TS type-stripping + node:assert のみ（他の verify-*.mjs と同じ）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALLOWED_IMAGE_MIME,
  BETA_FEEDBACK_IMAGE_ATTACHMENTS_ENABLED,
  BETA_FEEDBACK_TYPES,
  FEEDBACK_HONEYPOT_FIELD,
  MAX_FEEDBACK_IMAGES,
  MAX_IMAGE_BYTES,
  MAX_TOTAL_IMAGE_BYTES,
  MAX_MESSAGE_LENGTH,
  REVIEW_CHECKLIST_ITEMS,
  TURNSTILE_ACTION,
  canSubmitFeedback,
  isAllowedTurnstileHostname,
  isValidImage,
  sanitizeSheetCell,
  sniffImageMime,
  validateSubmissionShape,
} from "../src/lib/betaFeedback.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), "utf8");

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? "PASS" : "FAIL"}: ${name}`);
  if (!cond) failures += 1;
}

const editorPane = read("src/components/EditorPane.tsx");
const tategaki = read("src/components/TategakiEditor.tsx");
const modal = read("src/components/BetaFeedbackModal.tsx");
const client = read("src/lib/betaFeedbackClient.ts");
const lib = read("src/lib/betaFeedback.ts");
const turnstileHook = read("src/lib/turnstile.ts");
const edge = read("supabase/functions/beta-feedback/index.ts");
const verifySupabase = read("scripts/verify-supabase-project.mjs");
const sql = read("docs/supabase/migrations/20260901000000_beta_feedback_storage.sql");
const help = read("public/docs/help.md");
const envExample = read(".env.example");

/* ============================ FEATURE ============================ */

check(
  "beta flag: BETA_FEEDBACK_ENABLED gates on NEXT_PUBLIC_BETA_FEEDBACK_ENABLED === 'true'",
  /NEXT_PUBLIC_BETA_FEEDBACK_ENABLED\s*===\s*"true"/.test(lib)
);
check(
  "beta flag: .env.example documents the flag, default false",
  /NEXT_PUBLIC_BETA_FEEDBACK_ENABLED=false/.test(envExample)
);
check(
  "toolbar: 報告 button rendered only when BETA_FEEDBACK_ENABLED",
  /BETA_FEEDBACK_ENABLED\s*&&[\s\S]{0,400}報告/.test(editorPane)
);
check(
  "toolbar: 報告 button is yellow (amber) styled",
  /報告[\s\S]{0,200}/.test(editorPane) && /border-amber-400 bg-amber-50[\s\S]{0,120}報告/.test(editorPane)
);
check(
  "toolbar: 報告 button sits after 置換 button",
  editorPane.indexOf("置換") < editorPane.indexOf(">\n              報告") ||
    editorPane.indexOf("置換") < editorPane.lastIndexOf("報告")
);
check(
  "modal: rendered only when flag on AND open state",
  /BETA_FEEDBACK_ENABLED\s*&&\s*isBetaFeedbackOpen\s*&&/.test(tategaki) &&
    /<BetaFeedbackModal/.test(tategaki)
);
check("modal: title 「β版フィードバック」", /β版フィードバック/.test(modal));
check(
  "modal: two tabs 気になる事 / review",
  /気になる事/.test(modal) && /review/.test(modal)
);
check(
  "modal: default tab is 気になる事 (feedback)",
  /useState<TabId>\("feedback"\)/.test(modal)
);
check("modal: Escape closes", /e\.key === "Escape"\)\s*handleClose\(\)/.test(modal) && /handleClose = \(\)[\s\S]{0,120}onClose\(\)/.test(modal));
check(
  "modal: backdrop click closes",
  /fixed inset-0[\s\S]{0,200}onClick=\{handleClose\}/.test(modal)
);
check(
  "modal: explicit close button",
  /aria-label="閉じる"/.test(modal) && /onClick=\{handleClose\}[\s\S]{0,240}✕/.test(modal)
);
check(
  "modal: closing revokes attachment object URLs (no leak)",
  /handleClose = \(\)[\s\S]{0,140}revokeObjectURL/.test(modal)
);
check(
  "modal: scrollable body for mobile",
  /overflow-y-auto/.test(modal) && /max-h-\[85vh\]/.test(modal)
);

/* ============================ FEEDBACK ============================ */

check(
  "feedback: guidance wording present (betaFeedback.ts), rendered in modal",
  /思いついたときにお気軽にどうぞ/.test(lib) &&
    /記名希望者は冒頭にお名前/.test(lib) &&
    /\{FEEDBACK_GUIDANCE\}/.test(modal)
);
check(
  "feedback: image hint 「画像を4枚まで添付できます」",
  /画像を4枚まで添付できます/.test(lib) && /\{FEEDBACK_IMAGE_HINT\}/.test(modal)
);
check(
  "feedback: privacy notice about personal info in images",
  /個人情報が含まれていないか、送信前にご確認ください/.test(lib) &&
    /\{FEEDBACK_IMAGE_PRIVACY_NOTICE\}/.test(modal)
);
check(
  "feedback: anonymous — no user-facing name input field (honeypot is hidden & bot-only)",
  !/type="text"[\s\S]{0,120}(お名前|氏名|ペンネーム|placeholder="[^"]*名前)/i.test(modal)
);
check(
  "feedback: anonymous — no email input field",
  !/type="email"/.test(modal) && !/inputMode="email"/.test(modal)
);
check("feedback: no login requirement in modal", !/(signIn|useAuth|requireAuth|login)/i.test(modal));
check("feedback: submit button 「匿名で送信する」", /匿名で送信する/.test(modal));
check(
  "feedback: image-only submit allowed (message empty + >=1 image)",
  canSubmitFeedback("", 1) === true
);
check(
  "feedback: fully empty submit blocked",
  canSubmitFeedback("", 0) === false && canSubmitFeedback("   ", 0) === false
);
check(
  "feedback: send button disabled when cannot send or while sending",
  /disabled=\{!canSend \|\| feedbackState === "sending"( \|\| !turnstileReady)?\}/.test(modal)
);
check(
  "feedback: duplicate prevention guard (sendingRef)",
  /sendingRef\.current/.test(modal)
);
check(
  "feedback: failure keeps input (no clear on error branch)",
  /失敗時は入力・画像プレビューを維持/.test(modal) &&
    /setFeedbackState\("error"\)/.test(modal)
);
check(
  "feedback: success clears textarea + attachments",
  /setMessage\(""\)[\s\S]{0,80}setAttachments\(\[\]\)/.test(modal)
);

/* ====================== IMAGE ATTACHMENTS ====================== */

check("images: MAX_FEEDBACK_IMAGES === 4", MAX_FEEDBACK_IMAGES === 4);
check("images: per-image limit 5MB", MAX_IMAGE_BYTES === 5 * 1024 * 1024);
check("images: total limit 20MB", MAX_TOTAL_IMAGE_BYTES === 20 * 1024 * 1024);
check(
  "images: MIME allowlist is exactly jpeg/png/webp",
  JSON.stringify([...ALLOWED_IMAGE_MIME].sort()) ===
    JSON.stringify(["image/jpeg", "image/png", "image/webp"])
);
check("images: SVG rejected by allowlist", !ALLOWED_IMAGE_MIME.includes("image/svg+xml"));
check(
  "images: file input accept attr uses the allowlist",
  /accept=\{ALLOWED_IMAGE_MIME\.join\(","\)\}/.test(modal)
);
check(
  "images: thumbnail preview + per-image remove button",
  /添付プレビュー/.test(modal) && /この画像を削除/.test(modal)
);
check("images: current count shown as 画像 N / 4", /画像 \{attachments\.length\} \/ \{MAX_FEEDBACK_IMAGES\}/.test(modal));
check(
  "images: add button disabled at 4",
  /disabled=\{attachments\.length >= MAX_FEEDBACK_IMAGES\}/.test(modal)
);
check(
  "images: new selection appends, does not replace existing",
  /setAttachments\(\(prev\) => \[\.\.\.prev, \.\.\.added\]\.slice\(0, MAX_FEEDBACK_IMAGES\)\)/.test(modal)
);
// FAIL 1 regression: the FileList must be snapshotted BEFORE input.value is
// cleared, and the setAttachments updater must be pure (no side effects that
// depend on a live FileList / no createObjectURL inside the updater).
check(
  "images: FileList snapshotted (Array.from) before input.value is cleared",
  (() => {
    const h = modal.slice(modal.indexOf("const handlePickFiles"), modal.indexOf("const removeAttachment"));
    return (
      h.indexOf("Array.from(files)") !== -1 &&
      h.indexOf("Array.from(files)") < h.indexOf('fileInputRef.current.value = ""')
    );
  })()
);
check(
  "images: first user action can be picking an image (no message-state guard)",
  (() => {
    const h = modal.slice(modal.indexOf("const handlePickFiles"), modal.indexOf("const removeAttachment"));
    return !/message|feedbackState/.test(h.slice(0, h.indexOf("setAttachments")));
  })()
);
check(
  "images: setAttachments updater is pure (no createObjectURL / setState inside it)",
  (() => {
    const m = modal.match(/setAttachments\(\(prev\) => [\s\S]*?\);/);
    return m && !/URL\.createObjectURL|setFeedbackError/.test(m[0]);
  })()
);
check(
  "images: object URLs created in handler body, not in the updater",
  /const added: Attachment\[\] = \[\];[\s\S]{0,600}URL\.createObjectURL\(file\)/.test(modal)
);
check(
  "images: review tab has NO file input",
  (() => {
    const reviewChunk = modal.slice(modal.indexOf("REVIEW_CHECKLIST_ITEMS.map"));
    return !/type="file"/.test(reviewChunk);
  })()
);

/* ============= TSP-LOOP-014: image attachments TEMPORARILY DISABLED ============= *
 *  Reversible pre-public-beta measure. This block guards against silent
 *  re-enable and confirms text feedback + review are unaffected. To restore
 *  attachments: flip BOTH flags to true and revert checks 14.1 / 14.2.
 * ------------------------------------------------------------------------------- */

check(
  "14.1 lib: BETA_FEEDBACK_IMAGE_ATTACHMENTS_ENABLED is currently false",
  BETA_FEEDBACK_IMAGE_ATTACHMENTS_ENABLED === false
);
check(
  "14.2 edge: mirrors the disable — IMAGE_ATTACHMENTS_ENABLED = false",
  /const IMAGE_ATTACHMENTS_ENABLED = false;/.test(edge)
);
check(
  "14.3 modal: the whole image-attachment UI is gated by the flag",
  /\{BETA_FEEDBACK_IMAGE_ATTACHMENTS_ENABLED && \([\s\S]{0,120}<div className="flex flex-col gap-2">/.test(
    modal
  ) &&
    // the gate closes before the error/success block
    modal.indexOf("BETA_FEEDBACK_IMAGE_ATTACHMENTS_ENABLED &&") <
      modal.indexOf("{feedbackError && (")
);
check(
  "14.4 modal: no image-attachment control reachable while disabled (add button / file input only inside the gated block)",
  (() => {
    const gateAt = modal.indexOf("{BETA_FEEDBACK_IMAGE_ATTACHMENTS_ENABLED && (");
    const addBtnAt = modal.indexOf("＋ 画像を追加");
    const fileInputAt = modal.indexOf('type="file"');
    const errBlockAt = modal.indexOf("{feedbackError && (");
    return (
      gateAt !== -1 &&
      gateAt < addBtnAt && addBtnAt < errBlockAt &&
      gateAt < fileInputAt && fileInputAt < errBlockAt
    );
  })()
);
check(
  "14.5 client: images are only appended to FormData when the flag is on",
  /if \(BETA_FEEDBACK_IMAGE_ATTACHMENTS_ENABLED\) \{[\s\S]{0,160}form\.set\(`image\$\{i\}`/.test(
    client
  )
);
check(
  "14.6 edge: an image field on a disabled request is rejected inside the parse loop, before storeImages() is ever called",
  (() => {
    const loopStart = edge.indexOf("for (let i = 0; i < MAX_FEEDBACK_IMAGES; i++)");
    const rejectAt = edge.indexOf('"image_attachments_disabled"');
    const bufReadAt = edge.indexOf("await f.arrayBuffer()");
    const storeCallAt = edge.indexOf("await storeImages(supabase");
    return (
      loopStart !== -1 &&
      rejectAt > loopStart &&
      // rejected before the file body is even read and before the store call
      rejectAt < bufReadAt &&
      rejectAt < storeCallAt &&
      /if \(!IMAGE_ATTACHMENTS_ENABLED\) \{\s*return json\(\{ ok: false, error: "image_attachments_disabled" \}, 415, origin\);\s*\}/.test(
        edge.replace(/\s+/g, " ")
      )
    );
  })()
);
check(
  "14.7 lib: validateSubmissionShape rejects a feedback submission that carries images while disabled",
  (() => {
    const fakeFile = { type: "image/png", size: 10 };
    const r = validateSubmissionShape({
      type: "feedback",
      message: "hi",
      images: [fakeFile],
    });
    return r.ok === false;
  })()
);
check(
  "14.8 text-only feedback is unaffected — passes shape validation",
  validateSubmissionShape({ type: "feedback", message: "テキストのみ", images: [] }).ok === true &&
    canSubmitFeedback("テキストのみ", 0) === true &&
    canSubmitFeedback("", 0) === false
);
check(
  "14.9 review is unaffected",
  validateSubmissionShape({ type: "review", checkedItems: ["ルビ"], note: "" }).ok === true
);
check(
  "14.10 implementation NOT deleted — upload code, bucket, migration still present",
  /async function storeImages\(/.test(edge) &&
    /from\(STORAGE_BUCKET\)\s*\n?\s*\.upload/.test(edge) &&
    /'beta-feedback-images'/.test(sql) &&
    /storage\.buckets/.test(sql) &&
    MAX_FEEDBACK_IMAGES === 4 &&
    /type="file"/.test(modal) &&
    /handlePickFiles/.test(modal)
);

/* ===================== MAGIC BYTES / VALIDATION ===================== */

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const svg = new TextEncoder().encode("<svg xmlns=");
check("signature: JPEG magic detected", sniffImageMime(jpeg) === "image/jpeg");
check("signature: PNG magic detected", sniffImageMime(png) === "image/png");
check("signature: WEBP magic detected", sniffImageMime(webp) === "image/webp");
check("signature: SVG / text is not an image", sniffImageMime(svg) === null);
check(
  "signature: MIME-spoofed non-image rejected (declared png, bytes are svg)",
  isValidImage("image/png", svg) === false
);
check(
  "signature: declared/actual mismatch rejected (declared jpeg, bytes png)",
  isValidImage("image/jpeg", png) === false
);
check("shape: message over MAX rejected client-side", (() => {
  const r = validateSubmissionShape({ type: "feedback", message: "あ".repeat(MAX_MESSAGE_LENGTH + 1), images: [] });
  return r.ok === false;
})());
check("shape: review with unknown checklist item rejected", (() => {
  const r = validateSubmissionShape({ type: "review", checkedItems: ["not-a-real-item"], note: "" });
  return r.ok === false;
})());

/* ============================ REVIEW ============================ */

check("review: checklist has the 15 spec items", REVIEW_CHECKLIST_ITEMS.length === 15);
check(
  "review: checklist includes the横書き奥付 items",
  REVIEW_CHECKLIST_ITEMS.includes("横書き奥付") &&
    REVIEW_CHECKLIST_ITEMS.includes("横書き奥付のページ位置・配置")
);
check(
  "review: 「未チェック＝不具合という意味ではありません」 wording",
  /未チェック＝不具合という意味ではありません/.test(lib) && /\{REVIEW_INTRO\}/.test(modal)
);
check("review: optional note field 「気になったことがあればどうぞ」", /気になったことがあればどうぞ/.test(modal));
check("review: submit button 「reviewを送信」", /reviewを送信/.test(modal));
check(
  "routing: review payload type is a separate 'review' type",
  BETA_FEEDBACK_TYPES.includes("review") &&
    /type:\s*"review"/.test(client)
);

/* ============================ SECURITY ============================ */

const clientBundleFiles = ["src/components/BetaFeedbackModal.tsx", "src/lib/betaFeedbackClient.ts", "src/lib/betaFeedback.ts"];
for (const rel of clientBundleFiles) {
  const src = read(rel);
  check(
    `security: ${rel} has no Discord webhook URL / discord.com/api/webhooks`,
    !/discord(app)?\.com\/api\/webhooks/i.test(src)
  );
  check(
    `security: ${rel} does not reference Apps Script secret / URL env`,
    !/GOOGLE_APPS_SCRIPT_(URL|SECRET)/.test(src) && !/script\.google\.com\/macros/.test(src)
  );
  check(
    `security: ${rel} does not reference a service-role / storage secret`,
    !/SERVICE_ROLE|service_role|SUPABASE_SERVICE/.test(src)
  );
}
check(
  "security: client calls same Supabase project function path only",
  /NEXT_PUBLIC_SUPABASE_URL/.test(client) && /\/functions\/v1\/beta-feedback/.test(lib) &&
    !/https?:\/\/(?!\$\{)/.test(client.replace(/\/\/.*$/gm, ""))
);
check(
  "security: no manuscript/title/documentId auto-collection in client payload",
  !/(content|manuscript|documentId|projectId|selectedText|\btitle\b)/.test(
    client.slice(client.indexOf("submitBetaFeedback"))
  )
);
check(
  "security: clientContext is only appVersion / path / viewport",
  /return \{ appVersion:[^}]*\bpath\b[^}]*\bviewport\b[^}]*\}/.test(client) &&
    !/userAgent|cookie|referrer|localStorage|title|content/i.test(
      client.slice(client.indexOf("readClientContext"), client.indexOf("functionUrl"))
    )
);
check("security: client strips query/hash from path", /window\.location\.pathname/.test(client) && !/location\.search|location\.href/.test(client));

// Edge Function
check(
  "edge: secrets read from Deno.env only, never hardcoded",
  /Deno\.env\.get/.test(edge) &&
    !/discord(app)?\.com\/api\/webhooks\/\d/.test(edge) &&
    !/script\.google\.com\/macros\/s\//.test(edge)
);
check(
  "edge: CORS is an allowlist, never '*'",
  !/Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*/.test(edge) &&
    /ALLOWED_ORIGINS\.includes\(origin\)/.test(edge)
);
check("edge: handles OPTIONS preflight", /req\.method === "OPTIONS"/.test(edge));
check("edge: method allowlist (POST only)", /req\.method !== "POST"/.test(edge) && /405/.test(edge));
check("edge: body size cap", /content-length/.test(edge) && /413/.test(edge) && /MAX_BODY_BYTES/.test(edge));
check(
  "edge: re-validates MIME + magic bytes server-side",
  /sniffImageMime/.test(edge) && /invalid_image/.test(edge)
);
check("edge: image count cap (<=4)", /MAX_FEEDBACK_IMAGES/.test(edge) && /too_many_images/.test(edge));
check("edge: per-image + total size caps", /MAX_IMAGE_BYTES/.test(edge) && /MAX_TOTAL_IMAGE_BYTES/.test(edge));
check(
  "edge: server-generated reportId (UUID) + receivedAt (ISO)",
  /const reportId = crypto\.randomUUID\(\)/.test(edge) &&
    /const receivedAt = new Date\(\)\.toISOString\(\)/.test(edge)
);
check(
  "edge: storage object key is reportId + random UUID, not original filename",
  /\$\{reportId\}\/\$\{crypto\.randomUUID\(\)\}\.\$\{EXT/.test(edge)
);
check(
  "edge: uses private bucket via service role, client never uploads directly",
  /createClient\(SUPABASE_URL, SERVICE_ROLE_KEY/.test(edge) &&
    /from\(STORAGE_BUCKET\)\s*\n?\s*\.upload/.test(edge)
);
check(
  "edge: Discord payload disables mentions (allowed_mentions parse [])",
  /ALLOWED_MENTIONS_NONE\s*=\s*\{\s*parse:\s*\[\]/.test(edge) &&
    (edge.match(/allowed_mentions: ALLOWED_MENTIONS_NONE/g) || []).length >= 2
);
check(
  "edge: does not echo secrets / error bodies to client (generic error codes)",
  /json\(\{ ok: false, error: "[a-z_]+" \}/.test(edge) &&
    !/error:\s*String\(err/.test(edge) &&
    !/\.message \}\), \d+, origin\)/.test(edge)
);
check(
  "edge: never logs the webhook/appscript URLs or the IP",
  !/console\.(log|error)\([^)]*DISCORD_/.test(edge) &&
    !/console\.(log|error)\([^)]*APPS_SCRIPT/.test(edge) &&
    !/console\.(log|error)\([^)]*\bip\b/.test(edge)
);
check(
  "edge: rate-limit references IP transiently, hashed, not stored/forwarded",
  /hashIp/.test(edge) && /crypto\.subtle\.digest\("SHA-256"/.test(edge) &&
    !/rateBucket[\s\S]{0,200}appendToSpreadsheet/.test(edge)
);

/* ============================ ROUTING ============================ */

check(
  "routing: feedback → images to private Storage then Discord feedback then Apps Script type feedback",
  (() => {
    const fb = edge.slice(edge.indexOf('if (type === "feedback")'), edge.indexOf("/* ---------------------------- review"));
    return (
      fb.indexOf("storeImages(") < fb.indexOf("notifyDiscordFeedback(") &&
      fb.indexOf("notifyDiscordFeedback(") < fb.indexOf("appendToSpreadsheet(") &&
      /type: "feedback"/.test(fb)
    );
  })()
);
check(
  "routing: review → no Storage, Discord review channel, Apps Script type review",
  (() => {
    const rv = edge.slice(edge.indexOf("/* ---------------------------- review"));
    return (
      !/storeImages\(/.test(rv) &&
      /notifyDiscordReview\(/.test(rv) &&
      /type: "review"/.test(rv)
    );
  })()
);
check(
  "routing: two distinct Discord webhook envs",
  /DISCORD_FEEDBACK_WEBHOOK_URL/.test(edge) && /DISCORD_REVIEW_WEBHOOK_URL/.test(edge)
);
check(
  "routing: request cannot choose sheet / webhook / bucket (server-fixed)",
  !/payload\.(bucket|webhook|sheet|spreadsheet)/i.test(edge)
);

/* ===================== DISCORD FORUM CHANNEL ===================== */

check(
  "forum: feedback webhook payload_json includes thread_name",
  /form\.set\(\s*"payload_json",\s*JSON\.stringify\(\{[\s\S]{0,160}thread_name: feedbackThreadName\(reportId, message\)/.test(edge)
);
check(
  "forum: review webhook JSON body includes thread_name",
  /body: JSON\.stringify\(\{[\s\S]{0,160}thread_name: reviewThreadName\(reportId, checkedCount\)/.test(edge)
);
check(
  "forum: feedback still multipart with files[i] (image attachments kept)",
  /new FormData\(\)/.test(edge) && /form\.set\(\s*`files\[\$\{i\}\]`/.test(edge)
);
check(
  "forum: allowed_mentions stays disabled on every webhook call",
  (edge.match(/allowed_mentions: ALLOWED_MENTIONS_NONE/g) || []).length >= 2 &&
    /ALLOWED_MENTIONS_NONE\s*=\s*\{\s*parse:\s*\[\]/.test(edge)
);
check(
  "forum: reportId (short) is in both thread titles — Sheet 照合可能",
  /feedbackThreadName\(reportId: string, message: string\)[\s\S]{0,300}reportId\.slice\(0, 8\)/.test(edge) &&
    /reviewThreadName\(reportId: string, checkedCount: number\)[\s\S]{0,160}reportId\.slice\(0, 8\)/.test(edge)
);
check(
  "forum: image-only feedback gets a safe title (…｜画像のみ)",
  /clean\.length > 0\s*\n?\s*\?[\s\S]{0,120}:\s*"画像のみ"/.test(edge)
);
check(
  "forum: thread name is normalized (control chars stripped) and clamped to <=100",
  /DISCORD_THREAD_NAME_MAX = 100/.test(edge) &&
    /normalizeThreadText/.test(edge) &&
    /clampThreadName/.test(edge)
);
check(
  "forum: webhook calls use wait=true for delivery verification",
  /function webhookWithWait/.test(edge) &&
    /u\.searchParams\.set\("wait", "true"\)/.test(edge) &&
    (edge.match(/fetch\(webhookWithWait\(/g) || []).length >= 2
);
check(
  "forum: wait=true added via URL API (no string concat of secret URL) and URL not logged",
  /new URL\(url\)/.test(edge) && !/\+ "\?wait/.test(edge) &&
    !/console\.(log|error)\([^)]*(WEBHOOK|webhookWithWait)/.test(edge)
);
check(
  "forum: no automatic applied_tags (POST-BETA)",
  !/applied_tags/.test(edge)
);
check(
  "forum: channel stays a webhook (no new Discord secret / channel id introduced)",
  !/DISCORD_[A-Z_]*CHANNEL_ID/.test(edge) && !/DISCORD_BOT_TOKEN/.test(edge)
);

/* ======================= DELIVERY / FAILURE ======================= */

check(
  "delivery: Spreadsheet append is the success condition (sheet fail → 502, no ok:true)",
  /if \(!sheetOk\)[\s\S]{0,200}502/.test(edge) &&
    (edge.match(/if \(!sheetOk\)/g) || []).length >= 2
);
check(
  "delivery: Apps Script HTTP-ok but ok:false is treated as failure",
  /j\?\.ok === true/.test(edge)
);
check(
  "delivery: storage failure on image feedback → no success, cleanup",
  /storage_failed/.test(edge) && /cleanupImages\(/.test(edge)
);
check(
  "delivery: Discord-only failure still returns accepted (record kept)",
  /Discord のみ失敗でも record はあるので accepted/.test(edge) &&
    /return json\(\{ ok: true, reportId \}, 200, origin\);/.test(edge)
);
check(
  "delivery: discordStatus flows into the spreadsheet row",
  /discordStatus,\s*\n\s*\}\);/.test(edge) && /discordStatus = await notifyDiscord/.test(edge)
);
check(
  "delivery: server log carries reportId + spreadsheetStatus + discordStatus + imageStorageStatus",
  /reportId,\s*\n\s*imageStorageStatus:[\s\S]{0,120}spreadsheetStatus:[\s\S]{0,80}discordStatus/.test(edge)
);

/* ============================ STORAGE SQL ============================ */

check("sql: creates bucket beta-feedback-images", /'beta-feedback-images'/.test(sql) && /storage\.buckets/.test(sql));
check("sql: bucket is private (public = false)", /public\)\s*\nvalues \('beta-feedback-images', 'beta-feedback-images', false\)/.test(sql));
check("sql: idempotent (on conflict do nothing)", /on conflict \(id\) do nothing/.test(sql));
check("sql: no public-read policy is added", !/create policy[\s\S]{0,200}(public|anon)[\s\S]{0,200}beta-feedback-images/i.test(sql));
check("sql: transactional begin/commit", /^begin;/m.test(sql) && /^commit;/m.test(sql));
check("sql: non-destructive (no drop/truncate/delete statements)", (() => {
  const stripped = sql.replace(/--.*$/gm, ""); // drop SQL line comments
  return !/\b(drop\s+table|truncate|delete\s+from)\b/i.test(stripped);
})());

/* ================= TSP-LOOP-019: FEEDBACK HARDENING ================= *
 *  Cloudflare Turnstile (mandatory) + honeypot + Sheet formula-injection.
 *  Both submit types are covered by one Turnstile widget. Tokens are single-use.
 * ------------------------------------------------------------------- */

// ---- Turnstile: shared constants agree frontend <-> Edge Function ----
check("19 turnstile: fixed action id is 'tatespun-feedback'", TURNSTILE_ACTION === "tatespun-feedback");
check(
  "19 turnstile: Edge Function uses the same TURNSTILE_ACTION",
  new RegExp(`TURNSTILE_ACTION\\s*=\\s*"${TURNSTILE_ACTION}"`).test(edge),
);
check(
  "19 turnstile: hostname allowlist = spuntales.net / tatespun.pages.dev / *.tatespun.pages.dev",
  isAllowedTurnstileHostname("spuntales.net") &&
    isAllowedTurnstileHostname("tatespun.pages.dev") &&
    isAllowedTurnstileHostname("deploy-preview-7.tatespun.pages.dev") &&
    !isAllowedTurnstileHostname("evil.com") &&
    !isAllowedTurnstileHostname("spuntales.net.evil.com") &&
    !isAllowedTurnstileHostname("tatespun.pages.dev.evil.com"),
);
check(
  "19 turnstile: Edge Function mirrors the same hostname allowlist",
  /h === "spuntales\.net"/.test(edge) &&
    /h === "tatespun\.pages\.dev"/.test(edge) &&
    /h\.endsWith\("\.tatespun\.pages\.dev"\)/.test(edge),
);

// ---- Turnstile: frontend sends a token in BOTH payloads ----
check(
  "19 turnstile: client puts turnstileToken in the feedback (multipart) payload",
  /form\.set\(\s*"payload",\s*JSON\.stringify\(\{[\s\S]{0,220}turnstileToken/.test(client),
);
check(
  "19 turnstile: client puts turnstileToken in the review (json) payload",
  /type:\s*"review",[\s\S]{0,220}turnstileToken/.test(client),
);
check(
  "19 turnstile: client refuses to send without a token",
  /if \(!security\.turnstileToken\)\s*\{\s*return \{ ok: false \};/.test(client.replace(/\s+/g, " ").replace(/ \{ /g, " {\n").replace(/if \(!security\.turnstileToken\) \{ return \{ ok: false \}; \}/, "if (!security.turnstileToken) {\n    return { ok: false };\n  }")) ||
    /!security\.turnstileToken[\s\S]{0,60}return \{ ok: false \}/.test(client),
);
check(
  "19 turnstile: modal gates BOTH submit buttons on a verified token",
  (modal.match(/disabled=\{[^}]*turnstileReady[^}]*\}/g) || []).length >= 2 &&
    /turnstileReady =\s*turnstileStatus === "verified" && turnstileToken\.length > 0/.test(modal),
);
check(
  "19 turnstile: modal renders ONE widget container, shared by both tabs (outside the tab conditional)",
  (modal.match(/ref=\{turnstileMount\}/g) || []).length === 1 &&
    modal.indexOf("ref={turnstileMount}") > modal.lastIndexOf('reviewを送信'),
);
check(
  "19 turnstile: token is single-use — reset after EVERY completed submit attempt (both handlers)",
  (modal.match(/resetTurnstile\(\)/g) || []).length >= 2 &&
    /await submitBetaFeedback\(submission, \{[\s\S]{0,120}\}\);\s*sendingRef\.current = false;\s*[\s\S]{0,80}resetTurnstile\(\)/.test(modal) &&
    /await submitBetaFeedback\(submission, \{[\s\S]{0,120}\}\);\s*reviewSendingRef\.current = false;\s*resetTurnstile\(\)/.test(modal),
);
check(
  "19 turnstile: hook clears token on expired / timeout / error callbacks",
  /"expired-callback":[\s\S]{0,120}setToken\(""\)/.test(turnstileHook) &&
    /"timeout-callback":[\s\S]{0,120}setToken\(""\)/.test(turnstileHook) &&
    /"error-callback":[\s\S]{0,120}setToken\(""\)/.test(turnstileHook),
);
check(
  "19 turnstile: hook loads the official Cloudflare script only (no new npm dep), render=explicit",
  /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/.test(turnstileHook) &&
    !/from "@?[a-z].*turnstile/i.test(turnstileHook),
);
check(
  "19 turnstile: no client file READS a turnstile secret (comment mentioning its name is ok)",
  ![modal, client, turnstileHook].some((s) =>
    /(process\.env\.[A-Z_]*TURNSTILE_SECRET|Deno\.env|env\(["'][A-Z_]*TURNSTILE_SECRET)/.test(s)
  ) && !/TURNSTILE_SECRET[A-Z_]*\s*=\s*process\.env/.test(lib),
);
check(
  "19 turnstile: site key comes from NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  /process\.env\.NEXT_PUBLIC_TURNSTILE_SITE_KEY/.test(lib) &&
    /TURNSTILE_SITE_KEY/.test(turnstileHook),
);

// ---- Turnstile: Edge Function verification, fail-closed ----
{
  const edgeN = edge.replace(/\r\n/g, "\n");
  const h = edgeN.slice(edgeN.indexOf("async function verifyTurnstile"), edgeN.indexOf("function sanitizeSheetCell"));
  // TSP-LOOP-019B: fail-closed の返り値は不変。診断ログ用に early-return が
  // ブロック化されても、retriable: true で閉じることだけ担保する。
  check("19 turnstile server: missing TURNSTILE_SECRET_KEY → fail closed", /if \(!TURNSTILE_SECRET_KEY\) \{[\s\S]*?return \{ ok: false, retriable: true \}/.test(h));
  check("19 turnstile server: missing token → reject", /if \(!token\) return \{ ok: false, retriable: false \}/.test(h));
  check("19 turnstile server: siteverify non-200 → fail closed", /if \(!res\.ok\) \{[\s\S]*?return \{ ok: false, retriable: true \}/.test(h));
  check("19 turnstile server: siteverify network error → fail closed", /catch \{[\s\S]*?return \{ ok: false, retriable: true \}/.test(h));
  check("19 turnstile server: rejects success:false / action mismatch / hostname mismatch", /data\.success !== true/.test(h) && /data\.action !== TURNSTILE_ACTION/.test(h) && /!isAllowedTurnstileHostname\(data\.hostname\)/.test(h));
  check("19 turnstile server: does NOT send the user's IP (no remoteip param)", !/remoteip/i.test(h));
  // TSP-LOOP-019B: siteverify request は Cloudflare / Supabase ドキュメントどおり
  // FormData（multipart）。URLSearchParams + 明示 content-type には戻さない。
  check(
    "19B turnstile server: siteverify body is FormData, not URLSearchParams",
    /new FormData\(\)/.test(h) &&
      /body\.append\("secret", TURNSTILE_SECRET_KEY\)/.test(h) &&
      /body\.append\("response", token\)/.test(h) &&
      !/new URLSearchParams\(\)/.test(h) &&
      !/application\/x-www-form-urlencoded/.test(h),
  );
  // TSP-LOOP-019B: インフラ障害の診断ログは許可。3 つの理由コードだけを分類し、
  // HTTP エラー時のみ数値 status を添える。
  const infraLogStart = edgeN.indexOf("function logTurnstileInfraFailure");
  const infraLog = edgeN.slice(infraLogStart, edgeN.indexOf("\n}\n", infraLogStart) + 3);
  check(
    "19B turnstile server: infra-failure diagnostics carry only a reason code (+ numeric status)",
    /"turnstile_secret_missing"/.test(infraLog) &&
      /"turnstile_siteverify_http_error"/.test(infraLog) &&
      /"turnstile_siteverify_network_error"/.test(infraLog) &&
      /event:\s*"turnstile_verify_infrastructure_failure"/.test(infraLog) &&
      /logTurnstileInfraFailure\("turnstile_secret_missing"\)/.test(h) &&
      /logTurnstileInfraFailure\("turnstile_siteverify_http_error", res\.status\)/.test(h) &&
      /logTurnstileInfraFailure\("turnstile_siteverify_network_error"\)/.test(h),
  );
  // verifyTurnstile 本体は console を呼ばない（ログは helper 経由のみ）。
  // helper を含む全 console 呼び出しに secret / token / request body /
  // siteverify raw response・error-codes / ユーザー IP を渡さない。
  const consoleCalls = edgeN.match(/console\.[a-z]+\([\s\S]*?\)\s*\)?;/g) || [];
  check(
    "19 turnstile server: never logs token / secret / siteverify body / IP",
    !/console\.(log|error)/.test(h) &&
      consoleCalls.length > 0 &&
      consoleCalls.every((c) =>
        !/TURNSTILE_SECRET_KEY|turnstileToken|\bsecret\b|\btoken\b|siteverify|\bdata\b|res\.(text|json|headers|body)|error-?codes|remoteip|cf-connecting-ip|x-forwarded-for/i.test(c)
      ),
  );
}
const edgeHandler = edge.slice(edge.indexOf("Deno.serve(async (req)"));
check(
  "19 turnstile server: verified BEFORE any Discord / Spreadsheet / Storage / createClient",
  (() => {
    const verifyAt = edgeHandler.indexOf("const ts = await verifyTurnstile(");
    return (
      verifyAt !== -1 &&
      verifyAt < edgeHandler.indexOf("createClient(SUPABASE_URL, SERVICE_ROLE_KEY") &&
      verifyAt < edgeHandler.indexOf("await notifyDiscordFeedback(") &&
      verifyAt < edgeHandler.indexOf("await appendToSpreadsheet(") &&
      verifyAt < edgeHandler.indexOf("await storeImages(supabase")
    );
  })(),
);
check(
  "19 turnstile server: client gets only a generic error (no sub-reason leaked)",
  /json\(\s*\{ ok: false, error: "verification_failed" \}/.test(edge) &&
    !/error: "(hostname|action|spent|expired)"/.test(edge),
);
check(
  "19 turnstile server: anonymous endpoint stays verify_jwt=false (feature is intentionally anonymous)",
  /verify_jwt = false/.test(read("supabase/config.toml")),
);

// ---- Honeypot ----
check("19 honeypot: field name shared constant is 'website'", FEEDBACK_HONEYPOT_FIELD === "website");
check(
  "19 honeypot: modal has an invisible, non-tabbable, autocomplete-off input",
  /name=\{FEEDBACK_HONEYPOT_FIELD\}/.test(modal) &&
    /tabIndex=\{-1\}/.test(modal) &&
    /autoComplete="off"/.test(modal) &&
    /aria-hidden="true"/.test(modal.slice(modal.indexOf("honeypot"), modal.indexOf("turnstile.containerRef"))),
);
check(
  "19 honeypot: NOT display:none (uses off-screen / clip so bots still see it)",
  (() => {
    const hp = modal.slice(modal.indexOf("bf-hp") - 400, modal.indexOf("bf-hp") + 200);
    // `overflow-hidden` is fine; reject only display:none or the `hidden` class/attr.
    return !/display:\s*none/.test(hp) && !/(?<![-\w])hidden(?![-\w])/.test(hp) &&
      /-m-px|absolute|overflow-hidden/.test(hp);
  })(),
);
check(
  "19 honeypot: client sends the honeypot value in both payloads",
  (client.match(/\[FEEDBACK_HONEYPOT_FIELD\]:\s*honeypot/g) || []).length === 2,
);
check(
  "19 honeypot server: any value → reject BEFORE downstream, generic error",
  (() => {
    const hpAt = edgeHandler.indexOf('if (honeypot.trim() !== "")');
    return (
      hpAt !== -1 &&
      /return json\(\{ ok: false, error: "rejected" \}, 400, origin\);/.test(edgeHandler) &&
      hpAt < edgeHandler.indexOf("const ts = await verifyTurnstile(") &&
      hpAt < edgeHandler.indexOf("createClient(SUPABASE_URL, SERVICE_ROLE_KEY") &&
      hpAt < edgeHandler.indexOf("await notifyDiscordFeedback(") &&
      hpAt < edgeHandler.indexOf("await appendToSpreadsheet(")
    );
  })(),
);
check("19 honeypot server: parsed from BOTH multipart and json payloads", (edge.match(/honeypot = str\(payload\.website\)/g) || []).length === 2);

// ---- Spreadsheet formula injection ----
check("19 sheet: =SUM(1,2) is neutralised to text", sanitizeSheetCell("=SUM(1,2)") === "'=SUM(1,2)");
check("19 sheet: +cmd neutralised", sanitizeSheetCell("+cmd") === "'+cmd");
check("19 sheet: -1+1 neutralised", sanitizeSheetCell("-1+1") === "'-1+1");
check("19 sheet: @something neutralised", sanitizeSheetCell("@something") === "'@something");
check("19 sheet: leading whitespace before = still neutralised", sanitizeSheetCell("   =A1") === "'   =A1");
check("19 sheet: leading tab neutralised", sanitizeSheetCell("\tvalue") === "'\tvalue");
check(
  "19 sheet: ordinary Japanese text is unchanged",
  sanitizeSheetCell("ここに不具合の説明です。=は含みません") === "ここに不具合の説明です。=は含みません" &&
    sanitizeSheetCell("プレビューが崩れる") === "プレビューが崩れる" &&
    sanitizeSheetCell("") === "",
);
check(
  "19 sheet: Edge Function has an identical sanitizer + applies it to Apps Script payload only",
  /function sanitizeSheetCell\(value: string\): string/.test(edge) &&
    /message: sanitizeSheetCell\(message\)/.test(edge) &&
    /note: sanitizeSheetCell\(note\)/.test(edge) &&
    /appVersion: sanitizeSheetCell\(appVersion\)/.test(edge),
);
check(
  "19 sheet: Discord text is NOT run through the sanitizer (raw message/note)",
  (() => {
    const fb = edge.slice(edge.indexOf('if (type === "feedback")'), edge.indexOf("/* ---------------------------- review"));
    return /notifyDiscordFeedback\(reportId, appVersion, message, stored\)/.test(fb) &&
      !/notifyDiscordFeedback\([^)]*sanitizeSheetCell/.test(edge) &&
      !/notifyDiscordReview\([^)]*sanitizeSheetCell/.test(edge);
  })(),
);

// ---- Double-submit / rate limit ----
check("19 double-submit: review handler now guards with a ref (not just state)", /reviewSendingRef\.current/.test(modal) && /const reviewSendingRef = useRef\(false\)/.test(modal));
check("19 double-submit: feedback handler keeps its sendingRef guard", /if \(sendingRef\.current \|\| !canSend \|\| !turnstileReady\) return;/.test(modal));
check("19 rate limit: server best-effort limiter kept, threshold not weakened (RATE_MAX <= 6)", /const RATE_MAX = ([0-6]);/.test(edge));
check("19 rate limit: still no persistent IP table / fingerprinting", !/create table[\s\S]{0,120}ip\b/i.test(edge) && !/fingerprint/i.test(edge) && /IP は保存しない/.test(edge));

// ---- Build guard ----
check(
  "19 build guard: verify-supabase-project.mjs fails when feedback ENABLED but Turnstile site key missing/placeholder",
  /NEXT_PUBLIC_BETA_FEEDBACK_ENABLED/.test(verifySupabase) &&
    /NEXT_PUBLIC_TURNSTILE_SITE_KEY/.test(verifySupabase) &&
    /your-turnstile-site-key/.test(verifySupabase) &&
    /!feedbackEnabled \|\| !placeholderKey/.test(verifySupabase),
);
check(
  "19 build guard: .env.example documents the public var name only (no real key, secret named as Supabase-only)",
  /NEXT_PUBLIC_TURNSTILE_SITE_KEY=your-turnstile-site-key/.test(envExample) &&
    /TURNSTILE_SECRET_KEY.*Supabase Edge Function/.test(envExample),
);

/* ==================== TSP-019 REGRESSION GUARD ==================== */
check("19 regress: image attachments still disabled (both flags)", BETA_FEEDBACK_IMAGE_ATTACHMENTS_ENABLED === false && /const IMAGE_ATTACHMENTS_ENABLED = false;/.test(edge));
check("19 regress: 15 checklist items unchanged", REVIEW_CHECKLIST_ITEMS.length === 15);
check("19 regress: feedback + review shape validation still passes for normal input", validateSubmissionShape({ type: "feedback", message: "テスト", images: [] }).ok === true && validateSubmissionShape({ type: "review", checkedItems: ["ルビ"], note: "" }).ok === true);
check("19 regress: CORS still an allowlist, no wildcard", /ALLOWED_ORIGINS\.includes\(origin\)/.test(edge) && !/Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*/.test(edge));
check("19 regress: Discord mentions still disabled everywhere", (edge.match(/allowed_mentions: ALLOWED_MENTIONS_NONE/g) || []).length >= 2);
check("19 regress: Spreadsheet still the canonical success condition", (edge.match(/if \(!sheetOk\)/g) || []).length >= 2 && /return json\(\{ ok: true, reportId \}, 200, origin\);/.test(edge));
check("19 regress: server-generated reportId + receivedAt unchanged", /const reportId = crypto\.randomUUID\(\)/.test(edge) && /const receivedAt = new Date\(\)\.toISOString\(\)/.test(edge));

/* ============================ HELP ============================ */

check("help: β feedback section added", /## β版フィードバック（報告ボタン）/.test(help));
check("help: mentions yellow 報告 button + β-only", /黄色い「報告」ボタン/.test(help) && /β期間中だけ表示/.test(help));
check("help: 気になる事 anonymous + up to 4 images + 記名は冒頭に名前", /匿名で届く簡易フィードバック/.test(help) && /画像を4枚まで/.test(help) && /本文の冒頭にお名前/.test(help));
check("help: review = checklist, unchecked != 不具合, no image", /未チェックは「不具合」という意味ではありません/.test(help) && /reviewには画像を添付できません/.test(help));
check("help: image personal-info caution", /画像へ個人情報などが写っていないか/.test(help));

/* ============================ done ============================ */

console.log("");
if (failures === 0) {
  console.log("All beta-feedback checks passed.");
} else {
  console.log(`${failures} beta-feedback check(s) FAILED.`);
  process.exit(1);
}
