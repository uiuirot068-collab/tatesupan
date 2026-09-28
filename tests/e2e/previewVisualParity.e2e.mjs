// Explicit-run screenshot capture for Preview visual-parity QA
// (docs/TATESPUN_MAIN_THREAD_PREVIEW_PERFORMANCE.md). Captures the same
// scenarios on any build so two builds can be pixel-compared with
// scripts/perf/comparePreviewScreenshots.mjs.
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 TATESPUN_VISUAL_OUT=dir \
//   [TATESPUN_VISUAL_ONLY=name,name] node tests/e2e/previewVisualParity.e2e.mjs
//
// Every scenario seeds one document (and its images) into IndexedDB, opens
// it, waits for the V2 layout and the web fonts (loaded with CJK sample
// text, never the latin-only default subset), hides the caret, and saves
// every mounted Preview page card as `<scenario>-card<N>.png` plus the
// whole viewport as `<scenario>-viewport.png`. Asserts only that each
// scenario rendered at least one page.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";
import { sleep } from "./helpers/cdp.mjs";

const target = resolveE2eTarget(process.env, "preview visual parity");
const OUT = process.env.TATESPUN_VISUAL_OUT;
if (!OUT) {
  console.error("preview visual parity: NOT RUN -- TATESPUN_VISUAL_OUT is not set");
  process.exit(2);
}
// Diagnostic only: extra CSS injected into every page (A/B experiments).
const INJECT_CSS = process.env.TATESPUN_VISUAL_INJECT_CSS ?? "";
const ONLY = new Set((process.env.TATESPUN_VISUAL_ONLY ?? "").split(",").filter(Boolean));
mkdirSync(OUT, { recursive: true });
const log = (line) => console.log(line);

// A 1x1-ish solid PNG built in the page (no binary fixture in the repo).
const IMAGE_ID = "qa-visual-image";

// Every character class the Preview paints as a plain TEXT unit, plus the
// notations that paint other unit kinds (ruby, 傍点, 縦中横, dash, ellipsis).
const CHARSET = [
  "　吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。",
  "「かな・カナ・漢字」『二重鉤括弧』（丸括弧）［角括弧］【隅付き】〈山括弧〉《二重山括弧》",
  "、。，．・：；？！ー～〜…‥―─々〆ヵヶゝゞヽヾ〃仝",
  "ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ",
  "ＡＢＣａｂｃ０１２ABCxyz789＠＃＄％＆＊＋－＝／＼＿￥",
  "𠮷野家の𩸽と髙島屋の﨑、①②③㈱㍿℡™©®♪★☆○●◎△▲□■◇◆※→←↑↓",
  "明治の｜東京《とうきょう》と漢字《かんじ》のルビ、《《傍点の文字》》と《《｜強調《きょうちょう》》》。",
  "縦中横は12月25日、!!と?!、[tate]ABC[/tate]も試す。",
  "ダッシュ――二倍ダッシュ――――と三点リーダ……六点……。",
].join("\n");

function prose(length) {
  const s = ["春の宵、窓辺に置いた硝子の瓶が淡い光を返していた。", "彼女は古い手紙を読み返し、ふと遠い町のことを思い出す。", "「もう一度だけ、あの坂を上ってみようか」と彼は言った。"];
  let text = "";
  for (let i = 0; text.length < length; i++) text += s[i % s.length];
  return text.slice(0, length);
}
function paragraphs(total, size = 150) {
  const text = prose(total);
  const parts = [];
  for (let i = 0; i < text.length; i += size) parts.push("　" + text.slice(i, i + size));
  return parts.join("\n");
}

const FONTS = {
  shippori: "'Shippori Mincho', serif",
  zen: "'Zen Old Mincho', serif",
  notoSerif: "'Noto Serif JP', serif",
  notoSans: "'Noto Sans JP', sans-serif",
  system: "serif",
};
const colophonOn = { enabled: true, fields: [{ id: "title", label: "書名", value: "視覚検査", visible: true }, { id: "author", label: "著者", value: "TateSpun QA", visible: true }] };

const SCENARIOS = [
  ...Object.entries(FONTS).map(([name, fontFamily]) => ({ name: `charset-bunko-${name}`, content: CHARSET, settings: { paperSize: "文庫", fontFamily } })),
  { name: "charset-a5-1col", content: CHARSET + "\n" + paragraphs(1200), settings: { paperSize: "A5", columnCount: 1 } },
  { name: "charset-a5-2col", content: CHARSET + "\n" + paragraphs(2400), settings: { paperSize: "A5", columnCount: 2, columnGapMm: 8 } },
  { name: "colophon-nombre", content: paragraphs(1500) + "\n【改ページ】\n" + CHARSET, settings: { paperSize: "文庫", colophon: colophonOn } },
  { name: "image-pages", content: "　挿絵の前の本文です。\n【IMG:" + IMAGE_ID + ":60:40:center】\n　挿絵の後の本文。\n【IMG:" + IMAGE_ID + ":80:120:full】\n" + paragraphs(600), settings: { paperSize: "文庫" }, image: true },
  { name: "long-300k", content: paragraphs(300_000), settings: { paperSize: "文庫" }, big: true },
  { name: "long-paragraph-20k", content: paragraphs(3000) + "\n　" + prose(20_000), settings: { paperSize: "文庫" }, big: true, scrollToEnd: true },
  { name: "mobile-charset", content: CHARSET, settings: { paperSize: "文庫" }, mobile: true },
].filter((scenario) => ONLY.size === 0 || ONLY.has(scenario.name));

