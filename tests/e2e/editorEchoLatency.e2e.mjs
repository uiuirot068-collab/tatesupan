// Explicit-run benchmark: editor INPUT ECHO on a ~300k-character manuscript —
// time from an editing input (the DOM `input` event, or the key/click that
// started it) to the next painted frame — for the operations the FULL /
// WINDOWED parity audit must not slow down
// (docs/TATESPUN_FULL_WINDOWED_PARITY_AUDIT.md). Never asserts timings.
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 [TATESPUN_ECHO_REPEAT=5] \
//   [TATESPUN_PERF_LABEL=x] node tests/e2e/editorEchoLatency.e2e.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";
import { sleep } from "./helpers/cdp.mjs";

const target = resolveE2eTarget(process.env, "editor echo latency");
const REPEAT = Number(process.env.TATESPUN_ECHO_REPEAT ?? 5);
const LABEL = process.env.TATESPUN_PERF_LABEL ?? "local";
const session = await launchEditorSession("tatespun-echo-");
const { cdp } = session;
const EDITOR = '[data-demo-target="editor"]';
const para = (i) => `　第${i}段落。春の宵、窓辺に置いた硝子の瓶が淡い光を返していた。彼女は古い手紙を読み返し、ふと遠い町のことを思い出す。瑠璃色の空。`;
const LONG = Array.from({ length: 4300 }, (_, i) => para(i + 1)).join("\n");

async function key(k, code, vk, { modifiers = 0, commands, text } = {}) {
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk, modifiers, ...(commands ? { commands } : {}), ...(text ? { text, unmodifiedText: text } : {}) });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk, modifiers });
}
/** Arms an in-page probe: the time from `performance.now()` at arming (just before the input is sent) to the second rAF after the next DOM change of the editor. */
const arm = () => cdp.evaluate(`(() => {
  window.__echo = null;
  const t0 = performance.now();
  const done = () => requestAnimationFrame(() => requestAnimationFrame(() => { window.__echo = performance.now() - t0; }));
  const el = document.querySelector('${EDITOR}');
  const observer = new MutationObserver(() => { observer.disconnect(); done(); });
  observer.observe(document.querySelector('${EDITOR}').parentElement.parentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  el.addEventListener("input", () => { observer.disconnect(); done(); }, { once: true });
  el.addEventListener("select", () => { observer.disconnect(); done(); }, { once: true });
  return true;
})()`);
const readEcho = async () => {
  await cdp.waitFor(`window.__echo !== null`, { timeoutMs: 60_000, label: "echo" });
  return Math.round(await cdp.evaluate(`window.__echo`));
};
const setCaret = (expr) => cdp.evaluate(`(() => { const el = document.querySelector('${EDITOR}'); el.focus(); const at = ${expr}; el.setSelectionRange(at, at); return at; })()`);
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

try {
  await session.setViewport(1280, 900);
  await cdp.send("Page.navigate", { url: target.url("/editor") });
  await cdp.waitFor(`/[?&]id=\\d+/.test(location.search) && !!document.querySelector('[data-editor-save-status="saved"]')`, { timeoutMs: 90_000, label: "bootstrap" });
  await cdp.evaluate(`new Promise((res) => { const o = indexedDB.open("tategaki-editor-db"); o.onsuccess = () => { const tx = o.result.transaction(["documents"], "readwrite"); tx.objectStore("documents").put({ id: 783001, title: "echo", content: ${JSON.stringify(LONG)}, plotNote: "", updatedAt: Date.now() }); tx.oncomplete = () => { o.result.close(); res(1); }; }; })`);
  await cdp.send("Page.navigate", { url: target.url("/editor?id=783001") });
  await cdp.waitFor(`!!document.querySelector('[data-editor-save-status="saved"]') && Number(document.querySelector('[data-preview-total-pages]')?.getAttribute('data-preview-total-pages') ?? 0) > 100`, { timeoutMs: 180_000, label: "open" });
  await sleep(4000);
  const surface = await cdp.evaluate(`document.querySelector('[data-editor-page-navigator]') ? "WINDOWED" : "FULL"`);
  const results = {};
  const measure = async (name, prepare, input) => {
    const samples = [];
    for (let r = 0; r < REPEAT; r++) {
      if (prepare) await prepare();
      await sleep(1200);
      await arm();
      await input();
      samples.push(await readEcho());
    }
    results[name] = { median: median(samples), samples };
    console.log(`${name}: ${JSON.stringify(results[name])}`);
  };
  const toEnd = async () => {
    if (surface === "WINDOWED") {
      for (let i = 0; i < 20; i++) { const moved = await cdp.evaluate(`(() => { const b = document.querySelector('button[aria-label="次の編集ページへ移動"]'); if (!b || b.disabled) return false; b.click(); return true; })()`); if (!moved) break; await sleep(200); }
    }
    await setCaret("el.value.length");
  };
  const toStart = async () => {
    if (surface === "WINDOWED") {
      for (let i = 0; i < 20; i++) { const moved = await cdp.evaluate(`(() => { const b = document.querySelector('button[aria-label="前の編集ページへ移動"]'); if (!b || b.disabled) return false; b.click(); return true; })()`); if (!moved) break; await sleep(200); }
    }
    await setCaret("0");
  };
  await measure("insertBeginning", toStart, () => cdp.send("Input.insertText", { text: "あ" }));
  await measure("insertMiddle", () => setCaret("Math.floor(el.value.length / 2)"), () => cdp.send("Input.insertText", { text: "い" }));
  await measure("enterMiddle", () => setCaret("Math.floor(el.value.length / 2)"), () => key("Enter", "Enter", 13, { text: "\r" }));
  await measure("backspaceMiddle", () => setCaret("Math.floor(el.value.length / 2)"), () => key("Backspace", "Backspace", 8));
  await measure("undo", () => setCaret("Math.floor(el.value.length / 2)"), () => key("z", "KeyZ", 90, { modifiers: 2, commands: ["undo"] }));
  await measure("redo", () => setCaret("Math.floor(el.value.length / 2)"), () => key("y", "KeyY", 89, { modifiers: 2, commands: ["redo"] }));
  await measure("insertEnd", toEnd, () => cdp.send("Input.insertText", { text: "う" }));
  // 検索・置換 次へ: select the next match (may switch 編集ページ).
  await cdp.evaluate(`document.querySelector('[data-editor-action="replace"]').click()`);
  await sleep(800);
  await cdp.evaluate(`(() => { const i = document.querySelector('[data-search-input]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, '瑠璃色'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(2500);
  await measure("searchNext", null, () => cdp.evaluate(`document.querySelector('[data-search-step="next"]').click()`));
  const report = { label: LABEL, surface, chars: LONG.length, repeat: REPEAT, results };
  mkdirSync("scripts/perf/results", { recursive: true });
  writeFileSync(`scripts/perf/results/editor-echo-${LABEL}-${surface.toLowerCase()}.json`, JSON.stringify(report, null, 2) + "\n");
  console.log(`summary ${surface}: ${JSON.stringify(Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.median])))}`);
} finally {
  await session.close();
}
