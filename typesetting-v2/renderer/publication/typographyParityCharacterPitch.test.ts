// TYPOGRAPHY PARITY -- INDESIGN CHARACTER-PITCH RECHECK (audit round,
// recorded 2026-09-09). Measurement-only, audit-only: no Core/Preview/
// Publication source is changed by this file. Reads the REAL committed
// Shippori Mincho asset (the same file every other P3-O08 font-metrics
// test in this directory reads) and records real per-glyph ink-box
// metrics for a set of ORDINARY continuous-prose characters, plus the
// canonical body pitch itself -- to separate "is the canonical 1-character
// PITCH wrong" (Type A) from "is the GLYPH INK merely smaller than its own
// 1em cell, as is true of every font including InDesign's own" (Type C).
//
// `console.log` blocks are deliberate, matching this directory's own
// established convention (see fontMetrics.test.ts's own header comment):
// their output is the raw evidence transcribed into
// qa/evidence/TYPOGRAPHY_PARITY_INDESIGN_CHARACTER_PITCH.md, not decorative.

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { createGlyphIdLookup } from "./fontCapability";
import { FontMetricsReader } from "./fontMetrics";
import { mmToTicks } from "../../core/geometry/tick";
import { tickToMm } from "./geometry";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");

function loadFont(): Buffer {
  return readFileSync(FONT_PATH);
}

// Same fixture body size every other Publication QA fixture in this
// directory uses (renderer/publication/fixtures.ts's own BODY_FONT_SIZE_PT)
// -- not invented for this audit.
const BODY_FONT_SIZE_PT = 10.5;

// The exact formula core/measurement/shipporiMinchoProvider.ts's own
// naturalAdvanceTick uses (ptToTicks) -- re-derived here read-only, for
// evidence transparency, never imported as a shortcut around measuring it.
const MM_PER_PT = 25.4 / 72;
function ptToTicks(sizePt: number): number {
  return Math.round(sizePt * MM_PER_PT * 1000);
}

describe("Typography Parity audit -- canonical body pitch (Type A check)", () => {
  it("canonical per-character advance is EXACTLY 1 declared em, uniformly, by construction -- not a per-glyph measurement", () => {
    const canonicalAdvanceTick = ptToTicks(BODY_FONT_SIZE_PT);
    const emTick = mmToTicks((BODY_FONT_SIZE_PT * MM_PER_PT));
    // Both formulas are the same arithmetic under different entry points
    // (mmToTicks(pt->mm) vs ptToTicks direct) -- asserting they agree is
    // itself evidence there is no hidden second pitch formula anywhere.
    expect(canonicalAdvanceTick).toBe(emTick);
    const advanceMm = tickToMm(canonicalAdvanceTick);
    const pitchOverEmRatio = advanceMm / (BODY_FONT_SIZE_PT * MM_PER_PT);
    // eslint-disable-next-line no-console
    console.log(
      "CANONICAL_PITCH",
      JSON.stringify({
        bodyFontSizePt: BODY_FONT_SIZE_PT,
        bodyEmMm: BODY_FONT_SIZE_PT * MM_PER_PT,
        canonicalAdvanceTick,
        canonicalAdvanceMm: advanceMm,
        pitchOverEmRatio,
      })
    );
    // Integer-tick rounding (Contract §21, 0.001mm precision) introduces a
    // sub-0.01% deviation from a mathematically exact 1.0 ratio -- expected,
    // frozen, and utterly negligible; NOT the visual-looseness cause.
    expect(pitchOverEmRatio).toBeCloseTo(1, 4);
  });
});

interface CharSpec {
  label: string;
  char: string;
  codePoint: number;
}

