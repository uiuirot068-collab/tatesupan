// Explicit-run E2E for the Phase 5 V2 Preview page model.
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 node tests/e2e/previewPageModel.e2e.mjs
//
// In-memory Demo route only (no project / IndexedDB document / cloud). Checks,
// in a real browser, that the Preview page list follows the canonical V2
// layout the export uses:
//  1. an image inserted into a FULL page flows to the NEXT page (V2 rule) — in
//     the Preview cards AND in the exported JPGs (page 1 no image, page 2 image);
//  2. the page-count label equals the V2 list;
//  3. page reorder through the real ⋮ menu rewrites the manuscript by V2 page
//     ranges without losing text or notation.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";
import { sleep } from "./helpers/cdp.mjs";

const require = createRequire(import.meta.url);
const { loadImage, createCanvas } = require("@napi-rs/canvas");
const target = resolveE2eTarget(process.env, "preview page model E2E");
const session = await launchEditorSession("tatespun-page-model-");
const { cdp, downloads } = session;
const log = (line) => console.log(line);
const dialogs = [];
cdp.on("Page.javascriptDialogOpening", (params) => {
  dialogs.push(params.message);
  void cdp.send("Page.handleJavaScriptDialog", { accept: true });
});

async function click(selector, text = null) {
  const ok = await cdp.evaluate(`(() => {
    const wanted = ${JSON.stringify(text)};
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((x) => wanted === null || x.textContent.trim() === wanted);
    if (!el || el.disabled) return false;
    el.click();
    return true;
  })()`);
  assert.ok(ok, `could not click ${selector} ${text ?? ""}`);
}
async function setManuscript(text) {
  await cdp.evaluate(`(() => {
    const el = document.querySelector('[data-demo-target="editor"]');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, ${JSON.stringify(text)});
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
  })()`);
}
const manuscript = () => cdp.evaluate(`document.querySelector('[data-demo-target="editor"]').value`);
const totalPages = () => cdp.evaluate(`Number(document.querySelector('[data-preview-total-pages]')?.dataset.previewTotalPages)`);
const cardImageCounts = () => cdp.evaluate(`[...document.querySelectorAll('[data-page-card=true]')].map((card) => card.querySelectorAll('img').length)`);

async function exportJpgOfPage(pageNumber) {
  const before = downloads.filter((d) => d.state === "completed").length;
  // select exactly that page (checkbox toggles one page), then the single-page JPG
  await cdp.evaluate(`(() => {
    const boxes = [...document.querySelectorAll('input[type="checkbox"][aria-label*="選択"]')];
    return boxes.length;
  })()`);
  await cdp.evaluate(`document.querySelectorAll('[data-page-card=true]')[${pageNumber - 1}].click()`);
  await sleep(300);
  await click('[data-demo-target="export"]');
  await cdp.waitFor(`!!document.querySelector('[data-export-menu-entry="jpg"]')`, { label: "export menu" });
  await click('[data-export-menu-entry="jpg"]');
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const done = downloads.filter((d) => d.state === "completed");
    if (done.length > before) return done[done.length - 1];
    if (dialogs.length) throw new Error(`dialog during export: ${dialogs.join(" | ")}`);
    await sleep(150);
  }
  throw new Error("JPG export timeout");
}
async function darkPixelShare(file) {
  const image = await loadImage(readFileSync(file));
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, image.width, image.height);
  let midGray = 0;
  for (let i = 0; i < data.length; i += 4) {
    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    // the inserted image: #c82828 → grayscale ≈ 88 (a flat field; glyph anti-aliasing rarely sits in this narrow band)
    if (max - min <= 4 && max >= 82 && max <= 94) midGray += 1;
  }
  return midGray / (data.length / 4);
}

