// Explicit-run UI-state screenshots + structural checks for the FULL / WINDOWED
// parity audit (docs/TATESPUN_FULL_WINDOWED_PARITY_AUDIT.md). Run once per
// build; the surfaces' editor chrome differs by design (WINDOWED adds the
// 編集ページ navigator), so images are for side-by-side review while the
// ASSERTED checks are structural and identical for both surfaces:
//   - no horizontal page overflow;
//   - the manuscript textarea is visible with a usable height;
//   - every editor action (元に戻す / やり直す / 改ページ挿入 / 検索・置換 and the
//     secondary row) is inside the viewport and not covered by another element.
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 TATESPUN_SCREENS_OUT=dir \
//   node tests/e2e/editorSurfaceScreens.e2e.mjs
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";
import { sleep } from "./helpers/cdp.mjs";

const target = resolveE2eTarget(process.env, "editor surface screens");
const OUT = process.env.TATESPUN_SCREENS_OUT;
if (!OUT) {
  console.error("editor surface screens: NOT RUN -- TATESPUN_SCREENS_OUT is not set");
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });
const session = await launchEditorSession("tatespun-screens-");
const { cdp } = session;
const log = (line) => console.log(line);
const EDITOR = '[data-demo-target="editor"]';
const failures = [];

const CHARSET = [
  "　吾輩は猫である。名前はまだ無い。",
  "明治の｜東京《とうきょう》と漢字《かんじ》のルビ、《《傍点の文字》》。",
  "縦中横は12月25日、!!と[tate]ABC[/tate]。",
  "ダッシュ――と三点リーダ……。",
].join("\n");
const para = (i) => `　第${i}段落。春の宵、窓辺に置いた硝子の瓶が淡い光を返していた。彼女は古い手紙を読み返し、ふと遠い町のことを思い出す。瑠璃色の空。`;
const LONG = Array.from({ length: 4300 }, (_, i) => para(i + 1)).join("\n"); // ≈300k

let docId = 782000;
async function openDocument(content, settings = {}, withImage = false) {
  docId++;
  await cdp.evaluate(`new Promise((resolve, reject) => {
    const put = (dataUrl) => {
      const open = indexedDB.open("tategaki-editor-db");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction(["documents", "images"], "readwrite");
        tx.objectStore("documents").put({ id: ${docId}, title: "画面確認", content: ${JSON.stringify(content)}, plotNote: "", updatedAt: Date.now(), settings: ${JSON.stringify(settings)} });
        if (dataUrl) tx.objectStore("images").put({ id: "screens-image", dataUrl, createdAt: 1 });
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onerror = () => reject(tx.error);
      };
    };
    if (!${withImage}) return put(null);
    const c = document.createElement("canvas"); c.width = 240; c.height = 160;
    const g = c.getContext("2d"); g.fillStyle = "#2a6fb0"; g.fillRect(0, 0, 240, 160);
    put(c.toDataURL("image/png"));
  })`);
  await cdp.send("Page.navigate", { url: target.url(`/editor?id=${docId}`) });
  await cdp.waitFor(`!!document.querySelector('[data-editor-save-status="saved"]') && !!document.querySelector('${EDITOR}') && Number(document.querySelector('[data-preview-total-pages]')?.getAttribute('data-preview-total-pages') ?? 0) > 0`, { timeoutMs: 180_000, label: "open" });
  await sleep(1500);
}

async function checkAndShoot(name, { mobile = false, modal = false } = {}) {
  const report = await cdp.evaluate(`(() => {
    const problems = [];
    const vw = innerWidth, vh = innerHeight;
    if (document.documentElement.scrollWidth > vw + 1) problems.push("horizontal overflow " + document.documentElement.scrollWidth + ">" + vw);
    const editor = document.querySelector('${EDITOR}');
    const er = editor?.getBoundingClientRect();
    const editorShown = !!er && er.width > 0 && er.height > 0 && getComputedStyle(editor).visibility !== "hidden";
    const mobileHidden = ${mobile} && !editorShown;
    if (!editorShown && !mobileHidden) problems.push("editor not visible");
    if (editorShown && er.height < ${mobile ? 120 : 200}) problems.push("editor height " + Math.round(er.height));
    const controls = [...document.querySelectorAll('[data-editor-action="undo"], [data-editor-action="redo"], [data-editor-action="page-break"], [data-editor-action="replace"], [data-editor-secondary]')];
    for (const el of controls) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue; // hidden by layout (e.g. focus mode), not unreachable
      const x = r.x + r.width / 2, y = r.y + r.height / 2;
      if (x < 0 || y < 0 || x > vw || y > vh) { problems.push("off-screen " + (el.dataset.editorAction ?? el.dataset.editorSecondary)); continue; }
      if (${modal}) continue; // an open menu/dialog covers the editor with its dismiss layer by design
      const hit = document.elementFromPoint(x, y);
      if (hit && hit !== el && !el.contains(hit) && hit.tagName !== "NEXTJS-PORTAL") problems.push("covered " + (el.dataset.editorAction ?? el.dataset.editorSecondary) + " by " + hit.tagName);
    }
    return { problems, editorHeight: er ? Math.round(er.height) : 0, controls: controls.length, navigator: !!document.querySelector('[data-editor-page-navigator]') };
  })()`);
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, "base64"));
  log(`${name}: ${JSON.stringify(report)}`);
  if (report.problems.length) failures.push(`${name}: ${report.problems.join("; ")}`);
}

