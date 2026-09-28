// Explicit-run browser benchmark: the MAIN-THREAD segment between an editor
// input and the V2 compose request it produces (docs/TATESPUN_MAIN_THREAD_PREVIEW_PERFORMANCE.md).
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 [TATESPUN_MT_FIXTURE=normal|longtail] \
//   [TATESPUN_MT_REPEAT=3] [TATESPUN_MT_PROFILE_DIR=dir] [TATESPUN_PERF_LABEL=x] \
//   node tests/e2e/mainThreadPreviewRequest.e2e.mjs
//
// Fixtures: `normal` = ~300k characters in ordinary 150-character paragraphs;
// `longtail` = the same volume whose LAST paragraph is one 20,000-character
// paragraph. Every action uses real CDP input and is timed from the input to:
//   request  — the Preview worker's `compose` postMessage (the main-thread
//              segment this probe exists for; it includes the two designed
//              180 ms debounces, TategakiEditor → PreviewPane and the V2
//              composition debounce, so its floor is ~360 ms);
//   reply    — the worker's layout reply (worker transfer + Core);
//   painted  — two animation frames after the reply was applied.
// `mainBusyMs` is the main thread's busy time inside [input, request]: the
// sum of CPU-profile samples that are not idle (only with PROFILE_DIR), and
// `longTaskMs` the Long Tasks API total over the same window (always).
// Asserts correctness (the exact manuscript saved after the actions and the
// undo/redo results), never timings.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";
import { sleep } from "./helpers/cdp.mjs";

const target = resolveE2eTarget(process.env, "main-thread preview request");
const FIXTURE = process.env.TATESPUN_MT_FIXTURE ?? "normal";
const LABEL = process.env.TATESPUN_PERF_LABEL ?? "local";
const REPEAT = Number(process.env.TATESPUN_MT_REPEAT ?? 3);
const PROFILE_DIR = process.env.TATESPUN_MT_PROFILE_DIR ?? "";
// TRACE=1: a Chrome trace per run, reduced to main-thread self time per trace
// event name (Layout, UpdateLayoutTree, Paint, Layerize, FunctionCall, ...)
// inside [input, compose request]. Mutually exclusive with PROFILE_DIR.
const TRACE = process.env.TATESPUN_MT_TRACE === "1" && !PROFILE_DIR;
// Diagnostic only: a stylesheet injected into every page (A/B experiments).
const INJECT_CSS = process.env.TATESPUN_MT_INJECT_CSS ?? "";
// Diagnostic only: log every DOM mutation inside [input, request] (what each frame changed).
const MUTATIONS = process.env.TATESPUN_MT_MUTATIONS === "1";
const session = await launchEditorSession("tatespun-mt-");
const { cdp } = session;
const log = (line) => console.log(line);

