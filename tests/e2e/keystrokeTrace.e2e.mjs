// Explicit-run profile for Phase 9: where does the ~100 ms keystroke floor go?
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 [TATESPUN_PERF_PAGES=50] \
//     node tests/e2e/keystrokeTrace.e2e.mjs
//
// Opens a ~N-page document, waits until it is idle, then records a Chrome
// performance trace (devtools.timeline) around single keystrokes typed at the
// manuscript end, two ways:
//   probe   the Phase 7/8 probe's path: value setter + InputEvent, timed to
//           requestAnimationFrame → setTimeout(0) ("keystroke → next frame")
//   native  CDP Input.insertText (beforeinput/input from the browser itself),
//           timed the same way from the page
// For each keystroke window it sums main-thread trace events by kind (input
// event dispatch, script by function-call source, style, layout, paint,
// compositing, GC) and reports the part of the window with no main-thread work
// (waiting for a frame). Prints JSON; asserts nothing about time.
import { writeFileSync, mkdirSync } from "node:fs";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";
import { sleep } from "./helpers/cdp.mjs";

const target = resolveE2eTarget(process.env, "keystroke trace");
const PAGES = Number(process.env.TATESPUN_PERF_PAGES ?? 50);
const LABEL = process.env.TATESPUN_PERF_LABEL ?? "local";
const session = await launchEditorSession("tatespun-keystroke-trace-");
const { cdp } = session;
const log = (line) => console.log(line);

function manuscript(pages) {
  const target = Math.round(pages * 592 * 0.8);
  const parts = [];
  let length = 0;
  for (let i = 0; length < target; i++) {
    const para = `　段落${i}。春の宵、窓辺に置いた硝子の瓶が淡い光を返していた。彼女は古い手紙を読み返し、ふと遠い町のことを思い出す。`;
    parts.push(para);
    length += para.length + 1;
  }
  return parts.join("\n");
}

const CATEGORIES = ["devtools.timeline", "disabled-by-default-devtools.timeline", "v8", "blink.user_timing", "toplevel"].join(",");

// One collector for every trace (the CDP helper has no `off`).
let traceEvents = [];
let traceDone = () => undefined;
cdp.on("Tracing.dataCollected", (params) => traceEvents.push(...params.value));
cdp.on("Tracing.tracingComplete", () => traceDone());

async function traced(fn) {
  traceEvents = [];
  await cdp.send("Tracing.start", { categories: CATEGORIES, transferMode: "ReportEvents" });
  const result = await fn();
  const done = new Promise((resolve) => { traceDone = resolve; });
  await cdp.send("Tracing.end");
  await done;
  return { result, events: traceEvents };
}

const KIND = (name, data) => {
  if (name === "EventDispatch") return `event:${data?.type ?? "?"}`;
  if (name === "FunctionCall" || name === "EvaluateScript" || name === "v8.callFunction") return "script";
  if (name === "TimerFire") return "timer";
  if (name === "FireAnimationFrame") return "rAF";
  if (name === "RunMicrotasks" || name === "v8.runMicrotasks") return "microtasks";
  if (name === "UpdateLayoutTree" || name === "RecalculateStyles") return "style";
  if (name === "Layout") return "layout";
  if (name === "PrePaint" || name === "Paint" || name === "PaintImage" || name === "RasterTask") return "paint";
  if (name === "Layerize" || name === "UpdateLayer" || name === "UpdateLayerTree" || name === "Commit" || name === "CompositeLayers") return "composite";
  if (name.startsWith("MajorGC") || name.startsWith("MinorGC") || name === "V8.GC_SCAVENGER" || name.includes("GCEvent")) return "gc";
  if (name === "HitTest") return "hittest";
  return null;
};

/** Top-level main-thread work in [start, end] (µs), attributed to the outermost recognised kind. */
function attribute(events, startUs, endUs) {
  const main = events.filter((e) => e.ph === "X" && e.dur && e.ts >= startUs && e.ts <= endUs && e.name !== "RunTask");
  const tids = new Map();
  for (const e of events) if (e.name === "thread_name" && e.args?.name === "CrRendererMain") tids.set(`${e.pid}:${e.tid}`, true);
  const onMain = main.filter((e) => tids.has(`${e.pid}:${e.tid}`)).sort((a, b) => a.ts - b.ts || b.dur - a.dur);
  const totals = {};
  const byName = {};
  let busyUntil = -Infinity;
  let busy = 0;
  // Outermost recognised events only (children are included in their parent's duration).
  const stack = [];
  for (const e of onMain) {
    while (stack.length && stack.at(-1).ts + stack.at(-1).dur <= e.ts) stack.pop();
    const kind = KIND(e.name, e.args?.data);
    if (!kind) continue;
    if (stack.length === 0) {
      totals[kind] = (totals[kind] ?? 0) + e.dur / 1000;
      if (kind === "composite" || kind === "paint" || kind === "layout") byName[e.name] = (byName[e.name] ?? 0) + e.dur / 1000;
      const end = e.ts + e.dur;
      busy += Math.max(0, end - Math.max(e.ts, busyUntil));
      busyUntil = Math.max(busyUntil, end);
    }
    stack.push(e);
  }
  // Script time broken down by the event that ran it.
  const scriptByParent = {};
  for (const e of onMain.filter((x) => x.name === "FunctionCall")) {
    const src = e.args?.data?.url ? `${e.args.data.functionName || "(anon)"}@${String(e.args.data.url).split("/").pop()?.split("?")[0]}` : e.args?.data?.functionName || "?";
    scriptByParent[src] = (scriptByParent[src] ?? 0) + e.dur / 1000;
  }
  const round = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round(v * 10) / 10]));
  return { windowMs: Math.round((endUs - startUs) / 100) / 10, mainBusyMs: Math.round(busy / 100) / 10, idleMs: Math.round((endUs - startUs - busy) / 100) / 10, byKind: round(totals), renderingByEvent: round(byName), topScripts: Object.fromEntries(Object.entries(round(scriptByParent)).slice(0, 8)) };
}

