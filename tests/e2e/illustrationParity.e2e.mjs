// TSP-PRINT-004 (P4-8): where the Preview and the PDF / JPG put 挿絵
// (天・中央・地 and 全面), and the Web閲覧用 footer, in millimetres.
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 TATESPUN_PARITY_OUT=dir \
//   [TATESPUN_E2E_LOCAL_WEBFONTS=1] [TATESPUN_PARITY_ONLY=name,name] \
//   node tests/e2e/illustrationParity.e2e.mjs
//
// Every scenario seeds one document whose pages carry only 挿絵 (and, on
// Web閲覧用, the footer and ノンブル), exports it, rasterizes the PDF at 600dpi
// (Web閲覧用: the JPG zip), and compares, per page:
//
// - each 天/中央/地 image's box in the Preview DOM (relative to the trim edge)
//   with the export's ink box around it;
// - for 全面, the white window inside the test image (where it lands on the
//   trim page tells both the scale and the crop of the cover);
// - for Web閲覧用, the footer rule / logo / text and the ノンブル, Preview
//   screenshot ink vs JPG ink (the Web paper has no bleed guide; the card
//   itself is the page).
//
// Writes `<out>/illustration.json` + `.md`. Exit 1 on any failure or an edge
// difference over LIMIT_MM.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import JSZip from "jszip";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";
import { sleep } from "./helpers/cdp.mjs";

const target = resolveE2eTarget(process.env, "illustration parity");
const OUT = process.env.TATESPUN_PARITY_OUT;
if (!OUT) {
  console.error("illustration parity: NOT RUN -- TATESPUN_PARITY_OUT is not set");
  process.exit(2);
}
if (spawnSync("pdftoppm", ["-v"]).error) {
  console.error("illustration parity: NOT RUN -- pdftoppm (poppler) is not installed");
  process.exit(2);
}
const ONLY = new Set((process.env.TATESPUN_PARITY_ONLY ?? "").split(",").filter(Boolean));
const LOCAL_WEBFONTS = process.env.TATESPUN_E2E_LOCAL_WEBFONTS === "1";
const PDF_DPI = 600;
const LIMIT_MM = 0.15;
// px papers: JPG px (2 per page px). Text is screenshot vs JPG, and the
// card's own sub-pixel position moves a screenshot by up to 2px.
const WEB_LIMIT_PX = 4;
mkdirSync(OUT, { recursive: true });

