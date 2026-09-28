// Explicit-run E2E for the Phase 9 Human-QA repair, on whichever editor
// surface the build was made with (FULL by default; WINDOWED when built with
// NEXT_PUBLIC_TATESPUN_EDITOR_SURFACE=WINDOWED). The surface is detected and
// printed — every number below belongs to that surface only.
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 [TATESPUN_E2E_EVIDENCE_DIR=...] \
//     [TATESPUN_P9_SKIP_PERF=1] node tests/e2e/phase9HumanQaRepair.e2e.mjs
//
// B1 置換 on desktop opens INSIDE the Preview pane (editor stays usable), 前へ /
//    次へ select the exact canonical match in the editor, show "k / N" and a
//    context snippet, and the Preview follows to the match's page. A phone
//    viewport keeps the screen modal.
// B2 設定 → A5 → 2段 through the real settings drawer: 上段 above 下段 on the
//    same lines (never side by side), no overlap, inside the sheet; the
//    colophon keeps its horizontal geometry.
// C  long manuscript (~300k characters): editor echo and Preview update at the
//    beginning and at the far end, Enter, large native paste, undo, search
//    jump to the far end, document switch. Timings are printed, never asserted.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";
import { sleep } from "./helpers/cdp.mjs";

const target = resolveE2eTarget(process.env, "phase 9 human-QA repair E2E");
const EVIDENCE = process.env.TATESPUN_E2E_EVIDENCE_DIR?.trim() || null;
if (EVIDENCE) mkdirSync(EVIDENCE, { recursive: true });
const session = await launchEditorSession("tatespun-p9-repair-");
const { cdp } = session;
const log = (line) => console.log(line);
const results = {};

await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
  source: `(() => {
    const p9 = window.__p9 = { posts: [], replies: [] };
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(url, options);
        this.addEventListener("message", (event) => {
          const data = event.data;
          if (data && data.type === "complete" && "layout" in data) {
            const entry = { t: performance.now(), kind: data.preview?.kind ?? "legacy-full", pages: data.layout.pageSequence.length, painted: null };
            p9.replies.push(entry);
            // The app's own handler runs after this listener in the same task;
            // the next frame after it is when the applied Preview can paint.
            requestAnimationFrame(() => setTimeout(() => { entry.painted = performance.now(); }, 0));
          }
        });
      }
      postMessage(message, transfer) {
        if (message && message.type === "compose") p9.posts.push(performance.now());
        return super.postMessage(message, transfer);
      }
    };
  })();`,
});

// ---------------------------------------------------------------- fixtures
const SENTENCES = [
  "春の宵、窓辺に置いた硝子の瓶が淡い光を返していた。",
  "彼女は古い手紙を読み返し、ふと遠い町のことを思い出す。",
  "「もう一度だけ、あの坂を上ってみようか」と彼は言った。",
  "雨上がりの路地には、濡れた石畳の匂いが満ちている。",
  "時計の針は止まったまま、部屋の隅で静かに眠っていた。",
];
function prose(chars, tag = "") {
  const parts = [];
  let length = 0;
  for (let i = 0; length < chars; i += 3) {
    const para = `　${tag}${SENTENCES[i % 5]}${SENTENCES[(i + 1) % 5]}${SENTENCES[(i + 2) % 5]}`;
    parts.push(para);
    length += para.length + 1;
  }
  return parts.join("\n");
}
const TAGS = ["壱", "弐", "参", "肆", "伍"];
function searchDoc() {
  const chunks = TAGS.map((tag) => `${prose(12_000)}\n　ここに瑠璃色${tag}の硝子がある。`);
  return chunks.join("\n");
}
const DOC_SEARCH = { id: 781001, content: searchDoc() };
const DOC_2COL = {
  id: 781002,
  content: prose(14_000),
  settings: { colophon: { enabled: true } },
};
const DOC_LONG = {
  id: 781003,
  content: `　冒頭の瑠璃色始の段落。\n${prose(300_000)}\n　終わりの瑠璃色終の段落。`,
};

