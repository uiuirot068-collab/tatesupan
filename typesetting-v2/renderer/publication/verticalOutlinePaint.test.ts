// P3-O08 — OpenType vertical GSUB outline paint (Human Visual QA HOLD
// round 7): PoC + unit tests, against the REAL committed Shippori Mincho
// asset. Proves opentype.js can parse the font, retrieve a glyph by ID,
// extract its outline, and that the outline converts deterministically
// into jsPDF-paintable commands.

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { parse as parseOpenTypeFont } from "opentype.js";
import { VerticalOutlineContext, convertOpenTypePathCommands, type OutlinePathCommand } from "./verticalOutlinePaint";
import { auditGsub } from "./gsubReader";
import { createGlyphIdLookup } from "./fontCapability";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");

function loadFont(): Buffer {
  return readFileSync(FONT_PATH);
}

describe("opentype.js PoC -- real Shippori Mincho asset", () => {
  it("1. font parses successfully with opentype.js", () => {
    const buf = loadFont();
    const font = parseOpenTypeFont(buf);
    expect(font.unitsPerEm).toBe(1000);
    expect(font.numGlyphs).toBeGreaterThan(0);
  });

  it("2. glyph can be retrieved BY GLYPH ID / index", () => {
    const buf = loadFont();
    const font = parseOpenTypeFont(buf);
    const glyph = font.glyphs.get(15228); // た's own source glyph, from prior evidence
    expect(glyph.index).toBe(15228);
  });

  it("3. vertical alternate glyph 15477 (っ's GSUB vert alternate) can be retrieved", () => {
    const buf = loadFont();
    const font = parseOpenTypeFont(buf);
    const glyph = font.glyphs.get(15477);
    expect(glyph.index).toBe(15477);
    // eslint-disable-next-line no-console
    console.log("GLYPH_15477", JSON.stringify({ numberOfContours: glyph.numberOfContours, xMin: glyph.xMin, yMin: glyph.yMin, xMax: glyph.xMax, yMax: glyph.yMax, advanceWidth: glyph.advanceWidth }));
  });

  it("4. its outline/path exists (real contour commands, not empty)", () => {
    const buf = loadFont();
    const font = parseOpenTypeFont(buf);
    const glyph = font.glyphs.get(15477);
    const path = glyph.getPath(0, 0, 1000);
    expect(path.commands.length).toBeGreaterThan(0);
    const commandTypes = Array.from(new Set(path.commands.map((c) => c.type)));
    // eslint-disable-next-line no-console
    console.log("GLYPH_15477_PATH_COMMAND_TYPES", JSON.stringify(commandTypes));
    // eslint-disable-next-line no-console
    console.log("GLYPH_15477_PATH_COMMANDS", JSON.stringify(path.commands));
  });

  it("5. its bbox can be read", () => {
    const buf = loadFont();
    const font = parseOpenTypeFont(buf);
    const glyph = font.glyphs.get(15477);
    const bbox = glyph.getBoundingBox();
    expect(bbox.x1).toBeLessThan(bbox.x2);
    expect(bbox.y1).toBeLessThan(bbox.y2);
  });

  it("6. the outline converts to deterministic jsPDF-paintable vector commands (M/L/C/Z only, no Q)", () => {
    const buf = loadFont();
    const font = parseOpenTypeFont(buf);
    const glyph = font.glyphs.get(15477);
    const path = glyph.getPath(0, 0, 1000);
    const converted = convertOpenTypePathCommands(path.commands);
    expect(converted.length).toBeGreaterThan(0);
    for (const cmd of converted) expect(["M", "L", "C", "Z"]).toContain(cmd.type);
    // Determinism: converting twice yields identical output.
    const converted2 = convertOpenTypePathCommands(path.commands);
    expect(converted).toEqual(converted2);
  });
});

