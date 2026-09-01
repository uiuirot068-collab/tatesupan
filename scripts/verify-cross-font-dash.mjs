// TSP-LOOP-003 — CROSS-FONT `――` / `……` regression gate.
//
// Renders the exact Human-QA fixture through the production renderer under ALL
// FIVE shipped body fonts (verify-punct-optical only exercises the A5 default =
// Shippori, which is why it PASSed while Human QA failed Zen Old / Noto Serif /
// Noto Sans). For each `――` run it walks the screenshot luminance profile
// straight down the run and fails RED if the joint lightens (a human-visible
// gap shows up as jointDarknessRatio → ~0, the per-glyph split measured 0.03).
// For each `……` run it checks the ink stays column-centred (the Zen Old
// left-shift bug). Exit 0 = GREEN, 1 = RED.
//
//   node scripts/verify-cross-font-dash.mjs [--url http://localhost:3000] [--artifact-dir DIR]
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { createRequire } from "node:module";
const require0 = createRequire(import.meta.url);
let decodePng;
try { const m = require0("fast-png"); decodePng = m.decode; }
catch { console.error("SKIP: fast-png not installed."); process.exit(0); }

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const BASE = arg("--url", "http://localhost:3000");
const ARTIFACT_DIR = arg("--artifact-dir", "");
const PORT = 19428;
const UDD = path.join(os.tmpdir(), "tsp-dashjoint-" + Date.now());
const BROWSER = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"].find((p) => { try { return fs.existsSync(p); } catch { return false; } });
const FONTS = [
  { key: "shippori", label: "Shippori Mincho", family: "'Shippori Mincho', serif" },
  { key: "zenold", label: "Zen Old Mincho", family: "'Zen Old Mincho', serif" },
  { key: "notoserif", label: "Noto Serif JP", family: "'Noto Serif JP', serif" },
  { key: "notosans", label: "Noto Sans JP", family: "'Noto Sans JP', sans-serif" },
  { key: "system", label: "System Serif", family: "serif" },
];
const A5 = (fontFamily) => ({ paperSize: "A5", marginTop: 18, marginBottom: 18, marginGutter: 20, marginOuter: 14,
  fontSizePt: 9.0, lineHeightRatio: 1.7, columnCount: 1, columnGapMm: 0, fontFamily, charsPerLine: 53, linesPerColumn: 22, layoutMode: "capacity",
  masterPage: { nombrePosition: "center", hideNombreOnFirstPage: false, nombreStart: 1, nombreBottomMargin: 8, showHiddenNombre: false,
    hashiraOdd: "", hashiraEven: "", hashiraPosition: "top", headerFontSize: 8, nombreFontSize: 8 }, pageOverrides: {} });
// exact Human fixture + …… centering control
const FIXTURE = ["これは――テストです。", "――そうですね。", "彼は言った。――続けよう。", "そして……沈黙した。"].join("\n");
const CJK = "これはテストですそうねん彼言続そして沈黙";

let mid = 0; const pend = new Map();
function cdp(ws, method, params = {}) { const id = ++mid; ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => { const t = setTimeout(() => { pend.delete(id); rej(new Error("timeout " + method)); }, 45000);
    pend.set(id, { res: (v) => { clearTimeout(t); res(v); }, rej: (e) => { clearTimeout(t); rej(e); } }); }); }
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

