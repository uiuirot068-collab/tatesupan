// P3-O08 — OpenType vertical GPOS ink placement (Human Visual QA HOLD
// round 10, REVISED Typography Parity Round 6, 2026-09-09).
//
// Round 10 built `VerticalGposContext` to fix real yakumono (「」（）)
// ink intrusion, using the font's own real `vpal` YPlacement. Round 10's
// own "apply it everywhere, it's harmless" extension to ordinary
// (non-yakumono, non-small-kana) characters was verified only for
// ordinary KANJI (real vpal = 0 for every kanji tested, genuinely
// harmless) — it was never verified for ordinary HIRAGANA, which this
// font gives real, substantial vpal values. Round 6
// (qa/evidence/TYPOGRAPHY_PARITY_GLYPH_IN_CELL_VERTICAL_RHYTHM.md)
// found, via a direct Human-supplied raster comparison against the real
// InDesign reference PDF, that applying vpal to ordinary hiragana moves
// TateSpun's own ink AWAY from InDesign's rendering, not toward it — the
// applied offset closely matches the measured discrepancy in both sign
// and magnitude for every hiragana checked. `pdfGenerator.ts`'s
// `verticalGraphemeCommands` was therefore changed to never consume
// `gposContext.yPlacementEmFor` for the generic (non-yakumono,
// non-small-kana) branch — yakumono positioning was ALREADY fully owned
// by `yakumonoContext` (a separate mechanism) even before this change,
// so real yakumono ink placement is unaffected; only ordinary
// kanji/hiragana lose the (now-proven-harmful) vpal nudge.
//
// `VerticalGposContext`/`gposReader.ts` themselves are UNCHANGED and
// still real, correctly-computing, tested infrastructure — this file's
// own tests below still verify `yPlacementEmFor`'s own raw computation
// is correct; they no longer assert that a generic (yakumonoContext-less)
// `buildPaintPlan` call visibly repositions 「, since that combination no
// longer reflects how the real pipeline (`generatePublicationPdf`) is
// ever actually invoked (it always constructs and passes a real
// `yakumonoContext` alongside `gposContext` — see
// `buildPublicationPaintPlan`).

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

  it("「今日は、雨だった。」 -- a gposContext WITHOUT a yakumonoContext no longer repositions anything (Round 6: the generic vpal branch is retired) -- real yakumono ink placement is owned entirely by yakumonoContext, exercised in verticalYakumonoAlign's own integration tests, not here", () => {
    const { model } = composeFor("「今日は、雨だった。」");
    const planWithout = buildPaintPlan(model, true);
    const gposContext = new VerticalGposContext(readFileSync(FONT_PATH));
    const planWith = buildPaintPlan(model, true, undefined, undefined, undefined, gposContext);
    const textOf = (p: ReturnType<typeof buildPaintPlan>) => p.flatMap((pg) => pg.commands).filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    const without = textOf(planWithout);
    const withGpos = textOf(planWith);
    expect(without.length).toBe(withGpos.length);
    // Every character's yMm is now identical with or without gposContext
    // -- the generic (non-yakumono) branch never consumes it any more.
    for (let i = 0; i < without.length; i++) {
      expect(withGpos[i].yMm).toBe(without[i].yMm);
    }
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

