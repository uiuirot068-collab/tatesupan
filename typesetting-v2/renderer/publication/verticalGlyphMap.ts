// P3-O08 — ONE deterministic Publication vertical-glyph paint layer.
//
// Replaces the earlier ad-hoc 90-degree rotation hack for Dash/Ellipsis
// (which caused a real, reported bug — a rotated horizontal stroke
// glyph's own rotated bounding box did not match the assumed per-
// character cell height, so Dash's vertical stroke visibly intruded into
// the following character's own cell) with real Unicode vertical
// presentation-form glyphs, painted UPRIGHT (no rotation at all) exactly
// like any ordinary character — the font itself already designed these
// glyphs to sit correctly within one cell.
//
// COVERAGE, MEASURED not assumed (fontCapability.test.ts's own "AUDIT"
// test, run against the exact committed Shippori Mincho Regular asset):
//
//   source -> vertical form           | present in this font?
//   U+3001 、 -> U+FE11 (comma)        | YES
//   U+3002 。 -> U+FE12 (full stop)    | YES
//   U+300C 「 -> U+FE41 (corner open)  | YES
//   U+300D 」 -> U+FE42 (corner close) | YES
//   U+FF08 （ -> U+FE35 (paren open)   | YES
//   U+FF09 ） -> U+FE36 (paren close)  | YES
//   U+2015 ―  -> U+FE31 (em dash)      | YES
//   U+2026 …  -> U+FE19 (ellipsis)     | YES
//   U+FF01 ！ -> U+FE15                | NO (font lacks this glyph)
//   U+FF1F ？ -> U+FE16                | NO
//   U+FF1A ： -> U+FE13                | NO
//   U+FF1B ； -> U+FE14                | NO
//
// The four NOT-covered characters (！？：；) are, by standard Japanese
// vertical-typesetting convention, conventionally left UPRIGHT anyway —
// their own horizontal glyph shape is already visually acceptable
// unrotated (unlike a dash/ellipsis/bracket, they have no strong
// left-right-reading-order shape) — so their absence from this font
// blocks nothing this task needs.
//
// CLASSIFICATION (data-driven, per this task's own required scheme):
//   VERTICAL_FORM    — a real substitute glyph exists and is used (the
//                       eight rows above marked YES).
//   UPRIGHT          — no rotation/substitution; painted exactly like any
//                       ordinary character (everything else, including
//                       ordinary kanji/kana and the four NOT-covered
//                       punctuation marks above).
//   POSITION_ADJUSTED — not currently used by this map (no character in
//                       this task's own scope needed it — comma/full-stop
//                       had real substitute GLYPHS, not just repositioning
//                       needs, once measured against the real font).
//   TCY / DASH / ELLIPSIS — existing dedicated Publication paint paths
//                       (pdfGenerator.ts); DASH and ELLIPSIS now consult
//                       this SAME map for their own per-grapheme glyph
//                       selection, rather than maintaining a separate,
//                       special-cased rotation rule.
//
// NEVER mutates manuscript source: this map only decides which CODE POINT
// jsPDF's `text()` is asked to draw. `PaintPlacedUnit.text`/`sourceSpan`
// (the canonical identity) are never touched — this is a pure paint-time
// substitution, the same architectural relationship real font vertical
// shaping has to the underlying text content.

const VERTICAL_FORM_MAP: ReadonlyMap<number, number> = new Map([
  [0x3001, 0xfe11], // 、 -> vertical ideographic comma
  [0x3002, 0xfe12], // 。 -> vertical ideographic full stop
  [0x300c, 0xfe41], // 「 -> vertical left corner bracket
  [0x300d, 0xfe42], // 」 -> vertical right corner bracket
  [0xff08, 0xfe35], // （ -> vertical left parenthesis
  [0xff09, 0xfe36], // ） -> vertical right parenthesis
  [0x2015, 0xfe31], // ― -> vertical em dash
  [0x2026, 0xfe19], // … -> vertical horizontal ellipsis
]);

/**
 * Returns the PAINT-TIME glyph for one grapheme: its real Unicode vertical
 * presentation-form substitute if one is mapped (and, per the measured
 * coverage above, present in the committed font), otherwise the grapheme
 * unchanged. Never touches canonical source/SourceSpan — paint-only.
 */
export function verticalPaintGraphemeFor(grapheme: string): string {
  if (Array.from(grapheme).length !== 1) return grapheme; // defensive: only ever called with one grapheme
  const codePoint = grapheme.codePointAt(0)!;
  const substitute = VERTICAL_FORM_MAP.get(codePoint);
  return substitute !== undefined ? String.fromCodePoint(substitute) : grapheme;
}

/** Applies `verticalPaintGraphemeFor` to every grapheme of a string, preserving order and length. */
export function verticalPaintTextFor(text: string): string {
  return Array.from(text).map(verticalPaintGraphemeFor).join("");
}