async function main() {
  if (!BROWSER) { console.error("SKIP: no browser"); process.exit(0); }
  try { const r = await fetch(`${BASE}/editor`, { method: "HEAD" }); if (!r.ok && r.status !== 405) throw new Error("s" + r.status); }
  catch (e) { console.error("SKIP: dev server " + e.message); process.exit(0); }
  fs.rmSync(UDD, { recursive: true, force: true });
  if (ARTIFACT_DIR) fs.mkdirSync(path.resolve(ARTIFACT_DIR), { recursive: true });
  const proc = spawn(BROWSER, ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-allow-origins=*",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${UDD}`, "--window-size=1500,2400", "--hide-scrollbars", "--force-device-scale-factor=1", "about:blank"], { stdio: "ignore" });
  const report = {};
  try {
    let wsUrl;
    for (let i = 0; i < 60 && !wsUrl; i++) { try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch {} if (!wsUrl) await sleep(500); }
    const pt = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
    const ws = new WebSocket(pt.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    ws.onmessage = async (ev) => { const raw = typeof ev.data === "string" ? ev.data : await ev.data.text(); const m = JSON.parse(raw);
      if (m.id && pend.has(m.id)) { const { res, rej } = pend.get(m.id); pend.delete(m.id); if (m.error) rej(new Error(JSON.stringify(m.error))); else res(m.result); } };
    await cdp(ws, "Page.enable"); await cdp(ws, "Runtime.enable");
    await cdp(ws, "Page.navigate", { url: `${BASE}/editor` });
    await cdp(ws, "Runtime.evaluate", { expression: `(async()=>{for(let i=0;i<80;i++){const m=(await indexedDB.databases()).find(d=>d.name==='tategaki-editor-db');if(m)return 1;await new Promise(r=>setTimeout(r,100));}})()`, awaitPromise: true, returnByValue: true });

    for (const font of FONTS) {
      const seed = `(async()=>{const rec={id:9948,title:'DASHJOINT',content:${JSON.stringify(FIXTURE)},settings:${JSON.stringify(A5(font.family))},plotNote:'',updatedAt:Date.now(),isCollection:false,includedDocumentIds:[],isSample:false};const o=indexedDB.open('tategaki-editor-db');return await new Promise(res=>{o.onsuccess=()=>{const d=o.result;const t=d.transaction('documents','readwrite');t.objectStore('documents').put(rec);t.oncomplete=()=>res('ok');};});})()`;
      await cdp(ws, "Runtime.evaluate", { expression: seed, awaitPromise: true, returnByValue: true });
      await cdp(ws, "Page.navigate", { url: `${BASE}/editor?id=9948&t=${Date.now()}` });
      await sleep(6000);
      let loaded = false;
      for (let k = 0; k < 5 && !loaded; k++) {
        const chk = await cdp(ws, "Runtime.evaluate", { expression: `(async()=>{const fams=['Shippori Mincho','Zen Old Mincho','Noto Serif JP','Noto Sans JP'];try{await Promise.all(fams.flatMap(f=>['400','700'].map(w=>document.fonts.load(w+' 12px "'+f+'"',${JSON.stringify(CJK)}))));await document.fonts.ready;}catch(e){}return {loaded:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family),ready:document.fonts.status};})()`, awaitPromise: true, returnByValue: true });
        loaded = font.label === "System Serif" || (chk.result.value?.loaded || []).includes(font.label);
        if (!loaded) await sleep(1200);
      }
      await cdp(ws, "Runtime.evaluate", { expression: `(()=>{const c=document.querySelector('.page-card');if(c){c.style.opacity='0.999';void c.offsetHeight;c.style.opacity='';}return 1})()`, returnByValue: true });
      await sleep(1200);

      const dom = (await cdp(ws, "Runtime.evaluate", { expression: `
        (() => {
          const card = document.querySelector('.page-card'); if (!card) return { error: 'no card' };
          const line0 = document.querySelector('.tategaki-line'); const cs0 = getComputedStyle(line0);
          const R = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
          const runs = [...card.querySelectorAll('[data-protected-run-wrapper="dash"],[data-protected-run-wrapper="ellipsis"]')].map((w) => {
            const cs = getComputedStyle(w);
            const kind = w.dataset.protectedRunWrapper;
            const glyphs = [...w.querySelectorAll(':scope > [data-protected-run-glyph]')].map((g) => {
              const gc = getComputedStyle(g);
              return { rect: R(g), fontFamily: gc.fontFamily, fontFeatureSettings: gc.fontFeatureSettings,
                writingMode: gc.writingMode, textOrientation: gc.textOrientation, transform: gc.transform };
            });
            const line = w.parentElement;
            const sibs = [...line.children].filter((el) => el !== w && !el.dataset.protectedRunWrapper && el.textContent.trim());
            const rr = R(w);
            const prev = sibs.filter((el) => R(el).y + R(el).h <= rr.y + 1.5).sort((a, b) => R(b).y - R(a).y)[0];
            const next = sibs.filter((el) => R(el).y >= rr.y + rr.h - 1.5).sort((a, b) => R(a).y - R(b).y)[0];
            return { kind, rect: rr, glyphs, text: w.textContent, slotCount: Number(w.dataset.runSlotCount),
              writingMode: cs.writingMode, textOrientation: cs.textOrientation, fontFeatureSettings: cs.fontFeatureSettings,
              fontVariantEastAsian: cs.fontVariantEastAsian, fontFamily: cs.fontFamily, overflow: cs.overflow,
              alignItems: cs.alignItems, justifyContent: cs.justifyContent,
              prevRect: prev ? R(prev) : null, prevText: prev?.textContent || '',
              nextRect: next ? R(next) : null, nextText: next?.textContent || '' };
          });
          // which face actually rendered? compare a kanji ink width to the loaded list
          const loadedFams = [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family))];
          return { cardRect: R(card), fontPx: parseFloat(cs0.fontSize), sheetTextOrientation: getComputedStyle(document.querySelector('.tategaki-sheet, [class*=sheet]') || line0).textOrientation,
            lineFontFamily: cs0.fontFamily, loadedFams, runs };
        })()` , returnByValue: true })).result.value;
      if (dom.error) { report[font.key] = { error: dom.error }; continue; }

      // high-magnification screenshot covering EVERY dash run + neighbours
      const run0 = dom.runs[0];
      const SCALE = 12;
      const pad = dom.fontPx * (dom.cardRect.h / ((210 + 6) * 2.2)) * 1.4;
      const bx0 = Math.min(...dom.runs.map((r) => r.rect.x)) - pad;
      const by0 = Math.min(...dom.runs.map((r) => r.rect.y)) - pad;
      const bx1 = Math.max(...dom.runs.map((r) => r.rect.x + r.rect.w)) + pad;
      const by1 = Math.max(...dom.runs.map((r) => r.rect.y + r.rect.h)) + pad;
      const clip = { x: bx0, y: by0, width: bx1 - bx0, height: by1 - by0, scale: SCALE };
      const shot = await cdp(ws, "Page.captureScreenshot", { format: "png", clip });
      if (ARTIFACT_DIR) fs.writeFileSync(path.join(path.resolve(ARTIFACT_DIR), `joint-${font.key}-12x.png`), Buffer.from(shot.data, "base64"));
      // also a human-zoom (2x) shot of the whole card
      const cclip = { x: dom.cardRect.x, y: dom.cardRect.y, width: dom.cardRect.w, height: dom.cardRect.h, scale: 2 };
      const cshot = await cdp(ws, "Page.captureScreenshot", { format: "png", clip: cclip });
      if (ARTIFACT_DIR) fs.writeFileSync(path.join(path.resolve(ARTIFACT_DIR), `card-${font.key}-2x.png`), Buffer.from(cshot.data, "base64"));

      const png = decodePng(Buffer.from(shot.data, "base64"));
      const { width: W, height: H, data, channels } = png;
      const lum = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return 255; const i = (y * W + x) * channels;
        return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; };
      const em = dom.fontPx * (dom.cardRect.h / ((210 + 6) * 2.2));

      const inkBox = (rect) => {
        const x0 = Math.floor((rect.x - clip.x) * SCALE), x1 = Math.ceil((rect.x + rect.w - clip.x) * SCALE);
        const y0 = Math.floor((rect.y - clip.y) * SCALE), y1 = Math.ceil((rect.y + rect.h - clip.y) * SCALE);
        let mnX = 1e9, mxX = -1e9, mnY = 1e9, mxY = -1e9, n = 0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (lum(x, y) < 140) { n++; if (x < mnX) mnX = x; if (x > mxX) mxX = x; if (y < mnY) mnY = y; if (y > mxY) mxY = y; }
        if (!n) return null;
        return { cx: (mnX + mxX + 1) / 2 / SCALE + clip.x, cy: (mnY + mxY + 1) / 2 / SCALE + clip.y,
          w: (mxX - mnX + 1) / SCALE, h: (mxY - mnY + 1) / SCALE };
      };
      const jointReport = dom.runs.map((run) => {
        // run ink column: x range of the run wrapper (in screenshot px)
        const rx0 = Math.round((run.rect.x - clip.x) * SCALE), rx1 = Math.round((run.rect.x + run.rect.w - clip.x) * SCALE);
        const ry0 = Math.round((run.rect.y - clip.y) * SCALE), ry1 = Math.round((run.rect.y + run.rect.h - clip.y) * SCALE);
        if (rx0 < 0 || ry0 < 0 || rx1 > W || ry1 > H) return { kind: run.kind, text: run.text, offscreen: true };
        if (run.kind === "ellipsis") {
          const b = inkBox(run.rect);
          const cxOffEm = b ? +((b.cx - (run.rect.x + run.rect.w / 2)) / em).toFixed(3) : null;
          return { kind: "ellipsis", text: run.text, inkCxOffEm: cxOffEm,
            inkWidthEm: b ? +(b.w / em).toFixed(3) : null,
            // the Zen Old bug was a ~-0.23em left shift; centred is within ~0.12em
            centred: cxOffEm != null && Math.abs(cxOffEm) <= 0.12 };
        }
        // per-row min luminance across the run width (the darkest pixel of the stroke on that row)
        const rowDark = []; // 255 - minLum  -> higher = darker ink present
        for (let y = ry0; y < ry1; y++) {
          let mn = 255;
          for (let x = rx0; x < rx1; x++) { const v = lum(x, y); if (v < mn) mn = v; }
          rowDark.push(255 - mn);
        }
        // ink rows = darkness above a soft floor (>=40 of 255 ~ any visible grey)
        const SOFT = 40;
        const inkRows = rowDark.filter((d) => d >= SOFT);
        const strokeDark = median(inkRows);           // typical stroke darkness
        // joint = middle of the run (between the two 1em glyph slots)
        const midY = Math.round((ry1 - ry0) / 2);
        const jointBand = rowDark.slice(Math.max(0, midY - Math.round(0.10 * em * SCALE)), midY + Math.round(0.10 * em * SCALE));
        const jointMinDark = jointBand.length ? Math.min(...jointBand) : 0;   // the lightest point at the seam
        const jointDarkRatio = strokeDark ? +(jointMinDark / strokeDark).toFixed(3) : null;
        // longest run of rows below the soft floor anywhere inside the ink span
        const firstInk = rowDark.findIndex((d) => d >= SOFT);
        const lastInk = rowDark.length - 1 - [...rowDark].reverse().findIndex((d) => d >= SOFT);
        let maxWhiteRun = 0, cur = 0, whiteAtJoint = 0;
        for (let i = firstInk; i <= lastInk; i++) {
          if (rowDark[i] < SOFT) { cur++; if (cur > maxWhiteRun) maxWhiteRun = cur; if (Math.abs(i - midY) <= Math.round(0.12 * em * SCALE)) whiteAtJoint = Math.max(whiteAtJoint, cur); }
          else cur = 0;
        }
        // continuity verdict: the seam must not lighten below ~80% of the
        // stroke (a human-visible gap shows up as jointDarkRatio → ~0), and the
        // ink must reach across most of the 2-slot span.
        const continuous = jointDarkRatio != null && jointDarkRatio >= 0.80
          && ((lastInk - firstInk) / SCALE / em) >= 1.7;
        return {
          kind: "dash",
          text: run.text,
          glyphFontFamily: run.glyphs[0]?.fontFamily,
          textOrientation: run.textOrientation, glyphTextOrientation: run.glyphs[0]?.textOrientation,
          fontFeatureSettings: run.fontFeatureSettings, glyphFFS: run.glyphs[0]?.fontFeatureSettings,
          strokeDark: +strokeDark.toFixed(1),
          jointMinDark: +jointMinDark.toFixed(1),
          jointDarkRatio,
          jointLightnessDropPct: strokeDark ? +(100 * (1 - jointMinDark / strokeDark)).toFixed(1) : null,
          maxWhiteRunPx: +(maxWhiteRun / SCALE).toFixed(3),
          whiteAtJointPx: +(whiteAtJoint / SCALE).toFixed(3),
          inkSpanEm: +((lastInk - firstInk) / SCALE / em).toFixed(3),
          continuous,
        };
      });
      report[font.key] = {
        label: font.label,
        webfontLoaded: font.label === "System Serif" ? "n/a" : (dom.loadedFams || []).includes(font.label),
        runWritingMode: run0.writingMode, runTextOrientation: run0.textOrientation,
        runFFS: run0.fontFeatureSettings, runFVEA: run0.fontVariantEastAsian,
        sheetTextOrientation: dom.sheetTextOrientation,
        joints: jointReport,
      };
      console.log(`\n===== ${font.label} =====`);
      console.log(JSON.stringify(report[font.key], null, 1));
    }
    ws.close();
  } finally { try { proc.kill(); } catch {} await sleep(1500); try { fs.rmSync(UDD, { recursive: true, force: true }); } catch {} }

  if (ARTIFACT_DIR) fs.writeFileSync(path.join(path.resolve(ARTIFACT_DIR), "dash-joint-report.json"), JSON.stringify(report, null, 2));
  console.log("\n\n#### CROSS-FONT ―― / …… — luminance-profile verdict ####");
  const dj = (r) => (r.joints || []).filter((j) => j.kind === "dash" && !j.offscreen);
  const ej = (r) => (r.joints || []).filter((j) => j.kind === "ellipsis" && !j.offscreen);
  const row = (lbl, fn) => console.log(lbl.padEnd(28) + FONTS.map((f) => String(fn(report[f.key] ?? {})).padStart(15)).join(""));
  console.log("".padEnd(28) + FONTS.map((f) => f.label.slice(0, 13).padStart(15)).join(""));
  row("―― joint darkness ratio", (r) => dj(r).map((j) => j.jointDarkRatio).join("/"));
  row("―― joint lightness drop%", (r) => dj(r).map((j) => j.jointLightnessDropPct).join("/"));
  row("―― CONTINUOUS?", (r) => dj(r).map((j) => j.continuous ? "yes" : "NO").join("/") || "-");
  row("…… ink cx off (em)", (r) => ej(r).map((j) => j.inkCxOffEm).join("/") || "-");
  row("…… CENTRED?", (r) => ej(r).map((j) => j.centred ? "yes" : "NO").join("/") || "-");
  const dashBroken = Object.values(report).some((r) => dj(r).length && dj(r).some((j) => !j.continuous));
  const dashMissing = Object.values(report).some((r) => !r.error && dj(r).length === 0);
  const ellBroken = Object.values(report).some((r) => ej(r).some((j) => !j.centred));
  const red = dashBroken || dashMissing || ellBroken;
  console.log(`\nRESULT: ${red ? "RED" : "GREEN"} —` +
    (dashBroken ? " ―― joint breaks on ≥1 face;" : "") +
    (dashMissing ? " ―― run not found on ≥1 face;" : "") +
    (ellBroken ? " …… off-centre on ≥1 face;" : "") +
    (red ? "" : " ―― continuous and …… centred on every shipped face."));
  process.exit(red ? 1 : 0);
}
main().catch((e) => { console.error("FATAL", e); process.exit(2); });
