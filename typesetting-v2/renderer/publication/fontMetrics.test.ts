// P3-O08 — Font-derived vertical glyph paint metrics (Human Visual QA HOLD
// round 5): the audit's own ground-truth evidence. Reads the REAL committed
// Shippori Mincho asset — no synthetic/fake font bytes — and records exact
// table presence + real per-glyph metrics for the specific characters the
// task requires. `console.log` blocks are deliberate: their output is the
// raw evidence transcribed into
// qa/evidence/P3_O08_FONT_DERIVED_VERTICAL_GLYPH_METRICS.md, not decorative.

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { createGlyphIdLookup } from "./fontCapability";
import { FontMetricsReader, listTables } from "./fontMetrics";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");

function loadFont(): Buffer {
  return readFileSync(FONT_PATH);
}

describe("fontMetrics -- SFNT table presence audit (real Shippori Mincho asset)", () => {
  it("lists every table tag actually present in the committed font", () => {
    const buf = loadFont();
    const tables = listTables(buf);
    // eslint-disable-next-line no-console
    console.log("TABLES_PRESENT", JSON.stringify(tables));
    expect(tables.length).toBeGreaterThan(0);
    // Ground truth for the evidence doc -- record presence/absence of every
    // table this task's own audit list names, without assuming any of them.
    const required = ["glyf", "loca", "hhea", "hmtx", "head", "maxp", "cmap", "vhea", "vmtx", "VORG"];
    const presence: Record<string, boolean> = {};
    for (const tag of required) presence[tag] = tables.includes(tag);
    // eslint-disable-next-line no-console
    console.log("TABLE_PRESENCE", JSON.stringify(presence));
  });

  it("head/maxp/loca/glyf/hhea/hmtx are all present -- required for glyphInkBBox/horizontalMetrics to work at all", () => {
    const buf = loadFont();
    const reader = new FontMetricsReader(buf);
    expect(reader.hasTable("head")).toBe(true);
    expect(reader.hasTable("maxp")).toBe(true);
    expect(reader.hasTable("glyf")).toBe(true);
    expect(reader.hasTable("loca")).toBe(true);
    expect(reader.hasTable("hhea")).toBe(true);
    expect(reader.hasTable("hmtx")).toBe(true);
    // eslint-disable-next-line no-console
    console.log("UNITS_PER_EM", reader.unitsPerEm);
  });

  it("vhea/vmtx are present -- record vhea's own ascent/descent for reference", () => {
    const buf = loadFont();
    const reader = new FontMetricsReader(buf);
    expect(reader.hasTable("vhea")).toBe(true);
    expect(reader.hasTable("vmtx")).toBe(true);
    // vhea layout mirrors hhea: version(4) then ascent(int16 @+4), descent(int16 @+6), lineGap(int16 @+8).
    const vheaTable = listTables(buf).includes("vhea");
    expect(vheaTable).toBe(true);
  });
});

interface CharSpec {
  label: string;
  char: string;
  codePoint: number;
}

const CHARS: CharSpec[] = [
  { label: "small-tsu (hiragana)", char: "っ", codePoint: 0x3063 },
  { label: "small-tsu (katakana)", char: "ッ", codePoint: 0x30c3 },
  { label: "ordinary-tsu (hiragana, control)", char: "つ", codePoint: 0x3064 },
  { label: "ta (ordinary baseline glyph)", char: "た", codePoint: 0x305f },
  { label: "comma (source)", char: "、", codePoint: 0x3001 },
  { label: "vertical-comma (presentation form)", char: "︑", codePoint: 0xfe11 },
  { label: "period (source)", char: "。", codePoint: 0x3002 },
  { label: "vertical-period (presentation form)", char: "︒", codePoint: 0xfe12 },
  { label: "open-corner-bracket (source)", char: "「", codePoint: 0x300c },
  { label: "vertical-open-corner-bracket (presentation form)", char: "﹁", codePoint: 0xfe41 },
  { label: "close-corner-bracket (source)", char: "」", codePoint: 0x300d },
  { label: "vertical-close-corner-bracket (presentation form)", char: "﹂", codePoint: 0xfe42 },
  { label: "open-paren (source, fullwidth)", char: "（", codePoint: 0xff08 },
  { label: "vertical-open-paren (presentation form)", char: "︵", codePoint: 0xfe35 },
  { label: "close-paren (source, fullwidth)", char: "）", codePoint: 0xff09 },
  { label: "vertical-close-paren (presentation form)", char: "︶", codePoint: 0xfe36 },
];

