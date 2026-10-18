/**
 * TSP-PRINT-002 (P4-6): what a long book's PDF holds in memory, by stage.
 * Measurement only (no assertion, no behaviour change). One page count per
 * process, so the peak RSS belongs to that size:
 *
 *   TATESPUN_PERF_PDF_PAGES=300 npx vitest run --config scripts/perf/vitest.config.ts pdfMemory
 *
 * Prints one JSON row (and writes scripts/perf/results/pdf-memory-<pages>p.json
 * when TATESPUN_PERF_PDF_WRITE=1): times, the PaintPlan's commands by kind,
 * the path segments of outline glyphs, heap/external/RSS after each stage,
 * the PDF size, and how much of the PDF is page content vs the font.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { it } from "vitest";
import { DEFAULT_PAGE_SETTINGS } from "@/lib/pageLayout";
import { composeV2Layout } from "@/lib/v2Bridge/composeV2Document";
import { createShipporiMinchoMeasurementProvider } from "../../typesetting-v2/core/measurement/shipporiMinchoProvider";
import { buildPublicationPaintPlan, renderPaintPlanToPdf } from "../../typesetting-v2/renderer/publication/pdfGenerator";
import { syntheticManuscript } from "./longManuscript.bench";

const PAGES = Number(process.env.TATESPUN_PERF_PDF_PAGES ?? 0);
const run = PAGES > 0 ? it : it.skip;
const FONT_PATH = resolve("public/fonts/ShipporiMincho-Regular.ttf");

const mb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;
function memory() {
  const m = process.memoryUsage();
  return { heapMb: mb(m.heapUsed), externalMb: mb(m.external + m.arrayBuffers), rssMb: mb(m.rss), peakRssMb: mb(process.resourceUsage().maxRSS * 1024) };
}

run(`PDF memory, ${PAGES} pages`, () => {
  const fontBytes = readFileSync(FONT_PATH);
  const font = { fileName: "ShipporiMincho-Regular.ttf", fontName: "Shippori Mincho", base64: fontBytes.toString("base64") };
  const content = syntheticManuscript(PAGES);
  const start = memory();

  let t = performance.now();
  const measurement = createShipporiMinchoMeasurementProvider(FONT_PATH);
  const layout = composeV2Layout({ title: "Bench", content, settings: DEFAULT_PAGE_SETTINGS, measurement });
  const composeMs = Math.round(performance.now() - t);
  const afterCompose = memory();

  t = performance.now();
  const plan = buildPublicationPaintPlan(layout.model, font, layout.pageGeometry, "bench");
  const planMs = Math.round(performance.now() - t);
  const afterPlan = memory();

  const commandsByOp: Record<string, number> = {};
  let outlineSegments = 0;
  // TSP-PRINT-002 (案A): occurrences drawn by reference, and the distinct shapes they share.
  let outlineRefs = 0;
  const shapes = new Set<object>();
  let planJsonBytes = 0; // per page: the whole plan is over V8's longest string at 300 pages
  for (const page of plan) {
    // A shared shape is one object however many times it is used; count it once (below).
    planJsonBytes += Buffer.byteLength(JSON.stringify(page, (key, value) => (key === "shape" ? (value as { key: string }).key : value)));
    for (const command of page.commands) {
      commandsByOp[command.op] = (commandsByOp[command.op] ?? 0) + 1;
      if (command.op === "glyphOutline") {
        if ("shape" in command) {
          outlineRefs += 1;
          shapes.add(command.shape);
        } else outlineSegments += command.commands.length;
      }
    }
  }

  for (const shape of shapes) planJsonBytes += Buffer.byteLength(JSON.stringify(shape));

  t = performance.now();
  const pdf = renderPaintPlanToPdf(plan, font);
  const pdfMs = Math.round(performance.now() - t);
  const afterPdf = memory();

  const row = {
    pages: PAGES,
    pdfPages: pdf.pageCount,
    chars: content.length,
    composeMs,
    planMs,
    pdfMs,
    commandsByOp,
    outlineSegments,
    outlineRefs,
    distinctShapes: shapes.size,
    shapeSegments: [...shapes].reduce((n, shape) => n + (shape as { commands: unknown[] }).commands.length, 0),
    planJsonMb: mb(planJsonBytes),
    pdfMb: mb(pdf.bytes.byteLength),
    fontMb: mb(fontBytes.byteLength),
    memory: { start, afterCompose, afterPlan, afterPdf },
  };
  console.log(JSON.stringify(row));
  if (process.env.TATESPUN_PERF_PDF_WRITE === "1") {
    mkdirSync(resolve("scripts/perf/results"), { recursive: true });
    writeFileSync(resolve(`scripts/perf/results/pdf-memory-${PAGES}p.json`), JSON.stringify(row, null, 2) + "\n");
  }
});