// ---------------------------------------------------------------- helpers
const editorValue = () => cdp.evaluate(`document.querySelector('[data-demo-target="editor"]').value`);
const surface = () => cdp.evaluate(`document.querySelector('[data-editor-page-navigator]') ? "WINDOWED" : "FULL"`);
const previewTotal = () => cdp.evaluate(`Number(document.querySelector('[data-preview-total-pages]')?.getAttribute('data-preview-total-pages') ?? -1)`);
const replyCount = () => cdp.evaluate(`window.__p9.replies.length`);
async function seed(docs) {
  await cdp.evaluate(`new Promise((resolve, reject) => {
    const open = indexedDB.open("tategaki-editor-db");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(["documents"], "readwrite");
      for (const doc of ${JSON.stringify(docs)}) tx.objectStore("documents").put({ ...doc, title: "p9-" + doc.id, plotNote: "", updatedAt: Date.now() });
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => reject(tx.error);
    };
  })`);
}
async function openDoc(id) {
  const before = await replyCount().catch(() => 0);
  await cdp.send("Page.navigate", { url: target.url(`/editor?id=${id}`) });
  await cdp.waitFor(`window.__p9 && window.__p9.replies.length >= 1 && !!document.querySelector('[data-editor-save-status="saved"]')`, { timeoutMs: 240_000, label: `document ${id} first layout` });
  await sleep(1500);
  return before;
}
async function screenshot(name, rect) {
  if (!EVIDENCE || !rect || rect.width <= 0) return null;
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "png",
    clip: { x: Math.max(0, rect.x - 8), y: Math.max(0, rect.y - 8), width: rect.width + 16, height: rect.height + 16, scale: rect.width < 400 ? 3 : 1 },
    captureBeyondViewport: true,
  });
  const file = join(EVIDENCE, name);
  writeFileSync(file, Buffer.from(data, "base64"));
  return file;
}
const setInput = (selector, value) => cdp.evaluate(`(() => {
  const input = document.querySelector(${JSON.stringify(selector)});
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
const setSelect = (selector, value) => cdp.evaluate(`(() => {
  const select = document.querySelector(${JSON.stringify(selector)});
  if (!select) return false;
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, ${JSON.stringify(value)});
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return select.value === ${JSON.stringify(value)};
})()`);
/** Text of the Preview page cards currently intersecting the Preview scroller's viewport. */
const visiblePreviewText = () => cdp.evaluate(`(() => {
  const cards = [...document.querySelectorAll('[data-page-card="true"]')];
  if (cards.length === 0) return "";
  let scroller = cards[0].parentElement;
  while (scroller && !(scroller.scrollHeight > scroller.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
  const view = (scroller ?? document.documentElement).getBoundingClientRect();
  return cards.filter((card) => { const r = card.getBoundingClientRect(); return r.bottom > view.top && r.top < view.bottom && r.right > view.left && r.left < view.right; }).map((card) => card.textContent).join("|");
})()`);
const selectedText = () => cdp.evaluate(`(() => { const el = document.querySelector('[data-demo-target="editor"]'); return { text: el.value.slice(el.selectionStart, el.selectionEnd + 1), focused: document.activeElement === el }; })()`);
async function editorToEdge(edge) {
  if ((await surface()) !== "WINDOWED") return;
  const label = edge === "start" ? "前の編集ページへ移動" : "次の編集ページへ移動";
  for (let i = 0; i < 40; i++) {
    const moved = await cdp.evaluate(`(() => { const b = document.querySelector('button[aria-label="${label}"]'); if (!b || b.disabled) return false; b.click(); return true; })()`);
    if (!moved) return;
    await sleep(400);
  }
}

/**
 * Runs `action` (a CDP input) and measures, in page time:
 *   echo    = input sent → first frame whose editor value differs (the user sees their edit)
 *   preview = input sent → the frame after the first Preview layout reply that follows it
 */
async function measure(action, { waitPreview = true, echoTimeoutMs = 90_000 } = {}) {
  await cdp.evaluate(`(() => {
    const p9 = window.__p9;
    const el = document.querySelector('[data-demo-target="editor"]');
    p9.probe = { before: el.value, beforeReplies: p9.replies.length, tSend: performance.now(), echo: null, ticks: 0 };
    const tick = () => {
      p9.probe.ticks++;
      const now = document.querySelector('[data-demo-target="editor"]');
      if (now && now.value !== p9.probe.before) { setTimeout(() => { p9.probe.echo = performance.now(); }, 0); return; }
      if (performance.now() - p9.probe.tSend < 60000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  })()`);
  await action();
  try {
    await cdp.waitFor(`window.__p9.probe.echo !== null`, { timeoutMs: echoTimeoutMs, label: "editor echo" });
  } catch (error) {
    const state = await cdp.evaluate(`(() => { const el = document.querySelector('[data-demo-target="editor"]'); const p = window.__p9.probe; return JSON.stringify({ active: document.activeElement?.tagName + ":" + (document.activeElement?.getAttribute('data-demo-target') ?? document.activeElement?.id ?? ''), before: p.before.length, now: el?.value.length, ticks: p.ticks, sel: el?.selectionStart, visibility: document.visibilityState }); })()`);
    throw new Error(`${error.message}; state=${state}`);
  }
  let previewMs = null;
  let previewSplit = null;
  if (waitPreview) {
    await cdp.waitFor(`(() => { const p = window.__p9; const r = p.replies.slice(p.probe.beforeReplies).find((x) => x.t > p.probe.tSend); return !!r && r.painted !== null; })()`, { timeoutMs: 240_000, label: "Preview layout after input" });
    const split = await cdp.evaluate(`(() => { const p = window.__p9; const r = p.replies.slice(p.probe.beforeReplies).find((x) => x.t > p.probe.tSend); const posts = p.posts.filter((t) => t > p.probe.tSend && t < r.t); const post = posts.at(-1); return { total: Math.round(r.painted - p.probe.tSend), toRequest: post ? Math.round(post - p.probe.tSend) : null, workerLayout: post ? Math.round(r.t - post) : null, applyToPaint: Math.round(r.painted - r.t), requests: posts.length }; })()`);
    previewMs = split.total;
    previewSplit = split;
  }
  const echoMs = await cdp.evaluate(`Math.round(window.__p9.probe.echo - window.__p9.probe.tSend)`);
  await sleep(1500);
  return { echoMs, previewMs, previewSplit };
}
const insertText = (text) => () => cdp.send("Input.insertText", { text });
const pressEnter = () => async () => {
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
};
const undo = () => async () => {
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "z", code: "KeyZ", modifiers: 2, windowsVirtualKeyCode: 90, commands: ["undo"] });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "z", code: "KeyZ", modifiers: 2, windowsVirtualKeyCode: 90 });
};
/** Puts `text` on the real clipboard with the browser's copy command (focus returns to the editor after). */
async function copyToClipboard(text) {
  await cdp.evaluate(`(() => {
    const t = document.createElement('textarea');
    t.id = 'p9-clipboard-source';
    t.value = ${JSON.stringify(text)};
    document.body.appendChild(t);
    t.focus();
    t.select();
  })()`);
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "c", code: "KeyC", modifiers: 2, windowsVirtualKeyCode: 67, commands: ["copy"] });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "c", code: "KeyC", modifiers: 2, windowsVirtualKeyCode: 67 });
  await cdp.evaluate(`document.getElementById('p9-clipboard-source').remove()`);
}
/** Whether this headless browser has a working copy→paste clipboard (often not). */
async function clipboardWorks() {
  await copyToClipboard("p9-clip-check");
  await cdp.evaluate(`(() => { const t = document.createElement('textarea'); t.id = 'p9-clip-target'; document.body.appendChild(t); t.focus(); })()`);
  await nativePaste()();
  await sleep(300);
  return cdp.evaluate(`(() => { const t = document.getElementById('p9-clip-target'); const ok = t.value === 'p9-clip-check'; t.remove(); return ok; })()`);
}
const nativePaste = () => async () => {
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "v", code: "KeyV", modifiers: 2, windowsVirtualKeyCode: 86, commands: ["paste"] });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "v", code: "KeyV", modifiers: 2, windowsVirtualKeyCode: 86 });
};
/** Caret at a local offset of the mounted textarea (negative = from its end). */
const placeCaret = (offset) => cdp.evaluate(`(() => {
  const el = document.querySelector('[data-demo-target="editor"]');
  const at = ${offset} < 0 ? el.value.length + ${offset} : ${offset};
  el.focus();
  el.setSelectionRange(at, at);
  return { at, mounted: el.value.length };
})()`);
const median = (values) => {
  const sorted = values.filter((v) => v !== null).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
};

try {
  await session.setViewport(1280, 900);
  await cdp.send("Page.navigate", { url: target.url("/editor") });
  await cdp.waitFor(`/[?&]id=\\d+/.test(location.search) && !!document.querySelector('[data-editor-save-status="saved"]')`, { timeoutMs: 90_000, label: "bootstrap editor" });
  await seed([DOC_SEARCH, DOC_2COL, DOC_LONG]);

  const ONLY_PERF = process.env.TATESPUN_P9_ONLY_PERF === "1";
  // ================================================================= B1
  await openDoc(DOC_SEARCH.id);
  if (ONLY_PERF) {
    results.surface = await surface();
    results.searchDocPages = await previewTotal();
  } else {
  const surf = await surface();
  results.surface = surf;
  results.searchDocPages = await previewTotal();
  log(`editor surface: ${surf}`);
  await editorToEdge("start");
  await cdp.evaluate(`document.querySelector('[data-editor-action="replace"]').click()`);
  await cdp.waitFor(`(() => { const p = document.querySelector('[data-search-replace-placement="preview"]'); return !!p && p.getBoundingClientRect().width > 0; })()`, { label: "desktop search panel in Preview" });
  const layout1 = await cdp.evaluate(`(() => {
    const panel = document.querySelector('[data-search-replace-placement="preview"] > div').getBoundingClientRect();
    const editor = document.querySelector('[data-demo-target="editor"]').getBoundingClientRect();
    const cards = document.querySelectorAll('[data-page-card="true"]');
    const screen = document.querySelector('[data-search-replace-placement="screen"]');
    const hit = document.elementFromPoint(editor.left + editor.width / 2, editor.top + editor.height / 2);
    const overlaps = !(panel.right <= editor.left || panel.left >= editor.right || panel.bottom <= editor.top || panel.top >= editor.bottom);
    return {
      panel: { x: panel.x, y: panel.y, width: panel.width, height: panel.height },
      overlapsEditor: overlaps,
      editorHitIsEditor: hit === document.querySelector('[data-demo-target="editor"]') || !!hit?.closest?.('[data-demo-target="editor"]'),
      screenModalVisible: !!screen && screen.getBoundingClientRect().width > 0,
      previewCards: cards.length,
    };
  })()`);
  assert.equal(layout1.overlapsEditor, false, "the desktop search panel never covers the editor");
  assert.equal(layout1.editorHitIsEditor, true, "the editor stays hit-testable while searching");
  assert.equal(layout1.screenModalVisible, false, "no blocking screen modal on desktop");
  await setInput('input[placeholder="例: 山田"]', "瑠璃色");
  await cdp.waitFor(`document.querySelector('[data-search-match-status]')?.textContent.includes('5 件')`, { label: "5 matches" });
  const steps = [];
  const clickStep = async (dir, expectIndex) => {
    const t0 = Date.now();
    await cdp.evaluate(`document.querySelector('[data-search-step="${dir}"]').click()`);
    const tag = TAGS[expectIndex - 1];
    await cdp.waitFor(`(() => { const el = document.querySelector('[data-demo-target="editor"]'); return el.value.slice(el.selectionStart, el.selectionEnd + 1) === "瑠璃色${tag}"; })()`, { timeoutMs: 30_000, label: `editor selects match ${expectIndex}` });
    const selectMs = Date.now() - t0;
    const status = await cdp.evaluate(`document.querySelector('[data-search-match-status]').textContent.trim()`);
    const snippet = await cdp.evaluate(`document.querySelector('[data-search-match-context]')?.textContent ?? ""`);
    assert.equal(status, `${expectIndex} / 5 件目`);
    assert.ok(snippet.includes(`瑠璃色${tag}`), `snippet shows match ${expectIndex}: ${snippet}`);
    let previewFollowMs = null;
    for (const deadline = Date.now() + 20_000; Date.now() < deadline; ) {
      if ((await visiblePreviewText()).includes(`瑠璃色${tag}`)) {
        previewFollowMs = Date.now() - t0;
        break;
      }
      await sleep(150);
    }
    const sel = await selectedText();
    steps.push({ dir, index: expectIndex, selectMs, previewFollowMs, editorFocused: sel.focused, status });
  };
  await clickStep("next", 1);
  await clickStep("next", 2);
  await clickStep("next", 3);
  await clickStep("prev", 2);
  await clickStep("prev", 1);
  await clickStep("prev", 5); // wraps to the last match
  results.searchSteps = steps;
  for (const step of steps) log(`  ${step.dir} → ${step.status}: editor selected in ${step.selectMs} ms, Preview shows it ${step.previewFollowMs === null ? "NOT within 20 s" : `after ${step.previewFollowMs} ms`}, editor focused=${step.editorFocused}`);
  results.searchPreviewFollow = steps.every((s) => s.previewFollowMs !== null) ? "PASS" : "FAIL";
  results.searchPanelShot = await screenshot(`b1-search-panel-${surf}.png`, await cdp.evaluate(`(() => { const r = document.querySelector('main')?.getBoundingClientRect(); return r && { x: r.x, y: r.y, width: Math.min(r.width, 1280), height: Math.min(r.height, 900) }; })()`));
  await cdp.evaluate(`[...document.querySelectorAll('[data-search-replace-placement="preview"] button')].find((b) => b.textContent.trim() === '閉じる').click()`);
  await cdp.waitFor(`!document.querySelector('[data-search-replace-placement]')`, { label: "search closed" });
  assert.ok((await previewTotal()) > 0, "Preview still lists pages after closing");
  log(`B1 desktop search: PASS (panel in Preview, editor uncovered; Preview follow ${results.searchPreviewFollow})`);

  // Phone keeps the screen modal (Preview-pane placement is hidden there).
  await session.setViewport(390, 844);
  await sleep(800);
  await cdp.evaluate(`document.querySelector('[data-editor-action="replace"]').click()`);
  await cdp.waitFor(`!!document.querySelector('[data-search-replace-placement="screen"]')`, { label: "phone search modal" });
  const phone = await cdp.evaluate(`(() => ({
    screen: document.querySelector('[data-search-replace-placement="screen"]').getBoundingClientRect().width,
    pane: document.querySelector('[data-search-replace-placement="preview"]')?.getBoundingClientRect().width ?? 0,
  }))()`);
  assert.ok(phone.screen > 0 && phone.pane === 0, `phone uses the screen modal only (${JSON.stringify(phone)})`);
  await cdp.evaluate(`[...document.querySelectorAll('[data-search-replace-placement="screen"] button')].find((b) => b.textContent.trim() === '閉じる').click()`);
  await session.setViewport(1280, 900);
  await sleep(800);
  log("B1 phone search: PASS (screen modal, pane panel hidden)");

  // ================================================================= B2
  await openDoc(DOC_2COL.id);
  await cdp.evaluate(`document.querySelector('[data-demo-target="settings"]').click()`);
  await cdp.waitFor(`!!document.querySelector('[data-settings-row="paper"] select')`, { label: "settings drawer" });
  let before = await replyCount();
  assert.ok(await setSelect('[data-settings-row="paper"] select', "A5"), "paper A5 selected");
  await sleep(500);
  assert.ok(await setSelect('[data-settings-order="columns"] select', "2"), "2段 selected");
  const committedSettings = await cdp.evaluate(`(() => ({
    charsPerLine: document.querySelector('[data-settings-row="capacity"] input, input[name="charsPerLine"]')?.value ?? null,
  }))()`);
  await cdp.evaluate(`document.querySelector('button[aria-label="設定を閉じる"]').click()`);
  await cdp.waitFor(`window.__p9.replies.length > ${before}`, { timeoutMs: 120_000, label: "layout after A5/2段" });
  await sleep(2500);
  const twoCol = await cdp.evaluate(`(() => {
    const pages = [...document.querySelectorAll('[data-page-card="true"] .page:not(.horizontal)')];
    const page = pages.find((p) => p.querySelectorAll(':scope > .column').length === 2);
    if (!page) return { found: false, pages: pages.length };
    const card = page.closest('[data-page-card="true"]').getBoundingClientRect();
    const cols = [...page.querySelectorAll(':scope > .column')].map((col) => [...col.querySelectorAll('.unit')].map((u) => u.getBoundingClientRect()).filter((r) => r.height > 0));
    const box = (rects) => ({ top: Math.min(...rects.map((r) => r.top)), bottom: Math.max(...rects.map((r) => r.bottom)), left: Math.min(...rects.map((r) => r.left)), right: Math.max(...rects.map((r) => r.right)) });
    const upper = box(cols[0]);
    const lower = box(cols[1]);
    const all = cols.flat();
    return {
      found: true,
      card: { x: card.x, y: card.y, width: card.width, height: card.height, top: card.top, bottom: card.bottom, left: card.left, right: card.right },
      upper, lower,
      gapPx: lower.top - upper.bottom,
      rightEdgeDeltaPx: Math.abs(upper.right - lower.right),
      outside: all.filter((r) => r.top < card.top - 1 || r.bottom > card.bottom + 1 || r.left < card.left - 1 || r.right > card.right + 1).length,
      units: all.length,
    };
  })()`);
  log(`  A5/2段 Preview: ${JSON.stringify({ ...twoCol, card: undefined })}`);
  assert.ok(twoCol.found, "a body page with two 段 is painted");
  assert.ok(twoCol.gapPx > 0, "下段 starts below 上段 (no overlap)");
  assert.ok(twoCol.rightEdgeDeltaPx < 40, "上段 and 下段 start at the same right edge (stacked, not side by side)");
  assert.equal(twoCol.outside, 0, "no body glyph paints outside the sheet");
  results.twoColumn = { ...twoCol, shot: await screenshot(`b2-a5-2col-${surf}.png`, twoCol.card), committedSettings };
  // Colophon: the Preview still paints the 奥付 with the LEGACY ColophonPageCard
  // (PreviewPane: "colophon is still shown with the LEGACY ColophonPageCard"),
  // which this repair does not touch; the V2 colophon geometry (PDF/JPG) is
  // locked by src/lib/v2Bridge/twoColumnStackParity.test.ts. Here: it still
  // renders, horizontally, inside its sheet, next to a 2段 body.
  await cdp.evaluate(`(() => {
    const cards = document.querySelectorAll('[data-page-card="true"]');
    let scroller = cards[0].parentElement;
    while (scroller && !(scroller.scrollHeight > scroller.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  })()`);
  await cdp.waitFor(`!!document.querySelector('[data-colophon-page="true"]')`, { timeoutMs: 30_000, label: "colophon page mounted" });
  await sleep(800);
  const colophon = await cdp.evaluate(`(() => {
    const card = document.querySelector('[data-colophon-page="true"]');
    const rect = card.getBoundingClientRect();
    const text = card.textContent.trim();
    const writingModes = [...card.querySelectorAll('*')].filter((el) => el.textContent.trim() && el.children.length === 0).map((el) => getComputedStyle(el).writingMode);
    const leaves = [...card.querySelectorAll('*')].filter((el) => el.textContent.trim() && el.children.length === 0).map((el) => el.getBoundingClientRect()).filter((r) => r.height > 0);
    return {
      painter: "LEGACY ColophonPageCard",
      textLength: text.length,
      horizontal: writingModes.length > 0 && writingModes.every((m) => m === "horizontal-tb"),
      outside: leaves.filter((r) => r.top < rect.top - 1 || r.bottom > rect.bottom + 1 || r.left < rect.left - 1 || r.right > rect.right + 1).length,
      card: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    };
  })()`);
  log(`  colophon: ${JSON.stringify({ ...colophon, card: undefined })}`);
  assert.ok(colophon.textLength > 0, "the colophon paints");
  assert.ok(colophon.horizontal, "the colophon stays horizontal-tb");
  assert.equal(colophon.outside, 0, "no colophon text outside its sheet");
  results.colophon = { ...colophon, shot: await screenshot(`b2-colophon-${surf}.png`, colophon.card) };
  log("B2 A5/2段 + colophon: PASS");
  }
  const surfNow = results.surface;

  // ================================================================= C
  if (process.env.TATESPUN_P9_SKIP_PERF === "1") {
    log("C long manuscript: SKIPPED (TATESPUN_P9_SKIP_PERF=1)");
  } else {
    const openStart = Date.now();
    await openDoc(DOC_LONG.id);
    const openMs = Date.now() - openStart;
    const pages = await previewTotal();
    log(`C long manuscript: ${DOC_LONG.content.length} chars, ${pages} Preview pages, opened in ${openMs} ms (${surfNow})`);
    const perf = { chars: DOC_LONG.content.length, previewPages: pages, openMs };
    for (const edge of ["start", "end"]) {
      await editorToEdge(edge);
      const caret = await placeCaret(edge === "start" ? 200 : -200);
      await sleep(1500);
      const typing = [];
      for (let i = 0; i < 3; i++) typing.push(await measure(insertText("あ")));
      const enter = await measure(pressEnter());
      const PASTE = "貼付文。".repeat(5_000); // 20,000 characters
      const clipboard = await clipboardWorks();
      if (clipboard) await copyToClipboard(PASTE);
      await placeCaret(edge === "start" ? 200 : -200);
      const valueBeforePaste = (await editorValue()).length;
      const paste = { ...(await measure(clipboard ? nativePaste() : insertText(PASTE))), method: clipboard ? "native Ctrl+V" : "Input.insertText (headless clipboard unavailable)" };
      // FULL: the whole manuscript is mounted. WINDOWED: the mounted 編集ページ re-paginates, so this is not a paste size there.
      const pastedChars = (await surface()) === "FULL" ? (await editorValue()).length - valueBeforePaste : null;
      await cdp.evaluate(`document.querySelector('[data-demo-target="editor"]').focus()`);
      let undone;
      try {
        undone = { ...(await measure(undo(), { echoTimeoutMs: 8_000 })), method: "Ctrl+Z" };
      } catch {
        undone = { ...(await measure(() => cdp.evaluate(`document.querySelector('[data-editor-action="undo"]').click()`))), method: "元に戻す button (Ctrl+Z changed nothing in 8 s)" };
      }
      perf[edge] = {
        caret,
        typeEchoMs: typing.map((t) => t.echoMs),
        typePreviewMs: typing.map((t) => t.previewMs),
        typeEchoMedianMs: median(typing.map((t) => t.echoMs)),
        typePreviewMedianMs: median(typing.map((t) => t.previewMs)),
        enter,
        paste: { ...paste, pastedChars },
        undo: undone,
      };
      log(`  ${edge}: type echo ${perf[edge].typeEchoMs.join("/")} ms, Preview ${perf[edge].typePreviewMs.join("/")} ms; Enter ${enter.echoMs}/${enter.previewMs}; paste(${pastedChars}, ${paste.method}) ${paste.echoMs}/${paste.previewMs}; undo(${undone.method}) ${undone.echoMs}/${undone.previewMs} (echo/Preview ms)`);
    }
    // Search jump from the beginning to the far-end match.
    await editorToEdge("start");
    await placeCaret(0);
    await cdp.evaluate(`document.querySelector('[data-editor-action="replace"]').click()`);
    await cdp.waitFor(`!!document.querySelector('[data-search-replace-placement="preview"]')`, { label: "search panel" });
    await setInput('input[placeholder="例: 山田"]', "瑠璃色");
    await cdp.waitFor(`document.querySelector('[data-search-match-status]')?.textContent.includes('2 件')`, { label: "2 matches" });
    await cdp.evaluate(`document.querySelector('[data-search-step="next"]').click()`);
    await cdp.waitFor(`(() => { const el = document.querySelector('[data-demo-target="editor"]'); return el.value.slice(el.selectionStart, el.selectionEnd + 1) === "瑠璃色始"; })()`, { timeoutMs: 60_000, label: "first match" });
    await sleep(1500);
    const jumpStart = Date.now();
    await cdp.evaluate(`document.querySelector('[data-search-step="next"]').click()`);
    await cdp.waitFor(`(() => { const el = document.querySelector('[data-demo-target="editor"]'); return el.value.slice(el.selectionStart, el.selectionEnd + 1) === "瑠璃色終"; })()`, { timeoutMs: 60_000, label: "far-end match" });
    const jumpSelectMs = Date.now() - jumpStart;
    let jumpPreviewMs = null;
    for (const deadline = Date.now() + 30_000; Date.now() < deadline; ) {
      if ((await visiblePreviewText()).includes("瑠璃色終")) {
        jumpPreviewMs = Date.now() - jumpStart;
        break;
      }
      await sleep(150);
    }
    perf.searchJump = { selectMs: jumpSelectMs, previewFollowMs: jumpPreviewMs };
    log(`  search jump to the far end: editor selected in ${jumpSelectMs} ms; Preview shows it ${jumpPreviewMs === null ? "NOT within 30 s" : `after ${jumpPreviewMs} ms`}`);
    await cdp.evaluate(`[...document.querySelectorAll('[data-search-replace-placement="preview"] button')].find((b) => b.textContent.trim() === '閉じる').click()`);
    // Document switch (route change, editor stays mounted) long → short → long.
    await sleep(3000);
    // WINDOWED re-anchors at the previous caret offset clamped to the new
    // document, so any page of it may be mounted: accept any of its markers.
    const switchTo = async (id, markers, pagesExpected) => {
      const t0 = Date.now();
      await cdp.evaluate(`history.pushState(null, "", "/editor?id=${id}")`);
      await cdp.waitFor(`(() => { const v = document.querySelector('[data-demo-target="editor"]')?.value ?? ""; return ${JSON.stringify(markers)}.some((m) => v.includes(m)); })()`, { timeoutMs: 120_000, label: `editor shows ${id}` });
      const editorMs = Date.now() - t0;
      await cdp.waitFor(`Number(document.querySelector('[data-preview-total-pages]')?.getAttribute('data-preview-total-pages')) === ${pagesExpected}`, { timeoutMs: 240_000, label: `Preview shows ${id}` });
      return { editorMs, previewMs: Date.now() - t0 };
    };
    const toShort = await switchTo(DOC_SEARCH.id, TAGS.map((t) => `瑠璃色${t}`), results.searchDocPages).catch((error) => ({ error: error.message }));
    await sleep(3000);
    const toLong = await switchTo(DOC_LONG.id, ["瑠璃色終", "瑠璃色始", "春の宵"], perf.previewPages).catch((error) => ({ error: error.message }));
    perf.documentSwitch = { toShort, toLong };
    log(`  document switch long → short: ${JSON.stringify(toShort)}; short → long: ${JSON.stringify(toLong)}`);
    results.perf = perf;
  }

  if (EVIDENCE) writeFileSync(join(EVIDENCE, `phase9-results-${results.surface}.json`), JSON.stringify(results, null, 2));
  log(`RESULTS ${JSON.stringify(results)}`);
  log("phase 9 human-QA repair E2E: PASS");
} finally {
  await session.close();
}
