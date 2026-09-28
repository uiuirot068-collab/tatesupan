// Explicit-run browser benchmark: input → Preview latency on a ~300k-character
// manuscript, before/after the Core long-paragraph composition fix
// (docs/TATESPUN_CORE_LONG_PARAGRAPH_PERFORMANCE.md).
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 [TATESPUN_LP_FIXTURE=longtail|normal] \
//   [TATESPUN_PERF_LABEL=x] node tests/e2e/coreLongParagraphPreview.e2e.mjs
//
// Fixtures: `normal` = ~300k characters in ordinary paragraphs; `longtail` =
// the same volume whose LAST paragraph is one 20,000-character paragraph (so
// both the FULL textarea and the WINDOWED surface's last 編集ページ can reach
// it). Actions use real CDP input (Input.insertText, an Enter key event,
// Ctrl+Z): end-of-manuscript insert, insert inside the long paragraph, Enter
// there, undo. Each is timed from the input to the V2 layout reply and to the
// next painted frame after it. Asserts only correctness (the manuscript saved
// after the actions), never timings. Works on any build since Phase 9 (the
// compose message shape is unchanged).
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";
import { sleep } from "./helpers/cdp.mjs";

const target = resolveE2eTarget(process.env, "core long paragraph preview");
const FIXTURE = process.env.TATESPUN_LP_FIXTURE ?? "longtail";
const LABEL = process.env.TATESPUN_PERF_LABEL ?? "local";
const session = await launchEditorSession("tatespun-lp-");
const { cdp } = session;
const log = (line) => console.log(line);

await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
  source: `(() => {
    const perf = window.__tspPerf = { composePosts: [], composeReplies: [] };
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(url, options);
        this.addEventListener("message", (event) => {
          const data = event.data;
          if (data && (data.type === "complete" || data.type === "error") && ("bridge" in data || "layout" in data || data.type === "error")) {
            const t = performance.now();
            perf.composeReplies.push({ t, type: data.type, message: data.message });
            requestAnimationFrame(() => requestAnimationFrame(() => { perf.composeReplies.at(-1).paintedT = performance.now(); }));
          }
        });
      }
      postMessage(message, transfer) {
        if (message && message.type === "compose") perf.composePosts.push({ t: performance.now() });
        return super.postMessage(message, transfer);
      }
    };
  })();`,
});

const SENTENCES = [
  "春の宵、窓辺に置いた硝子の瓶が淡い光を返していた。",
  "彼女は古い手紙を読み返し、ふと遠い町のことを思い出す。",
  "「もう一度だけ、あの坂を上ってみようか」と彼は言った。",
  "雨上がりの路地には、濡れた石畳の匂いが満ちている。",
  "時計の針は止まったまま、部屋の隅で静かに眠っていた。",
];
function prose(length, seed = 0) {
  let text = "";
  for (let i = seed; text.length < length; i++) text += SENTENCES[i % SENTENCES.length];
  return text.slice(0, length);
}
function manuscript() {
  const longParagraph = FIXTURE === "longtail" ? 20_000 : 0;
  const text = prose(300_000 - longParagraph);
  const parts = [];
  for (let i = 0; i < text.length; i += 150) parts.push("　" + text.slice(i, i + 150));
  if (longParagraph) parts.push("　" + prose(longParagraph, 2));
  return parts.join("\n");
}