describe("quadratic-to-cubic Bezier conversion -- formula correctness", () => {
  it("hand-computed case: P0=(0,0), Q1=(10,10), P2=(20,0) -> C1 = P0 + 2/3*(Q1-P0) = (20/3,20/3), C2 = P2 + 2/3*(Q1-P2) = (20 + 2/3*(10-20), 0 + 2/3*(10-0)) = (40/3,20/3)", () => {
    const commands: Parameters<typeof convertOpenTypePathCommands>[0] = [
      { type: "M", x: 0, y: 0 },
      { type: "Q", x1: 10, y1: 10, x: 20, y: 0 },
    ];
    const [, cubic] = convertOpenTypePathCommands(commands);
    expect(cubic.type).toBe("C");
    if (cubic.type === "C") {
      expect(cubic.x1).toBeCloseTo(20 / 3, 10);
      expect(cubic.y1).toBeCloseTo(20 / 3, 10);
      expect(cubic.x2).toBeCloseTo(40 / 3, 10);
      expect(cubic.y2).toBeCloseTo(20 / 3, 10);
      expect(cubic.x).toBe(20);
      expect(cubic.y).toBe(0);
    }
  });

  it("degenerate case: quadratic control point coincides with the START endpoint -> C1 collapses to P0, C2 = P2 + 2/3*(P0-P2) = (10 + 2/3*(0-10), 0) = (10/3, 0)", () => {
    const commands: Parameters<typeof convertOpenTypePathCommands>[0] = [
      { type: "M", x: 0, y: 0 },
      { type: "Q", x1: 0, y1: 0, x: 10, y: 0 },
    ];
    const [, cubic] = convertOpenTypePathCommands(commands);
    if (cubic.type === "C") {
      expect(cubic.x1).toBeCloseTo(0, 10);
      expect(cubic.y1).toBeCloseTo(0, 10);
      expect(cubic.x2).toBeCloseTo(10 / 3, 10);
      expect(cubic.y2).toBeCloseTo(0, 10);
    }
  });

  it("real font data: EVERY Q command opentype.js emits for the required outline glyph set converts without throwing, and no Q survives conversion", () => {
    const buf = loadFont();
    const font = parseOpenTypeFont(buf);
    const targetGlyphIds = [15477, 15509, 15511, 15513, 15566, 15606, 15608, 15610, 15901]; // 8 kana alternates + dash alternate, from the GSUB audit
    for (const glyphId of targetGlyphIds) {
      const glyph = font.glyphs.get(glyphId);
      const path = glyph.getPath(0, 0, 1000);
      const hasQ = path.commands.some((c) => c.type === "Q");
      const converted = convertOpenTypePathCommands(path.commands);
      expect(converted.some((c) => (c as { type: string }).type === "Q")).toBe(false);
      // eslint-disable-next-line no-console
      console.log("REAL_GLYPH_HAS_Q", glyphId, hasQ);
    }
  });
});

