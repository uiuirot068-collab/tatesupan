// 検索・置換 navigation (Phase 9 Human-QA repair). Explicit run against the
// editor surface the build was made with (FULL by default; WINDOWED when built
// with NEXT_PUBLIC_TATESPUN_EDITOR_SURFACE=WINDOWED); the surface is detected.
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 [TATESPUN_E2E_EVIDENCE_DIR=...] \
//     node tests/e2e/searchReplaceNavigation.e2e.mjs
//
// Every dialog button is pressed with REAL mouse events: a synthetic
// `element.click()` never blurs the editor, which is exactly what hid the
// Human-QA failure (FULL: focus() before setSelectionRange revealed the OLD
// caret, so 次へ counted up while the editor stayed where it was).
//
// Covers: 検索・置換 naming, search with an empty replacement, 次へ / 前へ with
// wrap, the match selected AND inside the editor's visible area, WINDOWED
// 編集ページ switching, snippet, 選択箇所を置換 (one match; CST-PORT-015: the
// editor stays on the replaced text, この置換を戻す, 次へ moves on), 0 件 disabled state, query change resets the index, すべて置換 over
// the whole manuscript, close → the editor takes input again, phone modal,
// undo/redo: Ctrl+Z right after 選択箇所を置換 (typed replacement in the panel)
// reverts the BODY, Ctrl+Y redoes it, 元に戻す, one Ctrl+Z / Ctrl+Y for すべて置換,
// and the /guide label.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";
import { sleep } from "./helpers/cdp.mjs";

const target = resolveE2eTarget(process.env, "search/replace navigation E2E");
const EVIDENCE = process.env.TATESPUN_E2E_EVIDENCE_DIR?.trim() || null;
if (EVIDENCE) mkdirSync(EVIDENCE, { recursive: true });
const session = await launchEditorSession("tatespun-search-nav-");
const { cdp } = session;
const log = (line) => console.log(line);

// ---------------------------------------------------------------- fixture
const SENTENCES = [
  "春の宵、窓辺に置いた硝子の瓶が淡い光を返していた。",
  "彼女は古い手紙を読み返し、ふと遠い町のことを思い出す。",
  "雨上がりの路地には、濡れた石畳の匂いが満ちている。",
];
function prose(chars) {
  const parts = [];
  for (let length = 0, i = 0; length < chars; i++) {
    const para = `　${SENTENCES[i % 3]}${SENTENCES[(i + 1) % 3]}`;
    parts.push(para);
    length += para.length + 1;
  }
  return parts.join("\n");
}
const TAGS = ["壱", "弐", "参", "肆", "伍"];
// ~24k characters between matches: WINDOWED (≈50k per 編集ページ) puts the
// five matches on at least three different pages.
const CONTENT = TAGS.map((tag) => `${prose(24_000)}\n　ここに瑠璃色${tag}の硝子がある。`).join("\n");
const DOC_ID = 782001;

// ---------------------------------------------------------------- helpers
const surface = () => cdp.evaluate(`document.querySelector('[data-editor-page-navigator]') ? "WINDOWED" : "FULL"`);
const panelSel = (placement) => `[data-search-replace-placement="${placement}"]`;
async function realClick(selector) {
  const point = await cdp.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    el.scrollIntoView({ block: "nearest" });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, disabled: !!el.disabled };
  })()`);
  assert.ok(point, `clickable ${selector}`);
  assert.equal(point.disabled, false, `${selector} is enabled`);
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
    await cdp.send("Input.dispatchMouseEvent", { type, x: point.x, y: point.y, button: "left", clickCount: 1 });
  }
}
const setInput = (selector, value) => cdp.evaluate(`(() => {
  const input = document.querySelector(${JSON.stringify(selector)});
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
/** A real Ctrl+<key> on the focused element; `command` is the editing command Chrome binds to it. */
async function pressCtrl(key, command) {
  const code = `Key${key.toUpperCase()}`;
  const vk = key.toUpperCase().charCodeAt(0);
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, modifiers: 2, windowsVirtualKeyCode: vk, commands: [command] });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, modifiers: 2, windowsVirtualKeyCode: vk });
  await sleep(300);
}
const isDisabled = (selector) => cdp.evaluate(`!!document.querySelector(${JSON.stringify(selector)})?.disabled`);
const status = () => cdp.evaluate(`document.querySelector('[data-search-match-status]')?.textContent.trim() ?? null`);
const snippet = () => cdp.evaluate(`document.querySelector('[data-search-match-context]')?.textContent ?? ""`);
/**
 * The editor's selection and whether its first character is inside the
 * textarea's visible scroll window (measured with a clone textarea that wraps
 * exactly like the live one — the same technique the app's scroll helper uses).
 */
