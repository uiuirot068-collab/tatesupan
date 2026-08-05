export type PaperSizeKey = "a5" | "b5" | "shinsho" | "a6" | "bunko";

export interface PaperSize {
  label: string;
  widthMm: number;
  heightMm: number;
}

export const PAPER_SIZES: Record<PaperSizeKey, PaperSize> = {
  a5: { label: "A5", widthMm: 148, heightMm: 210 },
  b5: { label: "B5", widthMm: 182, heightMm: 257 },
  shinsho: { label: "新書", widthMm: 103, heightMm: 182 },
  a6: { label: "A6", widthMm: 105, heightMm: 148 },
  bunko: { label: "文庫", widthMm: 105, heightMm: 148 },
};

export interface PageSettings {
  paperSize: PaperSizeKey;
  marginTop: number; // 天 (mm)
  marginBottom: number; // 地 (mm)
  marginGutter: number; // ノド / 閉じ側 (mm)
  marginOuter: number; // 小口 / 外側 (mm)
  fontSizePt: number; // pt
  lineHeightRatio: number; // 行間倍率 (例: 1.6〜1.8)
  masterPage: MasterPageSettings;
}

/** ノンブル（ページ番号）の表示位置 */
export type NombrePosition = "center" | "outer" | "hidden";

/** 柱（ヘッダー/フッター）の表示位置 */
export type HashiraPosition = "top" | "bottom";

export interface MasterPageSettings {
  nombrePosition: NombrePosition;
  // 表紙・扉など先頭ページのノンブルを非表示にする
  hideNombreOnFirstPage: boolean;
  nombreStart: number;
  hashiraOdd: string; // 奇数ページ柱（例: 作品名）
  hashiraEven: string; // 偶数ページ柱（例: 章名）
  hashiraPosition: HashiraPosition;
}

export const DEFAULT_MASTER_PAGE_SETTINGS: MasterPageSettings = {
  nombrePosition: "center",
  hideNombreOnFirstPage: false,
  nombreStart: 1,
  hashiraOdd: "",
  hashiraEven: "",
  hashiraPosition: "top",
};

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  paperSize: "bunko",
  marginTop: 12,
  marginBottom: 12,
  marginGutter: 12,
  marginOuter: 10,
  fontSizePt: 9,
  lineHeightRatio: 1.7,
  masterPage: DEFAULT_MASTER_PAGE_SETTINGS,
};

export const MM_PER_PT = 25.4 / 72;

/** Screen scale used to size preview page cards from millimeter values. */
export const PX_PER_MM = 2.2;

export interface PageLayout {
  paper: PaperSize;
  fontSizeMm: number;
  linePitchMm: number;
  textAreaWidthMm: number;
  textAreaHeightMm: number;
  charsPerLine: number;
  linesPerPage: number;
  charsPerPage: number;
}

/**
 * Vertical writing (縦書き) layout: a line runs top-to-bottom so its length
 * is bounded by the page height minus 天/地; lines then stack right-to-left
 * so their count is bounded by the page width minus ノド/小口.
 */
export function computePageLayout(settings: PageSettings): PageLayout {
  const paper = PAPER_SIZES[settings.paperSize];
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

  const charsPerLine =
    fontSizeMm > 0 ? Math.floor(textAreaHeightMm / fontSizeMm) : 0;
  const linesPerPage =
    linePitchMm > 0 ? Math.floor(textAreaWidthMm / linePitchMm) : 0;

  return {
    paper,
    fontSizeMm,
    linePitchMm,
    textAreaWidthMm,
    textAreaHeightMm,
    charsPerLine,
    linesPerPage,
    charsPerPage: charsPerLine * linesPerPage,
  };
}
