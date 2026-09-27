// Explicit-run browser benchmark for Phase 9 (export worker offload).
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 [TATESPUN_PERF_PAGES=100] \
//     [TATESPUN_PERF_EXPORTS=pdf,pdf-repeat,jpg,zip] node tests/e2e/exportWorkerPerf.e2e.mjs
//
// Seeds a local document of ~N pages with three image markers (an opaque
// colour PNG twice, and a semi-transparent PNG stacked on the first with an
// explicit layer order) and runs the chosen exports through the real UI:
//   pdf         全ページ PDF (default mode), continuing past the odd-page warning
//   pdf-repeat  the same PDF again (same layout)
//   jpg         JPG of the first page (single page)
//   zip         JPG ZIP of every body page
// For each: wall time (click → download complete), main-thread long tasks
// during the export (count, total, max), a heartbeat (largest gap between
// 50 ms main-thread timers) and a SHA-256 of the output — the PDF normalized
// for CreationDate/ModDate/ID, the ZIP per entry. It works on pre- and
// post-Phase-9 builds, so two builds can be compared for identical output.
// Asserts only that every export finished; never a duration.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import { encode } from "fast-png";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";
import { sleep } from "./helpers/cdp.mjs";

const target = resolveE2eTarget(process.env, "export worker perf");
const PAGES = Number(process.env.TATESPUN_PERF_PAGES ?? 100);
const LABEL = process.env.TATESPUN_PERF_LABEL ?? "local";
const EXPORTS = (process.env.TATESPUN_PERF_EXPORTS ?? "pdf,pdf-repeat,jpg,zip").split(",");
const session = await launchEditorSession("tatespun-export-perf-");
const { cdp } = session;
const log = (line) => console.log(line);
// Failure modes that would otherwise hang the probe (Phase 9: the 300p PDF
// runs crashed the renderer and the first probe waited 20 minutes):
//  - an export error surfaces as alert(): record it, dismiss it, fail the export;
//  - a renderer crash (Inspector.targetCrashed): fail at once;
//  - no download within TATESPUN_PERF_EXPORT_TIMEOUT_MS (default 10 min): fail.
const EXPORT_TIMEOUT_MS = Number(process.env.TATESPUN_PERF_EXPORT_TIMEOUT_MS ?? 600_000);
const dialogs = [];
let crashed = false;
cdp.on("Page.javascriptDialogOpening", (params) => {
  dialogs.push(params.message);
  void cdp.send("Page.handleJavaScriptDialog", { accept: true });
});
cdp.on("Inspector.targetCrashed", () => {
  crashed = true;
});
await cdp.send("Inspector.enable");
/** An evaluate that cannot hang on a dead or blocked renderer. */
const probe = (expression, ms = 3_000) =>
  Promise.race([cdp.evaluate(expression).catch(() => null), new Promise((resolve) => setTimeout(() => resolve(null), ms))]);

await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
  source: `(() => {
    const perf = window.__tspExport = { longTasks: [], beats: [], layouts: 0 };
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(url, options);
        this.addEventListener("message", (event) => {
          const data = event.data;
          if (data && data.type === "complete" && ("layout" in data || "bridge" in data)) perf.layouts += 1;
        });
      }
    };
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) perf.longTasks.push({ t: entry.startTime, d: entry.duration });
      }).observe({ type: "longtask", buffered: true });
    } catch {}
    const beat = () => { perf.beats.push(performance.now()); if (perf.beats.length > 200000) perf.beats.splice(0, 100000); setTimeout(beat, 50); };
    beat();
  })();`,
});

function pngDataUrl(width, height, channels, pixel) {
  const data = new Uint8Array(width * height * channels);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * channels);
  return `data:image/png;base64,${Buffer.from(encode({ width, height, channels, depth: 8, data })).toString("base64")}`;
}
const OPAQUE = pngDataUrl(8, 6, 3, (x, y) => [x * 30, y * 40, 200 - x * 20]);
const ALPHA = pngDataUrl(6, 6, 4, (x, y) => [250 - x * 30, 60 + y * 30, 90, 60 + x * 30]);