try {
  await session.setViewport(1440, 900);
  await cdp.send("Page.navigate", { url: target.url("/editor") });
  await cdp.waitFor(`/[?&]id=\\d+/.test(location.search) && !!document.querySelector('[data-editor-save-status="saved"]')`, { timeoutMs: 90_000, label: "bootstrap editor" });
  const surface = await cdp.evaluate(`document.querySelector('[data-editor-page-navigator]') ? "WINDOWED" : "FULL"`);
  log(`surface=${surface}`);

  await openDocument(CHARSET);
  await checkAndShoot("desktop-short-ruby-emphasis-tcy");
  await openDocument(CHARSET + "\n" + Array.from({ length: 40 }, (_, i) => para(i)).join("\n"), { paperSize: "A5", columnCount: 2, columnGapMm: 8 });
  await checkAndShoot("desktop-a5-2col");
  await openDocument(Array.from({ length: 30 }, (_, i) => para(i)).join("\n"), { paperSize: "文庫", colophon: { enabled: true, fields: [{ id: "title", label: "書名", value: "画面確認", visible: true }] } });
  await checkAndShoot("desktop-colophon");
  await openDocument("　挿絵の前。\n【IMG:screens-image:60:40:center】\n　挿絵の後。", { paperSize: "文庫" }, true);
  await checkAndShoot("desktop-image");
  await openDocument(LONG);
  await checkAndShoot("desktop-300k");
  if (surface === "WINDOWED") {
    await cdp.evaluate(`document.querySelector('button[aria-label="次の編集ページへ移動"]')?.click()`);
    await sleep(800);
    await checkAndShoot("desktop-300k-page-navigation");
    await cdp.evaluate(`document.querySelector('[data-editor-select-all]')?.click()`);
  } else {
    await cdp.evaluate(`(() => { const el = document.querySelector('${EDITOR}'); el.focus(); el.select(); })()`);
  }
  await sleep(500);
  await checkAndShoot("desktop-300k-whole-selection");
  await cdp.evaluate(`document.querySelector('[data-editor-action="replace"]').click()`);
  await sleep(800);
  await cdp.evaluate(`(() => { const i = document.querySelector('[data-search-input]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, '瑠璃色'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(1500);
  await checkAndShoot("desktop-300k-search-replace");
  await cdp.evaluate(`document.querySelector('[data-search-action="close"]')?.click()`);
  await sleep(300);
  const exportOpened = await cdp.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /書き出し|エクスポート|PDF/.test(x.textContent) && x.getBoundingClientRect().width > 0); if (!b) return false; b.click(); return true; })()`);
  await sleep(800);
  await checkAndShoot("desktop-300k-export-menu", { modal: true });
  log(`export menu opened: ${exportOpened}`);
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });

  for (const [w, h] of [[390, 844], [320, 568], [768, 1024]]) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile: w < 768 });
    await openDocument(LONG.slice(0, 60_000));
    await checkAndShoot(`mobile-${w}x${h}-editor`, { mobile: true });
  }
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await cdp.evaluate(`(() => { const nav = document.querySelector('[aria-label="表示する画面"]'); const b = nav && [...nav.querySelectorAll('button')].find((x) => x.textContent.includes('プレビュー')); b?.click(); })()`);
  await sleep(1500);
  await checkAndShoot("mobile-390x844-preview", { mobile: true });

  assert.deepEqual(failures, [], "structural UI checks");
  log(`PASS editor surface screens (${surface})`);
} finally {
  await session.close();
}
