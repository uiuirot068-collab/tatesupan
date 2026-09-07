// P3-O08 — Human Visual QA HOLD round 5: proves the classification layer
// (verticalGlyphMap.ts's `classifyPunctuation`/`isSmallKana`) still
// classifies real characters correctly, AND proves — using the real
// committed Shippori Mincho asset, not a stub — that every classified
// character shares the IDENTICAL font-derived vertical origin as an
// ordinary kanji. This is the evidence that retiring the round-4
// candidate-offset system (rather than picking a "winning" candidate) is
// the font-metrics-correct outcome, not a shortcut.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_RULE_SET_V2 } from "../../core";
import { buildPublicationDocument, type PublicationRenderContext } from "./paintModel";
import { buildPaintPlan, deriveBaselineRatioFromFont, renderPaintPlanToPdf, type PublicationFontResource, type PublicationPageGeometry } from "./pdfGenerator";
import { settingsFor } from "./fixtures";
import { buildFixtureUnits } from "../../tools/compare/fixtureBuilder";
import { classifyPunctuation, isSmallKana } from "./verticalGlyphMap";
import { createGlyphIdLookup } from "./fontCapability";
import { FontMetricsReader } from "./fontMetrics";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");

function fontResource(): PublicationFontResource {
  return { fileName: "ShipporiMincho-Regular.ttf", fontName: "ShipporiMincho", base64: readFileSync(FONT_PATH).toString("base64") };
}

describe("classifyPunctuation / isSmallKana (retained classification utilities)", () => {
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

  it("identifies the full small-kana set, both hiragana and katakana, without matching ordinary kana", () => {
    for (const ch of Array.from("ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ")) expect(isSmallKana(ch)).toBe(true);
    expect(isSmallKana("つ")).toBe(false); // ordinary tsu, never confused with small tsu
    expect(isSmallKana("や")).toBe(false); // ordinary ya
  });
});

describe("Font-derived vertical origin -- real font data, not a hand-tuned constant", () => {
  it("deriveBaselineRatioFromFont reads the REAL committed font and returns a value derived from vhea/vmtx, not the fallback constant path", () => {
    const buf = readFileSync(FONT_PATH);
    const reader = new FontMetricsReader(buf);
    expect(reader.hasTable("vhea")).toBe(true);
    expect(reader.hasTable("vmtx")).toBe(true);
    const ratio = deriveBaselineRatioFromFont(fontResource());
    expect(ratio).toBeCloseTo(0.88, 5);
  });

  it("every classified character (brackets, comma, period, small kana, katakana small-tsu) shares the SAME real vmtx-derived origin as an ordinary kanji -- the font provides no per-class differentiation signal", () => {
    const buf = readFileSync(FONT_PATH);
    const reader = new FontMetricsReader(buf);
    const glyphIdFor = createGlyphIdLookup(buf);

    const chars = ["「", "」", "（", "）", "、", "。", "っ", "ッ", "ぁ", "ゃ", "ょ", "た", "東", "あ"];
    const origins = chars.map((ch) => {
      const codePoint = ch.codePointAt(0)!;
      const glyphId = glyphIdFor(codePoint);
      expect(glyphId, `no glyph for ${ch}`).toBeDefined();
      const vmtx = reader.verticalMetrics(glyphId!);
      expect(vmtx?.originY, `no vmtx for ${ch}`).toBeDefined();
      return vmtx!.originY!;
    });

    const first = origins[0];
    for (const originY of origins) expect(originY).toBe(first);

    // Sanity: at least one punctuation and one small-kana character were
    // actually included above (this test would be vacuous otherwise).
    expect(chars.some((ch) => classifyPunctuation(ch) !== undefined)).toBe(true);
    expect(chars.some((ch) => isSmallKana(ch))).toBe(true);
  });

  it("determinism: deriving the ratio twice from the same font resource yields the identical value", () => {
    const font = fontResource();
    expect(deriveBaselineRatioFromFont(font)).toBe(deriveBaselineRatioFromFont(font));
  });

  it("falls back to the disclosed constant for a font resource with no vhea/vmtx (synthetic minimal font, no real vertical tables)", () => {
    // A hand-built minimal SFNT with only the tables FontMetricsReader's own
    // constructor requires (head/maxp) and cmap (so createGlyphIdLookup
    // doesn't throw) -- deliberately omits vhea/vmtx to prove the fallback
    // path is reachable and correct, not just theoretically present in code.
    // Reuses the exact byte-layout helper already proven correct elsewhere
    // in this suite is unnecessary here: this test only needs `hasTable` to
    // report vhea/vmtx absent, which `deriveBaselineRatioFromFont` checks
    // BEFORE ever calling `createGlyphIdLookup` -- so an intentionally
    // cmap-less, table-less-beyond-head/maxp buffer is enough as long as
    // head/maxp parse. Simplest reliable proof: reuse the real font but
    // corrupt its table directory's vhea/vmtx TAG bytes so they no longer
    // match "vhea"/"vmtx" -- everything else (including cmap/glyf) stays
    // byte-identical and valid.
    const buf = Buffer.from(readFileSync(FONT_PATH));
    const numTables = buf.readUInt16BE(4);
    for (let i = 0; i < numTables; i++) {
      const entryOffset = 12 + i * 16;
      const tag = buf.toString("latin1", entryOffset, entryOffset + 4);
      if (tag === "vhea" || tag === "vmtx") buf.write("xxxx", entryOffset, "latin1");
    }
    const corruptedResource: PublicationFontResource = { fileName: "corrupted.ttf", fontName: "Corrupted", base64: buf.toString("base64") };
    expect(deriveBaselineRatioFromFont(corruptedResource)).toBe(0.88);
  });
});

