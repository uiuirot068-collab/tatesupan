// CST-PORT-016 (移植ロードマップ 8 / B6): 長い原稿の速度計測パネル（`?perf=1`、開発用）。
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 node tests/e2e/longDocumentPerfPanel.e2e.mjs
//
// Covers: no panel without ?perf=1 (and no measurement store), the panel with
// ?perf=1, テスト原稿を作る (confirm → exactly 50,000 chars, saved), 入力面20回
// (20 characters typed through the editor at the 冒頭, every metric row filled),
// 20回計測 (20 more), Ctrl+Z / Ctrl+Y over テスト原稿 is one step, and the recorded
// samples never carry manuscript text.
import assert from "node:assert/strict";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";
import { sleep } from "./helpers/cdp.mjs";

const target = resolveE2eTarget(process.env, "long-document perf panel E2E");
const session = await launchEditorSession("tatespun-perf-panel-");
const { cdp } = session;
const log = (line) => console.log(line);
const DOC_ID = 782016;
const ORIGINAL = "はじめの原稿です。これは計測の前に書いた文章。";

async function readDocFromDb() {
  return cdp.evaluate(`new Promise((resolve, reject) => {
    const open = indexedDB.open("tategaki-editor-db");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const req = open.result.transaction(["documents"]).objectStore("documents").get(${DOC_ID});
      req.onsuccess = () => { resolve(req.result?.content ?? null); open.result.close(); };
      req.onerror = () => reject(req.error);
    };
  })`);
}
async function savedDocWhere(accept, label, timeoutMs = 30_000) {
  let last = null;
  for (const deadline = Date.now() + timeoutMs; Date.now() < deadline; ) {
    last = await readDocFromDb();
    if (last !== null && accept(last)) return last;
    await sleep(300);
  }
  throw new Error(`saved manuscript never satisfied: ${label} (length ${last?.length})`);
}
const clickButton = (label) =>
  cdp.evaluate(`(() => {
    const b = [...document.querySelectorAll('[data-testid="long-document-perf-panel"] button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)});
    if (!b) throw new Error("no button ${label}");
    b.click();
    return true;
  })()`);
async function pressCtrl(key, command) {
  const code = `Key${key.toUpperCase()}`;
  const vk = key.toUpperCase().charCodeAt(0);
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, modifiers: 2, windowsVirtualKeyCode: vk, commands: [command] });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, modifiers: 2, windowsVirtualKeyCode: vk });
  await sleep(300);
}
const status = () => cdp.evaluate(`document.querySelector('[data-testid="long-document-perf-panel"] [role="status"]')?.textContent ?? ""`);
const rows = () =>
  cdp.evaluate(`Object.fromEntries([...document.querySelectorAll('[data-testid="long-document-perf-panel"] tr[data-metric]')].map((tr) => [tr.dataset.metric, Number(tr.children[1].textContent)]))`);