try {
  await session.setViewport(1440, 1000);
  await cdp.send("Page.navigate", { url: target.url("/editor?demo=1") });
  await cdp.waitFor(`!!document.querySelector('[data-demo-target="editor"]') && !!document.querySelector('[data-page-card=true]')`, { label: "demo editor + Preview" });
  await sleep(1_200);

  // 16 lines × 37 chars (demo = 文庫 37×16), each 「-led (no 一字下げ): page 1 exactly full, then a short page 2.
  const fullPage = Array.from({ length: 16 }, (_, i) => `「${"本".repeat(35)}${String.fromCharCode(0x3042 + i)}`).join("\n");
  await setManuscript(`${fullPage}\n二頁目の本文です。`);
  await cdp.waitFor(`Number(document.querySelector('[data-preview-total-pages]')?.dataset.previewTotalPages) === 2`, { label: "2 pages" });
  await sleep(1_500);

  // --- 1. image into full page 1 → flows to page 2 ------------------------------------------------
  await cdp.evaluate(`(() => {
    document.querySelector('button[aria-label="1ページの操作メニュー"]').click();
    const canvas = document.createElement('canvas');
    canvas.width = 300; canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#c82828';
    ctx.fillRect(0, 0, 300, 200);
    return new Promise((resolve) => canvas.toBlob((blob) => {
      const input = document.querySelector('input[type="file"][accept*="image"]');
      const transfer = new DataTransfer();
      transfer.items.add(new File([blob], 'qa-edge.png', { type: 'image/png' }));
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      resolve(true);
    }, 'image/png'));
  })()`);
  await cdp.waitFor(`document.querySelector('[data-demo-target="editor"]').value.includes('【IMG:')`, { label: "marker inserted" });
  await cdp.waitFor(`[...document.querySelectorAll('[data-page-card=true]')].some((card) => card.querySelector('img'))`, { label: "image rendered" });
  await sleep(1_500);
  const counts = await cardImageCounts();
  log(`  Preview image per card: ${JSON.stringify(counts)} (total pages ${await totalPages()})`);
  assert.equal(counts[0], 0, "a full page 1 must not keep the image (LEGACY trailing rule retired)");
  assert.equal(counts[1], 1, "the image flows to page 2 (V2 rule)");
  const text = await manuscript();
  assert.ok(text.indexOf("【IMG:") > text.indexOf(`${String.fromCharCode(0x3042 + 15)}`), "marker inserted at page 1's source end");

  const page1 = await exportJpgOfPage(1);
  const page2 = await exportJpgOfPage(2);
  const [share1, share2] = [await darkPixelShare(page1.filePath), await darkPixelShare(page2.filePath)];
  log(`  exported JPG image-pixel share: p1=${share1.toFixed(4)} p2=${share2.toFixed(4)}`);
  assert.ok(share2 > 0.05, "exported page 2 has the image — Preview and export agree");
  assert.ok(share1 < share2 / 20, "exported page 1 has no image");
  log("1. boundary image: Preview page 2 = export page 2 (V2 flow)");

  // --- 2. page count label ------------------------------------------------------------------------
  const label = await cdp.evaluate(`document.body.innerText.match(/全 (\\d+) ページ/)?.[1]`);
  assert.equal(Number(label), await totalPages());
  log(`2. page count label = V2 list (${label})`);

  // --- 3. reorder via the real ⋮ menu (V2 ranges) --------------------------------------------------
  await setManuscript("第一頁の｜本文《ほんぶん》。\n【改ページ】\n第二頁の《《本文》》。");
  await cdp.waitFor(`Number(document.querySelector('[data-preview-total-pages]')?.dataset.previewTotalPages) === 2`, { label: "2 pages for reorder" });
  await sleep(1_500);
  const menuOpen = () => cdp.evaluate(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === '1ページ後ろへ移動')`);
  if (!(await menuOpen())) await click('button[aria-label="1ページの操作メニュー"]');
  await cdp.waitFor(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === '1ページ後ろへ移動' && !b.disabled)`, { label: "page menu open" });
  await click("button", "1ページ後ろへ移動");
  await cdp.waitFor(`document.querySelector('[data-demo-target="editor"]').value.startsWith('第二頁')`, { label: "reordered manuscript" });
  const reordered = await manuscript();
  log(`  reordered manuscript: ${JSON.stringify(reordered)}`);
  assert.match(reordered, /^第二頁の《《本文》》。/);
  assert.match(reordered, /【改ページ】/);
  // a page range ends with its own paragraph newline (same as the LEGACY range), so the moved page keeps it
  assert.match(reordered, /第一頁の｜本文《ほんぶん》。\n?$/);
  log("3. reorder on V2 ranges keeps text, ruby and 傍点 notation");

  assert.equal(dialogs.length, 0, `unexpected dialogs: ${dialogs.join(" | ")}`);
  log("preview page model E2E: PASS");
} catch (error) {
  console.error("preview page model E2E: FAIL --", error instanceof Error ? error.message : error, JSON.stringify(dialogs));
  process.exitCode = 1;
} finally {
  await session.close();
}
