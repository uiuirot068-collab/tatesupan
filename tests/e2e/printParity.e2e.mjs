// TSP-PRINT-001 (P4-0): Preview / JPG / PDF side by side.
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 TATESPUN_PARITY_OUT=dir \
//   [TATESPUN_E2E_LOCAL_WEBFONTS=1] [TATESPUN_PARITY_ONLY=name,name] \
//   node tests/e2e/printParity.e2e.mjs
//
// For every scenario (one manuscript x one font) it seeds the document,
// saves each Preview page card as PNG, exports JPG ZIP and PDF through the
// real export menu, then writes `<out>/<scenario>/` with the three sets and
// `<out>/report.json` + `<out>/report.md`:
// - page counts of Preview, JPG and PDF,
// - for each page, how different the pairs are (Preview-JPG, JPG-PDF,
//   Preview-PDF): the share of pixels whose ink differs after both images
//   are scaled to the same size (grayscale, 600px wide).
// The first run on a build is the baseline; later runs are compared with it
// by eye or with `--baseline <report.json>` (exit 1 when a pair grows by
// more than 2 points or a page count changes).
//
// TATESPUN_E2E_LOCAL_WEBFONTS=1 answers fonts.googleapis.com with the same
// font files the PDF embeds (`public/fonts/`), for machines that cannot
// reach Google Fonts. PDF pages are rasterized with `pdftoppm` (poppler).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import sharp from "sharp";
import { inkDifference, PDF_DPI } from "./helpers/pageCompare.mjs";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";
import { sleep } from "./helpers/cdp.mjs";

const target = resolveE2eTarget(process.env, "print parity");
const OUT = process.env.TATESPUN_PARITY_OUT;
if (!OUT) {
  console.error("print parity: NOT RUN -- TATESPUN_PARITY_OUT is not set");
  process.exit(2);
}
if (spawnSync("pdftoppm", ["-v"]).error) {
  console.error("print parity: NOT RUN -- pdftoppm (poppler) is not installed");
  process.exit(2);
}
const ONLY = new Set((process.env.TATESPUN_PARITY_ONLY ?? "").split(",").filter(Boolean));
const LOCAL_WEBFONTS = process.env.TATESPUN_E2E_LOCAL_WEBFONTS === "1";
const baselineIndex = process.argv.indexOf("--baseline");
const BASELINE = baselineIndex > 0 ? JSON.parse(readFileSync(process.argv[baselineIndex + 1], "utf8")) : null;
mkdirSync(OUT, { recursive: true });
const log = (line) => console.log(line);

// Same list as src/lib/v2BrowserExport.ts PUBLICATION_FONT_ASSETS.
const FONT_FILES = {
  "Shippori Mincho": "ShipporiMincho-Regular.ttf",
  "Zen Old Mincho": "ZenOldMincho-Regular.ttf",
  "Noto Serif JP": "NotoSerifJP-Regular.ttf",
  "Noto Sans JP": "NotoSansJP-Regular.ttf",
  "BIZ UDMincho": "BIZUDMincho-Regular.ttf",
  "Shippori Mincho B1": "ShipporiMinchoB1-Regular.ttf",
  "Kaisei Tokumin": "KaiseiTokumin-Regular.ttf",
  "Kaisei Opti": "KaiseiOpti-Regular.ttf",
  "Hina Mincho": "HinaMincho-Regular.ttf",
  "Zen Antique": "ZenAntique-Regular.ttf",
  "BIZ UDGothic": "BIZUDGothic-Regular.ttf",
  "Zen Kaku Gothic New": "ZenKakuGothicNew-Regular.ttf",
  "M PLUS 1p": "MPLUS1p-Regular.ttf",
  "Zen Maru Gothic": "ZenMaruGothic-Regular.ttf",
  "Kiwi Maru": "KiwiMaru-Regular.ttf",
};