try {
  await session.setViewport(1280, 900);
  await cdp.send("Page.navigate", { url: target.url("/editor") });
  await cdp.waitFor(`/[?&]id=\\d+/.test(location.search) && !!document.querySelector('[data-editor-save-status="saved"]')`, { timeoutMs: 90_000, label: "bootstrap editor" });
  await cdp.evaluate(`new Promise((resolve, reject) => {
    const open = indexedDB.open("tategaki-editor-db");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(["documents"], "readwrite");
      tx.objectStore("documents").put({ id: ${DOC_ID}, title: "perf-panel", content: ${JSON.stringify(ORIGINAL)}, plotNote: "", updatedAt: Date.now() });
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => reject(tx.error);
    };
  })`);

  // ------------------------------------------------ off without ?perf=1
  await cdp.send("Page.navigate", { url: target.url(`/editor?id=${DOC_ID}`) });
  await cdp.waitFor(`!!document.querySelector('[data-editor-save-status="saved"]') && document.querySelector('[data-demo-target="editor"]')?.value.length > 10`, { timeoutMs: 90_000, label: "document open" });
  await sleep(1500);
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-testid="long-document-perf-panel"]')`), false, "no panel without ?perf=1");
  assert.equal(await cdp.evaluate(`window.__TATESPUN_LONG_PERF__ === undefined`), true, "no measurement store without ?perf=1");
  log("ok: hidden without ?perf=1");

  // ------------------------------------------------ on with ?perf=1
  await cdp.send("Page.navigate", { url: target.url(`/editor?id=${DOC_ID}&perf=1`) });
  await cdp.waitFor(`!!document.querySelector('[data-testid="long-document-perf-panel"]') && document.querySelector('[data-demo-target="editor"]')?.value.length > 10`, { timeoutMs: 90_000, label: "panel shown" });
  await sleep(1500);
  const surface = await cdp.evaluate(`document.querySelector('[data-editor-page-navigator]') ? "WINDOWED" : "FULL"`);
  log(`ok: panel shown (surface ${surface})`);

  // テスト原稿を作る: asks first, then replaces the manuscript with exactly 50,000 chars.
  await cdp.evaluate(`window.__confirms = []; window.confirm = (m) => { window.__confirms.push(m); return true; }`);
  await clickButton("テスト原稿を作る");
  await cdp.waitFor(`document.querySelector('[data-testid="long-document-perf-panel"] [role="status"]')?.textContent.includes("50,000字を読み込みました")`, { timeoutMs: 60_000, label: "fixture loaded" });
  assert.equal(await cdp.evaluate(`window.__confirms.length`), 1, "asked before replacing a non-empty manuscript");
  const fixture = await savedDocWhere((t) => t.length === 50_000, "fixture saved", 60_000);
  assert.ok(fixture.startsWith("これはTateSpun長文計測用の本文です。"), "fixture text");
  log("ok: fixture 50,000 chars (asked once, saved)");

  // The fixture is ONE editor edit: Ctrl+Z brings the earlier manuscript back, Ctrl+Y the fixture.
  await cdp.evaluate(`document.querySelector('[data-demo-target="editor"]').focus()`);
  await pressCtrl("z", "undo");
  await savedDocWhere((t) => t === ORIGINAL, "Ctrl+Z restores the manuscript before the fixture");
  await pressCtrl("y", "redo");
  await savedDocWhere((t) => t.length === 50_000, "Ctrl+Y brings the fixture back");
  log("ok: Ctrl+Z / Ctrl+Y over the fixture");

  // 入力面20回 at 冒頭: through the editor's own edit path.
  await clickButton("入力面20回");
  await cdp.waitFor(`document.querySelector('[data-testid="long-document-perf-panel"] [role="status"]')?.textContent.includes("入力面の20回計測が終わりました")`, { timeoutMs: 60_000, label: "surface edits done" });
  const surfaceText = await savedDocWhere((t) => t.length === 50_020, "20 surface edits saved", 60_000);
  assert.equal(surfaceText.slice(0, 21), "こ" + "測定".repeat(10), "20 characters typed after the first character, in order");
  let r = await rows();
  log(`surface rows: ${JSON.stringify(r)}`);
  assert.ok(r.inputToNextFrame >= 20, "every input measured to the next frame");
  assert.ok(r.previewCompose >= 1, "preview compose measured");
  assert.ok(r.inputToPreview >= 1, "input → preview measured");
  if (surface === "WINDOWED") assert.ok(r.editorPagination >= 1, "編集ページ split measured");

  // 20回計測 (direct manuscript edits) at 冒頭.
  await clickButton("20回計測");
  await cdp.waitFor(`document.querySelector('[data-testid="long-document-perf-panel"] [role="status"]')?.textContent.includes("20回の計測が終わりました")`, { timeoutMs: 60_000, label: "direct edits done" });
  await savedDocWhere((t) => t.length === 50_040, "20 direct edits saved", 60_000);
  r = await rows();
  log(`direct rows: ${JSON.stringify(r)}`);
  assert.ok(r.inputToNextFrame >= 20, "direct edits measured");
  assert.ok(r.inputToPreview >= 1, "direct edits reach the preview");

  // Samples carry only numbers (never the manuscript text).
  const keys = await cdp.evaluate(`[...new Set(window.__TATESPUN_LONG_PERF__.samples.flatMap((s) => Object.keys(s)))].sort().join(",")`);
  assert.ok(/^(at|chars|metric|ms|pages)(,(at|chars|metric|ms|pages))*$/.test(keys), `sample fields: ${keys}`);
  const stringy = await cdp.evaluate(`window.__TATESPUN_LONG_PERF__.samples.some((s) => Object.entries(s).some(([k, v]) => k !== "metric" && typeof v === "string"))`);
  assert.equal(stringy, false, "no text in samples");

  // 消去 empties the table.
  await clickButton("消去");
  await sleep(200);
  assert.deepEqual(await rows(), {}, "消去 clears the table");
  assert.equal(await status(), "計測値を消しました");

  // Collapsing keeps only the header.
  await clickButton("たたむ");
  await sleep(100);
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-testid="long-document-perf-panel"] select')`), false, "collapsed");
  log("ok: all checks passed");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await session.close();
}
