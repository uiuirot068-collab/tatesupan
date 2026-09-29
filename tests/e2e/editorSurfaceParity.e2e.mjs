// Explicit-run FULL / WINDOWED editor-surface parity probe
// (docs/TATESPUN_FULL_WINDOWED_PARITY_AUDIT.md). Runs the SAME scripted
// operations on whichever surface the build was made with and records, per
// scenario, the canonical manuscript after each step, how many Ctrl+Z / Ctrl+Y
// presses an operation takes, and the saved / restored state. Run it on a FULL
// and a WINDOWED build, then diff the two JSON files with
// scripts/perf/compareSurfaceParity.mjs.
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 TATESPUN_PARITY_OUT=out.json \
//   [TATESPUN_PARITY_ONLY=name,name] node tests/e2e/editorSurfaceParity.e2e.mjs
//
// The canonical text is read from the editor itself: the FULL textarea holds
// the whole manuscript, and every small-document scenario fits in ONE
// 編集ページ, so the WINDOWED textarea holds it too. Multi-page scenarios read
// the saved IndexedDB record (after the autosave settles) instead.
// Asserts only that every scenario ran (each FULL/WINDOWED difference is data
// for the audit, not a failure here), except for data safety invariants that
// must hold on both surfaces (marked `invariant`).
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";
import { sleep } from "./helpers/cdp.mjs";

const target = resolveE2eTarget(process.env, "editor surface parity");
const OUT = process.env.TATESPUN_PARITY_OUT;
const ONLY = new Set((process.env.TATESPUN_PARITY_ONLY ?? "").split(",").filter(Boolean));
const session = await launchEditorSession("tatespun-parity-");
const { cdp } = session;
const log = (line) => console.log(line);
const EDITOR = '[data-demo-target="editor"]';
const SMALL = "　一行目の本文です。\n　二行目の本文です。\n　三行目です。";

let docId = 781000;
const results = { surface: null, scenarios: {} };
const invariants = [];

// ---- primitives -----------------------------------------------------------------------------
const editorValue = () => cdp.evaluate(`document.querySelector('${EDITOR}').value`);
const setCaret = (start, end = start) => cdp.evaluate(`(() => { const el = document.querySelector('${EDITOR}'); el.focus(); el.setSelectionRange(${start}, ${end}); return [el.selectionStart, el.selectionEnd]; })()`);
const selection = () => cdp.evaluate(`(() => { const el = document.querySelector('${EDITOR}'); return [el.selectionStart, el.selectionEnd, document.activeElement === el]; })()`);
async function key(keyName, code, vk, { modifiers = 0, commands, text } = {}) {
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: keyName, code, windowsVirtualKeyCode: vk, modifiers, ...(commands ? { commands } : {}), ...(text ? { text, unmodifiedText: text } : {}) });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: keyName, code, windowsVirtualKeyCode: vk, modifiers });
}
const type = (text) => cdp.send("Input.insertText", { text });
const enter = () => key("Enter", "Enter", 13, { text: "\r" });
const backspace = () => key("Backspace", "Backspace", 8);
const del = () => key("Delete", "Delete", 46);
const undo = () => key("z", "KeyZ", 90, { modifiers: 2, commands: ["undo"] });
const redo = () => key("y", "KeyY", 89, { modifiers: 2, commands: ["redo"] });
const selectAllKey = () => key("a", "KeyA", 65, { modifiers: 2, commands: ["selectAll"] });
const copyKey = () => key("c", "KeyC", 67, { modifiers: 2, commands: ["copy"] });
const cutKey = () => key("x", "KeyX", 88, { modifiers: 2, commands: ["cut"] });
const pasteKey = () => key("v", "KeyV", 86, { modifiers: 2, commands: ["paste"] });
const settle = (ms = 250) => sleep(ms);