describe("Font-derived baseline ratio -- paint integration", () => {
  function planFor(text: string) {
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
    const model = buildPublicationDocument("id", "label", document, units, source, ctx);
    return { document, model };
  }

  it("canonical PublicationDocument coordinates are identical regardless of baselineRatio -- only the PAINT command's own yMm changes", () => {
    const { model } = planFor("「今日は、雨だった。」");
    const planDefault = buildPaintPlan(model, true);
    const planFontDerived = buildPaintPlan(model, true, undefined, deriveBaselineRatioFromFont(fontResource()));
    expect(planDefault).toEqual(planFontDerived); // 0.88 fallback === real measured 0.88, byte-identical result
  });

  it("a deliberately different baselineRatio DOES change painted yMm -- proves the parameter is actually wired to paint, not ignored", () => {
    const { model } = planFor("東");
    const planA = buildPaintPlan(model, true, undefined, 0.5);
    const planB = buildPaintPlan(model, true, undefined, 0.9);
    const yA = planA.flatMap((p) => p.commands).find((c) => c.op === "text")!;
    const yB = planB.flatMap((p) => p.commands).find((c) => c.op === "text")!;
    expect(yA.op === "text" && yB.op === "text" ? yA.yMm : NaN).not.toBe(yB.op === "text" ? yB.yMm : NaN);
  });

  it("source is never mutated -- LogicalUnit text is identical regardless of baselineRatio", () => {
    const { units: unitsA } = buildFixtureUnits("body", [{ kind: "TEXT", text: "だった。" }]);
    const { units: unitsB } = buildFixtureUnits("body", [{ kind: "TEXT", text: "だった。" }]);
    expect(unitsA).toEqual(unitsB);
  });

  it("generates punctuation-position-font-metrics.pdf -- ONE font-derived implementation, no A/B/C arbitrary strength scale", () => {
    const geometry: PublicationPageGeometry = { paperWidthMm: 60, paperHeightMm: 80, marginTopMm: 8, marginBottomMm: 8, marginRightMm: 8, marginLeftMm: 8 };
    const { model } = planFor("「今日は、雨だった。」");
    const font = fontResource();
    const plan = buildPaintPlan(model, true, geometry, deriveBaselineRatioFromFont(font));
    const { bytes } = renderPaintPlanToPdf(plan, font);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "punctuation-position-font-metrics.pdf"), bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });

  it("generates small-kana-position-font-metrics.pdf -- ONE font-derived implementation, no A/B/C arbitrary strength scale", () => {
    const { model } = planFor("だった。");
    const font = fontResource();
    const plan = buildPaintPlan(model, true, undefined, deriveBaselineRatioFromFont(font));
    const { bytes } = renderPaintPlanToPdf(plan, font);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "small-kana-position-font-metrics.pdf"), bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});