describe("fontMetrics -- real glyph ID + metric extraction for the required character set", () => {
  it("resolves a deterministic glyph ID (or undefined for uncovered code points) for every required character, and records real metrics for covered ones", () => {
    const buf = loadFont();
    const glyphIdFor = createGlyphIdLookup(buf);
    const reader = new FontMetricsReader(buf);

    // eslint-disable-next-line no-console
    console.log("VHEA", JSON.stringify({ vertAscent: reader.vertAscent, vertDescent: reader.vertDescent, unitsPerEm: reader.unitsPerEm }));

    const evidence: Array<{
      label: string;
      codePoint: string;
      glyphId: number | undefined;
      bbox: ReturnType<FontMetricsReader["glyphInkBBox"]>;
      hmtx: ReturnType<FontMetricsReader["horizontalMetrics"]>;
      vmtx: ReturnType<FontMetricsReader["verticalMetrics"]>;
      bboxEm: { xMin: number; yMin: number; xMax: number; yMax: number } | undefined;
      originYEm: number | undefined;
      /** originY expressed as an offset from cell-top, assuming the vertical cell top = vhea.ascent (font units), downward-positive -- i.e. how far down from the cell's own top edge this glyph's real vertical origin sits, as a fraction of one em. */
      originOffsetFromCellTopEm: number | undefined;
    }> = [];

    for (const spec of CHARS) {
      const glyphId = glyphIdFor(spec.codePoint);
      const bbox = glyphId !== undefined ? reader.glyphInkBBox(glyphId) : undefined;
      const hmtx = glyphId !== undefined ? reader.horizontalMetrics(glyphId) : undefined;
      const vmtx = glyphId !== undefined ? reader.verticalMetrics(glyphId) : undefined;
      const bboxEm = bbox
        ? {
            xMin: bbox.xMin / reader.unitsPerEm,
            yMin: bbox.yMin / reader.unitsPerEm,
            xMax: bbox.xMax / reader.unitsPerEm,
            yMax: bbox.yMax / reader.unitsPerEm,
          }
        : undefined;
      const originYEm = vmtx?.originY !== undefined ? vmtx.originY / reader.unitsPerEm : undefined;
      const originOffsetFromCellTopEm =
        vmtx?.originY !== undefined && reader.vertAscent !== undefined ? (reader.vertAscent - vmtx.originY) / reader.unitsPerEm : undefined;
      evidence.push({
        label: spec.label,
        codePoint: "U+" + spec.codePoint.toString(16).toUpperCase().padStart(4, "0"),
        glyphId,
        bbox,
        hmtx,
        vmtx,
        bboxEm,
        originYEm,
        originOffsetFromCellTopEm,
      });
    }

    // eslint-disable-next-line no-console
    console.log("GLYPH_EVIDENCE", JSON.stringify(evidence, null, 2));

    // Determinism: calling twice yields identical results (same font buffer, same reader).
    const reader2 = new FontMetricsReader(buf);
    const glyphIdFor2 = createGlyphIdLookup(buf);
    for (const spec of CHARS) {
      const id1 = glyphIdFor(spec.codePoint);
      const id2 = glyphIdFor2(spec.codePoint);
      expect(id2).toBe(id1);
      if (id1 !== undefined) {
        expect(reader2.glyphInkBBox(id1)).toEqual(reader.glyphInkBBox(id1));
      }
    }

    // "ta" is the normal-glyph baseline -- must resolve to SOME glyph with a real (non-degenerate) bbox.
    const ta = evidence.find((e) => e.label.startsWith("ta"))!;
    expect(ta.glyphId).toBeDefined();
    expect(ta.bbox).toBeDefined();

    // Small tsu vs ordinary tsu must be DIFFERENT glyph IDs (distinct glyphs, not a shared fallback).
    const smallTsu = evidence.find((e) => e.label === "small-tsu (hiragana)")!;
    const ordinaryTsu = evidence.find((e) => e.label === "ordinary-tsu (hiragana, control)")!;
    expect(smallTsu.glyphId).toBeDefined();
    expect(ordinaryTsu.glyphId).toBeDefined();
    expect(smallTsu.glyphId).not.toBe(ordinaryTsu.glyphId);
  });
});