const FONT_FILES = { "Shippori Mincho": "ShipporiMincho-Regular.ttf" };
const IMAGE_ID = "qa-illustration";
// Test image 200×100 px: black, with a white window at x 50–110, y 30–80.
const IMAGE = { width: 200, height: 100, hole: { left: 50, right: 110, top: 30, bottom: 80 } };
const img = (w, h, position) => `【IMG:${IMAGE_ID}:${w}:${h}:${position}】`;
const pages = (...pageContents) => pageContents.join("\n【改ページ】\n");
const quietMaster = {
  nombrePosition: "hidden",
  hideNombreOnFirstPage: false,
  nombreStart: 1,
  nombreBottomMargin: 6,
  showHiddenNombre: false,
  hashiraOdd: "",
  hashiraEven: "",
  hashiraPosition: "top",
  headerFontSize: 9,
  nombreFontSize: 9,
  nombreFontFamily: "",
  nombreLayoutCustomized: true,
};
const PRINT_CONTENT = pages(
  img(50, 30, "top"),
  img(40, 60, "center"),
  img(60, 30, "bottom"),
  [img(30, 20, "top"), img(30, 20, "top"), img(30, 20, "top"), img(25, 15, "bottom"), img(25, 25, "bottom")].join(""),
  img(80, 40, "full"),
  img(300, 300, "center"),
  img(40, 60, "full")
);
const SCENARIOS = [
  { name: "bunko-images", settings: { paperSize: "文庫", fontFamily: "'Shippori Mincho', serif", masterPage: quietMaster }, content: PRINT_CONTENT },
  { name: "bunko-images-bleed", pdfMode: "bleed", settings: { paperSize: "文庫", fontFamily: "'Shippori Mincho', serif", masterPage: quietMaster }, content: PRINT_CONTENT },
  { name: "a5-two-columns", settings: { paperSize: "A5", columnCount: 2, fontFamily: "'Shippori Mincho', serif", masterPage: quietMaster }, content: pages(img(60, 80, "center"), img(90, 40, "top"), img(50, 50, "bottom")) },
  {
    name: "web-reading",
    web: true,
    settings: { paperSize: "Web閲覧用", fontFamily: "'Shippori Mincho', serif", marginTop: 40, marginBottom: 40, marginGutter: 20, marginOuter: 20, fontSizePt: 30, masterPage: { ...quietMaster, nombrePosition: "outer", nombreFontSize: 15, headerFontSize: 20, hashiraOdd: "Web 柱", hashiraEven: "Web 柱" } },
    content: pages(img(60, 40, "top"), img(50, 50, "center")),
  },
  {
    name: "web-reading-asymmetric",
    web: true,
    settings: { paperSize: "Web閲覧用", fontFamily: "'Shippori Mincho', serif", marginTop: 40, marginBottom: 40, marginGutter: 40, marginOuter: 20, fontSizePt: 30, masterPage: { ...quietMaster, nombrePosition: "outer", nombreFontSize: 15, headerFontSize: 20 } },
    content: pages(img(60, 40, "top"), img(50, 50, "center")),
  },
  {
    name: "sns-4x5",
    web: true,
    settings: { paperSize: "SNS用 4:5", fontFamily: "'Shippori Mincho', serif", marginTop: 60, marginBottom: 70, marginGutter: 60, marginOuter: 60, fontSizePt: 36, snsId: "tatespun_qa", masterPage: { ...quietMaster, nombrePosition: "center", nombreFontSize: 15, headerFontSize: 20, hashiraOdd: "SNS 柱", hashiraEven: "SNS 柱" } },
    content: pages(img(80, 60, "center"), img(70, 40, "bottom")),
  },
];

const session = await launchEditorSession("tatespun-illustration-parity-");
const { cdp, downloads } = session;
if (LOCAL_WEBFONTS) {
  const css = Object.entries(FONT_FILES)
    .map(([family, file]) => `@font-face{font-family:'${family}';font-weight:400 700;font-display:block;src:url('${target.url(`/fonts/${file}`)}') format('truetype');}`)
    .join("\n");
  await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*fonts.googleapis.com*" }, { urlPattern: "*fonts.gstatic.com*" }] });
  cdp.on("Fetch.requestPaused", (event) => {
    const isCss = event.request.url.includes("fonts.googleapis.com");
    cdp.send("Fetch.fulfillRequest", {
      requestId: event.requestId,
      responseCode: isCss ? 200 : 404,
      responseHeaders: [{ name: "Content-Type", value: "text/css" }, { name: "Access-Control-Allow-Origin", value: "*" }],
      body: Buffer.from(isCss ? css : "").toString("base64"),
    }).catch(() => {});
  });
}

async function click(selector) {
  const ok = await cdp.evaluate(`(() => { const b = document.querySelector(${JSON.stringify(selector)}); if (!b || b.disabled) return false; b.click(); return true; })()`);
  assert.equal(ok, true, `could not click ${selector}`);
}
async function waitDownload(before, label) {
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    const done = downloads.slice(before).find((d) => d.state === "completed");
    if (done) return done;
    await cdp.evaluate(`document.querySelector('[data-pdf-odd-page-warning-action="continue"]')?.click(), true`);
    await sleep(300);
  }
  throw new Error(`${label}: no completed download`);
}
async function exportPdf(mode) {
  await click('[data-demo-target="export"]');
  await cdp.waitFor(`!!document.querySelector('[data-export-menu-entry="pdf"]')`, { label: "export menu" });
  const before = downloads.length;
  await click('[data-export-menu-entry="pdf"]');
  await cdp.waitFor(`!!document.querySelector('[data-pdf-export-setup-modal]')`, { label: "PDF setup" });
  if (mode) {
    await cdp.evaluate(`(() => { const o = document.querySelector('[data-pdf-mode-option="${mode}"]'); const input = o?.querySelector('input') ?? o; input?.click(); return !!o; })()`);
    await sleep(300);
  }
  await cdp.evaluate(`document.querySelector('[data-pdf-export-blocked-reason="preflight"] button')?.click(), true`);
  const labels = JSON.stringify(["ダウンロード", "確認してこのまま書き出す"]);
  await cdp.waitFor(`[...document.querySelectorAll('[data-pdf-export-setup-modal] button')].some((b) => !b.disabled && ${labels}.includes(b.textContent.trim()))`, { label: "PDF download enabled" });
  await cdp.evaluate(`[...document.querySelectorAll('[data-pdf-export-setup-modal] button')].find((b) => !b.disabled && ${labels}.includes(b.textContent.trim())).click(), true`);
  return waitDownload(before, "PDF");
}
async function exportJpgZip() {
  await click('[data-demo-target="export"]');
  await cdp.waitFor(`!!document.querySelector('[data-export-menu-entry="jpg-zip"]')`, { label: "export menu" });
  const before = downloads.length;
  await click('[data-export-menu-entry="jpg-zip"]');
  return waitDownload(before, "JPG zip");
}

