// Explicit-run E2E for the WINDOWED final parity decisions
// (docs/TATESPUN_WINDOWED_DEFAULT_READINESS.md), on any build:
//   1. Ctrl/Cmd+A with the editor focused = 全文選択 (WINDOWED; FULL: the
//      native whole-textarea select-all), and every whole-selection edit
//      (type / Enter / Backspace / Delete / paste / IME commit / cut) plus
//      undo / redo / Esc follows it;
//   2. Ctrl+A in the search / replace / title / memo / settings inputs keeps
//      the browser's own field select-all and never touches the manuscript;
//   3. phones (< 768 px): the 編集ページ navigator starts collapsed to one row
//      (←, 編集ページ X / Y, →, 全文を選択, 操作▾), expands / collapses by
//      pointer and keyboard, navigates while collapsed, never overflows;
//      tablet/desktop keep every tool visible and no toggle.
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 [TATESPUN_FINAL_OUT=report.json] \
//   [TATESPUN_FINAL_SHOTS=dir] node tests/e2e/windowedFinalParity.e2e.mjs
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";
import { sleep } from "./helpers/cdp.mjs";

const target = resolveE2eTarget(process.env, "windowed final parity");
const OUT = process.env.TATESPUN_FINAL_OUT;
const SHOTS = process.env.TATESPUN_FINAL_SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const session = await launchEditorSession("tatespun-final-");
const { cdp } = session;
const log = (line) => console.log(line);
const EDITOR = '[data-demo-target="editor"]';
const report = { surface: null, ctrlA: {}, inputs: {}, mobile: {} };

const para = (i) => `　第${i}段落。春の宵、窓辺に置いた硝子の瓶が淡い光を返していた。彼女は古い手紙を読み返し、ふと遠い町のことを思い出す。瑠璃色の空。`;
const LONG = Array.from({ length: 4300 }, (_, i) => para(i + 1)).join("\n"); // ≈300k → WINDOWED 6 編集ページ

