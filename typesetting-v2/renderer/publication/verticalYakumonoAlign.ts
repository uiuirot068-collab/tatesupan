// P3-O08 — Yakumono legacy-parity edge alignment (Human Visual QA HOLD
// round 13): PORTS, not re-derives, the already-working legacy
// renderer's own real, measured fix — direct read of
// `src/components/PageCard.tsx` lines 29-49/2083-2113 (dated
// TSP-LOOP-003), cited verbatim in
// qa/evidence/P3_O08_YAKUMONO_LEGACY_PARITY_AUDIT.md.
//
// Legacy's own mechanism: every character sits in an UNCHANGED,
// full-size canonical cell (slot coordinates/height/advance never
// vary); punctuation is anchored to one EDGE of that cell instead of
// centered — `justify-content: flex-start` (column-start edge, "top" of
// the cell in vertical-rl) for closing-type marks (、。，．」』）〉》】
// 〕］｝｠”’), `flex-end` (column-end edge, "bottom") for opening-type
// marks (「『（〈《【〔［｛｟“‘), `center` (unchanged) for everything
// else. This is a PAINT-TIME-ONLY correction — Core's own canonical
// layer (`core/compose/line.ts`) has NO punctuation-specific concept at
// all, matching legacy's own "slot coordinates, height and advance are
// all unchanged" invariant exactly.
//
// TRANSLATION TO jsPDF (baseline-anchored, not a flex box): CSS
// flex-start/flex-end pushes the glyph's own rendered ink flush against
// one edge of its cell. jsPDF has no browser layout engine to compute
// "the glyph's own rendered box" for us, but this project already has
// REAL, measured per-glyph ink bounding boxes (`fontMetrics.ts`'s
// `glyphInkBBox`, built in round 5/7) — this module uses that real data
// to compute the baseline position that puts the glyph's own real ink
// flush against the correct cell edge, instead of centered
// (`deriveBaselineRatioFromFont`'s existing `baselineRatio`, round 5,
// which remains the default for every NON-yakumono character,
// unchanged). No arbitrary offset — every position is derived from the
// font's own real outline data for the EXACT glyph being painted.
//
// GPOS `vpal` (round 10) is deliberately NOT re-applied on top of this
// for yakumono-classified characters — legacy's own comment describes
// `vpal` as secondary ("still keeps the glyph shapes on the font's
// punctuation metrics"), and combining both would double-apply
// placement. `pdfGenerator.ts` gates the two explicitly (see its own
// call site).

import { FontMetricsReader } from "./fontMetrics";
import { createGlyphIdLookup } from "./fontCapability";
import { verticalPaintGraphemeFor } from "./verticalGlyphMap";

// Ported VERBATIM from src/components/PageCard.tsx:47 — closing-type
// marks (句読点 + 終わり括弧・引用符): anchor to the cell's own START
// edge ("top" in vertical-rl).
const HANG_START_TEST = /[、。，．」』）〉》】〕］｝｠”’]/u;
// Ported VERBATIM from src/components/PageCard.tsx:49 — opening-type
// marks (始め括弧・引用符): anchor to the cell's own END edge
// ("bottom").
const HANG_END_TEST = /[「『（〈《【〔［｛｟“‘]/u;

export type YakumonoAlignment = "NORMAL" | "HANG_START" | "HANG_END";

/** Classifies a single grapheme exactly as legacy's own two regexes do — data-driven, no reinterpretation. */
export function classifyYakumonoAlignment(grapheme: string): YakumonoAlignment {
  if (HANG_START_TEST.test(grapheme)) return "HANG_START";
  if (HANG_END_TEST.test(grapheme)) return "HANG_END";
  return "NORMAL";
}

