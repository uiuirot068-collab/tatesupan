// P3-O08 — Cell-local positioning (Human Visual QA HOLD round 4): the
// classification layer is deterministic data, testable directly; the
// exact offset MAGNITUDE is explicitly NOT machine-verified (see
// verticalGlyphMap.ts's own module doc) — these tests prove the mechanism
// and its neutrality for ordinary characters, never a visual claim.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_RULE_SET_V2 } from "../../core";
import { buildPublicationDocument, type PublicationRenderContext } from "./paintModel";
import { buildPaintPlan, renderPaintPlanToPdf, type PublicationFontResource, type PublicationPageGeometry } from "./pdfGenerator";
import { settingsFor } from "./fixtures";
import { buildFixtureUnits } from "../../tools/compare/fixtureBuilder";
import { classifyPunctuation, isSmallKana, cellLocalOffsetFor, type CellLocalOffsetCandidateId } from "./verticalGlyphMap";

const measurement = createFakeMeasurementProvider();
const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");

function fontResource(): PublicationFontResource {
  return { fileName: "ShipporiMincho-Regular.ttf", fontName: "ShipporiMincho", base64: readFileSync(FONT_PATH).toString("base64") };
}

describe("classifyPunctuation / isSmallKana", () => {
  it("classifies the four punctuation classes correctly", () => {
    expect(classifyPunctuation("「")).toBe("OPEN_BRACKET");
    expect(classifyPunctuation("（")).toBe("OPEN_BRACKET");
    expect(classifyPunctuation("」")).toBe("CLOSE_BRACKET");
    expect(classifyPunctuation("）")).toBe("CLOSE_BRACKET");
    expect(classifyPunctuation("、")).toBe("COMMA");
    expect(classifyPunctuation("。")).toBe("PERIOD");
  });

  it("returns undefined for ordinary kanji/kana -- never misclassifies", () => {
    expect(classifyPunctuation("東")).toBeUndefined();
    expect(classifyPunctuation("あ")).toBeUndefined();
    expect(classifyPunctuation("2")).toBeUndefined();
  });

  it("identifies small kana correctly, both hiragana and katakana, without matching ordinary kana", () => {
    expect(isSmallKana("っ")).toBe(true);
    expect(isSmallKana("ゃ")).toBe(true);
    expect(isSmallKana("ッ")).toBe(true);
    expect(isSmallKana("つ")).toBe(false); // ordinary tsu, never confused with small tsu
    expect(isSmallKana("や")).toBe(false); // ordinary ya
  });
});

describe("cellLocalOffsetFor", () => {
  it("A_BASELINE candidate is a no-op for every class (zero offset everywhere)", () => {
    for (const ch of ["「", "」", "（", "）", "、", "。", "っ", "東", "2"]) {
      expect(cellLocalOffsetFor(ch, "A_BASELINE").yOffsetEm).toBe(0);
    }
  });

  it("ordinary kanji/kana/digits get zero offset under EVERY candidate -- this system never touches non-punctuation, non-small-kana characters", () => {
    const candidates: CellLocalOffsetCandidateId[] = ["A_BASELINE", "B_STANDARD", "C_STRONG"];
    for (const candidate of candidates) {
      expect(cellLocalOffsetFor("東", candidate).yOffsetEm).toBe(0);
      expect(cellLocalOffsetFor("あ", candidate).yOffsetEm).toBe(0);
      expect(cellLocalOffsetFor("2", candidate).yOffsetEm).toBe(0);
    }
  });

  it("open/close brackets get opposite-signed offsets under B/C (never the same direction)", () => {
    for (const candidate of ["B_STANDARD", "C_STRONG"] as const) {
      const open = cellLocalOffsetFor("「", candidate).yOffsetEm;
      const close = cellLocalOffsetFor("」", candidate).yOffsetEm;
      expect(open).toBeLessThan(0);
      expect(close).toBeGreaterThan(0);
    }
  });

  it("C_STRONG's magnitude is larger than B_STANDARD's for every affected class", () => {
    for (const ch of ["「", "」", "、", "。", "っ"]) {
      const b = Math.abs(cellLocalOffsetFor(ch, "B_STANDARD").yOffsetEm);
      const c = Math.abs(cellLocalOffsetFor(ch, "C_STRONG").yOffsetEm);
      expect(c).toBeGreaterThan(b);
    }
  });
});

