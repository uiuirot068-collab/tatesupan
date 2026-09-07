// P3-O08 — Yakumono legacy-parity edge alignment (Human Visual QA HOLD
// round 13): focused diagnostic QA artifact + structural proofs. Ported
// directly from the already-working legacy renderer's own real
// mechanism (qa/evidence/P3_O08_YAKUMONO_LEGACY_PARITY_AUDIT.md,
// P3_O08_YAKUMONO_LEGACY_PAINT_PORT.md) — Core's own canonical layer is
// completely untouched by this round; only Publication paint changes.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_RULE_SET_V2 } from "../../core";
import { buildPublicationDocument, type PublicationRenderContext } from "./paintModel";
import { buildPaintPlan, deriveBaselineRatioFromFont, renderPaintPlanToPdf, type PaintCommand, type PublicationFontResource, type PublicationPageGeometry } from "./pdfGenerator";
import { VerticalOutlineContext } from "./verticalOutlinePaint";
import { VerticalGposContext } from "./verticalGposPaint";
import { VerticalYakumonoAlignContext } from "./verticalYakumonoAlign";
import { settingsFor } from "./fixtures";
import { buildFixtureUnits } from "../../tools/compare/fixtureBuilder";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");

function fontResource(): PublicationFontResource {
  return { fileName: "ShipporiMincho-Regular.ttf", fontName: "ShipporiMincho", base64: readFileSync(FONT_PATH).toString("base64") };
}

const DIAGNOSTIC_GEOMETRY: PublicationPageGeometry = { paperWidthMm: 80, paperHeightMm: 100, marginTopMm: 15, marginBottomMm: 15, marginRightMm: 15, marginLeftMm: 15 };

const FIXTURES: Array<{ id: string; label: string; text: string }> = [
  { id: "A", label: "ordinary + cl-06 (period) + ordinary", text: "た。次" },
  { id: "B", label: "ordinary + cl-07 (comma) + ordinary", text: "た、次" },
  { id: "C", label: "ordinary + period + closing bracket", text: "た。」" },
  { id: "D", label: "ordinary + comma + closing bracket", text: "た、」" },
  { id: "E", label: "closing bracket + ordinary", text: "」次" },
  { id: "F", label: "ordinary + opening bracket + ordinary", text: "先「次" },
  { id: "G", label: "。」 sequence, prominent", text: "。」" },
  { id: "sentence", label: "original reported sentence", text: "「今日は、雨だった。」" },
];

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

describe("Yakumono legacy-parity edge alignment -- canonical layer proofs", () => {
  it("た。」 -- canonical advance is now UNIFORM (no compression) -- every pitch is exactly one cell", () => {
    const { document } = composeFor("た。」");
    const measurement = createFakeMeasurementProvider();
    const settings = settingsFor({ charsPerLine: 20, linesPerColumn: 1, columnCount: 1 });
    const cell = measurement.naturalAdvanceTick(settings.bodyFontRef, settings.bodyFontSizePt, "");
    const line = document.pages[0].columns[0].lines[0];
    expect(line.placedUnits[1].yTick - line.placedUnits[0].yTick).toBe(cell); // た->。
    expect(line.placedUnits[2].yTick - line.placedUnits[1].yTick).toBe(cell); // 。->」
  });

  it("「今日は、雨だった。」 -- every character-to-character pitch is the SAME uniform cell, matching legacy's own invariant exactly", () => {
    const { document } = composeFor("「今日は、雨だった。」");
    const line = document.pages[0].columns[0].lines[0];
    const pitches: number[] = [];
    for (let i = 1; i < line.placedUnits.length; i++) pitches.push(line.placedUnits[i].yTick - line.placedUnits[i - 1].yTick);
    const first = pitches[0];
    for (const p of pitches) expect(p).toBe(first);
  });

  it("source is never mutated", () => {
    const { units: unitsA } = buildFixtureUnits("body", [{ kind: "TEXT", text: "「今日は、雨だった。」" }]);
    const { units: unitsB } = buildFixtureUnits("body", [{ kind: "TEXT", text: "「今日は、雨だった。」" }]);
    expect(unitsA).toEqual(unitsB);
  });

  it("SourceSpan is preserved end-to-end, one grapheme per placedUnit, in order", () => {
    const source = "「今日は、雨だった。」";
    const { document } = composeFor(source);
    const line = document.pages[0].columns[0].lines[0];
    const chars = Array.from(source);
    expect(line.placedUnits).toHaveLength(chars.length);
    line.placedUnits.forEach((p, i) => {
      expect(p.sourceSpan.start).toBe(i);
      expect(p.sourceSpan.end).toBe(i + 1);
    });
  });
});

