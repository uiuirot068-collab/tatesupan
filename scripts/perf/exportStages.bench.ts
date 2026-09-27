/**
 * Phase 8: V2 export stage costs. Never asserts.
 *
 * Main thread (browser): receive the publication model from the Preview
 * worker (structured clone), build the PaintPlan, then post plan + font to
 * the PDF worker (another structured clone). The PDF itself is written in
 * the PDF worker (`renderPaintPlanToPdfAsync`, measured here for context).
 * JPG raster (canvas) is browser-only: see `TATESPUN_PERF_EXPORT=1` in
 * tests/e2e/longManuscriptPerf.e2e.mjs.
 *
 * Run: TATESPUN_PERF_EXPORT_STAGES=1 npx vitest run --config scripts/perf/vitest.config.ts exportStages
 * Env: TATESPUN_PERF_EXPORT_PAGES=10,100,300 (default), TATESPUN_PERF_LABEL.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { serialize } from "node:v8";
import { it } from "vitest";
import { DEFAULT_PAGE_SETTINGS } from "@/lib/pageLayout";
import { composeV2Layout } from "@/lib/v2Bridge/composeV2Document";
import { publicationModelOf } from "@/lib/v2Bridge/previewWorkerProtocol";
import { createV2PdfWorkerStartMessage } from "@/lib/v2PdfWorkerContract";
import { createShipporiMinchoMeasurementProvider } from "../../typesetting-v2/core/measurement/shipporiMinchoProvider";
import { buildPublicationPaintPlan, renderPaintPlanToPdfAsync } from "../../typesetting-v2/renderer/publication/pdfGenerator";
import { syntheticManuscript } from "./longManuscript.bench";

const run = process.env.TATESPUN_PERF_EXPORT_STAGES === "1" ? it : it.skip;
const PAGES = (process.env.TATESPUN_PERF_EXPORT_PAGES ?? "10,100,300").split(",").map(Number);

function timed<T>(fn: () => T): [T, number] {
  const start = performance.now();
  const value = fn();
  return [value, Math.round(performance.now() - start)];
}

run("V2 export stage costs", async () => {
  const fontPath = resolve("public/fonts/ShipporiMincho-Regular.ttf");
  const measurement = createShipporiMinchoMeasurementProvider(fontPath);
  const font = { fileName: "ShipporiMincho-Regular.ttf", fontName: "Shippori Mincho", base64: readFileSync(fontPath).toString("base64") };
  const rows: Record<string, unknown>[] = [];
  for (const pages of PAGES) {
    const layout = composeV2Layout({ title: "Bench", content: syntheticManuscript(pages), settings: DEFAULT_PAGE_SETTINGS, measurement });
    const [publication, modelCloneMs] = timed(() => structuredClone(publicationModelOf(layout)));
    // One warm-up (font parse caches), then the measured build.
    buildPublicationPaintPlan(publication.model, font, publication.pageGeometry, "bench");
    const [plan, paintPlanMs] = timed(() => buildPublicationPaintPlan(publication.model, font, publication.pageGeometry, "bench"));
    const start = createV2PdfWorkerStartMessage(plan, font, "trim");
    const [, pdfStartCloneMs] = timed(() => structuredClone(start));
    const pdfStarted = performance.now();
    const pdf = await renderPaintPlanToPdfAsync(plan, font, { mode: "trim" });
    const row = {
      pages,
      physical: plan.length,
      modelKB: Math.round(serialize(publicationModelOf(layout)).length / 1024),
      modelCloneMs,
      paintPlanMs,
      pdfStartKB: Math.round(serialize(start).length / 1024),
      pdfStartCloneMs,
      mainThreadMs: modelCloneMs + paintPlanMs + pdfStartCloneMs,
      pdfWorkerMs: Math.round(performance.now() - pdfStarted),
      pdfKB: Math.round(pdf.bytes.byteLength / 1024),
    };
    rows.push(row);
    console.table([row]);
  }
  console.table(rows);
  const label = process.env.TATESPUN_PERF_LABEL ?? "export-stages-local";
  mkdirSync(resolve("scripts/perf/results"), { recursive: true });
  writeFileSync(resolve(`scripts/perf/results/${label}.json`), JSON.stringify(rows, null, 2));
});