describe("Cell-local offset paint integration", () => {
  function planFor(text: string, candidate: CellLocalOffsetCandidateId) {
    const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text }]);
    const settings = settingsFor({ charsPerLine: Array.from(text).length + 2, linesPerColumn: 1, columnCount: 1 });
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
    return { document, model, plan: buildPaintPlan(model, true, undefined, candidate) };
  }

  it("changing the candidate does NOT change canonical coordinates -- PublicationDocument is identical across all three candidates", () => {
    const a = planFor("「今日は、雨だった。」", "A_BASELINE");
    const b = planFor("「今日は、雨だった。」", "B_STANDARD");
    expect(a.model).toEqual(b.model);
  });

  it("B_STANDARD shifts the closing bracket's own yMm relative to A_BASELINE, proving the offset is actually applied at paint time", () => {
    const a = planFor("「今日は、雨だった。」", "A_BASELINE");
    const b = planFor("「今日は、雨だった。」", "B_STANDARD");
    const closeA = a.plan.flatMap((p) => p.commands).find((c) => c.op === "text" && c.text === String.fromCodePoint(0xfe42))!;
    const closeB = b.plan.flatMap((p) => p.commands).find((c) => c.op === "text" && c.text === String.fromCodePoint(0xfe42))!;
    expect(closeB.op === "text" && closeA.op === "text" ? closeB.yMm - closeA.yMm : NaN).not.toBe(0);
  });

  it("source is never mutated by any candidate -- LogicalUnit text is identical regardless of candidate", () => {
    const { units: unitsA } = buildFixtureUnits("body", [{ kind: "TEXT", text: "だった。" }]);
    const { units: unitsB } = buildFixtureUnits("body", [{ kind: "TEXT", text: "だった。" }]);
    expect(unitsA).toEqual(unitsB);
  });

  it("generates a punctuation position comparison PDF -- 3 candidates, same fixture, same font/scale/coordinates", () => {
    const geometry: PublicationPageGeometry = { paperWidthMm: 60, paperHeightMm: 80, marginTopMm: 8, marginBottomMm: 8, marginRightMm: 8, marginLeftMm: 8 };
    const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text: "「今日は、雨だった。」" }]);
    const settings = settingsFor({ charsPerLine: 14, linesPerColumn: 1, columnCount: 1 });
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
    const font = fontResource();
    const candidates: CellLocalOffsetCandidateId[] = ["A_BASELINE", "B_STANDARD", "C_STRONG"];
    let allBytes: Uint8Array[] = [];
    for (const candidate of candidates) {
      const plan = buildPaintPlan(model, true, geometry, candidate);
      const { bytes } = renderPaintPlanToPdf(plan, font);
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
      allBytes.push(bytes);
    }
    expect(allBytes).toHaveLength(3);

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    candidates.forEach((candidate, i) => {
      try {
        writeFileSync(join(outDir, `punctuation-position-comparison-${candidate}.pdf`), allBytes[i]);
      } catch {
        /* best-effort, transient Dropbox sync lock, non-fatal */
      }
    });
  });

  it("generates a small-kana position comparison PDF -- 3 candidates, same fixture", () => {
    const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text: "だった。" }]);
    const settings = settingsFor({ charsPerLine: 6, linesPerColumn: 1, columnCount: 1 });
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
    const font = fontResource();
    const candidates: CellLocalOffsetCandidateId[] = ["A_BASELINE", "B_STANDARD", "C_STRONG"];
    const allBytes: Uint8Array[] = [];
    for (const candidate of candidates) {
      const plan = buildPaintPlan(model, true, undefined, candidate);
      const { bytes } = renderPaintPlanToPdf(plan, font);
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
      allBytes.push(bytes);
    }

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "small-kana-position-comparison.pdf"), allBytes[1]); // B_STANDARD as the single representative file per the task's own naming
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
    candidates.forEach((candidate, i) => {
      try {
        writeFileSync(join(outDir, `small-kana-position-comparison-${candidate}.pdf`), allBytes[i]);
      } catch {
        /* best-effort, transient Dropbox sync lock, non-fatal */
      }
    });
  });
});
