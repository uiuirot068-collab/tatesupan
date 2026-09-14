/**
 * TSP-REAL-MANUSCRIPT-END-INPUT-FORENSIC-004 — temporary, local-only
 * diagnostic instrumentation. Enabled ONLY by `?perfDebug=1` in the URL;
 * every function here is a near-zero-cost no-op otherwise (a single
 * boolean check, no allocation). Never logs manuscript text, titles, or
 * any user-identifying data — only timestamps, labels, and small numeric/
 * boolean detail fields the call sites pass in explicitly.
 *
 * Deliberately no "use client" / no `window` dependency at module scope:
 * this is also imported from `v2Preview.worker.ts`, which runs in a
 * separate JS realm (own module instances, own `marks` array, no
 * `window`). `location` is available in both a page and a dedicated
 * worker, so it's used directly instead. The worker's own marks are
 * merged back into the main thread's array via `mergePerfMarks` when its
 * response arrives (see useV2PreviewAdapter.ts) -- otherwise they'd be
 * silently lost in a realm the panel never sees.
 *
 * Not wired into any permanent UI. Remove this file and its call sites
 * once the end-of-document stall is root-caused.
 */

export interface PerfMarkDetail {
  [key: string]: string | number | boolean | null | undefined;
}

interface PerfMark {
  t: number;
  label: string;
  detail?: PerfMarkDetail;
}

let enabledCache: boolean | null = null;

export function isPerfDebugEnabled(): boolean {
  if (enabledCache !== null) return enabledCache;
  if (typeof location === "undefined") return false;
  enabledCache = new URLSearchParams(location.search).get("perfDebug") === "1";
  return enabledCache;
}

/**
 * TSP-EDITOR-NATIVE-SURFACE-AB-006 — which diagnostic-only editor surface
 * variant to render, selected via `?perfDebug=1&editorProbe=<mode>`. Only
 * meaningful when `isPerfDebugEnabled()`; callers must gate on that
 * themselves so a probe mode can never activate in normal product use.
 */
export type EditorProbeMode = "normal" | "no-spellcheck" | "nowrap" | "uncontrolled-shadow" | "windowed";
const EDITOR_PROBE_MODES: readonly EditorProbeMode[] = ["normal", "no-spellcheck", "nowrap", "uncontrolled-shadow", "windowed"];
let probeModeCache: EditorProbeMode | null = null;

export function getEditorProbeMode(): EditorProbeMode {
  if (probeModeCache !== null) return probeModeCache;
  if (typeof location === "undefined") return "normal";
  const raw = new URLSearchParams(location.search).get("editorProbe");
  probeModeCache = (EDITOR_PROBE_MODES as readonly string[]).includes(raw ?? "")
    ? (raw as EditorProbeMode)
    : "normal";
  return probeModeCache;
}

const MAX_MARKS = 4000;
const marks: PerfMark[] = [];
let longtaskObserverStarted = false;

export function perfMark(label: string, detail?: PerfMarkDetail): void {
  if (!isPerfDebugEnabled()) return;
  marks.push({ t: performance.now(), label, detail });
  if (marks.length > MAX_MARKS) marks.shift();
}

/** Wrap a synchronous or async span: `const end = perfSpan("x"); ...; end({extra:1});` */
export function perfSpan(label: string, startDetail?: PerfMarkDetail): (endDetail?: PerfMarkDetail) => void {
  if (!isPerfDebugEnabled()) return () => {};
  const t0 = performance.now();
  perfMark(`${label}:start`, startDetail);
  return (endDetail?: PerfMarkDetail) => {
    const durMs = Math.round((performance.now() - t0) * 10) / 10;
    perfMark(`${label}:end`, { ...(endDetail ?? {}), durMs });
  };
}

/** Starts a PerformanceObserver for long tasks (>=50ms). Safe to call repeatedly; only attaches once. */
export function ensureLongtaskObserver(): void {
  if (!isPerfDebugEnabled() || longtaskObserverStarted) return;
  if (typeof PerformanceObserver === "undefined") return;
  longtaskObserverStarted = true;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        perfMark("longtask", { durMs: Math.round(entry.duration * 10) / 10, startMs: Math.round(entry.startTime * 10) / 10 });
      }
    });
    observer.observe({ entryTypes: ["longtask"] });
  } catch {
    // longtask entry type unsupported in this browser -- silently skip.
  }
}

export function clearPerfMarks(): void {
  marks.length = 0;
}

export function perfMarkCount(): number {
  return marks.length;
}

/** Worker-side: snapshot this realm's marks for transfer via postMessage. */
export function exportPerfMarks(): PerfMark[] {
  return marks.slice();
}

/** Main-thread side: merge marks captured in another realm (the V2 worker) back in, then re-sort by time. */
export function mergePerfMarks(foreignMarks: PerfMark[] | undefined | null, sourceLabel: string): void {
  if (!isPerfDebugEnabled() || !foreignMarks || foreignMarks.length === 0) return;
  for (const m of foreignMarks) marks.push({ ...m, label: `[${sourceLabel}] ${m.label}` });
  marks.sort((a, b) => a.t - b.t);
  if (marks.length > MAX_MARKS) marks.splice(0, marks.length - MAX_MARKS);
}

/** Builds the plain-text report. `meta` is caller-supplied and must never contain manuscript text. */
export function getPerfReport(meta: PerfMarkDetail): string {
  const header = [
    "# TSP perf report (TSP-REAL-MANUSCRIPT-END-INPUT-FORENSIC-004)",
    `generatedAt: ${new Date().toISOString()}`,
    `meta: ${JSON.stringify(meta)}`,
    "",
    "t_ms\tlabel\tdetail",
  ];
  const rows = marks.map((m) => `${m.t.toFixed(1)}\t${m.label}\t${m.detail ? JSON.stringify(m.detail) : ""}`);
  return [...header, ...rows].join("\n");
}

if (typeof window !== "undefined") {
  // Console-accessible escape hatch in case the on-page panel can't be used.
  // (Guarded on `window`, not just `location`, so this block never runs
  // inside the worker realm -- it has no window, only `self`.)
  (window as unknown as { __tspPerfDebug?: unknown }).__tspPerfDebug = {
    isEnabled: isPerfDebugEnabled,
    getReport: getPerfReport,
    clear: clearPerfMarks,
    count: perfMarkCount,
  };
}
