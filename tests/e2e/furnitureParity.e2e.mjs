// TSP-PRINT-003 (P4-7): where the Preview and the PDF put ノンブル / 柱 /
// 隠しノンブル, in millimetres.
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 TATESPUN_PARITY_OUT=dir \
//   [TATESPUN_E2E_LOCAL_WEBFONTS=1] node tests/e2e/furnitureParity.e2e.mjs
//
// For each scenario it seeds one document with a running head, a folio and
// the 隠しノンブル, photographs the first Preview page cards at a high scale,
// exports the PDF and rasterizes it at 600dpi. In each furniture area (the
// top and bottom margin bands, and the ノド edge strip) it finds the ink's
// bounding box on both, and writes `<out>/furniture.json` + `.md` with the
// difference of each edge (Preview − PDF, mm; + = Preview is lower / more
// to the right). Exit 1 when an edge differs by more than 0.15mm.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";
import { sleep } from "./helpers/cdp.mjs";

const target = resolveE2eTarget(process.env, "furniture parity");
const OUT = process.env.TATESPUN_PARITY_OUT;
if (!OUT) {
  console.error("furniture parity: NOT RUN -- TATESPUN_PARITY_OUT is not set");
  process.exit(2);
}
if (spawnSync("pdftoppm", ["-v"]).error) {
  console.error("furniture parity: NOT RUN -- pdftoppm (poppler) is not installed");
  process.exit(2);
}
const LOCAL_WEBFONTS = process.env.TATESPUN_E2E_LOCAL_WEBFONTS === "1";
const PDF_DPI = 600;
const LIMIT_MM = 0.15;
mkdirSync(OUT, { recursive: true });

const FONT_FILES = {
  "Shippori Mincho": "ShipporiMincho-Regular.ttf",
  "Noto Sans JP": "NotoSansJP-Regular.ttf",
  "Zen Old Mincho": "ZenOldMincho-Regular.ttf",
};
const BODY = Array.from({ length: 40 }, () => "　春の宵、窓辺に置いた硝子の瓶が淡い光を返していた。彼女は古い手紙を読み返した。").join("\n");
const masterPage = (overrides) => ({
  nombrePosition: "outer",
  hideNombreOnFirstPage: false,
  nombreStart: 1,
  nombreBottomMargin: 6,
  showHiddenNombre: true,
  hashiraOdd: "組版の比較 Proof",
  hashiraEven: "第一章 ノンブル",
  hashiraPosition: "top",
  headerFontSize: 9,
  nombreFontSize: 9,
  nombreFontFamily: "",
  nombreLayoutCustomized: true,
  ...overrides,
});
const SCENARIOS = [
  { name: "bunko-shippori-outer-top", settings: { paperSize: "文庫", fontFamily: "'Shippori Mincho', serif", masterPage: masterPage({}) } },
  { name: "bunko-notoSans-center-bottom", settings: { paperSize: "文庫", fontFamily: "'Noto Sans JP', sans-serif", masterPage: masterPage({ nombrePosition: "center", hashiraPosition: "bottom", nombreBottomMargin: 3 }) } },
  { name: "a5-zenOld-small", settings: { paperSize: "A5", fontFamily: "'Zen Old Mincho', serif", masterPage: masterPage({ headerFontSize: 6, nombreFontSize: 6 }) } },
];

const session = await launchEditorSession("tatespun-furniture-parity-");
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
async function exportPdf() {
  await click('[data-demo-target="export"]');
  await cdp.waitFor(`!!document.querySelector('[data-export-menu-entry="pdf"]')`, { label: "export menu" });
  const before = downloads.length;
  await click('[data-export-menu-entry="pdf"]');
  await cdp.waitFor(`!!document.querySelector('[data-pdf-export-setup-modal]')`, { label: "PDF setup" });
  await cdp.evaluate(`document.querySelector('[data-pdf-export-blocked-reason="preflight"] button')?.click(), true`);
  const labels = JSON.stringify(["ダウンロード", "確認してこのまま書き出す"]);
  await cdp.waitFor(`[...document.querySelectorAll('[data-pdf-export-setup-modal] button')].some((b) => !b.disabled && ${labels}.includes(b.textContent.trim()))`, { label: "PDF download enabled" });
  await cdp.evaluate(`[...document.querySelectorAll('[data-pdf-export-setup-modal] button')].find((b) => !b.disabled && ${labels}.includes(b.textContent.trim())).click(), true`);
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    const done = downloads.slice(before).find((d) => d.state === "completed");
    if (done) return done;
    await cdp.evaluate(`document.querySelector('[data-pdf-odd-page-warning-action="continue"]')?.click(), true`);
    await sleep(300);
  }
  throw new Error("PDF: no completed download");
}

/**
 * The Preview card's trim box, found from its bleed guide (the dashed gray
 * line drawn on the trim edge): a screenshot clip of the card is off by a
 * few pixels, which is the size of what is measured here.
 */
