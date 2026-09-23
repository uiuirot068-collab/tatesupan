// LOCAL-ONLY harness: runs the REAL supabase/functions/beta-feedback/index.ts (unmodified) in Node, with its
// downstream (Google Apps Script sheet + Discord webhooks) replaced by local receivers, so the B3 report can be
// sent end-to-end from the real browser UI without touching production, its secrets, or its allow-list.
//
//   node tests/local-feedback-harness/harness.mjs            (usually started by run.mjs)
//
// Env (all optional):
//   HARNESS_PORT        the fake `${SUPABASE_URL}` port (default 54331)
//   HARNESS_ORIGINS     comma list added to the function's BETA_FEEDBACK_ALLOWED_ORIGINS (default http://localhost:3013,http://127.0.0.1:3013)
//   B3_EXPECT / B3_FORBID   strings that MUST / MUST NOT appear in what the sheet + Discord receivers get.
//
// Safety: it binds 127.0.0.1 only; every "secret" below is a local dummy; the Turnstile secret is Cloudflare's
// public always-pass TEST secret (the function explicitly supports it for localhost QA). Nothing is written to
// Supabase (the client is constructed but never used for text reports). Captures go to the console and to
// %TEMP%/tatespun-b3-harness-captures.jsonl.
import http from "node:http";
import { register } from "node:module";
import { appendFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const PORT = Number(process.env.HARNESS_PORT ?? 54331);
const ORIGINS = process.env.HARNESS_ORIGINS ?? "http://localhost:3013,http://127.0.0.1:3013";
const EXPECT = process.env.B3_EXPECT ?? "";
const FORBID = process.env.B3_FORBID ?? "";
const CAPTURE_FILE = join(tmpdir(), "tatespun-b3-harness-captures.jsonl");
writeFileSync(CAPTURE_FILE, "");

// --- downstream receivers (stand-ins for the Apps Script Web App and the two Discord webhooks) ---------------------
const captures = [];
/** `raw` is what the receiver got (checked for EXPECT / FORBID); `display` is what is printed. */
function record(kind, raw, display) {
  captures.push({ at: new Date().toISOString(), kind, raw });
  appendFileSync(CAPTURE_FILE, JSON.stringify({ at: new Date().toISOString(), kind, raw: kind === "sheet" ? display : raw }) + "\n");
  const verdict = [
    EXPECT ? `expected "${EXPECT}": ${raw.includes(EXPECT) ? "PRESENT" : "MISSING"}` : null,
    FORBID ? `forbidden "${FORBID}": ${raw.includes(FORBID) ? "PRESENT (LEAK!)" : "absent"}` : null,
  ].filter(Boolean).join("  |  ");
  console.log(`\n[receiver:${kind}] ${new Date().toLocaleTimeString()}${verdict ? `  ${verdict}` : ""}`);
  console.log(display.length > 2500 ? display.slice(0, 2500) + "\n…(cut)" : display);
}
/** The sheet row without the (dummy) shared secret and without the long 使用環境 JSON. */
function sheetDisplay(raw) {
  const j = JSON.parse(raw);
  delete j.secret;
  if (j.environment) j.environment = `[${String(j.environment).length} chars of 使用環境]`;
  return JSON.stringify(j, null, 2);
}

// --- the summary the Human reads after pressing send ------------------------------------------------------------------
const TITLE_FORBID = process.env.B3_FORBID_TITLE ?? "";
const SHEET_FIELDS = new Set(["type", "receivedAt", "reportId", "appVersion", "path", "viewport", "environment", "message", "images", "discordStatus", "checkedCount", "reviewItems", "note"]);
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
let reported = 0;
function verdictBlock() {
  const fresh = captures.slice(reported);
  reported = captures.length;
  const sheets = fresh.filter((c) => c.kind === "sheet");
  const threads = fresh.filter((c) => c.kind.startsWith("discord"));
  const all = fresh.map((c) => c.raw).join("\n");
  let row = null;
  try { row = JSON.parse(sheets[0].raw); } catch { /* reported below */ }
  const rows = [];
  const check = (label, ok, detail = "") => rows.push({ ok, text: `${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}` });
  check("UI send success (the function answered 200 ok:true, so the UI shows ありがとうございます)", true);
  check("local Sheet rows = 1", sheets.length === 1, `${sheets.length}`);
  check("local Discord threads = 1", threads.length === 1, `${threads.length}`);
  if (EXPECT) check(`"${EXPECT}" PRESENT in Sheet and Discord`, sheets.length > 0 && threads.length > 0 && [...sheets, ...threads].every((c) => c.raw.includes(EXPECT)));
  if (FORBID) check("manuscript body sentinel (…ABC987) ABSENT everywhere", !all.includes(FORBID) && !all.includes("ABC987"));
  if (TITLE_FORBID) check(`title sentinel (${TITLE_FORBID}) ABSENT everywhere`, !all.includes(TITLE_FORBID));
  const extra = row ? Object.keys(row).filter((k) => k !== "secret" && !SHEET_FIELDS.has(k)) : ["(unparseable)"];
  check("Sheet row has only the standard fields (no title / documentId / fileName field)", extra.length === 0, extra.length ? `unexpected: ${extra.join(", ")}` : `fields: ${Object.keys(row ?? {}).filter((k) => k !== "secret").join(", ")}`);
  const path = row?.path ?? "";
  check("path is a bare route, no query/hash/document id", /^\/[A-Za-z0-9/_-]*$/.test(path) && !UUID.test(path), path);
  UUID.lastIndex = 0;
  const idScan = `${row?.message ?? ""}\n${row?.environment ?? ""}\n${row?.path ?? ""}`.replace(row?.reportId ?? "", "");
  check("no document-id-like UUID in message / environment / path", !UUID.test(idScan));
  UUID.lastIndex = 0;
  const overall = rows.every((r) => r.ok);
  return `\n${"=".repeat(70)}\nB3 LOCAL SEND VERDICT — ${overall ? "ALL PASS" : "FAIL"}\n${rows.map((r) => "  " + r.text).join("\n")}\n${"=".repeat(70)}\n`;
}

const receiver = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  const kind = req.url.startsWith("/sheet") ? "sheet" : req.url.startsWith("/discord/review") ? "discord-review" : "discord-feedback";
  let display = raw;
  if (kind === "sheet") { try { display = sheetDisplay(raw); } catch { /* print raw */ } }
  record(kind, raw, display);
  res.setHeader("Content-Type", "application/json");
  res.end(kind === "sheet" ? JSON.stringify({ ok: true }) : JSON.stringify({ id: "local", channel_id: "local" }));
});
await new Promise((r) => receiver.listen(0, "127.0.0.1", r));
const RECEIVER = `http://127.0.0.1:${receiver.address().port}`;

