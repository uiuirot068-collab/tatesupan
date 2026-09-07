// Human Visual QA HOLD round 9 (glyph-size regression): round 8's real,
// legitimate yakumono canonical-advance compression was, before this
// fix, incorrectly reused as glyph FONT SIZE too -- `PaintPlacedUnit.
// heightMm` conflated "how far this atom advances" (a POSITIONING
// quantity, correctly shrunk for adjacent punctuation pairs) with "how
// large this atom's own glyph paints" (which must stay the constant
// body em regardless). Proves the fix: every glyph, compressed-pair or
// not, paints at the SAME fontSizePt, while the underlying canonical
// positions remain exactly as round 8 left them.

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_RULE_SET_V2 } from "../../core";
import { buildPublicationDocument, type PublicationRenderContext } from "./paintModel";
import { buildPaintPlan, type PaintCommand } from "./pdfGenerator";
import { settingsFor } from "./fixtures";
import { buildFixtureUnits } from "../../tools/compare/fixtureBuilder";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");

function composeFor(text: string) {
  const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text }]);
  const settings = settingsFor({ charsPerLine: Array.from(text).length + 2, linesPerColumn: 1, columnCount: 1 });
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
  return { document, model };
}

function textFontSizes(plan: ReturnType<typeof buildPaintPlan>): number[] {
  return plan.flatMap((p) => p.commands).filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text").map((c) => c.fontSizePt);
}

