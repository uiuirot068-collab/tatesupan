// TSP-LOOP-003 automated visual-uniformity regression (A5 solid grid).
//
// The canonical *cell* grid is checked by verify-grid-alignment.mjs. This one
// checks the *ink* — where the black glyph actually sits inside each (uniform)
// cell — so that a future change can't silently re-introduce the "punctuation
// jammed into the corner of a full-width cell" look that made a mathematically
// uniform grid read as uneven.
//
// It does NOT fail natural per-glyph shape variation (every font has that).
// It fails only TateSpun-caused abnormal offsets: punctuation whose ink center
// is far from the body-text ink center, or a protected run (――/……) whose
// pieces stopped touching.
//
// Needs the app running. Start `npm run dev`, then:
//   node scripts/verify-punct-optical.mjs [--url http://localhost:3000]
// Drives headless Edge/Chrome via CDP; decodes the screenshot with fast-png
// (already a project dependency).
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
const FEATURE_PRESETS = {
  off: '"vpal" 0, "vhal" 0, "palt" 0, "vkrn" 0, "pkna" 0',
  vhal: '"vpal" 0, "vhal" 1, "palt" 0, "vkrn" 0, "pkna" 0',
  vpal: '"vpal" 1, "vhal" 0, "palt" 0, "vkrn" 0, "pkna" 0',
  selective: '"vpal" 0, "vhal" 0, "palt" 0, "vkrn" 0, "pkna" 0',
};
const FEATURE_OVERRIDE_ARG = arg("--feature-override", "");
const FEATURE_OVERRIDE = FEATURE_PRESETS[FEATURE_OVERRIDE_ARG] || FEATURE_OVERRIDE_ARG;
const MIXED_MODEL = arg("--mixed-model", "baseline");
const METRICS_ONLY = process.argv.includes("--metrics-only");
const ARTIFACT_PATH = arg("--artifact", "");
const PORT = 19412;
const UDD = path.join(os.tmpdir(), "tsp-punct-qa-udd-" + Date.now());
const BROWSER = [
  process.env.GRID_QA_BROWSER,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean).find((p) => { try { return fs.existsSync(p); } catch { return false; } });

const A5 = {
  paperSize: "A5", marginTop: 18, marginBottom: 18, marginGutter: 20, marginOuter: 14,
  fontSizePt: 9.0, lineHeightRatio: 1.7, columnCount: 1, columnGapMm: 0,
  fontFamily: "'Shippori Mincho', serif", charsPerLine: 53, linesPerColumn: 22, layoutMode: "capacity",
  masterPage: { nombrePosition: "center", hideNombreOnFirstPage: false, nombreStart: 1, nombreBottomMargin: 8,
    showHiddenNombre: false, hashiraOdd: "", hashiraEven: "", hashiraPosition: "top", headerFontSize: 8, nombreFontSize: 8 },
  pageOverrides: {},
};
const NATURAL_FIXTURE = [
  "吾輩は猫である。名前はまだ無い。「どこで生れたか」とんと見当がつかぬ。汽笛が鳴った――そして静寂が訪れた。",
  "彼は黙った……もう何も言えなかった。むかし｜漢字《かんじ》の里で昭和23年を迎えた。",
].join("\n");
const QA_PDF_FIXTURE = [
  "# TateSpun β前 Current Export Fatal QA Fixture",
  "改ページの記法は【改ページ】と書きます（この行はそのまま表示されます）。",
  "重要：改ページ＝【改ページ】、＃改ページ、は使わない。",
  "TCYはbare 2-digit auto detect。12月25日、明示記法は[tate]A5[/tate]と[tate]iv[/tate]、を使用。",
  "Ruby＝｜漢字《かんじ》、漢字。",
  "- - - - - / _ . # (test) [A_B] path/to/file.md",
  "## Editorへ貼る本文 QA_SAMPLE-v2.0 #tag",
  "第一章　QA検証用サンプル mixed Japanese + Latin strings。",
  "これは通常の地の文です。ABC xyz 0123456789 を確認します。",
  "「これはテスト用の会話文です」と彼女は言った――そうですね。",
].join("\n");
// Dedicated regression fixture for the yakumono→―― adjacency (`。――`, `」――`),
// with a kana→―― control on line 2. Short lines → dash lands mid-column-1
// where measurement is clean.
const YAKUMONO_DASH_FIXTURE = [
  "彼は言った。――そうですね、と彼は静かに答えた。",
  "汽笛が鳴った――そして汽車は遠くへ消えていった。",
  "「もう戻れない」――と彼はひとりつぶやいた。",
].join("\n");
const FX = arg("--fixture", "natural");
const FIXTURE = FX === "qa_pdf" ? QA_PDF_FIXTURE
  : FX === "yakumono_dash" ? YAKUMONO_DASH_FIXTURE
  : NATURAL_FIXTURE;

let mid = 0; const pend = new Map();
function cdp(ws, method, params = {}, sessionId) {
  const id = ++mid; ws.send(JSON.stringify({ id, method, params, sessionId }));
  return new Promise((res, rej) => {
    const t = setTimeout(() => { pend.delete(id); rej(new Error("CDP timeout: " + method)); }, 30000);
    pend.set(id, { res: (v) => { clearTimeout(t); res(v); }, rej: (e) => { clearTimeout(t); rej(e); } });
  });
}
const stat = (a) => {
  a = a.filter((x) => x != null && !Number.isNaN(x));
  if (!a.length) return { n: 0, mean: 0, sd: 0 };
  const m = a.reduce((x, y) => x + y, 0) / a.length;
  return { n: a.length, mean: +m.toFixed(3), sd: +Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length).toFixed(3),
    min: +Math.min(...a).toFixed(3), max: +Math.max(...a).toFixed(3) };
};
let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };

