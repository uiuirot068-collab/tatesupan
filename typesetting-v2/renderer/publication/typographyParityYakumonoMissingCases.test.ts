// Focused audit for the Human-created missing-case InDesign reference.
// This deliberately reuses the already-reviewed Round 8/9 PDF text-state
// extractor and does not alter any production typography path.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_RULE_SET_V2 } from "../../core";
import { buildFixtureUnits } from "../../tools/compare/fixtureBuilder";
import { settingsFor } from "./fixtures";
import { buildPublicationDocument, type PublicationRenderContext } from "./paintModel";
import { buildPaintPlan, deriveBaselineRatioFromFont, type PublicationFontResource } from "./pdfGenerator";
import { VerticalGposContext } from "./verticalGposPaint";
import { verticalPaintGraphemeFor } from "./verticalGlyphMap";
import { VerticalOutlineContext } from "./verticalOutlinePaint";
import { VerticalYakumonoAlignContext } from "./verticalYakumonoAlign";
import {
  decompressAllFlateStreams,
  extractTextState,
  parseToUnicodeCMap,
} from "./typographyParityYakumonoExhaustiveExtraction.test";

const REFERENCE_PDF_PATH = join(__dirname, "..", "..", "qa", "reference", "indesign", "molsui-indesign-yakumono-reference.pdf");
const EXPECTED_LINES = [
  "「あ！」", "「あ？」", "「あ！？」", "「あ？！」",
  "あ。」あ", "あ、」あ", "あ！」あ", "あ？」あ",
  "あ！？あ", "あ？！あ", "あ！？」あ", "あ？！」あ",
] as const;
const TARGETS = ["。」", "、」", "！」", "？」", "！？", "？！", "！？」", "？！」"] as const;
const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");
const OUTPUT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "typography-parity-yakumono-missing-cases-diagnostic.pdf");

function fontResource(): PublicationFontResource {
  return { fileName: "ShipporiMincho-Regular.ttf", fontName: "ShipporiMincho", base64: readFileSync(FONT_PATH).toString("base64") };
}

function composeFor(text: string) {
  const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text }]);
  const settings = settingsFor({ charsPerLine: Array.from(text).length + 2, linesPerColumn: 1, columnCount: 1 });
  const document = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement: createFakeMeasurementProvider(), settings });
  const ctx: PublicationRenderContext = {
    linePitchTicks: settings.linePitchTicks,
    lineExtentTicks: settings.lineExtentTicks,
    columnExtentTicks: settings.columnExtentTicks,
    columnsPerPage: settings.columnsPerPage,
    measurementIdentity: document.version.measurementIdentity,
    paintFontIdentity: document.version.measurementIdentity,
  };
  return { document, settings, model: buildPublicationDocument("id", "yakumono missing cases", document, units, source, ctx) };
}

function extractReference() {
  const bytes = readFileSync(REFERENCE_PDF_PATH);
  const latin1 = bytes.toString("latin1");
  const streams = decompressAllFlateStreams(bytes, latin1);
  const cmapStream = streams.find((s) => /begincmap/.test(s.decoded) && /beginbfchar|beginbfrange/.test(s.decoded));
  expect(cmapStream).toBeDefined();
  const cidToUnicode = parseToUnicodeCMap(cmapStream!.decoded);
  const textStreams = streams.filter((s) => /\bBT\b/.test(s.decoded) && /\bTj\b|\bTJ\b/.test(s.decoded));
  expect(textStreams.length).toBeGreaterThan(0);
  const results = textStreams.map((s) => ({ objNum: s.objNum, result: extractTextState(s.decoded, cidToUnicode) }));
  return { bytes, results, fullText: results.map((r) => r.result.fullText).join("\n") };
}