const editorState = () => cdp.evaluate(`(() => {
  const el = document.querySelector('[data-demo-target="editor"]');
  const style = getComputedStyle(el);
  const mirror = document.createElement('textarea');
  for (const p of ['fontFamily','fontSize','fontWeight','fontStyle','letterSpacing','lineHeight','paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','boxSizing','width','whiteSpace','wordBreak','tabSize']) mirror.style[p] = style[p];
  Object.assign(mirror.style, { position: 'absolute', visibility: 'hidden', top: '-9999px', left: '-9999px', height: '0px', overflow: 'hidden' });
  document.body.appendChild(mirror);
  mirror.value = el.value.slice(0, el.selectionStart);
  const lineBottom = mirror.scrollHeight;
  mirror.remove();
  const lineHeight = parseFloat(style.lineHeight) || 20;
  const r = el.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 40));
  return {
    selected: el.value.slice(el.selectionStart, el.selectionEnd),
    after: el.value.slice(el.selectionEnd, el.selectionEnd + 1),
    visible: lineBottom - lineHeight >= el.scrollTop - 1 && lineBottom <= el.scrollTop + el.clientHeight + 1,
    lineBottom, scrollTop: Math.round(el.scrollTop), clientHeight: el.clientHeight,
    focused: document.activeElement === el,
    editorUncovered: hit === el || !!hit?.closest?.('[data-demo-target="editor"]'),
    page: document.querySelector('[data-editor-page-indicator]')?.textContent.trim() ?? null,
  };
})()`);
async function screenshot(name) {
  if (!EVIDENCE) return null;
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  const file = join(EVIDENCE, name);
  writeFileSync(file, Buffer.from(data, "base64"));
  return file;
}
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
const count = (text, needle) => text.split(needle).length - 1;
/** Polls the saved manuscript (autosave is debounced) until `accept` holds. */
async function savedDocWhere(accept, label, timeoutMs = 30_000) {
  let last = null;
  for (const deadline = Date.now() + timeoutMs; Date.now() < deadline; ) {
    last = await readDocFromDb();
    if (last !== null && accept(last)) return last;
    await sleep(300);
  }
  throw new Error(`saved manuscript never satisfied: ${label}`);
}

