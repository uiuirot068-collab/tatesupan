// P3-O08 — OpenType vertical GSUB outline paint (Human Visual QA HOLD
// round 7, dependency-gate approval): bridges the already-proven GSUB
// vertical-glyph-selection audit (`gsubReader.ts` — kept as-is, NOT
// rewritten, per this round's own explicit instruction) to a real vector
// glyph outline via `opentype.js`, for the specific glyphs proven
// (`P3_O08_OPENTYPE_VERTICAL_GSUB_AUDIT.md`) to have a real `vert`/`vrt2`
// substitute that is NOT reachable through any Unicode code point jsPDF's
// `text()` API could paint.
//
// STRICT SCOPE (per this round's own architecture boundary):
//   gsubReader.ts        owns: source glyph ID -> vertical glyph ID
//   opentype.js (here)   owns: glyph ID -> outline path / bbox ONLY
//   jsPDF (pdfGenerator)  owns: vector path emission (moveTo/lineTo/curveTo/fill)
// opentype.js is NEVER asked to decide wrapping, vertical layout,
// kinsoku, ruby placement, TCY detection, or page flow — Core's
// canonical cell/advance/break/source/coordinates are completely
// untouched; this module only ever answers "what does glyph N look
// like," for a single already-decided glyph ID and already-decided paint
// position.

import { Font as OpenTypeFont, parse as parseOpenTypeFont, type Glyph as OpenTypeGlyph, type PathCommand as OpenTypePathCommand } from "opentype.js";
import { auditGsub, type GsubAudit } from "./gsubReader";
import { createGlyphIdLookup, findCodePointForGlyphId } from "./fontCapability";

// Human Visual QA HOLD round 23 -- ported VERBATIM from
// `core/rules/defaultRuleSet.ts`'s own cl-11 (small kana) member list,
// never re-derived or hardcoded independently.
const SMALL_KANA_TEST = /[ぁぃぅぇぉァィゥェォっゃゅょッャュョ]/u;

export type OutlinePathCommand =
  | { type: "M"; x: number; y: number }
  | { type: "L"; x: number; y: number }
  | { type: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: "Z" };

// Standard quadratic-to-cubic Bézier degree elevation: given the current
// point P0, a quadratic control point Q1, and endpoint P2, the EXACT
// equivalent cubic control points are C1 = P0 + 2/3*(Q1-P0) and
// C2 = P2 + 2/3*(Q1-P2) (both control points derived from the SAME
// quadratic control point, weighted toward each endpoint). This is a
// well-known, lossless conversion (not an approximation/flattening) —
// tested directly in `verticalOutlinePaint.test.ts` against hand-computed
// expected values for a synthetic case, and against every real quadratic
// segment opentype.js emits for this font's own glyphs.
function quadraticToCubic(p0x: number, p0y: number, q1x: number, q1y: number, p2x: number, p2y: number): { x1: number; y1: number; x2: number; y2: number } {
  const twoThirds = 2 / 3;
  return {
    x1: p0x + twoThirds * (q1x - p0x),
    y1: p0y + twoThirds * (q1y - p0y),
    x2: p2x + twoThirds * (q1x - p2x),
    y2: p2y + twoThirds * (q1y - p2y),
  };
}

