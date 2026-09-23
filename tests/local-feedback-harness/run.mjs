// One-command LOCAL real-send QA for the beta report (報告 → 見直し), with zero production contact:
//
//   npm run qa:local-feedback-send
//
// then open EXACTLY the URL printed in the READY banner (http://localhost:3013/editor) and send from 報告 → 見直し.
//
// It starts (a) harness.mjs = the REAL beta-feedback Edge Function code with LOCAL stand-ins for Discord / the Sheet /
// Cloudflare siteverify, and (b) `next dev --webpack -p 3013` pointed at it via process env (process env wins over
// .env.local, which is neither modified nor otherwise affected).
//
// IMPORTANT (the failure this guards against): Next allows ONE `next dev` per folder. If you already have a dev server
// running in this folder (e.g. on :3003), a second one refuses to start -- and your browser would keep talking to the
// OLD server, which sends to the real backend and fails with 「送信できませんでした」. So this launcher:
//   * finds an existing dev server of THIS folder (from .next/dev/lock) and stops it (pass --keep-existing to abort
//     instead),
//   * refuses to continue if the ports are taken by something else,
//   * prints the URL only after it has verified that THIS server (not another) is serving on the harness port.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import { join } from "node:path";

const root = join(import.meta.dirname, "../..");
const NEXT_PORT = Number(process.env.HARNESS_NEXT_PORT ?? 3013);
const HARNESS_PORT = Number(process.env.HARNESS_PORT ?? 54331);
const URL_TO_OPEN = `http://localhost:${NEXT_PORT}/editor`;
const KEEP_EXISTING = process.argv.includes("--keep-existing");
const LOCK = join(root, ".next/dev/lock");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (msg) => { console.error(`\n[run] ✖ ${msg}\n`); process.exit(1); };

const pidAlive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const readLock = () => { try { return JSON.parse(readFileSync(LOCK, "utf8")); } catch { return null; } };
const portInUse = (port) => new Promise((resolve) => {
  const s = net.connect({ port, host: "127.0.0.1" });
  s.once("connect", () => { s.destroy(); resolve(true); });
  s.once("error", () => resolve(false));
});

// --- 1. an existing dev server of THIS folder would silently steal the browser ------------------------------------
const existing = readLock();
if (existing && pidAlive(existing.pid)) {
  if (KEEP_EXISTING) {
    fail(`A dev server for this folder is already running (PID ${existing.pid}, ${existing.appUrl}). Next allows only one per folder.\n     Stop it (taskkill /PID ${existing.pid} /T /F) or re-run without --keep-existing to let this launcher stop it.`);
  }
  console.log(`[run] Found your existing dev server for this folder: PID ${existing.pid} on ${existing.appUrl} (it sends to the REAL backend).`);
  console.log(`[run] Stopping it so the local-harness server can start (Next allows one dev server per folder)…`);
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(existing.pid), "/T", "/F"], { stdio: "ignore" });
  else process.kill(existing.pid);
  for (let i = 0; i < 40 && pidAlive(existing.pid); i += 1) await sleep(250);
  if (pidAlive(existing.pid)) fail(`Could not stop PID ${existing.pid}. Stop it yourself, then re-run.`);
  await sleep(500);
}

// --- 2. our ports must be free --------------------------------------------------------------------------------------
for (const [port, what] of [[NEXT_PORT, "the QA Next dev server"], [HARNESS_PORT, "the local beta-feedback function"]]) {
  if (await portInUse(port)) fail(`Port ${port} (${what}) is already in use by something else. Free it, or set ${port === NEXT_PORT ? "HARNESS_NEXT_PORT" : "HARNESS_PORT"} to another port.`);
}
if (!existsSync(join(root, "node_modules/next/dist/bin/next"))) fail("node_modules/next is missing in this folder (run npm install / link node_modules first).");

