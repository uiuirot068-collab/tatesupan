// LEGACY-FROZEN capacity derivation — P3-O12-C.
//
// This file is a DELIBERATE, VERBATIM port of the exact clamp chain
// `src/lib/pageLayout.ts` (Production) already ships: computeFontSizeMm,
// computeLinePitchMm, computeColumnHeightMm, computeTextAreaWidthMm,
// computeAutoCharsPerLine, computeMaxCapacityChars, computeAutoLinesPerColumn,
// reassembled exactly as `computePageLayout()` combines them. See
// typesetting-v2/qa/research/P3_O12_CAPACITY_GEOMETRY_AUDIT.md §2/§3/§10 for
// the full reconstruction and hand-verified parity numbers this file's tests
// assert against.
//
// DO NOT "clean up" anything in this file — not the PAGE_SAFETY_MARGIN_CHARS
// fudge factor, not the full-height-vs-per-column two-column clamp
// inconsistency (§3.2/§10 of the audit: `computeMaxCapacityChars` is checked
// against the FULL 天地 text-area height even when columnCount===2, which is
// a genuine, pre-existing Production quirk, not something introduced here).
// Every existing saved document's persisted charsPerLine/linesPerColumn were
// authored against exactly this arithmetic; changing any constant or clamp
// dimension here is a compatibility break for every such document (audit
// §5's compatibility question). If Production's own formula is ever
// deliberately changed, this file must NOT be edited to match — it must stay
// exactly what shipped, forever, and Production's new behavior becomes a new
// formula version instead (mirroring how "legacy-frozen" itself came to
// exist as a snapshot of pre-P3-O12 behavior).
//
// Arithmetic is deliberately float-mm, matching Production exactly — NOT
// GeometryTick integers. Porting the *numbers* over to a tick-integer
// representation here would not be "the same formula" if it changed a single
// floor() boundary; parity with existing saved documents requires bit-for-bit
// reproduction of Production's own float arithmetic, not a tick-safe rewrite.
// (Contrast with capacityV2Native.ts, which is integer-tick from the start,
// per Contract §21/INV-013 — that file is not bound by this constraint.)

import { mmToTicks, type GeometryTick } from "../geometry/tick";

const MM_PER_PT = 25.4 / 72;

/**
 * Safety buffer (character cells) subtracted before flooring an AUTO/target
 * capacity guess — verbatim from src/lib/pageLayout.ts's
 * PAGE_SAFETY_MARGIN_CHARS. An empirical DOM-clipping compensation, not a
 * font-metrics fact (P3-O12 audit §8: REQUIRES DECISION for v2-native,
 * frozen as-is here because this file's whole purpose is exact reproduction).
 */
const PAGE_SAFETY_MARGIN_CHARS = 0.5;

export type LegacyColumnCount = 1 | 2;

export interface LegacyCapacityInputMm {
  paperWidthMm: number;
  paperHeightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  marginGutterMm: number;
  marginOuterMm: number;
  fontSizePt: number;
  lineHeightRatio: number;
  columnCount: LegacyColumnCount;
  columnGapMm: number;
  /**
   * Persisted PageSettings.charsPerLine/linesPerColumn target. 0 means
   * "auto" (Production's own `settings.charsPerLine > 0 ? ... : autoValue`
   * convention) — anything else is an explicit target, clamped to the
   * physical maximum exactly as computePageLayout does.
   */
  targetCharsPerLine: number;
  targetLinesPerColumn: number;
}

export interface LegacyCapacityResult {
  charsPerLine: number;
  linesPerColumn: number;
  /** charsPerLine's own pitch (== fontSizeMm), as ticks, for composer wiring. */
  fontSizeTick: GeometryTick;
  /** linesPerColumn's own pitch, as ticks, for composer wiring. */
  linePitchTick: GeometryTick;
  /** The per-column main-axis physical extent this result was clamped against, as ticks. */
  columnHeightTick: GeometryTick;
  /** The cross-axis physical extent this result was clamped against, as ticks. */
  textAreaWidthTick: GeometryTick;
}

function computeFontSizeMm(fontSizePt: number): number {
  return fontSizePt * MM_PER_PT;
}

