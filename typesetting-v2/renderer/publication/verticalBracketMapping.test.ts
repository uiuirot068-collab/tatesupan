import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { auditGsub } from "./gsubReader";
import { createGlyphCoverageChecker, createGlyphIdLookup } from "./fontCapability";
import { verticalPaintGraphemeFor } from "./verticalGlyphMap";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");

const TARGETS = [
  { source: "、", sourceCp: 0x3001, vertical: "︑", verticalCp: 0xfe11 },
  { source: "。", sourceCp: 0x3002, vertical: "︒", verticalCp: 0xfe12 },
  { source: "，", sourceCp: 0xff0c, vertical: "︐", verticalCp: 0xfe10 },
  { source: "〈", sourceCp: 0x3008, vertical: "︿", verticalCp: 0xfe3f },
  { source: "〉", sourceCp: 0x3009, vertical: "﹀", verticalCp: 0xfe40 },
  { source: "《", sourceCp: 0x300a, vertical: "︽", verticalCp: 0xfe3d },
  { source: "》", sourceCp: 0x300b, vertical: "︾", verticalCp: 0xfe3e },
  { source: "「", sourceCp: 0x300c, vertical: "﹁", verticalCp: 0xfe41 },
  { source: "」", sourceCp: 0x300d, vertical: "﹂", verticalCp: 0xfe42 },
  { source: "『", sourceCp: 0x300e, vertical: "﹃", verticalCp: 0xfe43 },
  { source: "』", sourceCp: 0x300f, vertical: "﹄", verticalCp: 0xfe44 },
  { source: "【", sourceCp: 0x3010, vertical: "︻", verticalCp: 0xfe3b },
  { source: "】", sourceCp: 0x3011, vertical: "︼", verticalCp: 0xfe3c },
  { source: "〔", sourceCp: 0x3014, vertical: "︹", verticalCp: 0xfe39 },
  { source: "〕", sourceCp: 0x3015, vertical: "︺", verticalCp: 0xfe3a },
  { source: "（", sourceCp: 0xff08, vertical: "︵", verticalCp: 0xfe35 },
  { source: "）", sourceCp: 0xff09, vertical: "︶", verticalCp: 0xfe36 },
  { source: "［", sourceCp: 0xff3b, vertical: "﹇", verticalCp: 0xfe47 },
  { source: "］", sourceCp: 0xff3d, vertical: "﹈", verticalCp: 0xfe48 },
  { source: "｛", sourceCp: 0xff5b, vertical: "︷", verticalCp: 0xfe37 },
  { source: "｝", sourceCp: 0xff5d, vertical: "︸", verticalCp: 0xfe38 },
  { source: "―", sourceCp: 0x2015, vertical: "︱", verticalCp: 0xfe31 },
  { source: "…", sourceCp: 0x2026, vertical: "︙", verticalCp: 0xfe19 },
] as const;

const HUMAN_REPORTED = ["『", "』", "［", "］", "【", "】"] as const;

describe("V2 Publication direct vertical-form mapping", () => {
  it("maps every audited direct-presentation-form target", () => {
    for (const target of TARGETS) {
      expect(verticalPaintGraphemeFor(target.source), target.source).toBe(target.vertical);
    }
  });

  it("keeps explicit regression coverage for the three Human-QA-reported bracket families", () => {
    for (const source of HUMAN_REPORTED) {
      const target = TARGETS.find((row) => row.source === source);
      expect(target, source).toBeDefined();
      expect(verticalPaintGraphemeFor(source), source).toBe(target?.vertical);
    }
  });

  it("proves the committed Shippori Mincho contains every mapped source and presentation-form glyph", () => {
    const font = readFileSync(FONT_PATH);
    const hasGlyph = createGlyphCoverageChecker(font);
    for (const target of TARGETS) {
      expect(hasGlyph(target.sourceCp), `${target.source} source glyph`).toBe(true);
      expect(hasGlyph(target.verticalCp), `${target.source} vertical glyph`).toBe(true);
    }
  });

  it("proves each Unicode mapping selects the same glyph as Shippori Mincho vert/vrt2 GSUB, except Dash's already-documented outline path", () => {
    const font = readFileSync(FONT_PATH);
    const glyphIdFor = createGlyphIdLookup(font);
    const audit = auditGsub(font);
    for (const target of TARGETS) {
      if (target.source === "―") continue;
      const sourceGlyphId = glyphIdFor(target.sourceCp);
      const verticalGlyphId = glyphIdFor(target.verticalCp);
      expect(sourceGlyphId, `${target.source} source glyph id`).toBeDefined();
      expect(verticalGlyphId, `${target.source} vertical glyph id`).toBeDefined();
      const gsubGlyphId = sourceGlyphId === undefined
        ? undefined
        : audit.vert.substitutionMap.get(sourceGlyphId) ?? audit.vrt2.substitutionMap.get(sourceGlyphId);
      expect(gsubGlyphId, `${target.source} GSUB parity`).toBe(verticalGlyphId);
    }
  });
});