// Human Visual QA HOLD round 16 briefly added a `usesFullEmAnchor`
// cl-06/cl-07 -> cl-02 paint-anchor override here — RETIRED in round 17:
// a later, authoritative direct comparison against real Adobe InDesign
// vertical output found visible normal spacing before a closing bracket
// is the DESIRED product behavior, not a defect. See
// `qa/evidence/P3_O08_YAKUMONO_NORMAL_SPACING_FINAL_ROUND17.md` for the
// full record (not erased — superseded). This module is back to its
// exact round-13 form: every yakumono-classified character uses the
// same per-character-slot-height anchor, with no pair-specific
// exception.

/**
 * Built once per document render (font bytes parsed exactly once,
 * per-glyph result memoized). Answers "at what fraction of one cell's
 * own height, measured from the cell's own top edge, should this
 * grapheme's horizontal baseline be placed" — the SAME quantity
 * `deriveBaselineRatioFromFont` (round 5) already computes for the
 * NORMAL (centered) case; this class instead computes it per-grapheme,
 * flush to the correct edge for HANG_START/HANG_END classified
 * characters, using that exact glyph's own REAL ink bounding box.
 */
export class VerticalYakumonoAlignContext {
  private readonly reader: FontMetricsReader;
  private readonly glyphIdFor: (codePoint: number) => number | undefined;
  private readonly cache = new Map<string, number | undefined>();
  private readonly fallbackBaselineRatio: number;

  constructor(fontBuf: Buffer, fallbackBaselineRatio: number) {
    this.reader = new FontMetricsReader(fontBuf);
    this.glyphIdFor = createGlyphIdLookup(fontBuf);
    this.fallbackBaselineRatio = fallbackBaselineRatio;
  }

  /**
   * Real per-glyph baseline-ratio override for a grapheme, or
   * `undefined` if this grapheme is NORMAL (unclassified) or its real
   * ink bbox could not be determined (safe fallback to the existing
   * centered default — never a fabricated position).
   */
  baselineRatioFor(grapheme: string): number | undefined {
    const alignment = classifyYakumonoAlignment(grapheme);
    if (alignment === "NORMAL") return undefined;
    if (this.cache.has(grapheme)) return this.cache.get(grapheme);

    const result = this.computeBaselineRatio(grapheme, alignment);
    this.cache.set(grapheme, result);
    return result;
  }

  private computeBaselineRatio(grapheme: string, alignment: "HANG_START" | "HANG_END"): number | undefined {
    // The ACTUAL painted codepoint — the real Unicode vertical
    // presentation form when one exists (round 6), the source character
    // unchanged otherwise. Ink bbox must be read for the glyph that is
    // truly drawn, not the source character's own (possibly different)
    // glyph.
    const paintedText = verticalPaintGraphemeFor(grapheme);
    if (Array.from(paintedText).length !== 1) return undefined;
    const glyphId = this.glyphIdFor(paintedText.codePointAt(0)!);
    if (glyphId === undefined) return undefined;
    const bbox = this.reader.glyphInkBBox(glyphId);
    if (!bbox) return undefined;
    const unitsPerEm = this.reader.unitsPerEm;

    if (alignment === "HANG_START") {
      // Flush the glyph's own ink TOP edge to the cell's own top edge:
      // baselineRatio = yMax / unitsPerEm (font Y-up: yMax is the ink's
      // own distance above the baseline; placing the baseline this far
      // down from the cell top puts the ink's own top exactly at the
      // cell top).
      return bbox.yMax / unitsPerEm;
    }
    // HANG_END: flush the glyph's own ink BOTTOM edge to the cell's own
    // bottom edge: baselineRatio = 1 + yMin / unitsPerEm (yMin is
    // typically <= 0, i.e. at or below the baseline; this places the
    // baseline far enough down that the ink's own bottom lands exactly
    // at the cell's own bottom edge, one full cell down from the top).
    return 1 + bbox.yMin / unitsPerEm;
  }

  /** The ordinary, centered default ratio this context was built with — for callers that need it without a specific grapheme's own classification. */
  get defaultBaselineRatio(): number {
    return this.fallbackBaselineRatio;
  }
}