// --- Cell-local positioning (Human Visual QA HOLD round 4) -----------------
//
// Vertical-form glyph SUBSTITUTION (above) fixes glyph SHAPE/orientation —
// it does NOT by itself prove correct cell-local INK position, because
// jsPDF paints every glyph via ordinary horizontal baseline metrics
// (`BASELINE_RATIO` in pdfGenerator.ts), never the font's own vertical
// origin/metrics (`vhea`/`vmtx` tables, not parsed by this foundation —
// only `cmap`, via fontCapability.ts). A vertical-form punctuation glyph's
// own ink is very likely NOT centered the same way an ordinary kanji's is
// within its own advance box, and small kana conventionally sit in a
// specific (not center) part of their cell in real vertical typesetting.
//
// HONEST LIMIT: without rendering the actual PDF, the exact correct
// cell-local offset for any of these classes cannot be machine-verified —
// this is the SAME epistemic position as any other unverifiable optical
// value in this project (matching e.g. P3-O06's own "do not fabricate a
// numeric budget" discipline). Rather than pick one unverified number,
// this module exposes NAMED, data-driven CANDIDATE STRATEGIES — never a
// single unverified magic offset presented as fact.

export type PunctuationClass = "OPEN_BRACKET" | "CLOSE_BRACKET" | "COMMA" | "PERIOD";

const PUNCTUATION_CLASS_MAP: ReadonlyMap<number, PunctuationClass> = new Map([
  [0x300c, "OPEN_BRACKET"], // 「
  [0xff08, "OPEN_BRACKET"], // （
  [0x300d, "CLOSE_BRACKET"], // 」
  [0xff09, "CLOSE_BRACKET"], // ）
  [0x3001, "COMMA"], // 、
  [0x3002, "PERIOD"], // 。
]);

/** Classifies a SOURCE grapheme (before substitution) into a punctuation class, or undefined if it isn't one of these four. */
export function classifyPunctuation(grapheme: string): PunctuationClass | undefined {
  if (Array.from(grapheme).length !== 1) return undefined;
  return PUNCTUATION_CLASS_MAP.get(grapheme.codePointAt(0)!);
}

// Small kana (捨て仮名/拗音・促音): conventionally positioned toward the
// upper-right of their own cell in real vertical Japanese typesetting
// (never centered like an ordinary kana). Hiragana + katakana small forms.
const SMALL_KANA = new Set(
  Array.from("ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ")
);

/** True for any small kana grapheme (捨て仮名), false for ordinary kana/kanji/anything else. */
export function isSmallKana(grapheme: string): boolean {
  return Array.from(grapheme).length === 1 && SMALL_KANA.has(grapheme);
}

export type CellLocalOffsetCandidateId = "A_BASELINE" | "B_STANDARD" | "C_STRONG";

export interface CellLocalOffset {
  /** Fraction of one cell height, POSITIVE moves the glyph DOWN the cell (toward the run's own end). */
  yOffsetEm: number;
}

// Three named, disclosed candidates — never presented as "the correct
// value," only as reasoned starting points per standard JIS/Adobe vertical
// typesetting convention (opening marks biased toward the cell's own
// start/top; closing marks biased toward its own end/bottom; comma/period
// biased toward the start/top, matching their real upper-left
// positioning convention; small kana biased toward the start/top and,
// conceptually, the outside edge — this foundation only expresses the
// Y-axis component, since X-axis cell-local offset is not yet modeled).
const CANDIDATES: Record<CellLocalOffsetCandidateId, Record<PunctuationClass | "SMALL_KANA", CellLocalOffset>> = {
  A_BASELINE: {
    OPEN_BRACKET: { yOffsetEm: 0 },
    CLOSE_BRACKET: { yOffsetEm: 0 },
    COMMA: { yOffsetEm: 0 },
    PERIOD: { yOffsetEm: 0 },
    SMALL_KANA: { yOffsetEm: 0 },
  },
  B_STANDARD: {
    OPEN_BRACKET: { yOffsetEm: -0.15 },
    CLOSE_BRACKET: { yOffsetEm: 0.15 },
    COMMA: { yOffsetEm: -0.25 },
    PERIOD: { yOffsetEm: -0.25 },
    SMALL_KANA: { yOffsetEm: -0.15 },
  },
  C_STRONG: {
    OPEN_BRACKET: { yOffsetEm: -0.3 },
    CLOSE_BRACKET: { yOffsetEm: 0.3 },
    COMMA: { yOffsetEm: -0.4 },
    PERIOD: { yOffsetEm: -0.4 },
    SMALL_KANA: { yOffsetEm: -0.3 },
  },
};

/**
 * Returns the cell-local Y offset (as a fraction of one cell height) for a
 * SOURCE grapheme under a named candidate strategy — 0 for any character
 * that is neither classified punctuation nor small kana (ordinary
 * kanji/kana, digits, Latin — completely unaffected by this system).
 */
export function cellLocalOffsetFor(grapheme: string, candidate: CellLocalOffsetCandidateId): CellLocalOffset {
  const punctClass = classifyPunctuation(grapheme);
  if (punctClass) return CANDIDATES[candidate][punctClass];
  if (isSmallKana(grapheme)) return CANDIDATES[candidate].SMALL_KANA;
  return { yOffsetEm: 0 };
}