async function gray(file) {
  return sharp(file).flatten({ background: "#ffffff" }).grayscale().raw().toBuffer({ resolveWithObject: true });
}
/** Box (mm) of pixels matching `test` inside `area` (mm), on an image with `pxPerMm` and origin. */
function boxOf({ data, info }, pxPerMm, originX, originY, area, test) {
  const x0 = Math.max(0, Math.round(originX + area.left * pxPerMm));
  const x1 = Math.min(info.width, Math.round(originX + area.right * pxPerMm));
  const y0 = Math.max(0, Math.round(originY + area.top * pxPerMm));
  const y1 = Math.min(info.height, Math.round(originY + area.bottom * pxPerMm));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (test(data[y * info.width + x])) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (minX === Infinity) return null;
  return { left: (minX - originX) / pxPerMm, right: (maxX + 1 - originX) / pxPerMm, top: (minY - originY) / pxPerMm, bottom: (maxY + 1 - originY) / pxPerMm };
}
const INK = (v) => v < 128;
const PAPER = (v) => v >= 128;
const grow = (box, mm) => ({ left: box.left - mm, right: box.right + mm, top: box.top - mm, bottom: box.bottom + mm });
const edges = (a, b) => Object.fromEntries(["left", "right", "top", "bottom"].map((k) => [k, Number((a[k] - b[k]).toFixed(3))]));

const results = [];
const failures = [];
let worst = 0;
const fail = (message) => {
  failures.push(message);
  console.log(`FAIL ${message}`);
};

