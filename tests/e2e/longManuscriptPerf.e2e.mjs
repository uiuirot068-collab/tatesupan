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
//
// Phase 8 additions (all builds): reply deserialization time (the first
// `event.data` access of a layout reply is where Chrome deserializes it),
// React render counts per commit via a DevTools-style commit hook (no source
// instrumentation; see `countRenders`), JS heap, caret jump, paste, and
// layout latency on a fresh vs a reused worker. The editor surface (FULL or
// the paged WINDOWED surface) is whatever the build was made with.
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
    const perf = window.__tspPerf = { workers: 0, composePosts: [], composeReplies: [], longTasks: [], inputs: [], renders: [], renderCounting: false };
    // Phase 8: DevTools-style commit hook. A function component rendered in a
    // commit when its parent's children were reconciled (child list differs
    // from the alternate's) and it carries React's PerformedWork flag (1) —
    // the same rule React DevTools uses. Fibers are classified by their first
    // host DOM node, so minified component names do not matter.
    const classify = (fiber) => {
      let node = fiber.child;
      while (node && node.tag !== 5) node = node.child;
      const el = node && node.stateNode;
      if (!el || !el.getAttribute) return null;
      if (el.hasAttribute("data-preview-spread")) return "PreviewSpread";
      const cls = typeof el.className === "string" ? el.className : "";
      if (cls.startsWith("unit ")) return "UnitBox";
      if (cls === "page" || cls.startsWith("page ")) return "PreviewPage";
      if (cls.includes("flex-col items-center gap-2 rounded-md p-1")) return "PageCard";
      return null;
    };
    const walk = (fiber, counts) => {
      for (let child = fiber.child; child; child = child.sibling) {
        const prev = child.alternate;
        if ((child.tag === 0 || child.tag === 15 || child.tag === 11) && (prev === null || (child.flags & 1) === 1)) {
          const kind = classify(child);
          if (kind) counts[kind] = (counts[kind] ?? 0) + 1;
        }
        if (prev === null || child.child !== prev.child) walk(child, counts);
      }
    };
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true,
      renderers: new Map(),
      inject() { return 1; },
      checkDCE() {},
      onScheduleFiberRoot() {},
      onCommitFiberUnmount() {},
      onPostCommitFiberRoot() {},
      setStrictMode() {},
      onCommitFiberRoot(_id, root) {
        if (!perf.renderCounting) return;
        const current = root.current;
        if (!current.alternate || current.child === current.alternate.child) return;
        const counts = {};
        walk(current, counts);
        if (Object.keys(counts).length > 0) perf.renders.push({ t: performance.now(), counts });
      },
    };
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(url, options);
        const isPreview = String(url).includes("v2Preview") || String(url).includes("Preview");
        this.__kind = isPreview ? "preview" : "other";
        perf.workers += 1;
        this.__seq = perf.workers;
        this.__composes = 0;
        this.addEventListener("message", (event) => {
          const t0 = performance.now();
          const data = event.data; // first access deserializes the reply on this thread
          const deserializeMs = performance.now() - t0;
          if (data && (data.type === "complete" || data.type === "error") && ("bridge" in data || "layout" in data || data.type === "error")) {
            // Phase 9: Preview pages carried by the reply (a delta sends only changed pages; older builds always send all).
            const pv = data.preview;
            const previewKind = !pv ? null : pv.kind ?? "legacy-full";
            const pagesSent = !pv ? null : pv.kind === "delta" ? [...pv.pages, ...(pv.colophonPages ?? [])].filter((slot) => typeof slot !== "number").length : (pv.document ?? pv).pages.length;
            perf.composeReplies.push({ t: performance.now(), type: data.type, requestId: data.requestId, message: data.message, deserializeMs, worker: this.__seq, previewKind, pagesSent });
          }
        });
      }
      postMessage(message, transfer) {
        if (message && message.type === "compose") {
          this.__composes += 1;
          perf.composePosts.push({ t: performance.now(), images: Object.keys(message.input?.images ?? {}).length, worker: this.__seq, firstOnWorker: this.__composes === 1 });
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
  const surface = await cdp.evaluate(`document.querySelector('[data-editor-page-navigator]') ? "WINDOWED" : "FULL"`);
  const heapMb = async () => {
    await cdp.send("HeapProfiler.collectGarbage").catch(() => {});
    const { metrics } = await cdp.send("Performance.getMetrics");
    return Math.round((metrics.find((m) => m.name === "JSHeapUsedSize")?.value ?? 0) / 1048576);
  };
  await cdp.send("Performance.enable").catch(() => {});
  const heapAfterOpenMb = await heapMb();
  const mountedSpreads = () => cdp.evaluate(`document.querySelectorAll('[data-preview-spread-mounted="true"]').length`);
  const sumRenders = (list) => list.reduce((acc, entry) => { for (const [k, v] of Object.entries(entry.counts)) acc[k] = (acc[k] ?? 0) + v; return acc; }, {});
  log(`editor surface=${surface}; heap after open=${heapAfterOpenMb} MB`);
  // WINDOWED mounts one 編集ページ; type at the manuscript's end like FULL by
  // mounting the last one (the probe appends to the mounted textarea's end).
  let editorPage = null; // WINDOWED: the page indicator after mounting the last page
  if (surface === "WINDOWED") {
    for (let i = 0; i < 50; i++) {
      const moved = await cdp.evaluate(`(() => { const b = document.querySelector('button[aria-label="次の編集ページへ移動"]'); if (!b || b.disabled) return false; b.click(); return true; })()`);
      if (!moved) break;
      await sleep(300);
    }
    editorPage = await cdp.evaluate(`document.querySelector('[data-editor-page-indicator]')?.textContent.trim() ?? null`);
    log(`WINDOWED: mounted the last 編集ページ (${editorPage})`);
  }
  // The canonical manuscript as saved (IndexedDB), independent of the surface.
  const savedContent = async () => {
    await sleep(2500);
    await cdp.waitFor(`!!document.querySelector('[data-editor-save-status="saved"]')`, { timeoutMs: 60_000, label: "saved" });
    return cdp.evaluate(`new Promise((resolve, reject) => {
      const open = indexedDB.open("tategaki-editor-db");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const request = open.result.transaction("documents").objectStore("documents").get(${docId});
        request.onsuccess = () => { open.result.close(); resolve(request.result.content); };
        request.onerror = () => reject(request.error);
      };
    })`);
  };

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
  // Render counts are split at the layout reply: commits before it are the
  // keystroke's own (content prop, not layout), commits after it the layout's.
  const isolated = [];
  await cdp.evaluate(`window.__tspPerf.renderCounting = true`);
  for (let i = 0; i < 3; i++) {
    await sleep(3000);
    const before = await snapshot();
    const spreadsMounted = await mountedSpreads();
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
    await sleep(1000); // let the layout's commits and effects land
    const after = await snapshot();
    const post = after.composePosts.slice(before.composePosts.length).find((p) => p.t >= start);
    const reply = after.composeReplies.slice(before.composeReplies.length).at(-1);
    const renders = after.renders.slice(before.renders.length);
    const layoutTasks = reply ? after.longTasks.filter((task) => task.t >= reply.t - 5 && task.t < reply.t + 1000) : [];
    isolated.push({
      spreadsMounted,
      rendersBeforeLayout: sumRenders(renders.filter((entry) => !reply || entry.t < reply.t)),
      rendersAfterLayout: sumRenders(renders.filter((entry) => reply && entry.t >= reply.t)),
      replyDeserializeMs: reply ? Math.round(reply.deserializeMs) : null,
      previewKind: reply?.previewKind ?? null,
      previewPagesSent: reply?.pagesSent ?? null,
      layoutLongTaskMs: Math.round(layoutTasks.reduce((sum, task) => sum + task.d, 0)),
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
  await cdp.evaluate(`window.__tspPerf.renderCounting = false`);

  // Correctness: the typed text is in the editor.
  const tail = await cdp.evaluate(`document.querySelector('[data-demo-target="editor"]').value.slice(-11)`);
  assert.equal(tail, "い".repeat(3) + "あ".repeat(8), "every keystroke reached the manuscript");
  const savedAfterTyping = await savedContent();
  assert.equal(savedAfterTyping, content + "い".repeat(3) + "あ".repeat(8), "the saved canonical manuscript is the original plus every keystroke");

  // Worker reuse: request → layout for the first compose on a worker (font
  // parse, cold caches) vs later ones on the same worker.
  const latencyByFreshness = { fresh: [], reused: [] };
  for (const post of afterBurst.composePosts) {
    const reply = afterBurst.composeReplies.find((r) => r.worker === post.worker && r.t > post.t);
    const nextPost = afterBurst.composePosts.find((p) => p.worker === post.worker && p.t > post.t);
    if (!reply || (nextPost && nextPost.t < reply.t)) continue; // superseded on this worker
    latencyByFreshness[post.firstOnWorker ? "fresh" : "reused"].push(Math.round(reply.t - post.t));
  }

  // Scenario C — caret jump to the start and back to the end (no edit).
  await sleep(2000);
  const frameAfter = (script) => cdp.evaluate(`new Promise((resolve) => {
    const el = document.querySelector('[data-demo-target="editor"]');
    const start = performance.now();
    ${script}
    requestAnimationFrame(() => setTimeout(() => resolve(performance.now() - start), 0));
  })`);
  const caretToStartMs = Math.round(await frameAfter(`el.focus(); el.setSelectionRange(0, 0); el.dispatchEvent(new Event('select', { bubbles: true }));`));
  const caretToEndMs = Math.round(await frameAfter(`el.focus(); el.setSelectionRange(el.value.length, el.value.length); el.dispatchEvent(new Event('select', { bubbles: true }));`));

  // Scenario D — a 5,000-character insertion at the start through the native
  // editing path (Input.insertText: beforeinput/input like an IME commit;
  // it does not fire the paste event).
  await sleep(2000);
  const PASTE = "貼り付けた文章。".repeat(625);
  const beforePaste = await snapshot();
  await cdp.evaluate(`(() => { const el = document.querySelector('[data-demo-target="editor"]'); el.focus(); el.setSelectionRange(0, 0); })()`);
  const pasteStarted = await cdp.evaluate(`performance.now()`);
  await cdp.send("Input.insertText", { text: PASTE });
  const pasteFrameMs = Math.round((await cdp.evaluate(`new Promise((resolve) => requestAnimationFrame(() => setTimeout(() => resolve(performance.now()), 0)))`)) - pasteStarted);
  await cdp.waitFor(`window.__tspPerf.composeReplies.length > ${beforePaste.composeReplies.length}`, { timeoutMs: 180_000, label: "paste layout" });
  const afterPaste = await snapshot();
  const pasteReply = afterPaste.composeReplies.at(-1);
  const pasteTasks = afterPaste.longTasks.filter((task) => task.t >= pasteStarted);
  const head = await cdp.evaluate(`document.querySelector('[data-demo-target="editor"]').value.slice(0, ${PASTE.length})`);
  assert.equal(head, PASTE, "the insertion reached the manuscript");
  const savedAfterPaste = await savedContent();
  const pasteAt = savedAfterPaste.indexOf(PASTE);
  assert.ok(pasteAt >= 0 && savedAfterPaste.slice(0, pasteAt) + savedAfterPaste.slice(pasteAt + PASTE.length) === savedAfterTyping, "the saved manuscript is the typed one plus exactly the insertion");
  const heapAfterEditsMb = await heapMb();

  // Scenario E (TATESPUN_PERF_EXPORT=1) — "JPG ZIP" of every body page of the
  // current layout. Records the main-thread long tasks while it runs and a
  // SHA-256 per JPG entry, so two builds can be compared for identical output.
  let exportResult = null;
  if (process.env.TATESPUN_PERF_EXPORT === "1") {
    await sleep(3000);
    const doneBefore = session.downloads.filter((d) => d.state === "completed").length;
    const exportStarted = await cdp.evaluate(`performance.now()`);
    const wallStarted = Date.now();
    await cdp.evaluate(`document.querySelector('[data-demo-target="export"]').click()`);
    await cdp.waitFor(`!!document.querySelector('[data-export-menu-entry="jpg-zip"]')`, { label: "export menu" });
    await cdp.evaluate(`document.querySelector('[data-export-menu-entry="jpg-zip"]').click()`);
    const deadline = Date.now() + 600_000;
    let download = null;
    while (!download && Date.now() < deadline) {
      download = session.downloads.filter((d) => d.state === "completed")[doneBefore] ?? null;
      if (!download) await sleep(200);
    }
    assert.ok(download, "the ZIP export finished");
    const wallMs = Date.now() - wallStarted;
    const afterExport = await snapshot();
    const tasks = afterExport.longTasks.filter((task) => task.t >= exportStarted);
    const { default: JSZip } = await import("jszip");
    const { createHash } = await import("node:crypto");
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const zip = await JSZip.loadAsync(readFileSync(download.filePath ?? join(session.downloadDir, download.name)));
    const entries = {};
    for (const name of Object.keys(zip.files).sort()) {
      entries[name] = createHash("sha256").update(await zip.files[name].async("nodebuffer")).digest("hex").slice(0, 16);
    }
    exportResult = {
      jpgs: Object.keys(entries).length,
      wallMs,
      longTaskCount: tasks.length,
      longTaskTotalMs: Math.round(tasks.reduce((sum, task) => sum + task.d, 0)),
      longTaskMaxMs: Math.round(Math.max(0, ...tasks.map((task) => task.d))),
      entries,
    };
  }

  const result = {
    label: LABEL,
    pages: PAGES,
    chars: content.length,
    surface,
    editorPage,
    open: { ms: openMs, previewPages: pagesShown, workers: afterOpen.workers, composePosts: afterOpen.composePosts.length, payloadImages: afterOpen.composePosts.map((p) => p.images), replyDeserializeMs: Math.round(afterOpen.composeReplies[0]?.deserializeMs ?? -1) },
    isolated,
    burst,
    latencyByFreshness,
    caret: { toStartMs: caretToStartMs, toEndMs: caretToEndMs },
    paste: { chars: PASTE.length, frameMs: pasteFrameMs, toLayoutMs: Math.round(pasteReply.t - pasteStarted), longTaskTotalMs: Math.round(pasteTasks.reduce((sum, task) => sum + task.d, 0)), longTaskMaxMs: Math.round(Math.max(0, ...pasteTasks.map((task) => task.d))) },
    heapMb: { afterOpen: heapAfterOpenMb, afterEdits: heapAfterEditsMb },
    export: exportResult,
  };
  console.log(JSON.stringify(result, null, 2));
  mkdirSync("scripts/perf/results", { recursive: true });
  writeFileSync(`scripts/perf/results/browser-${LABEL}-${PAGES}p.json`, JSON.stringify(result, null, 2));

  const errors = afterPaste.composeReplies.slice(afterOpen.composeReplies.length).filter((reply) => reply.type !== "complete");
  if (errors.length > 0) log(`layout errors: ${JSON.stringify(errors.slice(0, 3))}`);
  assert.ok(errors.length === 0, "every layout completed");
  log("long manuscript perf: DONE");
} finally {
  await session.close();
}