function manuscript(pages) {
  const sentences = [
    "春の宵、窓辺に置いた硝子の瓶が淡い光を返していた。",
    "彼女は古い手紙を読み返し、｜硝子《がらす》の《《欠片》》を見つめる――",
    "「もう一度だけ、あの坂を上ってみようか」と彼は言った……。",
    "雨上がりの路地には、濡れた石畳の匂いが満ちている。",
    "時計の針は止まったまま、部屋の隅で静かに眠っていた。",
  ];
  const target = Math.round(pages * 592 * 0.8);
  const parts = [];
  let length = 0;
  for (let i = 0; length < target; i += 3) {
    let para = "　" + sentences[i % 5] + sentences[(i + 1) % 5] + sentences[(i + 2) % 5];
    if (parts.length === 3) para += "\n【IMG:exp-a:30:20:center】【IMG:exp-b:30:20:center】";
    if (parts.length === 60) para += "\n【IMG:exp-a:30:20:center】";
    parts.push(para);
    length += para.length + 1;
  }
  return parts.join("\n");
}

const normalizePdf = (bytes) =>
  Buffer.from(bytes)
    .toString("latin1")
    .replace(/\/(CreationDate|ModDate) \(D:[^)]*\)/g, "")
    .replace(/\/ID \[\s*<[0-9A-Fa-f]+>\s*<[0-9A-Fa-f]+>\s*\]/g, "");
const sha = (value) => createHash("sha256").update(value).digest("hex").slice(0, 16);

