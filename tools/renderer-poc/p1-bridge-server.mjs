#!/usr/bin/env node
// TateSpun — P1 Bridge Server (dev tool, PoC only)
//
// Persisted, reproducible replacement for a scratch file that was previously
// created ad hoc outside the repo and lost between sessions. This file is
// the *only* thing that changed to fix that: it is a standalone Node
// process using ONLY Node builtins (http/fs/path/url) — no dependency is
// added to TateSpun's package.json/lockfile, and this script is never
// imported by src/app/renderer-poc/* or any production code.
//
// Contract this server implements (read from src/app/renderer-poc/P1Section.tsx,
// unmodified — this server was written to match that file, not the other
// way around):
//   POST http://127.0.0.1:13021/update
//     body: { "html": "<...>" }   (JSON)
//     response: { "pages": number | null, "elapsedMs": number, "timedOut": boolean }
//   The Vivliostyle Viewer iframe is pointed by P1Section.tsx at a FIXED URL
//   on a *separate* process (the `vivliostyle preview` static server, default
//   port 13020): http://127.0.0.1:13020/vivliostyle/current.html
//   This bridge does not serve that origin — it only writes the file that
//   process reads from disk (served/current.html, relative to this script).
//   See README.md for exact commands.
//
// pages measurement: this minimal bridge does NOT drive a headless browser
// to read the real Vivliostyle page count (that requires a separate
// CDP-connected browser instance, out of scope for this small infra task —
// see README "Known limitation"). It returns pages: null, which
// P1Section.tsx already renders as "—" without error. elapsedMs reports how
// long this server took to accept + persist the HTML.
//
// Security notes (PoC, localhost-only):
//   - Binds to 127.0.0.1 only (not 0.0.0.0) — not reachable from the network.
//   - CORS is an allow-list of exactly one origin (default
//     http://localhost:3000, override with P1_ALLOWED_ORIGIN), not a wildcard.
//   - The received HTML string is only ever written to a file via fs.writeFile
//     and returned verbatim over HTTP. It is never passed to a shell, exec,
//     spawn, or eval — there is no code-execution path from POST body to
//     process execution anywhere in this file.
//   - Request bodies are capped (5MB) to avoid trivial memory exhaustion.

import { createServer } from "node:http";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BRIDGE_PORT = Number(process.env.P1_BRIDGE_PORT || 13021);
const VIV_PORT = Number(process.env.P1_VIV_PORT || 13020);
const ALLOWED_ORIGIN = process.env.P1_ALLOWED_ORIGIN || "http://localhost:3000";
const MAX_BODY_BYTES = 5_000_000;

// Fixed relative to this script (not process.cwd()) so it behaves the same
// no matter which directory `node .../p1-bridge-server.mjs` is invoked from.
const SERVED_DIR = path.join(__dirname, "served");
const CURRENT_FILE = path.join(SERVED_DIR, "current.html");

const IDLE_HTML =
  "<!doctype html><html><body>(P1 bridge idle — waiting for first POST /update)</body></html>";

let currentHtml = IDLE_HTML;

await mkdir(SERVED_DIR, { recursive: true });
await writeFile(CURRENT_FILE, currentHtml, "utf8");

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  const allowOrigin = origin === ALLOWED_ORIGIN ? origin : "null";
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
  return origin === ALLOWED_ORIGIN;
}

const server = createServer((req, res) => {
  const originAllowed = applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/current.html" && req.method === "GET") {
    // Convenience mirror on the bridge's own origin (smoke test / debug).
    // Production preview flow reads served/current.html via the separate
    // `vivliostyle preview` process on VIV_PORT instead (see README).
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(currentHtml);
    return;
  }

  if (req.url === "/update" && req.method === "POST") {
    if (!originAllowed) {
      sendJson(res, 403, { error: "origin not allowed" });
      return;
    }
    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("application/json")) {
      sendJson(res, 415, { error: "expected application/json" });
      return;
    }

    const t0 = Date.now();
    let body = "";
    let tooLarge = false;
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) {
        tooLarge = true;
        req.destroy();
      }
    });
    req.on("end", async () => {
      if (tooLarge) {
        sendJson(res, 413, { error: "payload too large" });
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        sendJson(res, 400, { error: "invalid JSON" });
        return;
      }
      if (typeof parsed.html !== "string") {
        sendJson(res, 400, { error: "missing html string field" });
        return;
      }
      try {
        // fs.writeFile only — the HTML string never touches a shell/exec path.
        await writeFile(CURRENT_FILE, parsed.html, "utf8");
        currentHtml = parsed.html;
        sendJson(res, 200, {
          pages: null, // see file header: real page count needs a separate headless-browser step, not implemented here
          elapsedMs: Date.now() - t0,
          timedOut: false,
        });
      } catch (err) {
        sendJson(res, 500, { error: String(err && err.message ? err.message : err) });
      }
    });
    return;
  }

  sendJson(res, 404, { error: "not found" });
});

server.listen(BRIDGE_PORT, "127.0.0.1", () => {
  console.log(`[p1-bridge] listening on http://127.0.0.1:${BRIDGE_PORT}`);
  console.log(`[p1-bridge] writing ${CURRENT_FILE}`);
  console.log(
    `[p1-bridge] separately run: vivliostyle preview served/current.html --host 127.0.0.1 --port ${VIV_PORT}  (see README.md)`
  );
  console.log(`[p1-bridge] allowed origin: ${ALLOWED_ORIGIN}`);
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
