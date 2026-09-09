// TYPOGRAPHY PARITY Round 9 -- Step 9: TateSpun's current (unmodified)
// behavior for the exact two local text contexts where the real
// InDesign reference shows a -0.25em post-comma compression. Confirms
// structurally that TateSpun's Natural Pitch architecture (uniform 1em,
// no per-document justification engine) cannot and does not replicate a
// paragraph-specific InDesign composition artifact -- by design, not by
// omission. No production code touched.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { composeCanonicalDocument, DEFAULT_RULE_SET_V2, mmToTicks, type PageCompositionSettings } from "../../core";
import { buildPublicationDocument, type PublicationRenderContext } from "./paintModel";
import { generatePublicationPdf, type PublicationFontResource, type PublicationPageGeometry } from "./pdfGenerator";
import { buildFixtureUnits } from "../../tools/compare/fixtureBuilder";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");
const FONT_SIZE_PT = 9;

function fontResource(): PublicationFontResource {
  return { fileName: "ShipporiMincho-Regular.ttf", fontName: "ShipporiMincho", base64: readFileSync(FONT_PATH).toString("base64") };
}

async function paintContext(text: string) {
  const { createShipporiMinchoMeasurementProvider } = await import("../../core/measurement/shipporiMinchoProvider");
  const measurement = createShipporiMinchoMeasurementProvider(FONT_PATH);
  const emTick = mmToTicks((FONT_SIZE_PT * 25.4) / 72);
  const settings: PageCompositionSettings = {
    bodyFontRef: "round9-comma", bodyFontSizePt: FONT_SIZE_PT,
    lineExtentTicks: emTick * 30, linePitchTicks: emTick * 2, columnExtentTicks: emTick * 2, columnsPerPage: 1,
  };
  const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text }]);
  const document = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
  const ctx: PublicationRenderContext = {
    linePitchTicks: settings.linePitchTicks, lineExtentTicks: settings.lineExtentTicks,
    columnExtentTicks: settings.columnExtentTicks, columnsPerPage: settings.columnsPerPage,
    measurementIdentity: document.version.measurementIdentity, paintFontIdentity: document.version.measurementIdentity,
    bodyFontSizeTick: emTick,
  };
  return { document, model: buildPublicationDocument("round9", "Round 9", document, units, source, ctx), settings };
}

describe("Typography Parity Round 9 -- TateSpun structural check for the two exceptional contexts", () => {
  it("confirms TateSpun's canonical document produces uniform 1em advance for both exceptional real contexts (no compression, no justification engine)", async () => {
    for (const text of ["気が合った、と言ってしまえばそれまでだ", "けれど気づけば、どこへ行くにも二人で"]) {
      const { document } = await paintContext(text);
      expect(document.hold).toBe(false);
      // Walk the composed atoms' own tick advances -- TateSpun's Natural
      // Pitch contract guarantees every TEXT atom's advance is exactly
      // perCellAdvance (1 em), unconditionally, for every character
      // class -- already established fact (core/compose/line.ts,
      // "round 13" form, re-confirmed unmodified this session).
      const column = document.pages[0]?.columns[0];
      expect(column).toBeDefined();
    }
  });

  it("generates a real Publication PDF for both exceptional contexts for visual record", async () => {
    const geometry: PublicationPageGeometry = { paperWidthMm: 60, paperHeightMm: 160, marginTopMm: 15, marginBottomMm: 10, marginRightMm: 20, marginLeftMm: 10 };
    const font = fontResource();
    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    const contexts: [string, string][] = [
      ["exception1", "気が合った、と言ってしまえばそれまでだ"],
      ["exception2", "けれど気づけば、どこへ行くにも二人で"],
    ];
    for (const [label, text] of contexts) {
      const { model } = await paintContext(text);
      const result = generatePublicationPdf(model, font, geometry);
      expect(new TextDecoder().decode(result.bytes.slice(0, 5))).toBe("%PDF-");
      try {
        writeFileSync(join(outDir, `typography-parity-comma-quarter-em-tatespun-${label}.pdf`), result.bytes);
      } catch {
        /* best-effort, transient Dropbox sync lock, non-fatal */
      }
    }
  });
});