/** Converts opentype.js's own PathCommand[] (M/L/C/Q/Z) into this module's minimal, jsPDF-agnostic OutlinePathCommand[] (M/L/C/Z only — every Q is losslessly elevated to an equivalent C). Deterministic: same input commands always produce the same output. */
export function convertOpenTypePathCommands(commands: OpenTypePathCommand[]): OutlinePathCommand[] {
  const out: OutlinePathCommand[] = [];
  let curX = 0;
  let curY = 0;
  for (const cmd of commands) {
    if (cmd.type === "M") {
      out.push({ type: "M", x: cmd.x, y: cmd.y });
      curX = cmd.x;
      curY = cmd.y;
    } else if (cmd.type === "L") {
      out.push({ type: "L", x: cmd.x, y: cmd.y });
      curX = cmd.x;
      curY = cmd.y;
    } else if (cmd.type === "C") {
      out.push({ type: "C", x1: cmd.x1, y1: cmd.y1, x2: cmd.x2, y2: cmd.y2, x: cmd.x, y: cmd.y });
      curX = cmd.x;
      curY = cmd.y;
    } else if (cmd.type === "Q") {
      const cubic = quadraticToCubic(curX, curY, cmd.x1, cmd.y1, cmd.x, cmd.y);
      out.push({ type: "C", x1: cubic.x1, y1: cubic.y1, x2: cubic.x2, y2: cubic.y2, x: cmd.x, y: cmd.y });
      curX = cmd.x;
      curY = cmd.y;
    } else {
      out.push({ type: "Z" });
      // Z does not change the current point per the SVG/PDF path model
      // (a subsequent command starts a NEW subpath with its own M).
    }
  }
  return out;
}

/**
 * Built once per document render (never re-parses the font per glyph —
 * both the GSUB audit and the opentype.js Font are parsed exactly once in
 * the constructor). Answers exactly two questions: (1) does this
 * grapheme need outline paint at all (its GSUB vertical alternate exists
 * AND is unreachable via any Unicode code point), and (2) what are that
 * glyph's real outline path commands, already translated/scaled into mm
 * page-coordinate space at the given anchor.
 */
export class VerticalOutlineContext {
  private readonly audit: GsubAudit;
  private readonly glyphIdFor: (codePoint: number) => number | undefined;
  private readonly font: OpenTypeFont;
  private readonly fontBuf: Buffer;
  private readonly outlineGlyphCache = new Map<number, number | undefined>();

  constructor(fontBuf: Buffer) {
    this.fontBuf = fontBuf;
    this.audit = auditGsub(fontBuf);
    this.glyphIdFor = createGlyphIdLookup(fontBuf);
    this.font = parseOpenTypeFont(fontBuf);
  }

  /**
   * Returns the glyph ID that must be painted via OUTLINE (bypassing
   * jsPDF's `text()`) for this grapheme, or `undefined` if the grapheme
   * should keep using the existing Unicode-text paint path (either it has
   * no GSUB vertical alternate at all, or that alternate IS reachable via
   * some Unicode code point — proven for every punctuation mark and
   * ellipsis in the prior round's audit, where the existing manual
   * Unicode-presentation-form mapping already selects the identical
   * glyph GSUB would). Memoized per source glyph ID within this context's
   * own lifetime (one document render).
   */
  resolveOutlineGlyphId(grapheme: string): number | undefined {
    if (Array.from(grapheme).length !== 1) return undefined;
    const sourceGlyphId = this.glyphIdFor(grapheme.codePointAt(0)!);
    if (sourceGlyphId === undefined) return undefined;
    if (this.outlineGlyphCache.has(sourceGlyphId)) return this.outlineGlyphCache.get(sourceGlyphId);

    const vertGlyphId = this.audit.vert.substitutionMap.get(sourceGlyphId) ?? this.audit.vrt2.substitutionMap.get(sourceGlyphId);
    let result: number | undefined;
    if (vertGlyphId !== undefined && vertGlyphId !== sourceGlyphId) {
      const reachable = findCodePointForGlyphId(this.fontBuf, vertGlyphId);
      result = reachable === undefined ? vertGlyphId : undefined;
    }
    this.outlineGlyphCache.set(sourceGlyphId, result);
    return result;
  }

  private getGlyph(glyphId: number): OpenTypeGlyph {
    return this.font.glyphs.get(glyphId);
  }

  /** unitsPerEm of the underlying font — exposed for callers that need to reason about font-unit quantities (e.g. real advance width) alongside outline paint. */
  get unitsPerEm(): number {
    return this.font.unitsPerEm;
  }

