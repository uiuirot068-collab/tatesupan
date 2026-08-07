import { PAPER_SIZE_TEMPLATES } from "@/constants/paperSizes";

export type PaperSizeKey = keyof typeof PAPER_SIZE_TEMPLATES;

export interface PaperSize {
  label: string;
  widthMm: number;
  heightMm: number;
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

function resolvePaperSize(key: string): PaperSize {
  const template =
    PAPER_SIZE_TEMPLATES[key] ??
    PAPER_SIZE_TEMPLATES[LEGACY_PAPER_SIZE_KEY_MAP[key]] ??
    PAPER_SIZE_TEMPLATES["文庫"];
  return { label: template.name, widthMm: template.width, heightMm: template.height };
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
  autoAdjustEdge: boolean; // 小口余白を文字数・行数から自動調整するか
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
  autoAdjustEdge: true,
  masterPage: DEFAULT_MASTER_PAGE_SETTINGS,
  pageOverrides: {},
};

export const MM_PER_PT = 25.4 / 72;

/** Screen scale used to size preview page cards from millimeter values. */
export const PX_PER_MM = 2.2;

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
  const fontSizeMm = settings.fontSizePt * MM_PER_PT;
  const linePitchMm = fontSizeMm * settings.lineHeightRatio;

  const textAreaHeightMm = Math.max(
    paper.heightMm - settings.marginTop - settings.marginBottom,
    0
  );
  const textAreaWidthMm = Math.max(
    paper.widthMm - settings.marginGutter - settings.marginOuter,
    0
  );

  const columnCount = settings.columnCount;
  const columnGapMm = settings.columnGapMm;

  // 段組みでは天地方向の利用可能な高さも段数で分割される（段間の分だけ差し引く）。
  // これを考慮しないと、2段組で1行の長さ（縦書きの高さ方向）が1段組と同じまま
  // 計算されてしまい、1行の文字数が異常に多くなる。
  const columnHeightMm =
    columnCount === 2
      ? Math.max((textAreaHeightMm - columnGapMm) / 2, 0)
      : textAreaHeightMm;

  // Actual rendered glyph advance in the browser (font metrics, sub-pixel
  // rounding of the mm→px conversion, etc.) can run slightly ahead of the
  // nominal fontSizeMm/linePitchMm used here, so a character that this
  // floating-point math says "just barely" fits can in practice render past
  // the text box's bottom/inner edge and get clipped by `overflow: hidden`.
  // Reserving one character's worth of space before flooring guarantees a
  // full character of slack, so a boundary character is pushed to the next
  // line/page instead of being cut in half.
  const rawCharsPerLine =
    fontSizeMm > 0
      ? Math.floor(columnHeightMm / fontSizeMm - PAGE_SAFETY_MARGIN_CHARS)
      : 0;
  // 2段組は段間ギャップの丸め誤差やフォントメトリクスのブレが1段組より
  // 顕著に効くため、通常の PAGE_SAFETY_MARGIN_CHARS に加えて1文字分の
  // 追加マージンを設け、CSS の overflow: hidden による行末クリップを防ぐ。
  const charsPerLine =
    columnCount === 2
      ? Math.max(rawCharsPerLine - 1, 1)
      : Math.max(rawCharsPerLine, 0);

  // 縦書き2段組は上下スタック（上段・下段）であり、幅方向は段数で分割しない。
  // そのため linesPerColumn の算出には利用可能幅全体をそのまま使用する。
  const columnWidthMm = textAreaWidthMm;

  const linesPerColumn =
    linePitchMm > 0
      ? Math.max(Math.floor(columnWidthMm / linePitchMm - PAGE_SAFETY_MARGIN_CHARS), 1)
      : 1;
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
