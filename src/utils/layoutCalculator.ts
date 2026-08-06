'use client';

export interface CustomLayoutInput {
  paperWidth: number;       // 用紙幅 (mm)
  paperHeight: number;      // 用紙高さ (mm)
  marginTop: number;        // 天 (mm)
  marginBottom: number;     // 地 (mm)
  marginGutter: number;     // ノド (mm)
  fontSizePt: number;       // フォントサイズ (pt)
  charsPerLine: number;     // 1行の文字数
  linesPerColumn: number;   // 1段の行数
  columnsPerPage?: number;  // 段数 (1 or 2)
}

export interface CalculatedLayoutResult {
  marginEdge: number;       // 自動調整された小口余白 (mm)
  letterSpacingEm: number;  // 計算された字間 (em)
  lineHeightEm: number;     // 計算された行間 (em)
  printableWidth: number;   // 版面横幅 (mm)
  printableHeight: number;  // 版面縦幅 (mm)
}

/**
 * 指定された文字数・行数に合わせて版面および小口余白（marginEdge）を自動アライメント計算する
 */
export function calculateCustomLayout(
  input: CustomLayoutInput
): CalculatedLayoutResult {
  const {
    paperWidth,
    paperHeight,
    marginTop,
    marginBottom,
    marginGutter,
    fontSizePt,
    charsPerLine,
    linesPerColumn,
    columnsPerPage = 1,
  } = input;

  // pt から mm への変換 (1pt ≒ 0.352778mm)
  const fontSizeMm = fontSizePt * 0.352778;

  // 縦方向の利用可能高さ（天地余白を除いた高さ）
  const availableHeight = paperHeight - marginTop - marginBottom;

  // 縦書きの場合：高さ方向に文字が並ぶ
  // 1行の文字数に合わせて字間を考慮した版面高さを計算
  const printableHeight = Math.min(availableHeight, fontSizeMm * charsPerLine * 1.05);

  // 横方向の利用可能幅（ノド余白を除いた幅）
  const totalLines = linesPerColumn * columnsPerPage;
  // 行間を考慮した版面幅の概算
  const printableWidth = fontSizeMm * totalLines * 1.5;

  // 小口に合わせる（用紙幅 - ノド余白 - 計算された版面幅）
  const calculatedMarginEdge = Math.max(8, paperWidth - marginGutter - printableWidth);

  return {
    marginEdge: Math.round(calculatedMarginEdge * 10) / 10,
    letterSpacingEm: 0.05,
    lineHeightEm: 1.75,
    printableWidth: Math.round(printableWidth * 10) / 10,
    printableHeight: Math.round(printableHeight * 10) / 10,
  };
}
