// Explicit-run E2E for Phase 9: long-document flows on the editor surface the
// build was made with (run it on a WINDOWED build to cover the paged editor:
// NEXT_PUBLIC_TATESPUN_EDITOR_SURFACE=WINDOWED; on FULL the WINDOWED-only
// steps are reported as skipped).
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 node tests/e2e/windowedLongDocument.e2e.mjs
//
// Seeds two local documents (A ≈ 3 編集ページ, B ≈ 2) in a disposable profile.
//
// FLOW 1 document switch A → B → A inside the autosave debounce, through the
//        route (history.pushState ?id=, the same useSearchParams change as
//        router.push: the editor and Preview stay mounted):
//        - each document's typing is flushed to its own record, never the other's;
//        - the editor shows the new document (the paged editor re-anchors at
//          the previous caret offset clamped to it);
//        - the Preview shows the new document's page count, and its first layout
//          after the switch is a FULL snapshot (never a delta against the
//          previous document).
// FLOW 2 paste larger than one 編集ページ (~70k characters) into the middle of A
//        through the browser's native paste command: saved = A with exactly that
//        text at the caret; 編集ページ count grows; one Ctrl+Z removes it all.
// FLOW 3 「全文を選択」 → copy puts the WHOLE canonical manuscript on the
//        clipboard event (the mounted page is only one slice).
// FLOW 4 置換 dialog 次へ: a word that only exists on the last 編集ページ is
//        found and selected from the first 編集ページ (browser find cannot see
//        unmounted pages).
import assert from "node:assert/strict";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";
import { sleep } from "./helpers/cdp.mjs";

const target = resolveE2eTarget(process.env, "windowed long document E2E");
const session = await launchEditorSession("tatespun-windowed-long-");
const { cdp } = session;
const log = (line) => console.log(line);

await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
  source: `(() => {
    const perf = window.__tspWin = { replies: [] };
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(url, options);
        this.addEventListener("message", (event) => {
          const data = event.data;
          if (data && data.type === "complete" && "layout" in data) {
            perf.replies.push({ t: performance.now(), kind: data.preview?.kind ?? "legacy-full", pages: data.layout.pageSequence.length });
          }
        });
      }
    };
  })();`,
});

function manuscript(tag, chars) {
  const parts = [];
  let length = 0;
  for (let i = 0; length < chars; i++) {
    const para = `　${tag}の段落${i}。春の宵、窓辺に置いた硝子の瓶が淡い光を返していた。彼女は古い手紙を読み返し、ふと遠い町のことを思い出す。`;
    parts.push(para);
    length += para.length + 1;
  }
  return parts.join("\n");
}
const DOC_A = { id: 779001, content: `${manuscript("甲", 130_000)}\n　終わりに近い頁にだけある言葉、瑠璃色。` };
const DOC_B = { id: 779002, content: manuscript("乙", 70_000) };

const surfaceIsWindowed = () => cdp.evaluate(`!!document.querySelector('[data-editor-page-navigator]')`);
const indicator = () => cdp.evaluate(`document.querySelector('[data-editor-page-indicator]')?.textContent.trim() ?? null`);
const editorValue = () => cdp.evaluate(`document.querySelector('[data-demo-target="editor"]').value`);
const previewPages = () => cdp.evaluate(`Number(document.querySelector('[data-preview-total-pages]')?.getAttribute('data-preview-total-pages') ?? -1)`);
const replies = () => cdp.evaluate(`window.__tspWin.replies.slice()`);

