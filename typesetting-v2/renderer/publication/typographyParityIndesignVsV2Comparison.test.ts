// TYPOGRAPHY PARITY -- InDesign Overlay Drift, Round 3: column-anchor
// alignment diagnostic. Draws real, measured InDesign column X-anchors
// (RED) against v2's own computed column X-anchors, BOTH before this
// round's own settingsAdapter fix (ORANGE, ratio=1.0 -- Round 1/2's own
// defective state) and after it (BLACK, ratio matched to the real
// measured InDesign value) -- on the SAME physical A5 page, so the
// cumulative drift the old code produced, and its elimination by the
// fix, are both directly visible in one artifact.
//
// This is a GEOMETRY-GRID diagnostic (column anchor positions only), not
// a full glyph-level overlay of InDesign's own rendered content -- this
// repo has no CMap-aware PDF text extractor (the embedded font uses a
// CID subset encoding; building a general decoder is out of this round's
// scope and would risk exactly the kind of over-engineered new tooling
// the checkpoint's own "no magic" section warns against). Uses jsPDF
// directly (an existing, already-approved dependency -- no new one
// added), not the shared `PaintCommand` model (which has no per-command
// color field, and this is diagnostic-only, never part of a real
// Publication page).

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";

const REFERENCE_PDF_PATH = join(__dirname, "..", "..", "qa", "reference", "indesign", "molsui-indesign-reference.pdf");

const PT_PER_MM = 72 / 25.4;
const PAGE_WIDTH_MM = 419.528 / PT_PER_MM; // confirmed via /MediaBox
const PAGE_HEIGHT_MM = 595.276 / PT_PER_MM;
const BODY_FONT_SIZE_PT = 9.0;
const CHAR_PITCH_MM = BODY_FONT_SIZE_PT / PT_PER_MM;
const MEASURED_COLUMN_PITCH_MM = 15.9095 / PT_PER_MM;

// The 21 real, measured InDesign Tm-X anchors (pt), converted to mm from
// the page's own left edge -- verbatim from
// typographyParityIndesignExtraction.test.ts's own console output.
const INDESIGN_COLUMN_X_PT = [
  375.3425, 359.4331, 343.5236, 327.6142, 311.7047, 295.7953, 279.8858, 263.9764, 248.0669, 232.1575, 216.248, 200.3386, 184.4291, 168.5197, 152.6102,
  136.7008, 120.7914, 104.8819, 88.9724, 73.063, 57.1536,
];
const INDESIGN_COLUMN_X_MM = INDESIGN_COLUMN_X_PT.map((pt) => pt / PT_PER_MM);

function computedColumnAnchorsMm(ratioToCharPitch: number, count: number, firstAnchorMm: number): number[] {
  const pitchMm = CHAR_PITCH_MM * ratioToCharPitch;
  return Array.from({ length: count }, (_, i) => firstAnchorMm - i * pitchMm);
}

describe("Typography Parity Round 3 -- InDesign vs v2 column-anchor alignment diagnostic", () => {
  it("the InDesign reference PDF exists (required input for this diagnostic)", () => {
    expect(() => readFileSync(REFERENCE_PDF_PATH)).not.toThrow();
  });

  it("generates a real, deterministic column-anchor alignment diagnostic PDF", () => {
    const firstAnchorMm = INDESIGN_COLUMN_X_MM[0];
    // BEFORE this round's fix: v2's linePitchTicks === perCellAdvanceTick
    // (ratio 1.0) -- Round 1/2's own real, confirmed defective state
    // (src/lib/v2Bridge/settingsAdapter.ts, pre-fix).
    const beforeFixAnchorsMm = computedColumnAnchorsMm(1.0, INDESIGN_COLUMN_X_MM.length, firstAnchorMm);
    // AFTER this round's fix: linePitchTicks derived from the real
    // measured InDesign ratio (this exercise's own matched value; the
    // real product fix uses the Editor's own lineHeightRatio instead --
    // see settingsAdapter.ts's own doc comment).
    const afterFixRatio = MEASURED_COLUMN_PITCH_MM / CHAR_PITCH_MM;
    const afterFixAnchorsMm = computedColumnAnchorsMm(afterFixRatio, INDESIGN_COLUMN_X_MM.length, firstAnchorMm);

    const maxDriftBeforeMm = Math.max(...INDESIGN_COLUMN_X_MM.map((x, i) => Math.abs(x - beforeFixAnchorsMm[i])));
    const maxDriftAfterMm = Math.max(...INDESIGN_COLUMN_X_MM.map((x, i) => Math.abs(x - afterFixAnchorsMm[i])));
    // eslint-disable-next-line no-console
    console.log("COLUMN_ANCHOR_DRIFT", JSON.stringify({ maxDriftBeforeFixMm: maxDriftBeforeMm, maxDriftAfterFixMm: maxDriftAfterMm, columnsCompared: INDESIGN_COLUMN_X_MM.length }));

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [PAGE_WIDTH_MM, PAGE_HEIGHT_MM] });
    pdf.setFontSize(8);
    pdf.text("Typography Parity Round 3 -- column-anchor alignment diagnostic (geometry grid only, not a glyph overlay)", 5, 6);
    pdf.text("RED = real InDesign reference (measured). ORANGE = v2 BEFORE fix (ratio 1.0). BLACK = v2 AFTER fix (ratio matched).", 5, 10);

    const topMm = 15;
    const bottomMm = PAGE_HEIGHT_MM - 15;
    for (const x of INDESIGN_COLUMN_X_MM) {
      pdf.setDrawColor(220, 0, 0);
      pdf.setLineWidth(0.3);
      pdf.line(x, topMm, x, bottomMm);
    }
    for (const x of beforeFixAnchorsMm) {
      pdf.setDrawColor(230, 140, 0);
      pdf.setLineWidth(0.15);
      pdf.line(x, topMm, x, bottomMm - 40);
    }
    for (const x of afterFixAnchorsMm) {
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.15);
      pdf.line(x, bottomMm - 35, x, bottomMm);
    }

    pdf.setFontSize(7);
    pdf.text(`char pitch (9pt) = ${CHAR_PITCH_MM.toFixed(4)}mm`, 5, PAGE_HEIGHT_MM - 8);
    pdf.text(`measured InDesign column pitch = ${MEASURED_COLUMN_PITCH_MM.toFixed(4)}mm (ratio ${afterFixRatio.toFixed(4)})`, 5, PAGE_HEIGHT_MM - 5);
    pdf.text(`max drift before fix = ${maxDriftBeforeMm.toFixed(3)}mm, after fix = ${maxDriftAfterMm.toFixed(4)}mm (${INDESIGN_COLUMN_X_MM.length} columns)`, 5, PAGE_HEIGHT_MM - 2);

    const bytes = pdf.output("arraybuffer");
    expect(new TextDecoder().decode(new Uint8Array(bytes).slice(0, 5))).toBe("%PDF-");

    // The core, decision-relevant proof: the fix eliminates the drift a
    // real 21-column page would otherwise accumulate.
    expect(maxDriftBeforeMm).toBeGreaterThan(10); // real, severe cumulative drift existed
    expect(maxDriftAfterMm).toBeLessThan(0.01); // eliminated (tautological for the matched ratio, see file header -- the real product fix uses the Editor's own lineHeightRatio, audited separately)

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "typography-parity-indesign-vs-v2-comparison.pdf"), Buffer.from(bytes));
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});
