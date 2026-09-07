// P3-O08 — Yakumono legacy-parity edge alignment (Human Visual QA HOLD
// round 13): proves the classification is ported verbatim from
// src/components/PageCard.tsx's own regexes, and that the real,
// font-derived baseline-ratio override is computed correctly against
// the real committed Shippori Mincho asset.

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { classifyYakumonoAlignment, VerticalYakumonoAlignContext } from "./verticalYakumonoAlign";
import { FontMetricsReader } from "./fontMetrics";
import { createGlyphIdLookup } from "./fontCapability";
import { verticalPaintGraphemeFor } from "./verticalGlyphMap";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");

function loadFont(): Buffer {
  return readFileSync(FONT_PATH);
}

describe("classifyYakumonoAlignment -- ported verbatim from PageCard.tsx:47,49", () => {
  it("HANG_START: closing-type marks (句読点 + 終わり括弧・引用符)", () => {
    for (const ch of ["、", "。", "，", "．", "」", "』", "）", "〉", "》", "】", "〕", "］", "｝", "｠", "”", "’"]) {
      expect(classifyYakumonoAlignment(ch)).toBe("HANG_START");
    }
  });

  it("HANG_END: opening-type marks (始め括弧・引用符)", () => {
    for (const ch of ["「", "『", "（", "〈", "《", "【", "〔", "［", "｛", "｟", "“", "‘"]) {
      expect(classifyYakumonoAlignment(ch)).toBe("HANG_END");
    }
  });

  it("NORMAL: ordinary kanji/kana/digits are never classified", () => {
    for (const ch of ["東", "あ", "ッ", "2", "A"]) {
      expect(classifyYakumonoAlignment(ch)).toBe("NORMAL");
    }
  });

  it("determinism: classifying the same character twice yields the identical result", () => {
    expect(classifyYakumonoAlignment("。")).toBe(classifyYakumonoAlignment("。"));
  });
});

describe("VerticalYakumonoAlignContext -- real font-derived baseline ratios", () => {
  it("HANG_START characters (。「」etc's closing side) get a real, defined baselineRatio override", () => {
    const ctx = new VerticalYakumonoAlignContext(loadFont(), 0.88);
    for (const ch of ["、", "。", "」"]) {
      const ratio = ctx.baselineRatioFor(ch);
      expect(ratio).toBeDefined();
      expect(ratio).toBeGreaterThan(0);
      expect(ratio).toBeLessThan(2); // sane bound -- a real em-fraction, not a fabricated huge number
    }
  });

  it("HANG_END characters (「etc.) get a real, defined baselineRatio override", () => {
    const ctx = new VerticalYakumonoAlignContext(loadFont(), 0.88);
    const ratio = ctx.baselineRatioFor("「");
    expect(ratio).toBeDefined();
    expect(ratio).toBeGreaterThan(0);
  });

  it("NORMAL characters return undefined (no override) -- callers fall back to the existing centered default", () => {
    const ctx = new VerticalYakumonoAlignContext(loadFont(), 0.88);
    expect(ctx.baselineRatioFor("東")).toBeUndefined();
    expect(ctx.baselineRatioFor("あ")).toBeUndefined();
  });

  it("the override is derived from the ACTUAL painted glyph's real ink bbox, not the source character's own glyph, when a vertical presentation form is substituted", () => {
    const buf = loadFont();
    const ctx = new VerticalYakumonoAlignContext(buf, 0.88);
    const reader = new FontMetricsReader(buf);
    const glyphIdFor = createGlyphIdLookup(buf);

    // 。paints as its real vertical presentation form (U+FE12, round 6) --
    // the override must be computed from THAT glyph's own ink, not from
    // U+3002's own (different) glyph.
    const paintedChar = verticalPaintGraphemeFor("。");
    expect(paintedChar.codePointAt(0)).toBe(0xfe12);
    const paintedGlyphId = glyphIdFor(paintedChar.codePointAt(0)!)!;
    const bbox = reader.glyphInkBBox(paintedGlyphId)!;
    const expectedRatio = bbox.yMax / reader.unitsPerEm;
    expect(ctx.baselineRatioFor("。")).toBeCloseTo(expectedRatio, 10);
  });

  it("HANG_END formula: baselineRatio = 1 + yMin/unitsPerEm, verified directly against real font data for 「", () => {
    const buf = loadFont();
    const ctx = new VerticalYakumonoAlignContext(buf, 0.88);
    const reader = new FontMetricsReader(buf);
    const glyphIdFor = createGlyphIdLookup(buf);
    const paintedChar = verticalPaintGraphemeFor("「");
    const glyphId = glyphIdFor(paintedChar.codePointAt(0)!)!;
    const bbox = reader.glyphInkBBox(glyphId)!;
    const expectedRatio = 1 + bbox.yMin / reader.unitsPerEm;
    expect(ctx.baselineRatioFor("「")).toBeCloseTo(expectedRatio, 10);
  });

  it("determinism: resolving the same character's override twice yields the identical value (memoized)", () => {
    const ctx = new VerticalYakumonoAlignContext(loadFont(), 0.88);
    expect(ctx.baselineRatioFor("。")).toBe(ctx.baselineRatioFor("。"));
  });

  it("defaultBaselineRatio exposes the fallback ratio the context was constructed with", () => {
    const ctx = new VerticalYakumonoAlignContext(loadFont(), 0.88);
    expect(ctx.defaultBaselineRatio).toBe(0.88);
  });
});