async function key(k, code, vk, { modifiers = 0, commands, text } = {}) {
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk, modifiers, ...(commands ? { commands } : {}), ...(text ? { text, unmodifiedText: text } : {}) });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk, modifiers });
}
const ctrlA = () => key("a", "KeyA", 65, { modifiers: 2, commands: ["selectAll"] });
const undo = () => key("z", "KeyZ", 90, { modifiers: 2, commands: ["undo"] });
const redo = () => key("y", "KeyY", 89, { modifiers: 2, commands: ["redo"] });
async function realClick(selector) {
  const point = await cdp.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; el.scrollIntoView({ block: "nearest" }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, disabled: !!el.disabled, w: r.width, h: r.height }; })()`);
  if (!point || point.disabled || point.w === 0) return false;
  for (const t of ["mouseMoved", "mousePressed", "mouseReleased"]) await cdp.send("Input.dispatchMouseEvent", { type: t, x: point.x, y: point.y, button: "left", clickCount: 1 });
  return true;
}
const wholeState = () => cdp.evaluate(`(() => { const b = document.querySelector('[data-editor-select-all]'); return b ? { pressed: b.getAttribute('aria-pressed') === 'true', label: b.textContent.trim() } : null; })()`);

let docId = 784000;
async function openDocument(content) {
  docId++;
  await cdp.evaluate(`new Promise((resolve, reject) => { const o = indexedDB.open("tategaki-editor-db"); o.onerror = () => reject(o.error); o.onsuccess = () => { const tx = o.result.transaction(["documents"], "readwrite"); tx.objectStore("documents").put({ id: ${docId}, title: "最終確認", content: ${JSON.stringify(content)}, plotNote: "", updatedAt: Date.now() }); tx.oncomplete = () => { o.result.close(); resolve(true); }; tx.onerror = () => reject(tx.error); }; })`);
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
async function shot(name) {
  if (!SHOTS) return;
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(SHOTS, `${report.surface.toLowerCase()}-${name}.png`), Buffer.from(data, "base64"));
}

try {
  await session.setViewport(1280, 900);
  await cdp.send("Browser.grantPermissions", { permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"], origin: target.origin }).catch(() => {});
  await cdp.send("Page.navigate", { url: target.url("/editor") });
  await cdp.waitFor(`/[?&]id=\\d+/.test(location.search) && !!document.querySelector('[data-editor-save-status="saved"]')`, { timeoutMs: 90_000, label: "bootstrap" });
  report.surface = await cdp.evaluate(`document.querySelector('[data-editor-page-navigator]') ? "WINDOWED" : "FULL"`);
  const windowed = report.surface === "WINDOWED";
  log(`surface=${report.surface}`);

  // ---- 1. Ctrl+A = whole manuscript -----------------------------------------------------------
  const focusEditorMiddle = async () => {
    await realClick(EDITOR);
    await cdp.evaluate(`(() => { const el = document.querySelector('${EDITOR}'); el.focus(); const at = Math.floor(el.value.length / 2); el.setSelectionRange(at, at); })()`);
  };
  for (const [name, act, expected] of [
    ["type", () => cdp.send("Input.insertText", { text: "X" }), "X"],
    ["enter", () => key("Enter", "Enter", 13, { text: "\r" }), "\n"],
    ["backspace", () => key("Backspace", "Backspace", 8), ""],
    ["delete", () => key("Delete", "Delete", 46), ""],
    ["paste", async () => { await cdp.evaluate(`navigator.clipboard.writeText("丸ごと貼付")`); await key("v", "KeyV", 86, { modifiers: 2, commands: ["paste"] }); }, "丸ごと貼付"],
    ["ime", async () => { await cdp.send("Input.imeSetComposition", { text: "へんかん", selectionStart: 4, selectionEnd: 4 }); await sleep(150); await cdp.send("Input.insertText", { text: "変換" }); }, "変換"],
    ["cut", () => key("x", "KeyX", 88, { modifiers: 2, commands: ["cut"] }), ""],
  ]) {
    const id = await openDocument(LONG);
    await focusEditorMiddle();
    await ctrlA();
    await sleep(300);
    const state = windowed ? await wholeState() : null;
    const sel = await cdp.evaluate(`(() => { const el = document.querySelector('${EDITOR}'); return [el.selectionStart, el.selectionEnd, el.value.length]; })()`);
    if (name === "type") await shot("ctrl-a-whole-selection");
    await act();
    await sleep(500);
    const after = await saved(id);
    await undo();
    await sleep(700);
    const undone = await saved(id);
    await redo();
    await sleep(700);
    const redone = await saved(id);
    const row = { stateAfterCtrlA: state, mountedSelected: sel[0] === 0 && sel[1] === sel[2], result: after === expected, undoRestores: undone === LONG, redoReapplies: redone === expected };
    report.ctrlA[name] = row;
    log(`Ctrl+A → ${name}: ${JSON.stringify(row)}`);
    assert.equal(row.result, true, `Ctrl+A then ${name} replaces the whole manuscript (${JSON.stringify(after?.slice(0, 12))})`);
    assert.equal(row.undoRestores, true, `Ctrl+A then ${name}: one undo restores the manuscript`);
    assert.equal(row.redoReapplies, true, `Ctrl+A then ${name}: redo re-applies it`);
    if (windowed) assert.deepEqual(state, { pressed: true, label: "全文選択中　解除" }, "Ctrl+A shows the same state as the 全文を選択 button");
  }

  if (windowed) {
    // A click inside the selection after ONE Ctrl+A / the 全文を選択 button leaves 全文選択.
    for (const [label, engage] of [["ctrlA", () => ctrlA()], ["button", () => realClick("[data-editor-select-all]")]]) {
      const oneId = await openDocument(LONG);
      await focusEditorMiddle();
      await engage();
      await sleep(300);
      const engaged = (await wholeState()).pressed;
      await realClick(EDITOR);
      await sleep(400);
      const afterClick = await wholeState();
      await cdp.send("Input.insertText", { text: "点" });
      const typed = await saved(oneId);
      report.ctrlA[`clickLeaves_${label}`] = { engaged, afterClickPressed: afterClick.pressed, onlyOneCharAdded: typed.length === LONG.length + 1 };
      log(`click after ${label}: ${JSON.stringify(report.ctrlA[`clickLeaves_${label}`])}`);
      assert.equal(engaged, true, `${label} engages 全文選択`);
      assert.equal(afterClick.pressed, false, `a click after ${label} leaves 全文選択`);
      assert.equal(report.ctrlA[`clickLeaves_${label}`].onlyOneCharAdded, true, `typing after that click (${label}) inserts, never replaces the manuscript`);
    }
    // Esc leaves 全文選択; Ctrl+A twice then a click also leaves it.
    const id = await openDocument(LONG);
    await focusEditorMiddle();
    await ctrlA();
    await sleep(200);
    await key("Escape", "Escape", 27);
    await sleep(200);
    const afterEsc = await wholeState();
    await ctrlA(); await sleep(200); await ctrlA(); await sleep(200);
    const twice = await wholeState();
    await realClick(EDITOR);
    await sleep(300);
    const afterClick = await wholeState();
    await cdp.send("Input.insertText", { text: "点" });
    await sleep(400);
    const typedAfterClick = await saved(id);
    report.ctrlA.escAndStaleGuard = { afterEsc, twice, afterClick, onlyOneCharAdded: typedAfterClick.length === LONG.length + 1 };
    log(`Esc / double Ctrl+A / click: ${JSON.stringify(report.ctrlA.escAndStaleGuard)}`);
    assert.equal(afterEsc.pressed, false, "Esc leaves 全文選択");
    assert.equal(twice.pressed, true, "Ctrl+A twice keeps 全文選択");
    assert.equal(afterClick.pressed, false, "a click after a double Ctrl+A leaves 全文選択");
    assert.equal(report.ctrlA.escAndStaleGuard.onlyOneCharAdded, true, "typing after that click inserts, never replaces the manuscript");
  }

  // ---- 2. Ctrl+A inside other inputs: the field only ------------------------------------------
  const id = await openDocument(LONG);
  const fieldCheck = async (name, selector, value) => {
    const ready = await cdp.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el || el.getBoundingClientRect().width === 0) return false; el.focus(); const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); el.setSelectionRange(1, 1); return true; })()`);
    if (!ready) { report.inputs[name] = { available: false }; log(`input ${name}: not available`); return; }
    await ctrlA();
    await sleep(250);
    const r = await cdp.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); return { focused: document.activeElement === el, start: el.selectionStart, end: el.selectionEnd, length: el.value.length }; })()`);
    const whole = windowed ? await wholeState() : { pressed: false };
    const row = { fieldSelected: r.focused && r.start === 0 && r.end === r.length, editorWholeSelection: whole.pressed };
    report.inputs[name] = row;
    log(`input ${name}: ${JSON.stringify(row)}`);
    assert.equal(row.fieldSelected, true, `Ctrl+A in ${name} selects the field's own text`);
    assert.equal(row.editorWholeSelection, false, `Ctrl+A in ${name} does not engage 全文選択`);
  };
  await fieldCheck("title", '[data-demo-target="title"]', "最終確認タイトル");
  await cdp.evaluate(`document.querySelector('[data-editor-action="replace"]').click()`);
  await sleep(600);
  await fieldCheck("search", "[data-search-input]", "瑠璃色");
  await fieldCheck("replace", "[data-replace-input]", "群青");
  await cdp.evaluate(`document.querySelector('[data-search-action="close"]')?.click()`);
  await sleep(300);
  await cdp.evaluate(`document.querySelector('[data-editor-secondary="memo"]')?.click()`);
  await sleep(500);
  // The memo textarea exists only while editing (its 編集 button).
  await cdp.evaluate(`(() => { const b = [...document.querySelectorAll('[data-inline-memo] button')].find((x) => x.textContent.trim() === '編集'); b?.click(); })()`);
  await sleep(400);
  await fieldCheck("memo", "[data-inline-memo] textarea", "メモの内容");
  await cdp.evaluate(`document.querySelector('[data-inline-memo] button[aria-label="メモを閉じる"]')?.click()`);
  await sleep(300);
  await cdp.evaluate(`document.querySelector('[data-editor-secondary="settings"]')?.click()`);
  await sleep(800);
  const settingsSelector = await cdp.evaluate(`(() => { const all = [...document.querySelectorAll('input[type="text"], input:not([type])')].filter((el) => el.getBoundingClientRect().width > 0 && !el.closest('[data-demo-target]') && el.getAttribute('data-demo-target') !== 'title' && !el.hasAttribute('data-search-input') && !el.hasAttribute('data-replace-input')); if (!all.length) return null; all[0].setAttribute('data-final-settings-input', ''); return '[data-final-settings-input]'; })()`);
  if (settingsSelector) await fieldCheck("settings", settingsSelector, "設定の文字");
  else report.inputs.settings = { available: false };
  await key("Escape", "Escape", 27);
  const untouched = await saved(id);
  report.inputs.manuscriptUnchanged = untouched === LONG;
  assert.equal(report.inputs.manuscriptUnchanged, true, "no input Ctrl+A changed the manuscript");

  // ---- 3. phone navigator ---------------------------------------------------------------------
  const layout = () => cdp.evaluate(`(() => {
    const vis = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' ? { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) } : null; };
    const nav = document.querySelector('[data-editor-page-navigator]');
    const editor = document.querySelector('${EDITOR}');
    const toggle = document.querySelector('[data-editor-page-tools-toggle]');
    const r = editor.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      editorHeight: Math.round(r.height),
      navHeight: nav ? Math.round(nav.getBoundingClientRect().height) : 0,
      toggle: vis('[data-editor-page-tools-toggle]'),
      expanded: toggle ? toggle.getAttribute('aria-expanded') : null,
      prev: vis('button[aria-label="前の編集ページへ移動"]'),
      next: vis('button[aria-label="次の編集ページへ移動"]'),
      indicator: document.querySelector('[data-editor-page-indicator]')?.textContent.trim() ?? null,
      indicatorVisible: !!vis('[data-editor-page-indicator]'),
      selectAll: vis('[data-editor-select-all]'),
      split: vis('[data-editor-force-split]'),
      progress: vis('[data-editor-page-progress]'),
    };
  })()`);
  for (const [w, h] of [[320, 568], [360, 640], [390, 844], [768, 1024]]) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile: w < 768 });
    await openDocument(LONG);
    const initial = await layout();
    const row = { initial };
    await shot(`mobile-${w}-initial`);
    if (windowed && w < 768) {
      assert.equal(initial.expanded, "false", `${w}px: starts collapsed`);
      assert.ok(initial.toggle && initial.prev && initial.next && initial.indicatorVisible && initial.selectAll, `${w}px: ←, X / Y, →, 全文を選択 and the toggle stay in the collapsed row`);
      assert.equal(initial.split, null, `${w}px: ここで区切る is folded while collapsed`);
      for (const [label, box] of [["toggle", initial.toggle], ["prev", initial.prev], ["next", initial.next], ["selectAll", initial.selectAll]]) {
        assert.ok(box.h >= 26 && box.w >= 26, `${w}px: ${label} touch target ${box.w}×${box.h}`);
      }
      // navigate while collapsed
      assert.ok(await realClick('button[aria-label="次の編集ページへ移動"]'), "next while collapsed");
      await sleep(400);
      const afterNext = await layout();
      assert.ok(await realClick('button[aria-label="前の編集ページへ移動"]'), "prev while collapsed");
      await sleep(400);
      const afterPrev = await layout();
      row.navigation = [afterNext.indicator, afterPrev.indicator];
      assert.notEqual(afterNext.indicator, initial.indicator, `${w}px: → works while collapsed`);
      assert.equal(afterPrev.indicator, initial.indicator, `${w}px: ← works while collapsed`);
      // expand by pointer, collapse by keyboard
      await realClick("[data-editor-page-tools-toggle]");
      await sleep(300);
      const expanded = await layout();
      await shot(`mobile-${w}-expanded`);
      row.expanded = expanded;
      assert.equal(expanded.expanded, "true", `${w}px: expands`);
      assert.ok(expanded.split && expanded.progress, `${w}px: expanded shows ここで区切る and the progress line`);
      await cdp.evaluate(`document.querySelector('[data-editor-page-tools-toggle]').focus()`);
      await key("Enter", "Enter", 13, { text: "\r" }); // a real Enter (with its keypress) activates a native button
      await sleep(300);
      const collapsedAgain = await layout();
      row.collapsedByKeyboard = collapsedAgain.expanded === "false" && collapsedAgain.split === null;
      assert.equal(row.collapsedByKeyboard, true, `${w}px: the toggle works from the keyboard`);
      // 全文を選択 while collapsed
      assert.ok(await realClick("[data-editor-select-all]"), `${w}px: 全文を選択 reachable while collapsed`);
      await sleep(300);
      row.selectAllWhileCollapsed = (await wholeState()).pressed;
      assert.equal(row.selectAllWhileCollapsed, true, `${w}px: 全文を選択 engages while collapsed`);
      await shot(`mobile-${w}-whole-selection`);
      await key("Escape", "Escape", 27);
      for (const state of [initial, expanded, collapsedAgain]) assert.equal(state.overflow, false, `${w}px: no horizontal overflow`);
    } else if (windowed) {
      assert.equal(initial.toggle, null, `${w}px (tablet): no toggle`);
      assert.ok(initial.split && initial.progress, `${w}px (tablet): every tool visible as before`);
      assert.equal(initial.overflow, false, `${w}px: no horizontal overflow`);
    }
    // search panel and export menu open without overflow on every width
    await cdp.evaluate(`document.querySelector('[data-editor-action="replace"]').click()`);
    await sleep(600);
    row.searchOverflow = (await layout()).overflow;
    await shot(`mobile-${w}-search`);
    await cdp.evaluate(`document.querySelector('[data-search-action="close"]')?.click()`);
    await sleep(300);
    const exportOpened = await cdp.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /書き出し/.test(x.textContent) && x.getBoundingClientRect().width > 0); if (!b) return false; b.click(); return true; })()`);
    await sleep(500);
    row.exportMenu = { opened: exportOpened, overflow: (await layout()).overflow };
    await key("Escape", "Escape", 27);
    await sleep(200);
    assert.equal(row.searchOverflow, false, `${w}px: search panel does not overflow`);
    assert.equal(row.exportMenu.overflow, false, `${w}px: export menu does not overflow`);
    report.mobile[`${w}x${h}`] = row;
    log(`mobile ${w}x${h}: ${JSON.stringify({ editorHeight: initial.editorHeight, navHeight: initial.navHeight, expandedEditorHeight: row.expanded?.editorHeight ?? null, navigation: row.navigation ?? null, exportOpened })}`);
  }

  if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
  log(`PASS windowed final parity (${report.surface})`);
} finally {
  await session.close();
}
