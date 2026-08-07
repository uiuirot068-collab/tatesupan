import { PAPER_SIZE_TEMPLATES } from "@/constants/paperSizes";

export type PaperSizeKey = keyof typeof PAPER_SIZE_TEMPLATES;

export interface PaperSize {
  label: string;
  widthMm: number;
  heightMm: number;
  /** True for presets (e.g. Web閲覧用) authored directly in screen pixels rather than physical mm. */
  isPx: boolean;
}

export const MM_PER_PT = 25.4 / 72;

/** Screen scale used to size preview page cards from millimeter values. */
export const PX_PER_MM = 2.2;

/**
 * `isPx` presets (e.g. Web閲覧用) author width/height/margins/font size
 * directly as target screen pixels. Every layout calculation elsewhere
 * works in mm and re-multiplies by PX_PER_MM (or the pt→mm ratio) at
 * render time, so those px-authored numbers are converted back to the
 * internal mm/pt unit here — otherwise they'd be scaled by PX_PER_MM a
 * second time and render far larger (and with a far smaller font) than
 * intended.
 */
export function pxToInternalMm(px: number): number {
  return px / PX_PER_MM;
}

export function pxToInternalFontSizePt(px: number): number {
  return px / PX_PER_MM / MM_PER_PT;
}

// 旧バージョンで使用していた用紙サイズキーとの互換マップ（保存済みデータの移行用）
const LEGACY_PAPER_SIZE_KEY_MAP: Record<string, PaperSizeKey> = {
  a5: "A5",
  b5: "B5",
  b6: "B6",
  shinsho: "新書",
  a6: "A6",
  bunko: "文庫",
};

export function resolvePaperSize(key: string): PaperSize {
  const template =
    PAPER_SIZE_TEMPLATES[key] ??
    PAPER_SIZE_TEMPLATES[LEGACY_PAPER_SIZE_KEY_MAP[key]] ??
    PAPER_SIZE_TEMPLATES["文庫"];
  const isPx = template.isPx === true;
  return {
    label: template.name,
    widthMm: isPx ? pxToInternalMm(template.width) : template.width,
    heightMm: isPx ? pxToInternalMm(template.height) : template.height,
    isPx,
  };
}

/** 段数（1段 / 2段組） */
export type ColumnCount = 1 | 2;

export interface PageSettings {
  paperSize: PaperSizeKey;
  marginTop: number; // 天 (mm)
  marginBottom: number; // 地 (mm)
  marginGutter: number; // ノド / 閉じ側 (mm)
  marginOuter: number; // 小口 / 外側 (mm)
  fontSizePt: number; // pt
  lineHeightRatio: number; // 行間倍率 (例: 1.6〜1.8)
  columnCount: ColumnCount; // 段数
  columnGapMm: number; // 段間 (mm)
  fontFamily: string; // 本文フォント
  charsPerLine: number; // 目標: 1行の文字数（小口自動調整の入力値）
  linesPerColumn: number; // 目標: 1段の行数（小口自動調整の入力値）
  layoutMode: "margin" | "capacity"; // 設定モード: 余白から設定 / 文字数・行数から設定
  masterPage: MasterPageSettings;
  // ページ番号（1始まり）ごとの個別設定の上書き
  pageOverrides: Record<number, PageOverride>;
}

/** 特定ページ単位でマスターページ設定を上書きする項目 */
export interface PageOverride {
  hideNombre?: boolean;
}

/** ノンブル（ページ番号）の表示位置: 中央 / ノド（綴じ側） / 小口（外側） / 非表示 */
export type NombrePosition = "center" | "gutter" | "outer" | "hidden";

/** 柱（ヘッダー/フッター）の表示位置 */
export type HashiraPosition = "top" | "bottom";

export interface MasterPageSettings {
  nombrePosition: NombrePosition;
  // 表紙・扉など先頭ページのノンブルを非表示にする
  hideNombreOnFirstPage: boolean;
  nombreStart: number;
  // 地（下端）からノンブルまでの距離 (mm)
  nombreBottomMargin: number;
  // 隠しノンブル: ノド側の断ち切り境界付近に薄く常時表示する
  showHiddenNombre: boolean;
  hashiraOdd: string; // 奇数ページ柱（例: 作品名）
  hashiraEven: string; // 偶数ページ柱（例: 章名）
  hashiraPosition: HashiraPosition;
  headerFontSize?: number; // 柱のフォントサイズ (pt, デフォルト: 8)
  nombreFontSize?: number; // ノンブルのフォントサイズ (pt, デフォルト: 8)
}

