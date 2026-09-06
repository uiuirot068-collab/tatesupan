// TEST-FIXTURE-ONLY geometry for the 8 mandatory presets — P3-O12-C.
//
// These mm values are a literal transcription of `src/constants/paperSizes.ts`
// (PAPER_SIZE_TEMPLATES cols1/cols2), hand-verified against the live
// Production formula in
// typesetting-v2/qa/research/P3_O12_CAPACITY_GEOMETRY_AUDIT.md §6/§10.
// This file does NOT import from src/ (Core has zero src/ dependency, per
// CORE_MODULE_MAP.md) — the numbers are copied, not referenced, and must be
// re-verified by hand if `src/constants/paperSizes.ts` ever changes.
//
// Not exported from core/index.ts — this is test-only fixture data, not part
// of the public Core surface.

import type { LegacyCapacityInputMm } from "./capacityLegacyFrozen";
import type { V2NativeCapacityInputMm } from "./capacityV2Native";

export interface PresetGeometryFixtureMm {
  name: string;
  paperWidthMm: number;
  paperHeightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  marginGutterMm: number;
  marginOuterMm: number;
  fontSizePt: number;
  lineHeightRatio: number;
  columnCount: 1 | 2;
  columnGapMm: number;
}

const WEB_WIDTH_MM = 768 / 2.2; // PX_PER_MM=2.2, src/constants/paperSizes.ts pxToInternalMm
const WEB_HEIGHT_MM = 1024 / 2.2;

// 16 entries: 8 mandatory presets x {1段, 2段}, matching PAPER_SIZE_TEMPLATES exactly.
export const PRODUCTION_PRESET_FIXTURES_MM: readonly PresetGeometryFixtureMm[] = [
  { name: "文庫 1段", paperWidthMm: 105, paperHeightMm: 148, marginTopMm: 14, marginBottomMm: 14, marginGutterMm: 15, marginOuterMm: 10, fontSizePt: 8.5, lineHeightRatio: 1.7, columnCount: 1, columnGapMm: 0 },
  { name: "文庫 2段", paperWidthMm: 105, paperHeightMm: 148, marginTopMm: 12, marginBottomMm: 12, marginGutterMm: 14, marginOuterMm: 10, fontSizePt: 7.5, lineHeightRatio: 1.65, columnCount: 2, columnGapMm: 6 },
  { name: "A5 1段", paperWidthMm: 148, paperHeightMm: 210, marginTopMm: 18, marginBottomMm: 18, marginGutterMm: 20, marginOuterMm: 14, fontSizePt: 9.0, lineHeightRatio: 1.7, columnCount: 1, columnGapMm: 0 },
  { name: "A5 2段", paperWidthMm: 148, paperHeightMm: 210, marginTopMm: 16, marginBottomMm: 16, marginGutterMm: 18, marginOuterMm: 14, fontSizePt: 8.5, lineHeightRatio: 1.65, columnCount: 2, columnGapMm: 8 },
  { name: "B5 1段", paperWidthMm: 182, paperHeightMm: 257, marginTopMm: 20, marginBottomMm: 20, marginGutterMm: 22, marginOuterMm: 16, fontSizePt: 9.5, lineHeightRatio: 1.7, columnCount: 1, columnGapMm: 0 },
  { name: "B5 2段", paperWidthMm: 182, paperHeightMm: 257, marginTopMm: 18, marginBottomMm: 18, marginGutterMm: 20, marginOuterMm: 15, fontSizePt: 8.5, lineHeightRatio: 1.65, columnCount: 2, columnGapMm: 8 },
  { name: "B6 1段", paperWidthMm: 128, paperHeightMm: 182, marginTopMm: 16, marginBottomMm: 16, marginGutterMm: 18, marginOuterMm: 12, fontSizePt: 9.0, lineHeightRatio: 1.7, columnCount: 1, columnGapMm: 0 },
  { name: "B6 2段", paperWidthMm: 128, paperHeightMm: 182, marginTopMm: 14, marginBottomMm: 14, marginGutterMm: 16, marginOuterMm: 12, fontSizePt: 8.0, lineHeightRatio: 1.65, columnCount: 2, columnGapMm: 6 },
  { name: "新書 1段", paperWidthMm: 103, paperHeightMm: 182, marginTopMm: 15, marginBottomMm: 15, marginGutterMm: 16, marginOuterMm: 11, fontSizePt: 8.5, lineHeightRatio: 1.7, columnCount: 1, columnGapMm: 0 },
  { name: "新書 2段", paperWidthMm: 103, paperHeightMm: 182, marginTopMm: 13, marginBottomMm: 13, marginGutterMm: 15, marginOuterMm: 10, fontSizePt: 7.5, lineHeightRatio: 1.65, columnCount: 2, columnGapMm: 6 },
  { name: "A6 1段", paperWidthMm: 105, paperHeightMm: 148, marginTopMm: 14, marginBottomMm: 14, marginGutterMm: 15, marginOuterMm: 10, fontSizePt: 8.5, lineHeightRatio: 1.7, columnCount: 1, columnGapMm: 0 },
  { name: "A6 2段", paperWidthMm: 105, paperHeightMm: 148, marginTopMm: 12, marginBottomMm: 12, marginGutterMm: 14, marginOuterMm: 10, fontSizePt: 7.5, lineHeightRatio: 1.65, columnCount: 2, columnGapMm: 6 },
  { name: "Web閲覧用 1段", paperWidthMm: WEB_WIDTH_MM, paperHeightMm: WEB_HEIGHT_MM, marginTopMm: 40, marginBottomMm: 40, marginGutterMm: 20, marginOuterMm: 20, fontSizePt: 36, lineHeightRatio: 1.8, columnCount: 1, columnGapMm: 0 },
  { name: "Web閲覧用 2段", paperWidthMm: WEB_WIDTH_MM, paperHeightMm: WEB_HEIGHT_MM, marginTopMm: 40, marginBottomMm: 20, marginGutterMm: 20, marginOuterMm: 20, fontSizePt: 32, lineHeightRatio: 1.75, columnCount: 2, columnGapMm: 10 },
];

