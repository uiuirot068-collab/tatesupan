// TSP-PRINT-003 (P4-7): where the Preview and the PDF put ノンブル / 柱 /
// 隠しノンブル, in millimetres.
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 TATESPUN_PARITY_OUT=dir \
//   [TATESPUN_E2E_LOCAL_WEBFONTS=1] node tests/e2e/furnitureParity.e2e.mjs
//
// For each scenario it seeds one document with a running head, a folio and
// the 隠しノンブル, exports the PDF and rasterizes it at 600dpi, and checks
// the first two Preview pages (and the colophon page when there is one):
//
// - every ノンブル / 柱 / 隠しノンブル is drawn as glyph outlines (no browser
//   text fallback on a print paper);
// - each one's outline box matches the PDF ink around it (edge difference,
//   Preview − PDF, mm; + = Preview is lower / more to the right);
// - the outlines are really painted (the screenshot has ink in the same box);
// - the PDF has no furniture ink the Preview lacks (furniture bands outside
//   every outline are blank in the PDF).
//
// A Web閲覧用 scenario only checks that its furniture is glyph outlines too
// (TSP-PRINT-004; its position against the JPG is measured by
// illustrationParity.e2e.mjs, as Web閲覧用 has no PDF). Writes
// `<out>/furniture.json` + `.md`. Exit 1 on any failure or an edge
// difference over 0.15mm.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
const colophon = {
  enabled: true,
  fields: [
    { id: "title", label: "書名", value: "組版の比較", visible: true },
    { id: "author", label: "著者", value: "TateSpun QA", visible: true },
  ],
  freeText: "本作はフィクションです。",
};
// 柱 is always on the outer side in the Editor (Core's header rule), so there
// is no centred-柱 scenario to reach.
const SCENARIOS = [
  { name: "bunko-shippori-outer-top", settings: { paperSize: "文庫", fontFamily: "'Shippori Mincho', serif", masterPage: masterPage({}) } },
  { name: "bunko-notoSans-center-bottom", settings: { paperSize: "文庫", fontFamily: "'Noto Sans JP', sans-serif", masterPage: masterPage({ nombrePosition: "center", hashiraPosition: "bottom", nombreBottomMargin: 3 }) } },
  { name: "a5-zenOld-small-notoSans-folio", settings: { paperSize: "A5", fontFamily: "'Zen Old Mincho', serif", masterPage: masterPage({ headerFontSize: 6, nombreFontSize: 6, nombreFontFamily: "'Noto Sans JP', sans-serif" }) } },
  { name: "bunko-shippori-colophon", colophon: true, settings: { paperSize: "文庫", fontFamily: "'Shippori Mincho', serif", colophon, masterPage: masterPage({}) } },
  // TSP-PRINT-004: a character outside the BMP (jsPDF measured it as two) on
  // both pages, so the right-aligned 柱 of page 2 shows any width error.
  { name: "bunko-shippori-supplementary", settings: { paperSize: "文庫", fontFamily: "'Shippori Mincho', serif", masterPage: masterPage({ hashiraOdd: "𠮷野家の柱", hashiraEven: "𠮷野家 𩸽の章", nombrePosition: "center" }) } },
  { name: "web-reading", web: true, settings: { paperSize: "Web閲覧用", fontFamily: "'Shippori Mincho', serif", masterPage: masterPage({}) } },
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

/** The first ink pixel (mm) inside `band` but outside every `windows` box, if any. */
async function inkOutside(file, pxPerMm, band, windows) {
  const { data, info } = await sharp(file).flatten({ background: "#ffffff" }).grayscale().raw().toBuffer({ resolveWithObject: true });
  const inside = (x, y) => windows.some((w) => x >= w.left && x <= w.right && y >= w.top && y <= w.bottom);
  for (let y = Math.round(band.top * pxPerMm); y < Math.min(info.height, Math.round(band.bottom * pxPerMm)); y++) {
    for (let x = Math.round(band.left * pxPerMm); x < Math.min(info.width, Math.round(band.right * pxPerMm)); x++) {
      if (data[y * info.width + x] < 128 && !inside(x / pxPerMm, y / pxPerMm)) return { xMm: Number((x / pxPerMm).toFixed(2)), yMm: Number((y / pxPerMm).toFixed(2)) };
    }
  }
  return null;
}

const results = [];
const failures = [];
let worst = 0;
const fail = (message) => {
  failures.push(message);
  console.log(`FAIL ${message}`);
};
const union = (boxes) => ({
  left: Math.min(...boxes.map((b) => b.left)),
  right: Math.max(...boxes.map((b) => b.right)),
  top: Math.min(...boxes.map((b) => b.top)),
  bottom: Math.max(...boxes.map((b) => b.bottom)),
});
const grow = (box, mm) => ({ left: box.left - mm, right: box.right + mm, top: box.top - mm, bottom: box.bottom + mm });
const edges = (a, b) => Object.fromEntries(["left", "right", "top", "bottom"].map((k) => [k, Number((a[k] - b[k]).toFixed(3))]));
try {
  await session.setViewport(1440, 1000);
  await cdp.send("Page.navigate", { url: target.url("/editor") });
  await cdp.waitFor(`/[?&]id=\\d+/.test(location.search) && !!document.querySelector('[data-editor-save-status="saved"]')`, { timeoutMs: 120_000, label: "bootstrap editor" });
  let docId = 781000;
  for (const scenario of SCENARIOS) {
    docId++;
    const dir = join(OUT, scenario.name);
    // No stale pdf-*.png / preview-*.png from an earlier run.
    rmSync(dir, { recursive: true, force: true });
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

    if (scenario.web) {
      const card = `document.querySelector('[data-preview-physical-page="1"] [data-page-card=true]')`;
      await cdp.evaluate(`(${card}.scrollIntoView({ block: "center" }), true)`);
      await sleep(1500);
      await cdp.waitFor(`${card}.querySelectorAll('svg[data-furniture-outline][data-nombre]').length > 0`, { timeoutMs: 15000, label: "Web furniture outlines" }).catch(() => {});
      const web = await cdp.evaluate(`(() => { const c = ${card}; return { outlines: c.querySelectorAll('[data-furniture-outline]').length, browserText: c.querySelectorAll('div[data-nombre], div[data-hashira]').length, nombre: c.querySelector('[data-nombre]')?.getAttribute('aria-label') ?? null }; })()`);
      if (web.outlines === 0 || web.browserText !== 0) fail(`${scenario.name}: Web閲覧用 furniture is not glyph outlines (${JSON.stringify(web)})`);
      if (!web.nombre) fail(`${scenario.name}: Web閲覧用 has no ノンブル`);
      results.push({ scenario: scenario.name, page: 1, kind: "web", web });
      console.log(`${scenario.name}: done`);
      continue;
    }

    const pdfDownload = await exportPdf();
    const pdfFile = join(dir, "export.pdf");
    writeFileSync(pdfFile, readFileSync(pdfDownload.filePath));
    const raster = spawnSync("pdftoppm", ["-r", String(PDF_DPI), "-png", pdfFile, join(dir, "pdf")]);
    assert.equal(raster.status, 0, `pdftoppm failed: ${raster.stderr}`);
    const pdfFiles = readdirSync(dir).filter((f) => /^pdf-\d+\.png$/.test(f)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0])).map((f) => join(dir, f));
    const pdfMeta = await sharp(pdfFiles[0]).metadata();
    const paper = { width: (pdfMeta.width / PDF_DPI) * 25.4, height: (pdfMeta.height / PDF_DPI) * 25.4 };

    const pages = [1, 2];
    if (scenario.colophon) {
      const colophonPage = await cdp.evaluate(`Number(document.querySelector('[data-colophon-page]')?.closest('[data-preview-physical-page]')?.getAttribute('data-preview-physical-page') ?? 0)`);
      if (!colophonPage) fail(`${scenario.name}: no colophon page in the Preview`);
      else pages.push(colophonPage);
    }
    for (const page of pages) {
      const card = `document.querySelector('[data-preview-physical-page="${page}"] [data-page-card=true]')`;
      await cdp.evaluate(`(${card}.scrollIntoView({ block: "center", inline: "center" }), true)`);
      await sleep(600);
      const outlinesReady = await cdp
        .waitFor(`(() => { const c = ${card}; return !c.querySelector('div[data-nombre], div[data-hashira]') && c.querySelectorAll('[data-furniture-outline]').length > 0; })()`, { timeoutMs: 15000, label: "furniture outlines" })
        .then(() => true, () => false);
      if (!outlinesReady) fail(`${scenario.name} p${page}: furniture is (partly) browser text, not glyph outlines`);
      await sleep(300);
      const r = await cdp.evaluate(`(() => { const r = ${card}.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
      const { data } = await cdp.send("Page.captureScreenshot", { format: "png", clip: { ...r, scale: 4 } });
      const previewFile = join(dir, `preview-${page}.png`);
      writeFileSync(previewFile, Buffer.from(data, "base64"));
      const trim = await trimFromGuide(previewFile, paper.width);
      // Each furniture text's outline box, relative to the bleed guide (the
      // trim edge), straight from the page geometry. The 隠しノンブル digits
      // are one item.
      const items = await cdp.evaluate(`(() => {
        const card = ${card};
        const guide = card.querySelector('[data-bleed-guide]').getBoundingClientRect();
        const pxPerMm = guide.width / ${paper.width};
        return [...card.querySelectorAll('svg[data-furniture-outline]')].map((svg) => {
          const r = svg.querySelector('g').getBoundingClientRect();
          return {
            kind: svg.hasAttribute('data-nombre') ? 'nombre' : svg.hasAttribute('data-hashira') ? 'hashira' : 'hidden',
            text: svg.getAttribute('aria-label'),
            box: { left: (r.left - guide.left) / pxPerMm, right: (r.right - guide.left) / pxPerMm, top: (r.top - guide.top) / pxPerMm, bottom: (r.bottom - guide.top) / pxPerMm },
          };
        });
      })()`);
      const byKind = new Map();
      for (const item of items) byKind.set(item.kind, [...(byKind.get(item.kind) ?? []), item]);
      // The colophon page has no 隠しノンブル (PDF neither; the stray-ink check
      // below would catch one).
      const colophonCard = await cdp.evaluate(`${card}.hasAttribute('data-colophon-page')`);
      for (const kind of colophonCard ? ["nombre", "hashira"] : ["nombre", "hashira", "hidden"]) {
        if (!byKind.has(kind)) fail(`${scenario.name} p${page}: no ${kind} outline`);
      }
      const pdfPage = pdfFiles[page - 1];
      if (!pdfPage) {
        fail(`${scenario.name} p${page}: the PDF has no page ${page}`);
        continue;
      }
      const pdfPxPerMm = PDF_DPI / 25.4;
      const windows = [];
      for (const [kind, group] of byKind) {
        const outline = union(group.map((item) => item.box));
        const window = grow(outline, 0.8);
        windows.push(window);
        const pdf = await inkBox(pdfPage, pdfPxPerMm, 0, 0, window);
        const painted = await inkBox(previewFile, trim.pxPerMm, trim.originX, trim.originY, window);
        const text = group.map((item) => item.text).join("");
        if (!pdf) {
          fail(`${scenario.name} p${page} ${kind} "${text}": no PDF ink where the Preview draws it`);
          continue;
        }
        // The screenshot's own calibration moves a whole page by up to ~0.5mm,
        // so it only proves the glyphs are painted: ink near the outline, of
        // the outline's size.
        const shown = painted && edges(painted, outline);
        const sizeOff = shown && Math.max(Math.abs(shown.right - shown.left), Math.abs(shown.bottom - shown.top));
        if (!shown || sizeOff > 0.12 || Object.values(shown).some((d) => Math.abs(d) > 0.6)) {
          fail(`${scenario.name} p${page} ${kind} "${text}": the outline is not painted on screen (screenshot ink ${shown ? JSON.stringify(shown) : "none"})`);
        }
        const delta = edges(outline, pdf);
        worst = Math.max(worst, ...Object.values(delta).map(Math.abs));
        results.push({ scenario: scenario.name, page, kind, text, delta, outline, pdf, painted });
      }
      // PDF furniture the Preview does not draw: ink in the furniture bands
      // outside every outline window.
      const bands = [
        { left: 0.6, right: paper.width - 0.6, top: 0.6, bottom: 9 },
        { left: 0.6, right: paper.width - 0.6, top: paper.height - 9, bottom: paper.height - 0.6 },
        { left: 0.6, right: 4, top: 9, bottom: paper.height - 9 },
        { left: paper.width - 4, right: paper.width - 0.6, top: 9, bottom: paper.height - 9 },
      ];
      for (const band of bands) {
        const stray = await inkOutside(pdfPage, pdfPxPerMm, band, windows);
        if (stray) fail(`${scenario.name} p${page}: PDF ink with no Preview outline at ${JSON.stringify(stray)}`);
      }
    }
    console.log(`${scenario.name}: done`);
  }
} finally {
  await session.close?.();
}

const rows = results.map((r) =>
  r.delta
    ? `| ${r.scenario} | ${r.page} | ${r.kind} | ${r.text} | ${r.delta.top} | ${r.delta.bottom} | ${r.delta.left} | ${r.delta.right} |`
    : `| ${r.scenario} | ${r.page} | ${r.kind} | ${JSON.stringify(r.web)} | | | | |`
);
const md = [
  "Each furniture text's outline box (Preview geometry) minus the PDF ink box around it (600dpi), mm.",
  "",
  "| scenario | page | kind | text | top | bottom | left | right |",
  "|---|---|---|---|---|---|---|---|",
  ...rows,
  "",
  `worst edge difference: ${worst.toFixed(3)}mm`,
  "",
  failures.length ? ["failures:", ...failures.map((f) => `- ${f}`)].join("\n") : "failures: none",
].join("\n");
writeFileSync(join(OUT, "furniture.json"), JSON.stringify({ results, failures }, null, 2));
writeFileSync(join(OUT, "furniture.md"), md + "\n");
console.log(md);
process.exit(worst > LIMIT_MM || failures.length > 0 ? 1 : 0);
