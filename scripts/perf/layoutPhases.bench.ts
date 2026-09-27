/**
 * Phase 9: where one V2 layout's time goes, as shares of the worker's work for
 * one layout (compose + Preview paint document + page model + delta encode).
 * Uses an inspector CPU profile of `composeV2Layout` and sums the inclusive
 * time under each stage function, so no source instrumentation is needed.
 * Never asserts.
 *
 * Run: TATESPUN_PERF_LAYOUT_PHASES=1 npx vitest run --config scripts/perf/vitest.config.ts layoutPhases -t "layout phases"
 * Env: TATESPUN_PERF_PHASE_PAGES=300,500 (default), TATESPUN_PERF_LABEL.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { Session, type Profiler } from "node:inspector";
import { resolve } from "node:path";
import { it } from "vitest";
import { DEFAULT_PAGE_SETTINGS } from "@/lib/pageLayout";
import { composeV2Layout } from "@/lib/v2Bridge/composeV2Document";
import { buildLivePreviewDocument } from "@/lib/v2Bridge/previewWorkerProtocol";
import { buildV2PreviewPageModel } from "@/lib/v2Bridge/previewPageModel";
import { buildV2PreviewDocument } from "@/lib/v2Bridge/buildV2PreviewDocument";
import { encodePreviewTransfer } from "@/lib/v2Bridge/previewDelta";
import { createShipporiMinchoMeasurementProvider } from "../../typesetting-v2/core/measurement/shipporiMinchoProvider";
import { syntheticManuscript } from "./longManuscript.bench";

const run = process.env.TATESPUN_PERF_LAYOUT_PHASES === "1" ? it : it.skip;
const PAGES = (process.env.TATESPUN_PERF_PHASE_PAGES ?? "300,500").split(",").map(Number);

/** Stage → function names whose inclusive time is that stage (outermost match wins). */
const STAGES: Record<string, string[]> = {
  "adapter (tokenize + units)": ["buildV2UnitsFromManuscript"],
  "Core compose (line breaking, pagination)": ["composeCanonicalDocument"],
  "page overrides": ["applyEditorPageOverrides"],
  "Publication model (export only)": ["buildPublicationDocument"],
};

function post<T>(session: Session, method: string, params?: object): Promise<T> {
  return new Promise((resolvePost, reject) => session.post(method, params ?? {}, (error, result) => (error ? reject(error) : resolvePost(result as T))));
}

function inclusiveByStage(profile: Profiler.Profile): Record<string, number> {
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const self = new Map<number, number>();
  profile.samples!.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas![i] ?? 0)));
  const totals: Record<string, number> = {};
  const walk = (id: number, stage: string | null) => {
    const node = nodes.get(id)!;
    const name = node.callFrame.functionName;
    const own = stage ?? Object.keys(STAGES).find((key) => STAGES[key].includes(name)) ?? null;
    if (own) totals[own] = (totals[own] ?? 0) + (self.get(id) ?? 0) / 1000;
    for (const child of node.children ?? []) walk(child, own);
  };
  walk(profile.nodes[0].id, null);
  return totals;
}

run("layout phases", async () => {
  const measurement = createShipporiMinchoMeasurementProvider(resolve("public/fonts/ShipporiMincho-Regular.ttf"));
  const session = new Session();
  session.connect();
  await post(session, "Profiler.enable");
  await post(session, "Profiler.setSamplingInterval", { interval: 200 });
  const rows: Record<string, unknown>[] = [];
  for (const pages of PAGES) {
    const content = syntheticManuscript(pages);
    const compose = () => composeV2Layout({ title: "Bench", content, settings: DEFAULT_PAGE_SETTINGS, measurement });
    compose(); // warm-up
    await post(session, "Profiler.start");
    let started = performance.now();
    const layout = compose();
    const composeMs = performance.now() - started;
    const { profile } = await post<{ profile: Profiler.Profile }>(session, "Profiler.stop");
    buildV2PreviewDocument(layout, {}); // warm-up
    started = performance.now();
    buildV2PreviewDocument(layout, {});
    const rawPreviewMs = performance.now() - started;
    started = performance.now();
    const preview = buildLivePreviewDocument(layout);
    const previewMs = performance.now() - started;
    started = performance.now();
    buildV2PreviewPageModel(layout, content);
    const pageModelMs = performance.now() - started;
    const next = buildLivePreviewDocument(compose()); // same input: every page reusable, i.e. the full comparison cost
    started = performance.now();
    encodePreviewTransfer(next, { layoutId: 1, document: preview });
    const deltaEncodeMs = performance.now() - started;
    const stages = inclusiveByStage(profile);
    const profiled = Object.values(stages).reduce((sum, ms) => sum + ms, 0);
    const workerTotal = composeMs + previewMs + pageModelMs + deltaEncodeMs;
    const share = (ms: number) => `${Math.round((ms / workerTotal) * 1000) / 10}%`;
    // Profile stage times are scaled to the unprofiled wall time of the same compose.
    const scale = composeMs / Math.max(profiled, 1);
    const row: Record<string, unknown> = { pages, workerTotalMs: Math.round(workerTotal) };
    for (const [stage, ms] of Object.entries(stages)) row[stage] = `${Math.round(ms * scale)} ms (${share(ms * scale)})`;
    row["compose, other"] = `${Math.round(composeMs - profiled * scale)} ms`;
    row["Preview paint document"] = `${Math.round(previewMs)} ms (${share(previewMs)})`;
    row["of which: raw paint document (before live normalization)"] = `${Math.round(rawPreviewMs)} ms`;
    row["page model"] = `${Math.round(pageModelMs)} ms (${share(pageModelMs)})`;
    row["delta encode (worst case: all pages equal)"] = `${Math.round(deltaEncodeMs)} ms (${share(deltaEncodeMs)})`;
    rows.push(row);
    console.log(JSON.stringify(row, null, 2));
  }
  session.disconnect();
  const label = process.env.TATESPUN_PERF_LABEL ?? "layout-phases-local";
  mkdirSync(resolve("scripts/perf/results"), { recursive: true });
  writeFileSync(resolve(`scripts/perf/results/${label}.json`), JSON.stringify(rows, null, 2));
});