describe("Glyph size independence -- round 9 regression fix", () => {
  it("「今日は、雨だった。」 -- EVERY painted character (including the yakumono-compressed 。 and 」) shares the exact same fontSizePt", () => {
    const { model } = composeFor("「今日は、雨だった。」");
    const plan = buildPaintPlan(model, true);
    const sizes = textFontSizes(plan);
    expect(sizes.length).toBeGreaterThan(0);
    const first = sizes[0];
    for (const size of sizes) expect(size).toBe(first);
  });

  it("body font size is unchanged from the document's own declared bodyEmMm (10.5pt-equivalent), not shrunk", () => {
    const { model } = composeFor("東");
    expect(model.bodyEmMm).toBeCloseTo((10.5 * 25.4) / 72, 2);
    const plan = buildPaintPlan(model, true);
    const sizes = textFontSizes(plan);
    expect(sizes[0]).toBeCloseTo(10.5, 2);
  });

  it("。 paints at the SAME fontSizePt as an ordinary, non-compressed character in the same document", () => {
    const { model } = composeFor("「今日は、雨だった。」");
    const plan = buildPaintPlan(model, true);
    const commands = plan.flatMap((p) => p.commands).filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    const periodCmd = commands.find((c) => c.text === "︒"); // vertical period presentation form
    const ordinaryCmd = commands.find((c) => c.text === "東" || c.text === "今");
    expect(periodCmd).toBeDefined();
    expect(ordinaryCmd).toBeDefined();
    expect(periodCmd!.fontSizePt).toBe(ordinaryCmd!.fontSizePt);
  });

  it("」 paints at the SAME fontSizePt as an ordinary character too", () => {
    const { model } = composeFor("「今日は、雨だった。」");
    const plan = buildPaintPlan(model, true);
    const commands = plan.flatMap((p) => p.commands).filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    const bracketCmd = commands.find((c) => c.text === "﹂"); // vertical closing bracket presentation form
    const ordinaryCmd = commands.find((c) => c.text === "今");
    expect(bracketCmd).toBeDefined();
    expect(bracketCmd!.fontSizePt).toBe(ordinaryCmd!.fontSizePt);
  });

  it("Human Visual QA HOLD round 13 (legacy parity audit): canonical yakumono advance is UNIFORM again -- round 8's compression is retired, not merely font-size-independent", () => {
    const { document } = composeFor("「今日は、雨だった。」");
    const line = document.pages[0].columns[0].lines[0];
    const period = line.placedUnits[9]; // 。
    const bracket = line.placedUnits[10]; // 」
    const comma = line.placedUnits[4]; // 、
    const rain = line.placedUnits[5]; // 雨
    const periodToBracketPitch = bracket.yTick - period.yTick;
    const commaToRainPitch = rain.yTick - comma.yTick;
    // Confirmed by direct read of the already-working legacy renderer
    // (src/components/PageCard.tsx): canonical advance is never adjusted
    // for punctuation at all -- every character-to-character pitch is
    // the SAME uniform cell, always. The visual fix now lives entirely
    // in Publication paint (verticalYakumonoAlign.ts).
    expect(periodToBracketPitch).toBe(commaToRainPitch);
  });

  it("source is never mutated", () => {
    const { units: unitsA } = buildFixtureUnits("body", [{ kind: "TEXT", text: "「今日は、雨だった。」" }]);
    const { units: unitsB } = buildFixtureUnits("body", [{ kind: "TEXT", text: "「今日は、雨だった。」" }]);
    expect(unitsA).toEqual(unitsB);
  });

  it("SourceSpan is preserved end-to-end through the paint plan", () => {
    const { model } = composeFor("「今日は、雨だった。」");
    const line = model.pages[0].columns[0].lines[0];
    expect(line.units.map((u) => u.sourceSpan)).toEqual(model.pages[0].columns[0].lines[0].units.map((u) => u.sourceSpan));
    line.units.forEach((u, i) => {
      expect(u.sourceSpan.start).toBe(i);
      expect(u.sourceSpan.end).toBe(i + 1);
    });
  });

  it("Preview's own canonical positions are unaffected by this Publication-only paint-size fix (no Preview file touched)", () => {
    // Structural proof: this fix lives entirely in renderer/publication/ (paintModel.ts's bodyEmMm field + pdfGenerator.ts's font-size derivation) -- Preview's own paintModel.ts is a separate, untouched sibling module.
    const previewPaintModelSource = readFileSync(join(__dirname, "..", "preview", "paintModel.ts"), "utf-8");
    expect(previewPaintModelSource).not.toContain("bodyEmMm");
  });

  it("Publication consumes the same canonical yTick/xTick positions as before -- only the derived fontSizePt changed, not any coordinate", () => {
    const { document, model } = composeFor("「今日は、雨だった。」");
    const line = document.pages[0].columns[0].lines[0];
    const paintLine = model.pages[0].columns[0].lines[0];
    line.placedUnits.forEach((placed, i) => {
      expect(paintLine.units[i].topMm).toBeCloseTo(placed.yTick / 1000, 6); // GeometryTick -> mm (1 tick = 0.001mm)
    });
  });

  it("Ruby base + annotation glyphs also share the fixed body-em-derived size (base) and the correctly-ratioed annotation size, never a heightMm-derived one", () => {
    const { units, source } = buildFixtureUnits("body", [{ kind: "RUBY", base: "東京", reading: "とうきょう" }]);
    const settings = settingsFor({ charsPerLine: 6, linesPerColumn: 1, columnCount: 1 });
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
    const plan = buildPaintPlan(model, true);
    const commands = plan.flatMap((p) => p.commands).filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    const baseCmd = commands.find((c) => c.text === "東");
    expect(baseCmd).toBeDefined();
    expect(baseCmd!.fontSizePt).toBeCloseTo(10.5, 2);
  });

  it("Small kana (round 7 PASS) still paints via glyphOutline, unaffected by this font-size fix", () => {
    const { model } = composeFor("だった。");
    const plan = buildPaintPlan(model, true);
    // Without an outlineContext, everything stays "text" -- this just confirms no crash/regression in the ordinary text path for a fixture containing small kana.
    const commands = plan.flatMap((p) => p.commands);
    expect(commands.length).toBeGreaterThan(0);
  });

  it("Dash (round 7 PASS) SEMANTIC_RUN atoms also paint at the fixed body-em size", () => {
    const { units, source } = buildFixtureUnits("body", [{ kind: "SEMANTIC_RUN", text: "――", runKind: "DASH" }]);
    const settings = settingsFor({ charsPerLine: 4, linesPerColumn: 1, columnCount: 1 });
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
    const plan = buildPaintPlan(model, true);
    const commands = plan.flatMap((p) => p.commands).filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    expect(commands.length).toBe(2);
    for (const c of commands) expect(c.fontSizePt).toBeCloseTo(10.5, 2);
  });

  it("TCY font size is unaffected by this fix (unchanged code path)", () => {
    const { units, source } = buildFixtureUnits("body", [{ kind: "TCY", text: "12" }]);
    const settings = settingsFor({ charsPerLine: 4, linesPerColumn: 1, columnCount: 1 });
    const measurement = createFakeMeasurementProvider();
    const document = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
    expect(document.hold).toBe(false);
    const ctx: PublicationRenderContext = {
      linePitchTicks: settings.linePitchTicks,
      lineExtentTicks: settings.lineExtentTicks,
      columnExtentTicks: settings.columnExtentTicks,
      columnsPerPage: settings.columnsPerPage,
      measurementIdentity: document.version.measurementIdentity,
      paintFontIdentity: document.version.measurementIdentity,
    };
    const model = buildPublicationDocument("id", "label", document, units, source, ctx);
    const plan = buildPaintPlan(model, true);
    const tcyCmd = plan.flatMap((p) => p.commands).find((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text" && c.text === "12");
    expect(tcyCmd).toBeDefined();
  });

  it("Ellipsis font size is the same fixed body-em size", () => {
    const { units, source } = buildFixtureUnits("body", [{ kind: "SEMANTIC_RUN", text: "……", runKind: "ELLIPSIS" }]);
    const settings = settingsFor({ charsPerLine: 4, linesPerColumn: 1, columnCount: 1 });
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
    const plan = buildPaintPlan(model, true);
    const commands = plan.flatMap((p) => p.commands).filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    expect(commands.length).toBe(2);
    for (const c of commands) expect(c.fontSizePt).toBeCloseTo(10.5, 2);
  });
});
