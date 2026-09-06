// V2-NATIVE capacity derivation — P3-O12-C, formula version "v2-1".
//
// Corrected geometry→capacity derivation per Core Contract §18/§19/§21 and
// INV-004/INV-009/INV-013, informed by the exact defects the P3-O12 audit
// found in Production's legacy formula (capacityLegacyFrozen.ts):
//
//  - GeometryTick-integer throughout (Contract §21/INV-013) — mm inputs are
//    converted to ticks ONCE, at the top of `deriveV2NativeCapacity`; no
//    further floating-point mm arithmetic occurs.
//  - Per-character advance comes from a supplied `MeasurementFacts` bundle
//    (Contract §17/§18), not a hardcoded pt→mm constant — this is what makes
//    the formula "MeasurementFacts-compatible": a different font/provider
//    can yield a different capacity without this file changing.
//  - The main-axis (chars-per-line) ceiling is ALWAYS computed against the
//    per-column physical height, for both columnCount 1 and 2. This is the
//    deliberate fix for the audit's §3.2/§10 finding: Production's
//    `computeMaxCapacityChars` checks the FULL (undivided) 天地 height even
//    for a 2-column page, which is physically wrong (verified ~2x over-
//    capacity for A5 2段, audit §10). capacityLegacyFrozen.ts intentionally
//    preserves that bug for existing documents; this file must never
//    reintroduce it.
//  - No PAGE_SAFETY_MARGIN_CHARS-style empirical fudge factor. Per INV-009,
//    a renderer's own measurement/clipping compensation must never become
//    Core-canonical arithmetic — if a real renderer needs slack, that is
//    this file's caller's (Renderer boundary's) concern, not this formula's.
//  - No stretch-to-fill: capacity is a ceiling (Contract §19), residual
//    space on both axes is computed and returned, never redistributed as
//    extra inter-character spacing (INV-004 — this is exactly the
//    `gridMode: "justified"` behavior the audit's §8/§9 flagged as MUST NOT
//    PORT).

import { mmToTicks, type GeometryTick } from "../geometry/tick";
import type { MeasurementFacts } from "../measurement/facts";

export type V2ColumnCount = 1 | 2;

export interface V2NativeCapacityInputMm {
  paperWidthMm: number;
  paperHeightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  marginGutterMm: number;
  marginOuterMm: number;
  bodyFontRef: string;
  bodyFontSizePt: number;
  lineHeightRatio: number;
  columnCount: V2ColumnCount;
  columnGapMm: number;
}

export interface V2NativeCapacityResult {
  charsPerLine: number;
  linesPerColumn: number;
  /** Natural per-character advance (main-axis pitch), from MeasurementFacts. */
  advanceTick: GeometryTick;
  /** Cross-axis pitch: advance × lineHeightRatio, rounded to the nearest tick. */
  linePitchTick: GeometryTick;
  /** Per-column main-axis physical extent this result was clamped against. */
  columnHeightTick: GeometryTick;
  /** Cross-axis physical extent this result was clamped against. */
  textAreaWidthTick: GeometryTick;
  /** Main-axis space left after charsPerLine*advanceTick — reported, never absorbed (INV-004). */
  residualMainAxisTick: GeometryTick;
  /** Cross-axis space left after linesPerColumn*linePitchTick — reported, never absorbed (INV-004). */
  residualCrossAxisTick: GeometryTick;
}

// A representative full-width CJK character used only to ask MeasurementFacts
// for "the" natural advance at this font+size — Natural Pitch's own premise
// (Contract §18) is that this advance is uniform per declared font+size, so
// which representative character is asked does not change the answer for any
// conforming MeasurementFacts provider (see fakeProvider.ts, which ignores
// the character argument entirely for exactly this reason).
const CAPACITY_PROBE_CHAR = "字";

export function deriveV2NativeCapacity(
  input: V2NativeCapacityInputMm,
  measurement: MeasurementFacts
): V2NativeCapacityResult {
  const paperWidthTick = mmToTicks(input.paperWidthMm);
  const paperHeightTick = mmToTicks(input.paperHeightMm);
  const marginTopTick = mmToTicks(input.marginTopMm);
  const marginBottomTick = mmToTicks(input.marginBottomMm);
  const marginGutterTick = mmToTicks(input.marginGutterMm);
  const marginOuterTick = mmToTicks(input.marginOuterMm);
  const columnGapTick = mmToTicks(input.columnGapMm);

  const advanceTick = measurement.naturalAdvanceTick(
    input.bodyFontRef,
    input.bodyFontSizePt,
    CAPACITY_PROBE_CHAR
  );
  const linePitchTick = Math.round(advanceTick * input.lineHeightRatio);

  const textAreaHeightTick = Math.max(paperHeightTick - marginTopTick - marginBottomTick, 0);
  // Per-column height, ALWAYS — for columnCount 1 this equals textAreaHeightTick;
  // for columnCount 2 it is the undivided height minus the gap, split in two.
  // Unlike the legacy formula's explicit-target clamp, there is no second,
  // full-height code path here (see file header).
  const columnHeightTick =
    input.columnCount === 2
      ? Math.max(Math.floor((textAreaHeightTick - columnGapTick) / 2), 0)
      : textAreaHeightTick;

  const textAreaWidthTick = Math.max(paperWidthTick - marginGutterTick - marginOuterTick, 0);

  const charsPerLine = advanceTick > 0 ? Math.floor(columnHeightTick / advanceTick) : 0;
  const linesPerColumn = linePitchTick > 0 ? Math.floor(textAreaWidthTick / linePitchTick) : 0;

  return {
    charsPerLine,
    linesPerColumn,
    advanceTick,
    linePitchTick,
    columnHeightTick,
    textAreaWidthTick,
    residualMainAxisTick: columnHeightTick - charsPerLine * advanceTick,
    residualCrossAxisTick: textAreaWidthTick - linesPerColumn * linePitchTick,
  };
}
