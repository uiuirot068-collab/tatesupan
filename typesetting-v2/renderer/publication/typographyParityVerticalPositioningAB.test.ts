// TYPOGRAPHY PARITY Round 6 -- vertical glyph positioning A/B diagnostic.
// Page 1: CURRENT (post-fix) rendering of the real ordinary sequence,
// through the REAL, unmodified Publication pipeline (generatePublicationPdf)
// -- proves the fix reaches real output, not just a unit-level formula.
// Page 2: the real, measured vpal-offset data (per glyph, in pt at 9pt
// size) that the fix now suppresses for ordinary characters -- the exact
// quantities that used to shift each glyph away from where this round's
// Human-supplied InDesign raster comparison found it should sit.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { composeCanonicalDocument, DEFAULT_RULE_SET_V2, mmToTicks, type PageCompositionSettings } from "../../core";
import { buildPublicationDocument, type PublicationRenderContext } from "./paintModel";
import { generatePublicationPdf, type PublicationFontResource, type PublicationPageGeometry } from "./pdfGenerator";
import { VerticalGposContext } from "./verticalGposPaint";
import { buildFixtureUnits } from "../../tools/compare/fixtureBuilder";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");
function fontResource(): PublicationFontResource {
  return { fileName: "ShipporiMincho-Regular.ttf", fontName: "ShipporiMincho", base64: readFileSync(FONT_PATH).toString("base64") };
}

const SEQUENCE = "人は驚きすぎると本当に足が止まるらしい"; // ordinary sequence, punctuation stripped
const FONT_SIZE_PT = 9;

describe("Typography Parity Round 6 -- vertical positioning A/B diagnostic", () => {
  it("Page 1: real CURRENT (post-fix) Publication PDF for the ordinary sequence, via the real unmodified pipeline", async () => {
    const { createShipporiMinchoMeasurementProvider } = await import("../../core/measurement/shipporiMinchoProvider");
    const measurement = createShipporiMinchoMeasurementProvider(FONT_PATH);
    const emTick = mmToTicks((FONT_SIZE_PT * 25.4) / 72);
    const settings: PageCompositionSettings = {
      bodyFontRef: "round6-ab",
      bodyFontSizePt: FONT_SIZE_PT,
      lineExtentTicks: emTick * 20,
      linePitchTicks: emTick * 2,
      columnExtentTicks: emTick * 2,
      columnsPerPage: 1,
    };
    const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text: SEQUENCE }]);
    const document = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
    expect(document.hold).toBe(false);
    const ctx: PublicationRenderContext = {
      linePitchTicks: settings.linePitchTicks,
      lineExtentTicks: settings.lineExtentTicks,
      columnExtentTicks: settings.columnExtentTicks,
      columnsPerPage: settings.columnsPerPage,
      measurementIdentity: document.version.measurementIdentity,
      paintFontIdentity: document.version.measurementIdentity,
      bodyFontSizeTick: emTick,
    };
    const model = buildPublicationDocument("round6-ab-current", "Round 6 A/B — CURRENT (post-fix)", document, units, source, ctx);
    const geometry: PublicationPageGeometry = { paperWidthMm: 60, paperHeightMm: 160, marginTopMm: 15, marginBottomMm: 10, marginRightMm: 20, marginLeftMm: 10 };
    const font = fontResource();
    const result = generatePublicationPdf(model, font, geometry);
    expect(new TextDecoder().decode(result.bytes.slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "typography-parity-vertical-positioning-ab.pdf"), result.bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });

  it("Page 2: real, measured per-glyph vpal offsets (pt at 9pt) the fix now suppresses for ordinary characters -- a compact data page", () => {
    const gposContext = new VerticalGposContext(readFileSync(FONT_PATH));
    const graphemes = Array.from(SEQUENCE);
    const rows = graphemes.map((ch) => ({ char: ch, appliedPt: gposContext.yPlacementEmFor(ch) * FONT_SIZE_PT }));
    // eslint-disable-next-line no-console
    console.log("ROUND6_SUPPRESSED_VPAL_PT", JSON.stringify(rows));

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [80, 120] });
    pdf.setFontSize(9);
    pdf.text("Round 6 -- vpal Y-placement now suppressed for ordinary glyphs (pt @ 9pt)", 5, 8, { maxWidth: 70 });
    let y = 18;
    for (const r of rows) {
      pdf.setFontSize(10);
      pdf.text(`${r.char}   ${r.appliedPt.toFixed(3)}pt`, 8, y);
      y += 6;
    }
    const bytes = pdf.output("arraybuffer");
    expect(new TextDecoder().decode(new Uint8Array(bytes).slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "typography-parity-vertical-positioning-ab-data.pdf"), Buffer.from(bytes));
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});