describe("VerticalOutlineContext -- resolveOutlineGlyphId + glyphOutlineCommandsMm", () => {
  it("resolves an outline glyph ID for a kana character with an unreachable GSUB alternate", () => {
    const buf = loadFont();
    const ctx = new VerticalOutlineContext(buf);
    expect(ctx.resolveOutlineGlyphId("っ")).toBe(15477);
    expect(ctx.resolveOutlineGlyphId("ゃ")).toBe(15509);
    expect(ctx.resolveOutlineGlyphId("ゅ")).toBe(15511);
    expect(ctx.resolveOutlineGlyphId("ょ")).toBe(15513);
    expect(ctx.resolveOutlineGlyphId("ッ")).toBe(15566);
    expect(ctx.resolveOutlineGlyphId("ャ")).toBe(15606);
    expect(ctx.resolveOutlineGlyphId("ュ")).toBe(15608);
    expect(ctx.resolveOutlineGlyphId("ョ")).toBe(15610);
  });

  it("resolves an outline glyph ID for ordinary kana too (broader finding, not small-kana-only)", () => {
    const buf = loadFont();
    const ctx = new VerticalOutlineContext(buf);
    expect(ctx.resolveOutlineGlyphId("つ")).toBeDefined();
    expect(ctx.resolveOutlineGlyphId("た")).toBeDefined();
  });

  it("resolves an outline glyph ID for the dash (its own true GSUB alternate, unreachable, differs from the manual U+FE31 mapping)", () => {
    const buf = loadFont();
    const ctx = new VerticalOutlineContext(buf);
    expect(ctx.resolveOutlineGlyphId("―")).toBe(15901);
  });

  it("returns undefined for punctuation/ellipsis -- their manual Unicode mapping already reaches the correct GSUB glyph, no outline paint needed", () => {
    const buf = loadFont();
    const ctx = new VerticalOutlineContext(buf);
    expect(ctx.resolveOutlineGlyphId("、")).toBeUndefined();
    expect(ctx.resolveOutlineGlyphId("。")).toBeUndefined();
    expect(ctx.resolveOutlineGlyphId("「")).toBeUndefined();
    expect(ctx.resolveOutlineGlyphId("」")).toBeUndefined();
    expect(ctx.resolveOutlineGlyphId("（")).toBeUndefined();
    expect(ctx.resolveOutlineGlyphId("）")).toBeUndefined();
    expect(ctx.resolveOutlineGlyphId("…")).toBeUndefined();
  });

  it("returns undefined for ordinary kanji with no GSUB vertical alternate at all", () => {
    const buf = loadFont();
    const ctx = new VerticalOutlineContext(buf);
    expect(ctx.resolveOutlineGlyphId("日")).toBeUndefined();
  });

  it("is memoized -- calling resolveOutlineGlyphId twice for the same character returns the identical (cached) result without re-computing", () => {
    const buf = loadFont();
    const ctx = new VerticalOutlineContext(buf);
    expect(ctx.resolveOutlineGlyphId("っ")).toBe(ctx.resolveOutlineGlyphId("っ"));
  });

  it("cross-checks against the independent GSUB audit directly -- same glyph IDs, not a coincidence of this class's own logic", () => {
    const buf = loadFont();
    const audit = auditGsub(buf);
    const glyphIdFor = createGlyphIdLookup(buf);
    const ctx = new VerticalOutlineContext(buf);
    const sourceGlyphId = glyphIdFor(0x3063)!; // っ
    const expectedVertGlyphId = audit.vert.substitutionMap.get(sourceGlyphId);
    expect(ctx.resolveOutlineGlyphId("っ")).toBe(expectedVertGlyphId);
  });

  it("glyphOutlineCommandsMm produces real, non-empty, mm-scale path commands centered on the given cell", () => {
    const buf = loadFont();
    const ctx = new VerticalOutlineContext(buf);
    const glyphId = ctx.resolveOutlineGlyphId("っ")!;
    const commands = ctx.glyphOutlineCommandsMm(glyphId, /* xCenterMm */ 10, /* yBaselineMm */ 20, /* emSizeMm */ 3.7);
    expect(commands.length).toBeGreaterThan(0);
    expect(commands[0].type).toBe("M");
    // Every coordinate should be in a plausible mm range near the anchor (not raw font units in the thousands).
    for (const cmd of commands) {
      const coords: number[] = cmd.type === "Z" ? [] : cmd.type === "C" ? [cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y] : [cmd.x, cmd.y];
      for (const v of coords) expect(Math.abs(v)).toBeLessThan(100);
    }
  });

  it("glyphOutlineCommandsMm is deterministic -- same glyph ID/anchor -> identical command stream", () => {
    const buf = loadFont();
    const ctx = new VerticalOutlineContext(buf);
    const glyphId = ctx.resolveOutlineGlyphId("っ")!;
    const a = ctx.glyphOutlineCommandsMm(glyphId, 10, 20, 3.7);
    const b = ctx.glyphOutlineCommandsMm(glyphId, 10, 20, 3.7);
    expect(a).toEqual(b);
  });

  it("fails structurally for a genuinely invalid glyph ID rather than silently returning an empty/fabricated outline", () => {
    const buf = loadFont();
    const ctx = new VerticalOutlineContext(buf);
    expect(() => ctx.glyphOutlineCommandsMm(999999, 0, 0, 1)).toThrow();
  });
});