async function realClick(selector) {
  const point = await cdp.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    el.scrollIntoView({ block: "nearest" });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, disabled: !!el.disabled };
  })()`);
  if (!point || point.disabled) return false;
  for (const t of ["mouseMoved", "mousePressed", "mouseReleased"]) {
    await cdp.send("Input.dispatchMouseEvent", { type: t, x: point.x, y: point.y, button: "left", clickCount: 1 });
  }
  return true;
}

async function savedContent(id) {
  await cdp.waitFor(`document.querySelector('[data-editor-save-status]')?.getAttribute('data-editor-save-status') === 'saved'`, { timeoutMs: 30_000, label: "saved" });
  return cdp.evaluate(`new Promise((resolve, reject) => {
    const open = indexedDB.open("tategaki-editor-db");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const request = open.result.transaction("documents").objectStore("documents").get(${id});
      request.onsuccess = () => { open.result.close(); resolve(request.result?.content ?? null); };
      request.onerror = () => reject(request.error);
    };
  })`);
}

async function openDocument(content, extra = {}) {
  docId++;
  await cdp.evaluate(`new Promise((resolve, reject) => {
    const open = indexedDB.open("tategaki-editor-db");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(["documents"], "readwrite");
      tx.objectStore("documents").put({ id: ${docId}, title: "parity", content: ${JSON.stringify(content)}, plotNote: "", updatedAt: Date.now(), ...${JSON.stringify(extra)} });
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => reject(tx.error);
    };
  })`);
  await cdp.send("Page.navigate", { url: target.url(`/editor?id=${docId}`) });
  await cdp.waitFor(`!!document.querySelector('[data-editor-save-status="saved"]') && !!document.querySelector('${EDITOR}') && Number(document.querySelector('[data-preview-total-pages]')?.getAttribute('data-preview-total-pages') ?? 0) > 0`, { timeoutMs: 120_000, label: "document open" });
  await sleep(800);
  return docId;
}

/** Presses `press` until the editor text equals `goal` (max `limit`); the number of presses, or null if never. */
async function pressesUntil(press, goal, limit = 12, read = editorValue) {
  for (let n = 1; n <= limit; n++) {
    await press();
    await settle(200);
    if ((await read()) === goal) return n;
  }
  return null;
}

async function scenario(name, run) {
  if (ONLY.size && !ONLY.has(name)) return;
  try {
    results.scenarios[name] = await run();
  } catch (error) {
    results.scenarios[name] = { error: String(error?.message ?? error).slice(0, 300) };
  }
  log(`${name}: ${JSON.stringify(results.scenarios[name])}`);
}

try {
  await session.setViewport(1280, 900);
  await cdp.send("Browser.grantPermissions", { permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"], origin: target.origin }).catch(() => {});
  await cdp.send("Page.navigate", { url: target.url("/editor") });
  await cdp.waitFor(`/[?&]id=\\d+/.test(location.search) && !!document.querySelector('[data-editor-save-status="saved"]')`, { timeoutMs: 90_000, label: "bootstrap editor" });
  results.surface = await cdp.evaluate(`document.querySelector('[data-editor-page-navigator]') ? "WINDOWED" : "FULL"`);
  log(`surface=${results.surface}`);
  const windowed = results.surface === "WINDOWED";

  // ---- A. basic editing + undo/redo granularity --------------------------------------------------
  await scenario("typingBurst", async () => {
    await openDocument(SMALL);
    const before = await editorValue();
    await setCaret(before.length);
    for (const ch of ["あ", "い", "う"]) await type(ch);
    await settle();
    const after = await editorValue();
    const undos = await pressesUntil(undo, before);
    const caretAfterUndo = (await selection()).slice(0, 2);
    const redos = await pressesUntil(redo, after);
    const caretAfterRedo = (await selection()).slice(0, 2);
    return { result: after.slice(-4), undosToOriginal: undos, redosToEdited: redos, caretAfterUndo, caretAfterRedo };
  });

  await scenario("typingRealKeys", async () => {
    // Real key events carrying text (the physical-keyboard path), not IME-style insertText.
    await openDocument(SMALL);
    const before = await editorValue();
    await setCaret(before.length);
    for (const ch of ["a", "b", "c"]) await key(ch, `Key${ch.toUpperCase()}`, ch.toUpperCase().charCodeAt(0), { text: ch });
    await settle();
    const after = await editorValue();
    const undos = await pressesUntil(undo, before);
    const redos = await pressesUntil(redo, after);
    return { result: after.slice(-4), undosToOriginal: undos, redosToEdited: redos };
  });

  await scenario("typingWithPauses", async () => {
    await openDocument(SMALL);
    const before = await editorValue();
    await setCaret(before.length);
    for (const ch of ["か", "き", "く"]) { await type(ch); await sleep(1100); }
    const after = await editorValue();
    const undos = await pressesUntil(undo, before);
    return { result: after.slice(-4), undosToOriginal: undos };
  });

  await scenario("enter", async () => {
    await openDocument(SMALL);
    const before = await editorValue();
    await setCaret(6);
    await enter();
    await settle();
    const after = await editorValue();
    const caret = await selection();
    const undos = await pressesUntil(undo, before);
    const caretAfterUndo = (await selection()).slice(0, 2);
    const redos = await pressesUntil(redo, after);
    return { inserted: after.length - before.length, newlineAt: after.indexOf("\n"), caret: caret.slice(0, 2), undosToOriginal: undos, redosToEdited: redos, caretAfterUndo };
  });

  await scenario("backspace3", async () => {
    await openDocument(SMALL);
    const before = await editorValue();
    await setCaret(10);
    for (let i = 0; i < 3; i++) await backspace();
    await settle();
    const after = await editorValue();
    const undos = await pressesUntil(undo, before);
    return { removed: before.length - after.length, text: after.slice(0, 10), caret: null, undosToOriginal: undos };
  });

  await scenario("delete2", async () => {
    await openDocument(SMALL);
    const before = await editorValue();
    await setCaret(12);
    await del();
    await del();
    await settle();
    const after = await editorValue();
    const undos = await pressesUntil(undo, before);
    return { removed: before.length - after.length, text: after.slice(10, 16), undosToOriginal: undos };
  });

  await scenario("selectionReplaceByTyping", async () => {
    await openDocument(SMALL);
    const before = await editorValue();
    await setCaret(1, 4);
    await type("X");
    await settle();
    const after = await editorValue();
    const undos = await pressesUntil(undo, before);
    return { text: after.slice(0, 8), undosToOriginal: undos };
  });

  await scenario("imeComposition", async () => {
    await openDocument(SMALL);
    const before = await editorValue();
    await setCaret(before.length);
    await cdp.send("Input.imeSetComposition", { text: "かんじ", selectionStart: 3, selectionEnd: 3 });
    await settle(150);
    await cdp.send("Input.imeSetComposition", { text: "漢字", selectionStart: 2, selectionEnd: 2 });
    await settle(150);
    await cdp.send("Input.insertText", { text: "漢字" });
    await settle();
    const after = await editorValue();
    const undos = await pressesUntil(undo, before);
    return { result: after.slice(-4), undosToOriginal: undos };
  });

  // ---- clipboard (a real paste needs the clipboard permission) -----------------------------------
  await scenario("pasteAtCaret", async () => {
    await openDocument(SMALL);
    const before = await editorValue();
    await realClick(EDITOR); // the clipboard API needs a focused document (a real click)
    await setCaret(before.length);
    await cdp.evaluate(`navigator.clipboard.writeText("貼付テキスト")`);
    await pasteKey();
    await settle();
    const after = await editorValue();
    if (after === before) return { supported: false };
    const undos = await pressesUntil(undo, before);
    return { supported: true, result: after.slice(-6), undosToOriginal: undos };
  });

  await scenario("copyCutWithinPage", async () => {
    await openDocument(SMALL);
    const before = await editorValue();
    await setCaret(1, 4);
    await copyKey();
    await settle();
    const copied = await cdp.evaluate(`navigator.clipboard.readText().catch(() => null)`);
    await setCaret(1, 4);
    await cutKey();
    await settle();
    const cut = await cdp.evaluate(`navigator.clipboard.readText().catch(() => null)`);
    const after = await editorValue();
    const undos = await pressesUntil(undo, before);
    return { copied, cut, removed: before.length - after.length, undosToOriginal: undos };
  });

  // ---- select all ------------------------------------------------------------------------------
  const selectWholeManuscript = async () => {
    // FULL: Ctrl+A is the whole manuscript. WINDOWED: the explicit 全文を選択 action.
    if (windowed) {
      assert.ok(await realClick("[data-editor-select-all]"), "全文を選択 exists");
      await settle();
    } else {
      await setCaret(0);
      await selectAllKey();
      await settle();
    }
  };
  for (const [name, act, expectText] of [
    ["wholeSelectionTypeChar", () => type("X"), "X"],
    ["wholeSelectionEnter", () => enter(), "\n"],
    ["wholeSelectionBackspace", () => backspace(), ""],
    ["wholeSelectionPaste", async () => { await cdp.evaluate(`navigator.clipboard.writeText("丸ごと貼付")`); await pasteKey(); }, "丸ごと貼付"],
    ["wholeSelectionIme", async () => { await cdp.send("Input.imeSetComposition", { text: "へんかん", selectionStart: 4, selectionEnd: 4 }); await settle(150); await cdp.send("Input.insertText", { text: "変換" }); }, "変換"],
  ]) {
    await scenario(name, async () => {
      const id = await openDocument(SMALL);
      await setCaret(3);
      await selectWholeManuscript();
      await act();
      await settle(400);
      const saved = await savedContent(id);
      const undos = await pressesUntil(undo, SMALL);
      return { saved, expected: expectText, matchesFullSemantics: saved === expectText, undosToOriginal: undos };
    });
  }

  await scenario("wholeSelectionCopy", async () => {
    await openDocument(SMALL);
    await selectWholeManuscript();
    await copyKey();
    await settle();
    const copied = await cdp.evaluate(`navigator.clipboard.readText().catch(() => null)`);
    return { copiedWhole: copied === SMALL, copiedLength: copied?.length ?? null };
  });

  // ---- structural edits --------------------------------------------------------------------------
  await scenario("pageBreakButton", async () => {
    const id = await openDocument(SMALL);
    const before = await editorValue();
    await setCaret(6);
    assert.ok(await realClick('[data-editor-action="page-break"]'), "改ページ挿入 button");
    await settle(400);
    const after = await editorValue();
    const caret = await selection();
    await setCaret(caret[0]);
    const undos = await pressesUntil(undo, before, 4);
    const buttonUndo = undos === null ? await (async () => { await realClick('[data-editor-action="undo"]'); await settle(300); return (await editorValue()) === before; })() : null;
    return { markerInserted: after.includes("【改ページ】"), caret: caret.slice(0, 2), ctrlZUndosToOriginal: undos, toolbarUndoRestores: buttonUndo, saved: (await savedContent(id)).includes("【改ページ】") ? "has marker" : "no marker" };
  });

  await scenario("toolbarUndoRedo", async () => {
    await openDocument(SMALL);
    const before = await editorValue();
    await setCaret(before.length);
    await type("ボタン");
    await settle();
    const after = await editorValue();
    await realClick('[data-editor-action="undo"]');
    await settle(300);
    const undone = (await editorValue()) === before;
    const caretAfterToolbarUndo = (await selection()).slice(0, 2);
    await realClick('[data-editor-action="redo"]');
    await settle(300);
    const redone = (await editorValue()) === after;
    return { undone, redone, caretAfterToolbarUndo };
  });

  await scenario("writingCheckFix", async () => {
    const withIssue = "　末尾に空白がある行です。　\n　正常な行です。";
    const id = await openDocument(withIssue);
    await sleep(1200);
    if (!(await realClick("[data-desktop-writing-check-pill]"))) return { available: false };
    await settle(500);
    const fixed = await cdp.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('まとめて直す')); if (!b) return false; b.click(); return true; })()`);
    await settle(500);
    const saved = await savedContent(id);
    const fixedOk = saved === "　末尾に空白がある行です。\n　正常な行です。";
    await setCaret(0);
    await undo();
    await settle(300);
    const afterCtrlZ = await editorValue();
    return { bulkFixClicked: fixed, fixedOk, ctrlZAfterFix: afterCtrlZ === withIssue ? "restores" : afterCtrlZ === saved ? "no-op" : "other" };
  });

  // ---- multi-page (WINDOWED: several 編集ページ) -----------------------------------------------------
  const para = (i) => `　第${i}段落の本文です。春の宵、窓辺に置いた硝子の瓶が淡い光を返していた。彼女は古い手紙を読み返し、ふと遠い町のことを思い出す。`;
  const LONG = Array.from({ length: 2600 }, (_, i) => para(i + 1)).join("\n"); // ≈170k chars → WINDOWED 3–4 編集ページ

  await scenario("longCtrlASemantics", async () => {
    const id = await openDocument(LONG);
    await setCaret(5);
    await selectAllKey();
    await settle();
    const [s, e] = await selection();
    const mounted = (await editorValue()).length;
    await type("Z");
    await settle(500);
    const saved = await savedContent(id);
    return { selectedLength: e - s, mountedLength: mounted, manuscriptLength: LONG.length, afterTypingLength: saved.length, replacedWhole: saved === "Z" };
  });

  for (const [name, act, expectText] of [
    ["longWholeSelectionTypeChar", () => type("X"), "X"],
    ["longWholeSelectionEnter", () => enter(), "\n"],
    ["longWholeSelectionPaste", async () => { await cdp.evaluate(`navigator.clipboard.writeText("丸ごと貼付")`); await pasteKey(); }, "丸ごと貼付"],
    ["longWholeSelectionIme", async () => { await cdp.send("Input.imeSetComposition", { text: "へんかん", selectionStart: 4, selectionEnd: 4 }); await settle(150); await cdp.send("Input.insertText", { text: "変換" }); }, "変換"],
    ["longWholeSelectionCut", () => cutKey(), ""],
  ]) {
    await scenario(name, async () => {
      const id = await openDocument(LONG);
      await setCaret(3);
      await selectWholeManuscript();
      await act();
      await settle(500);
      const saved = await savedContent(id);
      await undo();
      await settle(600);
      const undone = await savedContent(id);
      return { savedLength: saved.length, savedHead: saved.slice(0, 8), matchesFullSemantics: saved === expectText, oneUndoRestores: undone === LONG };
    });
  }

  await scenario("longWholeSelectionCopy", async () => {
    await openDocument(LONG);
    await selectWholeManuscript();
    await copyKey();
    await settle();
    const copied = await cdp.evaluate(`navigator.clipboard.readText().catch(() => null)`);
    return { copiedWhole: copied === LONG, copiedLength: copied?.length ?? null, manuscriptLength: LONG.length };
  });

  await scenario("longEndEditAndCrossPageUndo", async () => {
    const id = await openDocument(LONG);
    // Edit at the very start, then at the very end, then undo both (crosses 編集ページ on WINDOWED).
    if (windowed) {
      for (let i = 0; i < 10; i++) { if (!(await realClick('button[aria-label="前の編集ページへ移動"]'))) break; await settle(150); }
    }
    await setCaret(0);
    await type("始");
    await settle(900);
    if (windowed) {
      for (let i = 0; i < 10; i++) { if (!(await realClick('button[aria-label="次の編集ページへ移動"]'))) break; await settle(150); }
    }
    await cdp.evaluate(`(() => { const el = document.querySelector('${EDITOR}'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); })()`);
    await type("終");
    await settle(900);
    const edited = await savedContent(id);
    const bothApplied = edited === "始" + LONG + "終";
    await undo(); await settle(400); await undo(); await settle(600);
    const undone = await savedContent(id);
    return { bothApplied, undoneToOriginal: undone === LONG, undoneLengthDelta: undone.length - LONG.length };
  });

  await scenario("longPageBoundaryBackspace", async () => {
    if (!windowed) return { applicable: "FULL has no 編集ページ boundary; Backspace is ordinary" };
    const id = await openDocument(LONG);
    for (let i = 0; i < 10; i++) { if (!(await realClick('button[aria-label="前の編集ページへ移動"]'))) break; await settle(150); }
    assert.ok(await realClick('button[aria-label="次の編集ページへ移動"]'), "page 2 exists");
    await settle(300);
    await setCaret(0);
    await backspace();
    await settle(600);
    const saved = await savedContent(id);
    const indicator = await cdp.evaluate(`document.querySelector('[data-editor-page-indicator]')?.textContent.trim()`);
    return { removedOneChar: saved.length === LONG.length - 1, indicator };
  });

  // ---- save / restore ---------------------------------------------------------------------------
  await scenario("reloadAfterAutosave", async () => {
    const id = await openDocument(SMALL);
    await setCaret(SMALL.length);
    await type("保存後");
    await sleep(2500);
    await cdp.send("Page.reload");
    await cdp.waitFor(`!!document.querySelector('[data-editor-save-status="saved"]') && !!document.querySelector('${EDITOR}')`, { timeoutMs: 60_000, label: "reloaded" });
    await sleep(800);
    const saved = await savedContent(id);
    const caret = await selection();
    const visible = await editorValue();
    return { restored: saved === SMALL + "保存後", editorShowsRestored: visible.endsWith("保存後"), caretAfterReload: caret.slice(0, 2) };
  });

  await scenario("reloadInsideDebounce", async () => {
    const id = await openDocument(SMALL);
    await setCaret(SMALL.length);
    await type("即時");
    await sleep(200);
    await cdp.send("Page.reload");
    await cdp.waitFor(`!!document.querySelector('[data-editor-save-status="saved"]') && !!document.querySelector('${EDITOR}')`, { timeoutMs: 60_000, label: "reloaded" });
    await sleep(800);
    const saved = await savedContent(id);
    return { restored: saved === SMALL + "即時", savedTail: saved.slice(-4) };
  });

  await scenario("longReopenPosition", async () => {
    const id = await openDocument(LONG);
    const indicator = await cdp.evaluate(`document.querySelector('[data-editor-page-indicator]')?.textContent.trim() ?? "FULL"`);
    const caret = await selection();
    const scroll = await cdp.evaluate(`(() => { const el = document.querySelector('${EDITOR}'); return { scrollTop: Math.round(el.scrollTop), scrollHeight: el.scrollHeight }; })()`);
    return { indicator, caret: caret.slice(0, 2), scroll, docId: id };
  });

  // ---- invariants: nothing but the scenario's own edit ever reaches the manuscript ------------
  for (const [name, value] of Object.entries(results.scenarios)) {
    if (value && value.error) invariants.push(`${name}: ${value.error}`);
  }
  if (OUT) writeFileSync(OUT, JSON.stringify(results, null, 2) + "\n");
  log(`wrote ${OUT ?? "(no TATESPUN_PARITY_OUT)"}`);
  assert.deepEqual(invariants, [], "every scenario ran");
  log(`PASS editor surface parity probe (${results.surface})`);
} finally {
  await session.close();
}