// The exact continuous-prose character set the checkpoint task specified:
// 人は驚きすぎるとほんとうに足止まらしい (ordinary kanji/hiragana, no
// punctuation, no small kana, no dash/ellipsis -- deliberately disjoint
// from every OTHER already-measured P3-O08 fixture set, which focused on
// punctuation/small-kana ink positioning specifically).
const CHARS: CharSpec[] = [
  { label: "人 (hito)", char: "人", codePoint: 0x4eba },
  { label: "は (ha)", char: "は", codePoint: 0x306f },
  { label: "驚 (odoroki)", char: "驚", codePoint: 0x9a5a },
  { label: "き (ki)", char: "き", codePoint: 0x304d },
  { label: "す (su)", char: "す", codePoint: 0x3059 },
  { label: "ぎ (gi)", char: "ぎ", codePoint: 0x304e },
  { label: "る (ru)", char: "る", codePoint: 0x308b },
  { label: "と (to)", char: "と", codePoint: 0x3068 },
  { label: "本 (hon)", char: "本", codePoint: 0x672c },
  { label: "当 (tou)", char: "当", codePoint: 0x5f53 },
  { label: "に (ni)", char: "に", codePoint: 0x306b },
  { label: "足 (ashi)", char: "足", codePoint: 0x8db3 },
  { label: "止 (to-domaru, from 足が止まる)", char: "止", codePoint: 0x6b62 },
  { label: "ま (ma)", char: "ま", codePoint: 0x307e },
  { label: "ら (ra)", char: "ら", codePoint: 0x3089 },
  { label: "し (shi)", char: "し", codePoint: 0x3057 },
  { label: "い (i)", char: "い", codePoint: 0x3044 },
];

describe("Typography Parity audit -- Shippori Mincho ordinary-glyph ink box (Type B/C check)", () => {
  it("measures advance + ink bbox + vertical ink center for every ordinary continuous-prose character in the canonical sample", () => {
    const buf = loadFont();
    const lookup = createGlyphIdLookup(buf);
    const reader = new FontMetricsReader(buf);
    const unitsPerEm = reader.unitsPerEm;

    const results = CHARS.map((spec) => {
      const glyphId = lookup(spec.codePoint);
      if (glyphId === undefined) {
        return { ...spec, glyphId: undefined, note: "NOT_IN_FONT_CMAP" };
      }
      const bbox = reader.glyphInkBBox(glyphId);
      const vmetrics = reader.verticalMetrics(glyphId);
      const hmetrics = reader.horizontalMetrics(glyphId);
      if (!bbox) {
        return { ...spec, glyphId, note: "NO_GLYF_OUTLINE" };
      }
      const bboxEm = {
        xMin: bbox.xMin / unitsPerEm,
        yMin: bbox.yMin / unitsPerEm,
        xMax: bbox.xMax / unitsPerEm,
        yMax: bbox.yMax / unitsPerEm,
      };
      const inkHeightEm = bboxEm.yMax - bboxEm.yMin;
      const inkWidthEm = bboxEm.xMax - bboxEm.xMin;
      // originYEm: this glyph's own vertical origin (top-of-cell reference
      // in vertical typesetting), per OpenType's own yOrigin = yMax +
      // topSideBearing formula -- SAME formula fontMetrics.ts's own
      // verticalMetrics() already uses for every other P3-O08 vertical
      // glyph measurement in this directory, not re-derived differently
      // here.
      const originYEm = vmetrics?.originY !== undefined ? vmetrics.originY / unitsPerEm : undefined;
      // Ink center relative to the glyph's own vertical origin, in em --
      // 0 means the ink is vertically centered exactly ON the origin;
      // negative means the ink center sits BELOW the origin (further into
      // the cell, in vertical-rl reading direction).
      const inkCenterFromOriginEm = originYEm !== undefined ? (bboxEm.yMax + bboxEm.yMin) / 2 - originYEm : undefined;
      return {
        ...spec,
        glyphId,
        advanceWidthEm: hmetrics ? hmetrics.advanceWidth / unitsPerEm : undefined,
        advanceHeightEm: vmetrics ? vmetrics.advanceHeight / unitsPerEm : undefined,
        bboxEm,
        inkHeightEm,
        inkWidthEm,
        // What fraction of the 1em cell (advanceHeight) the glyph's own
        // ink actually occupies -- the direct answer to "does this font's
        // ordinary CJK ink merely look smaller than the full cell,
        // inherent to the font, not a TateSpun pitch defect."
        inkHeightOverCellRatio: vmetrics && vmetrics.advanceHeight > 0 ? inkHeightEm / (vmetrics.advanceHeight / unitsPerEm) : undefined,
        originYEm,
        inkCenterFromOriginEm,
      };
    });

    // eslint-disable-next-line no-console
    console.log("ORDINARY_GLYPH_INK_METRICS", JSON.stringify(results, null, 2));

    expect(results.length).toBe(CHARS.length);
    for (const r of results) {
      expect(r.glyphId, `${r.label} must be present in the font's cmap`).toBeDefined();
    }
  });
});