export function toLegacyInputMm(
  fixture: PresetGeometryFixtureMm,
  target: { charsPerLine?: number; linesPerColumn?: number } = {}
): LegacyCapacityInputMm {
  return {
    paperWidthMm: fixture.paperWidthMm,
    paperHeightMm: fixture.paperHeightMm,
    marginTopMm: fixture.marginTopMm,
    marginBottomMm: fixture.marginBottomMm,
    marginGutterMm: fixture.marginGutterMm,
    marginOuterMm: fixture.marginOuterMm,
    fontSizePt: fixture.fontSizePt,
    lineHeightRatio: fixture.lineHeightRatio,
    columnCount: fixture.columnCount,
    columnGapMm: fixture.columnGapMm,
    targetCharsPerLine: target.charsPerLine ?? 0,
    targetLinesPerColumn: target.linesPerColumn ?? 0,
  };
}

export function toV2InputMm(
  fixture: PresetGeometryFixtureMm,
  bodyFontRef = "body"
): V2NativeCapacityInputMm {
  return {
    paperWidthMm: fixture.paperWidthMm,
    paperHeightMm: fixture.paperHeightMm,
    marginTopMm: fixture.marginTopMm,
    marginBottomMm: fixture.marginBottomMm,
    marginGutterMm: fixture.marginGutterMm,
    marginOuterMm: fixture.marginOuterMm,
    bodyFontRef,
    bodyFontSizePt: fixture.fontSizePt,
    lineHeightRatio: fixture.lineHeightRatio,
    columnCount: fixture.columnCount,
    columnGapMm: fixture.columnGapMm,
  };
}
