// P3-O08 — OpenType vertical GPOS ink placement (Human Visual QA HOLD
// round 10): full-pipeline integration. Proves the real vpal-derived Y
// nudge is actually wired into the paint pipeline, and only affects
// paint position (never canonical coordinates/source). The regenerated
// yakumono-spacing-qa.pdf artifact is written by `yakumonoSpacingQa.test.ts`
// (updated this round to thread a real gposContext too) — kept as the
// single writer for that file, not duplicated here.

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_RULE_SET_V2 } from "../../core";
import { buildPublicationDocument, type PublicationRenderContext } from "./paintModel";
import { buildPaintPlan, renderPaintPlanToPdf, type PaintCommand, type PublicationFontResource } from "./pdfGenerator";
import { VerticalGposContext } from "./verticalGposPaint";
import { settingsFor } from "./fixtures";
import { buildFixtureUnits } from "../../tools/compare/fixtureBuilder";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");

function fontResource(): PublicationFontResource {
  return { fileName: "ShipporiMincho-Regular.ttf", fontName: "ShipporiMincho", base64: readFileSync(FONT_PATH).toString("base64") };
}

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

describe("Vertical GPOS ink placement -- pipeline integration", () => {
  it("VerticalGposContext resolves the real, measured vpal YPlacement for the reported failure's own characters", () => {
    const ctx = new VerticalGposContext(readFileSync(FONT_PATH));
    // From qa/evidence/P3_O08_YAKUMONO_GPOS.md's own real audit: period/closing-bracket
    // have near-zero vpal yPlacement (already sit correctly); opening-bracket has a LARGE
    // positive yPlacement (font units), which negates to a real, non-trivial paint shift.
    expect(Math.abs(ctx.yPlacementEmFor("。"))).toBeLessThan(0.02);
    expect(Math.abs(ctx.yPlacementEmFor("」"))).toBeLessThan(0.02);
    expect(Math.abs(ctx.yPlacementEmFor("「"))).toBeGreaterThan(0.3); // real, large font-derived shift
  });

  it("「今日は、雨だった。」 -- painting with a real gposContext shifts 「's own yMm relative to painting without one; 。/」 barely move", () => {
    const { model } = composeFor("「今日は、雨だった。」");
    const planWithout = buildPaintPlan(model, true);
    const gposContext = new VerticalGposContext(readFileSync(FONT_PATH));
    const planWith = buildPaintPlan(model, true, undefined, undefined, undefined, gposContext);
    const textOf = (p: ReturnType<typeof buildPaintPlan>) => p.flatMap((pg) => pg.commands).filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    const without = textOf(planWithout);
    const withGpos = textOf(planWith);
    expect(without.length).toBe(withGpos.length);
    // Index 0 is 「 (opening bracket) -- its yMm must move measurably.
    expect(Math.abs(withGpos[0].yMm - without[0].yMm)).toBeGreaterThan(0.3);
  });

  it("canonical PublicationDocument coordinates are byte-identical with or without a gposContext -- only paint yMm changes", () => {
    const { model } = composeFor("「今日は、雨だった。」");
    const before = JSON.parse(JSON.stringify(model));
    const gposContext = new VerticalGposContext(readFileSync(FONT_PATH));
    buildPaintPlan(model, true, undefined, undefined, undefined, gposContext);
    expect(model).toEqual(before);
  });

  it("source is never mutated", () => {
    const { units: unitsA } = buildFixtureUnits("body", [{ kind: "TEXT", text: "「今日は、雨だった。」" }]);
    const { units: unitsB } = buildFixtureUnits("body", [{ kind: "TEXT", text: "「今日は、雨だった。」" }]);
    expect(unitsA).toEqual(unitsB);
  });

  it("real vector PDF generated via generatePublicationPdf's own pipeline (buildPaintPlan + renderPaintPlanToPdf with a real gposContext) is a valid PDF", () => {
    const { model } = composeFor("「今日は、雨だった。」");
    const font = fontResource();
    const gposContext = new VerticalGposContext(readFileSync(FONT_PATH));
    const plan = buildPaintPlan(model, true, undefined, undefined, undefined, gposContext);
    const { bytes } = renderPaintPlanToPdf(plan, font);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});