try {
  await session.setViewport(1280, 900);
  await cdp.send("Page.navigate", { url: target.url("/editor") });
  await cdp.waitFor(`/[?&]id=\\d+/.test(location.search) && !!document.querySelector('[data-editor-save-status="saved"]')`, { timeoutMs: 90_000, label: "bootstrap editor" });
  const content = manuscript(PAGES);
  const docId = 778001;
  await cdp.evaluate(`new Promise((resolve, reject) => {
    const open = indexedDB.open("tategaki-editor-db");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(["documents", "images"], "readwrite");
      tx.objectStore("documents").put({ id: ${docId}, title: "export", content: ${JSON.stringify(content)}, plotNote: "", updatedAt: Date.now() });
      tx.objectStore("images").put({ id: "exp-a", dataUrl: ${JSON.stringify(OPAQUE)}, createdAt: Date.now(), layerOrder: 2 });
      tx.objectStore("images").put({ id: "exp-b", dataUrl: ${JSON.stringify(ALPHA)}, createdAt: Date.now(), layerOrder: 1 });
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => reject(tx.error);
    };
  })`);
  await cdp.send("Page.navigate", { url: target.url(`/editor?id=${docId}`) });
  await cdp.waitFor(`document.querySelector('[data-editor-save-status="saved"]') && window.__tspExport.layouts >= 1`, { timeoutMs: 180_000, label: "first V2 layout" });
  await sleep(3000);
  const previewPages = await cdp.evaluate(`Number(document.querySelector('[data-preview-total-pages]')?.getAttribute('data-preview-total-pages') ?? -1)`);
  log(`opened ${PAGES}p document; preview pages=${previewPages}`);
  await cdp.send("Performance.enable").catch(() => {});
  const heapMb = async () => {
    await cdp.send("HeapProfiler.collectGarbage").catch(() => {});
    const { metrics } = await cdp.send("Performance.getMetrics");
    return Math.round((metrics.find((m) => m.name === "JSHeapUsedSize")?.value ?? 0) / 1048576);
  };

  const click = (selector) => cdp.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
  const clickText = (selector, text) =>
    cdp.evaluate(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((b) => b.textContent.trim() === ${JSON.stringify(text)}); if (!el) return false; el.click(); return true; })()`);
  const openMenuEntry = async (id) => {
    await click('[data-demo-target="export"]');
    await cdp.waitFor(`!!document.querySelector('[data-export-menu-entry="${id}"]')`, { label: `export menu ${id}` });
    await click(`[data-export-menu-entry="${id}"]`);
  };

  async function runExport(kind) {
    await sleep(2000);
    const completedBefore = session.downloads.filter((d) => d.state === "completed").length;
    const started = await cdp.evaluate(`performance.now()`);
    const wallStarted = Date.now();
    if (kind === "pdf" || kind === "pdf-repeat") {
      await openMenuEntry("pdf");
      await cdp.waitFor(`!!document.querySelector('[data-pdf-export-setup-modal]')`, { label: "PDF setup modal" });
      assert.ok(await clickText("[data-pdf-export-setup-modal] button", "ダウンロード"), "ダウンロード button");
      // Odd page counts ask first; continue exactly once.
      const warned = await cdp
        .waitFor(`!!document.querySelector('[data-pdf-odd-page-warning]')`, { timeoutMs: 8_000, label: "odd-page warning" })
        .then(() => true, () => false);
      if (warned) await click('[data-pdf-odd-page-warning-action="continue"]');
    } else {
      await openMenuEntry(kind === "jpg" ? "jpg" : "jpg-zip");
    }
    const deadline = Date.now() + EXPORT_TIMEOUT_MS;
    let download = null;
    const dialogsBefore = dialogs.length;
    let progress = null;
    let lastSample = 0;
    while (!download && Date.now() < deadline) {
      if (dialogs.length > dialogsBefore) throw new Error(`${kind} export failed with a dialog: ${dialogs.at(-1)}`);
      if (crashed) throw new Error(`${kind} export: the renderer crashed (last progress: ${progress ?? "none"}, after ${Date.now() - wallStarted} ms)`);
      download = session.downloads.filter((d) => d.state === "completed")[completedBefore] ?? null;
      if (!download && Date.now() - lastSample > 5_000) {
        lastSample = Date.now();
        progress = (await probe(`document.querySelector('[data-demo-target="export"]')?.textContent.trim()`)) ?? progress;
      }
      if (!download) await sleep(200);
    }
    assert.ok(download, `${kind} export finished within ${EXPORT_TIMEOUT_MS} ms (last progress: ${progress ?? "none"})`);
    const wallMs = Date.now() - wallStarted;
    await sleep(500);
    const perf = await cdp.evaluate(`(() => { const p = window.__tspExport; const s = ${started}; return { tasks: p.longTasks.filter((t) => t.t >= s), beats: p.beats.filter((b) => b >= s) }; })()`);
    let maxGap = 0;
    for (let i = 1; i < perf.beats.length; i++) maxGap = Math.max(maxGap, perf.beats[i] - perf.beats[i - 1]);
    const bytes = readFileSync(download.filePath ?? join(session.downloadDir, download.name));
    let output;
    if (kind === "zip") {
      const zip = await JSZip.loadAsync(bytes);
      const entries = {};
      for (const name of Object.keys(zip.files).sort()) entries[name] = sha(await zip.files[name].async("nodebuffer"));
      output = { jpgs: Object.keys(entries).length, entriesSha: sha(JSON.stringify(entries)), entries };
    } else if (kind === "jpg") {
      output = { bytes: bytes.length, sha: sha(bytes) };
    } else {
      assert.equal(bytes.subarray(0, 5).toString("latin1"), "%PDF-", "a real PDF");
      output = { bytes: bytes.length, normalizedSha: sha(normalizePdf(bytes)), pages: (normalizePdf(bytes).match(/\/Type \/Page\b/g) ?? []).length };
    }
    const result = {
      kind,
      wallMs,
      longTaskCount: perf.tasks.length,
      longTaskTotalMs: Math.round(perf.tasks.reduce((sum, t) => sum + t.d, 0)),
      longTaskMaxMs: Math.round(Math.max(0, ...perf.tasks.map((t) => t.d))),
      maxHeartbeatGapMs: Math.round(maxGap),
      heapAfterMb: await heapMb(),
      ...output,
    };
    log(`${kind}: ${JSON.stringify({ ...result, entries: undefined })}`);
    return result;
  }

  const results = [];
  for (const kind of EXPORTS) {
    try {
      results.push(await runExport(kind));
    } catch (error) {
      const failed = { kind, failed: error instanceof Error ? error.message : String(error) };
      log(`${kind}: FAILED ${failed.failed}`);
      results.push(failed);
      if (crashed) break; // nothing more can run in a crashed tab
    }
  }
  const report = { label: LABEL, pages: PAGES, previewPages, results };
  mkdirSync("scripts/perf/results", { recursive: true });
  writeFileSync(`scripts/perf/results/export-${LABEL}-${PAGES}p.json`, JSON.stringify(report, null, 2));
  log("export worker perf: DONE");
  if (results.some((result) => result.failed)) process.exitCode = 1;
} finally {
  await session.close();
}
