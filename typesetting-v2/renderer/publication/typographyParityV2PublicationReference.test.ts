// TYPOGRAPHY PARITY -- InDesign Overlay Drift, Round 2, Phase 1: a
// CONTROLLED v2 Publication reference PDF. Real v2 Core
// (`composeCanonicalDocument`), real `CanonicalDocument`, real Publication
// renderer (`generatePublicationPdf`), real committed Shippori Mincho font
// (via `createShipporiMinchoMeasurementProvider` -- NOT the fake/test
// provider every other fixture in this directory uses, specifically so
// this PDF's own measurement facts are the real font's, matching what a
// Human InDesign-overlay comparison needs). No legacy screenshot
// renderer, no DOM capture, no rasterized page wrapper -- this is the
// exact same production entrypoint `generatePublicationPdf` the v2Bridge
// (`src/lib/v2Bridge/composeV2Document.ts`) itself calls, just invoked
// directly here (never importing FROM src/, preserving the existing
// typesetting-v2-must-not-depend-on-src/ boundary).
//
// Geometry choice, disclosed: paper 文庫 (105x148mm) -- TateSpun's own
// most common preset (see src/utils/exportPdf.ts's PAPER_SIZES table,
// not imported here, value re-stated for evidence transparency), margins
// matching the existing structuralColophonRealSettings.test.ts precedent
// in this same directory (15/12/15/15mm). This is NOT known to match the
// Human's own InDesign reference settings -- that fact is explicitly
// unknown and recorded as such in qa/evidence/
// TYPOGRAPHY_PARITY_INDDesign_OVERLAY_DRIFT.md, not guessed.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { composeCanonicalDocument, DEFAULT_RULE_SET_V2, mmToTicks, type PageCompositionSettings } from "../../core";
import { buildPublicationDocument, type PublicationRenderContext } from "./paintModel";
import { generatePublicationPdf, type PublicationFontResource, type PublicationPageGeometry } from "./pdfGenerator";
import { buildFixtureUnits } from "../../tools/compare/fixtureBuilder";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");

function fontResource(): PublicationFontResource {
  return { fileName: "ShipporiMincho-Regular.ttf", fontName: "ShipporiMincho", base64: readFileSync(FONT_PATH).toString("base64") };
}

// The checkpoint's own canonical continuous-prose sample, verbatim --
// never substituted with punctuation-heavy diagnostic text.
const PARAGRAPH_1 = "人は驚きすぎると、本当に足が止まるらしい。スイはそれを初めて知った。数歩先へ行ったモルが振り返る。";
const PARAGRAPH_2 = "「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」";

const BODY_FONT_SIZE_PT = 10.5; // same fixture convention as fixtures.ts's own BODY_FONT_SIZE_PT

// 文庫 (105x148mm), margins matching this directory's own existing
// structuralColophonRealSettings.test.ts precedent for the identical
// paper size -- reused for consistency, not re-derived arbitrarily.
const PAGE_GEOMETRY: PublicationPageGeometry = {
  paperWidthMm: 105,
  paperHeightMm: 148,
  marginTopMm: 15,
  marginBottomMm: 12,
  marginRightMm: 15,
  marginLeftMm: 15,
};

function buildSettings(): PageCompositionSettings {
  const perCellAdvanceTick = mmToTicks((BODY_FONT_SIZE_PT * 25.4) / 72);
  const contentHeightMm = PAGE_GEOMETRY.paperHeightMm - PAGE_GEOMETRY.marginTopMm - PAGE_GEOMETRY.marginBottomMm;
  const contentWidthMm = PAGE_GEOMETRY.paperWidthMm - PAGE_GEOMETRY.marginLeftMm - PAGE_GEOMETRY.marginRightMm;
  const emMm = (BODY_FONT_SIZE_PT * 25.4) / 72;
  const charsPerLine = Math.floor(contentHeightMm / emMm);
  const linesPerColumn = Math.floor(contentWidthMm / emMm);
  return {
    bodyFontRef: "typography-parity-v2-reference",
    bodyFontSizePt: BODY_FONT_SIZE_PT,
    lineExtentTicks: charsPerLine * perCellAdvanceTick,
    linePitchTicks: perCellAdvanceTick,
    columnExtentTicks: linesPerColumn * perCellAdvanceTick,
    columnsPerPage: 1,
  };
}