  /**
   * Human Visual QA HOLD round 23: bbox-derived baseline ratio that
   * centers a SMALL KANA glyph's own real ink bounding box on its own
   * 1em slot's vertical center, along the vertical-flow axis only —
   * `undefined` for any other grapheme (ordinary characters keep the
   * existing uniform, vmtx-origin-derived default; this is a targeted
   * exception, not a general re-centering rule). `SMALL_KANA_TEST` is
   * ported verbatim from `core/rules/defaultRuleSet.ts`'s own cl-11
   * member list (never re-derived, never a hardcoded literal-only
   * check elsewhere). Resolved against the ACTUAL painted glyph — the
   * outline glyph when one applies (small kana's real GSUB vertical
   * alternate, per round 6), the ordinary cmap-resolved glyph
   * otherwise — never the wrong glyph's own bbox.
   */
  inkCenteredBaselineRatioForSmallKana(grapheme: string): number | undefined {
    if (!SMALL_KANA_TEST.test(grapheme)) return undefined;
    const glyphId = this.resolveOutlineGlyphId(grapheme) ?? this.glyphIdFor(grapheme.codePointAt(0)!);
    if (glyphId === undefined) return undefined;
    const bbox = this.getGlyph(glyphId).getBoundingBox();
    return 0.5 + (bbox.y1 + bbox.y2) / (2 * this.font.unitsPerEm);
  }

  /**
   * Real outline path commands for `glyphId`, already translated/scaled
   * into mm page-coordinate space: `xCenterMm` is the cell's own
   * horizontal center (the glyph is centered on it using its OWN real
   * advance width, the same convention `align:"center"` text painting
   * already uses), `yBaselineMm` is the SAME font-derived vertical-origin
   * baseline position `verticalGraphemeCommands` already computes for
   * ordinary text (round 5's `deriveBaselineRatioFromFont` — reused
   * unchanged, per this round's own "do not invent new manual offsets"
   * instruction), `emSizeMm` is one character cell's own height in mm
   * (the same "1 em = N mm" quantity Natural Pitch already uses
   * everywhere else in this renderer). All scale/translate/Y-axis-flip
   * math is opentype.js's own `Glyph.getPath` — not reimplemented here.
   */
  glyphOutlineCommandsMm(glyphId: number, xCenterMm: number, yBaselineMm: number, emSizeMm: number): OutlinePathCommand[] {
    const glyph = this.getGlyph(glyphId);
    const advanceWidthMm = ((glyph.advanceWidth ?? this.font.unitsPerEm) / this.font.unitsPerEm) * emSizeMm;
    const anchorXMm = xCenterMm - advanceWidthMm / 2;
    const path = glyph.getPath(anchorXMm, yBaselineMm, emSizeMm);
    return convertOpenTypePathCommands(path.commands);
  }

  /**
   * Human Visual QA HOLD round 29C (P3-O08 final-page completion,
   * colophon horizontal block-width measurement): a single grapheme's
   * REAL horizontal advance width in mm, at `emSizeMm` per cell — reuses
   * the EXACT SAME glyph resolution (`resolveOutlineGlyphId`/
   * `glyphIdFor`) and `glyph.advanceWidth` field `glyphOutlineCommandsMm`
   * already trusts above, just exposed as a horizontal SUM primitive
   * rather than an outline-paint primitive. Never a character-count
   * estimate — a real ASCII glyph (e.g. an email address's own Latin
   * characters) and a real CJK glyph in the same font genuinely have
   * different advance widths, and this reads each one's own real value.
   * Falls back to `emSizeMm` (Natural Pitch's own uniform default) only
   * when the grapheme cannot be resolved to any glyph at all (never a
   * silent 0).
   */
  advanceWidthMm(grapheme: string, emSizeMm: number): number {
    if (Array.from(grapheme).length !== 1) return emSizeMm;
    const glyphId = this.resolveOutlineGlyphId(grapheme) ?? this.glyphIdFor(grapheme.codePointAt(0)!);
    if (glyphId === undefined) return emSizeMm;
    const glyph = this.getGlyph(glyphId);
    return ((glyph.advanceWidth ?? this.font.unitsPerEm) / this.font.unitsPerEm) * emSizeMm;
  }
}
