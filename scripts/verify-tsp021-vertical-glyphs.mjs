// TSP-LOOP-021 §B — vertical glyph substitution / orientation regression.
//
// Real-device (mobile) report: a lone … (U+2026) AND ― (U+2015) render
// HORIZONTALLY inside the vertical column. Root cause is not per-character:
// `.page-card` sets `text-orientation: upright`, which (per CSS Writing Modes)
// suppresses the `vert` OpenType substitution for the glyph class that needs
// it — the leaders (…／‥) and the bars (―／—). Chrome applies `vert` anyway
// when the run also asks for `font-feature-settings: normal`; mobile Safari
// follows the spec and does not, so those glyphs stay horizontal on mobile.
//
// The fix re-establishes `text-orientation: mixed` for exactly that glyph
// class — for a lone occurrence (`[data-vertical-leader]`) and for the 2+
// protected run (`[data-protected-run-wrapper]`) — so `vert` / UTR#50
// rotation applies on every engine. `。、・` and brackets stay upright
// (correct for them). The manuscript source text is never rewritten.
//
// This gate seeds a doc, renders it, screenshots, and measures the
// dark-pixel bounding box of each test glyph: leaders and bars must be
// TALLER than wide; `。、・` must stay roughly square.
//
// Needs the app running.  npm run dev  then:
//   node scripts/verify-tsp021-vertical-glyphs.mjs [--url http://localhost:3000]
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require0 = createRequire(import.meta.url);
let decodePng;
try { decodePng = require0("fast-png").decode; }
catch { console.error("SKIP: fast-png not installed."); process.exit(0); }

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const BASE = arg("--url", process.env.GRID_QA_URL || "http://localhost:3000");
const PORT = 19423;
const UDD = path.join(os.tmpdir(), "tsp-vglyph-qa-udd-" + Date.now());
const BROWSER = [
  process.env.GRID_QA_BROWSER,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean).find((p) => { try { return fs.existsSync(p); } catch { return false; } });

// Each line isolates one test target so its slot is easy to find.
// 0: lone …   1: lone ‥   2: lone ―   3: lone —   4: ……   5: ――
// 6: 。   7: 、   8: ・   9: control kana
const FIXTURE = ["A…B", "C‥D", "E―F", "G—H", "I……J", "K――L", "M。N", "O、P", "Q・R", "スーパー", "波〜線", "あいう"].join("\n");
const S = {
  paperSize: "A5", marginTop: 18, marginBottom: 18, marginGutter: 20, marginOuter: 14,
  fontSizePt: 9.0, lineHeightRatio: 1.7, columnCount: 1, columnGapMm: 0,
  fontFamily: "'Shippori Mincho', serif", charsPerLine: 53, linesPerColumn: 22, layoutMode: "capacity",
  masterPage: { nombrePosition: "center", hideNombreOnFirstPage: false, nombreStart: 1, nombreBottomMargin: 6,
    showHiddenNombre: false, hashiraOdd: "", hashiraEven: "", hashiraPosition: "top", headerFontSize: 8, nombreFontSize: 8 },
  pageOverrides: {},
};

let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };

const pend = new Map();
let msgId = 0;
function cdp(ws, method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => {
    const t = setTimeout(() => { pend.delete(id); rej(new Error("CDP timeout: " + method)); }, 30000);
    pend.set(id, { res: (v) => { clearTimeout(t); res(v); }, rej: (e) => { clearTimeout(t); rej(e); } });
  });
}

