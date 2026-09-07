// P3-O08 — OpenType vertical GPOS ink placement (Human Visual QA HOLD
// round 10): bridges the real `vpal` (Proportional Alternate Vertical
// Metrics) GPOS data — the only vertical positioning feature this font
// actually ships (`vhal`/`vchw` are confirmed ABSENT,
// qa/evidence/P3_O08_YAKUMONO_GPOS.md §GPOS) — to a small, paint-time-only
// Y-position nudge.
//
// ARCHITECTURE (explicit split, per this round's own instruction "JLREQ
// chooses WHEN spacing behavior applies. Font metrics determine HOW the
// selected glyph is positioned. Do not collapse these into one constant"):
//   Core (`core/compose/line.ts`, round 8, UNCHANGED)  owns: WHEN a pair
//     of adjacent yakumono-class characters gets a compressed canonical
//     advance (the logical, font-agnostic jlreq pair rule).
//   This module                                          owns: HOW a
//     glyph's own ink is nudged within its cell, sourced from the real,
//     measured `vpal` YPlacement value for its own post-GSUB glyph ID —
//     a font-specific, paint-time-only refinement, applied uniformly
//     (not gated on whether this occurrence happens to be inside a
//     compressed pair — `vpal`'s own real values are already close to
//     zero for a standalone closing mark, so applying it unconditionally
//     is harmless and, for a font that ships proportional vertical
//     metrics at all, matches the font's own intended rendering in every
//     context).
//   `core/compose/line.ts`'s canonical yTick/xTick positions are never
//   touched by this module — this is exactly as Renderer-only as round
//   5's `deriveBaselineRatioFromFont` or round 7's outline paint.

import { auditGsub, type GsubAudit } from "./gsubReader";
import { auditGpos, type GposAudit } from "./gposReader";
import { createGlyphIdLookup } from "./fontCapability";
import { FontMetricsReader } from "./fontMetrics";

/**
 * Built once per document render (GSUB + GPOS + head table each parsed
 * exactly once). Answers "how far should this grapheme's own ink shift,
 * as a fraction of one em, along the vertical (Y) axis" — sourced from
 * the font's own real `vpal` YPlacement value for its post-GSUB glyph
 * ID, or 0 (no shift) when the font provides no such value.
 */
export class VerticalGposContext {
  private readonly gsub: GsubAudit;
  private readonly gpos: GposAudit;
  private readonly glyphIdFor: (codePoint: number) => number | undefined;
  private readonly unitsPerEm: number;
  private readonly cache = new Map<number, number>();

  constructor(fontBuf: Buffer) {
    this.gsub = auditGsub(fontBuf);
    this.gpos = auditGpos(fontBuf);
    this.glyphIdFor = createGlyphIdLookup(fontBuf);
    this.unitsPerEm = new FontMetricsReader(fontBuf).unitsPerEm;
  }

  /**
   * Fraction of one em to shift this grapheme's own paint position along
   * Y, POSITIVE meaning "toward smaller page-Y" (up the page / earlier in
   * the vertical reading direction) — the same sign convention already
   * used by opentype.js's own `Glyph.getPath` Y-flip (round 7), for
   * consistency between the outline-paint and text-paint code paths.
   * `vpal`'s own YPlacement is a font-space Y-UP offset (OpenType spec
   * convention, same as `glyf` outline coordinates), so this negates it
   * once when converting to the page's Y-DOWN mm coordinate system.
   */
  yPlacementEmFor(grapheme: string): number {
    if (Array.from(grapheme).length !== 1) return 0;
    const sourceGlyphId = this.glyphIdFor(grapheme.codePointAt(0)!);
    if (sourceGlyphId === undefined) return 0;
    if (this.cache.has(sourceGlyphId)) return this.cache.get(sourceGlyphId)!;

    const vertGlyphId = this.gsub.vert.substitutionMap.get(sourceGlyphId) ?? this.gsub.vrt2.substitutionMap.get(sourceGlyphId) ?? sourceGlyphId;
    const adjustment = this.gpos.vpal.singleAdjustments.get(vertGlyphId);
    const result = adjustment ? -(adjustment.yPlacement / this.unitsPerEm) : 0;
    this.cache.set(sourceGlyphId, result);
    return result;
  }
}