const SAMPLE = [
  "　吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。",
  "　明治の｜東京《とうきょう》と漢字《かんじ》のルビ、《《傍点の文字》》。",
  "　縦中横は12月25日、!!と?!も試す。ダッシュ――と三点リーダ……。",
  "「かな・カナ・漢字」『二重鉤括弧』（丸括弧）、。ぁぃぅぇぉっゃゅょ",
].join("\n");
function prose(length) {
  const s = ["春の宵、窓辺に置いた硝子の瓶が淡い光を返していた。", "彼女は古い手紙を読み返し、ふと遠い町のことを思い出す。", "「もう一度だけ、あの坂を上ってみようか」と彼は言った。"];
  let text = "";
  for (let i = 0; text.length < length; i++) text += s[i % s.length];
  return text.slice(0, length);
}
const BODY = SAMPLE + "\n　" + prose(900);
const FONTS = {
  shippori: "'Shippori Mincho', serif",
  notoSans: "'Noto Sans JP', sans-serif",
  zenOld: "'Zen Old Mincho', serif",
};
const colophon = (freeText) => ({
  enabled: true,
  fields: [
    { id: "title", label: "書名", value: "組版の比較", visible: true },
    { id: "author", label: "著者", value: "TateSpun QA", visible: true },
  ],
  freeText,
});
const LONG_FREE = Array.from({ length: 40 }, (_, i) => `自由欄の${i + 1}行目です。`).join("\n");
const SCENARIOS = [
  ...Object.entries(FONTS).map(([font, fontFamily]) => ({ name: `bunko-${font}`, content: BODY, settings: { paperSize: "文庫", fontFamily, colophon: colophon("本作はフィクションです。") } })),
  { name: "a5-2col-shippori", content: BODY + "\n　" + prose(1800), settings: { paperSize: "A5", columnCount: 2, columnGapMm: 8 } },
  { name: "colophon-long-shippori", content: BODY, settings: { paperSize: "文庫", colophon: colophon(LONG_FREE) } },
].filter((scenario) => ONLY.size === 0 || ONLY.has(scenario.name));

const session = await launchEditorSession("tatespun-print-parity-");
const { cdp, downloads } = session;
await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
  source: `document.addEventListener("DOMContentLoaded", () => { const style = document.createElement("style"); style.textContent = "*{caret-color:transparent !important} *,*::before,*::after{transition:none !important;animation:none !important}"; document.head.appendChild(style); });`,
});
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

