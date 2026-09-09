// TYPOGRAPHY PARITY Round 7 -- yakumono/mojikumi diagnostic. Renders
// TateSpun's CURRENT (real, unmodified) Publication output for the
// ACTUAL sentences verified present in the real InDesign reference PDF
// (see typographyParityYakumonoIndesignExtraction.test.ts) -- not the
// "人は驚きすぎると..." sentence assumed in Rounds 2-6, which this
// round's own ToUnicode-CMap extraction proves is NOT actually present
// in molsui-indesign-reference.pdf. Real ordinary-control sequence kept
// as page 1 per this round's own Step 12 regression-check instruction.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { composeCanonicalDocument, DEFAULT_RULE_SET_V2, mmToTicks, type PageCompositionSettings } from "../../core";
import { buildPublicationDocument, type PublicationRenderContext } from "./paintModel";
import { generatePublicationPdf, type PublicationFontResource, type PublicationPageGeometry } from "./pdfGenerator";
import { buildFixtureUnits, type FixturePiece } from "../../tools/compare/fixtureBuilder";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");
function fontResource(): PublicationFontResource {
  return { fileName: "ShipporiMincho-Regular.ttf", fontName: "ShipporiMincho", base64: readFileSync(FONT_PATH).toString("base64") };
}
const FONT_SIZE_PT = 9;

function paintOnePage(pieces: FixturePiece[], measurement: unknown, columnsPerPage = 1) {
  const emTick = mmToTicks((FONT_SIZE_PT * 25.4) / 72);
  const settings: PageCompositionSettings = {
    bodyFontRef: "round7-yakumono",
    bodyFontSizePt: FONT_SIZE_PT,
    lineExtentTicks: emTick * 24,
    linePitchTicks: emTick * 2,
    columnExtentTicks: emTick * 2 * columnsPerPage,
    columnsPerPage,
  };
  const { units, source } = buildFixtureUnits("body", pieces);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const document = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement: measurement as any, settings });
  const ctx: PublicationRenderContext = {
    linePitchTicks: settings.linePitchTicks,
    lineExtentTicks: settings.lineExtentTicks,
    columnExtentTicks: settings.columnExtentTicks,
    columnsPerPage: settings.columnsPerPage,
    measurementIdentity: document.version.measurementIdentity,
    paintFontIdentity: document.version.measurementIdentity,
    bodyFontSizeTick: emTick,
  };
  return buildPublicationDocument("round7", "Round 7", document, units, source, ctx);
}

describe("Typography Parity Round 7 -- yakumono/mojikumi diagnostic (real InDesign-verified sentences)", () => {
  it("generates a real Publication PDF for the ACTUAL sentences present in the InDesign reference, plus the Round 6 ordinary control", async () => {
    const { createShipporiMinchoMeasurementProvider } = await import("../../core/measurement/shipporiMinchoProvider");
    const measurement = createShipporiMinchoMeasurementProvider(FONT_PATH);

    // Page 1: Round 6 ordinary control -- must remain unchanged.
    const page1 = paintOnePage([{ kind: "TEXT", text: "人は驚きすぎると本当に足が止まるらしい" }], measurement);
    // Page 2: real InDesign-verified comma/period sentence.
    const page2 = paintOnePage([{ kind: "TEXT", text: "それからずいぶん長い時間を一緒に過ごした。" }, { kind: "PARAGRAPH_BREAK" }, { kind: "TEXT", text: "よく笑うことも、案外世話焼きなことも知っている。" }], measurement, 2);
    // Page 3: real InDesign-verified brackets.
    const page3 = paintOnePage([{ kind: "TEXT", text: "「ああ」" }, { kind: "PARAGRAPH_BREAK" }, { kind: "TEXT", text: "「なるほど」" }], measurement);
    // Page 4: real InDesign-verified ？」 sequence (the historically OPEN item, round 17).
    const page4 = paintOnePage([{ kind: "TEXT", text: "僕とエタバンしない？」" }], measurement);
    // Page 5: real InDesign-verified long bracket sentence with comma+period+？」.
    const page5 = paintOnePage([{ kind: "TEXT", text: "「指輪、便利そうでさあ。金策も二人でやることあるし、あったらよくない？」" }], measurement, 2);

    const geometry: PublicationPageGeometry = { paperWidthMm: 90, paperHeightMm: 160, marginTopMm: 12, marginBottomMm: 10, marginRightMm: 15, marginLeftMm: 10 };
    const font = fontResource();

    for (const [label, doc] of [
      ["page1-ordinary-control", page1],
      ["page2-comma-period", page2],
      ["page3-brackets", page3],
      ["page4-question-closing-bracket", page4],
      ["page5-long-real-sentence", page5],
    ] as const) {
      const result = generatePublicationPdf(doc, font, geometry);
      expect(new TextDecoder().decode(result.bytes.slice(0, 5))).toBe("%PDF-");
      const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
      try {
        writeFileSync(join(outDir, `typography-parity-yakumono-mojikumi-${label}.pdf`), result.bytes);
      } catch {
        /* best-effort, transient Dropbox sync lock, non-fatal */
      }
    }
  });
});