try {
  await session.setViewport(1280, 900);
  await cdp.send("Page.navigate", { url: target.url("/editor") });
  await cdp.waitFor(`/[?&]id=\\d+/.test(location.search) && !!document.querySelector('[data-editor-save-status="saved"]')`, { timeoutMs: 90_000, label: "bootstrap editor" });
  const content = manuscript();
  const docId = 777301;
  await cdp.evaluate(`new Promise((resolve, reject) => {
    const open = indexedDB.open("tategaki-editor-db");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(["documents"], "readwrite");
      tx.objectStore("documents").put({ id: ${docId}, title: "long paragraph", content: ${JSON.stringify(content)}, plotNote: "", updatedAt: Date.now() });
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => reject(tx.error);
    };
  })`);

  const openStarted = Date.now();
  await cdp.send("Page.navigate", { url: target.url(`/editor?id=${docId}`) });
  await cdp.waitFor(`document.querySelector('[data-editor-save-status="saved"]') && window.__tspPerf.composeReplies.length >= 1`, { timeoutMs: 300_000, label: "first V2 layout" });
  const openMs = Date.now() - openStarted;
  await sleep(1500);
  const pagesShown = await cdp.evaluate(`Number(document.querySelector('[data-preview-total-pages]')?.getAttribute('data-preview-total-pages') ?? -1)`);
  const surface = await cdp.evaluate(`document.querySelector('[data-editor-page-navigator]') ? "WINDOWED" : "FULL"`);
  log(`fixture=${FIXTURE} chars=${content.length} surface=${surface} open→first layout ${openMs} ms, preview pages=${pagesShown}`);

  // Move to the manuscript's end (WINDOWED: mount the last 編集ページ).
  const moveStarted = Date.now();
  if (surface === "WINDOWED") {
    for (let i = 0; i < 400; i++) {
      const moved = await cdp.evaluate(`(() => { const b = document.querySelector('button[aria-label="次の編集ページへ移動"]'); if (!b || b.disabled) return false; b.click(); return true; })()`);
      if (!moved) break;
      await sleep(120);
    }
  }
  await cdp.evaluate(`(() => { const el = document.querySelector('[data-demo-target="editor"]'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); })()`);
  const moveToEndMs = Date.now() - moveStarted;
  const pageIndicator = await cdp.evaluate(`document.querySelector('[data-editor-page-indicator]')?.textContent.trim() ?? null`);
  log(`moved to end in ${moveToEndMs} ms (${pageIndicator ?? "FULL"})`);

  const editorValue = () => cdp.evaluate(`document.querySelector('[data-demo-target="editor"]').value`);
  const setCaret = (expr) => cdp.evaluate(`(() => { const el = document.querySelector('[data-demo-target="editor"]'); el.focus(); const at = ${expr}; el.setSelectionRange(at, at); return at; })()`);
  const mark = () => cdp.evaluate(`(window.__tspMark = performance.now(), { mark: window.__tspMark, replies: window.__tspPerf.composeReplies.length })`);

  /** Waits until the layout requested after `mark` has replied and painted, with nothing newer pending. */
  async function settle(before) {
    await cdp.waitFor(`(() => {
      const p = window.__tspPerf;
      const lastPost = p.composePosts.at(-1);
      const reply = p.composeReplies.at(-1);
      return p.composeReplies.length > ${before.replies} && lastPost && lastPost.t >= ${before.mark} && reply.t > lastPost.t && reply.paintedT !== undefined;
    })()`, { timeoutMs: 300_000, label: "layout settled" });
    const perf = await cdp.evaluate(`JSON.parse(JSON.stringify(window.__tspPerf))`);
    const reply = perf.composeReplies.at(-1);
    const firstPost = perf.composePosts.find((p) => p.t >= before.mark);
    return {
      inputToRequestMs: firstPost ? Math.round(firstPost.t - before.mark) : null,
      inputToLayoutMs: Math.round(reply.t - before.mark),
      inputToPreviewPaintedMs: Math.round(reply.paintedT - before.mark),
      layouts: perf.composeReplies.length - before.replies,
      replyType: reply.type,
    };
  }

  const results = {};
  const act = async (name, input) => {
    await sleep(2500);
    const before = await mark();
    await input();
    results[name] = await settle(before);
    log(`${name}: ${JSON.stringify(results[name])}`);
  };

  const original = await editorValue();
  await act("endInsert", () => cdp.send("Input.insertText", { text: "あ" }));
  // Inside the long paragraph (longtail) / the last ordinary paragraph (normal):
  // 10,000 characters before the end in FULL, the middle of the mounted page in WINDOWED.
  const interiorAt = await setCaret(surface === "WINDOWED" ? `Math.floor(el.value.length / 2)` : `el.value.length - ${FIXTURE === "longtail" ? 10_000 : 60}`);
  await act("longParagraphInsert", () => cdp.send("Input.insertText", { text: "い" }));
  await act("enterInLongParagraph", async () => {
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r", unmodifiedText: "\r" });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  });
  const afterEnter = await editorValue();
  assert.equal(afterEnter.length, original.length + 3, "Enter inserted one line break");
  await act("undoEnter", async () => {
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "z", code: "KeyZ", modifiers: 2, windowsVirtualKeyCode: 90, commands: ["undo"] });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "z", code: "KeyZ", modifiers: 2, windowsVirtualKeyCode: 90 });
  });
  const afterUndo = await editorValue();
  assert.equal(afterUndo.length, original.length + 2, "undo removed exactly the line break");
  assert.equal(afterUndo[interiorAt], "い", "the interior insert landed at the caret");
  assert.equal(afterUndo.slice(0, interiorAt) + afterUndo.slice(interiorAt + 1), original + "あ", "the mounted text is the original plus the end insert and the interior insert");

  // Ctrl+A is the native select-all of the editor textarea (FULL: the whole
  // manuscript; WINDOWED: the mounted 編集ページ — PagedEditor's contract).
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", modifiers: 2, windowsVirtualKeyCode: 65, commands: ["selectAll"] });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", modifiers: 2, windowsVirtualKeyCode: 65 });
  await sleep(300);
  const selectAll = await cdp.evaluate(`(() => { const el = document.querySelector('[data-demo-target="editor"]'); return { start: el.selectionStart, end: el.selectionEnd, length: el.value.length, focused: document.activeElement === el }; })()`);
  assert.deepEqual(selectAll, { start: 0, end: afterUndo.length, length: afterUndo.length, focused: true }, "Ctrl+A selects the whole editor text");
  await setCaret("el.value.length");
  log(`Ctrl+A: PASS (${selectAll.end} characters selected)`);

  // The canonical manuscript as saved.
  await sleep(2500);
  await cdp.waitFor(`!!document.querySelector('[data-editor-save-status="saved"]')`, { timeoutMs: 60_000, label: "saved" });
  const saved = await cdp.evaluate(`new Promise((resolve, reject) => {
    const open = indexedDB.open("tategaki-editor-db");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const request = open.result.transaction("documents").objectStore("documents").get(${docId});
      request.onsuccess = () => { open.result.close(); resolve(request.result.content); };
      request.onerror = () => reject(request.error);
    };
  })`);
  assert.equal(saved.length, content.length + 2, "saved manuscript has exactly the two inserted characters");
  const expectedWithoutInterior = content + "あ";
  let firstDiff = 0;
  while (firstDiff < saved.length && saved[firstDiff] === expectedWithoutInterior[firstDiff]) firstDiff++;
  assert.equal(saved[firstDiff], "い", "the one extra saved character is the interior insert");
  assert.equal(saved.slice(0, firstDiff) + saved.slice(firstDiff + 1), expectedWithoutInterior, "saved manuscript is the original plus the end insert and one interior insert");
  const finalPages = await cdp.evaluate(`Number(document.querySelector('[data-preview-total-pages]')?.getAttribute('data-preview-total-pages') ?? -1)`);

  const report = { label: LABEL, fixture: FIXTURE, surface, chars: content.length, openMs, moveToEndMs, pagesShown, finalPages, results };
  mkdirSync("scripts/perf/results", { recursive: true });
  writeFileSync(`scripts/perf/results/browser-core-lp-${LABEL}-${surface.toLowerCase()}-${FIXTURE}.json`, JSON.stringify(report, null, 2) + "\n");
  log(JSON.stringify(report));
  log("PASS core long paragraph preview probe");
} finally {
  await session.close();
}
