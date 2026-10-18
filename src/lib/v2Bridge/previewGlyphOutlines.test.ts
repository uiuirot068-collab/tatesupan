import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createPreviewGlyphOutlines, isPreviewOutlinedGrapheme } from "./previewGlyphOutlines";

const shippori = new Uint8Array(readFileSync(join(process.cwd(), "public/fonts/ShipporiMincho-Regular.ttf")));

describe("TSP-PRINT-001: Preview body glyphs as outlines", () => {
  it("outlines plain kanji and kana only; punctuation, small kana, ー, Latin and digits stay browser text", () => {
    for (const ch of ["吾", "輩", "は", "ア", "々", "ゝ"]) expect(isPreviewOutlinedGrapheme(ch)).toBe(true);
    for (const ch of ["、", "。", "「", "」", "ぁ", "っ", "ャ", "ー", "…", "―", "A", "1", "！", "東京"]) expect(isPreviewOutlinedGrapheme(ch)).toBe(false);
  });

  it("places glyphs like PDF / JPG: the font's own vertical origin, full-width advance", () => {
    const outlines = createPreviewGlyphOutlines(shippori);
    expect(outlines.unitsPerEm).toBe(1000);
    expect(outlines.baselineRatio).toBeCloseTo(0.88, 5);
    const kanji = outlines.outline("漢");
    expect(kanji?.advance).toBe(1000);
    expect(kanji?.d.startsWith("M")).toBe(true);
    expect(outlines.outline("、")).toBeUndefined();
    expect(outlines.outline("ぁ")).toBeUndefined();
    // Same object on repeat (parsed once per glyph).
    expect(outlines.outline("漢")).toBe(kanji);
  });
});
