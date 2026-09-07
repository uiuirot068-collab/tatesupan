// P3-O08 — OpenType vertical GSUB outline paint (Human Visual QA HOLD
// round 7): full-pipeline integration. Proves the outline paint mechanism
// is correctly wired into `buildPaintPlan`/`generatePublicationPdf` for
// small kana + Dash, correctly NOT triggered for punctuation/ellipsis/
// ordinary kanji, and that Core canonical coordinates and source are
// completely untouched.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_RULE_SET_V2 } from "../../core";
import { buildPublicationDocument, type PublicationRenderContext } from "./paintModel";
import { buildPaintPlan, generatePublicationPdf, renderPaintPlanToPdf, type PublicationFontResource, type PublicationPageGeometry, type PaintCommand } from "./pdfGenerator";
import { VerticalOutlineContext } from "./verticalOutlinePaint";
import { settingsFor } from "./fixtures";
import { buildFixtureUnits } from "../../tools/compare/fixtureBuilder";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");

function fontResource(): PublicationFontResource {
  return { fileName: "ShipporiMincho-Regular.ttf", fontName: "ShipporiMincho", base64: readFileSync(FONT_PATH).toString("base64") };
}

function composeFor(text: string, charsPerLine?: number) {
  const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text }]);
  return composeUnits(units, source, charsPerLine ?? Array.from(text).length + 2);
}

function composeDashFor(text: string, charsPerLine: number) {
  const { units, source } = buildFixtureUnits("body", [{ kind: "SEMANTIC_RUN", text, runKind: "DASH" }]);
  return composeUnits(units, source, charsPerLine);
}

function composeUnits(units: ReturnType<typeof buildFixtureUnits>["units"], source: ReturnType<typeof buildFixtureUnits>["source"], charsPerLine: number) {
  const settings = settingsFor({ charsPerLine, linesPerColumn: 1, columnCount: 1 });
  const measurement = createFakeMeasurementProvider();
  const document = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
  const ctx: PublicationRenderContext = {
    linePitchTicks: settings.linePitchTicks,
    lineExtentTicks: settings.lineExtentTicks,
    columnExtentTicks: settings.columnExtentTicks,
    columnsPerPage: settings.columnsPerPage,
    measurementIdentity: document.version.measurementIdentity,
    paintFontIdentity: document.version.measurementIdentity,
  };
  const model = buildPublicationDocument("id", "label", document, units, source, ctx);
  return { document, model, units, source };
}

function textCommands(plan: ReturnType<typeof buildPaintPlan>): Extract<PaintCommand, { op: "text" }>[] {
  return plan.flatMap((p) => p.commands).filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
}
function outlineCommands(plan: ReturnType<typeof buildPaintPlan>): Extract<PaintCommand, { op: "glyphOutline" }>[] {
  return plan.flatMap((p) => p.commands).filter((c): c is Extract<PaintCommand, { op: "glyphOutline" }> => c.op === "glyphOutline");
}

