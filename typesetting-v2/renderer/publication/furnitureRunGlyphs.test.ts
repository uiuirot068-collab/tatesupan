import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FontBinary } from "./fontBinary";
import { furnitureRunGlyphs } from "./pdfGenerator";
import { VerticalOutlineContext } from "./verticalOutlinePaint";

// TSP-PRINT-004: PDF ノンブル / 柱 as glyph outlines. jsPDF measured a
// character outside the BMP as two characters (the right-aligned 柱 moved by
// one character) and cut the run at a character its font lacks.
const font = (file: string) => new VerticalOutlineContext(FontBinary.fromBase64(readFileSync(resolve("public/fonts", file)).toString("base64")));
const shippori = font("ShipporiMincho-Regular.ttf");
const zenOld = font("ZenOldMincho-Regular.ttf");

describe("furnitureRunGlyphs", () => {
  it("one glyph per code point; 𠮷 is one character wide", () => {
    const glyphs = furnitureRunGlyphs({ text: "𠮷野家", xMm: 50, yMm: 10, fontSizePt: 9, align: "right" }, shippori);
    expect(glyphs).toHaveLength(3);
    expect(glyphs.every((g) => g.glyphId > 0)).toBe(true);
    const em = (9 * 25.4) / 72;
    // Right edge of the run on the anchor; all three are full-width.
    const last = glyphs[2];
    expect(last.xMm + (shippori.glyphAdvanceUnits(last.glyphId) / shippori.unitsPerEm) * em).toBeCloseTo(50);
    expect(glyphs[0].xMm).toBeCloseTo(50 - 3 * em, 2);
    // jsPDF's baseline:"middle": centre + 0.35 em.
    expect(glyphs[0].baselineMm).toBeCloseTo(10 + em * 0.35);
  });

  it("takes a character the run's font lacks from a fallback font, without shortening the run", () => {
    const glyphs = furnitureRunGlyphs({ text: "第𠮷章", xMm: 0, yMm: 0, fontSizePt: 9, align: "left" }, zenOld, [shippori]);
    expect(glyphs.map((g) => g.context)).toEqual([zenOld, shippori, zenOld]);
    expect(glyphs.every((g) => g.glyphId > 0)).toBe(true);
  });

  it("keeps the missing-glyph box when no font has the character", () => {
    const glyphs = furnitureRunGlyphs({ text: "第𠮷章", xMm: 0, yMm: 0, fontSizePt: 9, align: "center" }, zenOld);
    expect(glyphs).toHaveLength(3);
    expect(glyphs[1].glyphId).toBe(0);
  });
});