async function click(selector, text = null) {
  const ok = await cdp.evaluate(`(() => {
    const wanted = ${JSON.stringify(text)};
    const b = [...document.querySelectorAll(${JSON.stringify(selector)})].find((x) => wanted === null || x.textContent.trim() === wanted);
    if (!b || b.disabled) return false;
    b.click();
    return true;
  })()`);
  assert.equal(ok, true, `could not click ${selector}${text ? ` "${text}"` : ""}`);
}
async function waitForDownload(before, label) {
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    const done = downloads.slice(before).find((d) => d.state === "completed");
    if (done) return done;
    // The odd-page warning asks before a PDF with an odd page count.
    await cdp.evaluate(`document.querySelector('[data-pdf-odd-page-warning-action="continue"]')?.click(), true`);
    await sleep(300);
  }
  throw new Error(`${label}: no completed download`);
}
async function exportEntry(id, { all = false } = {}) {
  await click('[data-demo-target="export"]');
  await cdp.waitFor(`!!document.querySelector('[data-export-menu-entry="${id}"]')`, { label: `export menu ${id}` });
  const before = downloads.length;
  await click(`[data-export-menu-entry="${id}"]`);
  if (id === "pdf") {
    await cdp.waitFor(`!!document.querySelector('[data-pdf-export-setup-modal]')`, { label: "PDF setup" });
    // The pre-export check has to be opened once before the button enables.
    await cdp.evaluate(`document.querySelector('[data-pdf-export-blocked-reason="preflight"] button')?.click(), true`);
    await cdp.waitFor(
      `[...document.querySelectorAll('[data-pdf-export-setup-modal] button')].some((b) => !b.disabled && ["ダウンロード", "確認してこのまま書き出す"].includes(b.textContent.trim()))`,
      { label: "PDF download enabled" }
    );
    await cdp.evaluate(`[...document.querySelectorAll('[data-pdf-export-setup-modal] button')].find((b) => !b.disabled && ["ダウンロード", "確認してこのまま書き出す"].includes(b.textContent.trim())).click(), true`);
  }
  const first = await waitForDownload(before, id);
  if (!all) return [first];
  // Several pages download one by one; wait until no new one arrives.
  let count = 0;
  while (downloads.length !== count || downloads.slice(before).some((d) => d.state === "inProgress")) {
    count = downloads.length;
    await sleep(2500);
  }
  return downloads.slice(before).filter((d) => d.state === "completed");
}
const hasExportEntry = async (id) => {
  await click('[data-demo-target="export"]');
  await sleep(300);
  const found = await cdp.evaluate(`!!document.querySelector('[data-export-menu-entry="${id}"]')`);
  await cdp.evaluate(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })), true`);
  await click('[data-demo-target="export"]');
  await sleep(300);
  return found;
};
/** The physical page number at the end of an exported JPG's file name. */
const jpgPageNumber = (name) => Number(/(\d+)\.jpe?g$/i.exec(name)?.[1] ?? NaN);

const report = [];
try {
  await session.setViewport(1440, 1000);
  await cdp.send("Page.navigate", { url: target.url("/editor") });
  await cdp.waitFor(`/[?&]id=\\d+/.test(location.search) && !!document.querySelector('[data-editor-save-status="saved"]')`, { timeoutMs: 120_000, label: "bootstrap editor" });

  let docId = 779000;
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
        tx.objectStore("documents").put({ id: ${docId}, title: ${JSON.stringify(scenario.name)}, content: ${JSON.stringify(scenario.content)}, plotNote: "", updatedAt: Date.now(), settings: ${JSON.stringify(scenario.settings)} });
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onerror = () => reject(tx.error);
      };
    })`);
    await cdp.send("Page.navigate", { url: target.url(`/editor?id=${docId}`) });
    await cdp.waitFor(`!!document.querySelector('[data-editor-save-status="saved"]') && Number(document.querySelector('[data-preview-total-pages]')?.getAttribute('data-preview-total-pages') ?? 0) > 0`, { timeoutMs: 300_000, label: `${scenario.name}: Preview` });
    await cdp.evaluate(`Promise.all(${JSON.stringify(Object.keys(FONT_FILES))}.map((f) => document.fonts.load("16px \\"" + f + "\\"", "吾輩は猫である漢字かなカナ「」、。…―ＡＢ１２"))).then(() => document.fonts.ready).then(() => true)`);
    await sleep(3000);
    await cdp.evaluate(`(document.activeElement?.blur?.(), new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))))`);
    await sleep(800);

    // Which typeface each output really draws with.
    const previewFont = await cdp.evaluate(`(() => { const unit = document.querySelector('[data-v2-preview-root] .unit'); return unit ? getComputedStyle(unit).fontFamily : null; })()`);
    const previewTotal = Number(await cdp.evaluate(`document.querySelector('[data-preview-total-pages]').getAttribute('data-preview-total-pages')`));
    // A spread shows its pages right to left, so cards are taken by their
    // physical page number, not in DOM order.
    const physicalPages = await cdp.evaluate(`[...document.querySelectorAll('[data-preview-physical-page]')].filter((el) => el.querySelector('[data-page-card=true]')).map((el) => Number(el.getAttribute('data-preview-physical-page'))).sort((a, b) => a - b)`);
    const previewFiles = [];
    for (const page of physicalPages) {
      const card = `document.querySelector('[data-preview-physical-page="${page}"] [data-page-card=true]')`;
      await cdp.evaluate(`(${card}.scrollIntoView({ block: "center", inline: "center" }), true)`);
      await sleep(400);
      const r = await cdp.evaluate(`(() => { const r = ${card}.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
      assert.ok(r.width > 0, `${scenario.name}: card ${page} has no size`);
      const { data } = await cdp.send("Page.captureScreenshot", { format: "png", clip: { ...r, scale: 3 } });
      const file = join(dir, `preview-${String(page).padStart(2, "0")}.png`);
      writeFileSync(file, Buffer.from(data, "base64"));
      previewFiles.push(file);
    }

    // JPG ZIP holds the body pages; the colophon has its own JPG entry.
    // Both name files by physical page number, which orders them.
    const [zipDownload] = await exportEntry("jpg-zip");
    const zip = await JSZip.loadAsync(readFileSync(zipDownload.filePath));
    const jpgByPage = new Map();
    for (const name of Object.keys(zip.files).filter((n) => /\.jpe?g$/i.test(n))) {
      jpgByPage.set(jpgPageNumber(name), await zip.files[name].async("nodebuffer"));
    }
    if (scenario.settings.colophon?.enabled && (await hasExportEntry("colophon-jpg"))) {
      for (const d of await exportEntry("colophon-jpg", { all: true })) jpgByPage.set(jpgPageNumber(d.name), readFileSync(d.filePath));
    }
    const jpgFiles = [];
    for (const page of [...jpgByPage.keys()].sort((a, b) => a - b)) {
      const file = join(dir, `jpg-${String(page).padStart(2, "0")}.jpg`);
      writeFileSync(file, jpgByPage.get(page));
      jpgFiles.push(file);
    }

    const [pdfDownload] = await exportEntry("pdf");
    const pdfFile = join(dir, "export.pdf");
    writeFileSync(pdfFile, readFileSync(pdfDownload.filePath));
    const raster = spawnSync("pdftoppm", ["-r", String(PDF_DPI), "-png", pdfFile, join(dir, "pdf")]);
    assert.equal(raster.status, 0, `pdftoppm failed: ${raster.stderr}`);
    const pdfFiles = readdirSync(dir).filter((f) => /^pdf-\d+\.png$/.test(f)).sort().map((f) => join(dir, f));

    const pdfFonts = [...new Set([...readFileSync(pdfFile).toString("latin1").matchAll(/\/BaseFont\s*\/([^\s/<>\[\]]+)/g)].map((m) => m[1].replace(/^[A-Z]{6}\+/, "")))];
    const pdfMeta = await sharp(pdfFiles[0]).metadata();
    const paperMm = { width: (pdfMeta.width / PDF_DPI) * 25.4, height: (pdfMeta.height / PDF_DPI) * 25.4 };
    const pages = [];
    const n = Math.max(previewFiles.length, jpgFiles.length, pdfFiles.length);
    for (let i = 0; i < n; i++) {
      const [p, j, d] = [previewFiles[i], jpgFiles[i], pdfFiles[i]];
      pages.push({
        page: i + 1,
        previewJpg: p && j ? await inkDifference(p, j, paperMm) : null,
        jpgPdf: j && d ? await inkDifference(j, d, paperMm) : null,
        previewPdf: p && d ? await inkDifference(p, d, paperMm) : null,
      });
    }
    const entry = { name: scenario.name, fontFamily: scenario.settings.fontFamily ?? "(default)", previewFont, pdfFonts, previewTotal, previewCards: previewFiles.length, jpg: jpgFiles.length, pdf: pdfFiles.length, pages };
    report.push(entry);
    log(`${scenario.name}: preview=${previewTotal} (cards ${previewFiles.length}) jpg=${jpgFiles.length} pdf=${pdfFiles.length} ` +
      `max diff P-J ${Math.max(0, ...pages.map((p) => p.previewJpg?.percent ?? 0))}% J-P ${Math.max(0, ...pages.map((p) => p.jpgPdf?.percent ?? 0))}% P-P ${Math.max(0, ...pages.map((p) => p.previewPdf?.percent ?? 0))}%`);
  }
} finally {
  await session.close();
}

writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2) + "\n");
const cell = (pair) => (pair ? `${pair.percent} (${pair.shiftMm}mm)` : "-");
const md = [
  "## Typeface",
  "",
  "| scenario | chosen | Preview draws | PDF embeds |",
  "|---|---|---|---|",
  ...report.map((r) => `| ${r.name} | ${r.fontFamily} | ${r.previewFont ?? "-"} | ${r.pdfFonts.join(", ") || "-"} |`),
  "",
  "## Pages (difference %, and how far the page sits off after lining up)",
  "",
  "| scenario | font | Preview body (cards) | JPG | PDF | page | Preview-JPG % (shift) | JPG-PDF % (shift) | Preview-PDF % (shift) |",
  "|---|---|---|---|---|---|---|---|---|",
  ...report.flatMap((r) => r.pages.map((p, i) => `| ${i === 0 ? r.name : ""} | ${i === 0 ? r.fontFamily : ""} | ${i === 0 ? `${r.previewTotal} (${r.previewCards})` : ""} | ${i === 0 ? r.jpg : ""} | ${i === 0 ? r.pdf : ""} | ${p.page} | ${cell(p.previewJpg)} | ${cell(p.jpgPdf)} | ${cell(p.previewPdf)} |`)),
].join("\n");
writeFileSync(join(OUT, "report.md"), md + "\n");
log(md);

let failed = false;
for (const r of report) {
  // `previewTotal` is the Preview's body page count; its cards also hold
  // the colophon, as JPG and PDF do.
  if (r.jpg !== r.pdf || r.previewCards !== r.pdf) {
    log(`FAIL ${r.name}: page counts differ: preview cards ${r.previewCards}, jpg ${r.jpg}, pdf ${r.pdf}`);
    failed = true;
  }
  const base = BASELINE?.find((b) => b.name === r.name);
  if (!base) continue;
  if (base.pdf !== r.pdf || base.jpg !== r.jpg || base.previewCards !== r.previewCards) {
    log(`FAIL ${r.name}: page counts changed from the baseline`);
    failed = true;
  }
  for (const p of r.pages) {
    const b = base.pages.find((x) => x.page === p.page);
    for (const key of ["previewJpg", "jpgPdf", "previewPdf"]) {
      if (b && p[key] && b[key] && p[key].percent > b[key].percent + 2) {
        log(`FAIL ${r.name} p${p.page} ${key}: ${b[key].percent}% -> ${p[key].percent}%`);
        failed = true;
      }
    }
  }
}
if (!existsSync(join(OUT, "report.json"))) failed = true;
log(failed ? "FAIL print parity" : "PASS print parity");
process.exit(failed ? 1 : 0);
