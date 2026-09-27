/**
 * Phase 9: Preview delta vs full snapshot for a one-character edit. Never asserts.
 *
 * For each size: compose, then compose again with one character inserted in
 * the middle of the manuscript; measure the reply (v8.serialize = postMessage
 * wire size), its structuredClone (the main-thread deserialize stand-in), the
 * worker-side encode (page comparison) and the main-thread apply.
 *
 * Run: TATESPUN_PERF_PREVIEW_DELTA=1 npx vitest run --config scripts/perf/vitest.config.ts previewDelta -t "Preview delta"
 * Env: TATESPUN_PERF_DELTA_PAGES=50,100,300,500 (default), TATESPUN_PERF_LABEL.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { serialize } from "node:v8";
import { it } from "vitest";
import { DEFAULT_PAGE_SETTINGS } from "@/lib/pageLayout";
import { composeV2Layout } from "@/lib/v2Bridge/composeV2Document";
import { buildLivePreviewDocument, buildPreviewWorkerReply } from "@/lib/v2Bridge/previewWorkerProtocol";
import { applyPreviewTransfer, encodePreviewTransfer, previewTransferStats } from "@/lib/v2Bridge/previewDelta";
import { createShipporiMinchoMeasurementProvider } from "../../typesetting-v2/core/measurement/shipporiMinchoProvider";
import { syntheticManuscript } from "./longManuscript.bench";

const run = process.env.TATESPUN_PERF_PREVIEW_DELTA === "1" ? it : it.skip;
const PAGES = (process.env.TATESPUN_PERF_DELTA_PAGES ?? "50,100,300,500").split(",").map(Number);

function timed<T>(fn: () => T): [T, number] {
  const start = performance.now();
  const value = fn();
  return [value, Math.round((performance.now() - start) * 10) / 10];
}

run("Preview delta payload", () => {
  const measurement = createShipporiMinchoMeasurementProvider(resolve("public/fonts/ShipporiMincho-Regular.ttf"));
  const rows: Record<string, unknown>[] = [];
  for (const pages of PAGES) {
    const content = syntheticManuscript(pages);
    const mid = Math.floor(content.length / 2);
    const edited = `${content.slice(0, mid)}あ${content.slice(mid)}`;
    const compose = (text: string) => composeV2Layout({ title: "Bench", content: text, settings: DEFAULT_PAGE_SETTINGS, measurement });
    const before = compose(content);
    const base = { layoutId: 1, document: buildLivePreviewDocument(before) };
    const after = compose(edited);
    const next = buildLivePreviewDocument(after);
    const fullReply = buildPreviewWorkerReply(2, after, { kind: "full", document: next }, edited);
    const [transfer, encodeMs] = timed(() => encodePreviewTransfer(next, base));
    const deltaReply = buildPreviewWorkerReply(2, after, transfer, edited);
    const [, fullCloneMs] = timed(() => structuredClone(fullReply));
    const [cloned, deltaCloneMs] = timed(() => structuredClone(deltaReply));
    const [, applyMs] = timed(() => applyPreviewTransfer(cloned.preview, base));
    const stats = previewTransferStats(transfer);
    const row = {
      pages,
      physical: next.pages.length,
      kind: stats.kind,
      pagesSent: stats.pagesSent,
      pagesReused: stats.pagesReused,
      fullReplyKB: Math.round(serialize(fullReply).length / 1024),
      deltaReplyKB: Math.round(serialize(deltaReply).length / 1024),
      fullCloneMs,
      deltaCloneMs,
      workerEncodeMs: encodeMs,
      mainApplyMs: applyMs,
    };
    rows.push(row);
    console.table([row]);
  }
  console.table(rows);
  const label = process.env.TATESPUN_PERF_LABEL ?? "preview-delta-local";
  mkdirSync(resolve("scripts/perf/results"), { recursive: true });
  writeFileSync(resolve(`scripts/perf/results/${label}.json`), JSON.stringify(rows, null, 2));
});
