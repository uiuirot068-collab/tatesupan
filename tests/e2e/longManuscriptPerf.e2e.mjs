// Explicit-run browser benchmark for Phase 7 (long-manuscript performance).
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 [TATESPUN_PERF_PAGES=300] \
//     node tests/e2e/longManuscriptPerf.e2e.mjs
//
// Seeds a local document (~N pages, 2 image markers) plus 30 unrelated stored
// images into a disposable profile's IndexedDB, opens it, then types. Records:
// V2 Preview worker constructions, compose requests, images per compose
// payload, input → compose-request latency, compose round trip, keystroke
// frame time and main-thread long tasks. Prints JSON; asserts only
// correctness-level facts (layout completes, text persisted), never timings.
// Works against pre- and post-Phase-7 builds (the compose message shape is
// `{ type: "compose", input, requestId? }` in both).
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";
import { sleep } from "./helpers/cdp.mjs";

const target = resolveE2eTarget(process.env, "long manuscript perf");
const PAGES = Number(process.env.TATESPUN_PERF_PAGES ?? 300);
const LABEL = process.env.TATESPUN_PERF_LABEL ?? "local";
const session = await launchEditorSession("tatespun-perf-");
const { cdp } = session;
const log = (line) => console.log(line);

// Instrument before any app script runs.
await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
  source: `(() => {
    const perf = window.__tspPerf = { workers: 0, composePosts: [], composeReplies: [], longTasks: [], inputs: [] };
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(url, options);
        const isPreview = String(url).includes("v2Preview") || String(url).includes("Preview");
        this.__kind = isPreview ? "preview" : "other";
        perf.workers += 1;
        this.addEventListener("message", (event) => {
          if (event.data && (event.data.type === "complete" || event.data.type === "error") && ("bridge" in event.data || event.data.type === "error")) {
            perf.composeReplies.push({ t: performance.now(), type: event.data.type, requestId: event.data.requestId, message: event.data.message });
          }
        });
      }
      postMessage(message, transfer) {
        if (message && message.type === "compose") {
          perf.composePosts.push({ t: performance.now(), images: Object.keys(message.input?.images ?? {}).length });
        }
        return super.postMessage(message, transfer);
      }
    };
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) perf.longTasks.push({ t: entry.startTime, d: entry.duration });
      }).observe({ type: "longtask", buffered: true });
    } catch {}
  })();`,
});

function manuscript(pages) {
  const sentences = [
    "春の宵、窓辺に置いた硝子の瓶が淡い光を返していた。",
    "彼女は古い手紙を読み返し、ふと遠い町のことを思い出す。",
    "「もう一度だけ、あの坂を上ってみようか」と彼は言った。",
    "雨上がりの路地には、濡れた石畳の匂いが満ちている。",
    "時計の針は止まったまま、部屋の隅で静かに眠っていた。",
  ];
  const target = Math.round(pages * 592 * 0.8);
  const parts = [];
  let length = 0;
  for (let i = 0; length < target; i += 3) {
    let para = "　" + sentences[i % 5] + sentences[(i + 1) % 5] + sentences[(i + 2) % 5];
    if (parts.length === 20) para += "\n【IMG:perf-ref-a:30:20:center】";
    if (parts.length === 400) para += "\n【IMG:perf-ref-b:30:20:center】";
    parts.push(para);
    length += para.length + 1;
  }
  return parts.join("\n");
}

// A valid 1×1 PNG (every stored image uses it; only the ids differ).
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