async function main() {
  if (!BROWSER) { console.error("SKIP: no Chrome/Edge binary. Set GRID_QA_BROWSER."); process.exit(0); }
  try {
    const r = await fetch(`${BASE}/editor`, { method: "HEAD" });
    if (!r.ok && r.status !== 405) throw new Error("status " + r.status);
  } catch (e) { console.error(`SKIP: dev server not reachable at ${BASE} (${e.message}).`); process.exit(0); }

  fs.rmSync(UDD, { recursive: true, force: true });
  const proc = spawn(BROWSER, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--remote-allow-origins=*",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${UDD}`, "--window-size=1400,2200",
    "--hide-scrollbars", "--force-device-scale-factor=1", "about:blank"], { stdio: "ignore" });
  try {
    let wsUrl;
    for (let i = 0; i < 60 && !wsUrl; i++) {
      try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch {}
      if (!wsUrl) await sleep(500);
    }
    if (!wsUrl) throw new Error("CDP endpoint never came up");
    const pageTarget = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
    let ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const receive = async (ev) => {
      const raw = typeof ev.data === "string" ? ev.data : await ev.data.text();
      const m = JSON.parse(raw);
      if (m.id && pend.has(m.id)) { const { res, rej } = pend.get(m.id); pend.delete(m.id);
        if (m.error) rej(new Error(JSON.stringify(m.error))); else res(m.result); }
    };
    ws.onmessage = receive;
    const pageCdp = (method, params = {}) => cdp(ws, method, params);
    await pageCdp("Page.enable"); await pageCdp("Runtime.enable");
    await pageCdp("Page.navigate", { url: `${BASE}/editor` });
    const dbReady = await pageCdp("Runtime.evaluate", { expression: `(async()=>{for(let i=0;i<80;i++){const meta=(await indexedDB.databases()).find(d=>d.name==='tategaki-editor-db');if(meta){const stores=await new Promise(resolve=>{const o=indexedDB.open(meta.name);o.onsuccess=()=>{const d=o.result;const value=[...d.objectStoreNames];d.close();resolve(value)};o.onerror=()=>resolve([])});if(stores.includes('documents'))return {ok:true,version:meta.version,stores}}await new Promise(r=>setTimeout(r,100));}return {ok:false}})()`, awaitPromise: true, returnByValue: true });
    if (!dbReady.result.value?.ok) throw new Error("app IndexedDB schema did not initialize");
    const seed = `(async()=>{const rec={id:9932,title:'PUNCT-QA',content:${JSON.stringify(FIXTURE)},settings:${JSON.stringify(A5)},plotNote:'',updatedAt:Date.now(),isCollection:false,includedDocumentIds:[],isSample:false};const o=indexedDB.open('tategaki-editor-db');return await new Promise(res=>{o.onsuccess=()=>{const d=o.result;try{const t=d.transaction('documents','readwrite');t.objectStore('documents').put(rec);t.oncomplete=()=>res('ok');t.onerror=()=>res('tx');}catch(e){res('e '+e.message);}};o.onerror=()=>res('oe');});})()`;
    const sr = await pageCdp("Runtime.evaluate", { expression: seed, awaitPromise: true, returnByValue: true });
    if (sr.result.value !== "ok") throw new Error("seed failed: " + sr.result.value);
    await pageCdp("Page.navigate", { url: `${BASE}/editor?id=9932` }); await sleep(8000);

    if (FEATURE_OVERRIDE) {
      await pageCdp("Runtime.evaluate", { expression: `(() => {
        const value = ${JSON.stringify(FEATURE_OVERRIDE)};
        document.querySelectorAll('.tategaki-line').forEach((line) => {
          line.style.setProperty('font-feature-settings', value, 'important');
          if (${JSON.stringify(FEATURE_OVERRIDE_ARG)} === 'selective') {
            [...line.children].forEach((slot) => {
              if (/[、。「」『』（）［］｛｝〈〉《》【】〔〕]/u.test(slot.textContent || '')) {
                slot.style.setProperty('font-feature-settings', '"vpal" 1, "vhal" 0, "palt" 0, "vkrn" 0, "pkna" 0', 'important');
              }
            });
          }
        });
        return [...document.querySelectorAll('.tategaki-line')].map((line) => getComputedStyle(line).fontFeatureSettings);
      })()`, returnByValue: true });
      await sleep(500);
    }
    if (MIXED_MODEL !== "baseline") {
      await pageCdp("Runtime.evaluate", { expression: `(() => {
        const model = ${JSON.stringify(MIXED_MODEL)};
        document.querySelectorAll('.tategaki-line > span').forEach((slot) => {
          if (!/^[\\x21-\\x7e]$/.test(slot.textContent || '')) return;
          if (model === 'fwid') slot.style.setProperty('font-feature-settings', '"fwid" 1, "vpal" 0, "vhal" 0, "palt" 0', 'important');
          if (model === 'mixed') slot.style.setProperty('text-orientation', 'mixed', 'important');
          if (model === 'horizontal-box') {
            slot.style.setProperty('writing-mode', 'horizontal-tb', 'important');
            slot.style.setProperty('text-orientation', 'mixed', 'important');
            slot.style.setProperty('line-height', '1', 'important');
          }
          if (model === 'horizontal-inner') {
            const inner = document.createElement('span');
            inner.dataset.mixedScriptGlyph = 'ascii';
            inner.textContent = slot.textContent;
            slot.textContent = '';
            Object.assign(inner.style, {
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              writingMode: 'horizontal-tb',
              textOrientation: 'mixed',
              lineHeight: '1',
            });
            slot.append(inner);
          }
        });
      })()`, returnByValue: true });
      await sleep(500);
    }

    const dom = (await pageCdp("Runtime.evaluate", { expression: `
      (() => {
        const card = document.querySelector('.page-card, [class*="page-card"]');
        if (!card) return { error: 'no page-card' };
        const R = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
        const items = []; const runs = [];
        // TSP-LOOP-003 mixed-script run model: contiguous printable-ASCII is one
        // sideways [data-latin-run] wrapper occupying whole canonical slots.
        const latinRuns = [...card.querySelectorAll('.tategaki-line [data-latin-run]')].map((el) => {
          const line = el.closest('.tategaki-line');
          const rr = R(el); const lineRect = R(line);
          const sibs = [...line.children].filter((s) => s !== el);
          const prev = sibs.map((s) => ({ t: s.textContent, r: R(s) }))
            .filter((s) => Math.abs(s.r.x - rr.x) < 3 && s.r.y + s.r.h <= rr.y + 1)
            .sort((a, b) => b.r.y - a.r.y)[0] || null;
          const next = sibs.map((s) => ({ t: s.textContent, r: R(s) }))
            .filter((s) => Math.abs(s.r.x - rr.x) < 3 && s.r.y >= rr.y + rr.h - 1)
            .sort((a, b) => a.r.y - b.r.y)[0] || null;
          const cs = getComputedStyle(el);
          return { text: el.textContent, rect: rr, lineTop: lineRect.y,
            slotCount: Number(el.dataset.runSlotCount), startSlot: Number(el.dataset.runStartSlot),
            charCount: [...el.textContent].length,
            prevText: prev?.t || '', prevRect: prev?.r || null,
            nextText: next?.t || '', nextRect: next?.r || null,
            writingMode: cs.writingMode, textOrientation: cs.textOrientation,
            fontVariantEastAsian: cs.fontVariantEastAsian, overflow: cs.overflow };
        });
        card.querySelectorAll('.tategaki-line > span').forEach((sp) => {
          // TSP-LOOP-003 cross-font: ―― / …… are each ONE native
          // writing-mode:vertical-rl run; the browser lays the per-char
          // [data-protected-run-glyph] spans out with the font's own vertical
          // metrics so they connect for every face (no per-glyph slot boxes,
          // no optical nudge). Harvest one item per glyph + one run record.
          if (sp.dataset.protectedRunWrapper === 'dash' || sp.dataset.protectedRunWrapper === 'ellipsis') {
            const kind = sp.dataset.protectedRunWrapper;
            const glyphs = [...sp.querySelectorAll(':scope > [data-protected-run-glyph]')];
            const rr = R(sp); const line = sp.parentElement;
            const wcs = getComputedStyle(sp);
            const siblings = [...line.children].filter((el) => el !== sp && !el.dataset.protectedRunWrapper);
            const prev = siblings.find((el) => Math.abs((R(el).y + R(el).h) - rr.y) <= 1);
            const next = siblings.find((el) => Math.abs(R(el).y - (rr.y + rr.h)) <= 1);
            runs.push({ kind, rect: rr, glyphRects: glyphs.map(R), startSlot: Number(sp.dataset.runStartSlot),
              slotCount: Number(sp.dataset.runSlotCount), prevRect: prev ? R(prev) : null,
              nextRect: next ? R(next) : null, prevText: prev?.textContent || '', nextText: next?.textContent || '',
              writingMode: wcs.writingMode, textOrientation: wcs.textOrientation,
              alignItems: wcs.alignItems, justifyContent: wcs.justifyContent, overflow: wcs.overflow,
              fontFeatureSettings: wcs.fontFeatureSettings, fontVariantEastAsian: wcs.fontVariantEastAsian });
            glyphs.forEach((glyph) => {
              const gcs = getComputedStyle(glyph);
              items.push({ t: glyph.textContent, rect: R(glyph), innerRect: R(glyph), runKind: kind, style: {
                marginTop: gcs.marginTop, marginBottom: gcs.marginBottom, transform: gcs.transform,
                textOrientation: wcs.textOrientation, writingMode: wcs.writingMode,
                alignItems: wcs.alignItems, justifyContent: wcs.justifyContent, slotOverflow: wcs.overflow,
              }});
            });
            return;
          }
          if (sp.dataset.latinRun !== undefined) return;                  // sideways ASCII run (handled above)
          const cs = getComputedStyle(sp); const inner = sp.querySelector(':scope > span');
          const ics = inner ? getComputedStyle(inner) : null;
          if (inner && ics && ics.textCombineUpright === 'all') return;   // tcy
          if ((parseFloat(cs.left) || 0) > 1) return;                     // ruby rt lane
          items.push({
            t: sp.textContent,
            rect: R(sp),
            innerRect: inner ? R(inner) : null,
            style: {
              marginTop: ics?.marginTop || "",
              marginBottom: ics?.marginBottom || "",
              transform: ics?.transform || cs.transform,
              textOrientation: cs.textOrientation,
              alignItems: cs.alignItems,
              justifyContent: cs.justifyContent,
              slotOverflow: cs.overflow,
              fontFeatureSettings: cs.fontFeatureSettings,
              fontFamily: cs.fontFamily,
              writingMode: cs.writingMode,
              fontVariantEastAsian: cs.fontVariantEastAsian,
            },
          });
        });
        items.sort((a, b) => Math.abs(a.rect.x - b.rect.x) > 0.5 ? b.rect.x - a.rect.x : a.rect.y - b.rect.y);
        // TCY cells (縦中横) — bare auto-detect AND [tate]…[/tate] explicit both land here.
        const tcyCells = [...card.querySelectorAll('.tategaki-line span')]
          .filter((sp) => { const i = sp.querySelector(':scope > span'); return i && getComputedStyle(i).textCombineUpright === 'all'; })
          .map((sp) => sp.textContent);
        return { cardRect: R(card), ffs: getComputedStyle(document.querySelector('.tategaki-line')).fontFeatureSettings,
          items, runs, latinRuns, tcyCells, bodyText: card.textContent };
      })()` , returnByValue: true })).result.value;
    if (dom.error) throw new Error(dom.error);

    const SCALE = 4;
    const clip = { x: Math.max(0, dom.cardRect.x - 2), y: Math.max(0, dom.cardRect.y - 2),
      width: dom.cardRect.w + 4, height: dom.cardRect.h + 4, scale: SCALE };
    const shot = await pageCdp("Page.captureScreenshot", { format: "png", clip });
    if (ARTIFACT_PATH) {
      fs.mkdirSync(path.dirname(path.resolve(ARTIFACT_PATH)), { recursive: true });
      fs.writeFileSync(path.resolve(ARTIFACT_PATH), Buffer.from(shot.data, "base64"));
    }
    ws.close(); proc.kill();

    const png = decodePng(Buffer.from(shot.data, "base64"));
    const { width: W, height: H, data, channels } = png;
    const lum = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return 255;
      const i = (y * W + x) * channels; return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; };
    const inkBounds = (r) => {
      const x0 = Math.floor((r.x - clip.x) * SCALE), y0 = Math.floor((r.y - clip.y) * SCALE);
      const x1 = Math.ceil((r.x + r.w - clip.x) * SCALE), y1 = Math.ceil((r.y + r.h - clip.y) * SCALE);
      let mnX = 1e9, mxX = -1e9, mnY = 1e9, mxY = -1e9, n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (lum(x, y) < 140) {
        n++; if (x < mnX) mnX = x; if (x > mxX) mxX = x;
        if (y < mnY) mnY = y; if (y > mxY) mxY = y;
      }
      if (!n) return null;
      const left = mnX / SCALE + clip.x, right = (mxX + 1) / SCALE + clip.x;
      const top = mnY / SCALE + clip.y, bottom = (mxY + 1) / SCALE + clip.y;
      return { left, right, top, bottom, width: right - left, height: bottom - top,
        cx: (left + right) / 2, cy: (top + bottom) / 2 };
    };
    const inkCxOff = (r) => { const b = inkBounds(r); return b ? b.cx - (r.x + r.w / 2) : null; };
    const inkCyOff = (r) => { const b = inkBounds(r); return b ? b.cy - (r.y + r.h / 2) : null; };
    const isKanji = (c) => /[\u4E00-\u9FFF\u3400-\u4DBF]/.test(c);
    const isKana = (c) => /[\u3040-\u30FF]/.test(c);
    const isPunct = (c) => /[、。，．]/.test(c);
    const isBracket = (c) => /[「」『』（）【】〔〕｛｝〈〉《》]/.test(c);
    const isDash = (c) => /[―—]/.test(c);
    const isEllipsis = (c) => /[…‥]/.test(c);

    const body = [], punct = [], bracket = [];
    for (const it of dom.items) {
      const c = it.t; if (!c || !c.trim()) continue;
      const off = inkCyOff(it.rect); if (off == null) continue;
      if (isKanji(c) || isKana(c)) body.push(off);
      else if (isPunct(c)) punct.push(off);
      else if (isBracket(c)) bracket.push(off);
    }
    const bodyS = stat(body), punctS = stat(punct), brS = stat(bracket);
    const bodyX = dom.items.filter((it) => isKanji(it.t) || isKana(it.t)).map((it) => inkCxOff(it.rect));
    const mixedClasses = {
      latinUpper: (c) => /^[A-Z]$/.test(c),
      latinLower: (c) => /^[a-z]$/.test(c),
      asciiDigit: (c) => /^[0-9]$/.test(c),
      asciiPunct: (c) => /^[-_.\/#()[\]{}=:+]$/.test(c),
    };
    const mixedMetrics = Object.fromEntries(Object.entries(mixedClasses).map(([name, test]) => {
      const items = dom.items.filter((it) => test(it.t));
      const y = items.map((it) => inkCyOff(it.rect));
      const x = items.map((it) => inkCxOff(it.rect));
      const gaps = [];
      for (let i = 0; i < items.length - 1; i++) {
        const a = items[i], b = items[i + 1];
        if (Math.abs(a.rect.x - b.rect.x) > 0.5 || Math.abs((b.rect.y - a.rect.y) - a.rect.h) > 1) continue;
        const ab = inkBounds(a.rect), bb = inkBounds(b.rect); if (ab && bb) gaps.push(bb.top - ab.bottom);
      }
      return [name, { n: items.length, centerY: stat(y), centerX: stat(x), visibleGap: stat(gaps),
        samples: items.slice(0, 12).map((it) => ({ char: it.t, cp: `U+${it.t.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`,
          rect: it.rect, ink: inkBounds(it.rect), style: it.style })) }];
    }));
    const dashItems = dom.items.filter((it) => isDash(it.t) && inkBounds(it.rect));
    const ellipsisItems = dom.items.filter((it) => isEllipsis(it.t) && inkBounds(it.rect));
    const protectedMetrics = (items) => {
      const bounds = items.map((it) => inkBounds(it.rect));
      const xOffsets = items.map((it) => inkCxOff(it.rect));
      const yOffsets = items.map((it) => inkCyOff(it.rect));
      const unionRect = items.length ? {
        x: Math.min(...items.map((it) => it.rect.x)),
        y: Math.min(...items.map((it) => it.rect.y)),
        w: Math.max(...items.map((it) => it.rect.x + it.rect.w)) - Math.min(...items.map((it) => it.rect.x)),
        h: Math.max(...items.map((it) => it.rect.y + it.rect.h)) - Math.min(...items.map((it) => it.rect.y)),
      } : null;
      const unionInk = unionRect ? inkBounds(unionRect) : null;
      return {
        xOffsets: stat(xOffsets), yOffsets: stat(yOffsets),
        bounds: bounds.map((b) => ({ width: +b.width.toFixed(3), height: +b.height.toFixed(3) })),
        visualCenterX: bounds.length ? +(bounds.reduce((s, b) => s + b.cx, 0) / bounds.length).toFixed(3) : null,
        slotCenterX: items.length ? +(items.reduce((s, it) => s + it.rect.x + it.rect.w / 2, 0) / items.length).toFixed(3) : null,
        runCenterDeviationX: unionInk && unionRect ? +(unionInk.cx - (unionRect.x + unionRect.w / 2)).toFixed(3) : null,
        runInkBounds: unionInk ? { width: +unionInk.width.toFixed(3), height: +unionInk.height.toFixed(3) } : null,
        styles: items.map((it) => it.style),
      };
    };
    const dashM = protectedMetrics(dashItems), ellipsisM = protectedMetrics(ellipsisItems);

    // TSP-LOOP-003 cross-font — luminance-profile joint continuity. The prior
    // per-glyph DOM-adjacency check reported "touch" while Human QA saw a gap:
    // splitting ―― into per-glyph boxes broke the font's cross-glyph connection
    // and every face except Shippori rendered a near-white joint (darkness ~3%
    // of the stroke). This walks the actual pixels straight down the run and
    // fails if the seam lightens or a white row opens inside the ink span.
    const emPx0 = a1emGuess(dom);
    const runJointProfile = (runRect, slotCount) => {
      const rx0 = Math.floor((runRect.x - clip.x) * SCALE), rx1 = Math.ceil((runRect.x + runRect.w - clip.x) * SCALE);
      const ry0 = Math.floor((runRect.y - clip.y) * SCALE), ry1 = Math.ceil((runRect.y + runRect.h - clip.y) * SCALE);
      const rowDark = [];
      for (let y = ry0; y < ry1; y++) { let mn = 255; for (let x = rx0; x < rx1; x++) { const v = lum(x, y); if (v < mn) mn = v; } rowDark.push(255 - mn); }
      const SOFT = 40;
      const ink = rowDark.filter((d) => d >= SOFT).sort((a, b) => a - b);
      const strokeDark = ink.length ? ink[ink.length >> 1] : 0;
      const first = rowDark.findIndex((d) => d >= SOFT);
      const last = rowDark.length - 1 - [...rowDark].reverse().findIndex((d) => d >= SOFT);
      if (first < 0 || strokeDark === 0) return { strokeDark: 0, minJointRatio: 0, maxWhiteRunEm: 99, inkSpanEm: 0 };
      const bandPx = Math.max(1, Math.round(0.12 * emPx0 * SCALE));
      let minJointRatio = 1;
      for (let k = 1; k < slotCount; k++) {
        const jY = Math.round((k / slotCount) * (ry1 - ry0));
        let mn = 255 * 2;
        for (let i = Math.max(first, jY - bandPx); i <= Math.min(last, jY + bandPx); i++) mn = Math.min(mn, rowDark[i]);
        minJointRatio = Math.min(minJointRatio, mn / strokeDark);
      }
      let maxWhite = 0, cur = 0;
      for (let i = first; i <= last; i++) { if (rowDark[i] < SOFT) { cur++; if (cur > maxWhite) maxWhite = cur; } else cur = 0; }
      return { strokeDark: +strokeDark.toFixed(1), minJointRatio: +minJointRatio.toFixed(3),
        maxWhiteRunEm: +(maxWhite / SCALE / emPx0).toFixed(3), inkSpanEm: +((last - first) / SCALE / emPx0).toFixed(3) };
    };
    const dashRunJoints = dom.runs.filter((r) => r.kind === "dash").map((r) => runJointProfile(r.rect, r.slotCount || 2));
    const ellipsisRunJoints = dom.runs.filter((r) => r.kind === "ellipsis").map((r) => runJointProfile(r.rect, r.slotCount || 2));

    const bodyVisibleGaps = [];
    const previousToDashGaps = [];
    const dashToNextGaps = [];
    const yakumonoToDashGaps = [];   // 句読点 / 閉じ括弧 immediately before ――
    const yakumonoBeforeDashHang = []; // that yakumono's own ink-centre offset
    const isAdjacentSlot = (a, b) =>
      Math.abs(a.rect.x - b.rect.x) <= 0.5 &&
      Math.abs((b.rect.y - a.rect.y) - a.rect.h) <= 1;
    const visibleGap = (a, b) => {
      const ab = inkBounds(a.rect), bb = inkBounds(b.rect);
      return ab && bb ? bb.top - ab.bottom : null;
    };
    const stream = dom.items.filter((x) => x.t && x.t.trim());
    for (let i = 0; i < stream.length - 1; i++) {
      const a = stream[i], b = stream[i + 1];
      if (!isAdjacentSlot(a, b)) continue;
      const gap = visibleGap(a, b);
      if (gap == null) continue;
      if ((isKanji(a.t) || isKana(a.t)) && (isKanji(b.t) || isKana(b.t))) bodyVisibleGaps.push(gap);
      if ((isKanji(a.t) || isKana(a.t)) && isDash(b.t)) previousToDashGaps.push(gap);
      if (isDash(a.t) && (isKanji(b.t) || isKana(b.t))) dashToNextGaps.push(gap);
      if ((isPunct(a.t) || /[」』）】〕｝〉》］｠”’]/.test(a.t)) && isDash(b.t)) {
        yakumonoToDashGaps.push(gap);
        const h = inkCyOff(a.rect);
        if (h != null) yakumonoBeforeDashHang.push(h);
      }
    }
    console.log(`\nline font-feature-settings: ${dom.ffs}`);
    console.log(`ink centre-Y offset from cell centre (CSS px, + = ink low):`);
    console.log(`  body (kanji+kana): ${JSON.stringify(bodyS)}`);
    console.log(`  punct (、。)      : ${JSON.stringify(punctS)}`);
    console.log(`  bracket           : ${JSON.stringify(brS)}\n`);
    console.log(`body ink centre-X offset: ${JSON.stringify(stat(bodyX))}`);
    console.log(`mixed-script metrics: ${JSON.stringify(mixedMetrics)}`);
    console.log(`dash protected-run metrics: ${JSON.stringify(dashM)}`);
    console.log(`normal body-to-body visible gap: ${JSON.stringify(stat(bodyVisibleGaps))}`);
    console.log(`previous normal glyph-to-dash visible gap: ${JSON.stringify(stat(previousToDashGaps))}`);
    console.log(`dash-to-next normal glyph visible gap: ${JSON.stringify(stat(dashToNextGaps))}`);
    console.log(`ellipsis protected-run metrics: ${JSON.stringify(ellipsisM)}\n`);

    // --- TSP-LOOP-003 mixed-script RUN model metrics ---
    const runReport = (dom.latinRuns || []).map((r) => {
      const b = inkBounds(r.rect);
      const naturalPx = b ? b.bottom - b.top : 0;
      const reservedPx = r.rect.h;
      const startBoundaryPx = ((r.rect.y - r.lineTop) / a1emGuess(dom)); // slots from line top
      const nextBoundaryPx = r.nextRect ? (r.nextRect.y - r.lineTop) / a1emGuess(dom) : null;
      const tailGapPx = b && r.nextRect ? r.nextRect.y - b.bottom : null;
      const headGapPx = b && r.prevRect ? b.top - (r.prevRect.y + r.prevRect.h) : null;
      const centerXdev = b ? ((b.left + b.right) / 2) - (r.rect.x + r.rect.w / 2) : null;
      return {
        text: r.text.length > 24 ? r.text.slice(0, 24) + "…" : r.text,
        charCount: r.charCount, slotCount: r.slotCount,
        reservedPx: +reservedPx.toFixed(2), naturalInkPx: +naturalPx.toFixed(2),
        exactSlots: +(naturalPx / a1emGuess(dom)).toFixed(2),
        startSlotFrac: +startBoundaryPx.toFixed(3),
        nextSlotFrac: nextBoundaryPx == null ? null : +nextBoundaryPx.toFixed(3),
        headGapPx: headGapPx == null ? null : +headGapPx.toFixed(2),
        tailGapPx: tailGapPx == null ? null : +tailGapPx.toFixed(2),
        centerXdev: centerXdev == null ? null : +centerXdev.toFixed(3),
        writingMode: r.writingMode, textOrientation: r.textOrientation, fvea: r.fontVariantEastAsian,
      };
    });
    console.log(`latin-run model: ${dom.latinRuns?.length || 0} run(s)`);
    for (const r of runReport) console.log(`  ${JSON.stringify(r)}`);
    console.log();

    if (METRICS_ONLY) {
      console.log(`Mixed-script metrics-only run complete (${MIXED_MODEL}).`);
      return;
    }

    // --- Latin-run assertions (only when the fixture exercises runs) ---
    if (runReport.length > 0) {
      const em = a1emGuess(dom);
      check("every printable-ASCII run is one sideways [data-latin-run] wrapper",
        runReport.every((r) => /vertical-rl/.test(r.writingMode) && r.textOrientation === "mixed"),
        runReport.map((r) => `${r.writingMode}/${r.textOrientation}`).join(", "));
      check("run keeps 欧文 metrics (not forced full-width)",
        runReport.every((r) => r.fvea === "normal"),
        runReport.map((r) => r.fvea).join(", "));
      check("run slot consumption never exceeds its character count (pagination weight)",
        runReport.every((r) => r.slotCount <= r.charCount && r.slotCount >= 1),
        runReport.map((r) => `${r.slotCount}/${r.charCount}`).join(", "));
      check("run reserves exactly slotCount canonical slots",
        runReport.every((r) => Math.abs(r.reservedPx - r.slotCount * em) <= 0.6),
        runReport.map((r) => `${r.reservedPx.toFixed(1)}~${(r.slotCount * em).toFixed(1)}`).join(", "));
      check("run natural ink is not clipped by its reservation",
        runReport.every((r) => r.naturalInkPx <= r.reservedPx + 0.75),
        runReport.map((r) => `${r.naturalInkPx.toFixed(1)}<=${r.reservedPx.toFixed(1)}`).join(", "));
      check("run starts on an integer canonical slot boundary",
        runReport.every((r) => Math.abs(r.startSlotFrac - Math.round(r.startSlotFrac)) <= 0.22),
        runReport.map((r) => r.startSlotFrac).join(", "));
      check("Japanese after a run resumes on an integer canonical slot boundary",
        runReport.filter((r) => r.nextSlotFrac != null)
          .every((r) => Math.abs(r.nextSlotFrac - Math.round(r.nextSlotFrac)) <= 0.25),
        runReport.map((r) => r.nextSlotFrac).join(", "));
      check("run/Japanese boundary quantisation gap stays within one slot",
        runReport.filter((r) => r.tailGapPx != null).every((r) => r.tailGapPx >= -0.75 && r.tailGapPx <= em + 0.75),
        `tail gaps (px, 1 slot≈${em.toFixed(2)}): ${runReport.map((r) => r.tailGapPx).join(", ")}`);
      // Latin ink is not vertically symmetric in the em box (x-height vs
      // cap-height vs descenders), so a run's ink centroid legitimately sits a
      // fraction off the geometric kanji centreline. What must hold is that the
      // offset is small AND consistent across every run (no run visibly leaning).
      {
        const devs = runReport.map((r) => r.centerXdev).filter((v) => v != null);
        const s = stat(devs);
        check("run ink centre is near the column centreline and consistent across runs",
          Math.abs(s.mean) <= 1.0 && s.sd <= 0.35,
          `mean=${s.mean}px sd=${s.sd}px (n=${s.n})`);
      }
      // the old failure signature: many single upright ASCII glyphs, each in a
      // full-width cell, letter-spaced. After the run model, multi-char Latin
      // must NOT appear as consecutive single-char slots.
      const singleAscii = dom.items.filter((it) => /^[\x21-\x7e]$/.test(it.t));
      let consecutiveSingles = 0, maxConsecutive = 0;
      for (let i = 0; i < singleAscii.length - 1; i++) {
        const a = singleAscii[i], b = singleAscii[i + 1];
        if (Math.abs(a.rect.x - b.rect.x) <= 0.5 && Math.abs((b.rect.y - a.rect.y) - a.rect.h) <= 1.5) {
          consecutiveSingles++; maxConsecutive = Math.max(maxConsecutive, consecutiveSingles + 1);
        } else consecutiveSingles = 0;
      }
      check("no multi-character Latin is rendered as consecutive upright single-glyph slots",
        maxConsecutive <= 1, `longest upright single-ASCII chain = ${maxConsecutive}`);
    }

    // --- assertions (calibrated so natural glyph variation passes) ---
    const punctuationFeatures = dom.items.filter((it) => isPunct(it.t) || isBracket(it.t))
      .map((it) => it.style.fontFeatureSettings);
    check("A5 FixedSlot uses full-width body metrics and selective punctuation vpal",
      /"vpal"\s*0/.test(dom.ffs) && punctuationFeatures.length > 0 &&
      punctuationFeatures.every((value) => /"vpal"(?!\s*0)/.test(value)),
      `body=${dom.ffs} punctuation=${JSON.stringify(punctuationFeatures)}`);
    check("body-text ink sits near its cell centre",
      Math.abs(bodyS.mean) <= 0.9 && bodyS.sd <= 0.9, `mean=${bodyS.mean} sd=${bodyS.sd}`);

    // TSP-LOOP-003 yakumono structural model (per-class flex anchor).
    // The Phase 4 band-aid — a small paddingTop that nudged 句読点 onto the
    // body ink line — was rejected by Human QA: 、 still floated, 。 read as
    // far from the preceding glyph, 「」『』（） looked detached ("開いて"). The
    // structural fix delegates each yakumono's in-cell position to a
    // per-typographic-class flex anchor, matching a browser-native
    // `writing-mode: vertical-rl` block of the same text:
    //   - 句読点 (、。，．) + closing brackets/quotes: hang against the column
    //     START (cell top) -> ink high, hugging the preceding glyph.
    //   - opening brackets/quotes: hang against the column END (cell bottom)
    //     -> ink low, hugging the following glyph.
    // The canonical slot's top/left/width/height and the 1em advance are all
    // unchanged; only `justify-content` on the slot differs by class.
    const isOpenBracket = (c) => /[「『（【〔｛〈《［｟“‘]/.test(c);
    const isCloseBracket = (c) => /[」』）】〕｝〉》］｠”’]/.test(c);
    // 「『 are short corner marks (kagi) — small ink that sits clearly in the
    // bottom corner when bottom-anchored. （）〔〕【】｛｝［］〈〉《》 are all
    // near-full-height in upright orientation, so their ink centre legitimately
    // stays mid-cell even bottom-anchored; only the structural flex-end
    // direction is asserted for those (not an ink offset).
    const isShortOpenBracket = (c) => /[「『]/.test(c);
    const hangStartOff = [], hangEndOff = [], hangEndShortOff = [];
    const jc = { punct: [], openBracket: [], closeBracket: [] };
    for (const it of dom.items) {
      const c = it.t; if (!c || !c.trim()) continue;
      const off = inkCyOff(it.rect); if (off == null) continue;
      if (isPunct(c) || isCloseBracket(c)) hangStartOff.push(off);
      if (isOpenBracket(c)) hangEndOff.push(off);
      if (isShortOpenBracket(c)) hangEndShortOff.push(off);
      if (isPunct(c)) jc.punct.push(it.style.justifyContent);
      if (isOpenBracket(c)) jc.openBracket.push(it.style.justifyContent);
      if (isCloseBracket(c)) jc.closeBracket.push(it.style.justifyContent);
    }
    const hangStartS = stat(hangStartOff), hangEndS = stat(hangEndOff), hangEndShortS = stat(hangEndShortOff);
    console.log(`yakumono hang: start(top)=${JSON.stringify(hangStartS)} end(bottom)=${JSON.stringify(hangEndS)}`);
    console.log(`yakumono justify-content: ${JSON.stringify(jc)}`);

    // structural: the anchor is a per-class flex rule, not a per-glyph nudge.
    check("句読点 slots hang against the column start (justify-content: flex-start)",
      jc.punct.length > 0 && jc.punct.every((v) => v === "flex-start"),
      jc.punct.join("/") || "(no 句読点 in fixture)");
    check("closing brackets/quotes hang against the column start (justify-content: flex-start)",
      jc.closeBracket.length === 0 || jc.closeBracket.every((v) => v === "flex-start"),
      jc.closeBracket.join("/") || "(none in fixture)");
    check("opening brackets/quotes hang against the column end (justify-content: flex-end)",
      jc.openBracket.length === 0 || jc.openBracket.every((v) => v === "flex-end"),
      jc.openBracket.join("/") || "(none in fixture)");

    // optical: the resulting ink actually sits at the intended cell edge, and
    // does so consistently. The old "float in the middle of the cell" failure
    // is a near-zero offset; a runaway is |offset| past the cell half-height.
    check("句読点・閉じ括弧 ink hangs high in the cell (hugs the preceding glyph, no mid-cell float)",
      hangStartS.n > 0 && hangStartS.mean <= -0.8,
      `mean inkCyOff=${hangStartS.mean}px (want <= -0.8; ~0 = the old float)`);
    check("句読点・閉じ括弧 hang direction is consistent across marks",
      hangStartS.n > 0 && hangStartS.sd <= 0.9, `sd=${hangStartS.sd}`);
    check("開き括弧 ink hangs low in the cell (hugs the following glyph)",
      hangEndS.n === 0 || hangEndS.mean >= 0.8,
      hangEndS.n === 0 ? "(no opening bracket in fixture)" : `mean inkCyOff=${hangEndS.mean}px (want >= 0.8)`);
    // Short corner marks (「『（) alone — a tight consistency bound, no longer
    // diluted by the full-height 【〔《 whose ink centre legitimately stays mid
    // cell. Those are covered by the structural flex-end direction check above.
    check("短い開き括弧 (「『（) hang low, consistently",
      hangEndShortS.n === 0 || (hangEndShortS.mean >= 1.2 && hangEndShortS.sd <= 0.7),
      hangEndShortS.n === 0 ? "(none in fixture)" : `mean=${hangEndShortS.mean}px sd=${hangEndShortS.sd}`);
    check("yakumono ink stays inside its own canonical cell (hang, not overflow)",
      [...hangStartOff, ...hangEndOff].every((o) => Math.abs(o) <= 3.4),
      `max |yakumono off| = ${[...hangStartOff, ...hangEndOff].length ? Math.max(...[...hangStartOff, ...hangEndOff].map(Math.abs)).toFixed(2) : "n/a"}`);

    // TSP-LOOP-003: 縦中横 (TCY) — both bare auto-detect AND the explicit
    // [tate]…[/tate] notation must produce combined-upright cells; the
    // notation itself must never render as literal text.
    if (/\[tate\]/.test(FIXTURE)) {
      const tcy = dom.tcyCells || [];
      check("explicit [tate]…[/tate] notation is consumed (not shown as literal text)",
        !/\[tate\]|\[\/tate\]/.test(dom.bodyText || ""), `bodyText has [tate]? ${/\[tate\]/.test(dom.bodyText || "")}`);
      check("explicit [tate] content renders as a combined-upright cell",
        tcy.includes("A5") && tcy.includes("iv"), `tcy cells = ${JSON.stringify(tcy)}`);
      check("bare 2-digit TCY still works alongside the explicit notation",
        tcy.includes("12") || tcy.includes("25"), `tcy cells = ${JSON.stringify(tcy)}`);
    }
    check("body glyph ink is never abnormally offset from its cell centre",
      body.every((o) => Math.abs(o) <= 1.8),
      `max |body off| = ${body.length ? Math.max(...body.map(Math.abs)).toFixed(2) : "n/a"}`);
    const bodyXMean = stat(bodyX).mean;
    check("normal body establishes a centered X baseline",
      Math.abs(bodyXMean) <= 0.25, `body centre deviation=${bodyXMean}px`);
    // TSP-LOOP-003 cross-font: the run text sits where the font's vertical
    // metrics put it (no per-glyph x-nudge any more). A sub-pixel offset from
    // the body centreline is fine; a visible column shift (the old Zen Old ……
    // left-shift measured −0.23em) is not. Bound = 0.12em.
    const xTol = a1emGuess(dom) * 0.12;
    check("dash ink centre sits on the column axis (no visible horizontal shift)",
      dashM.xOffsets.n > 0 && Math.abs(dashM.xOffsets.mean - bodyXMean) <= xTol,
      `dash=${dashM.xOffsets.mean}px body=${bodyXMean}px deviation=${(dashM.xOffsets.mean - bodyXMean).toFixed(3)}px (tol ${xTol.toFixed(2)})`);
    check("ellipsis ink centre sits on the column axis (no visible horizontal shift)",
      ellipsisM.xOffsets.n === 0 || Math.abs(ellipsisM.xOffsets.mean - bodyXMean) <= xTol,
      ellipsisM.xOffsets.n === 0 ? "no ellipsis in fixture — skipped"
        : `ellipsis=${ellipsisM.xOffsets.mean}px body=${bodyXMean}px deviation=${(ellipsisM.xOffsets.mean - bodyXMean).toFixed(3)}px (tol ${xTol.toFixed(2)})`);
    // TSP-LOOP-003 cross-font: ―― / …… are ONE native writing-mode:vertical-rl
    // run each, with the run text as ONE inline run (a single text node in a
    // single glyph span) so the font connects the em dashes; per-glyph boxes
    // break that connection and re-open the cross-font joint gap.
    // TSP-LOOP-021 §B: the run keeps text-orientation: upright but relies on its
    // explicit font-feature-settings: normal to keep `vert` on for every engine
    // (mobile Safari included) — a `mixed` override rotates and shifts Zen Old
    // Mincho's ellipsis off-axis, so upright + explicit features is the choice.
    const dashRuns0 = dom.runs.filter((r) => r.kind === "dash");
    const ellipsisRuns0 = dom.runs.filter((r) => r.kind === "ellipsis");
    check("―― / …… render as one native vertical-rl run with one inline text run",
      dashRuns0.length > 0 &&
      [...dashRuns0, ...ellipsisRuns0].every((r) =>
        /vertical-rl/.test(r.writingMode) && r.textOrientation === "upright" &&
        /\bnormal\b/.test(r.fontFeatureSettings) &&
        r.alignItems === "center" && r.justifyContent === "center" && r.overflow === "hidden" &&
        r.fontVariantEastAsian === "normal" && r.glyphRects.length === 1),
      JSON.stringify([...dashRuns0, ...ellipsisRuns0].map((r) => ({ k: r.kind, wm: r.writingMode, to: r.textOrientation, ai: r.alignItems, jc: r.justifyContent, of: r.overflow, fvea: r.fontVariantEastAsian, g: r.glyphRects.length, s: r.slotCount }))));
    check("protected-run glyphs carry no per-glyph margin or transform nudge",
      [...dashM.styles, ...ellipsisM.styles].length > 0 &&
      [...dashM.styles, ...ellipsisM.styles].every((s) =>
        (s.marginTop === "0px" || s.marginTop === "") &&
        (s.marginBottom === "0px" || s.marginBottom === "") &&
        (s.transform === "none" || /^matrix\(1, 0, 0, 1, 0, 0\)$/.test(s.transform))),
      JSON.stringify([...dashM.styles, ...ellipsisM.styles]));
    check("protected-run wrapper clips sub-pixel ink overshoot to its canonical slots",
      [...dashM.styles, ...ellipsisM.styles].length > 0 &&
      [...dashM.styles, ...ellipsisM.styles].every((s) => s.slotOverflow === "hidden"),
      `overflow=${[...dashM.styles, ...ellipsisM.styles].map((s) => s.slotOverflow).join("/")}`);
    const bodyGapS = stat(bodyVisibleGaps), previousDashGapS = stat(previousToDashGaps), nextDashGapS = stat(dashToNextGaps);
    const yakuDashGapS = stat(yakumonoToDashGaps), yakuHangS = stat(yakumonoBeforeDashHang);
    const emGuess = a1emGuess(dom);
    console.log(`yakumono→―― start gap: ${JSON.stringify(yakuDashGapS)}  (1em ≈ ${emGuess.toFixed(2)}px)  yakumono hang: ${JSON.stringify(yakuHangS)}`);
    const run = dom.runs[0];
    const boundaryParts = run ? (() => {
      const prevInk = inkBounds(run.prevRect), nextInk = inkBounds(run.nextRect);
      const firstRect = run.glyphRects[0], lastRect = run.glyphRects[run.glyphRects.length - 1];
      const firstInk = inkBounds(firstRect), lastInk = inkBounds(lastRect);
      return {
        start: {
          adjacentClearance: run.prevRect.y + run.prevRect.h - prevInk.bottom,
          wrapperBoundary: firstRect.y - run.rect.y,
          dashClearance: firstInk.top - firstRect.y,
        },
        end: {
          dashClearance: lastRect.y + lastRect.h - lastInk.bottom,
          wrapperBoundary: run.rect.y + run.rect.h - (lastRect.y + lastRect.h),
          adjacentClearance: nextInk.top - run.nextRect.y,
        },
      };
    })() : null;
    if (boundaryParts) console.log(`dash visible-gap decomposition: ${JSON.stringify(boundaryParts)}`);
    // --- dash boundary: three independent assertions, not one loose tolerance ---
    // (A) control: a normal glyph (kanji/kana) before/after ―― keeps a tight
    //     body-sized gap.
    check("dash ← normal glyph (control): tight body-sized start gap",
      previousDashGapS.n === 0 || (previousDashGapS.mean >= bodyGapS.min && previousDashGapS.mean <= bodyGapS.max + 0.75),
      previousDashGapS.n === 0 ? "no kanji/kana-before-dash in fixture — skipped"
        : `start=${previousDashGapS.mean}px body mean=${bodyGapS.mean}px range=${bodyGapS.min}..${bodyGapS.max}px`);
    check("dash → next glyph (control): tight body-sized end gap",
      nextDashGapS.n > 0 && nextDashGapS.mean >= bodyGapS.min && nextDashGapS.mean <= bodyGapS.max + 0.75,
      `end=${nextDashGapS.mean}px start=${previousDashGapS.mean}px body range=${bodyGapS.min}..${bodyGapS.max}px`);
    // (B) yakumono→―― external boundary: a 句読点 / 閉じ括弧 hangs against the
    //     cell top, so the empty lower half of ITS cell is the yakumono's own
    //     trailing aki before the dash — a large-but-bounded gap (~0.5–1.0em).
    //     It must NOT collapse to a body gap (the yakumono stopped hanging) nor
    //     blow past one slot (the old flex-centre bug measured ~2.4em). This is
    //     the `。――` regression case.
    check("dash ← yakumono (。／」): bounded trailing aki, yakumono still hangs",
      yakuDashGapS.n === 0
        ? true
        : (yakuDashGapS.mean >= emGuess * 0.30 && yakuDashGapS.mean <= emGuess * 1.15 &&
           yakuHangS.n > 0 && yakuHangS.max <= -0.6),
      yakuDashGapS.n === 0 ? "no yakumono-before-dash in fixture — skipped"
        : `gap mean=${yakuDashGapS.mean}px (${(yakuDashGapS.mean / emGuess).toFixed(2)}em, want 0.30–1.15em)  hang max=${yakuHangS.max}px (want ≤ −0.6)`);
    // (C) internal joint continuity — THE cross-font check, measured from the
    //     screenshot luminance profile (not DOM adjacency). Walk straight down
    //     the run: the seam between the em dashes must not lighten (min joint
    //     darkness ≥ 85% of the stroke) and no white row may open inside the
    //     ink span (≤ ~0.06em of antialias tolerance). The old per-glyph split
    //     measured a joint at ~3% of the stroke on every face but Shippori.
    console.log(`dash run joint profile: ${JSON.stringify(dashRunJoints)}`);
    console.log(`ellipsis run joint profile: ${JSON.stringify(ellipsisRunJoints)}`);
    check("dash wrapper occupies its slots symmetrically (top boundary ≈ bottom boundary)",
      boundaryParts && Math.abs(boundaryParts.start.wrapperBoundary - boundaryParts.end.wrapperBoundary) <= 0.75,
      boundaryParts ? `start=${boundaryParts.start.wrapperBoundary.toFixed(3)} end=${boundaryParts.end.wrapperBoundary.toFixed(3)}` : "no run");
    // THE cross-font check: the seam between the em dashes must not lighten.
    // Broken per-glyph split measured ~0.03; one connected run measures ~1.0.
    check("―― reads as one continuous vertical rule — the joint does not lighten (every face)",
      dashRunJoints.length > 0 && dashRunJoints.every((j) => j.strokeDark > 0 && j.minJointRatio >= 0.85),
      `min joint/stroke ratio = ${dashRunJoints.map((j) => j.minJointRatio).join(", ")} (want ≥ 0.85; the per-glyph split measured ~0.03)`);
    check("―― ink spans its full 2-slot reservation (connects to both neighbours)",
      dashRunJoints.length > 0 && dashRunJoints.every((j) => j.inkSpanEm >= 1.80),
      `ink span = ${dashRunJoints.map((j) => j.inkSpanEm).join(", ")}em (want ≥ 1.80 of 2.00)`);
    if (ellipsisRunJoints.length > 0) {
      // …… is deliberately dots-with-gaps, not a rule — assert only that its
      // ink fills the 2 slots and does not overflow (the left-shift bug the
      // xOffset check catches; continuity does NOT apply).
      check("…… ink fills its 2-slot reservation without overflow",
        ellipsisRunJoints.every((j) => j.strokeDark > 0 && j.inkSpanEm >= 1.0 && j.inkSpanEm <= 2.05),
        `ellipsis ink span = ${ellipsisRunJoints.map((j) => j.inkSpanEm).join(", ")}em`);
    }
    check("protected run consumes exactly slotCount canonical slots",
      dom.runs.length > 0 && dom.runs.every((r) => r.prevRect &&
        Math.abs(r.rect.h - r.prevRect.h * r.slotCount) <= 0.1), JSON.stringify(dom.runs.map((r) => ({ k: r.kind, h: r.rect.h, s: r.slotCount, ph: r.prevRect?.h }))));
    check("glyph after a protected run keeps the unchanged canonical slot boundary",
      dom.runs.length > 0 && dom.runs.every((r) => r.nextRect &&
        Math.abs(r.nextRect.y - (r.rect.y + r.rect.h)) <= 0.1), JSON.stringify(dom.runs.map((r) => ({ k: r.kind, dy: r.nextRect ? r.nextRect.y - (r.rect.y + r.rect.h) : null }))));

    // (―― connectivity is asserted from the luminance profile above —
    //  "reads as one continuous vertical rule" / "no white gap".)
  } finally {
    try { proc.kill(); } catch {}
    await sleep(1500);
    try { fs.rmSync(UDD, { recursive: true, force: true }); } catch {}
  }
  if (failures > 0) { console.error(`\n${failures} optical check(s) failed.`); process.exit(1); }
  console.log("\nAll punctuation-optical checks passed.");
}
function a1emGuess(dom) {
  // scaled 1em px = fontPx * scale; fontPx = 9pt * 2.2 = 6.985 nominal at PX_PER_MM
  const scale = dom.cardRect.h / ((210 + 6) * 2.2);
  return 9 * (25.4 / 72) * 2.2 * scale;
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
