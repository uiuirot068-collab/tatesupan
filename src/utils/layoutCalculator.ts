'use client';

import {
  MM_PER_PT,
  PAGE_SAFETY_MARGIN_CHARS,
  computeAutoCharsPerLine,
  computeAutoLinesPerColumn,
  computeColumnHeightMm,
  computeFontSizeMm,
  computeLinePitchMm,
  computeTextAreaWidthMm,
  resolvePaperSize,
  type ColumnCount,
  type PaperSizeKey,
} from "@/lib/pageLayout";

export interface CustomLayoutInput {
  paperWidth: number;       // 用紙幅 (mm)
  marginGutter: number;     // ノド (mm)
  fontSizePt: number;       // フォントサイズ (pt)
  lineHeightRatio: number;  // 行間倍率
  linesPerColumn: number;   // 1段の行数
  columnsPerPage?: number;  // 段数 (1 or 2)
  columnGapMm?: number;     // 段間 (mm)
}

export interface CalculatedLayoutResult {
  marginEdge: number; // 自動調整された小口余白 (mm)
}

/**
 * 指定された1段の行数（linesPerColumn）に収まるよう、小口余白
 * （marginEdge）を自動アライメント計算する。
 *
 * 縦書きでは1行（縦の文字列）が横方向に並ぶため、行数を収める版面幅は
 * ノド・小口余白（横軸）で決まる — `computePageLayout` の
 * `linesPerColumn = floor(columnWidthMm / linePitchMm - PAGE_SAFETY_MARGIN_CHARS)`
 * を、指定の行数がちょうど収まる最小の版面幅について解いた式を用いる。
 * 同じ定数・同じ行間倍率で解くことで、ここで計算した marginEdge を
 * 実際のプレビュー描画（`computePageLayout`）に渡したときに、指定した
 * linesPerColumn と実際に描画される行数が一致することを保証する。
 */
export function calculateCustomLayout(
  input: CustomLayoutInput
): CalculatedLayoutResult {
  const {
    paperWidth,
    marginGutter,
    fontSizePt,
    lineHeightRatio,
    linesPerColumn,
    columnsPerPage = 1,
    columnGapMm = 0,
  } = input;

  const fontSizeMm = fontSizePt * MM_PER_PT;
  const linePitchMm = fontSizeMm * lineHeightRatio;

  // Smallest column width whose computePageLayout floor(...) yields exactly
  // `linesPerColumn`; a hair of epsilon guards the exact boundary against
  // floating-point rounding landing one line short.
  const columnWidthMm = (linesPerColumn + PAGE_SAFETY_MARGIN_CHARS) * linePitchMm + 0.001;
  const textAreaWidthMm = columnWidthMm * columnsPerPage + columnGapMm * (columnsPerPage - 1);

  const calculatedMarginEdge = Math.max(
    0,
    paperWidth - marginGutter - textAreaWidthMm
  );

  // Rounded down (never up) so the resulting textAreaWidthMm never shrinks
  // below what's needed for `linesPerColumn` to still fit.
  return {
    marginEdge: Math.floor(calculatedMarginEdge * 10) / 10,
  };
}

export interface MarginModeCapacityInput {
  paperSize: PaperSizeKey;
  marginTop: number;     // 天 (mm)
  marginBottom: number;  // 地 (mm)
  marginGutter: number;  // ノド (mm)
  marginOuter: number;   // 小口 (mm)
  fontSizePt: number;    // フォントサイズ (pt)
  lineHeightRatio: number; // 行間倍率
  columnCount: ColumnCount; // 段数 (1 or 2)
  columnGapMm: number;   // 段間 (mm)
}

export interface MarginModeCapacityResult {
  charsPerLine: number;   // 1行の文字数
  linesPerColumn: number; // 1段の行数
}

/**
 * layoutMode === "margin"（余白から設定する）用: 天地・ノド・小口の
 * 余白とフォントサイズから、その枠に収まる1行の文字数・1段の行数を
 * 逆算する。`computePageLayout` の autoCharsPerLine / autoLinesPerColumn
 * と同じ式を使うことで、ここで算出した値をそのまま settings に反映しても
 * 実際のプレビュー描画とズレない。
 */
export function calculateCapacityFromMargins(
  input: MarginModeCapacityInput
): MarginModeCapacityResult {
  const paper = resolvePaperSize(input.paperSize);
  const fontSizeMm = computeFontSizeMm(input.fontSizePt);
  const linePitchMm = computeLinePitchMm(input.fontSizePt, input.lineHeightRatio);

  const columnHeightMm = computeColumnHeightMm(
    paper,
    input.marginTop,
    input.marginBottom,
    input.columnCount,
    input.columnGapMm
  );
  const textAreaWidthMm = computeTextAreaWidthMm(paper, input.marginGutter, input.marginOuter);

  return {
    charsPerLine: computeAutoCharsPerLine(columnHeightMm, fontSizeMm, input.columnCount),
    linesPerColumn: computeAutoLinesPerColumn(textAreaWidthMm, linePitchMm),
  };
}