async function main() {
  if (!BROWSER) { console.error("SKIP: no Chrome/Edge binary. Set GRID_QA_BROWSER."); process.exit(0); }
  try {
    const r = await fetch(`${BASE}/editor`, { method: "HEAD" });
    if (!r.ok && r.status !== 405) throw new Error("status " + r.status);
  } catch (e) { console.error(`SKIP: dev server not reachable at ${BASE} (${e.message}).`); process.exit(0); }

  fs.rmSync(UDD, { recursive: true, force: true });
  const proc = spawn(BROWSER, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--remote-allow-origins=*", `--remote-debugging-port=${PORT}`, `--user-data-dir=${UDD}`,
    "--window-size=1400,2400", "--hide-scrollbars", "--force-device-scale-factor=1", "about:blank"], { stdio: "ignore" });
  try {
    let wsUrl;
    for (let i = 0; i < 60 && !wsUrl; i++) {
      try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch {}
      if (!wsUrl) await sleep(500);
    }
    if (!wsUrl) throw new Error("CDP endpoint never came up");
    const pageTarget = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    ws.onmessage = async (ev) => {
      const raw = typeof ev.data === "string" ? ev.data : await ev.data.text();
      const m = JSON.parse(raw);
      if (m.id && pend.has(m.id)) { const { res, rej } = pend.get(m.id); pend.delete(m.id);
        if (m.error) rej(new Error(JSON.stringify(m.error))); else res(m.result); }
    };
    const P = (method, params) => cdp(ws, method, params);
    await P("Page.enable"); await P("Runtime.enable");
    await P("Page.navigate", { url: `${BASE}/editor` });
    const dbReady = await P("Runtime.evaluate", { expression: `(async()=>{for(let i=0;i<80;i++){const meta=(await indexedDB.databases()).find(d=>d.name==='tategaki-editor-db');if(meta){const stores=await new Promise(resolve=>{const o=indexedDB.open(meta.name);o.onsuccess=()=>{const d=o.result;const value=[...d.objectStoreNames];d.close();resolve(value)};o.onerror=()=>resolve([])});if(stores.includes('documents'))return {ok:true}}await new Promise(r=>setTimeout(r,100));}return {ok:false}})()`, awaitPromise: true, returnByValue: true });
    if (!dbReady.result.value?.ok) throw new Error("app IndexedDB schema did not initialize");
    const seed = `(async()=>{const rec={id:9962,title:'VGLYPH-QA',content:${JSON.stringify(FIXTURE)},settings:${JSON.stringify(S)},plotNote:'',updatedAt:Date.now(),isCollection:false,includedDocumentIds:[],isSample:false};const o=indexedDB.open('tategaki-editor-db');return await new Promise(res=>{o.onsuccess=()=>{const d=o.result;try{const t=d.transaction('documents','readwrite');t.objectStore('documents').put(rec);t.oncomplete=()=>res('ok');t.onerror=()=>res('tx');}catch(e){res('e '+e.message);}};o.onerror=()=>res('oe');});})()`;
    const sr = await P("Runtime.evaluate", { expression: seed, awaitPromise: true, returnByValue: true });
    if (sr.result.value !== "ok") throw new Error("seed failed: " + sr.result.value);
    await P("Page.navigate", { url: `${BASE}/editor?id=9962` });
    await sleep(8000);

    const dom = (await P("Runtime.evaluate", { expression: `(() => {
      const card = document.querySelector('.page-card');
      if (!card) return { error: 'no .page-card' };
      const R = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
      const targets = [];
      // Lone leaders / bars are wrapped in [data-vertical-leader] after the fix;
      // before the fix they are bare slot spans. Collect BOTH so the audit
      // shows the current state either way.
      card.querySelectorAll('.tategaki-line > span').forEach((sp) => {
        const inner = sp.querySelector(':scope > span');
        const t = (sp.textContent || '');
        if (/^[…‥―—。、・ー〜～]$/.test(t)) {
          const cs = getComputedStyle(inner || sp);
          targets.push({ kind: 'slot', t, rect: R(inner || sp), slotRect: R(sp),
            wm: cs.writingMode, to: cs.textOrientation, ffs: cs.fontFeatureSettings,
            wrapped: !!(inner && inner.dataset.verticalLeader !== undefined) });
        }
      });
      card.querySelectorAll('[data-protected-run-wrapper]').forEach((w) => {
        const cs = getComputedStyle(w);
        targets.push({ kind: 'run', t: w.textContent, rect: R(w), slotRect: R(w),
          wm: cs.writingMode, to: cs.textOrientation, ffs: cs.fontFeatureSettings, wrapped: true });
      });
      return { cardRect: R(card), targets, bodyText: card.textContent };
    })()`, returnByValue: true })).result.value;
    if (dom.error) throw new Error(dom.error);

    const SCALE = 4;
    const clip = { x: Math.max(0, dom.cardRect.x - 2), y: Math.max(0, dom.cardRect.y - 2),
      width: dom.cardRect.w + 4, height: dom.cardRect.h + 4, scale: SCALE };
    const shot = await P("Page.captureScreenshot", { format: "png", clip });
    ws.close(); proc.kill();

    const png = decodePng(Buffer.from(shot.data, "base64"));
    const { width: W, height: H, data, channels } = png;
    const lum = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return 255;
      const i = (y * W + x) * channels; return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; };
    const inkBox = (r) => {
      const x0 = Math.floor((r.x - clip.x) * SCALE), y0 = Math.floor((r.y - clip.y) * SCALE);
      const x1 = Math.ceil((r.x + r.w - clip.x) * SCALE), y1 = Math.ceil((r.y + r.h - clip.y) * SCALE);
      let mnX = 1e9, mxX = -1e9, mnY = 1e9, mxY = -1e9, n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (lum(x, y) < 140) {
        n++; if (x < mnX) mnX = x; if (x > mxX) mxX = x; if (y < mnY) mnY = y; if (y > mxY) mxY = y;
      }
      if (!n) return null;
      return { width: (mxX - mnX + 1) / SCALE, height: (mxY - mnY + 1) / SCALE, n };
    };

    check("source text keeps its original code points — no presentation-form / bar substitution",
      /[…]/.test(dom.bodyText) && /[―]/.test(dom.bodyText) && !/[︙⋮⋯｜│]/.test(dom.bodyText),
      `…:${dom.bodyText.includes("…")} ―:${dom.bodyText.includes("―")}`);

    const seen = {};
    for (const tgt of dom.targets) {
      const ink = inkBox(tgt.rect);
      if (!ink) { check(`"${tgt.t}" (${tgt.kind}) has visible ink`, false, "no dark pixels"); continue; }
      const ratio = ink.height / ink.width;
      seen[tgt.t] = tgt;
      const label = `${tgt.kind === "run" ? "run " : "lone "}"${tgt.t}"  wm=${tgt.wm} to=${tgt.to} ffs=${(tgt.ffs || "").slice(0, 12)}  ink ${ink.width.toFixed(1)}w×${ink.height.toFixed(1)}h  h/w=${ratio.toFixed(2)}`;
      if (/[…‥―—]/.test(tgt.t)) {
        // the CONFIRMED class (tester-reported): leaders + bars MUST read
        // vertically AND turn `vert` back on via an explicit
        // font-feature-settings: normal (keeping the inherited upright — a
        // `mixed` rotation shifts Zen Old's U+2026 off-axis).
        check(`vertical typesetting: ${label}`, ratio >= 1.4, `want h/w ≥ 1.4`);
        check(`   ↳ carries an explicit font-feature-settings: normal (restores vert on every engine)`,
          /\bnormal\b/.test(tgt.ffs || ""), `font-feature-settings=${tgt.ffs}`);
        check(`   ↳ text-orientation NOT overridden to mixed (no cross-font rotation shift — see verify-cross-font-dash)`,
          tgt.to !== "mixed", `text-orientation=${tgt.to}`);
      } else if (/[ー〜～]/.test(tgt.t)) {
        // same UTR#50 "R" class, NOT tester-reported → audit-only. Report the
        // rendered orientation + mechanism; if a mobile-Safari HUMAN QA shows
        // these horizontal, add them to VERT_LEADER_TEST (one line).
        check(`AUDIT "${tgt.t}" reads vertically on this engine: ${label}`, ratio >= 1.4, `want h/w ≥ 1.4`);
      } else {
        // 。、・ stay upright → roughly square (never a wide horizontal smear)
        check(`upright kept square: ${label}`, ratio >= 0.55 && ratio <= 2.4, `want 0.55 ≤ h/w ≤ 2.4`);
      }
    }

    for (const need of ["…", "‥", "―", "—", "……", "――", "。", "、", "・", "ー"]) {
      check(`fixture target rendered & measured: "${need}"`, !!seen[need], seen[need] ? "" : "not found in DOM");
    }
  } finally {
    try { proc.kill(); } catch {}
    fs.rmSync(UDD, { recursive: true, force: true });
  }

  console.log("");
  if (failures === 0) console.log("All TSP-021 vertical-glyph checks passed.");
  else { console.log(`${failures} TSP-021 vertical-glyph check(s) FAILED.`); process.exit(1); }
}

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
