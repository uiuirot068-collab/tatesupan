/**
 * Phase 8: Preview worker reply decomposition. Sizes are the V8
 * structured-clone serializer's byte count (`v8.serialize`, the same wire
 * format postMessage uses), and clone time is `structuredClone` (serialize +
 * deserialize, a stand-in for the worker → main copy). Never asserts.
 * Run: TATESPUN_PERF_PAYLOAD=1 npx vitest run --config scripts/perf/vitest.config.ts payload
 * Env: TATESPUN_PERF_PAYLOAD_PAGES=10,50,100 (default 10,50,100,300,500), TATESPUN_PERF_LABEL.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { serialize } from "node:v8";
import { it } from "vitest";
import { DEFAULT_PAGE_SETTINGS } from "@/lib/pageLayout";
import { composeV2Layout } from "@/lib/v2Bridge/composeV2Document";
import { buildV2PreviewDocument } from "@/lib/v2Bridge/buildV2PreviewDocument";
import * as workerProtocol from "@/lib/v2Bridge/previewWorkerProtocol";
import { createShipporiMinchoMeasurementProvider } from "../../typesetting-v2/core/measurement/shipporiMinchoProvider";
import { syntheticManuscript } from "./longManuscript.bench";

const run = process.env.TATESPUN_PERF_PAYLOAD === "1" ? it : it.skip;
const PAGES = (process.env.TATESPUN_PERF_PAYLOAD_PAGES ?? "10,50,100,300,500").split(",").map(Number);

const kb = (value: unknown) => Math.round(serialize(value).length / 1024);

function cloneMs(value: unknown, runs = 3): number {
  structuredClone(value);
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    structuredClone(value);
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return Math.round(times[Math.floor(runs / 2)] * 10) / 10;
}

run("preview worker reply decomposition", () => {
  const measurement = createShipporiMinchoMeasurementProvider(resolve("public/fonts/ShipporiMincho-Regular.ttf"));
  const rows: Record<string, unknown>[] = [];
  for (const pages of PAGES) {
    const content = syntheticManuscript(pages);
    const bridge = composeV2Layout({ title: "Bench", content, settings: DEFAULT_PAGE_SETTINGS, measurement });
    const preview = buildV2PreviewDocument(bridge, {});
    const legacyReply = { type: "complete", requestId: 1, bridge, preview };
    const row: Record<string, unknown> = {
      pages,
      physical: bridge.document.pageSequence.length,
      legacyReplyKB: kb(legacyReply),
      legacyCloneMs: cloneMs(legacyReply),
      documentKB: kb(bridge.document),
      modelKB: kb(bridge.model),
      unitsKB: kb(bridge.units),
      sourceMapKB: kb(bridge.bodySourceMap),
      previewKB: kb(preview),
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- drops `debug` from each unit
      previewNoDebugKB: kb({ ...preview, pages: preview.pages.map((p) => ({ ...p, columns: p.columns.map((c) => ({ ...c, lines: c.lines.map((l) => ({ ...l, units: l.units.map(({ debug: _d, ...u }) => u) })) })) })) }),
      pageSequenceKB: kb(bridge.document.pageSequence),
    };
    // Phase 8 slim reply (only when the protocol module exists in this build).
    if (typeof workerProtocol.buildPreviewWorkerReply === "function") {
      const reply = workerProtocol.buildPreviewWorkerReply(1, bridge, { kind: "full", document: workerProtocol.buildLivePreviewDocument(bridge) }, content);
      row.slimReplyKB = kb(reply);
      row.slimCloneMs = cloneMs(reply);
      row.slimLayoutKB = kb(reply.layout);
      row.slimPreviewKB = kb(reply.preview);
      const publication = workerProtocol.publicationModelOf(bridge);
      row.exportModelKB = kb(publication);
      row.exportModelCloneMs = cloneMs(publication);
    }
    rows.push(row);
    console.table([row]);
  }
  console.table(rows);
  const label = process.env.TATESPUN_PERF_LABEL ?? "payload-local";
  mkdirSync(resolve("scripts/perf/results"), { recursive: true });
  writeFileSync(resolve(`scripts/perf/results/${label}.json`), JSON.stringify(rows, null, 2));
});