describe("Typography parity -- missing yakumono InDesign reference", () => {
  it("recovers every expected case before analysis (hard STOP gate)", () => {
    const { bytes, results, fullText } = extractReference();
    expect(bytes.length).toBeGreaterThan(0);
    for (const { result } of results) expect(result.unsupportedOps).toEqual([]);
    for (const line of EXPECTED_LINES) expect(fullText).toContain(line);
    console.log("YAKUMONO_REFERENCE_SHA256", createHash("sha256").update(bytes).digest("hex"));
    console.log("YAKUMONO_REFERENCE_TEXT", JSON.stringify(fullText));
    console.log("YAKUMONO_REFERENCE_TJ_ADJUSTMENTS", JSON.stringify(results.flatMap(({ result }) => result.tjAdjustmentContext)));
  });

  it("records every target occurrence and its real origin-to-origin advance/TJ context", () => {
    const { results } = extractReference();
    const rows: object[] = [];
    for (const { objNum, result } of results) {
      const glyphs = result.glyphs;
      for (const target of TARGETS) {
        const chars = Array.from(target);
        for (let i = 0; i <= glyphs.length - chars.length; i++) {
          if (!chars.every((ch, j) => glyphs[i + j].char === ch)) continue;
          const occurrences = chars.map((char, j) => {
            const g = glyphs[i + j];
            const next = glyphs[i + j + 1];
            const advancePt = next && next.xPt === g.xPt ? g.yPt - next.yPt : null;
            return { char, cid: g.cid, xPt: g.xPt, yPt: g.yPt, advancePt, advanceEm: advancePt === null ? null : advancePt / g.fontSizeFromTm, opIndex: g.opIndex };
          });
          rows.push({ objNum, target, context: glyphs.slice(Math.max(0, i - 1), Math.min(glyphs.length, i + chars.length + 1)).map((g) => g.char).join(""), occurrences });
        }
      }
    }
    console.log("YAKUMONO_MISSING_CASE_ROWS", JSON.stringify(rows));
    for (const target of TARGETS) expect(rows.some((row) => (row as { target: string }).target === target)).toBe(true);
  });

  it("records current TateSpun logical advances for all eight missing cases", () => {
    const expectedEm: Record<(typeof TARGETS)[number], number[]> = {
      "。」": [0.5, 1], "、」": [0.5, 1], "！」": [1, 1], "？」": [1, 1],
      "！？": [1, 1], "？！": [1, 1], "！？」": [1, 1, 1], "？！」": [1, 1, 1],
    };
    const rows = TARGETS.map((target) => {
      const { document, settings, model } = composeFor(`あ${target}あ`);
      const line = document.pages[0].columns[0].lines[0];
      const chars = Array.from(`あ${target}あ`);
      const start = chars.indexOf(Array.from(target)[0]);
      const cellTicks = settings.linePitchTicks;
      const advancesEm = Array.from(target).map((_, j) =>
        (line.placedUnits[start + j + 1].yTick - line.placedUnits[start + j].yTick) / cellTicks
      );
      expect(advancesEm).toEqual(expectedEm[target]);

      const font = fontResource();
      const buf = readFileSync(FONT_PATH);
      const plan = buildPaintPlan(
        model, true, undefined, undefined,
        new VerticalOutlineContext(buf), new VerticalGposContext(buf),
        new VerticalYakumonoAlignContext(buf, deriveBaselineRatioFromFont(font)),
      );
      const glyphCommands = plan[0].commands.filter((c) => c.op === "text" || c.op === "glyphOutline");
      expect(glyphCommands.length).toBe(chars.length);
      return { target, advancesEm, commandKinds: glyphCommands.map((c) => c.op) };
    });
    console.log("TATESPUN_MISSING_CASE_ROWS", JSON.stringify(rows));
  });

  it("writes the compact enlarged red/black comparison artifact", () => {
    const font = fontResource();
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    pdf.addFileToVFS(font.fileName, font.base64);
    pdf.addFont(font.fileName, font.fontName, "normal");
    pdf.setFont(font.fontName);
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.text("Yakumono missing-case diagnostic", 15, 13);
    pdf.setFontSize(7);
    pdf.setTextColor(220, 0, 0);
    pdf.text("RED = InDesign measured origin/advance", 15, 19);
    pdf.setTextColor(0, 0, 0);
    pdf.text("BLACK = TateSpun Publication", 80, 19);

    const cell = 9;
    const fontPt = 18;
    TARGETS.forEach((target, row) => {
      const yTop = 28 + row * 31;
      const refAdv = target === "。」" || target === "、」" ? [0.5] : Array.from(target).slice(0, -1).map(() => 1);
      const currentAdv = target === "。」" || target === "、」" ? [0.5] : Array.from(target).slice(0, -1).map(() => 1);
      pdf.setFontSize(8);
      pdf.setTextColor(0, 0, 0);
      pdf.text(target, 15, yTop + 4);
      const drawColumn = (x: number, color: [number, number, number], advances: number[]) => {
        pdf.setDrawColor(185, 185, 185);
        for (let i = 0; i < Array.from(target).length; i++) pdf.rect(x - cell / 2, yTop + i * cell, cell, cell);
        pdf.setTextColor(...color);
        pdf.setFontSize(fontPt);
        let y = yTop + cell * 0.72;
        Array.from(target).forEach((ch, i) => {
          pdf.text(verticalPaintGraphemeFor(ch), x, y, { align: "center" });
          if (i < advances.length) y += advances[i] * cell;
        });
      };
      drawColumn(50, [220, 0, 0], refAdv);
      drawColumn(80, [0, 0, 0], currentAdv);
      pdf.setFontSize(7);
      pdf.setTextColor(0, 0, 0);
      pdf.text(refAdv.map((v) => `${v.toFixed(1)}em`).join(" / "), 98, yTop + 8);
      pdf.text("MATCH", 98, yTop + 14);
    });
    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    writeFileSync(OUTPUT_PATH, Buffer.from(pdf.output("arraybuffer")));
    expect(readFileSync(OUTPUT_PATH).subarray(0, 5).toString()).toBe("%PDF-");
  });
});