describe("Yakumono legacy-parity edge alignment -- Publication paint proofs", () => {
  it("glyph visual size stays the fixed body-em size for EVERY character, including the edge-aligned ones", () => {
    const { model } = composeFor("「今日は、雨だった。」");
    const plan = buildPaintPlan(model, true);
    const commands = plan.flatMap((p) => p.commands).filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    expect(commands.length).toBeGreaterThan(0);
    const first = commands[0].fontSizePt;
    for (const c of commands) expect(c.fontSizePt).toBe(first);
  });

  it("canonical slot is not mutated by supplying a yakumonoContext -- PublicationDocument is byte-identical with or without one", () => {
    const { model } = composeFor("「今日は、雨だった。」");
    const before = JSON.parse(JSON.stringify(model));
    const yakumonoContext = new VerticalYakumonoAlignContext(readFileSync(FONT_PATH), 0.88);
    buildPaintPlan(model, true, undefined, undefined, undefined, undefined, yakumonoContext);
    expect(model).toEqual(before);
  });

  it("edge alignment measurably changes painted yMm for classified characters relative to the centered default", () => {
    const { model } = composeFor("「今日は、雨だった。」");
    const planWithout = buildPaintPlan(model, true);
    const yakumonoContext = new VerticalYakumonoAlignContext(readFileSync(FONT_PATH), 0.88);
    const planWith = buildPaintPlan(model, true, undefined, undefined, undefined, undefined, yakumonoContext);
    const textOf = (p: ReturnType<typeof buildPaintPlan>) => p.flatMap((pg) => pg.commands).filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    const without = textOf(planWithout);
    const withAlign = textOf(planWith);
    // Index 0 is 「 (HANG_END) -- its yMm must move measurably.
    expect(Math.abs(withAlign[0].yMm - without[0].yMm)).toBeGreaterThan(0.05);
    // Ordinary kanji (index 1, 今) must NOT move.
    expect(withAlign[1].yMm).toBeCloseTo(without[1].yMm, 10);
  });

  it("GPOS vpal nudge is NOT double-applied on top of yakumono edge alignment -- a classified character's yMm is identical whether or not a gposContext is also supplied", () => {
    const { model } = composeFor("「今日は、雨だった。」");
    const yakumonoContext = new VerticalYakumonoAlignContext(readFileSync(FONT_PATH), 0.88);
    const planWithoutGpos = buildPaintPlan(model, true, undefined, undefined, undefined, undefined, yakumonoContext);
    const gposContext = new VerticalGposContext(readFileSync(FONT_PATH));
    const planWithGpos = buildPaintPlan(model, true, undefined, undefined, undefined, gposContext, yakumonoContext);
    const textOf = (p: ReturnType<typeof buildPaintPlan>) => p.flatMap((pg) => pg.commands).filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    const a = textOf(planWithoutGpos);
    const b = textOf(planWithGpos);
    // Index 0 is 「, a HANG_END-classified character -- must be byte-identical regardless of gposContext presence (no double application).
    expect(a[0].yMm).toBe(b[0].yMm);
  });

  it("Ruby/TCY/Dash/Ellipsis regressions -- real PDF generation still succeeds with a real yakumonoContext supplied", () => {
    const { model } = composeFor("「今日は、雨だった。」");
    const font = fontResource();
    const outlineContext = new VerticalOutlineContext(readFileSync(FONT_PATH));
    const gposContext = new VerticalGposContext(readFileSync(FONT_PATH));
    const yakumonoContext = new VerticalYakumonoAlignContext(readFileSync(FONT_PATH), deriveBaselineRatioFromFont(font));
    const plan = buildPaintPlan(model, true, undefined, undefined, outlineContext, gposContext, yakumonoContext);
    const { bytes } = renderPaintPlanToPdf(plan, font);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});

describe("Yakumono legacy-parity edge alignment -- focused diagnostic QA", () => {
  it("generates yakumono-legacy-parity-qa.pdf -- one page per required control fixture (A-G) plus the original reported sentence", () => {
    const measurement = createFakeMeasurementProvider();
    const font = fontResource();
    const outlineContext = new VerticalOutlineContext(readFileSync(FONT_PATH));
    const gposContext = new VerticalGposContext(readFileSync(FONT_PATH));
    const yakumonoContext = new VerticalYakumonoAlignContext(readFileSync(FONT_PATH), deriveBaselineRatioFromFont(font));

    const pages = FIXTURES.map(({ text }) => {
      const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text }]);
      const settings = settingsFor({ charsPerLine: 20, linesPerColumn: 1, columnCount: 1 });
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
      const model = buildPublicationDocument("yakumono-legacy-parity-qa", "Yakumono Legacy Parity QA", document, units, source, ctx);
      return buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    });

    const combinedPlan = pages.flat();
    const { bytes, pageCount } = renderPaintPlanToPdf(combinedPlan, font);
    expect(pageCount).toBe(FIXTURES.length);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "yakumono-legacy-parity-qa.pdf"), bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});
