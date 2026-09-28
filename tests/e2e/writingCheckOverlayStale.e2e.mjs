// Explicit-run E2E: the writing-check overlay's stale-underline contract
// after the main-thread Preview performance change
// (docs/TATESPUN_MAIN_THREAD_PREVIEW_PERFORMANCE.md). Works on FULL and
// WINDOWED builds.
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 node tests/e2e/writingCheckOverlayStale.e2e.mjs
//
// 1. A manuscript WITH an issue (an unmatched 「): its wavy underline is
//    shown; right after a keystroke (inside the 300 ms re-check debounce) no
//    underline is visible; after the re-check the underline is back, at the
//    same text.
// 2. A manuscript with NO issue: typing never toggles the overlay wrapper's
//    visibility and never mounts/unmounts it (no DOM churn), and no
//    underline ever appears.
import assert from "node:assert/strict";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";
import { sleep } from "./helpers/cdp.mjs";

const target = resolveE2eTarget(process.env, "writing check overlay stale");
const session = await launchEditorSession("tatespun-wc-");
const { cdp } = session;
const log = (line) => console.log(line);

/** Visible wavy underlines: rendered spans whose own box and every ancestor are not visibility:hidden. */
const VISIBLE_WAVY = `[...document.querySelectorAll('.tsp-writing-wavy, .tsp-writing-wavy-review, .tsp-writing-wavy-ng')].filter((el) => getComputedStyle(el).visibility === 'visible' && el.getClientRects().length > 0).map((el) => el.textContent)`;

async function openDocument(docId, content) {
  await cdp.evaluate(`new Promise((resolve, reject) => {
    const open = indexedDB.open("tategaki-editor-db");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(["documents"], "readwrite");
      tx.objectStore("documents").put({ id: ${docId}, title: "wc", content: ${JSON.stringify(content)}, plotNote: "", updatedAt: Date.now() });
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => reject(tx.error);
    };
  })`);
  await cdp.send("Page.navigate", { url: target.url(`/editor?id=${docId}`) });
  await cdp.waitFor(`!!document.querySelector('[data-editor-save-status="saved"]') && document.querySelector('[data-demo-target="editor"]')?.value.length > 0`, { timeoutMs: 60_000, label: "editor open" });
  await sleep(1500);
}

async function typeAtEnd(text) {
  await cdp.evaluate(`(() => { const el = document.querySelector('[data-demo-target="editor"]'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); })()`);
  await cdp.send("Input.insertText", { text });
}

try {
  await session.setViewport(1280, 900);
  await cdp.send("Page.navigate", { url: target.url("/editor") });
  await cdp.waitFor(`/[?&]id=\\d+/.test(location.search) && !!document.querySelector('[data-editor-save-status="saved"]')`, { timeoutMs: 90_000, label: "bootstrap editor" });
  const surface = await cdp.evaluate(`document.querySelector('[data-editor-page-navigator]') ? "WINDOWED" : "FULL"`);
  log(`surface=${surface}`);

  // 1. With an issue.
  await openDocument(779001, "　「閉じ忘れた会話文。\n　次の段落は正常です。");
  const before = await cdp.waitFor(`(() => { const v = ${VISIBLE_WAVY}; return v.length ? v : null; })()`, { timeoutMs: 10_000, label: "underline shown" });
  log(`underline before typing: ${JSON.stringify(before)}`);
  await cdp.evaluate(`(() => {
    window.__wcSamples = [];
    const started = performance.now();
    const tick = () => { window.__wcSamples.push({ t: performance.now() - started, visible: ${VISIBLE_WAVY}.length }); if (performance.now() - started < 1500) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  })()`);
  await typeAtEnd("あ");
  await sleep(1800);
  const samples = await cdp.evaluate(`window.__wcSamples`);
  const firstHidden = samples.find((s) => s.visible === 0);
  const reshown = samples.find((s) => firstHidden && s.t > firstHidden.t && s.visible > 0);
  assert.ok(firstHidden && firstHidden.t < 250, `stale underline hidden right after the edit (first hidden frame at ${firstHidden?.t?.toFixed(0)} ms)`);
  assert.ok(reshown, "underline shown again after the re-check");
  const after = await cdp.evaluate(VISIBLE_WAVY);
  assert.deepEqual(after, before, "the re-checked underline marks the same text");
  log(`PASS issue case: hidden from ${firstHidden.t.toFixed(0)} ms, shown again at ${reshown.t.toFixed(0)} ms`);

  // 2. Without an issue.
  await openDocument(779002, "　正常な段落です。\n　「会話文も閉じています」");
  assert.deepEqual(await cdp.evaluate(VISIBLE_WAVY), [], "no underline in a clean manuscript");
  await cdp.evaluate(`(() => {
    window.__wcMutations = [];
    const editorHost = document.querySelector('[data-demo-target="editor"]').parentElement;
    // The overlay wrappers are the host's direct children: record their
    // mount/unmount and their own class changes (e.g. visible ↔ invisible).
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'childList' && r.target === editorHost && [...r.addedNodes, ...r.removedNodes].some((n) => n.nodeType === 1 && n.classList.contains('pointer-events-none'))) window.__wcMutations.push('childList');
        if (r.type === 'attributes' && r.target.parentElement === editorHost && r.target.classList.contains('pointer-events-none') && r.oldValue !== r.target.getAttribute('class')) window.__wcMutations.push('class:' + r.oldValue + ' -> ' + r.target.getAttribute('class'));
      }
    }).observe(editorHost, { childList: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true, subtree: true });
  })()`);
  for (const ch of ["い", "う", "え"]) {
    await typeAtEnd(ch);
    await sleep(700);
  }
  const mutations = await cdp.evaluate(`window.__wcMutations`);
  assert.deepEqual(mutations, [], "typing in a clean manuscript never toggles or remounts the overlay");
  assert.deepEqual(await cdp.evaluate(VISIBLE_WAVY), [], "still no underline");
  const text = await cdp.evaluate(`document.querySelector('[data-demo-target="editor"]').value`);
  assert.ok(text.endsWith("いうえ"), "the typed text is in the editor");
  log("PASS clean case: no overlay visibility/mount churn while typing");
  log("PASS writing check overlay stale contract");
} finally {
  await session.close();
}