try {
  await session.setViewport(1440, 1000);
  await cdp.send("Page.navigate", { url: target.url("/editor") });
  await cdp.waitFor(`/[?&]id=\\d+/.test(location.search) && !!document.querySelector('[data-editor-save-status="saved"]')`, { timeoutMs: 120_000, label: "bootstrap editor" });
  let docId = 782000;
  for (const scenario of SCENARIOS) {
    docId++;
    if (ONLY.size && !ONLY.has(scenario.name)) continue;
    const dir = join(OUT, scenario.name);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 2, mobile: false });
    await cdp.evaluate(`new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      canvas.width = ${IMAGE.width}; canvas.height = ${IMAGE.height};
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, ${IMAGE.width}, ${IMAGE.height});
      ctx.fillStyle = "#fff"; ctx.fillRect(${IMAGE.hole.left}, ${IMAGE.hole.top}, ${IMAGE.hole.right - IMAGE.hole.left}, ${IMAGE.hole.bottom - IMAGE.hole.top});
      const dataUrl = canvas.toDataURL("image/png");
      const open = indexedDB.open("tategaki-editor-db");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction(["documents", "images"], "readwrite");
        tx.objectStore("documents").put({ id: ${docId}, title: ${JSON.stringify(scenario.name)}, content: ${JSON.stringify(scenario.content)}, plotNote: "", updatedAt: Date.now(), settings: ${JSON.stringify(scenario.settings)} });
        tx.objectStore("images").put({ id: ${JSON.stringify(IMAGE_ID)}, dataUrl, createdAt: 1 });
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onerror = () => reject(tx.error);
      };
    })`);
    await cdp.send("Page.navigate", { url: target.url(`/editor?id=${docId}`) });
    await cdp.waitFor(`!!document.querySelector('[data-editor-save-status="saved"]') && Number(document.querySelector('[data-preview-total-pages]')?.getAttribute('data-preview-total-pages') ?? 0) > 0`, { timeoutMs: 300_000, label: `${scenario.name}: Preview` });
    await cdp.evaluate(`document.fonts.ready.then(() => true)`);
    await sleep(4000);
    await cdp.evaluate(`(document.activeElement?.blur?.(), true)`);
    const totalPages = await cdp.evaluate(`Number(document.querySelector('[data-preview-total-pages]').getAttribute('data-preview-total-pages'))`);

    // Export first: the Preview pages are read afterwards, one by one.
    let exportFiles;
    let exportPxPerMm;
    // Bleed mode: the sheet is the trim page plus 3mm on every side.
    const trimOriginMm = scenario.pdfMode === "bleed" ? 3 : 0;
    let o = 0;
    if (scenario.web) {
      const zipDownload = await exportJpgZip();
      const zip = await JSZip.loadAsync(readFileSync(zipDownload.filePath));
      const names = Object.keys(zip.files).filter((n) => /\.jpe?g$/i.test(n)).sort();
      exportFiles = [];
      for (const [index, name] of names.entries()) {
        const file = join(dir, `jpg-${index + 1}.jpg`);
        writeFileSync(file, await zip.files[name].async("nodebuffer"));
        exportFiles.push(file);
      }
    } else {
      const pdfDownload = await exportPdf(scenario.pdfMode);
      const pdfFile = join(dir, "export.pdf");
      writeFileSync(pdfFile, readFileSync(pdfDownload.filePath));
      const raster = spawnSync("pdftoppm", ["-r", String(PDF_DPI), "-png", pdfFile, join(dir, "pdf")]);
      assert.equal(raster.status, 0, `pdftoppm failed: ${raster.stderr}`);
      exportFiles = readdirSync(dir).filter((f) => /^pdf-\d+\.png$/.test(f)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0])).map((f) => join(dir, f));
      exportPxPerMm = PDF_DPI / 25.4;
      o = trimOriginMm * exportPxPerMm;
    }
    if (exportFiles.length !== totalPages) fail(`${scenario.name}: Preview has ${totalPages} pages, the export ${exportFiles.length}`);

    for (let page = 1; page <= totalPages; page++) {
      const card = `document.querySelector('[data-preview-physical-page="${page}"] [data-page-card=true]')`;
      await cdp.evaluate(`(${card}.scrollIntoView({ block: "center", inline: "center" }), true)`);
      await cdp.waitFor(`[...${card}.querySelectorAll('img')].every((i) => i.complete)`, { timeoutMs: 15000, label: "images loaded" }).catch(() => {});
      await sleep(700);
      const exportFile = exportFiles[page - 1];
      if (!exportFile) continue;
      const exportImage = await gray(exportFile);

      if (scenario.web) {
        // px papers: element boxes from the Preview DOM (scaled to JPG px)
        // against the JPG's ink around each of them.
        const boxes = await cdp.evaluate(`(() => {
          const card = ${card};
          const c = card.getBoundingClientRect();
          const s = ${exportImage.info.width} / c.width;
          const rel = (r) => ({ left: (r.left - c.left) * s, right: (r.right - c.left) * s, top: (r.top - c.top) * s, bottom: (r.bottom - c.top) * s });
          const inkRange = (el) => { const range = document.createRange(); range.selectNodeContents(el); return range.getBoundingClientRect(); };
          const out = [];
          for (const i of card.querySelectorAll('img')) if (!i.hasAttribute('data-logo-img')) out.push({ kind: 'image', box: rel(i.getBoundingClientRect()) });
          const nombre = card.querySelector('[data-nombre]');
          if (nombre) out.push({ kind: 'nombre', text: nombre.textContent, box: rel(nombre.tagName === 'svg' ? nombre.querySelector('g').getBoundingClientRect() : inkRange(nombre)) });
          const hashira = card.querySelector('[data-hashira]');
          if (hashira) out.push({ kind: 'hashira', text: hashira.textContent, box: rel(hashira.tagName === 'svg' ? hashira.querySelector('g').getBoundingClientRect() : inkRange(hashira)) });
          const footer = card.querySelector('[data-web-footer], [data-sns-credit]');
          if (footer) {
            const rule = footer.matches('[data-web-footer]') ? footer.firstElementChild : footer;
            const rr = rule.getBoundingClientRect();
            out.push({ kind: 'footer-rule', box: rel({ left: rr.left + 80, right: rr.right - 80, top: rr.top, bottom: rr.top + 1 }) });
            const logo = footer.querySelector('img');
            if (logo) out.push({ kind: 'footer-logo', box: rel(logo.getBoundingClientRect()) });
            const spans = [...footer.querySelectorAll('span')];
            if (spans.length) out.push({ kind: 'footer-text', text: spans.map((x) => x.textContent).join(' '), box: rel(spans.map(inkRange).reduce((a, b) => ({ left: Math.min(a.left, b.left), right: Math.max(a.right, b.right), top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom) }))) });
          }
          return out;
        })()`);
        // Screenshot at JPG px (DPR 2): text is compared ink to ink, since a
        // DOM text box is the line box, not the glyphs.
        const r = await cdp.evaluate(`(() => { const r = ${card}.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
        const { data } = await cdp.send("Page.captureScreenshot", { format: "png", clip: { ...r, scale: exportImage.info.width / r.width / 2 } });
        const previewFile = join(dir, `preview-${page}.png`);
        writeFileSync(previewFile, Buffer.from(data, "base64"));
        const preview = await gray(previewFile);
        const tones = { "footer-rule": (v) => v < 235, image: INK, nombre: (v) => v < 160, hashira: (v) => v < 160, "footer-logo": (v) => v < 160, "footer-text": (v) => v < 215 };
        for (const item of boxes) {
          // Text: the same window on both images (the DOM line box plus a
          // margin), so a neighbour is never picked up on one side only.
          const window = item.kind === "footer-rule" ? { left: item.box.left, right: item.box.right, top: item.box.top - 12, bottom: item.box.bottom + 12 } : item.kind === "image" ? grow(item.box, 12) : { ...grow(item.box, 6), top: item.box.top };
          const a = item.kind === "image" ? item.box : boxOf(preview, 1, 0, 0, window, tones[item.kind]);
          const b = boxOf(exportImage, 1, 0, 0, window, tones[item.kind]);
          if (!a || !b) {
            fail(`${scenario.name} p${page} ${item.kind}: ${a ? "no JPG ink where the Preview draws it" : "no Preview ink"}`);
            results.push({ scenario: scenario.name, page, kind: item.kind, unit: "px", preview: a ?? item.box, export: b });
            continue;
          }
          const delta = edges(a, b);
          const off = Math.max(...Object.values(delta).map(Math.abs));
          if (off > WEB_LIMIT_PX) fail(`${scenario.name} p${page} ${item.kind}: Preview − JPG ${JSON.stringify(delta)} px`);
          results.push({ scenario: scenario.name, page, kind: item.kind, unit: "px", delta, preview: a, export: b });
        }
        continue;
      }

      // Print paper: DOM geometry relative to the bleed guide (the trim edge).
      const paperWidthMm = exportImage.info.width / exportPxPerMm - trimOriginMm * 2;
      const items = await cdp.evaluate(`(() => {
        const card = ${card};
        const guide = card.querySelector('[data-bleed-guide]').getBoundingClientRect();
        const pxPerMm = guide.width / ${paperWidthMm};
        const rel = (r) => ({ left: (r.left - guide.left) / pxPerMm, right: (r.right - guide.left) / pxPerMm, top: (r.top - guide.top) / pxPerMm, bottom: (r.bottom - guide.top) / pxPerMm });
        return [...card.querySelectorAll('img')].filter((i) => !i.hasAttribute('data-logo-img')).map((i) => {
          const box = rel(i.getBoundingClientRect());
          const fit = i.hasAttribute('data-full-page-image') ? 'box' : getComputedStyle(i).objectFit;
          return { box, fit, naturalWidth: i.naturalWidth, naturalHeight: i.naturalHeight };
        });
      })()`);
      if (items.length === 0) fail(`${scenario.name} p${page}: no image in the Preview`);
      for (const item of items) {
        if (item.fit === "cover" || item.fit === "box") {
          // 全面: where the image's white window lands — from object-fit:
          // cover (LEGACY) or the image's own box (V2, drawn stretched to it).
          const box = item.box;
          const fill = item.fit === "box";
          const s = Math.max((box.right - box.left) / item.naturalWidth, (box.bottom - box.top) / item.naturalHeight);
          const sx = fill ? (box.right - box.left) / item.naturalWidth : s;
          const sy = fill ? (box.bottom - box.top) / item.naturalHeight : s;
          const drawnLeft = (box.left + box.right) / 2 - (item.naturalWidth * sx) / 2;
          const drawnTop = (box.top + box.bottom) / 2 - (item.naturalHeight * sy) / 2;
          // Only the part on the trim page can be compared.
          const hole = {
            left: Math.max(0, drawnLeft + IMAGE.hole.left * sx),
            right: Math.min(paperWidthMm, drawnLeft + IMAGE.hole.right * sx),
            top: Math.max(0, drawnTop + IMAGE.hole.top * sy),
            bottom: drawnTop + IMAGE.hole.bottom * sy,
          };
          const holeWindow = grow(hole, 1.5);
          holeWindow.left = Math.max(0, holeWindow.left);
          holeWindow.top = Math.max(0, holeWindow.top);
          const pdfHole = boxOf(exportImage, exportPxPerMm, o, o, holeWindow, PAPER);
          if (!pdfHole) {
            fail(`${scenario.name} p${page} full: no white window in the PDF near the Preview's`);
            continue;
          }
          const delta = edges(hole, pdfHole);
          worst = Math.max(worst, ...Object.values(delta).map(Math.abs));
          results.push({ scenario: scenario.name, page, kind: "full", delta, preview: hole, export: pdfHole });
          continue;
        }
        const pdf = boxOf(exportImage, exportPxPerMm, o, o, grow(item.box, 2), INK);
        if (!pdf) {
          fail(`${scenario.name} p${page} image: no PDF ink where the Preview draws it`);
          continue;
        }
        const delta = edges(item.box, pdf);
        worst = Math.max(worst, ...Object.values(delta).map(Math.abs));
        results.push({ scenario: scenario.name, page, kind: "image", delta, preview: item.box, export: pdf });
      }
    }
    console.log(`${scenario.name}: done`);
  }
} finally {
  await session.close?.();
}