describe("Typography Parity Round 2 -- controlled v2 Publication reference PDF", () => {
  it("composes and paints the canonical continuous-prose sample through the REAL, unmodified production pipeline (real font measurement, real generatePublicationPdf)", async () => {
    const { createShipporiMinchoMeasurementProvider } = await import("../../core/measurement/shipporiMinchoProvider");
    const measurement = createShipporiMinchoMeasurementProvider(FONT_PATH);
    const settings = buildSettings();

    const { units, source } = buildFixtureUnits("body", [
      { kind: "TEXT", text: PARAGRAPH_1 },
      { kind: "PARAGRAPH_BREAK" },
      { kind: "TEXT", text: PARAGRAPH_2 },
    ]);

    const document = composeCanonicalDocument({
      bodyUnits: units,
      ruleSet: DEFAULT_RULE_SET_V2,
      measurement,
      settings,
    });

    expect(document.hold).toBe(false);

    const ctx: PublicationRenderContext = {
      linePitchTicks: settings.linePitchTicks,
      lineExtentTicks: settings.lineExtentTicks,
      columnExtentTicks: settings.columnExtentTicks,
      columnsPerPage: settings.columnsPerPage,
      measurementIdentity: document.version.measurementIdentity,
      paintFontIdentity: document.version.measurementIdentity,
    };
    const model = buildPublicationDocument("typography-parity-v2-reference", "Typography Parity — v2 Publication Reference", document, units, source, ctx);

    const font = fontResource();
    const result = generatePublicationPdf(model, font, PAGE_GEOMETRY);
    expect(new TextDecoder().decode(result.bytes.slice(0, 5))).toBe("%PDF-");
    expect(result.pageCount).toBeGreaterThan(0);

    // Real geometry facts, recorded for the evidence doc -- not decorative.
    const emMm = (BODY_FONT_SIZE_PT * 25.4) / 72;
    // eslint-disable-next-line no-console
    console.log(
      "V2_PUBLICATION_REFERENCE_GEOMETRY",
      JSON.stringify({
        paperWidthMm: PAGE_GEOMETRY.paperWidthMm,
        paperHeightMm: PAGE_GEOMETRY.paperHeightMm,
        marginTopMm: PAGE_GEOMETRY.marginTopMm,
        marginBottomMm: PAGE_GEOMETRY.marginBottomMm,
        marginRightMm: PAGE_GEOMETRY.marginRightMm,
        marginLeftMm: PAGE_GEOMETRY.marginLeftMm,
        bodyFontSizePt: BODY_FONT_SIZE_PT,
        bodyEmMm: emMm,
        charPitchMm: emMm,
        columnPitchMm: emMm,
        contentTopAnchorMm: PAGE_GEOMETRY.marginTopMm,
        firstColumnRightAnchorMm: PAGE_GEOMETRY.paperWidthMm - PAGE_GEOMETRY.marginRightMm,
        charsPerLine: settings.lineExtentTicks / settings.linePitchTicks,
        linesPerColumn: settings.columnExtentTicks / settings.linePitchTicks,
        columnsPerPage: settings.columnsPerPage,
        pageCount: result.pageCount,
        measurementIdentity: document.version.measurementIdentity,
        fontSha256Prefix: measurement.assetInfo.sha256.slice(0, 16),
        fontUnitsPerEm: measurement.assetInfo.unitsPerEm,
      })
    );

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "typography-parity-v2-publication-reference.pdf"), result.bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});