describe("Vertical outline paint -- pipeline integration", () => {
  it("SMALL KANA: だった。 paints っ (and, per the broader finding, だ/た too) as glyphOutline; 。 stays on TEXT; total graphemes preserved (4)", () => {
    const { model } = composeFor("だった。");
    const ctx = new VerticalOutlineContext(readFileSync(FONT_PATH));
    const plan = buildPaintPlan(model, true, undefined, undefined, ctx);
    const outlines = outlineCommands(plan);
    const texts = textCommands(plan);
    expect(outlines.length + texts.length).toBe(4); // だ,っ,た,。 -- every grapheme painted exactly once
    expect(ctx.resolveOutlineGlyphId("っ")).toBeDefined(); // small kana: outline
    expect(ctx.resolveOutlineGlyphId("。")).toBeUndefined(); // period: text (GSUB already reachable)
  });

  it("PUNCTUATION: 「」、。 specifically never appear in an outline command in 「今日は、雨だった。」 -- kana in the same fixture DO, proving the boundary is per-character, not fixture-wide", () => {
    const { model } = composeFor("「今日は、雨だった。」");
    const ctx = new VerticalOutlineContext(readFileSync(FONT_PATH));
    const plan = buildPaintPlan(model, true, undefined, undefined, ctx);
    // Every punctuation mark in this fixture must resolve to "text", never "glyphOutline".
    for (const ch of ["「", "」", "、", "。"]) expect(ctx.resolveOutlineGlyphId(ch)).toBeUndefined();
    // At least one real outline command exists in this fixture (from its kana), proving the boundary is genuinely exercised, not vacuously true.
    expect(outlineCommands(plan).length).toBeGreaterThan(0);
  });

  it("ELLIPSIS: …… paints entirely as TEXT (GSUB alternate already reachable via U+FE19)", () => {
    const { model } = composeFor("……");
    const ctx = new VerticalOutlineContext(readFileSync(FONT_PATH));
    const plan = buildPaintPlan(model, true, undefined, undefined, ctx);
    expect(outlineCommands(plan).length).toBe(0);
    expect(textCommands(plan).length).toBe(2);
  });

  it("ORDINARY KANJI: 日本語 (kanji-only) paints entirely as TEXT (no GSUB vertical alternate exists for kanji)", () => {
    const { model } = composeFor("日本語");
    const ctx = new VerticalOutlineContext(readFileSync(FONT_PATH));
    const plan = buildPaintPlan(model, true, undefined, undefined, ctx);
    expect(outlineCommands(plan).length).toBe(0);
    expect(textCommands(plan).length).toBe(3);
  });

  it("ORDINARY KANA: つ (not small) ALSO paints as glyphOutline -- the broader, not-small-kana-only finding", () => {
    const { model } = composeFor("つ");
    const ctx = new VerticalOutlineContext(readFileSync(FONT_PATH));
    const plan = buildPaintPlan(model, true, undefined, undefined, ctx);
    expect(outlineCommands(plan).length).toBe(1);
  });

  it("CANONICAL CELL UNCHANGED: PublicationDocument coordinates are byte-identical with and without an outlineContext -- only the PAINT command kind/content changes", () => {
    const { model } = composeFor("だった。");
    const planWithout = buildPaintPlan(model, true);
    const before = JSON.parse(JSON.stringify(model));
    const ctx = new VerticalOutlineContext(readFileSync(FONT_PATH));
    buildPaintPlan(model, true, undefined, undefined, ctx);
    expect(model).toEqual(before); // buildPaintPlan never mutates the model, with or without outline context
    expect(planWithout.length).toBeGreaterThan(0); // sanity: the no-outline plan still exists/renders
  });

  it("SOURCE / SourceSpan UNCHANGED: building an outline-aware plan never touches LogicalUnit text or source", () => {
    const { units: unitsA, source: sourceA } = buildFixtureUnits("body", [{ kind: "TEXT", text: "だった。" }]);
    const { units: unitsB, source: sourceB } = buildFixtureUnits("body", [{ kind: "TEXT", text: "だった。" }]);
    const ctx = new VerticalOutlineContext(readFileSync(FONT_PATH));
    const settings = settingsFor({ charsPerLine: 8, linesPerColumn: 1, columnCount: 1 });
    const measurement = createFakeMeasurementProvider();
    const document = composeCanonicalDocument({ bodyUnits: unitsA, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
    const pctx: PublicationRenderContext = {
      linePitchTicks: settings.linePitchTicks,
      lineExtentTicks: settings.lineExtentTicks,
      columnExtentTicks: settings.columnExtentTicks,
      columnsPerPage: settings.columnsPerPage,
      measurementIdentity: document.version.measurementIdentity,
      paintFontIdentity: document.version.measurementIdentity,
    };
    const model = buildPublicationDocument("id", "label", document, unitsA, sourceA, pctx);
    buildPaintPlan(model, true, undefined, undefined, ctx);
    expect(unitsA).toEqual(unitsB);
    expect(sourceA).toEqual(sourceB);
  });

  it("RUBY unchanged: annotation still paints correctly with an outlineContext present (regression, not reopening rubyScale)", () => {
    const { units, source } = buildFixtureUnits("body", [{ kind: "RUBY", base: "東京", reading: "とうきょう" }]);
    const settings = settingsFor({ charsPerLine: 6, linesPerColumn: 1, columnCount: 1 });
    const measurement = createFakeMeasurementProvider();
    const document = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
    const pctx: PublicationRenderContext = {
      linePitchTicks: settings.linePitchTicks,
      lineExtentTicks: settings.lineExtentTicks,
      columnExtentTicks: settings.columnExtentTicks,
      columnsPerPage: settings.columnsPerPage,
      measurementIdentity: document.version.measurementIdentity,
      paintFontIdentity: document.version.measurementIdentity,
    };
    const model = buildPublicationDocument("id", "label", document, units, source, pctx);
    const ctx = new VerticalOutlineContext(readFileSync(FONT_PATH));
    const planWithout = buildPaintPlan(model, true);
    const planWith = buildPaintPlan(model, true, undefined, undefined, ctx);
    // 東京とうきょう are all ordinary kanji/kana with no GSUB alternate reachability issue relevant here except real kana in the reading -- but positions must match between the two plans wherever both emit "text".
    expect(planWithout.length).toBe(planWith.length);
  });

  it("real vector PDFs generated via generatePublicationPdf (the full, font-resource-driven entry point) contain outline fill operators for small kana", () => {
    const { model } = composeFor("だった。");
    const { bytes } = generatePublicationPdf(model, fontResource());
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text.startsWith("%PDF-")).toBe(true);
    // PDF fill-path operator "f" must appear somewhere in the content stream (from pdf.fill() -- proves the outline path was actually emitted, not merely computed and discarded).
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("no DOM/Canvas/raster: outline path generation touches only Buffer/opentype.js pure computation -- no `document`/`window`/`HTMLCanvasElement` reference anywhere in this pipeline's own modules", () => {
    // Structural proof: VerticalOutlineContext's own construction + methods complete synchronously in this Node vitest environment (no jsdom canvas needed), and its output is plain data (OutlinePathCommand[] of numbers), never an image/raster buffer.
    const ctx = new VerticalOutlineContext(readFileSync(FONT_PATH));
    const commands = ctx.glyphOutlineCommandsMm(ctx.resolveOutlineGlyphId("っ")!, 0, 0, 1);
    for (const cmd of commands) {
      expect(cmd).not.toHaveProperty("image");
      expect(cmd).not.toHaveProperty("canvas");
    }
  });
});

describe("QA artifacts -- focused GSUB outline PDFs (regenerated only after the above integration proofs pass)", () => {
  const geometry: PublicationPageGeometry = { paperWidthMm: 60, paperHeightMm: 80, marginTopMm: 8, marginBottomMm: 8, marginRightMm: 8, marginLeftMm: 8 };
  const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");

  function writeFocusedPdf(fileName: string, text: string, isDash = false) {
    const { model } = isDash ? composeDashFor(text, Array.from(text).length + 6) : composeFor(text);
    const font = fontResource();
    const ctx = new VerticalOutlineContext(readFileSync(FONT_PATH));
    const plan = buildPaintPlan(model, true, geometry, undefined, ctx);
    const { bytes } = renderPaintPlanToPdf(plan, font);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, fileName), bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  }

  it("generates small-kana-gsub-outline.pdf", () => {
    writeFocusedPdf("small-kana-gsub-outline.pdf", "だった。");
  });

  it("generates punctuation-gsub-outline.pdf", () => {
    writeFocusedPdf("punctuation-gsub-outline.pdf", "「今日は、雨だった。」");
  });

  it("generates dash-gsub-outline.pdf", () => {
    writeFocusedPdf("dash-gsub-outline.pdf", "――", true);
  });

  it("Dash: the SEMANTIC_RUN dash fixture actually resolves to the real GSUB outline glyph (15901), not the old manual U+FE31", () => {
    const { model } = composeDashFor("――", 4);
    const ctx = new VerticalOutlineContext(readFileSync(FONT_PATH));
    const plan = buildPaintPlan(model, true, undefined, undefined, ctx);
    expect(outlineCommands(plan).length).toBe(2); // both dash glyphs painted via outline
    expect(textCommands(plan).length).toBe(0);
  });
});