const fmt = (b) => (b ? `${b.left.toFixed(2)},${b.top.toFixed(2)}–${b.right.toFixed(2)},${b.bottom.toFixed(2)}` : "–");
const rows = results.map((r) =>
  r.delta
    ? `| ${r.scenario} | ${r.page} | ${r.kind} | ${r.unit ?? "mm"} | ${r.delta.top} | ${r.delta.bottom} | ${r.delta.left} | ${r.delta.right} | ${fmt(r.preview)} | ${fmt(r.export)} |`
    : `| ${r.scenario} | ${r.page} | ${r.kind} | | | | | | ${fmt(r.preview)} | ${fmt(r.export)} |`
);
const md = [
  "Preview box minus export ink box (print: mm on the trim page, PDF at 600dpi; Web閲覧用: JPG px).",
  "",
  "| scenario | page | kind | unit | top | bottom | left | right | Preview | export |",
  "|---|---|---|---|---|---|---|---|---|---|",
  ...rows,
  "",
  `worst print edge difference: ${worst.toFixed(3)}mm`,
  "",
  failures.length ? ["failures:", ...failures.map((f) => `- ${f}`)].join("\n") : "failures: none",
].join("\n");
writeFileSync(join(OUT, "illustration.json"), JSON.stringify({ results, failures }, null, 2));
writeFileSync(join(OUT, "illustration.md"), md + "\n");
console.log(md);
process.exit(worst > LIMIT_MM || failures.length > 0 ? 1 : 0);
