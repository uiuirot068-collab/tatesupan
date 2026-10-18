import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { asFontBinary } from "../../../typesetting-v2/renderer/publication/fontBinary";
import { deriveBaselineRatioFromFontBinary, resolveVerticalGraphemePaint } from "../../../typesetting-v2/renderer/publication/pdfGenerator";
import { VerticalOutlineContext } from "../../../typesetting-v2/renderer/publication/verticalOutlinePaint";
import { VerticalYakumonoAlignContext } from "../../../typesetting-v2/renderer/publication/verticalYakumonoAlign";
import { tcyRunPlacement } from "../../../typesetting-v2/renderer/preview/PreviewRenderer";
import { createPreviewGlyphOutlines, isPreviewOutlinedGrapheme } from "./previewGlyphOutlines";

const shippori = new Uint8Array(readFileSync(join(process.cwd(), "public/fonts/ShipporiMincho-Regular.ttf")));

describe("TSP-PRINT-001: Preview body glyphs as outlines", () => {
  it("outlines every single character except spaces; clusters stay browser text", () => {
    for (const ch of ["吾", "輩", "は", "ア", "々", "ゝ", "、", "。", "「", "」", "ぁ", "っ", "ャ", "！", "Ａ", "ー", "A", "1", "!"]) expect(isPreviewOutlinedGrapheme(ch)).toBe(true);
    for (const ch of [" ", "　", "東京"]) expect(isPreviewOutlinedGrapheme(ch)).toBe(false);
  });

  it("places glyphs like PDF / JPG: the font's own vertical origin, full-width advance", () => {
    const outlines = createPreviewGlyphOutlines(shippori);
    expect(outlines.unitsPerEm).toBe(1000);
    expect(outlines.baselineRatio).toBeCloseTo(0.88, 5);
    const kanji = outlines.outline("漢");
    expect(kanji?.advance).toBe(1000);
    expect(kanji?.d.startsWith("M")).toBe(true);
    expect(kanji?.baselineRatio).toBeUndefined();
    expect(kanji?.cellSized).toBeUndefined();
    // Same object on repeat (parsed once per glyph).
    expect(outlines.outline("漢")).toBe(kanji);
  });
});

describe("TSP-PRINT-002: punctuation and small kana follow the export's own rules", () => {
  const fontBinary = asFontBinary(shippori);
  const baselineRatio = deriveBaselineRatioFromFontBinary(fontBinary);
  const outlineContext = new VerticalOutlineContext(fontBinary);
  const yakumonoContext = new VerticalYakumonoAlignContext(fontBinary, baselineRatio);
  const outlines = createPreviewGlyphOutlines(shippori);
  const font = outlineContext.openTypeFont;

  it.each(["、", "。", "「", "」", "（", "）", "ぁ", "っ", "ャ", "！", "？", "ー", "A", "g", "7"])("%s: same glyph, same baseline, same size as PDF", (ch) => {
    const paint = resolveVerticalGraphemePaint(ch, baselineRatio, outlineContext, yakumonoContext);
    expect(paint.kind).not.toBe("rotated");
    if (paint.kind === "rotated") return;
    const glyph = paint.kind === "outline" ? font.glyphs.get(paint.glyphId) : font.charToGlyph(paint.text);
    const outline = outlines.outline(ch);
    expect(outline).toBeDefined();
    expect(outline!.d).toBe(glyph.getPath(0, 0, 1000).toPathData(1));
    expect(outline!.baselineRatio ?? outlines.baselineRatio).toBeCloseTo(paint.baselineRatio, 10);
    expect(Boolean(outline!.cellSized)).toBe(paint.kind === "outline");
  });

  it("、 and 。 use their vertical forms (top right of the cell), not the horizontal glyphs", () => {
    for (const ch of ["、", "。"]) {
      expect(outlines.outline(ch)!.d).not.toBe(font.charToGlyph(ch).getPath(0, 0, 1000).toPathData(1));
    }
  });

  it("small kana and ー are drawn as the font's vertical alternate at one cell's size", () => {
    expect(outlines.outline("っ")?.cellSized).toBe(true);
    expect(outlines.outline("ー")?.cellSized).toBe(true);
  });

  it("ASCII stays the upright horizontal glyph, centred on its own (narrow) advance", () => {
    const a = outlines.outline("A")!;
    expect(a.cellSized).toBeUndefined();
    expect(a.d).toBe(font.charToGlyph("A").getPath(0, 0, 1000).toPathData(1));
    expect(a.advance).toBeLessThan(1000);
  });
});

describe("TSP-PRINT-002: 縦中横 is drawn the way PDF draws it", () => {
  const outlines = createPreviewGlyphOutlines(shippori);
  const font = new VerticalOutlineContext(asFontBinary(shippori)).openTypeFont;

  it("horizontal glyphs side by side at their own advances (jsPDF: no kerning)", () => {
    for (const text of ["12", "25", "!!", "?!"]) {
      const run = outlines.run!(text)!;
      const glyphs = Array.from(text).map((ch) => font.charToGlyph(ch));
      expect(run.glyphs.map((g) => g.d)).toEqual(glyphs.map((g) => g.getPath(0, 0, 1000).toPathData(1)));
      expect(run.glyphs.map((g) => g.x)).toEqual([0, glyphs[0].advanceWidth]);
      expect(run.advance).toBe(glyphs[0].advanceWidth! + glyphs[1].advanceWidth!);
    }
  });

  it("one em = the unit's height, centred on the line, baseline as jsPDF's middle", () => {
    const run = outlines.run!("12")!;
    const unit = { topPx: 100, heightPx: 20 };
    const p = tcyRunPlacement(run, 1000, unit, 30);
    expect(p.scale).toBeCloseTo(20 / 1000, 10);
    expect(p.x + (run.advance * p.scale) / 2).toBeCloseTo(15, 10);
    // jsPDF: y += size / 2 − size × (1.15 − 1)
    expect(p.baselineY).toBeCloseTo(110 + 20 / 2 - 20 * 0.15, 10);
  });

  it("shrinks only when wider than the line (as renderPaintPlanToPdf does)", () => {
    const run = { glyphs: [], advance: 3000 };
    const p = tcyRunPlacement(run, 1000, { topPx: 0, heightPx: 20 }, 30);
    expect(run.advance * p.scale).toBeCloseTo(30, 10);
    expect(p.x).toBeCloseTo(0, 10);
    expect(p.baselineY).toBeCloseTo(10 + 10 * 0.35, 10);
  });
});