const session = await launchEditorSession("tatespun-visual-");
const { cdp } = session;
await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
  source: `document.addEventListener("DOMContentLoaded", () => { const style = document.createElement("style"); style.textContent = "*{caret-color:transparent !important} *,*::before,*::after{transition:none !important;animation:none !important}" + ${JSON.stringify(INJECT_CSS)}; document.head.appendChild(style); });`,
});

try {
  await session.setViewport(1440, 1000);
  await cdp.send("Page.navigate", { url: target.url("/editor") });
  await cdp.waitFor(`/[?&]id=\\d+/.test(location.search) && !!document.querySelector('[data-editor-save-status="saved"]')`, { timeoutMs: 90_000, label: "bootstrap editor" });

  let docId = 778000;
  for (const scenario of SCENARIOS) {
    docId++;
    // devicePixelRatio 3: glyph-edge differences must be visible in the pixels.
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: scenario.mobile ? 390 : 1440, height: scenario.mobile ? 844 : 1000, deviceScaleFactor: 3, mobile: Boolean(scenario.mobile) });
    await cdp.evaluate(`new Promise((resolve, reject) => {
      const withImage = ${Boolean(scenario.image)};
      const put = (dataUrl) => {
        const open = indexedDB.open("tategaki-editor-db");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(["documents", "images"], "readwrite");
          tx.objectStore("documents").put({ id: ${docId}, title: ${JSON.stringify(scenario.name)}, content: ${JSON.stringify(scenario.content)}, plotNote: "", updatedAt: Date.now(), settings: ${JSON.stringify(scenario.settings)} });
          if (dataUrl) tx.objectStore("images").put({ id: ${JSON.stringify(IMAGE_ID)}, dataUrl, createdAt: 1 });
          tx.oncomplete = () => { db.close(); resolve(true); };
          tx.onerror = () => reject(tx.error);
        };
      };
      if (!withImage) return put(null);
      const canvas = document.createElement("canvas");
      canvas.width = 240; canvas.height = 160;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#2a6fb0"; ctx.fillRect(0, 0, 240, 160);
      ctx.fillStyle = "#f2c230"; ctx.fillRect(30, 30, 120, 60);
      put(canvas.toDataURL("image/png"));
    })`);
    await cdp.send("Page.navigate", { url: target.url(`/editor?id=${docId}`) });
    await cdp.waitFor(`!!document.querySelector('[data-editor-save-status="saved"]') && Number(document.querySelector('[data-preview-total-pages]')?.getAttribute('data-preview-total-pages') ?? 0) > 0`, { timeoutMs: 300_000, label: `${scenario.name}: Preview` });
    await cdp.evaluate(`Promise.all(["Shippori Mincho", "Zen Old Mincho", "Noto Serif JP", "Noto Sans JP"].flatMap((f) => ["400", "700"].map((w) => document.fonts.load(w + " 16px \\"" + f + "\\"", "吾輩は猫である漢字かなカナ「」、。…―ＡＢ１２𠮷")))).then(() => document.fonts.ready).then(() => true)`);
    if (scenario.mobile) {
      await cdp.evaluate(`(() => { const nav = document.querySelector('[aria-label="表示する画面"]'); const b = nav && [...nav.querySelectorAll('button')].find((x) => x.textContent.includes('プレビュー')); b?.click(); return !!b; })()`);
    }
    if (scenario.scrollToEnd) {
      await cdp.evaluate(`(() => { const el = document.querySelector('[data-demo-target="editor"]'); el.focus(); el.setSelectionRange(el.value.length - 5000, el.value.length - 5000); el.blur(); })()`);
    }
    await sleep(scenario.big ? 6000 : 3000);
    // Settle: a reflow after the fonts are in, then two frames.
    await cdp.evaluate(`(document.activeElement?.blur?.(), new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))))`);
    await sleep(800);
    const cards = await cdp.evaluate(`[...document.querySelectorAll('[data-page-card=true]')].map((card) => { const r = card.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, visible: r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth }; }).filter((c) => c.visible)`);
    assert.ok(cards.length > 0, `${scenario.name}: at least one visible Preview page`);
    const shots = [];
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const { data } = await cdp.send("Page.captureScreenshot", { format: "png", clip: { x: Math.max(0, c.x), y: Math.max(0, c.y), width: c.width, height: c.height, scale: 1 } });
      const file = `${scenario.name}-card${i}.png`;
      writeFileSync(join(OUT, file), Buffer.from(data, "base64"));
      shots.push(file);
    }
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(OUT, `${scenario.name}-viewport.png`), Buffer.from(data, "base64"));
    const totalPages = await cdp.evaluate(`document.querySelector('[data-preview-total-pages]').getAttribute('data-preview-total-pages')`);
    const clipUnits = await cdp.evaluate(`[...document.querySelectorAll('.unit-ink')].filter((el) => getComputedStyle(el).overflow !== 'visible').length`);
    const units = await cdp.evaluate(`document.querySelectorAll('.unit-ink').length`);
    log(`${scenario.name}: pages=${totalPages} cards=${shots.length} unitInk=${units} clipping=${clipUnits}`);
  }
  log("PASS preview visual parity capture");
} finally {
  await session.close();
}