async function saved(id) {
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
async function waitSaved() {
  await sleep(2500);
  await cdp.waitFor(`!!document.querySelector('[data-editor-save-status="saved"]')`, { timeoutMs: 60_000, label: "saved" });
}
async function waitForLayoutAfter(count) {
  await cdp.waitFor(`window.__tspWin.replies.length > ${count}`, { timeoutMs: 120_000, label: "Preview layout" });
}
/** Appends `text` at the end of the mounted page through the textarea's native input path. */
async function typeAtMountedEnd(text) {
  await cdp.evaluate(`(() => {
    const el = document.querySelector('[data-demo-target="editor"]');
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  })()`);
  await cdp.send("Input.insertText", { text });
}
async function goToLastEditorPage() {
  for (let i = 0; i < 20; i++) {
    const moved = await cdp.evaluate(`(() => { const b = document.querySelector('button[aria-label="次の編集ページへ移動"]'); if (!b || b.disabled) return false; b.click(); return true; })()`);
    if (!moved) return;
    await sleep(300);
  }
}
/** Route-driven switch that keeps the editor mounted (App Router syncs pushState with useSearchParams). */
async function switchTo(id, tag, otherTag) {
  await cdp.evaluate(`history.pushState(null, "", "/editor?id=${id}")`);
  try {
    await cdp.waitFor(
      `(() => { const v = document.querySelector('[data-demo-target="editor"]')?.value ?? ""; return v.includes(${JSON.stringify(tag)}) && !v.includes(${JSON.stringify(otherTag)}) && !!document.querySelector('[data-editor-save-status="saved"]'); })()`,
      { timeoutMs: 90_000, label: `document ${id} shown` }
    );
  } catch (error) {
    const state = await cdp.evaluate(`JSON.stringify({ url: location.href, editorStart: document.querySelector('[data-demo-target="editor"]')?.value.slice(0, 40), indicator: document.querySelector('[data-editor-page-indicator]')?.textContent, save: document.querySelector('[data-editor-save-status]')?.getAttribute('data-editor-save-status') })`);
    throw new Error(`${error.message}; state=${state}`);
  }
}

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
      for (const doc of ${JSON.stringify([DOC_A, DOC_B])}) tx.objectStore("documents").put({ ...doc, title: "doc" + doc.id, plotNote: "", updatedAt: Date.now() });
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => reject(tx.error);
    };
  })`);

  // Measure B's Preview page count on its own first, then open A.
  await cdp.send("Page.navigate", { url: target.url(`/editor?id=${DOC_B.id}`) });
  await cdp.waitFor(`window.__tspWin.replies.length >= 1 && !!document.querySelector('[data-editor-save-status="saved"]')`, { timeoutMs: 120_000, label: "B first layout" });
  await sleep(1500);
  const pagesB = await previewPages();
  await cdp.send("Page.navigate", { url: target.url(`/editor?id=${DOC_A.id}`) });
  await cdp.waitFor(`window.__tspWin.replies.length >= 1 && !!document.querySelector('[data-editor-save-status="saved"]')`, { timeoutMs: 120_000, label: "A first layout" });
  await sleep(1500);
  const pagesA = await previewPages();
  const windowed = await surfaceIsWindowed();
  log(`surface=${windowed ? "WINDOWED" : "FULL"}; A: ${DOC_A.content.length} chars, ${pagesA} Preview pages, 編集ページ ${await indicator()}; B: ${DOC_B.content.length} chars, ${pagesB} Preview pages`);
  assert.notEqual(pagesA, pagesB, "fixture: the two documents paginate differently");

  // ---- FLOW 1: document switch A → B → A --------------------------------
  if (windowed) await goToLastEditorPage();
  await typeAtMountedEnd("甲追記");
  let before = (await replies()).length;
  await switchTo(DOC_B.id, "乙の段落", "甲の段落"); // inside the 1.5 s autosave debounce
  // The paged editor re-anchors at the previous caret offset clamped to the
  // new document (FULL likewise leaves the caret at the end of the new value).
  const indicatorAfterSwitch = windowed ? await indicator() : null;
  if (windowed) assert.match(indicatorAfterSwitch, /\d+\s*\/\s*2$/, "the navigator shows B's 編集ページ count");
  await waitForLayoutAfter(before);
  await cdp.waitFor(`Number(document.querySelector('[data-preview-total-pages]')?.getAttribute('data-preview-total-pages')) === ${pagesB}`, { timeoutMs: 60_000, label: "Preview shows B" });
  const switchReplyB = (await replies())[before];
  assert.notEqual(switchReplyB.kind, "delta", "the first layout after a document switch is a full Preview snapshot");
  assert.equal(await saved(DOC_A.id), `${DOC_A.content}甲追記`, "A's typing was flushed to A on the switch");

  await typeAtMountedEnd("乙追記");
  before = (await replies()).length;
  await switchTo(DOC_A.id, "甲の段落", "乙の段落");
  await waitForLayoutAfter(before);
  await cdp.waitFor(`Number(document.querySelector('[data-preview-total-pages]')?.getAttribute('data-preview-total-pages')) === ${pagesA}`, { timeoutMs: 60_000, label: "Preview shows A again" });
  assert.notEqual((await replies())[before].kind, "delta", "switching back is a full snapshot too");
  assert.ok((await saved(DOC_B.id)).startsWith(DOC_B.content) && (await saved(DOC_B.id)).includes("乙追記"), "B's typing was flushed to B");
  assert.ok(!(await saved(DOC_A.id)).includes("乙"), "B's text never reached A");
  assert.ok(!(await saved(DOC_B.id)).includes("甲追記"), "A's text never reached B");
  // A later edit in A is a delta again (same document).
  before = (await replies()).length;
  await typeAtMountedEnd("。");
  await waitForLayoutAfter(before);
  const sameDocReply = (await replies())[before];
  log(`FLOW 1 document switch: PASS (B shown at ${indicatorAfterSwitch}; switch replies: ${switchReplyB.kind}; next same-document edit: ${sameDocReply.kind})`);
  await waitSaved();
  const aBeforePaste = await saved(DOC_A.id);

  // ---- FLOW 2: paste larger than one 編集ページ ---------------------------
  const PASTE = "貼付文。".repeat(17_500); // 70,000 characters (> 55k hard page maximum)
  const pagesBefore = windowed ? await indicator() : null;
  // Put PASTE on the clipboard with the browser's own copy command, then paste natively.
  await cdp.evaluate(`(() => {
    const t = document.createElement('textarea');
    t.id = 'e2e-clipboard-source';
    t.value = ${JSON.stringify(PASTE)};
    document.body.appendChild(t);
    t.focus();
    t.select();
  })()`);
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "c", code: "KeyC", modifiers: 2, commands: ["copy"] });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "c", code: "KeyC", modifiers: 2 });
  await cdp.evaluate(`document.getElementById('e2e-clipboard-source').remove()`);
  const caretLocal = await cdp.evaluate(`(() => {
    const el = document.querySelector('[data-demo-target="editor"]');
    const at = Math.floor(el.value.length / 2);
    el.focus();
    el.setSelectionRange(at, at);
    return at;
  })()`);
  const valueBefore = await editorValue();
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "v", code: "KeyV", modifiers: 2, commands: ["paste"] });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "v", code: "KeyV", modifiers: 2 });
  await sleep(500);
  let pasteMethod = "native paste";
  if ((await editorValue()) === valueBefore) {
    // Headless builds without a clipboard: the same native editing path an IME commit takes.
    pasteMethod = "Input.insertText (no headless clipboard)";
    await cdp.send("Input.insertText", { text: PASTE });
  }
  await waitSaved();
  const aAfterPaste = await saved(DOC_A.id);
  const pasteAt = aAfterPaste.indexOf(PASTE);
  assert.ok(pasteAt > 0, "the pasted text is in the saved manuscript");
  assert.equal(aAfterPaste.slice(0, pasteAt) + aAfterPaste.slice(pasteAt + PASTE.length), aBeforePaste, "saved = before + exactly the paste");
  assert.equal(aAfterPaste.length, aBeforePaste.length + PASTE.length);
  const pagesAfter = windowed ? await indicator() : null;
  log(`  paste (${pasteMethod}) at local offset ${caretLocal}: 編集ページ ${pagesBefore} → ${pagesAfter}`);
  if (windowed) {
    const total = (text) => Number(/\/\s*(\d+)/.exec(text)?.[1] ?? 0);
    assert.ok(total(pagesAfter) > total(pagesBefore), "the paste added 編集ページ (boundaries recomputed)");
  }
  // One undo removes the whole paste.
  await cdp.evaluate(`document.querySelector('[data-demo-target="editor"]').focus()`);
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "z", code: "KeyZ", modifiers: 2, commands: ["undo"] });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "z", code: "KeyZ", modifiers: 2 });
  await waitSaved();
  assert.equal(await saved(DOC_A.id), aBeforePaste, "one Ctrl+Z removes the entire paste");
  log("FLOW 2 large paste + undo: PASS");

  // ---- FLOW 3: 全文を選択 → copy -----------------------------------------
  if (windowed) {
    const current = await saved(DOC_A.id);
    const clicked = await cdp.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '全文を選択'); if (!b) return false; b.click(); return true; })()`);
    assert.ok(clicked, "全文を選択 button");
    const copied = await cdp.evaluate(`(() => {
      const el = document.querySelector('[data-demo-target="editor"]');
      const data = new DataTransfer();
      el.dispatchEvent(new ClipboardEvent('copy', { clipboardData: data, bubbles: true, cancelable: true }));
      return { text: data.getData('text/plain'), mounted: el.value.length };
    })()`);
    assert.equal(copied.text, current, "copy after 全文を選択 carries the whole canonical manuscript");
    assert.ok(copied.mounted < current.length, "fixture: the mounted page is only a slice");
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape" });
    log(`FLOW 3 全文を選択 copy: PASS (${copied.text.length} chars copied, ${copied.mounted} mounted)`);
  } else {
    log("FLOW 3 全文を選択 copy: SKIPPED (FULL surface: native select-all covers the whole manuscript)");
  }

  // ---- FLOW 4: 置換 dialog 次へ across 編集ページ ----------------------------
  if (windowed) {
    await cdp.evaluate(`(() => { const b = document.querySelector('button[aria-label="前の編集ページへ移動"]'); for (let i = 0; i < 20 && b && !b.disabled; i++) b.click(); })()`);
    await sleep(500);
  }
  const indicatorBeforeFind = windowed ? await indicator() : null;
  assert.ok(!(await editorValue()).includes("瑠璃色") || !windowed, "fixture: the word is not on the mounted page");
  await cdp.evaluate(`document.querySelector('[data-editor-action="replace"]').click()`);
  await cdp.waitFor(`!!document.querySelector('[data-search-step="next"]')`, { label: "search dialog" });
  await cdp.evaluate(`(() => {
    const input = document.querySelector('input[placeholder="例: 山田"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '瑠璃色');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await cdp.waitFor(`document.querySelector('[data-search-match-status]')?.textContent.includes('1 件')`, { label: "1 match" });
  await cdp.evaluate(`document.querySelector('[data-search-step="next"]').click()`);
  await sleep(800);
  const found = await cdp.evaluate(`(() => { const el = document.querySelector('[data-demo-target="editor"]'); return el.value.slice(el.selectionStart, el.selectionEnd); })()`);
  assert.equal(found, "瑠璃色", "次へ selects the match in the editor");
  const status = await cdp.evaluate(`document.querySelector('[data-search-match-status]').textContent`);
  assert.match(status, /1 \/ 1 件目/);
  log(`FLOW 4 search 次へ: PASS (編集ページ ${indicatorBeforeFind} → ${windowed ? await indicator() : "n/a"})`);

  log("windowed long document E2E: PASS");
} finally {
  await session.close();
}
