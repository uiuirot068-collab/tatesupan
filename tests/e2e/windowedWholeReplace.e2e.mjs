// Explicit-run E2E: a WINDOWED 全文選択 (Ctrl/Cmd+A or the 全文を選択 button)
// followed by ANY edit replaces the WHOLE canonical manuscript as ONE
// transaction, on a ~300k-character manuscript (6 編集ページ):
//   - typed key(s) through real keyDown events (not only Input.insertText),
//     Enter, Backspace, Delete, paste, cut, and an IME composition driven like
//     a real IME (keyCode 229 keyDowns, several compositionupdates, commit);
//   - `model-*` rows additionally model an IME/TSF that narrows the native
//     selection before compositionstart, cancels the composition, delivers
//     the IME key's keyup before compositionstart, or never delivers
//     compositionend -- automation models of the real-OS failure, never a
//     substitute for the real-OS Human QA;
//   - each whole row also checks that 全文選択 can be entered again afterwards;
//   - `range-*` rows: an ordinary ~30k in-page selection (no 全文選択) replaced
//     by an IME composition (normal / compositionend lost): exact result, one
//     undo, one redo -- the page is never re-sliced under the IME;
//   - each row checks: exact saved text (no old text left), 編集ページ count,
//     Preview page count, one undo = the exact original, one redo = the exact
//     replacement, reload = the saved text, and the time each step takes.
// Surfaces without the 編集ページ navigator (FULL) are reported and skipped.
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 [TATESPUN_WHOLE_OUT=report.json] \
//   [TATESPUN_WHOLE_ONLY=type,ime] node tests/e2e/windowedWholeReplace.e2e.mjs
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";
import { sleep } from "./helpers/cdp.mjs";

const target = resolveE2eTarget(process.env, "windowed whole replace");
const OUT = process.env.TATESPUN_WHOLE_OUT;
const ONLY = process.env.TATESPUN_WHOLE_ONLY ? new Set(process.env.TATESPUN_WHOLE_ONLY.split(",")) : null;
const session = await launchEditorSession("tatespun-whole-");
const { cdp } = session;
const log = (line) => console.log(line);
const EDITOR = '[data-demo-target="editor"]';
const report = { surface: null, rows: {} };

const para = (i) => `　第${i}段落。春の宵、窓辺に置いた硝子の瓶が淡い光を返していた。彼女は古い手紙を読み返し、ふと遠い町のことを思い出す。瑠璃色の空。`;
const LONG = Array.from({ length: 4300 }, (_, i) => para(i + 1)).join("\n"); // ≈300k → 6 編集ページ