export const DEFAULT_MASTER_PAGE_SETTINGS: MasterPageSettings = {
  nombrePosition: "center",
  hideNombreOnFirstPage: false,
  nombreStart: 1,
  nombreBottomMargin: 8,
  showHiddenNombre: false,
  hashiraOdd: "",
  hashiraEven: "",
  hashiraPosition: "top",
  headerFontSize: 8,
  nombreFontSize: 8,
};

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  paperSize: "文庫",
  marginTop: 12,
  marginBottom: 12,
  marginGutter: 12,
  marginOuter: 10,
  fontSizePt: 9,
  lineHeightRatio: 1.7,
  columnCount: 1,
  columnGapMm: 8,
  fontFamily: "'Shippori Mincho', serif",
  charsPerLine: 40,
  linesPerColumn: 17,
  layoutMode: "capacity",
  masterPage: DEFAULT_MASTER_PAGE_SETTINGS,
  pageOverrides: {},
};

/** 印刷用の塗り足し幅（天地左右）。仕上がり線は用紙外形からこの分だけ内側。 */
export const BLEED_MM = 3;

/**
 * Safety buffer (in character cells) subtracted before flooring how many
 * characters/lines fit in the available space. Without it, floating-point
 * rounding and real font-metric drift can let a boundary character be
 * judged as "fits" when the browser actually renders it a hair past the
 * page edge, where `overflow: hidden` clips it in half instead of carrying
 * it to the next line/page.
 */
export const PAGE_SAFETY_MARGIN_CHARS = 0.5;

export function computeFontSizeMm(fontSizePt: number): number {
  return fontSizePt * MM_PER_PT;
}

export function computeLinePitchMm(fontSizePt: number, lineHeightRatio: number): number {
  return computeFontSizeMm(fontSizePt) * lineHeightRatio;
}

/** 天地余白から、1行（縦書きの縦方向）の長さの上限となる本文縦幅を算出する。 */
export function computeColumnHeightMm(
  paper: PaperSize,
  marginTop: number,
  marginBottom: number,
  columnCount: ColumnCount,
  columnGapMm: number
): number {
  const textAreaHeightMm = Math.max(paper.heightMm - marginTop - marginBottom, 0);
  return columnCount === 2
    ? Math.max((textAreaHeightMm - columnGapMm) / 2, 0)
    : textAreaHeightMm;
}

/** ノド・小口余白から、行が並ぶ横方向の本文幅を算出する。 */
export function computeTextAreaWidthMm(
  paper: PaperSize,
  marginGutter: number,
  marginOuter: number
): number {
  return Math.max(paper.widthMm - marginGutter - marginOuter, 0);
}

/**
 * 天地余白と字送りから、安全マージン（PAGE_SAFETY_MARGIN_CHARS）を
 * 考慮した1行あたりの最大文字数を算出する。
 */
export function computeAutoCharsPerLine(
  columnHeightMm: number,
  fontSizeMm: number,
  columnCount: ColumnCount
): number {
  const rawCharsPerLine =
    fontSizeMm > 0
      ? Math.floor(columnHeightMm / fontSizeMm - PAGE_SAFETY_MARGIN_CHARS)
      : 0;
  // 2段組は段間ギャップの丸め誤差やフォントメトリクスのブレが1段組より
  // 顕著に効くため、通常の PAGE_SAFETY_MARGIN_CHARS に加えて1文字分の
  // 追加マージンを設け、実描画時に文字が上段枠の下端を突き抜けるのを防ぐ。
  return columnCount === 2
    ? Math.max(Math.floor(rawCharsPerLine) - 1, 1)
    : Math.max(Math.floor(rawCharsPerLine), 0);
}

/** ノド・小口余白と行間から、1段に収まる行数を算出する。 */
export function computeAutoLinesPerColumn(
  textAreaWidthMm: number,
  linePitchMm: number,
  columnCount: ColumnCount
): number {
  if (linePitchMm <= 0) return 1;
  const rawLines = Math.floor(textAreaWidthMm / linePitchMm);
  return Math.max(rawLines, 1);
}

export interface PageLayout {
  paper: PaperSize;
  fontSizeMm: number;
  linePitchMm: number;
  textAreaWidthMm: number;
  textAreaHeightMm: number;
  charsPerLine: number;
  /** 段の幅 (mm)。段組みでテキスト領域の幅を段数と段間で分割した1段分。 */
  columnWidthMm: number;
  /** 1段あたりの行数 */
  linesPerColumn: number;
  /** 1段あたりの文字数 */
  charsPerColumn: number;
  /** 1ページの総行数（全段の合計） */
  linesPerPage: number;
  /** 1ページの総文字数（全段の合計） */
  charsPerPage: number;
}