try {
  await session.setViewport(1280, 900);
  await cdp.send("Page.navigate", { url: target.url("/editor") });
  await cdp.waitFor(`/[?&]id=\\d+/.test(location.search) && !!document.querySelector('[data-editor-save-status="saved"]')`, { timeoutMs: 90_000, label: "bootstrap editor" });
  const docId = 780001;
  await cdp.evaluate(`new Promise((resolve, reject) => {
    const open = indexedDB.open("tategaki-editor-db");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(["documents"], "readwrite");
      tx.objectStore("documents").put({ id: ${docId}, title: "trace", content: ${JSON.stringify(manuscript(PAGES))}, plotNote: "", updatedAt: Date.now() });
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => reject(tx.error);
    };
  })`);
  await cdp.send("Page.navigate", { url: target.url(`/editor?id=${docId}`) });
  await cdp.waitFor(`!!document.querySelector('[data-editor-save-status="saved"]') && Number(document.querySelector('[data-preview-total-pages]')?.getAttribute('data-preview-total-pages') ?? 0) > 1`, { timeoutMs: 120_000, label: "first layout" });
  const surface = await cdp.evaluate(`document.querySelector('[data-editor-page-navigator]') ? "WINDOWED" : "FULL"`);
  if (surface === "WINDOWED") {
    for (let i = 0; i < 20; i++) {
      const moved = await cdp.evaluate(`(() => { const b = document.querySelector('button[aria-label="次の編集ページへ移動"]'); if (!b || b.disabled) return false; b.click(); return true; })()`);
      if (!moved) break;
      await sleep(300);
    }
  }
  await sleep(4000);
  // Frame cadence while idle: is the next frame itself slow in this browser?
  const idleFrame = await cdp.evaluate(`new Promise((resolve) => { const s = performance.now(); requestAnimationFrame(() => setTimeout(() => resolve(performance.now() - s), 0)); })`);

  const results = [];
  // Diagnostic only: the last two keystrokes run with the Preview spreads
  // hidden (display:none), to see how much of the frame the Preview's paint
  // output causes. Nothing in the product changes.
  for (const mode of ["probe", "native", "probe", "native", "probe-preview-hidden", "native-preview-hidden"]) {
    if (mode === "probe-preview-hidden") {
      await cdp.evaluate(`document.querySelectorAll('[data-preview-spread]').forEach((el) => { el.style.display = 'none'; })`);
    }
    await sleep(3000); // idle: no pending layout or autosave
    await cdp.evaluate(`(() => { const el = document.querySelector('[data-demo-target="editor"]'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); })()`);
    const { result, events } = await traced(async () => {
      if (mode.startsWith("probe")) {
        return cdp.evaluate(`new Promise((resolve) => {
          const el = document.querySelector('[data-demo-target="editor"]');
          const start = performance.now();
          performance.mark("tsp-key-start");
          Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, el.value + "い");
          el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: "い" }));
          requestAnimationFrame(() => setTimeout(() => { performance.mark("tsp-key-end"); resolve(performance.now() - start); }, 0));
        })`);
      }
      await cdp.evaluate(`(() => { performance.mark("tsp-key-start"); window.__tspKeyStart = performance.now(); })()`);
      await cdp.send("Input.insertText", { text: "い" });
      return cdp.evaluate(`new Promise((resolve) => requestAnimationFrame(() => setTimeout(() => { performance.mark("tsp-key-end"); resolve(performance.now() - window.__tspKeyStart); }, 0)))`);
    });
    const mark = (name) => events.find((e) => e.name === name && (e.cat ?? "").includes("blink.user_timing"));
    const start = mark("tsp-key-start");
    const end = mark("tsp-key-end");
    const attribution = start && end ? attribute(events, start.ts, end.ts) : null;
    results.push({ mode, frameMs: Math.round(result), ...attribution });
    log(`${mode}: ${Math.round(result)} ms ${JSON.stringify(attribution)}`);
  }
  const report = { label: LABEL, pages: PAGES, surface, idleFrameMs: Math.round(idleFrame), results };
  console.log(JSON.stringify(report, null, 2));
  mkdirSync("scripts/perf/results", { recursive: true });
  writeFileSync(`scripts/perf/results/keystroke-trace-${LABEL}-${PAGES}p.json`, JSON.stringify(report, null, 2));
} finally {
  await session.close();
}
