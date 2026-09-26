/**
 * Phase 7 diagnosis: which parts of the worker result dominate the
 * structured-clone (postMessage) cost, and where export PaintPlan time goes.
 * Run: TATESPUN_PERF_BREAKDOWN=1 npx vitest run --config scripts/perf/vitest.config.ts breakdown
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { it } from "vitest";
import { DEFAULT_PAGE_SETTINGS } from "@/lib/pageLayout";
import { composeV2Layout } from "@/lib/v2Bridge/composeV2Document";
import { buildV2PreviewDocument } from "@/lib/v2Bridge/buildV2PreviewDocument";
import { createShipporiMinchoMeasurementProvider } from "../../typesetting-v2/core/measurement/shipporiMinchoProvider";
import { buildPublicationPaintPlan } from "../../typesetting-v2/renderer/publication/pdfGenerator";
import { syntheticManuscript } from "./longManuscript.bench";

const run = process.env.TATESPUN_PERF_BREAKDOWN === "1" ? it : it.skip;

function ms(fn: () => unknown): number {
  const start = performance.now();
  fn();
  return Math.round((performance.now() - start) * 10) / 10;
}

run("worker result clone breakdown + export plan scaling", () => {
  const measurement = createShipporiMinchoMeasurementProvider(resolve("public/fonts/ShipporiMincho-Regular.ttf"));
  const content = syntheticManuscript(100);
  const bridge = composeV2Layout({ title: "Bench", content, settings: DEFAULT_PAGE_SETTINGS, measurement });
  const preview = buildV2PreviewDocument(bridge, {});
  const parts: Record<string, unknown> = { ...bridge, preview };
  const rows = Object.entries(parts).map(([key, value]) => ({
    key,
    cloneMs: ms(() => structuredClone(value)),
    jsonKB: Math.round((JSON.stringify(value, (_k, v) => (ArrayBuffer.isView(v) ? `[typed ${(v as Int32Array).length}]` : v))?.length ?? 0) / 1024),
  }));
  console.table(rows);

  const fontBytes = readFileSync(resolve("public/fonts/ShipporiMincho-Regular.ttf"));
  const font = { fileName: "ShipporiMincho-Regular.ttf", fontName: "Shippori Mincho", base64: fontBytes.toString("base64") };
  for (const pages of [1, 5, 20]) {
    const small = composeV2Layout({ title: "Bench", content: syntheticManuscript(pages), settings: DEFAULT_PAGE_SETTINGS, measurement });
    const withFont = ms(() => buildPublicationPaintPlan(small.model, font, small.pageGeometry, "bench"));
    const withoutFont = ms(() => buildPublicationPaintPlan(small.model, undefined, small.pageGeometry, "bench"));
    console.log(`export plan ${pages}p (${small.document.pageSequence.length} physical): withFont=${withFont}ms withoutFont=${withoutFont}ms`);
  }
});