try {
  await session.setViewport(1280, 900);
  // Let Dexie create the database, then seed it directly.
  await cdp.send("Page.navigate", { url: target.url("/editor") });
  await cdp.waitFor(`/[?&]id=\\d+/.test(location.search) && !!document.querySelector('[data-editor-save-status="saved"]')`, { timeoutMs: 90_000, label: "bootstrap editor" });
  const content = manuscript(PAGES);
  const docId = 777001;
  await cdp.evaluate(`new Promise((resolve, reject) => {
    const open = indexedDB.open("tategaki-editor-db");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(["documents", "images"], "readwrite");
      tx.objectStore("documents").put({ id: ${docId}, title: "perf", content: ${JSON.stringify(content)}, plotNote: "", updatedAt: Date.now() });
      const images = tx.objectStore("images");
      images.put({ id: "perf-ref-a", dataUrl: ${JSON.stringify(PNG)}, createdAt: Date.now() });
      images.put({ id: "perf-ref-b", dataUrl: ${JSON.stringify(PNG)}, createdAt: Date.now() });
      for (let i = 0; i < 30; i++) images.put({ id: "other-doc-" + i, dataUrl: ${JSON.stringify(PNG)}, createdAt: Date.now() });
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => reject(tx.error);
    };
  })`);

  const openStarted = Date.now();
  await cdp.send("Page.navigate", { url: target.url(`/editor?id=${docId}`) });
  await cdp.waitFor(`document.querySelector('[data-editor-save-status="saved"]') && window.__tspPerf.composeReplies.length >= 1`, { timeoutMs: 180_000, label: "first V2 layout" });
  const openMs = Date.now() - openStarted;
  await sleep(1500);
  const afterOpen = await cdp.evaluate(`JSON.parse(JSON.stringify(window.__tspPerf))`);
  const pagesShown = await cdp.evaluate(`Number(document.querySelector('[data-preview-total-pages]')?.getAttribute('data-preview-total-pages') ?? -1)`);
  log(`opened ${PAGES}p document in ${openMs} ms; preview pages=${pagesShown}; workers=${afterOpen.workers}; compose posts=${afterOpen.composePosts.length}; images in first payload=${afterOpen.composePosts[0]?.images}`);

  const PROFILE = process.env.TATESPUN_PERF_PROFILE === "1";
  const snapshot = () => cdp.evaluate(`JSON.parse(JSON.stringify(window.__tspPerf))`);
  const keystroke = (char) => cdp.evaluate(`new Promise((resolve) => {
    const el = document.querySelector('[data-demo-target="editor"]');
    const start = performance.now();
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, el.value + ${JSON.stringify(char)});
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(char)} }));
    window.__tspPerf.inputs.push(start);
    requestAnimationFrame(() => setTimeout(() => resolve({ start, frameMs: performance.now() - start }), 0));
  })`);
  const waitForReplies = (count) => cdp.waitFor(`window.__tspPerf.composeReplies.length >= ${count}`, { timeoutMs: 120_000, label: "layout reply" });
  const printProfile = (profile, title) => {
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    const self = new Map();
    profile.samples.forEach((id, i) => {
      const f = byId.get(id).callFrame;
      const key = `${f.functionName || "(anon)"} ${f.url.split("/").slice(-1)[0].split("?")[0]}:${f.lineNumber + 1}`;
      self.set(key, (self.get(key) ?? 0) + (profile.timeDeltas[i] ?? 0));
    });
    log(title);
    for (const [key, us] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 20)) log(`  ${String(Math.round(us / 1000)).padStart(6)} ms  ${key}`);
  };

  // Scenario A — isolated edits on an idle page (the reuse case): one
  // keystroke, wait for its layout, idle 3 s; three times.
  const isolated = [];
  for (let i = 0; i < 3; i++) {
    await sleep(3000);
    const before = await snapshot();
    if (PROFILE && i === 0) {
      await cdp.send("Profiler.enable");
      await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
      await cdp.send("Profiler.start");
    }
    const { start, frameMs } = await keystroke("い");
    if (PROFILE && i === 0) {
      const { profile } = await cdp.send("Profiler.stop");
      printProfile(profile, `CPU profile: ONE keystroke → next frame (${Math.round(frameMs)} ms)`);
    }
    await waitForReplies(before.composeReplies.length + 1);
    const after = await snapshot();
    const post = after.composePosts.slice(before.composePosts.length).find((p) => p.t >= start);
    const reply = after.composeReplies.slice(before.composeReplies.length).at(-1);
    isolated.push({
      keystrokeFrameMs: Math.round(frameMs),
      inputToRequestMs: post ? Math.round(post.t - start) : null,
      requestToLayoutMs: post && reply ? Math.round(reply.t - post.t) : null,
      inputToLayoutMs: reply ? Math.round(reply.t - start) : null,
      workersCreated: after.workers - before.workers,
      requests: after.composePosts.length - before.composePosts.length,
      payloadImages: post?.images ?? null,
      replyType: reply?.type,
    });
  }

  // Scenario B — a burst of 8 keystrokes 60 ms apart, then settle.
  await sleep(3000);
  const beforeBurst = await snapshot();
  const frames = [];
  for (let k = 0; k < 8; k++) {
    frames.push((await keystroke("あ")).frameMs);
    await sleep(60);
  }
  const lastInput = await cdp.evaluate(`window.__tspPerf.inputs.at(-1)`);
  await cdp.waitFor(`(() => { const p = window.__tspPerf; const r = p.composeReplies.at(-1); const q = p.composePosts.at(-1); return !!r && !!q && r.t > q.t && r.t > ${lastInput}; })()`, { timeoutMs: 180_000, label: "burst settled" });
  await sleep(500);
  const afterBurst = await snapshot();
  const burstReplies = afterBurst.composeReplies.slice(beforeBurst.composeReplies.length);
  const longTasks = afterBurst.longTasks.filter((task) => task.t >= beforeBurst.inputs.at(-1) + 3000);
  const sortedFrames = [...frames].sort((a, b) => a - b);
  const burst = {
    keystrokes: frames.length,
    keystrokeFrameMsMedian: Math.round(sortedFrames[Math.floor(sortedFrames.length / 2)]),
    requests: afterBurst.composePosts.length - beforeBurst.composePosts.length,
    workersCreated: afterBurst.workers - beforeBurst.workers,
    lastInputToFinalLayoutMs: Math.round(burstReplies.at(-1).t - lastInput),
    longTaskCount: longTasks.length,
    longTaskTotalMs: Math.round(longTasks.reduce((sum, task) => sum + task.d, 0)),
    longTaskMaxMs: Math.round(Math.max(0, ...longTasks.map((task) => task.d))),
  };
  const replies = afterBurst.composeReplies.slice(afterOpen.composeReplies.length);
  const result = {
    label: LABEL,
    pages: PAGES,
    chars: content.length,
    open: { ms: openMs, previewPages: pagesShown, workers: afterOpen.workers, composePosts: afterOpen.composePosts.length, payloadImages: afterOpen.composePosts.map((p) => p.images) },
    isolated,
    burst,
  };
  console.log(JSON.stringify(result, null, 2));
  mkdirSync("scripts/perf/results", { recursive: true });
  writeFileSync(`scripts/perf/results/browser-${LABEL}-${PAGES}p.json`, JSON.stringify(result, null, 2));

  // Correctness: the typed text is in the editor and the layout completed.
  const tail = await cdp.evaluate(`document.querySelector('[data-demo-target="editor"]').value.slice(-11)`);
  assert.equal(tail, "い".repeat(3) + "あ".repeat(8), "every keystroke reached the manuscript");
  const errors = replies.filter((reply) => reply.type !== "complete");
  if (errors.length > 0) log(`layout errors: ${JSON.stringify(errors.slice(0, 3))}`);
  assert.ok(errors.length === 0, "every layout completed");
  log("long manuscript perf: DONE");
} finally {
  await session.close();
}
