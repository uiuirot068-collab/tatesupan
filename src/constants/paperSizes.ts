export type PaperSizeNombrePosition = "center" | "gutter" | "outer" | "hidden";

/** 段数（1段組 / 2段組）ごとに異なる版面パラメータ一式 */
export interface PaperSizeColumnProfile {
  marginTop: number;    // 天 (mm)
  marginBottom: number; // 地 (mm)
  marginGutter: number; // ノド (mm)
  marginOuter: number;  // 小口 (mm)
  fontSizePt: number;   // フォントサイズ (pt)
  lineSpacing: number;  // 行間倍率
  columnGap: number;    // 段間 (mm)
  charsPerLine: number; // 1行の文字数
  linesPerColumn: number; // 1段の行数
  nombrePosition: PaperSizeNombrePosition; // ノンブル表示位置
  nombreDistance: number; // ノンブル: 地からの距離 (mm)
}

export interface PaperSizeConfig {
  name: string;
  width: number;      // 横幅 (mm)
  height: number;     // 縦幅 (mm)
  cols1: PaperSizeColumnProfile; // 1段組用の設定値
  cols2: PaperSizeColumnProfile; // 2段組用の設定値
}

export const PAPER_SIZE_TEMPLATES: Record<string, PaperSizeConfig> = {
  'Web閲覧用': {
    name: 'Web閲覧用',
    width: 148,
    height: 210,
    cols1: {
      marginTop: 15,
      marginBottom: 25,
      marginGutter: 15,
      marginOuter: 15,
      fontSizePt: 15.0,
      lineSpacing: 1.7,
      columnGap: 0,
      charsPerLine: 40,
      linesPerColumn: 13,
      nombrePosition: 'center',
      nombreDistance: 8,
    },
    cols2: {
      marginTop: 15,
      marginBottom: 25,
      marginGutter: 15,
      marginOuter: 15,
      fontSizePt: 12.0,
      lineSpacing: 1.7,
      columnGap: 10,
      charsPerLine: 20,
      linesPerColumn: 22,
      nombrePosition: 'center',
      nombreDistance: 8,
    },
  },
  'A5': {
    name: 'A5',
    width: 148,
    height: 210,
    cols1: {
      marginTop: 18,
      marginBottom: 18,
      marginGutter: 20,
      marginOuter: 12,
      fontSizePt: 9.5,
      lineSpacing: 1.7,
      columnGap: 0,
      charsPerLine: 40,
      linesPerColumn: 17,
      nombrePosition: 'center',
      nombreDistance: 8,
    },
    cols2: {
      marginTop: 18,
      marginBottom: 18,
      marginGutter: 20,
      marginOuter: 12,
      fontSizePt: 8.5,
      lineSpacing: 1.7,
      columnGap: 7,
      charsPerLine: 22,
      linesPerColumn: 28,
      nombrePosition: 'center',
      nombreDistance: 8,
    },
  },
  'B5': {
    name: 'B5',
    width: 182,
    height: 257,
    cols1: {
      marginTop: 22,
      marginBottom: 22,
      marginGutter: 24,
      marginOuter: 15,
      fontSizePt: 10.0,
      lineSpacing: 1.7,
      columnGap: 0,
      charsPerLine: 42,
      linesPerColumn: 20,
      nombrePosition: 'center',
      nombreDistance: 8,
    },
    cols2: {
      marginTop: 20,
      marginBottom: 20,
      marginGutter: 22,
      marginOuter: 14,
      fontSizePt: 9.0,
      lineSpacing: 1.7,
      columnGap: 8,
      charsPerLine: 25,
      linesPerColumn: 32,
      nombrePosition: 'center',
      nombreDistance: 8,
    },
  },
  'B6': {
    name: 'B6',
    width: 128,
    height: 182,
    cols1: {
      marginTop: 15,
      marginBottom: 15,
      marginGutter: 18,
      marginOuter: 10,
      fontSizePt: 9.0,
      lineSpacing: 1.7,
      columnGap: 0,
      charsPerLine: 38,
      linesPerColumn: 16,
      nombrePosition: 'center',
      nombreDistance: 7,
    },
    cols2: {
      marginTop: 14,
      marginBottom: 14,
      marginGutter: 16,
      marginOuter: 10,
      fontSizePt: 8.5,
      lineSpacing: 1.65,
      columnGap: 6,
      charsPerLine: 20,
      linesPerColumn: 24,
      nombrePosition: 'center',
      nombreDistance: 7,
    },
  },
  '新書': {
    name: '新書',
    width: 103,
    height: 182,
    cols1: {
      marginTop: 14,
      marginBottom: 14,
      marginGutter: 16,
      marginOuter: 9,
      fontSizePt: 9.0,
      lineSpacing: 1.7,
      columnGap: 0,
      charsPerLine: 36,
      linesPerColumn: 15,
      nombrePosition: 'center',
      nombreDistance: 7,
    },
    cols2: {
      marginTop: 13,
      marginBottom: 13,
      marginGutter: 15,
      marginOuter: 9,
      fontSizePt: 8.5,
      lineSpacing: 1.65,
      columnGap: 6,
      charsPerLine: 18,
      linesPerColumn: 24,
      nombrePosition: 'center',
      nombreDistance: 7,
    },
  },
  'A6': {
    name: 'A6',
    width: 105,
    height: 148,
    cols1: {
      marginTop: 12,
      marginBottom: 12,
      marginGutter: 15,
      marginOuter: 8,
      fontSizePt: 9.0,
      lineSpacing: 1.65,
      columnGap: 0,
      charsPerLine: 32,
      linesPerColumn: 14,
      nombrePosition: 'center',
      nombreDistance: 6,
    },
    cols2: {
      marginTop: 12,
      marginBottom: 12,
      marginGutter: 14,
      marginOuter: 8,
      fontSizePt: 8.0,
      lineSpacing: 1.6,
      columnGap: 5,
      charsPerLine: 16,
      linesPerColumn: 20,
      nombrePosition: 'center',
      nombreDistance: 6,
    },
  },
  '文庫': {
    name: '文庫',
    width: 105,
    height: 148,
    cols1: {
      marginTop: 12,
      marginBottom: 12,
      marginGutter: 15,
      marginOuter: 8,
      fontSizePt: 9.0,
      lineSpacing: 1.65,
      columnGap: 0,
      charsPerLine: 32,
      linesPerColumn: 14,
      nombrePosition: 'center',
      nombreDistance: 6,
    },
    cols2: {
      marginTop: 12,
      marginBottom: 12,
      marginGutter: 14,
      marginOuter: 8,
      fontSizePt: 8.0,
      lineSpacing: 1.6,
      columnGap: 5,
      charsPerLine: 16,
      linesPerColumn: 20,
      nombrePosition: 'center',
      nombreDistance: 6,
    },
  },
};
