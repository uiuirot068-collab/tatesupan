/**
 * Phase 9: what crosses a thread boundary during export, and what it costs.
 * Never asserts.
 *
 * - publication model: v8 size per section and `structuredClone` time;
 * - PaintPlan per page: build time vs clone time (decides whether pages
 *   should be built where they are rasterized or shipped from a worker);
 * - font: base64 string clone vs raw bytes.
 *
 * Run: TATESPUN_PERF_EXPORT_TRANSFER=1 npx vitest run --config scripts/perf/vitest.config.ts exportTransfer
 * Env: TATESPUN_PERF_EXPORT_PAGES=10,100,300 (default), TATESPUN_PERF_LABEL.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { serialize } from "node:v8";
import { it } from "vitest";
import { DEFAULT_PAGE_SETTINGS } from "@/lib/pageLayout";
import { composeV2Layout } from "@/lib/v2Bridge/composeV2Document";
import { publicationModelOf } from "@/lib/v2Bridge/previewWorkerProtocol";
import { createShipporiMinchoMeasurementProvider } from "../../typesetting-v2/core/measurement/shipporiMinchoProvider";
import { createPublicationPaintPlanBuilder } from "../../typesetting-v2/renderer/publication/pdfGenerator";
import { syntheticManuscript } from "./longManuscript.bench";

const run = process.env.TATESPUN_PERF_EXPORT_TRANSFER === "1" ? it : it.skip;
const PAGES = (process.env.TATESPUN_PERF_EXPORT_PAGES ?? "10,100,300").split(",").map(Number);

function timed<T>(fn: () => T): [T, number] {
  const start = performance.now();
  const value = fn();
  return [value, performance.now() - start];
}

const kb = (value: unknown) => Math.round(serialize(value).length / 1024);
const round = (ms: number) => Math.round(ms * 10) / 10;

run("V2 export transfer costs", () => {
  const fontPath = resolve("public/fonts/ShipporiMincho-Regular.ttf");
  const measurement = createShipporiMinchoMeasurementProvider(fontPath);
  const fontBytes = new Uint8Array(readFileSync(fontPath));
  const font = { fileName: "ShipporiMincho-Regular.ttf", fontName: "Shippori Mincho", base64: Buffer.from(fontBytes).toString("base64") };
  const [, fontStringCloneMs] = timed(() => structuredClone(font));
  const [, fontBytesCloneMs] = timed(() => structuredClone(fontBytes));
  const rows: Record<string, unknown>[] = [];
  for (const pages of PAGES) {
    const layout = composeV2Layout({ title: "Bench", content: syntheticManuscript(pages), settings: DEFAULT_PAGE_SETTINGS, measurement });
    const publication = publicationModelOf(layout);
    const { model } = publication;
    const [, modelCloneMs] = timed(() => structuredClone(publication));
    const builder = createPublicationPaintPlanBuilder(model, font, publication.pageGeometry, "bench");
    builder.pageAt(0); // warm-up
    let buildMs = 0;
    let cloneMs = 0;
    let bytes = 0;
    for (let i = 0; i < builder.pageCount; i += 1) {
      const [page, built] = timed(() => builder.pageAt(i));
      buildMs += built;
      const [, cloned] = timed(() => structuredClone(page));
      cloneMs += cloned;
      bytes += serialize(page).length;
    }
    const row = {
      pages,
      physical: builder.pageCount,
      modelKB: kb(publication),
      modelBodyPagesKB: kb(model.pages),
      modelColophonKB: kb(model.colophonPages ?? []),
      modelOtherKB: kb({ ...model, pages: [], colophonPages: [] }),
      modelCloneMs: round(modelCloneMs),
      planPageAvgKB: Math.round(bytes / builder.pageCount / 1024),
      planPageBuildAvgMs: round(buildMs / builder.pageCount),
      planPageCloneAvgMs: round(cloneMs / builder.pageCount),
      planBuildTotalMs: Math.round(buildMs),
      planCloneTotalMs: Math.round(cloneMs),
    };
    rows.push(row);
    console.table([row]);
  }
  const result = { fontBytesKB: Math.round(fontBytes.byteLength / 1024), fontStringCloneMs: round(fontStringCloneMs), fontBytesCloneMs: round(fontBytesCloneMs), rows };
  console.log(JSON.stringify(result, null, 2));
  const label = process.env.TATESPUN_PERF_LABEL ?? "export-transfer-local";
  mkdirSync(resolve("scripts/perf/results"), { recursive: true });
  writeFileSync(resolve(`scripts/perf/results/${label}.json`), JSON.stringify(result, null, 2));
});