function computeLinePitchMm(fontSizePt: number, lineHeightRatio: number): number {
  return computeFontSizeMm(fontSizePt) * lineHeightRatio;
}

function computeColumnHeightMm(
  paperHeightMm: number,
  marginTopMm: number,
  marginBottomMm: number,
  columnCount: LegacyColumnCount,
  columnGapMm: number
): number {
  const textAreaHeightMm = Math.max(paperHeightMm - marginTopMm - marginBottomMm, 0);
  return columnCount === 2 ? Math.max((textAreaHeightMm - columnGapMm) / 2, 0) : textAreaHeightMm;
}

function computeTextAreaWidthMm(
  paperWidthMm: number,
  marginGutterMm: number,
  marginOuterMm: number
): number {
  return Math.max(paperWidthMm - marginGutterMm - marginOuterMm, 0);
}

// AUTO-fallback charsPerLine: safety-margined, correctly per-column height.
function computeAutoCharsPerLine(
  columnHeightMm: number,
  fontSizeMm: number,
  columnCount: LegacyColumnCount
): number {
  const rawCharsPerLine =
    fontSizeMm > 0 ? Math.floor(columnHeightMm / fontSizeMm - PAGE_SAFETY_MARGIN_CHARS) : 0;
  return columnCount === 2
    ? Math.max(Math.floor(rawCharsPerLine) - 1, 1)
    : Math.max(Math.floor(rawCharsPerLine), 0);
}

// Explicit-target clamp: NOT safety-margined, and — verbatim Production
// quirk, deliberately preserved — checked against the FULL (undivided)
// text-area height even when columnCount===2. See this file's header comment
// and audit §3.2/§10 (A5 2段 case) for why this is a known inconsistency,
// not a bug introduced by this port.
function computeMaxCapacityChars(textAreaHeightMm: number, fontSizeMm: number): number {
  return fontSizeMm > 0 ? Math.floor(textAreaHeightMm / fontSizeMm) : 0;
}

// Used as BOTH the auto-fallback and the explicit-target clamp for
// linesPerColumn (Production has no safety margin on this axis at all —
// verbatim, not an oversight introduced here).
function computeAutoLinesPerColumn(
  textAreaWidthMm: number,
  linePitchMm: number
): number {
  if (linePitchMm <= 0) return 1;
  return Math.max(Math.floor(textAreaWidthMm / linePitchMm), 1);
}

export function deriveLegacyFrozenCapacity(input: LegacyCapacityInputMm): LegacyCapacityResult {
  const fontSizeMm = computeFontSizeMm(input.fontSizePt);
  const linePitchMm = computeLinePitchMm(input.fontSizePt, input.lineHeightRatio);

  const textAreaHeightMm = Math.max(input.paperHeightMm - input.marginTopMm - input.marginBottomMm, 0);
  const columnHeightMm = computeColumnHeightMm(
    input.paperHeightMm,
    input.marginTopMm,
    input.marginBottomMm,
    input.columnCount,
    input.columnGapMm
  );
  const textAreaWidthMm = computeTextAreaWidthMm(input.paperWidthMm, input.marginGutterMm, input.marginOuterMm);

  const autoCharsPerLine = computeAutoCharsPerLine(columnHeightMm, fontSizeMm, input.columnCount);
  const rawCharsPerLine = input.targetCharsPerLine > 0 ? input.targetCharsPerLine : autoCharsPerLine;
  const maxCapacityChars = computeMaxCapacityChars(textAreaHeightMm, fontSizeMm);
  const charsPerLine = Math.min(rawCharsPerLine, maxCapacityChars);

  const autoLinesPerColumn = computeAutoLinesPerColumn(textAreaWidthMm, linePitchMm);
  const targetLinesPerColumn =
    input.targetLinesPerColumn > 0 ? input.targetLinesPerColumn : autoLinesPerColumn;
  const linesPerColumn = Math.min(targetLinesPerColumn, autoLinesPerColumn);

  return {
    charsPerLine,
    linesPerColumn,
    fontSizeTick: mmToTicks(fontSizeMm),
    linePitchTick: mmToTicks(linePitchMm),
    columnHeightTick: mmToTicks(columnHeightMm),
    textAreaWidthTick: mmToTicks(textAreaWidthMm),
  };
}