const results = { steps: [] };
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
      tx.objectStore("documents").put({ id: ${DOC_ID}, title: "search-nav", content: ${JSON.stringify(CONTENT)}, plotNote: "", updatedAt: Date.now() });
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => reject(tx.error);
    };
  })`);
  await cdp.send("Page.navigate", { url: target.url(`/editor?id=${DOC_ID}`) });
  await cdp.waitFor(`!!document.querySelector('[data-editor-save-status="saved"]') && document.querySelector('[data-demo-target="editor"]')?.value.length > 1000`, { timeoutMs: 120_000, label: "document open" });
  await sleep(2500);
  const surf = await surface();
  results.surface = surf;
  log(`editor surface: ${surf}`);

  // Park the caret at the far end so a jump that does not scroll is visible as a failure.
  await cdp.evaluate(`(() => { const el = document.querySelector('[data-demo-target="editor"]'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); el.scrollTop = el.scrollHeight; })()`);
  await sleep(300);

  // ------------------------------------------------ open, naming, search only
  const toolbarLabel = await cdp.evaluate(`document.querySelector('[data-editor-action="replace"]').textContent.trim()`);
  assert.equal(toolbarLabel, "検索・置換", "toolbar button is named 検索・置換");
  await realClick('[data-editor-action="replace"]');
  await cdp.waitFor(`(() => { const p = document.querySelector('${panelSel("preview")}'); return !!p && p.getBoundingClientRect().width > 0; })()`, { label: "desktop panel in Preview" });
  assert.equal(await cdp.evaluate(`document.querySelector('${panelSel("preview")} h2').textContent.trim()`), "検索・置換");
  assert.equal(await isDisabled(`${panelSel("preview")} [data-search-step="next"]`), true, "次へ disabled before a query");
  await setInput(`${panelSel("preview")} [data-search-input]`, "瑠璃色");
  await cdp.waitFor(`document.querySelector('[data-search-match-status]')?.textContent.includes('5 件')`, { label: "5 matches" });
  assert.equal(await status(), "5 件見つかりました");
  assert.equal(await cdp.evaluate(`document.querySelector('${panelSel("preview")} [data-replace-input]').value`), "", "replacement left empty");
  assert.equal(await isDisabled(`${panelSel("preview")} [data-search-action="replace-one"]`), true, "選択箇所を置換 needs an active match");

  // ------------------------------------------------ 次へ / 前へ reveal the match
  const pagesSeen = new Set();
  const clickStep = async (dir, expectIndex, total = 5, tagOffset = 0) => {
    const t0 = Date.now();
    await realClick(`${panelSel("preview")} [data-search-step="${dir}"]`);
    const tag = TAGS[expectIndex - 1 + tagOffset];
    await cdp.waitFor(`(() => { const el = document.querySelector('[data-demo-target="editor"]'); return el.value.slice(el.selectionStart, el.selectionEnd + 1) === "瑠璃色${tag}"; })()`, { timeoutMs: 30_000, label: `editor selects match ${expectIndex}` });
    await sleep(150);
    const state = await editorState();
    const s = await status();
    const snip = await snippet();
    results.steps.push({ dir, expectIndex, ms: Date.now() - t0, status: s, ...state });
    log(`  ${dir} → ${s}: selected=${state.selected}${state.after} visible=${state.visible} (line ${state.lineBottom}, scroll ${state.scrollTop}+${state.clientHeight}) focused=${state.focused} ${state.page ?? ""}`);
    assert.equal(s, `${expectIndex} / ${total} 件目`);
    assert.equal(state.selected, "瑠璃色");
    assert.equal(state.visible, true, `match ${expectIndex} is inside the editor's visible area`);
    assert.equal(state.focused, true, "editor focused so the selection highlight shows");
    assert.equal(state.editorUncovered, true, "the panel does not cover the editor");
    assert.ok(snip.includes(`瑠璃色${tag}`), `snippet shows match ${expectIndex}: ${snip}`);
    if (state.page) pagesSeen.add(state.page);
  };
  await clickStep("next", 1);
  await clickStep("next", 2);
  await clickStep("next", 3);
  results.shotAfterNext3 = await screenshot(`search-next3-${surf}.png`);
  await clickStep("prev", 2);
  await clickStep("prev", 1);
  await clickStep("prev", 5); // wraps backwards
  await clickStep("next", 1); // wraps forwards
  await clickStep("next", 2);
  if (surf === "WINDOWED") {
    assert.ok(pagesSeen.size >= 3, `WINDOWED switched 編集ページ for matches on other pages (${[...pagesSeen].join(", ")})`);
    log(`  WINDOWED 編集ページ visited: ${[...pagesSeen].join(" / ")}`);
  }
  results.pagesSeen = [...pagesSeen];

  // Enter in the search field = 次へ.
  await cdp.evaluate(`document.querySelector('${panelSel("preview")} [data-search-input]').focus()`);
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await cdp.waitFor(`document.querySelector('[data-search-match-status]')?.textContent.trim() === '3 / 5 件目'`, { label: "Enter = 次へ" });
  await realClick(`${panelSel("preview")} [data-search-step="prev"]`);
  await cdp.waitFor(`document.querySelector('[data-search-match-status]')?.textContent.trim() === '2 / 5 件目'`, { label: "back to 2" });

  // ------------------------------------------------ 選択箇所を置換
  // Type the replacement for real, so the panel input has its OWN native
  // undo history (Human QA: Ctrl+Z after 選択箇所を置換 undid this input
  // instead of the body replacement).
  await realClick(`${panelSel("preview")} [data-replace-input]`);
  await cdp.send("Input.insertText", { text: "群" });
  await cdp.send("Input.insertText", { text: "青" });
  assert.equal(await cdp.evaluate(`document.querySelector('${panelSel("preview")} [data-replace-input]').value`), "群青", "search panel input takes ordinary typing");
  const beforeOne = await editorState();
  await realClick(`${panelSel("preview")} [data-search-action="replace-one"]`);
  // CST-PORT-015: the panel and the editor stay on the replaced text.
  await cdp.waitFor(`document.querySelector('[data-search-match-status]')?.textContent.trim() === '残り 4 件'`, { timeoutMs: 30_000, label: "after replace-one: 残り 4 件" });
  await cdp.waitFor(`(() => { const el = document.querySelector('[data-demo-target="editor"]'); return el.value.slice(el.selectionStart, el.selectionEnd + 1) === "群青弐"; })()`, { timeoutMs: 30_000, label: "the replaced text stays selected" });
  await sleep(200);
  const afterOne = await editorState();
  assert.equal(afterOne.visible, true, "the replaced text is still in view");
  assert.ok(Math.abs(afterOne.scrollTop - beforeOne.scrollTop) <= 2, `the editor did not scroll (${beforeOne.scrollTop} → ${afterOne.scrollTop})`);
  assert.equal(afterOne.page, beforeOne.page, "same 編集ページ");
  assert.equal(await cdp.evaluate(`document.querySelector('[data-search-receipt]')?.textContent.includes('2 件目を置換しました')`), true, "receipt says which match was replaced");
  assert.ok(await cdp.evaluate(`document.querySelector('[data-search-receipt-context]')?.textContent ?? ""`).then((t) => t.includes("群青弐")), "receipt shows the replaced text in its surroundings");
  const dbAfterOne = await savedDocWhere((doc) => doc.includes("群青"), "replace-one saved");
  assert.equal(count(dbAfterOne, "瑠璃色"), 4, "exactly one match replaced");
  assert.equal(count(dbAfterOne, "群青弐"), 1, "the ACTIVE match (弐) was the one replaced");
  assert.equal(dbAfterOne.length, CONTENT.length - 1, "nothing else changed");
  log(`選択箇所を置換: PASS (弐 → 群青弐, stays in place: scroll ${beforeOne.scrollTop} → ${afterOne.scrollTop})`);
  results.shotAfterReplaceOne = await screenshot(`search-replace-one-${surf}.png`);

  // Ctrl+Z right after 選択箇所を置換 reverts the BODY (not the panel input), Ctrl+Y redoes it.
  results.focusAfterReplaceOne = await cdp.evaluate(`document.activeElement?.getAttribute('data-demo-target') ?? document.activeElement?.tagName`);
  await pressCtrl("z", "undo");
  const dbUndoOne = await savedDocWhere((doc) => doc === CONTENT, "Ctrl+Z restores the manuscript before 選択箇所を置換");
  assert.equal(count(dbUndoOne, "瑠璃色"), 5);
  assert.equal(await cdp.evaluate(`document.querySelector('${panelSel("preview")} [data-replace-input]').value`), "群青", "Ctrl+Z did not go to the panel input");
  await cdp.waitFor(`document.querySelector('[data-search-match-status]')?.textContent.trim() === '5 件見つかりました'`, { label: "panel sees 5 matches after undo" });
  await pressCtrl("y", "redo");
  const dbRedoOne = await savedDocWhere((doc) => doc === dbAfterOne, "Ctrl+Y re-applies 選択箇所を置換");
  assert.equal(count(dbRedoOne, "群青弐"), 1);
  await cdp.waitFor(`document.querySelector('[data-search-match-status]')?.textContent.trim() === '残り 4 件'`, { label: "panel back to 残り 4 件 after redo" });
  log(`選択箇所を置換 undo/redo (Ctrl+Z / Ctrl+Y, focus=${results.focusAfterReplaceOne}): PASS`);

  // この置換を戻す puts that one match back and makes it the active match again.
  await realClick(`${panelSel("preview")} [data-search-action="undo-one"]`);
  await savedDocWhere((doc) => doc === CONTENT, "この置換を戻す restores the match");
  await cdp.waitFor(`document.querySelector('[data-search-match-status]')?.textContent.trim() === '2 / 5 件目'`, { label: "restored match is active" });
  assert.equal(await cdp.evaluate(`document.querySelector('[data-search-receipt]')?.textContent.includes('2 件目を元に戻しました')`), true);
  await realClick(`${panelSel("preview")} [data-search-action="replace-one"]`);
  await savedDocWhere((doc) => doc === dbAfterOne, "replace again after この置換を戻す");
  await cdp.waitFor(`document.querySelector('[data-search-match-status]')?.textContent.trim() === '残り 4 件'`, { label: "残り 4 件 again" });
  log("この置換を戻す: PASS");

  // 次へ moves on from the replaced text; a second 選択箇所を置換 replaces that one.
  await realClick(`${panelSel("preview")} [data-search-step="next"]`);
  await cdp.waitFor(`document.querySelector('[data-search-match-status]')?.textContent.trim() === '2 / 4 件目'`, { timeoutMs: 30_000, label: "次へ after replace: 2 / 4" });
  await cdp.waitFor(`(() => { const el = document.querySelector('[data-demo-target="editor"]'); return el.value.slice(el.selectionStart, el.selectionEnd + 1) === "瑠璃色参"; })()`, { timeoutMs: 30_000, label: "参 selected" });
  await realClick(`${panelSel("preview")} [data-search-action="replace-one"]`);
  await cdp.waitFor(`document.querySelector('[data-search-match-status]')?.textContent.trim() === '残り 3 件'`, { timeoutMs: 30_000, label: "after 2nd replace-one: 残り 3 件" });

  // The toolbar 元に戻す reverts the 2nd 選択箇所を置換 on both surfaces.
  await realClick('[data-editor-action="undo"]');
  await savedDocWhere((doc) => doc === dbAfterOne, "元に戻す reverts the 2nd 選択箇所を置換");
  await cdp.waitFor(`document.querySelector('[data-search-match-status]')?.textContent.trim() === '4 件見つかりました'`, { timeoutMs: 20_000, label: "undo restores one match" });
  results.toolbarUndo = await status();
  log(`  元に戻す after the 2nd 選択箇所を置換: status ${results.toolbarUndo}`);

  // ------------------------------------------------ 0 件 and query reset
  await setInput(`${panelSel("preview")} [data-search-input]`, "存在しない語");
  await cdp.waitFor(`document.querySelector('[data-search-match-status]')?.textContent.trim() === '0 件'`, { label: "0 件" });
  for (const sel of ['[data-search-step="prev"]', '[data-search-step="next"]', '[data-search-action="replace-one"]', '[data-search-action="replace-all"]']) {
    assert.equal(await isDisabled(`${panelSel("preview")} ${sel}`), true, `${sel} disabled at 0 件`);
  }
  assert.equal(await snippet(), "", "no stale snippet at 0 件");
  await setInput(`${panelSel("preview")} [data-search-input]`, "瑠璃色");
  const remaining = 4;
  await cdp.waitFor(`document.querySelector('[data-search-match-status]')?.textContent.trim() === '${remaining} 件見つかりました'`, { label: "query change resets the index" });
  assert.equal(await isDisabled(`${panelSel("preview")} [data-search-action="replace-one"]`), true, "no stale active match after a query change");
  await realClick(`${panelSel("preview")} [data-search-step="next"]`);
  await cdp.waitFor(`document.querySelector('[data-search-match-status]')?.textContent.trim() === '1 / ${remaining} 件目'`, { label: "first match after reset" });
  log("0 件 / query reset: PASS");

  // ------------------------------------------------ すべて置換
  await realClick(`${panelSel("preview")} [data-search-action="replace-all"]`);
  // CST-PORT-015: the panel stays open and says how many were replaced.
  await cdp.waitFor(`document.querySelector('[data-search-receipt]')?.textContent.includes('${remaining} 件を置換しました')`, { label: "すべて置換 receipt" });
  assert.equal(await status(), "残り 0 件");
  const dbAfterAll = await savedDocWhere((doc) => !doc.includes("瑠璃色"), "replace-all saved");
  assert.equal(count(dbAfterAll, "瑠璃色"), 0, "すべて置換 left no match anywhere in the manuscript");
  assert.equal(count(dbAfterAll, "群青"), 5, "all five places now read 群青");
  // ONE Ctrl+Z reverts the whole すべて置換; Ctrl+Y applies it again.
  results.focusAfterReplaceAll = await cdp.evaluate(`document.activeElement?.getAttribute('data-demo-target') ?? document.activeElement?.tagName`);
  await pressCtrl("z", "undo");
  await savedDocWhere((doc) => doc === dbAfterOne, "one Ctrl+Z restores the whole manuscript before すべて置換");
  await pressCtrl("y", "redo");
  await savedDocWhere((doc) => doc === dbAfterAll, "Ctrl+Y re-applies すべて置換");
  log(`すべて置換 undo/redo (one Ctrl+Z / Ctrl+Y, focus=${results.focusAfterReplaceAll}): PASS`);
  // Whole-manuscript search confirms it too (WINDOWED only mounts one page).
  await realClick(`${panelSel("preview")} [data-search-action="close"]`);
  await cdp.waitFor(`!document.querySelector('[data-search-replace-placement]')`, { label: "panel closed after すべて置換" });
  await realClick('[data-editor-action="replace"]');
  await cdp.waitFor(`!!document.querySelector('${panelSel("preview")} [data-search-input]')`, { label: "panel reopened" });
  await setInput(`${panelSel("preview")} [data-search-input]`, "群青");
  await cdp.waitFor(`document.querySelector('[data-search-match-status]')?.textContent.trim() === '5 件見つかりました'`, { label: "5 × 群青" });
  log("すべて置換: PASS (0 × 瑠璃色, 5 × 群青 in the saved manuscript)");

  // ------------------------------------------------ close → editor is usable
  await realClick(`${panelSel("preview")} [data-search-action="close"]`);
  await cdp.waitFor(`!document.querySelector('[data-search-replace-placement]')`, { label: "closed" });
  await realClick('[data-demo-target="editor"]');
  const beforeType = await cdp.evaluate(`document.querySelector('[data-demo-target="editor"]').value.length`);
  await cdp.send("Input.insertText", { text: "あ" });
  await cdp.waitFor(`document.querySelector('[data-demo-target="editor"]').value.length === ${beforeType + 1}`, { label: "editor accepts input after closing" });
  log("close → editor input: PASS");

  // ------------------------------------------------ phone keeps the screen modal
  await session.setViewport(390, 844);
  await sleep(800);
  await realClick('[data-editor-action="replace"]');
  await cdp.waitFor(`!!document.querySelector('${panelSel("screen")}')`, { label: "phone modal" });
  const phone = await cdp.evaluate(`({
    screen: document.querySelector('${panelSel("screen")}').getBoundingClientRect().width,
    pane: document.querySelector('${panelSel("preview")}')?.getBoundingClientRect().width ?? 0,
    title: document.querySelector('${panelSel("screen")} h2').textContent.trim(),
  })`);
  assert.ok(phone.screen > 0 && phone.pane === 0, `phone uses the screen modal only (${JSON.stringify(phone)})`);
  assert.equal(phone.title, "検索・置換");
  await setInput(`${panelSel("screen")} [data-search-input]`, "群青");
  await cdp.waitFor(`document.querySelector('${panelSel("screen")} [data-search-match-status]')?.textContent.trim() === '5 件見つかりました'`, { label: "phone count" });
  await realClick(`${panelSel("screen")} [data-search-step="next"]`);
  await cdp.waitFor(`document.querySelector('${panelSel("screen")} [data-search-match-status]')?.textContent.trim() === '1 / 5 件目'`, { label: "phone 次へ" });
  results.phoneToolbarFits = await cdp.evaluate(`(() => { const row = document.querySelector('[data-editor-action-row]'); return row ? row.scrollWidth <= row.clientWidth + 1 : null; })()`);
  results.shotPhone = await screenshot(`search-phone-${surf}.png`);
  await realClick(`${panelSel("screen")} [data-search-action="close"]`);
  await cdp.waitFor(`!document.querySelector('[data-search-replace-placement]')`, { label: "phone closed" });
  log("phone modal: PASS");

  // ------------------------------------------------ /guide uses the current name
  await session.setViewport(1280, 900);
  await cdp.send("Page.navigate", { url: target.url("/guide") });
  await cdp.waitFor(`document.body?.innerText.includes('検索・置換')`, { timeoutMs: 30_000, label: "/guide shows 検索・置換" });
  assert.equal(await cdp.evaluate(`document.body.innerText.includes('置換機能')`), false, "/guide no longer says 置換機能");
  log("/guide label: PASS");

  results.status = "PASS";
  log(`SEARCH NAVIGATION E2E (${surf}): PASS`);
} catch (error) {
  results.status = "FAIL";
  results.error = String(error?.stack ?? error);
  await screenshot("search-failure.png").catch(() => {});
  console.error(error);
  process.exitCode = 1;
} finally {
  if (EVIDENCE) writeFileSync(join(EVIDENCE, `search-nav-results-${results.surface ?? "unknown"}.json`), JSON.stringify(results, null, 2));
  await session.close();
}
