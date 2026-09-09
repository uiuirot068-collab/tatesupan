// TYPOGRAPHY PARITY -- InDesign Overlay Drift, Round 3, Step 2: a v2
// Publication reference PDF geometrically MATCHED to the real InDesign
// reference file (`qa/reference/indesign/molsui-indesign-reference.pdf`),
// per facts independently extracted from that PDF's own raw bytes
// (`typographyParityIndesignExtraction.test.ts`) -- superseding Round 2's
// own guessed 文庫/10.5pt geometry.
//
// Real v2 Core (`composeCanonicalDocument`), real `CanonicalDocument`,
// real Publication renderer (`generatePublicationPdf`), real committed
// Shippori Mincho font. No legacy screenshot renderer, no DOM capture, no
// rasterized page wrapper.

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

// The checkpoint's own canonical continuous-prose sample, verbatim.
const PARAGRAPH_1 = "人は驚きすぎると、本当に足が止まるらしい。スイはそれを初めて知った。数歩先へ行ったモルが振り返る。";
const PARAGRAPH_2 = "「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」";

// ---- Facts independently confirmed from the real InDesign reference PDF's
// own raw bytes (see typographyParityIndesignExtraction.test.ts and
// qa/evidence/TYPOGRAPHY_PARITY_INDESIGN_OVERLAY_DRIFT.md Round 3 §1) ----
const PT_PER_MM = 72 / 25.4;
const BODY_FONT_SIZE_PT = 9.0; // confirmed via Tm text-matrix scale (9 0 0 9 ...)
const MEASURED_COLUMN_PITCH_PT = 15.9095; // confirmed: mean of 20 consecutive Tm-X deltas, stddev < 0.0001pt
const MEASURED_MEDIA_BOX_PT = { widthPt: 419.528, heightPt: 595.276 }; // confirmed via /MediaBox
const PAPER_WIDTH_MM = MEASURED_MEDIA_BOX_PT.widthPt / PT_PER_MM; // 148.0mm -- A5 portrait, confirmed
const PAPER_HEIGHT_MM = MEASURED_MEDIA_BOX_PT.heightPt / PT_PER_MM; // 210.0mm

// Margins are NOT precisely confirmed -- these are approximate, derived
// from the raw Tm pen-position coordinates of the first painted glyph run
// WITHOUT correcting for the CID vertical font's own position-vector
// offset (a real, disclosed limitation: exact sub-pt origin recovery would
// require decoding the embedded font's own DW2/W2 vertical metrics AND a
// CID-to-Unicode mapping neither of which this round builds). Column PITCH
// (the confirmed, high-precision fact, and the dimension that matters for
// the drift this round actually root-caused) does not depend on this
// approximation.
const APPROX_MARGIN_TOP_MM = (MEASURED_MEDIA_BOX_PT.heightPt - 544.252) / PT_PER_MM; // ~18.0mm
const APPROX_MARGIN_RIGHT_MM = PAPER_WIDTH_MM - 375.3425 / PT_PER_MM - MEASURED_COLUMN_PITCH_PT / PT_PER_MM / 2; // ~12.7mm, column-center approximation
const APPROX_MARGIN_BOTTOM_MM = APPROX_MARGIN_TOP_MM; // unmeasured -- disclosed placeholder, symmetric with top
const APPROX_MARGIN_LEFT_MM = APPROX_MARGIN_RIGHT_MM; // unmeasured -- disclosed placeholder, symmetric with right

const PAGE_GEOMETRY: PublicationPageGeometry = {
  paperWidthMm: PAPER_WIDTH_MM,
  paperHeightMm: PAPER_HEIGHT_MM,
  marginTopMm: APPROX_MARGIN_TOP_MM,
  marginBottomMm: APPROX_MARGIN_BOTTOM_MM,
  marginRightMm: APPROX_MARGIN_RIGHT_MM,
  marginLeftMm: APPROX_MARGIN_LEFT_MM,
};

function buildSettings(): PageCompositionSettings {
  const perCellAdvanceTick = mmToTicks(BODY_FONT_SIZE_PT / PT_PER_MM); // character advance -- Natural Pitch, 1em, UNCHANGED by this round's own fix
  const linePitchTick = mmToTicks(MEASURED_COLUMN_PITCH_PT / PT_PER_MM); // column-to-column pitch -- the REAL, independently-measured InDesign value, not 1em
  const contentHeightMm = PAGE_GEOMETRY.paperHeightMm - PAGE_GEOMETRY.marginTopMm - PAGE_GEOMETRY.marginBottomMm;
  const contentWidthMm = PAGE_GEOMETRY.paperWidthMm - PAGE_GEOMETRY.marginLeftMm - PAGE_GEOMETRY.marginRightMm;
  const emMm = BODY_FONT_SIZE_PT / PT_PER_MM;
  const columnPitchMm = MEASURED_COLUMN_PITCH_PT / PT_PER_MM;
  const charsPerLine = Math.floor(contentHeightMm / emMm);
  const linesPerColumn = Math.floor(contentWidthMm / columnPitchMm);
  return {
    bodyFontRef: "typography-parity-v2-reference-round3",
    bodyFontSizePt: BODY_FONT_SIZE_PT,
    lineExtentTicks: charsPerLine * perCellAdvanceTick,
    linePitchTicks: linePitchTick,
    columnExtentTicks: linesPerColumn * linePitchTick,
    columnsPerPage: 1,
  };
}

describe("Typography Parity Round 3 -- v2 Publication reference PDF matched to the real InDesign reference geometry", () => {
  it("composes and paints the canonical continuous-prose sample at A5/9pt/measured-column-pitch through the REAL, unmodified production pipeline", async () => {
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
      // Typography Parity Round 4: linePitchTicks here is the real,
      // matched InDesign COLUMN pitch (not the character em) -- glyph
      // scale must come from the character em separately, or every glyph
      // paints far too large. See paintModel.ts's own bodyFontSizeTick doc.
      bodyFontSizeTick: mmToTicks(BODY_FONT_SIZE_PT / PT_PER_MM),
    };
    const model = buildPublicationDocument("typography-parity-v2-reference-round3", "Typography Parity Round 3 — v2 Publication (InDesign-matched geometry)", document, units, source, ctx);

    const font = fontResource();
    const result = generatePublicationPdf(model, font, PAGE_GEOMETRY);
    expect(new TextDecoder().decode(result.bytes.slice(0, 5))).toBe("%PDF-");
    expect(result.pageCount).toBeGreaterThan(0);

    // Real geometry facts, recorded for the evidence doc.
    const emMm = BODY_FONT_SIZE_PT / PT_PER_MM;
    const columnPitchMm = MEASURED_COLUMN_PITCH_PT / PT_PER_MM;
    // eslint-disable-next-line no-console
    console.log(
      "V2_PUBLICATION_REFERENCE_ROUND3_GEOMETRY",
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
        columnPitchMm,
        columnPitchOverCharPitchRatio: columnPitchMm / emMm,
        charsPerLine: contentHeightChars(settings),
        linesPerColumn: settings.columnExtentTicks / settings.linePitchTicks,
        pageCount: result.pageCount,
        measurementIdentity: document.version.measurementIdentity,
        fontSha256Prefix: measurement.assetInfo.sha256.slice(0, 16),
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

function contentHeightChars(settings: PageCompositionSettings): number {
  const perCellAdvanceTick = mmToTicks(BODY_FONT_SIZE_PT / PT_PER_MM);
  return settings.lineExtentTicks / perCellAdvanceTick;
}