/**
 * Vertical writing (縦書き) layout: a line runs top-to-bottom so its length
 * is bounded by the page height minus 天/地; lines then stack right-to-left
 * so their count is bounded by the page width minus ノド/小口. When the page
 * is split into multiple 段 (columns), that width is first divided evenly
 * across the columns (minus the 段間 gaps between them), and each column
 * independently stacks lines right-to-left within its own share of the width.
 */
export function computePageLayout(settings: PageSettings): PageLayout {
  const paper = resolvePaperSize(settings.paperSize);

  // isPx プリセットは fontSizePt・余白も画面ピクセルとして入力されるため、
  // 用紙幅・高さ（resolvePaperSize 側）と同じ基準（内部 mm/pt）に揃える。
  const effectiveFontSizePt = paper.isPx
    ? pxToInternalFontSizePt(settings.fontSizePt)
    : settings.fontSizePt;
  const effectiveMarginGutter = paper.isPx
    ? pxToInternalMm(settings.marginGutter)
    : settings.marginGutter;
  const effectiveMarginOuter = paper.isPx
    ? pxToInternalMm(settings.marginOuter)
    : settings.marginOuter;
  const effectiveMarginTop = paper.isPx
    ? pxToInternalMm(settings.marginTop)
    : settings.marginTop;
  const effectiveMarginBottom = paper.isPx
    ? pxToInternalMm(settings.marginBottom)
    : settings.marginBottom;

  const fontSizeMm = computeFontSizeMm(effectiveFontSizePt);
  const linePitchMm = computeLinePitchMm(effectiveFontSizePt, settings.lineHeightRatio);

  const textAreaWidthMm = computeTextAreaWidthMm(
    paper,
    effectiveMarginGutter,
    effectiveMarginOuter
  );
  const textAreaHeightMm = Math.max(
    paper.heightMm - effectiveMarginTop - effectiveMarginBottom,
    0
  );

  const columnCount = settings.columnCount;

  // 段組みでは天地方向の利用可能な高さも段数で分割される（段間の分だけ差し引く）。
  // これを考慮しないと、2段組で1行の長さ（縦書きの高さ方向）が1段組と同じまま
  // 計算されてしまい、1行の文字数が異常に多くなる。
  const columnHeightMm = computeColumnHeightMm(
    paper,
    effectiveMarginTop,
    effectiveMarginBottom,
    columnCount,
    settings.columnGapMm
  );

  // Actual rendered glyph advance in the browser (font metrics, sub-pixel
  // rounding of the mm→px conversion, etc.) can run slightly ahead of the
  // nominal fontSizeMm/linePitchMm used here, so a character that this
  // floating-point math says "just barely" fits can in practice render past
  // the text box's bottom/inner edge and get clipped by `overflow: hidden`.
  // Reserving one character's worth of space before flooring guarantees a
  // full character of slack, so a boundary character is pushed to the next
  // line/page instead of being cut in half.
  const autoCharsPerLine = computeAutoCharsPerLine(columnHeightMm, fontSizeMm, columnCount);
  const charsPerLine =
    settings.charsPerLine > 0 ? settings.charsPerLine : autoCharsPerLine;

  // 縦書き2段組は上下スタック（上段・下段）であり、幅方向は段数で分割しない。
  // そのため linesPerColumn の算出には利用可能幅全体をそのまま使用する。
  const columnWidthMm = textAreaWidthMm;

  const autoLinesPerColumn = computeAutoLinesPerColumn(columnWidthMm, linePitchMm, columnCount);
  const targetLinesPerColumn =
    settings.linesPerColumn > 0 ? settings.linesPerColumn : autoLinesPerColumn;
  const linesPerColumn = Math.min(targetLinesPerColumn, autoLinesPerColumn);
  const linesPerPage = linesPerColumn * columnCount;
  const charsPerColumn = charsPerLine * linesPerColumn;

  return {
    paper,
    fontSizeMm,
    linePitchMm,
    textAreaWidthMm,
    textAreaHeightMm,
    charsPerLine,
    columnWidthMm,
    linesPerColumn,
    charsPerColumn,
    linesPerPage,
    charsPerPage: charsPerLine * linesPerPage,
  };
}
