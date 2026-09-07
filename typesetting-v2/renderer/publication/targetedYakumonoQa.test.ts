// P3-O08 -- Human Visual QA HOLD round 14, Part 2: focused diagnostic QA
// for the narrow cl-06/cl-07 -> cl-02 pair-advance-suppression rule
// (core/compose/line.ts's `conditionalYakumonoPairAdvanceTick`), combined
// with round 13's already-ported legacy paint-time edge alignment
// (verticalYakumonoAlign.ts). Structural proofs already live in
// core/compose/conditionalYakumonoPair.test.ts (Core layer) and
// yakumonoLegacyParityQa.test.ts/glyphSizeIndependence.test.ts (updated
// for round 14's known, intended pitch change) -- this file's own job is
// the two required visual artifacts plus glyph-size-at-Publication-paint
// proofs for the affected pairs.

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
  { id: "A", label: "た。次 -- control: 。 followed by ordinary text must NOT move", text: "た。次" },
  { id: "B", label: "た、次 -- control: 、 followed by ordinary text must NOT move", text: "た、次" },
  { id: "C", label: "た。」 -- 。」 must be visibly tighter", text: "た。」" },
  { id: "D", label: "た、」 -- 、」 must be visibly tighter", text: "た、」" },
  { id: "E", label: "「今日は、雨だった。」 -- original reported sentence", text: "「今日は、雨だった。」" },
];

const CELL_DEBUG_FIXTURES = ["た。次", "た。」", "た、次", "た、」"];

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

describe("Targeted yakumono QA -- Publication paint proofs (glyph size never shrinks)", () => {
  it("た。」 -- 。 and 」 both keep the fixed body-em fontSizePt, even though 。's own advance is suppressed (test 8)", () => {
    const { model } = composeFor("た。」");
    const plan = buildPaintPlan(model, true);
    const commands = plan.flatMap((p) => p.commands).filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    expect(commands.length).toBeGreaterThan(0);
    const first = commands[0].fontSizePt;
    for (const c of commands) expect(c.fontSizePt).toBe(first);
  });

  it("た、」 -- 、 and 」 both keep the fixed body-em fontSizePt (test 9)", () => {
    const { model } = composeFor("た、」");
    const plan = buildPaintPlan(model, true);
    const commands = plan.flatMap((p) => p.commands).filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    expect(commands.length).toBeGreaterThan(0);
    const first = commands[0].fontSizePt;
    for (const c of commands) expect(c.fontSizePt).toBe(first);
  });

  it("no glyph collision -- every painted unit in the reported sentence still has a strictly increasing yTick (never overlapping)", () => {
    const { document } = composeFor("「今日は、雨だった。」");
    const line = document.pages[0].columns[0].lines[0];
    for (let i = 1; i < line.placedUnits.length; i++) {
      expect(line.placedUnits[i].yTick).toBeGreaterThan(line.placedUnits[i - 1].yTick);
    }
  });
});

describe("Targeted yakumono QA -- generates targeted-yakumono-qa.pdf (fixtures A-E)", () => {
  it("one page per fixture, real vector PDF, with the real legacy-parity paint context threaded through", () => {
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
      const model = buildPublicationDocument("targeted-yakumono-qa", "Targeted Yakumono QA", document, units, source, ctx);
      return buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    });

    const combinedPlan = pages.flat();
    const { bytes, pageCount } = renderPaintPlanToPdf(combinedPlan, font);
    expect(pageCount).toBe(FIXTURES.length);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "targeted-yakumono-qa.pdf"), bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});

describe("Targeted yakumono QA -- generates targeted-yakumono-cell-debug.pdf (QA-only cell-boundary overlay)", () => {
  it("one page per fixture, cell-boundary rects only (no ink-bbox overlay needed here -- see small-kana-cell-debug.pdf for that), never part of normal Publication output", () => {
    const font = fontResource();
    const outlineContext = new VerticalOutlineContext(readFileSync(FONT_PATH));
    const gposContext = new VerticalGposContext(readFileSync(FONT_PATH));
    const yakumonoContext = new VerticalYakumonoAlignContext(readFileSync(FONT_PATH), deriveBaselineRatioFromFont(font));
    const measurement = createFakeMeasurementProvider();

    const pages = CELL_DEBUG_FIXTURES.map((text) => {
      const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text }]);
      const settings = settingsFor({ charsPerLine: 20, linesPerColumn: 1, columnCount: 1 });
      const document = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
      const ctx: PublicationRenderContext = {
        linePitchTicks: settings.linePitchTicks,
        lineExtentTicks: settings.lineExtentTicks,
        columnExtentTicks: settings.columnExtentTicks,
        columnsPerPage: settings.columnsPerPage,
        measurementIdentity: document.version.measurementIdentity,
        paintFontIdentity: document.version.measurementIdentity,
      };
      const model = buildPublicationDocument("targeted-yakumono-cell-debug", "Targeted Yakumono Cell Debug", document, units, source, ctx);
      const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);

      // QA-ONLY overlay: one cell-boundary rect per placed unit, computed
      // with the SAME coordinate formulas buildPaintPlan itself uses.
      // Never wired into buildPaintPlan/generatePublicationPdf -- this
      // overlay does not exist in normal Publication output.
      const overlay: PaintCommand[] = [];
      const page = model.pages[0];
      const contentRightEdgeMm = DIAGNOSTIC_GEOMETRY.paperWidthMm - DIAGNOSTIC_GEOMETRY.marginRightMm;
      const yOffsetMm = DIAGNOSTIC_GEOMETRY.marginTopMm;
      for (const column of page.columns) {
        for (const line of column.lines) {
          const x = contentRightEdgeMm - column.rightMm - line.rightMm - line.widthMm;
          for (const unit of line.units) {
            overlay.push({ op: "rect", xMm: x, yMm: yOffsetMm + unit.topMm, widthMm: line.widthMm, heightMm: unit.heightMm });
          }
        }
      }
      return plan.map((p, i) => (i === 0 ? { ...p, commands: [...overlay, ...p.commands] } : p));
    });

    const combinedPlan = pages.flat();
    const { bytes, pageCount } = renderPaintPlanToPdf(combinedPlan, font);
    expect(pageCount).toBe(CELL_DEBUG_FIXTURES.length);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "targeted-yakumono-cell-debug.pdf"), bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});