await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
  source: `(() => {
    const perf = window.__tspPerf = { composePosts: [], composeReplies: [], longTasks: [] };
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) perf.longTasks.push({ start: entry.startTime, duration: entry.duration });
      }).observe({ type: "longtask", buffered: true });
    } catch {}
    const injectCss = ${JSON.stringify(INJECT_CSS)};
    if (injectCss) document.addEventListener("DOMContentLoaded", () => { const style = document.createElement("style"); style.textContent = injectCss; document.head.appendChild(style); });
    if (${MUTATIONS}) {
      perf.mutations = [];
      const describe = (node) => { const el = node.nodeType === 1 ? node : node.parentElement; if (!el) return "?"; const attrs = [...el.attributes].filter((a) => a.name.startsWith("data-") || a.name === "aria-label").map((a) => a.name + (a.name === "aria-label" ? "=" + a.value.slice(0, 24) : "")).join(","); return el.tagName + "." + String(el.className?.baseVal ?? el.className ?? "").split(" ").slice(0, 3).join(".") + "[" + attrs + "]"; };
      document.addEventListener("DOMContentLoaded", () => new MutationObserver((records) => {
        const t = performance.now();
        for (const r of records) perf.mutations.push({ t, type: r.type, attr: r.attributeName, target: describe(r.target) });
      }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true }));
    }
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
        if (message && message.type === "compose") {
          const t = performance.now();
          performance.mark('tsp-compose-post');
          perf.composePosts.push({ t, delta: message.basePreviewLayoutId !== undefined, chars: message.input?.content?.length ?? message.content?.length ?? null });
        }
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

const key = async (keyName, code, vk, { modifiers = 0, commands, text } = {}) => {
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: keyName, code, windowsVirtualKeyCode: vk, modifiers, ...(commands ? { commands } : {}), ...(text ? { text, unmodifiedText: text } : {}) });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: keyName, code, windowsVirtualKeyCode: vk, modifiers });
};
const INPUTS = {
  insert: () => cdp.send("Input.insertText", { text: "あ" }),
  enter: () => key("Enter", "Enter", 13, { text: "\r" }),
  backspace: () => key("Backspace", "Backspace", 8),
  undo: () => key("z", "KeyZ", 90, { modifiers: 2, commands: ["undo"] }),
  redo: () => key("y", "KeyY", 89, { modifiers: 2, commands: ["redo"] }),
};

try {
  await session.setViewport(1280, 900);
  await cdp.send("Page.navigate", { url: target.url("/editor") });
  await cdp.waitFor(`/[?&]id=\\d+/.test(location.search) && !!document.querySelector('[data-editor-save-status="saved"]')`, { timeoutMs: 90_000, label: "bootstrap editor" });
  const content = manuscript();
  const docId = 777401;
  await cdp.evaluate(`new Promise((resolve, reject) => {
    const open = indexedDB.open("tategaki-editor-db");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(["documents"], "readwrite");
      tx.objectStore("documents").put({ id: ${docId}, title: "main thread", content: ${JSON.stringify(content)}, plotNote: "", updatedAt: Date.now() });
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => reject(tx.error);
    };
  })`);

  const openStarted = Date.now();
  await cdp.send("Page.navigate", { url: target.url(`/editor?id=${docId}`) });
  await cdp.waitFor(`document.querySelector('[data-editor-save-status="saved"]') && window.__tspPerf.composeReplies.length >= 1`, { timeoutMs: 300_000, label: "first V2 layout" });
  const openMs = Date.now() - openStarted;
  await sleep(2000);
  const surface = await cdp.evaluate(`document.querySelector('[data-editor-page-navigator]') ? "WINDOWED" : "FULL"`);
  const pagesShown = await cdp.evaluate(`Number(document.querySelector('[data-preview-total-pages]')?.getAttribute('data-preview-total-pages') ?? -1)`);
  log(`label=${LABEL} fixture=${FIXTURE} chars=${content.length} surface=${surface} open→first layout ${openMs} ms, preview pages=${pagesShown}`);

  const editorValue = () => cdp.evaluate(`document.querySelector('[data-demo-target="editor"]').value`);
  const setCaret = (expr) => cdp.evaluate(`(() => { const el = document.querySelector('[data-demo-target="editor"]'); el.focus(); const at = ${expr}; el.setSelectionRange(at, at); return at; })()`);
  const mark = () => cdp.evaluate(`(performance.mark('tsp-input'), window.__tspMark = performance.now(), { mark: window.__tspMark, replies: window.__tspPerf.composeReplies.length, posts: window.__tspPerf.composePosts.length, longTasks: window.__tspPerf.longTasks.length })`);
  const savedContent = () => cdp.evaluate(`new Promise((resolve, reject) => {
    const open = indexedDB.open("tategaki-editor-db");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const request = open.result.transaction("documents").objectStore("documents").get(${docId});
      request.onsuccess = () => { open.result.close(); resolve(request.result.content); };
      request.onerror = () => reject(request.error);
    };
  })`);

  /** The profile's busy (non-idle) time inside [fromT, toT] (performance.now clock via `offsetUs`). */
  function busyWithin(profile, offsetUs, fromT, toT) {
    const idle = new Set(profile.nodes.filter((n) => ["(idle)", "(program)", "(garbage collector)"].includes(n.callFrame.functionName) && n.callFrame.functionName === "(idle)").map((n) => n.id));
    let t = profile.startTime;
    let busy = 0;
    const byFunction = new Map();
    const nodeById = new Map(profile.nodes.map((n) => [n.id, n]));
    for (let i = 0; i < profile.samples.length; i++) {
      t += profile.timeDeltas[i];
      const next = i + 1 < profile.timeDeltas.length ? profile.timeDeltas[i + 1] : 0;
      const tMs = (t - offsetUs) / 1000;
      if (tMs < fromT || tMs > toT) continue;
      if (idle.has(profile.samples[i])) continue;
      busy += next / 1000;
      const frame = nodeById.get(profile.samples[i]).callFrame;
      const name = `${frame.functionName || "(anonymous)"} ${frame.url.split("/").pop()}:${frame.lineNumber + 1}:${frame.columnNumber + 1}`;
      byFunction.set(name, (byFunction.get(name) ?? 0) + next / 1000);
    }
    const top = [...byFunction.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, ms]) => ({ name, ms: Math.round(ms * 10) / 10 }));
    return { busyMs: Math.round(busy), top };
  }

  async function settle(before) {
    await cdp.waitFor(`(() => {
      const p = window.__tspPerf;
      const lastPost = p.composePosts.at(-1);
      const reply = p.composeReplies.at(-1);
      return p.composeReplies.length > ${before.replies} && lastPost && lastPost.t >= ${before.mark} && reply.t > lastPost.t && reply.paintedT !== undefined;
    })()`, { timeoutMs: 300_000, label: "layout settled" });
    const perf = await cdp.evaluate(`JSON.parse(JSON.stringify(window.__tspPerf))`);
    const reply = perf.composeReplies.at(-1);
    const firstPost = perf.composePosts.slice(before.posts)[0];
    const longTaskMs = perf.longTasks
      .slice(before.longTasks)
      .filter((task) => task.start < (firstPost?.t ?? Infinity))
      .reduce((sum, task) => sum + Math.min(task.duration, (firstPost?.t ?? Infinity) - task.start), 0);
    return {
      inputToRequestMs: firstPost ? Math.round(firstPost.t - before.mark) : null,
      requestToReplyMs: firstPost ? Math.round(reply.t - firstPost.t) : null,
      inputToReplyMs: Math.round(reply.t - before.mark),
      inputToPaintedMs: Math.round(reply.paintedT - before.mark),
      longTaskMs: Math.round(longTaskMs),
      posts: perf.composePosts.length - before.posts,
      delta: firstPost?.delta ?? null,
      replyType: reply.type,
      firstPostT: firstPost?.t ?? null,
    };
  }

  /** Main-thread self time by trace event name between the tsp-input and first tsp-compose-post marks. */
  function traceBreakdown(events) {
    const main = events.find((e) => e.ph === "M" && e.name === "thread_name" && e.args?.name === "CrRendererMain");
    if (!main) return { trace: "no CrRendererMain" };
    const markTs = (name) => events.filter((e) => e.name === name && e.pid === main.pid).map((e) => e.ts).sort((a, b) => a - b);
    const from = markTs("tsp-input").at(-1);
    const to = markTs("tsp-compose-post").find((ts) => ts > from);
    if (from === undefined || to === undefined) return { trace: "marks missing" };
    const slices = events
      .filter((e) => e.pid === main.pid && e.tid === main.tid && e.ph === "X" && typeof e.dur === "number" && e.ts < to && e.ts + e.dur > from)
      .sort((a, b) => a.ts - b.ts || b.dur - a.dur);
    const self = new Map();
    const stack = [];
    const clip = (e) => Math.max(0, Math.min(e.ts + e.dur, to) - Math.max(e.ts, from));
    let tasks = 0;
    for (const e of slices) {
      while (stack.length && stack.at(-1).ts + stack.at(-1).dur <= e.ts) stack.pop();
      const parent = stack.at(-1);
      if (parent) self.set(parent.name, (self.get(parent.name) ?? 0) - clip(e));
      else if (e.name === "RunTask" || e.name === "ThreadControllerImpl::RunTask") tasks += clip(e);
      self.set(e.name, (self.get(e.name) ?? 0) + clip(e));
      stack.push(e);
    }
    const bySelf = Object.fromEntries([...self.entries()].filter(([, us]) => us > 1000).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([name, us]) => [name, Math.round(us / 100) / 10]));
    // Each Layerize (full compositor update) with its offset from the input
    // and the other work in the same top-level task (what triggered the frame).
    const layerize = [];
    let task = null;
    const taskChildren = new Map();
    for (const e of slices) {
      if (e.name === "RunTask" || e.name === "ThreadControllerImpl::RunTask") { if (!task || e.ts >= task.ts + task.dur) task = e; }
      else if (task && e.ts < task.ts + task.dur) { const set = taskChildren.get(task) ?? new Set(); if (["TimerFire", "EventDispatch", "FunctionCall", "FireAnimationFrame", "Commit", "Layerize", "UpdateLayoutTree", "Layout", "Paint", "ParseHTML", "RunMicrotasks", "HandlePostMessage"].includes(e.name)) set.add(e.name + (e.args?.data?.type ? ":" + e.args.data.type : "") + (e.name === "FunctionCall" && e.dur > 1000 && e.args?.data?.url ? "@" + e.args.data.url.split("/").pop() + ":" + (e.args.data.lineNumber + 1) + ":" + (e.args.data.columnNumber + 1) + "(" + Math.round(e.dur / 1000) + "ms)" : "")); taskChildren.set(task, set); }
      if (e.name === "Layerize") layerize.push({ atMs: Math.round((e.ts - from) / 1000), ms: Math.round(e.dur / 1000), task: task ? [...(taskChildren.get(task) ?? [])].join(",") : "" });
    }
    return { traceTaskMs: Math.round(tasks / 1000), traceSelfMs: bySelf, layerize: layerize.filter((l) => l.ms >= 2) };
  }

  const results = {};
  let profileIndex = 0;
  const act = async (name, input) => {
    const runs = [];
    for (let r = 0; r < REPEAT; r++) {
      await sleep(2500);
      let offsetUs = 0;
      if (PROFILE_DIR) {
        await cdp.send("Profiler.enable");
        await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
        await cdp.send("Profiler.start");
      }
      const traceEvents = [];
      if (TRACE) {
        cdp.on("Tracing.dataCollected", (p) => traceEvents.push(...p.value));
        await cdp.send("Tracing.start", { categories: "devtools.timeline,disabled-by-default-devtools.timeline,blink.user_timing,v8.execute", transferMode: "ReportEvents" });
      }
      const before = await mark();
      await input(r);
      const run = await settle(before);
      if (TRACE) {
        const done = new Promise((resolve) => cdp.on("Tracing.tracingComplete", resolve));
        await cdp.send("Tracing.end");
        await done;
        Object.assign(run, traceBreakdown(traceEvents.splice(0)));
      }
      if (PROFILE_DIR) {
        const { profile } = await cdp.send("Profiler.stop");
        // Align: the profile clock is TimeTicks µs; performance.now() is ms since
        // timeOrigin. Calibrate with the profile's own Runtime.evaluate of mark().
        const nowT = await cdp.evaluate(`performance.now()`);
        offsetUs = profile.endTime - nowT * 1000; // endTime ≈ Profiler.stop; small (<5 ms) skew
        const window = busyWithin(profile, offsetUs, before.mark, run.firstPostT ?? before.mark);
        run.mainBusyMs = window.busyMs;
        if (r === 0) run.topSelf = window.top;
        mkdirSync(PROFILE_DIR, { recursive: true });
        writeFileSync(join(PROFILE_DIR, `${LABEL}-${surface.toLowerCase()}-${FIXTURE}-${name}-${r}-${profileIndex++}.cpuprofile`), JSON.stringify(profile));
      }
      if (MUTATIONS) {
        const all = await cdp.evaluate(`JSON.parse(JSON.stringify(window.__tspPerf.mutations.filter((m) => m.t >= ${before.mark} && m.t <= ${run.firstPostT ?? before.mark})))`);
        const grouped = new Map();
        for (const m of all) { const k = Math.round(m.t - before.mark) + "ms " + m.type + (m.attr ? ":" + m.attr : "") + " " + m.target; grouped.set(k, (grouped.get(k) ?? 0) + 1); }
        run.mutations = [...grouped.entries()].map(([k, n]) => (n > 1 ? n + "x " : "") + k).slice(0, 40);
        await cdp.evaluate(`(window.__tspPerf.mutations.length = 0, true)`);
      }
      delete run.firstPostT;
      runs.push(run);
      log(`${name}#${r}: ${JSON.stringify({ ...run, topSelf: undefined })}`);
    }
    const median = (key) => {
      const values = runs.map((run) => run[key]).filter((v) => typeof v === "number").sort((a, b) => a - b);
      return values.length ? values[Math.floor(values.length / 2)] : null;
    };
    results[name] = {
      median: Object.fromEntries(["inputToRequestMs", "requestToReplyMs", "inputToReplyMs", "inputToPaintedMs", "longTaskMs", "mainBusyMs", "traceTaskMs"].map((k) => [k, median(k)])),
      runs,
    };
  };

  // Each action pair keeps the manuscript unchanged overall: insert+Backspace,
  // Enter+undo, undo/redo pairs; the saved text is asserted at the end.
  const positions = surface === "WINDOWED"
    ? { head: "0", middle: "Math.floor(el.value.length / 2)", end: "el.value.length" }
    : { head: "0", middle: "Math.floor(el.value.length / 2)", end: "el.value.length" };

  // Head / middle of the mounted text (FULL: the manuscript; WINDOWED: 編集ページ 1).
  await setCaret(positions.middle);
  await act("insertMiddle", async () => { await INPUTS.insert(); });
  await act("backspaceMiddle", async () => { await INPUTS.backspace(); });
  await act("insertMiddleAgain", async () => { await INPUTS.insert(); });
  await act("undoInsert", async () => { await INPUTS.undo(); });
  await act("redoInsert", async () => { await INPUTS.redo(); });
  await act("enterMiddle", async () => { await INPUTS.enter(); });
  await act("undoEnter", async () => { await INPUTS.undo(); });
  // Net so far: REPEAT×(insert, backspace) cancel; insertMiddleAgain (REPEAT
  // chars) whose undo/redo cycles alternate per run; Enter/undo alternate.
  const afterMiddle = await editorValue();

  // Manuscript end (WINDOWED: mount the last 編集ページ first).
  const moveStarted = Date.now();
  if (surface === "WINDOWED") {
    for (let i = 0; i < 600; i++) {
      const moved = await cdp.evaluate(`(() => { const b = document.querySelector('button[aria-label="次の編集ページへ移動"]'); if (!b || b.disabled) return false; b.click(); return true; })()`);
      if (!moved) break;
      await sleep(100);
    }
  }
  const moveToEndMs = Date.now() - moveStarted;
  await setCaret(positions.end);
  await act("insertEnd", async () => { await INPUTS.insert(); });
  await act("backspaceEnd", async () => { await INPUTS.backspace(); });
  if (FIXTURE === "longtail") {
    await setCaret(surface === "WINDOWED" ? "Math.max(0, el.value.length - 5000)" : "el.value.length - 10000");
    await act("insertLongParagraph", async () => { await INPUTS.insert(); });
    await act("backspaceLongParagraph", async () => { await INPUTS.backspace(); });
  }

  // Data safety: the saved manuscript equals the editor's own text, and the
  // net edit is exactly what the action sequence implies.
  await sleep(2500);
  await cdp.waitFor(`!!document.querySelector('[data-editor-save-status="saved"]')`, { timeoutMs: 60_000, label: "saved" });
  const saved = await savedContent();
  const finalText = surface === "WINDOWED" ? null : await editorValue();
  if (finalText !== null) assert.equal(saved, finalText, "saved manuscript equals the FULL editor text");
  // The net effect of the sequence depends on how the surface coalesces
  // undo steps, so assert the invariant instead: against the SEEDED
  // manuscript, nothing but the probe's own "あ" / line breaks was added, in
  // bounded number, and every other character is intact and in order.
  const count = (text, ch) => text.split(ch).length - 1;
  const extraA = count(saved, "あ") - count(content, "あ");
  const extraLf = count(saved, "\n") - count(content, "\n");
  assert.ok(extraA >= 0 && extraA <= 2 * REPEAT + 2, `only the probe's own inserts were added (extra あ=${extraA})`);
  assert.ok(extraLf >= 0 && extraLf <= REPEAT + 1, `only the probe's own line breaks were added (extra LF=${extraLf})`);
  assert.equal(saved.length, content.length + extraA + extraLf, "no other character was added or lost");
  assert.equal(saved.replaceAll("あ", "").replaceAll("\n", ""), content.replaceAll("あ", "").replaceAll("\n", ""), "every other character is intact and in order");
  const finalPages = await cdp.evaluate(`Number(document.querySelector('[data-preview-total-pages]')?.getAttribute('data-preview-total-pages') ?? -1)`);

  const report = { label: LABEL, fixture: FIXTURE, surface, chars: content.length, repeat: REPEAT, openMs, moveToEndMs, pagesShown, finalPages, middleLength: afterMiddle.length, results };
  mkdirSync("scripts/perf/results", { recursive: true });
  const outFile = `scripts/perf/results/browser-main-thread-${LABEL}-${surface.toLowerCase()}-${FIXTURE}.json`;
  writeFileSync(outFile, JSON.stringify(report, null, 2) + "\n");
  log(`summary ${JSON.stringify(Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.median])))}`);
  log(`wrote ${outFile}`);
  log("PASS main-thread preview request probe");
} finally {
  await session.close();
}