// --- 3. start both ------------------------------------------------------------------------------------------------
const shared = {
  ...process.env,
  HARNESS_PORT: String(HARNESS_PORT),
  HARNESS_ORIGINS: `http://localhost:${NEXT_PORT},http://127.0.0.1:${NEXT_PORT}`,
  B3_EXPECT: process.env.B3_EXPECT ?? "B3 Human QA送信確認",
  B3_FORBID: process.env.B3_FORBID ?? "これはB3送信テスト用の原稿本文ですABC987",
  B3_FORBID_TITLE: process.env.B3_FORBID_TITLE ?? "B3TITLE-XYZ",
};
const nextEnv = {
  ...shared,
  NEXT_PUBLIC_BETA_FEEDBACK_ENABLED: process.env.NEXT_PUBLIC_BETA_FEEDBACK_ENABLED ?? "true",
  NEXT_PUBLIC_TATESPUN_EDITOR_SURFACE: process.env.NEXT_PUBLIC_TATESPUN_EDITOR_SURFACE ?? "WINDOWED",
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${HARNESS_PORT}`, // the local function, never the real project
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-dummy-anon",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA", // Cloudflare's public always-pass dev widget key
};
const harness = spawn(process.execPath, [join(import.meta.dirname, "harness.mjs")], { cwd: root, env: shared, stdio: "inherit" });
const next = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "dev", "--webpack", "-p", String(NEXT_PORT)], {
  cwd: root,
  env: nextEnv,
  stdio: "inherit",
});
let stopping = false;
const stop = () => { stopping = true; harness.kill(); next.kill(); };
process.on("SIGINT", () => { stop(); process.exit(0); });
process.on("SIGTERM", () => { stop(); process.exit(0); });
harness.on("exit", (code) => { if (!stopping) { console.error(`\n[run] ✖ the local function harness exited (${code}). Stopping.`); stop(); process.exitCode = 1; } });
next.on("exit", (code) => { if (!stopping) { console.error(`\n[run] ✖ the QA Next dev server exited (${code}). NOT READY -- do not use any other localhost port for this test.`); stop(); process.exitCode = 1; } });

// --- 4. only announce the URL after verifying THIS server is the one serving -----------------------------------------
async function ready() {
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    if (stopping) return false;
    try {
      const page = await fetch(URL_TO_OPEN, { signal: AbortSignal.timeout(60_000) });
      const pre = await fetch(`http://127.0.0.1:${HARNESS_PORT}/functions/v1/beta-feedback`, {
        method: "OPTIONS",
        headers: { Origin: `http://localhost:${NEXT_PORT}`, "Access-Control-Request-Method": "POST" },
      });
      const lock = readLock();
      if (page.ok && pre.headers.get("access-control-allow-origin") === `http://localhost:${NEXT_PORT}` && lock && lock.port === NEXT_PORT && pidAlive(lock.pid)) return true;
    } catch { /* still starting */ }
    await sleep(1000);
  }
  return false;
}
if (await ready()) {
  const bar = "=".repeat(78);
  console.log(`\n${bar}
 LOCAL REAL-SEND QA — READY   (talks ONLY to the local harness; nothing reaches production)

 OPEN EXACTLY:   ${URL_TO_OPEN}
 (any other port — e.g. the old :3003 — is a different server that sends to the real backend and will fail)

 1. Work title:  B3TITLE-XYZ
 2. Manuscript body:  ${shared.B3_FORBID}
 3. 報告 → 見直し → note "${shared.B3_EXPECT}" (Q1/Q2 as you like) → 匿名で送信する
 4. Read THIS terminal: "[function] POST … -> 200" then the "B3 LOCAL SEND VERDICT" block.
    No "[function]" line after you press send = the page is not on the URL above.
 Ctrl+C stops everything.
${bar}\n`);
} else if (!stopping) {
  fail("The QA server did not become ready (or is not the one answering on the harness port). Do not use any localhost page for this test.");
}
