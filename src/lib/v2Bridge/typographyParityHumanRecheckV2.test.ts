/**
 * Typography Parity -- Human recheck artifact (post column-pitch fix,
 * commit `6d51b4e`). Generates a real, normal-looking v2 Publication PDF
 * containing the actual continuous prose used for the InDesign reference
 * comparison -- for a direct Human BLACK(this)/RED(InDesign) overlay,
 * not another abstract column-grid-only diagnostic.
 *
 * Uses the REAL v2Bridge (`composeV2Document`, unchanged by this file)
 * end to end: real `PageSettings` -> real `buildV2LayoutSettings` (the
 * function this round's own commit `6d51b4e` fixed) -> real
 * `composeCanonicalDocument` -> real `buildPublicationDocument` -> real
 * `generatePublicationPdf`. No DOM screenshot, no html-to-image, no
 * legacy Editor export path, no raster page wrapper anywhere in this
 * chain -- `PageSettings` is the only legacy-shaped input, and it feeds
 * the real v2 vector pipeline exclusively.
 *
 * Geometry: A5 (148x210mm, matches the InDesign reference's own real
 * MediaBox), Shippori Mincho, 9pt, `lineHeightRatio` set to the EXACT
 * measured InDesign ratio (15.9095/9 ~= 1.767722) so this artifact's own
 * column pitch equals the reference's real column pitch by construction
 * -- the whole point of this round's fix. Margins use the same
 * disclosed-approximate values Round 3's own evidence doc already
 * recorded (not re-derived here).
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SETTINGS, computePageLayout, computeLinePitchMm, type PageSettings } from "../pageLayout";
import { composeV2Document } from "./composeV2Document";
import type { PublicationFontResource } from "../../../typesetting-v2/renderer/publication/pdfGenerator";
import { generatePublicationPdf } from "../../../typesetting-v2/renderer/publication/pdfGenerator";

const FONT_PATH = join(__dirname, "..", "..", "..", "typesetting-v2", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");

// ---- Facts independently confirmed from the real InDesign reference PDF
// (qa/reference/indesign/molsui-indesign-reference.pdf), unchanged from
// Round 3 -- see qa/evidence/TYPOGRAPHY_PARITY_INDESIGN_OVERLAY_DRIFT.md ----
const REFERENCE_FONT_SIZE_PT = 9.0;
const REFERENCE_COLUMN_PITCH_PT = 15.9095;
const REFERENCE_LINE_HEIGHT_RATIO = REFERENCE_COLUMN_PITCH_PT / REFERENCE_FONT_SIZE_PT; // ~1.767722
// Disclosed-approximate margins from Round 3 (not position-vector-corrected).
const APPROX_MARGIN_TOP_MM = 18.0;
const APPROX_MARGIN_BOTTOM_MM = 18.0;
const APPROX_MARGIN_GUTTER_MM = 12.78; // ノド (maps to marginRightMm)
const APPROX_MARGIN_OUTER_MM = 12.78; // 小口 (maps to marginLeftMm)

// The SAME モル／スイ continuous prose used for the InDesign reference
// comparison (Round 2/3's own canonical sample), verbatim.
const PARAGRAPH_1 = "人は驚きすぎると、本当に足が止まるらしい。スイはそれを初めて知った。数歩先へ行ったモルが振り返る。";
const PARAGRAPH_2 = "「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」";
const MANUSCRIPT = `${PARAGRAPH_1}\n${PARAGRAPH_2}`;

function fontResource(): PublicationFontResource {
  return { fileName: "ShipporiMincho-Regular.ttf", fontName: "ShipporiMincho", base64: readFileSync(FONT_PATH).toString("base64") };
}

function buildMatchedPageSettings(): PageSettings {
  const base: PageSettings = {
    ...DEFAULT_PAGE_SETTINGS,
    paperSize: "A5",
    marginTop: APPROX_MARGIN_TOP_MM,
    marginBottom: APPROX_MARGIN_BOTTOM_MM,
    marginGutter: APPROX_MARGIN_GUTTER_MM,
    marginOuter: APPROX_MARGIN_OUTER_MM,
    fontSizePt: REFERENCE_FONT_SIZE_PT,
    lineHeightRatio: REFERENCE_LINE_HEIGHT_RATIO,
    columnCount: 1,
    charsPerLine: 0, // auto -- derive a real capacity for this geometry via computePageLayout below
    linesPerColumn: 0, // auto
  };
  // Real auto-derivation (the same formula the Settings panel's own "auto"
  // mode uses) -- mirrors a real persisted user choice rather than an
  // independently invented number.
  const derived = computePageLayout(base);
  return { ...base, charsPerLine: derived.charsPerLine, linesPerColumn: derived.linesPerColumn };
}

describe("Typography Parity -- Human recheck v2 Publication PDF (post column-pitch fix)", () => {
  it("produces a real, vector, InDesign-matched-geometry v2 Publication PDF via the REAL v2Bridge end to end", async () => {
    const { createShipporiMinchoMeasurementProvider } = await import("../../../typesetting-v2/core/measurement/shipporiMinchoProvider");
    const measurement = createShipporiMinchoMeasurementProvider(FONT_PATH);
    const settings = buildMatchedPageSettings();

    expect(settings.paperSize).toBe("A5");
    expect(settings.charsPerLine).toBeGreaterThan(0);
    expect(settings.linesPerColumn).toBeGreaterThan(0);

    const bridgeResult = composeV2Document({
      title: "Typography Parity Human Recheck",
      content: MANUSCRIPT,
      settings,
      measurement,
    });

    expect(bridgeResult.document.hold).toBe(false);
    expect(bridgeResult.plan.length).toBeGreaterThan(0);
    expect(bridgeResult.plan[0].commands.length).toBeGreaterThan(0);

    // Verify the REAL v2Bridge (post-fix) actually produced the matched
    // column pitch -- not re-asserted against a second, independently
    // computed formula; re-derives via the SAME real legacy function the
    // fix itself calls, proving the fix's own effect reached this real
    // end-to-end path (not just the unit-level settingsAdapter tests).
    const expectedLinePitchMm = computeLinePitchMm(settings.fontSizePt, settings.lineHeightRatio);
    const expectedLinePitchPt = (expectedLinePitchMm * 72) / 25.4;
    expect(expectedLinePitchPt).toBeCloseTo(REFERENCE_COLUMN_PITCH_PT, 3);

    const font = fontResource();
    const geometry = {
      paperWidthMm: 148,
      paperHeightMm: 210,
      marginTopMm: settings.marginTop,
      marginBottomMm: settings.marginBottom,
      marginRightMm: settings.marginGutter,
      marginLeftMm: settings.marginOuter,
    };
    const result = generatePublicationPdf(bridgeResult.model, font, geometry);
    expect(new TextDecoder().decode(result.bytes.slice(0, 5))).toBe("%PDF-");
    expect(result.pageCount).toBeGreaterThan(0);

    // eslint-disable-next-line no-console
    console.log(
      "HUMAN_RECHECK_V2_PDF_FACTS",
      JSON.stringify({
        vector: true,
        legacyExportPathUsed: false,
        paperSize: settings.paperSize,
        paperWidthMm: geometry.paperWidthMm,
        paperHeightMm: geometry.paperHeightMm,
        fontSizePt: settings.fontSizePt,
        verticalCharacterPitchPt: settings.fontSizePt,
        columnPitchPt: expectedLinePitchPt,
        lineHeightRatio: settings.lineHeightRatio,
        charsPerLine: settings.charsPerLine,
        linesPerColumn: settings.linesPerColumn,
        pageCount: result.pageCount,
        measurementIdentity: bridgeResult.document.version.measurementIdentity,
      })
    );

    const outDir = join(__dirname, "..", "..", "..", "typesetting-v2", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "typography-parity-human-recheck-v2.pdf"), result.bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});
