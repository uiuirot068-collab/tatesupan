/**
 * Phase 7 long-manuscript benchmark — Node side (pure pipeline stages).
 * Browser-only costs (worker startup, image decode, postMessage) are measured
 * by tests/e2e/longManuscriptPerf.e2e.mjs. Methodology:
 * docs/TATESPUN_LONG_MANUSCRIPT_PERFORMANCE.md §1.
 *
 * Every stage runs WARMUP times unmeasured, then the median of RUNS is kept.
 * Nothing here asserts a duration.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { it } from "vitest";
import { computePageSourceRanges, detokenizeTategaki, paginateTokens, tokenizeTategaki } from "@/lib/tategaki";
import { computePageLayout, DEFAULT_PAGE_SETTINGS, type PageSettings } from "@/lib/pageLayout";
import { buildV2UnitsFromManuscript } from "@/lib/v2Bridge/manuscriptAdapter";
import { composeV2Layout, type V2LayoutResult } from "@/lib/v2Bridge/composeV2Document";
import { buildV2PreviewPageModel } from "@/lib/v2Bridge/previewPageModel";
import { buildV2PreviewDocument } from "@/lib/v2Bridge/buildV2PreviewDocument";
import { compositionInputsEqual } from "@/lib/v2Bridge/compositionRevision";
import { referencedImageIds } from "@/lib/cloudImageSync";
import { createShipporiMinchoMeasurementProvider } from "../../typesetting-v2/core/measurement/shipporiMinchoProvider";
import { buildPublicationPaintPlan } from "../../typesetting-v2/renderer/publication/pdfGenerator";

const WARMUP = 1;
const RUNS = Number(process.env.TATESPUN_PERF_RUNS ?? 3);
const FONT_PATH = resolve("public/fonts/ShipporiMincho-Regular.ttf");
const settings: PageSettings = DEFAULT_PAGE_SETTINGS;
const layout = computePageLayout(settings);
const CHARS_PER_PAGE = layout.charsPerLine * layout.linesPerPage;

// ---- synthetic manuscripts (deterministic) ----
const SENTENCES = [
  "春の宵、窓辺に置いた硝子の瓶が淡い光を返していた。",
  "彼女は古い手紙を読み返し、ふと遠い町のことを思い出す。",
  "「もう一度だけ、あの坂を上ってみようか」と彼は言った。",
  "雨上がりの路地には、濡れた石畳の匂いが満ちている。",
  "時計の針は止まったまま、部屋の隅で静かに眠っていた。",
];
type Feature = "text" | "ruby" | "bouten" | "dash" | "pagebreak" | "images";

function sentence(i: number, feature: Feature): string {
  const base = SENTENCES[i % SENTENCES.length];
  switch (feature) {
    case "ruby": return `｜硝子《がらす》の${base}｜石畳《いしだたみ》`;
    case "bouten": return `《《確かに》》${base}《《静かに》》`;
    case "dash": return `${base}――それは……`;
    default: return base;
  }
}

/** ~`pages` pages of paragraphs (charsPerLine × linesPerPage per page, ~20 % paragraph slack). */
export function syntheticManuscript(pages: number, feature: Feature = "text", imageCount = 0): string {
  const target = Math.round(pages * CHARS_PER_PAGE * 0.8);
  const parts: string[] = [];
  let length = 0;
  let i = 0;
  const imageEvery = imageCount > 0 ? Math.max(1, Math.floor(target / imageCount)) : Infinity;
  let nextImage = imageEvery;
  let imagesPlaced = 0;
  while (length < target) {
    let para = "　" + sentence(i, feature) + sentence(i + 1, feature) + sentence(i + 2, feature);
    if (feature === "pagebreak" && i % 40 === 39) para += "\n【改ページ】";
    if (length >= nextImage && imagesPlaced < imageCount) {
      para += `\n【IMG:img${imagesPlaced}:40:30:center】`;
      imagesPlaced++;
      nextImage += imageEvery;
    }
    parts.push(para);
    length += para.length + 1;
    i += 3;
  }
  return parts.join("\n");
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function time<T>(fn: () => T): { ms: number; value: T } {
  let value!: T;
  for (let w = 0; w < WARMUP; w++) value = fn();
  const samples: number[] = [];
  for (let r = 0; r < RUNS; r++) {
    const start = performance.now();
    value = fn();
    samples.push(performance.now() - start);
  }
  return { ms: Math.round(median(samples) * 100) / 100, value };
}

it("long manuscript pipeline benchmark", () => {
  const providerStart = performance.now();
  const measurement = createShipporiMinchoMeasurementProvider(FONT_PATH);
  const providerMs = performance.now() - providerStart;
  const fontBytes = readFileSync(FONT_PATH);
  const font = { fileName: "ShipporiMincho-Regular.ttf", fontName: "Shippori Mincho", base64: fontBytes.toString("base64") };

  const fixtures: { name: string; content: string }[] = [
    ...[10, 50, 100, 300, 500].map((p) => ({ name: `text-${p}p`, content: syntheticManuscript(p) })),
    { name: "ruby-100p", content: syntheticManuscript(100, "ruby") },
    { name: "bouten-100p", content: syntheticManuscript(100, "bouten") },
    { name: "dash-100p", content: syntheticManuscript(100, "dash") },
    { name: "pagebreak-100p", content: syntheticManuscript(100, "pagebreak") },
    { name: "images10-100p", content: syntheticManuscript(100, "text", 10) },
    { name: "images50-300p", content: syntheticManuscript(300, "text", 50) },
  ];

  const only = process.env.TATESPUN_PERF_ONLY?.split(",");
  const rows = fixtures.filter((f) => !only || only.includes(f.name)).map(({ name, content }) => {
    const t0 = performance.now();
    const log = (stage: string) => console.error(`[${name}] ${stage} +${Math.round(performance.now() - t0)}ms`);
    const legacyTokenize = time(() => tokenizeTategaki(content));
    log("before legacyPaginate");
    const legacyPaginate = time(() => paginateTokens(legacyTokenize.value, {
      charsPerLine: layout.charsPerLine,
      linesPerPage: layout.linesPerPage,
      columnCount: settings.columnCount,
      linesPerColumn: layout.linesPerColumn,
    }));
    log("before legacyRanges");
    const legacyRanges = time(() => computePageSourceRanges(content, { charsPerLine: layout.charsPerLine, linesPerPage: layout.linesPerPage }));
    log("before adapter");
    const adapter = time(() => buildV2UnitsFromManuscript("body", content, { maxSemanticRunCells: Math.floor(settings.charsPerLine) - 1, decorations: true }));
    log("before compose");
    const compose = time(() => composeV2Layout({ title: "Bench", content, settings, measurement }));
    const bridge: V2LayoutResult = compose.value;
    log("before pageModel");
    const pageModel = time(() => buildV2PreviewPageModel(bridge, content));
    log("before previewDoc");
    const previewDoc = time(() => buildV2PreviewDocument(bridge, {}));
    log("before clone");
    const clone = time(() => structuredClone({ bridge, preview: previewDoc.value }));
    log("before signatures");
    const signatures = time(() => pageModel.value.overlayPages.map((page) => detokenizeTategaki(page.tokens)));
    log("before refIds");
    const refIds = time(() => referencedImageIds(content));
    log("before exportPlanMs");
    let exportPlanMs: number | null = null;
    // Export plan is ~100 ms/page and memory-heavy: measured once, only up to ~100 pages.
    if (pageModel.value.bodyPageCount <= Number(process.env.TATESPUN_PERF_EXPORT_MAX_PAGES ?? 120)) try {
      const start = performance.now();
      buildPublicationPaintPlan(bridge.model, font, bridge.pageGeometry, "bench");
      exportPlanMs = Math.round(performance.now() - start);
    } catch {
      exportPlanMs = null; // images unresolved in Node (no decoder) → export refuses, by design
    }
    return {
      fixture: name,
      chars: content.length,
      legacyPages: legacyPaginate.value.length,
      v2BodyPages: pageModel.value.bodyPageCount,
      legacyTokenizeMs: legacyTokenize.ms,
      legacyPaginateMs: legacyPaginate.ms,
      legacySourceRangesMs: legacyRanges.ms,
      manuscriptAdapterMs: adapter.ms,
      composeV2LayoutMs: compose.ms,
      previewPageModelMs: pageModel.ms,
      previewPaintDocMs: previewDoc.ms,
      structuredCloneResultMs: clone.ms,
      pageSignaturesMs: signatures.ms,
      referencedImageIdsMs: refIds.ms,
      exportPaintPlanMs: exportPlanMs,
    };
  });

  // Unchanged-input comparison cost (CompositionGate.currentFor per effect run / waiter).
  const base = { content: fixtures[4].content, settings, title: "t", images: {} as Record<string, string> };
  const equalSameRefs = time(() => { for (let i = 0; i < 1000; i++) compositionInputsEqual(base, base); });
  const copy = { ...base, settings: structuredClone(settings) };
  const equalNewSettingsObject = time(() => { for (let i = 0; i < 1000; i++) compositionInputsEqual(base, copy); });
  const stringify = time(() => { for (let i = 0; i < 1000; i++) JSON.stringify(settings); });

  // Image pool payload: structured clone of the whole pool vs. only the referenced ids.
  const fakeImage = "data:image/png;base64," + "A".repeat(200_000); // ~200 KB data URL
  const pool: Record<string, string> = {};
  for (let i = 0; i < 100; i++) pool[`img${i}`] = fakeImage + i;
  const referenced = Object.fromEntries(Object.entries(pool).slice(0, 2));
  const clonePool = time(() => structuredClone(pool));
  const cloneReferenced = time(() => structuredClone(referenced));

  const summary = {
    label: process.env.TATESPUN_PERF_LABEL ?? "local",
    date: new Date().toISOString(),
    node: process.version,
    runs: RUNS,
    charsPerPage: CHARS_PER_PAGE,
    measurementProviderCreateMs: Math.round(providerMs),
    rows,
    compare: {
      compositionInputsEqualSameRefs_x1000_ms: equalSameRefs.ms,
      compositionInputsEqualNewSettingsObject_x1000_ms: equalNewSettingsObject.ms,
      jsonStringifySettings_x1000_ms: stringify.ms,
      settingsJsonBytes: JSON.stringify(settings).length,
    },
    imagePool: {
      pool100x200KB_structuredCloneMs: clonePool.ms,
      referenced2_structuredCloneMs: cloneReferenced.ms,
    },
  };
  console.table(rows);
  console.log(JSON.stringify({ ...summary, rows: undefined }, null, 2));
  mkdirSync(resolve("scripts/perf/results"), { recursive: true });
  writeFileSync(resolve(`scripts/perf/results/${summary.label}.json`), JSON.stringify(summary, null, 2));
});