async function trimFromGuide(file, paperWidthMm) {
  const { data, info } = await sharp(file).flatten({ background: "#ffffff" }).grayscale().raw().toBuffer({ resolveWithObject: true });
  const cols = new Array(info.width).fill(0);
  const rows = new Array(info.height).fill(0);
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const v = data[y * info.width + x];
      if (v > 140 && v < 185) {
        cols[x]++;
        rows[y]++;
      }
    }
  }
  const guideCols = cols.flatMap((c, x) => (c > info.height * 0.2 ? [x] : []));
  const guideRows = rows.flatMap((c, y) => (c > info.width * 0.2 ? [y] : []));
  assert.ok(guideCols.length >= 2 && guideRows.length >= 2, `${file}: no bleed guide found`);
  const pxPerMm = (guideCols[guideCols.length - 1] + 1 - guideCols[0]) / paperWidthMm;
  return { pxPerMm, originX: guideCols[0], originY: guideRows[0] };
}

/**
 * Ink bounding box (mm on the trim page) inside `area` (mm). `pxPerMm` and
 * the origin map the image onto the trim page.
 */
async function inkBox(file, pxPerMm, originX, originY, area) {
  const { data, info } = await sharp(file).flatten({ background: "#ffffff" }).grayscale().raw().toBuffer({ resolveWithObject: true });
  const x0 = Math.max(0, Math.round(originX + area.left * pxPerMm));
  const x1 = Math.min(info.width, Math.round(originX + area.right * pxPerMm));
  const y0 = Math.max(0, Math.round(originY + area.top * pxPerMm));
  const y1 = Math.min(info.height, Math.round(originY + area.bottom * pxPerMm));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (data[y * info.width + x] < 128) {
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

const results = [];
let worst = 0;
try {
  await session.setViewport(1440, 1000);
  await cdp.send("Page.navigate", { url: target.url("/editor") });
  await cdp.waitFor(`/[?&]id=\\d+/.test(location.search) && !!document.querySelector('[data-editor-save-status="saved"]')`, { timeoutMs: 120_000, label: "bootstrap editor" });
  let docId = 781000;
  for (const scenario of SCENARIOS) {
    docId++;
    const dir = join(OUT, scenario.name);
    mkdirSync(dir, { recursive: true });
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 2, mobile: false });
    await cdp.evaluate(`new Promise((resolve, reject) => {
      const open = indexedDB.open("tategaki-editor-db");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction(["documents"], "readwrite");
        tx.objectStore("documents").put({ id: ${docId}, title: ${JSON.stringify(scenario.name)}, content: ${JSON.stringify(BODY)}, plotNote: "", updatedAt: Date.now(), settings: ${JSON.stringify(scenario.settings)} });
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onerror = () => reject(tx.error);
      };
    })`);
    await cdp.send("Page.navigate", { url: target.url(`/editor?id=${docId}`) });
    await cdp.waitFor(`!!document.querySelector('[data-editor-save-status="saved"]') && Number(document.querySelector('[data-preview-total-pages]')?.getAttribute('data-preview-total-pages') ?? 0) > 0`, { timeoutMs: 300_000, label: `${scenario.name}: Preview` });
    await cdp.evaluate(`document.fonts.ready.then(() => true)`);
    await sleep(4000);
    await cdp.evaluate(`(document.activeElement?.blur?.(), true)`);

    const pdfDownload = await exportPdf();
    const pdfFile = join(dir, "export.pdf");
    writeFileSync(pdfFile, readFileSync(pdfDownload.filePath));
    const raster = spawnSync("pdftoppm", ["-r", String(PDF_DPI), "-f", "1", "-l", "2", "-png", pdfFile, join(dir, "pdf")]);
    assert.equal(raster.status, 0, `pdftoppm failed: ${raster.stderr}`);
    const pdfFiles = readdirSync(dir).filter((f) => /^pdf-\d+\.png$/.test(f)).sort().map((f) => join(dir, f));
    const pdfMeta = await sharp(pdfFiles[0]).metadata();
    const paper = { width: (pdfMeta.width / PDF_DPI) * 25.4, height: (pdfMeta.height / PDF_DPI) * 25.4 };

    for (const page of [1, 2]) {
      const card = `document.querySelector('[data-preview-physical-page="${page}"] [data-page-card=true]')`;
      await cdp.evaluate(`(${card}.scrollIntoView({ block: "center", inline: "center" }), true)`);
      await sleep(600);
      // The outlines replace browser text once the font file is read (a
      // build without outlines keeps browser text: wait a little, then go on).
      await cdp
        .waitFor(`(() => { const c = ${card}; return !c.querySelector('div[data-nombre], div[data-hashira]') && c.querySelectorAll('[data-furniture-outline]').length > 0; })()`, { timeoutMs: 8000, label: "furniture outlines" })
        .catch(() => console.log(`${scenario.name} p${page}: furniture is browser text`));
      await sleep(300);
      const r = await cdp.evaluate(`(() => { const r = ${card}.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
      const { data } = await cdp.send("Page.captureScreenshot", { format: "png", clip: { ...r, scale: 4 } });
      const previewFile = join(dir, `preview-${page}.png`);
      writeFileSync(previewFile, Buffer.from(data, "base64"));
      const trim = await trimFromGuide(previewFile, paper.width);
      // Furniture drawn as glyph outlines: the geometry's own box, relative
      // to the bleed guide (the trim edge), straight from the page — no
      // screenshot rounding.
      const outlineBoxes = await cdp.evaluate(`(() => {
        const card = ${card};
        const guide = card.querySelector('[data-bleed-guide]').getBoundingClientRect();
        const pxPerMm = guide.width / ${paper.width};
        return [...card.querySelectorAll('[data-furniture-outline] g')].map((g) => {
          const r = g.getBoundingClientRect();
          return { left: (r.left - guide.left) / pxPerMm, right: (r.right - guide.left) / pxPerMm, top: (r.top - guide.top) / pxPerMm, bottom: (r.bottom - guide.top) / pxPerMm };
        });
      })()`);
      const pdfPxPerMm = PDF_DPI / 25.4;
      const odd = page % 2 === 1;
      // Bands keep 6mm clear of each side (the 隠しノンブル and the bleed guide).
      const areas = {
        top: { left: 6, right: paper.width - 6, top: 0.6, bottom: 9 },
        bottom: { left: 6, right: paper.width - 6, top: paper.height - 9, bottom: paper.height - 0.6 },
        hidden: odd
          ? { left: paper.width - 4, right: paper.width - 0.6, top: 20, bottom: paper.height - 20 }
          : { left: 0.6, right: 4, top: 20, bottom: paper.height - 20 },
      };
      for (const [area, box] of Object.entries(areas)) {
        const p = await inkBox(previewFile, trim.pxPerMm, trim.originX, trim.originY, box);
        const d = await inkBox(pdfFiles[page - 1], pdfPxPerMm, 0, 0, box);
        const inArea = outlineBoxes.filter((b) => (b.left + b.right) / 2 > box.left && (b.left + b.right) / 2 < box.right && (b.top + b.bottom) / 2 > box.top && (b.top + b.bottom) / 2 < box.bottom);
        const outline = inArea.length
          ? { left: Math.min(...inArea.map((b) => b.left)), right: Math.max(...inArea.map((b) => b.right)), top: Math.min(...inArea.map((b) => b.top)), bottom: Math.max(...inArea.map((b) => b.bottom)) }
          : null;
        if (!p && !d) continue;
        if (!p || !d) {
          results.push({ scenario: scenario.name, page, area, preview: p, pdf: d });
          continue;
        }
        const diff = (a) => Object.fromEntries(["left", "right", "top", "bottom"].map((k) => [k, Number((a[k] - d[k]).toFixed(3))]));
        const delta = diff(p);
        const outlineDelta = outline ? diff(outline) : null;
        // Outlines are measured exactly; browser text only from the screenshot.
        worst = Math.max(worst, ...Object.values(outlineDelta ?? delta).map(Math.abs));
        results.push({ scenario: scenario.name, page, area, delta, outlineDelta, preview: p, outline, pdf: d });
      }
    }
    console.log(`${scenario.name}: done`);
  }
} finally {
  await session.close?.();
}

const rows = results.map((r) =>
  r.delta
    ? `| ${r.scenario} | ${r.page} | ${r.area} | ${r.delta.top} | ${r.delta.bottom} | ${r.delta.left} | ${r.delta.right} | ${r.outlineDelta ? [r.outlineDelta.top, r.outlineDelta.bottom, r.outlineDelta.left, r.outlineDelta.right].join(" / ") : "-"} |`
    : `| ${r.scenario} | ${r.page} | ${r.area} | (ink missing: preview ${r.preview ? "yes" : "no"}, pdf ${r.pdf ? "yes" : "no"}) | | | | |`
);
const md = [
  "Screenshot columns: Preview card photographed at 4x, calibrated on its bleed guide (±0.2mm whole-page noise). Outline column: the outline geometry's own box (top / bottom / left / right).",
  "",
  "| scenario | page | area | top | bottom | left | right | outline t / b / l / r |",
  "|---|---|---|---|---|---|---|---|",
  ...rows, "", `worst edge difference: ${worst.toFixed(3)}mm`].join("\n");
writeFileSync(join(OUT, "furniture.json"), JSON.stringify(results, null, 2));
writeFileSync(join(OUT, "furniture.md"), md + "\n");
console.log(md);
process.exit(worst > LIMIT_MM || results.some((r) => !r.delta) ? 1 : 0);
