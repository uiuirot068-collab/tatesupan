// TSP-LOOP-003 export-fidelity regression.
//
// html-to-image's cloneCSSStyle rewrites every cloned `font-size` to
// `Math.floor(fontSize) - 0.1` px. For tategaki body text (~7px at
// preview scale) that is a ~15% shrink, so JPG/PDF exports render glyphs
// undersized inside their (correctly-sized) FixedSlot cells and read as
// sparse while the live preview is solid. capturePageToCanvas passes an
// explicit `includeStyleProperties` list (default set minus `font-size`)
// so each element keeps its own inline font-size instead.
//
// This test drives a real JPG export, intercepts the SVG <foreignObject>
// clone html-to-image feeds to its rasterizer, and asserts the cloned
// `.tategaki-line` font-size matches the live computed value.
//
// Needs the app running. Start `npm run dev`, then:
//   node scripts/verify-export-fidelity.mjs [--url http://localhost:3000]
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const BASE = arg("--url", process.env.GRID_QA_URL || "http://localhost:3000");
const ARTIFACT_DIR = arg("--artifact-dir", "");
const PORT = 9413;
const UDD = path.join(os.tmpdir(), "tsp-export-qa-udd-" + Date.now());
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
    showHiddenNombre: false, hashiraOdd: "作品名", hashiraEven: "章名", hashiraPosition: "top", headerFontSize: 8, nombreFontSize: 8,
    // TSP-LOOP-003 finalization: an explicit page-number font (not the body
    // face) so the export can prove the choice survives the clone.
    nombreFontFamily: "'Noto Sans JP', sans-serif" },
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
  "TCYはbare 2-digit auto detect。12月25日、を使用。",
  "Ruby＝｜漢字《かんじ》、漢字。",
  "- - - - - / _ . # (test) [A_B] path/to/file.md",
  "## Editorへ貼る本文 QA_SAMPLE-v2.0 #tag",
  "第一章　QA検証用サンプル mixed Japanese + Latin strings。",
  "これは通常の地の文です。ABC xyz 0123456789 を確認します。",
  "「これはテスト用の会話文です」と彼女は言った――そうですね。",
].join("\n");
// Dedicated regression fixture for the yakumono→―― adjacency (`。――`, `」――`).
// Short lines so each dash lands mid-column-1 where JPEG pixel measurement is
// clean (unlike the dense QA_PDF_FIXTURE). Line 1's dash (the first the geom
// probe finds) is preceded by 句点; line 2 is the kana→dash control.
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
    const t = setTimeout(() => { pend.delete(id); rej(new Error("CDP timeout: " + method)); }, 45000);
    pend.set(id, { res: (v) => { clearTimeout(t); res(v); }, rej: (e) => { clearTimeout(t); rej(e); } });
  });
}
let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };

async function main() {
  if (!BROWSER) { console.error("SKIP: no Chrome/Edge binary. Set GRID_QA_BROWSER."); process.exit(0); }
  try {
    const r = await fetch(`${BASE}/editor`, { method: "HEAD" });
    if (!r.ok && r.status !== 405) throw new Error("status " + r.status);
  } catch (e) { console.error(`SKIP: dev server not reachable at ${BASE} (${e.message}).`); process.exit(0); }

  const proc = spawn(BROWSER, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
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
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    ws.onmessage = async (ev) => {
      const raw = typeof ev.data === "string" ? ev.data : await ev.data.text();
      const m = JSON.parse(raw);
      if (m.id && pend.has(m.id)) { const { res, rej } = pend.get(m.id); pend.delete(m.id);
        if (m.error) rej(new Error(JSON.stringify(m.error))); else res(m.result); }
    };
    await cdp(ws, "Page.enable"); await cdp(ws, "Runtime.enable");
    await cdp(ws, "Page.navigate", { url: `${BASE}/editor` });
    const dbReady = await cdp(ws, "Runtime.evaluate", { expression: `(async()=>{for(let i=0;i<80;i++){const meta=(await indexedDB.databases()).find(d=>d.name==='tategaki-editor-db');if(meta){const stores=await new Promise(resolve=>{const o=indexedDB.open(meta.name);o.onsuccess=()=>{const d=o.result;const value=[...d.objectStoreNames];d.close();resolve(value)};o.onerror=()=>resolve([])});if(stores.includes('documents'))return {ok:true,version:meta.version,stores}}await new Promise(r=>setTimeout(r,100));}return {ok:false}})()`, awaitPromise: true, returnByValue: true });
    if (!dbReady.result.value?.ok) throw new Error("app IndexedDB schema did not initialize");
    const seed = `(async()=>{const rec={id:9933,title:'EXPORT-QA',content:${JSON.stringify(FIXTURE)},settings:${JSON.stringify(A5)},plotNote:'',updatedAt:Date.now(),isCollection:false,includedDocumentIds:[],isSample:false};const o=indexedDB.open('tategaki-editor-db');return await new Promise(res=>{o.onsuccess=()=>{const d=o.result;try{const t=d.transaction('documents','readwrite');t.objectStore('documents').put(rec);t.oncomplete=()=>res('ok');t.onerror=()=>res('tx');}catch(e){res('e '+e.message);}};o.onerror=()=>res('oe');});})()`;
    const sr = await cdp(ws, "Runtime.evaluate", { expression: seed, awaitPromise: true, returnByValue: true });
    if (sr.result.value !== "ok") throw new Error("seed failed: " + sr.result.value);
    await cdp(ws, "Page.navigate", { url: `${BASE}/editor?id=9933` }); await sleep(9000);

    // hook the SVG data-URL html-to-image feeds to its <img>
    await cdp(ws, "Runtime.evaluate", { expression: `
      window.__svg = null;
      window.__jpg = null;
      const dsc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        set(v){ if (typeof v === 'string' && v.startsWith('data:image/svg')) window.__svg = v; return dsc.set.call(this, v); },
        get(){ return dsc.get.call(this); },
      });
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
        const value = originalToDataURL.call(this, type, quality);
        if (type === 'image/jpeg') window.__jpg = value;
        return value;
      };
      // live computed font-size of the body-text lines
      window.__liveFS = [...document.querySelectorAll('.tategaki-line')].map((l) => getComputedStyle(l).fontSize);
      const R = (el) => { const r = el.getBoundingClientRect(); return { x:r.x, y:r.y, w:r.width, h:r.height }; };
      const card = document.querySelector('.page-card, [class*="page-card"]');
      const trim = card?.querySelector('[data-bleed-guide="true"]');
      const slots = [...(card?.querySelectorAll('.tategaki-line > span') || [])];
      // TSP-LOOP-003 cross-font: the ―― run is ONE native vertical-rl run with
      // a single [data-protected-run-glyph] text span. JPG joint continuity is
      // measured from the run rect's luminance profile, not from 2 glyph rects.
      const dashWrapper = slots.find((slot) => slot.matches('[data-protected-run-wrapper="dash"]'));
      const dashGlyphs = dashWrapper ? [...dashWrapper.querySelectorAll(':scope > [data-protected-run-glyph]')] : [];
      const wrapperRect = dashWrapper ? R(dashWrapper) : null;
      // Geometry neighbours must belong to the wrapper's own logical line.
      // Searching every page slot can select an unrelated column with the same
      // Y coordinate in dense mixed-script fixtures.
      const peers = dashWrapper ? [...dashWrapper.parentElement.children].filter((slot) => slot !== dashWrapper && !slot.dataset.protectedRunWrapper) : [];
      const prev = wrapperRect && peers.find((slot) => Math.abs((R(slot).y + R(slot).h) - wrapperRect.y) <= 1);
      const next = wrapperRect && peers.find((slot) => Math.abs(R(slot).y - (wrapperRect.y + wrapperRect.h)) <= 1);
      window.__jpgGeom = card && trim && dashWrapper && dashGlyphs.length === 1 && prev && next ? {
        trim: R(trim), wrapper: wrapperRect, dashGlyph: R(dashGlyphs[0]),
        slotCount: Number(dashWrapper.dataset.runSlotCount), prev: R(prev), next: R(next),
        prevText: prev.textContent || '', nextText: next.textContent || '',
        body: slots.filter((slot) => /^[\\u3040-\\u30ff\\u3400-\\u9fff]$/.test(slot.textContent || '')).map((slot) => ({ t:slot.textContent, r:R(slot) })),
      } : null;
      'hooked'`, returnByValue: true });

    let previewShot = null;
    if (ARTIFACT_DIR) {
      const cardRect = (await cdp(ws, "Runtime.evaluate", { expression: `(() => { const e=document.querySelector('.page-card, [class*="page-card"]'); if(!e)return null; const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,scale:4}; })()`, returnByValue: true })).result.value;
      if (cardRect) previewShot = await cdp(ws, "Page.captureScreenshot", { format: "png", clip: cardRect });
    }

    // select page 1, open 書き出し, click JPG
    await cdp(ws, "Runtime.evaluate", { expression: `
      (() => { const cb = [...document.querySelectorAll('input[type=checkbox]')].find((x) => x.closest('[class*=page]') && !x.closest('header'));
        if (cb) cb.click(); else { const z = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '全選択'); if (z) z.click(); } })()`, returnByValue: true });
    await sleep(500);
    await cdp(ws, "Runtime.evaluate", { expression: `[...document.querySelectorAll('button')].find((b) => b.textContent.includes('書き出し'))?.click()`, returnByValue: true });
    await sleep(700);
    const jc = await cdp(ws, "Runtime.evaluate", { expression: `
      (() => { const j = [...document.querySelectorAll('button,[role=menuitem],a')].find((b) => b.textContent.trim() === 'JPG');
        if (j) { j.click(); return 'clicked'; } return 'JPG item not found'; })()`, returnByValue: true });
    if (jc.result.value !== "clicked") throw new Error("could not trigger JPG export: " + jc.result.value);

    let svg = "";
    for (let i = 0; i < 45 && !svg; i++) {
      await sleep(1000);
      svg = (await cdp(ws, "Runtime.evaluate", { expression: `(() => { if (!window.__svg) return ''; const c = window.__svg.indexOf(','); return decodeURIComponent(window.__svg.slice(c + 1)); })()`, returnByValue: true })).result.value;
    }
    const liveFS = (await cdp(ws, "Runtime.evaluate", { expression: `JSON.stringify(window.__liveFS || [])`, returnByValue: true })).result.value;
    const jpgDataUrl = (await cdp(ws, "Runtime.evaluate", { expression: `window.__jpg || ''`, returnByValue: true })).result.value;
    const jpgGeomJson = (await cdp(ws, "Runtime.evaluate", { expression: `JSON.stringify(window.__jpgGeom)`, returnByValue: true })).result.value;
    ws.close(); proc.kill();

    if (!svg) throw new Error("html-to-image SVG clone was never produced (export did not run?)");
    const live = JSON.parse(liveFS).map((s) => parseFloat(s)).filter((n) => n > 0);
    const clonedFS = [...svg.matchAll(/class="tategaki-line"[^>]*?font-size:\s*([0-9.]+)px/g)].map((m) => parseFloat(m[1]));
    // fall back: any font-size on a tategaki-line-ish node
    const anyFS = [...svg.matchAll(/font-size:\s*([0-9.]+)px/g)].map((m) => parseFloat(m[1]));

    console.log(`live .tategaki-line font-size(s): ${live.join(", ")}`);
    console.log(`cloned .tategaki-line font-size(s): ${(clonedFS.length ? clonedFS : "(none matched; all cloned font-sizes: " + [...new Set(anyFS)].join(", ") + ")")}`);

    const liveMax = Math.max(...live);
    const mangled = Math.floor(liveMax) - 0.1; // what the bug would produce
    const clonedForBody = (clonedFS.length ? clonedFS : anyFS).filter((v) => Math.abs(v - liveMax) < 1.5 || Math.abs(v - mangled) < 1.5);

    check("html-to-image clone produced a body-text font-size", clonedForBody.length > 0);
    check("cloned body font-size matches the live computed value (not Math.floor-0.1)",
      clonedForBody.some((v) => Math.abs(v - liveMax) <= 0.15),
      `live=${liveMax}  cloned≈${clonedForBody.join("/")}  (bug value would be ${mangled})`);
    check("cloned body font-size is NOT the shrunk floor-0.1 value",
      !clonedForBody.some((v) => Math.abs(v - mangled) <= 0.02 && Math.abs(v - liveMax) > 0.15),
      `mangle target = ${mangled}px`);

    // TSP-LOOP-003 cross-font: ―― / …… are ONE native writing-mode:vertical-rl
    // run each. The html-to-image computed-style clone must keep that wrapper a
    // native vertical run (writing-mode / text-orientation / reset font
    // features) with its 2-slot reservation — otherwise the export falls back
    // to the broken per-face joint. It must carry NO per-glyph nudge markup.
    const protectedTags = [...svg.matchAll(/<span[^>]*data-protected-run-wrapper="(dash|ellipsis)"[^>]*>/g)];
    const protectedKinds = protectedTags.map((m) => m[1]);
    const protectedMarkup = protectedTags.map((m) => m[0].replace(/&quot;/g, '"'));
    const expectsEllipsis = FIXTURE.includes("…") || FIXTURE.includes("‥");
    check("protected-run wrapper survives the export clone as one native vertical-rl run",
      protectedKinds.includes("dash") && (!expectsEllipsis || protectedKinds.includes("ellipsis")) &&
      protectedMarkup.every((tag) =>
        /writing-mode:\s*vertical-rl/.test(tag) &&
        // TSP-LOOP-021 §1: text-orientation: mixed so the font's vertical glyphs
        // render on Apple WebKit (which disables `vert` under `upright` per
        // spec) — the export clone must carry the same value the preview uses.
        /text-orientation:\s*mixed/.test(tag) &&
        /font-feature-settings:\s*normal/.test(tag) &&
        !/margin-(?:top|bottom):\s*[^;]*[1-9]/.test(tag)) &&
      protectedMarkup.some((tag) => /data-protected-run-wrapper="dash"/.test(tag) && /data-run-slot-count="2"/.test(tag)),
      `kinds=${protectedKinds.join("/")} tag[0]=${(protectedMarkup[0] || "").slice(0, 240)}`);

    // TSP-LOOP-003 mixed-script run model: the sideways [data-latin-run]
    // wrappers must survive the html-to-image computed-style clone with their
    // writing-mode / text-orientation / 欧文 metrics intact (getCloneStyleProps
    // whitelists every property except font-size, so they should).
    // TSP-LOOP-003 finalization: the page-number font choice must survive the
    // html-to-image computed-style clone (getCloneStyleProps whitelists every
    // property except font-size).
    {
      const nombreTags = [...svg.matchAll(/<div[^>]*data-nombre[^>]*>/g)].map((m) => m[0].replace(/&quot;/g, '"'));
      if (nombreTags[0]) console.log(`nombre clone tag[0]: ${nombreTags[0].slice(0, 400)}`);
      check("selected page-number font survives the export clone",
        nombreTags.length > 0 && nombreTags.every((tag) => /font(?:-family)?:[^;]*Noto Sans JP/.test(tag)),
        `nombre tags=${nombreTags.length}`);
    }

    const asciiRuns = (FIXTURE.replace(/【[^】]*】/g, "").match(/[\x20-\x7e]{2,}/g) || [])
      .map((s) => s.trim()).filter(Boolean);
    const expectsLatinRun = asciiRuns.some(
      (s) => [...s].length >= 2 && !/^\d{2}$/.test(s) && !/^[!?！？]{2}$/.test(s));
    if (expectsLatinRun) {
      const latinTags = [...svg.matchAll(/<span[^>]*data-latin-run[^>]*>/g)].map((m) => m[0].replace(/&quot;/g, '"'));
      if (latinTags[0]) console.log(`latin-run clone tag[0]: ${latinTags[0]}`);
      check("sideways Latin-run wrappers are preserved in the export clone",
        latinTags.length > 0 &&
        latinTags.every((tag) =>
          /writing-mode:\s*vertical-rl/.test(tag) &&
          /text-orientation:\s*mixed/.test(tag) &&
          /data-run-slot-count="\d+"/.test(tag)),
        `latin-run tags=${latinTags.length}`);
    }

    if (!jpgDataUrl || !jpgGeomJson) throw new Error("final JPG pixels or geometry were not captured");
    const jpgBuffer = Buffer.from(jpgDataUrl.slice(jpgDataUrl.indexOf(",") + 1), "base64");
    if (ARTIFACT_DIR) {
      fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
      if (previewShot?.data) fs.writeFileSync(path.join(ARTIFACT_DIR, "body-typography-preview.png"), Buffer.from(previewShot.data, "base64"));
      fs.writeFileSync(path.join(ARTIFACT_DIR, "body-typography-export.jpg"), jpgBuffer);
    }
    const { data: jpg, info } = await sharp(jpgBuffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const geom = JSON.parse(jpgGeomJson);
    const mapRect = (r) => ({
      x: (r.x - geom.trim.x) / geom.trim.w * info.width,
      y: (r.y - geom.trim.y) / geom.trim.h * info.height,
      w: r.w / geom.trim.w * info.width,
      h: r.h / geom.trim.h * info.height,
    });
    const lum = (x, y) => {
      x = Math.max(0, Math.min(info.width - 1, x)); y = Math.max(0, Math.min(info.height - 1, y));
      const i = (y * info.width + x) * info.channels;
      return 0.299 * jpg[i] + 0.587 * jpg[i + 1] + 0.114 * jpg[i + 2];
    };
    const inkBoundsT = (r, thr) => {
      const x0 = Math.floor(r.x), y0 = Math.floor(r.y), x1 = Math.ceil(r.x + r.w), y1 = Math.ceil(r.y + r.h);
      let mnX=1e9,mxX=-1e9,mnY=1e9,mxY=-1e9,n=0;
      for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++) if(lum(x,y)<thr){n++;mnX=Math.min(mnX,x);mxX=Math.max(mxX,x);mnY=Math.min(mnY,y);mxY=Math.max(mxY,y);}
      return n ? { left:mnX,right:mxX+1,top:mnY,bottom:mxY+1,cx:(mnX+mxX+1)/2,cy:(mnY+mxY+1)/2 } : null;
    };
    // JPEG antialiasing makes the quarter-pixel dash lighter than Preview;
    // 160 keeps that stroke while excluding the faintest compression halo.
    const inkBounds = (r) => inkBoundsT(r, 160);
    const prevRect = mapRect(geom.prev), nextRect = mapRect(geom.next);
    const dashRun = mapRect(geom.wrapper);       // the whole ―― run in JPG px
    // A 句点 hanging in the top-right of its cell is a ~4px mark in the JPG —
    // near the compression-halo floor. Fall back to a softer threshold so its
    // ink still registers (used only for the boundary gap, not the ink model).
    const prevInk = inkBounds(prevRect) || inkBoundsT(prevRect, 205);
    const nextInk = inkBounds(nextRect) || inkBoundsT(nextRect, 205);
    // TSP-LOOP-003 cross-font: ―― is ONE inline run. Walk its luminance profile
    // straight down (per-row darkest pixel) — the seam between the em dashes
    // must not lighten (jointRatio → 1), and the ink must span the full run.
    const rx0 = Math.floor(dashRun.x), rx1 = Math.ceil(dashRun.x + dashRun.w);
    const ry0 = Math.floor(dashRun.y), ry1 = Math.ceil(dashRun.y + dashRun.h);
    const dashRowDark = [];
    for (let y = ry0; y < ry1; y++) { let mn = 255; for (let x = rx0; x < rx1; x++) { const v = lum(x, y); if (v < mn) mn = v; } dashRowDark.push(255 - mn); }
    const SOFT = 45;
    const dashInkRows = dashRowDark.filter((d) => d >= SOFT).sort((a, b) => a - b);
    const dashStrokeDark = dashInkRows.length ? dashInkRows[dashInkRows.length >> 1] : 0;
    const dashFirst = dashRowDark.findIndex((d) => d >= SOFT);
    const dashLast = dashRowDark.length - 1 - [...dashRowDark].reverse().findIndex((d) => d >= SOFT);
    const emJpg0 = (prevRect.h + nextRect.h) / 2;
    const jBand = Math.max(1, Math.round(0.12 * emJpg0));
    const jMid = Math.round((ry1 - ry0) / 2);
    let jMin = 510;
    for (let i = Math.max(dashFirst, jMid - jBand); i <= Math.min(dashLast, jMid + jBand); i++) jMin = Math.min(jMin, dashRowDark[i]);
    const jpgJointRatio = dashStrokeDark ? jMin / dashStrokeDark : 0;
    const dashInkTopY = ry0 + (dashFirst < 0 ? 0 : dashFirst);
    const dashInkBotY = ry0 + (dashLast < 0 ? ry1 - ry0 : dashLast + 1);
    const dashInkSpanEm = dashStrokeDark ? (dashInkBotY - dashInkTopY) / emJpg0 : 0;
    const jpgPrevGap = prevInk ? dashInkTopY - prevInk.bottom : null;
    const jpgNextGap = nextInk ? nextInk.top - dashInkBotY : null;
    const dashRunInk = inkBoundsT({ x: dashRun.x, y: dashRun.y, w: dashRun.w, h: dashRun.h }, 160);
    const bodyXOffsets = geom.body.map(({r}) => { const mr=mapRect(r), b=inkBounds(mr); return b ? b.cx-(mr.x+mr.w/2) : null; }).filter((v)=>v!=null);
    const bodyXMean = bodyXOffsets.reduce((a,b)=>a+b,0)/bodyXOffsets.length;
    const jpgCenterDeviation = dashRunInk ? (dashRunInk.cx - (dashRun.x + dashRun.w / 2)) - bodyXMean : 0;
    const jpgBodyGaps = [];
    for (let i=0;i<geom.body.length-1;i++) {
      const a=mapRect(geom.body[i].r), b=mapRect(geom.body[i+1].r);
      if (Math.abs(a.x-b.x)>2 || Math.abs((b.y-a.y)-a.h)>2) continue;
      const ai=inkBounds(a), bi=inkBounds(b); if (ai && bi) jpgBodyGaps.push(bi.top-ai.bottom);
    }
    const jpgBodyGapMean = jpgBodyGaps.reduce((a,b)=>a+b,0)/jpgBodyGaps.length;
    const jpgBodyGapMin = Math.min(...jpgBodyGaps), jpgBodyGapMax = Math.max(...jpgBodyGaps);
    // Median is robust to the column-edge / punctuation-adjacent outliers that
    // inflate a dense fixture's min/max — use it as the tight-gap yardstick so
    // the control assertions stay strict even on QA_PDF.
    const jpgBodyGapMed = [...jpgBodyGaps].sort((a,b)=>a-b)[jpgBodyGaps.length >> 1] ?? 0;
    const f2 = (v) => (v == null ? "n/a" : v.toFixed(2));
    console.log(`actual JPG dash pixels: startGap=${f2(jpgPrevGap)}px endGap=${f2(jpgNextGap)}px bodyGap med=${jpgBodyGapMed.toFixed(2)} mean=${jpgBodyGapMean.toFixed(2)} range=${jpgBodyGapMin.toFixed(2)}..${jpgBodyGapMax.toFixed(2)}px jointRatio=${jpgJointRatio.toFixed(3)} inkSpan=${dashInkSpanEm.toFixed(2)}em centerDeviation=${jpgCenterDeviation.toFixed(2)}px slots=${geom.slotCount} prev="${geom.prevText}" next="${geom.nextText}"`);

    // TSP-LOOP-003 — the dash JPG check is split into three independent
    // assertions so one loose tolerance can't cover a real regression:
    //   (1) internal wrapper integrity  — neighbour-independent
    //   (2) dash → following glyph      — always a normal tight body gap
    //   (3) dash ← preceding glyph      — branches on the glyph's class
    const emJpg = (mapRect(geom.prev).h + mapRect(geom.next).h) / 2;   // 1 canonical slot in JPG px
    const HANG_START_YAKU = /[、。，．」』）〉》】〕］｝｠”’]/u;   // hang against cell top -> leaves trailing aki below
    const prevIsHangYaku = HANG_START_YAKU.test((geom.prevText || "").slice(-1));
    const prevHangJpg = prevInk ? prevInk.cy - (prevRect.y + prevRect.h / 2) : null; // <0 = ink hangs high
    // Absolute (em-relative), NOT fixture-derived: a normal glyph→―― gap sits
    // ~0.15em; allow the median + 0.45em (≈0.6em ceiling) for JPEG scatter.
    const tightGapOK = (g) => g != null && g >= -emJpg * 0.25 && g <= jpgBodyGapMed + emJpg * 0.45;

    check("dash JPG: ―― exports as one continuous vertical rule (joint does not lighten), 2 slots, on-axis",
      geom.slotCount === 2 &&
      Math.abs((mapRect(geom.wrapper).y + mapRect(geom.wrapper).h) - nextRect.y) <= 1 &&
      dashStrokeDark > 0 && jpgJointRatio >= 0.80 &&
      dashInkSpanEm >= 1.75 &&
      Math.abs(jpgCenterDeviation) <= emJpg0 * 0.18,   // JPEG has more X scatter than Preview; the strict 0.12em axis check is verify-punct-optical's DOM measure
      `slots=${geom.slotCount} domBoundaryΔ=${((mapRect(geom.wrapper).y + mapRect(geom.wrapper).h) - nextRect.y).toFixed(2)} jointRatio=${jpgJointRatio.toFixed(3)} inkSpan=${dashInkSpanEm.toFixed(2)}em centerDev=${jpgCenterDeviation.toFixed(2)}px`);

    check("dash JPG end boundary: following glyph sits on the normal tight body gap",
      jpgNextGap != null && tightGapOK(jpgNextGap),
      `end=${f2(jpgNextGap)}px (${jpgNextGap == null ? "n/a" : (jpgNextGap / emJpg).toFixed(2) + "em"}) bodyMed=${jpgBodyGapMed.toFixed(2)}px ceiling=${(jpgBodyGapMed + emJpg * 0.45).toFixed(2)}px  nextText="${geom.nextText}"`);

    if (prevIsHangYaku) {
      // 句読点 / 閉じ括弧 hang against the cell top, so the empty lower half of
      // THEIR cell is the yakumono's own trailing aki before the dash — a
      // large-but-bounded gap. It must NOT collapse (the yakumono would have
      // stopped hanging) nor blow out past one slot (the old flex-centre bug
      // put it at ~2.4em).
      check("dash JPG start boundary (yakumono→――): bounded trailing aki, yakumono still hangs",
        jpgPrevGap != null && jpgPrevGap >= emJpg * 0.30 && jpgPrevGap <= emJpg * 1.15 &&
        prevHangJpg != null && prevHangJpg <= -emJpg * 0.10,
        `start=${f2(jpgPrevGap)}px (${jpgPrevGap == null ? "n/a" : (jpgPrevGap / emJpg).toFixed(2)}em, want 0.30..1.15em)  prevHang=${f2(prevHangJpg)}px (want <0)  prevText="${geom.prevText}"`);
    } else {
      check("dash JPG start boundary (normal glyph→――): normal tight body gap",
        tightGapOK(jpgPrevGap),
        `start=${f2(jpgPrevGap)}px (${jpgPrevGap == null ? "n/a" : (jpgPrevGap / emJpg).toFixed(2) + "em"}) bodyMed=${jpgBodyGapMed.toFixed(2)}px ceiling=${(jpgBodyGapMed + emJpg * 0.45).toFixed(2)}px  prevText="${geom.prevText}"`);
    }
  } finally {
    try { proc.kill(); } catch {}
    await sleep(1500);
    try { fs.rmSync(UDD, { recursive: true, force: true }); } catch {}
  }
  if (failures > 0) { console.error(`\n${failures} export-fidelity check(s) failed.`); process.exit(1); }
  console.log("\nAll export-fidelity checks passed.");
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
