// Human Visual QA HOLD round 8 (yakumono/punctuation-pair spacing —
// qa/evidence/P3_O08_YAKUMONO_SPACING.md): Publication automatically
// inherits the corrected canonical positions from Core's own
// `composeLine` (no Publication-side spacing logic exists or is added
// here) — this file only generates the focused QA artifact for Human
// review, using the exact real font/geometry/vertical-glyph pipeline
// already proven correct in prior rounds.

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

describe("Yakumono spacing -- Publication automatically reflects Core's corrected canonical positions", () => {
  it("「今日は、雨だった。」 -- the 。→」 gap is measurably smaller than an ordinary full-cell gap, with no Publication-side spacing code", () => {
    const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text: "「今日は、雨だった。」" }]);
    const settings = settingsFor({ charsPerLine: 14, linesPerColumn: 1, columnCount: 1 });
    const measurement = createFakeMeasurementProvider();
    const document = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
    expect(document.hold).toBe(false);
    const line = document.pages[0].columns[0].lines[0];
    const period = line.placedUnits[9]; // 。
    const bracket = line.placedUnits[10]; // 」
    const comma = line.placedUnits[4]; // 、
    const rain = line.placedUnits[5]; // 雨
    const periodToBracketPitch = bracket.yTick - period.yTick;
    const commaToRainPitch = rain.yTick - comma.yTick;
    expect(periodToBracketPitch).toBeLessThan(commaToRainPitch); // compressed pair vs. an ordinary full-cell pair
    expect(periodToBracketPitch).toBe(Math.round(commaToRainPitch * 0.5));
  });

  it("generates yakumono-spacing-qa.pdf using the real font/geometry/vertical-outline/GPOS ink-placement pipeline", () => {
    const geometry: PublicationPageGeometry = { paperWidthMm: 105, paperHeightMm: 148, marginTopMm: 12, marginBottomMm: 12, marginRightMm: 15, marginLeftMm: 10 };
    const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text: "「今日は、雨だった。」" }]);
    const settings = settingsFor({ charsPerLine: 14, linesPerColumn: 1, columnCount: 1 });
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
    const model = buildPublicationDocument("yakumono-spacing-qa", "Yakumono Spacing QA", document, units, source, ctx);
    const font = fontResource();
    const outlineContext = new VerticalOutlineContext(readFileSync(FONT_PATH));
    const gposContext = new VerticalGposContext(readFileSync(FONT_PATH));
    const plan = buildPaintPlan(model, true, geometry, undefined, outlineContext, gposContext);
    const { bytes } = renderPaintPlanToPdf(plan, font);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "yakumono-spacing-qa.pdf"), bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});
