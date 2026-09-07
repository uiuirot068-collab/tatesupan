// Human Visual QA HOLD round 11 (yakumono half-body canonical model —
// qa/evidence/P3_O08_YAKUMONO_HALF_BODY_MODEL.md): focused diagnostic QA
// artifact, one page per required control fixture (A-G) plus the
// original reported sentence, at a large enough size for real visual
// inspection. Publication automatically inherits the corrected canonical
// half-body positions from Core (round 11) — no Publication-side
// spacing logic exists or is added here.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_RULE_SET_V2 } from "../../core";
import { buildPublicationDocument, type PublicationRenderContext } from "./paintModel";
import { buildPaintPlan, renderPaintPlanToPdf, type PublicationFontResource, type PublicationPageGeometry } from "./pdfGenerator";
import { VerticalOutlineContext } from "./verticalOutlinePaint";
import { VerticalGposContext } from "./verticalGposPaint";
import { settingsFor } from "./fixtures";
import { buildFixtureUnits } from "../../tools/compare/fixtureBuilder";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");

function fontResource(): PublicationFontResource {
  return { fileName: "ShipporiMincho-Regular.ttf", fontName: "ShipporiMincho", base64: readFileSync(FONT_PATH).toString("base64") };
}

// Large diagnostic geometry -- generously sized cells, few characters per
// line, so each control fixture reads clearly for Human visual review
// (not a tiny/cramped rendering).
const DIAGNOSTIC_GEOMETRY: PublicationPageGeometry = { paperWidthMm: 80, paperHeightMm: 100, marginTopMm: 15, marginBottomMm: 15, marginRightMm: 15, marginLeftMm: 15 };

const FIXTURES: Array<{ id: string; label: string; text: string }> = [
  { id: "A", label: "ordinary + cl-06 (period) + ordinary", text: "た。次" },
  { id: "B", label: "ordinary + cl-07 (comma) + ordinary", text: "た、次" },
  { id: "C", label: "ordinary + cl-06 + cl-02 (period then closing bracket)", text: "た。」" },
  { id: "D", label: "ordinary + cl-07 + cl-02 (comma then closing bracket)", text: "た、」" },
  { id: "E", label: "cl-02 (closing bracket) + ordinary", text: "」次" },
  { id: "F", label: "ordinary + cl-01 (opening bracket) + ordinary", text: "先「次" },
  { id: "G", label: "。」 sequence, prominent", text: "。」" },
  { id: "sentence", label: "original reported sentence", text: "「今日は、雨だった。」" },
];

describe("Yakumono half-body model -- focused diagnostic QA (real font/geometry/GSUB-outline/GPOS pipeline)", () => {
  it("generates yakumono-half-body-qa.pdf -- one page per required control fixture (A-G) plus the original reported sentence", () => {
    const measurement = createFakeMeasurementProvider();
    const font = fontResource();
    const outlineContext = new VerticalOutlineContext(readFileSync(FONT_PATH));
    const gposContext = new VerticalGposContext(readFileSync(FONT_PATH));

    const pdf = FIXTURES.map(({ text }) => {
      const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text }]);
      const settings = settingsFor({ charsPerLine: 10, linesPerColumn: 1, columnCount: 1 });
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
      const model = buildPublicationDocument("yakumono-half-body-qa", "Yakumono Half-Body QA", document, units, source, ctx);
      return buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext);
    });

    // Combine every fixture's own single page into one multi-page plan (one page per fixture, in order).
    const combinedPlan = pdf.flat();
    const { bytes, pageCount } = renderPaintPlanToPdf(combinedPlan, font);
    expect(pageCount).toBe(FIXTURES.length);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "yakumono-half-body-qa.pdf"), bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });

  it("canonical proof: fixture C (た。」) -- 。's own pitch is exactly half a cell, matching this round's own worked example", () => {
    const measurement = createFakeMeasurementProvider();
    const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text: "た。」" }]);
    const settings = settingsFor({ charsPerLine: 10, linesPerColumn: 1, columnCount: 1 });
    const document = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
    const line = document.pages[0].columns[0].lines[0];
    const period = line.placedUnits[1];
    const bracket = line.placedUnits[2];
    const cell = measurement.naturalAdvanceTick(settings.bodyFontRef, settings.bodyFontSizePt, "");
    expect(bracket.yTick - period.yTick).toBe(Math.round(cell * 0.5));
  });
});