// --- load the REAL Edge Function with a Deno shim -------------------------------------------------------------------
const fnEnv = {
  SUPABASE_URL: "http://127.0.0.1:9", // never contacted for text reports
  SUPABASE_SERVICE_ROLE_KEY: "local-dummy-not-a-secret",
  DISCORD_FEEDBACK_WEBHOOK_URL: `${RECEIVER}/discord/feedback`,
  DISCORD_REVIEW_WEBHOOK_URL: `${RECEIVER}/discord/review`,
  GOOGLE_APPS_SCRIPT_URL: `${RECEIVER}/sheet`,
  GOOGLE_APPS_SCRIPT_SECRET: "local-dummy-not-a-secret",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA", // Cloudflare's public always-pass TEST secret
  BETA_FEEDBACK_ALLOWED_ORIGINS: ORIGINS,
};
// The ONE stub of a third-party service: Cloudflare's siteverify. Its public TEST keys answer with a generic
// action/hostname, which the function's strict `tatespun-feedback` action check can never accept, so for LOCAL
// runs only the dev widget's dummy token is answered here as if it were a genuine tatespun-feedback token from
// localhost. Everything else in the function (origin, env, honeypot, action/hostname comparison, downstream
// formatting) still runs for real. Any other token is refused. It proves nothing about Turnstile itself.
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith("https://challenges.cloudflare.com/turnstile/v0/siteverify")) {
    const token = new URLSearchParams(String(init?.body ?? "")).get("response") ?? "";
    const ok = token.includes("DUMMY");
    console.log(`[turnstile-stub] siteverify ${ok ? "accepted the dev widget dummy token" : "REFUSED a non-dummy token"}`);
    return new Response(
      JSON.stringify(ok ? { success: true, "error-codes": [], hostname: "localhost", action: "tatespun-feedback" } : { success: false, "error-codes": ["invalid-input-response"] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  return realFetch(input, init);
};

let handler = null;
globalThis.Deno = { env: { get: (k) => fnEnv[k] }, serve: (h) => { handler = h; return { finished: Promise.resolve() }; } };
register("./loader.mjs", import.meta.url);
await import(pathToFileURL(join(import.meta.dirname, "../../supabase/functions/beta-feedback/index.ts")).href);
if (!handler) throw new Error("the Edge Function did not register a Deno.serve handler");

// --- the fake `${NEXT_PUBLIC_SUPABASE_URL}` the browser talks to ------------------------------------------------------
const server = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(",") : v);
    const request = new Request(`http://127.0.0.1:${PORT}${req.url}`, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
    });
    const response = await handler(request);
    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(Buffer.from(await response.arrayBuffer()));
    console.log(`[function] ${req.method} ${req.url.split("?")[0]} origin=${req.headers.origin ?? "-"} -> ${response.status}`);
    if (req.method === "POST" && response.status === 200) console.log(verdictBlock());
    else if (req.method === "POST") console.log(`[function] the UI will show 「送信できませんでした」 because the function refused this request (${response.status}).`);
  } catch (e) {
    console.error("[function] handler threw", e);
    res.statusCode = 500;
    res.end("harness error");
  }
});
server.listen(PORT, "127.0.0.1", () => {
  console.log(`[harness] real beta-feedback function on http://127.0.0.1:${PORT}/functions/v1/beta-feedback`);
  console.log(`[harness] allowed origins: ${ORIGINS}`);
  console.log(`[harness] captures -> ${CAPTURE_FILE}`);
  console.log(`[harness] downstream receivers are LOCAL only (no Discord / Sheet / Supabase contact)`);
});