async function key(k, code, vk, { modifiers = 0, commands, text } = {}) {
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk, modifiers, ...(commands ? { commands } : {}), ...(text ? { text, unmodifiedText: text } : {}) });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk, modifiers });
}
const typeChar = (ch) => key(ch, `Key${ch.toUpperCase()}`, ch.toUpperCase().charCodeAt(0), { text: ch });
const ctrlA = () => key("a", "KeyA", 65, { modifiers: 2, commands: ["selectAll"] });
const undo = () => key("z", "KeyZ", 90, { modifiers: 2, commands: ["undo"] });
const redo = () => key("y", "KeyY", 89, { modifiers: 2, commands: ["redo"] });
async function realClick(selector) {
  const point = await cdp.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; el.scrollIntoView({ block: "nearest" }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, disabled: !!el.disabled, w: r.width }; })()`);
  if (!point || point.disabled || point.w === 0) return false;
  for (const t of ["mouseMoved", "mousePressed", "mouseReleased"]) await cdp.send("Input.dispatchMouseEvent", { type: t, x: point.x, y: point.y, button: "left", clickCount: 1 });
  return true;
}
// An IME keystroke as Chrome delivers it: keyDown with keyCode 229 ("Process"), then the IME's composition update.
async function imeKey(code, composition) {
  await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Process", code, windowsVirtualKeyCode: 229 });
  await cdp.send("Input.imeSetComposition", { text: composition, selectionStart: composition.length, selectionEnd: composition.length });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Process", code, windowsVirtualKeyCode: 229 });
}
async function imeCommit(text) {
  await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Process", code: "Enter", windowsVirtualKeyCode: 229 });
  await cdp.send("Input.insertText", { text });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
}
const frame = () => cdp.evaluate(`new Promise((resolve) => requestAnimationFrame(() => setTimeout(() => resolve(true), 0)))`);
const editorState = () => cdp.evaluate(`(() => { const el = document.querySelector('${EDITOR}'); const b = document.querySelector('[data-editor-select-all]'); return { value: el.value, length: el.value.length, start: el.selectionStart, end: el.selectionEnd, indicator: document.querySelector('[data-editor-page-indicator]')?.textContent.trim() ?? null, whole: b?.getAttribute('aria-pressed') === 'true', previewPages: Number(document.querySelector('[data-preview-total-pages]')?.getAttribute('data-preview-total-pages') ?? 0) }; })()`);
async function timed(fn) {
  const t0 = performance.now();
  await fn();
  await frame();
  return Math.round(performance.now() - t0);
}

let docId = 786000;
async function openDocument(content) {
  docId++;
  await cdp.evaluate(`new Promise((resolve, reject) => { const o = indexedDB.open("tategaki-editor-db"); o.onerror = () => reject(o.error); o.onsuccess = () => { const tx = o.result.transaction(["documents"], "readwrite"); tx.objectStore("documents").put({ id: ${docId}, title: "全文置換", content: ${JSON.stringify(content)}, plotNote: "", updatedAt: Date.now() }); tx.oncomplete = () => { o.result.close(); resolve(true); }; tx.onerror = () => reject(tx.error); }; })`);
  await cdp.send("Page.navigate", { url: target.url(`/editor?id=${docId}`) });
  await cdp.waitFor(`!!document.querySelector('[data-editor-save-status="saved"]') && !!document.querySelector('${EDITOR}') && Number(document.querySelector('[data-preview-total-pages]')?.getAttribute('data-preview-total-pages') ?? 0) > 0`, { timeoutMs: 180_000, label: "open" });
  await sleep(1200);
  return docId;
}
async function saved(id) {
  await sleep(600);
  await cdp.waitFor(`document.querySelector('[data-editor-save-status]')?.getAttribute('data-editor-save-status') === 'saved'`, { timeoutMs: 30_000, label: "saved" });
  return cdp.evaluate(`new Promise((resolve, reject) => { const o = indexedDB.open("tategaki-editor-db"); o.onsuccess = () => { const r = o.result.transaction("documents").objectStore("documents").get(${id}); r.onsuccess = () => { o.result.close(); resolve(r.result?.content ?? null); }; r.onerror = () => reject(r.error); }; })`);
}
const previewSettled = (predicate) =>
  cdp.waitFor(`(() => { const n = Number(document.querySelector('[data-preview-total-pages]')?.getAttribute('data-preview-total-pages') ?? 0); return ${predicate}; })()`, { timeoutMs: 120_000, label: `preview ${predicate}` }).then(() => true, () => false);
const leftover = (text, expected) => (text === null ? -1 : Math.max(0, text.length - expected.length));

// [name, action, expected manuscript]
const SCENARIOS = [
  ["type", () => typeChar("d"), "d"],
  ["type3", async () => { await typeChar("a"); await typeChar("b"); await typeChar("c"); }, "abc"],
  ["enter", () => key("Enter", "Enter", 13, { text: "\r" }), "\n"],
  ["backspace", () => key("Backspace", "Backspace", 8), ""],
  ["delete", () => key("Delete", "Delete", 46), ""],
  ["paste", async () => { await cdp.evaluate(`navigator.clipboard.writeText("丸ごと貼付")`); await key("v", "KeyV", 86, { modifiers: 2, commands: ["paste"] }); }, "丸ごと貼付"],
  ["cut", () => key("x", "KeyX", 88, { modifiers: 2, commands: ["cut"] }), ""],
  ["ime", async () => { await imeKey("KeyD", "ｄ"); await imeKey("KeyE", "で"); await imeKey("KeyN", "でn"); await imeKey("KeyW", "でんw"); await imeKey("KeyA", "でんわ"); await imeKey("Space", "電話"); await imeCommit("電話"); }, "電話"],
  ["ime-single", async () => { await imeKey("KeyD", "ｄ"); await imeCommit("ｄ"); }, "ｄ"],
  // Models of an IME/TSF acting on the native selection itself (see the header).
  ["model-narrowed", async () => {
    await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Process", code: "KeyD", windowsVirtualKeyCode: 229 });
    await cdp.evaluate(`(() => { const el = document.querySelector('${EDITOR}'); el.setSelectionRange(Math.floor(el.value.length * 0.2), el.value.length); })()`);
    await cdp.send("Input.imeSetComposition", { text: "ｄ", selectionStart: 1, selectionEnd: 1 });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Process", code: "KeyD", windowsVirtualKeyCode: 229 });
    await imeCommit("で");
  }, "で"],
  ["model-cancel", async () => {
    await imeKey("KeyD", "ｄ");
    await imeKey("Escape", ""); // an empty composition update: the IME's cancel
  }, null /* unchanged */],
  // A real-OS order: the IME key's keyup arrives BEFORE compositionstart, and
  // the IME has already collapsed the native selection (its selectionchange
  // lands in between). 全文選択 must survive both.
  ["model-keyup-first", async () => {
    await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Process", code: "KeyD", windowsVirtualKeyCode: 229 });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "d", code: "KeyD", windowsVirtualKeyCode: 68 });
    await cdp.evaluate(`(() => { const el = document.querySelector('${EDITOR}'); el.setSelectionRange(el.value.length, el.value.length); })()`);
    await sleep(120);
    await cdp.send("Input.imeSetComposition", { text: "ｄ", selectionStart: 1, selectionEnd: 1 });
    await imeKey("KeyE", "で");
    await imeCommit("で");
  }, "で"],
  // compositionend never reaches the editor (Blink can drop a composition
  // without it). The next ordinary key must finish the transaction with the
  // IME's text -- not leave the editor "composing" with Ctrl+A / 全文を選択 /
  // Ctrl+Z dead (the real-OS Human-QA symptom).
  ["model-lost-compositionend", async () => {
    await cdp.evaluate(`window.addEventListener("compositionend", (e) => e.stopImmediatePropagation(), { capture: true, once: true })`);
    await imeKey("KeyD", "ｄ");
    await imeKey("Space", "電話");
    await imeCommit("電話");
    await key("Shift", "ShiftLeft", 16);
  }, "電話"],
];

// An ordinary in-page selection (no 全文選択) of ~30k characters replaced by
// an IME: the page must not be re-sliced under the IME; ONE commit, ONE undo.
const RANGE_START = 10_000;
const RANGE_END = 40_000;

try {
  await session.setViewport(1280, 900);
  await cdp.send("Browser.grantPermissions", { permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"], origin: target.origin }).catch(() => {});
  await cdp.send("Page.navigate", { url: target.url("/editor") });
  await cdp.waitFor(`/[?&]id=\\d+/.test(location.search) && !!document.querySelector('[data-editor-save-status="saved"]')`, { timeoutMs: 90_000, label: "bootstrap" });
  report.surface = await cdp.evaluate(`document.querySelector('[data-editor-page-navigator]') ? "WINDOWED" : "FULL"`);
  log(`surface=${report.surface}`);
  if (report.surface !== "WINDOWED") {
    log("SKIP: not a WINDOWED build");
  } else {
    const failures = [];
    for (const via of ["ctrlA", "button"]) {
      for (const [name, act, expectedRaw] of SCENARIOS) {
        const rowName = `${via}:${name}`;
        if (ONLY && !ONLY.has(name) && !ONLY.has(rowName)) continue;
        const expected = expectedRaw ?? LONG;
        const id = await openDocument(LONG);
        const opened = await editorState();
        await realClick(EDITOR);
        await cdp.evaluate(`(() => { const el = document.querySelector('${EDITOR}'); el.focus(); const at = Math.floor(el.value.length / 2); el.setSelectionRange(at, at); })()`);
        if (via === "ctrlA") await ctrlA();
        else await realClick("[data-editor-select-all]");
        await sleep(300);
        const selected = await editorState();
        const row = { engaged: selected.whole && selected.start === 0 && selected.end === selected.length, pagesBefore: opened.indicator, previewBefore: opened.previewPages };
        row.actMs = await timed(act);
        const shown = await editorState();
        // A canceled composition leaves 全文選択 (and its full-page selection) as it was.
    row.editorShowsExpected = expectedRaw === null ? shown.whole && shown.start === 0 && shown.end === shown.length : shown.value === expected;
        row.pagesAfter = shown.indicator;
        const after = await saved(id);
        row.savedExact = after === expected;
        row.oldTextLeft = leftover(after, expected);
        if (expectedRaw !== null) row.previewUpdated = await previewSettled(`n > 0 && n < ${opened.previewPages}`);
        row.undoMs = await timed(undo);
        const undoneShown = await editorState();
        const undone = await saved(id);
        row.undoExact = expectedRaw === null ? undone === LONG : undone === LONG;
        row.pagesAfterUndo = undoneShown.indicator;
        if (expectedRaw !== null) row.previewRestored = await previewSettled(`n === ${opened.previewPages}`);
        // 全文選択 stays usable after the edit and its undo (it used to stay dead).
        // A canceled composition keeps it on: leave it first (the button toggles).
        if ((await editorState()).whole) {
          await key("Escape", "Escape", 27);
          await sleep(100);
        }
        if (via === "ctrlA") await ctrlA();
        else await realClick("[data-editor-select-all]");
        await sleep(200);
        const reselected = await editorState();
        row.reselectWorks = reselected.whole && reselected.start === 0 && reselected.end === reselected.length;
        await key("Escape", "Escape", 27);
        row.redoMs = await timed(redo);
        const redone = await saved(id);
        row.redoExact = redone === expected;
        await cdp.send("Page.navigate", { url: target.url(`/editor?id=${id}`) });
        await cdp.waitFor(`!!document.querySelector('[data-editor-save-status="saved"]') && !!document.querySelector('${EDITOR}')`, { timeoutMs: 180_000, label: "reload" });
        await sleep(800);
        const reloaded = await saved(id);
        const reloadedShown = await editorState();
        row.reloadExact = reloaded === expected && (expected.length > 60_000 || reloadedShown.value === expected);
        report.rows[rowName] = row;
        log(`${rowName}: ${JSON.stringify(row)}`);
        const ok = row.engaged && row.editorShowsExpected && row.savedExact && row.undoExact && row.reselectWorks && row.redoExact && row.reloadExact && row.previewUpdated !== false && row.previewRestored !== false;
        if (!ok) failures.push(rowName);
      }
    }
    const RANGE_SCENARIOS = [
      ["range-ime", async () => { await imeKey("KeyD", "ｄ"); await imeKey("KeyE", "で"); await imeKey("KeyN", "でn"); await imeKey("KeyW", "でんw"); await imeKey("KeyA", "でんわ"); await imeKey("Space", "電話"); await imeCommit("電話"); }, "電話"],
      ["range-ime-lost-end", async () => {
        await cdp.evaluate(`window.addEventListener("compositionend", (e) => e.stopImmediatePropagation(), { capture: true, once: true })`);
        await imeKey("KeyD", "ｄ");
        await imeKey("Space", "電話");
        await imeCommit("電話");
        await key("Shift", "ShiftLeft", 16);
      }, "電話"],
    ];
    for (const [name, act, typed] of RANGE_SCENARIOS) {
      if (ONLY && !ONLY.has(name)) continue;
      const id = await openDocument(LONG);
      await realClick(EDITOR);
      const pageText = (await editorState()).value;
      const pageStart = LONG.indexOf(pageText);
      await cdp.evaluate(`(() => { const el = document.querySelector('${EDITOR}'); el.focus(); el.setSelectionRange(${RANGE_START}, ${RANGE_END}); })()`);
      await sleep(300);
      const selected = await editorState();
      const expected = LONG.slice(0, pageStart + RANGE_START) + typed + LONG.slice(pageStart + RANGE_END);
      const row = { engaged: pageStart >= 0 && !selected.whole && selected.start === RANGE_START && selected.end === RANGE_END, pagesBefore: selected.indicator };
      row.actMs = await timed(act);
      const shown = await editorState();
      row.editorShowsTyped = shown.value.includes(typed) && !shown.whole;
      row.pagesAfter = shown.indicator;
      const after = await saved(id);
      row.savedExact = after === expected;
      row.lengthDelta = after === null ? null : after.length - expected.length;
      row.undoMs = await timed(undo);
      row.undoExact = (await saved(id)) === LONG;
      row.redoMs = await timed(redo);
      row.redoExact = (await saved(id)) === expected;
      await ctrlA();
      await sleep(200);
      const reselected = await editorState();
      row.reselectWorks = reselected.whole && reselected.start === 0 && reselected.end === reselected.length;
      report.rows[name] = row;
      log(`${name}: ${JSON.stringify(row)}`);
      if (!(row.engaged && row.editorShowsTyped && row.savedExact && row.undoExact && row.redoExact && row.reselectWorks)) failures.push(name);
    }
    if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
    assert.deepEqual(failures, [], `whole-manuscript replacement rows failed: ${failures.join(", ")}`);
    log("PASS windowed whole replace");
  }
} finally {
  if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
  await session.close();
}
