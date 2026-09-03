export type PaperSizeNombrePosition = "center" | "gutter" | "outer" | "hidden";

/**
 * 本文グリッドの字送り方式。
 *  - "justified"（既定・省略時）: 1文字スロットの縦幅 = 版面高 / charsPerLine。
 *    満杯行がちょうど地のラインまで届くよう、割り切れない余りを全スロットへ
 *    均等配分する（従来挙動）。charsPerLine が版面高を割り切らない用紙では
 *    字送りが 1em より僅かに広がる。
 *  - "solid": 1文字スロットの縦幅 = フォントサイズ（ベタ組み・1em固定）。
 *    余りは地側の余白として残す。字送りが用紙・charsPerLine に依存せず
 *    常に 1em の単一グリッドになる。
 */
export type PaperSizeGridMode = "justified" | "solid";

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
  /**
   * ノンブルの文字サイズ (pt)。TSP-LOOP-022 HUMAN-QA: preset ごとに明示。
   * 省略時は本文フォント -3pt / 最小6pt（recommendedNombreFontSizePt）へ
   * フォールバック。ユーザー手動変更後は保持（nombreLayoutCustomized）。
   */
  nombreFontSize?: number;
  /** 柱（ヘッダー）の文字サイズ (pt)。省略時は既定 8pt を維持。 */
  headerFontSize?: number;
  /** 本文グリッドの字送り方式。省略時は "justified"（従来挙動）。 */
  gridMode?: PaperSizeGridMode;
}

export interface PaperSizeConfig {
  name: string;
  width: number;      // 横幅 (mm)
  height: number;     // 縦幅 (mm)
  isPx?: boolean; // px単位フラグ（Web閲覧用等で使用）
  cols1: PaperSizeColumnProfile; // 1段組用の設定値
  cols2: PaperSizeColumnProfile; // 2段組用の設定値
}

export const PAPER_SIZE_TEMPLATES: Record<string, PaperSizeConfig> = {
  'A5': {
    name: 'A5',
    width: 148,
    height: 210,
    cols1: {
      marginTop: 18,
      marginBottom: 18,
      marginGutter: 20,
      marginOuter: 14,
      fontSizePt: 9.0,
      lineSpacing: 1.7,
      columnGap: 0,
      charsPerLine: 53,
      linesPerColumn: 22,
      nombrePosition: 'center',
      nombreDistance: 8,
      nombreFontSize: 8,
      // TSP-LOOP-003: A5 1段組は charsPerLine(53) が版面高(174mm)を割り切らず、
      // justified だと字送りが 1.03em に広がって本文が疎らに見える。ベタ組み
      // (1em 固定グリッド) に切り替え、余りは地側の余白として残す。A5 1段組限定。
      gridMode: 'solid',
    },
    cols2: {
      marginTop: 16,
      marginBottom: 16,
      marginGutter: 18,
      marginOuter: 14,
      fontSizePt: 8.5,
      lineSpacing: 1.65,
      columnGap: 8,
      charsPerLine: 25,
      linesPerColumn: 24,
      nombrePosition: 'center',
      nombreDistance: 8,
      nombreFontSize: 8,
    },
  },
  'B5': {
    name: 'B5',
    width: 182,
    height: 257,
    cols1: {
      marginTop: 20,
      marginBottom: 20,
      marginGutter: 22,
      marginOuter: 16,
      fontSizePt: 9.5,
      lineSpacing: 1.7,
      columnGap: 0,
      charsPerLine: 45,
      linesPerColumn: 26,
      nombrePosition: 'center',
      nombreDistance: 8,
      nombreFontSize: 8,
    },
    cols2: {
      marginTop: 18,
      marginBottom: 18,
      marginGutter: 20,
      marginOuter: 15,
      fontSizePt: 8.5,
      lineSpacing: 1.65,
      columnGap: 8,
      charsPerLine: 28,
      linesPerColumn: 28,
      nombrePosition: 'center',
      nombreDistance: 8,
      nombreFontSize: 8,
    },
  },
  'B6': {
    name: 'B6',
    width: 128,
    height: 182,
    cols1: {
      marginTop: 16,
      marginBottom: 16,
      marginGutter: 18,
      marginOuter: 12,
      fontSizePt: 9.0,
      lineSpacing: 1.7,
      columnGap: 0,
      charsPerLine: 40,
      linesPerColumn: 18,
      nombrePosition: 'center',
      nombreDistance: 7,
      nombreFontSize: 6,
    },
    cols2: {
      marginTop: 14,
      marginBottom: 14,
      marginGutter: 16,
      marginOuter: 12,
      fontSizePt: 8.0,
      lineSpacing: 1.65,
      columnGap: 6,
      charsPerLine: 22,
      linesPerColumn: 20,
      nombrePosition: 'center',
      nombreDistance: 7,
      nombreFontSize: 6,
    },
  },
  '新書': {
    name: '新書',
    width: 103,
    height: 182,
    cols1: {
      marginTop: 15,
      marginBottom: 15,
      marginGutter: 16,
      marginOuter: 11,
      fontSizePt: 8.5,
      lineSpacing: 1.7,
      columnGap: 0,
      charsPerLine: 40,
      linesPerColumn: 15,
      nombrePosition: 'center',
      nombreDistance: 7,
      nombreFontSize: 6,
    },
    cols2: {
      marginTop: 13,
      marginBottom: 13,
      marginGutter: 15,
      marginOuter: 10,
      fontSizePt: 7.5,
      lineSpacing: 1.65,
      columnGap: 6,
      charsPerLine: 22,
      linesPerColumn: 17,
      nombrePosition: 'center',
      nombreDistance: 7,
      nombreFontSize: 6,
    },
  },
  'A6': {
    name: 'A6',
    width: 105,
    height: 148,
    cols1: {
      marginTop: 14,
      marginBottom: 14,
      marginGutter: 15,
      marginOuter: 10,
      fontSizePt: 8.5,
      lineSpacing: 1.7,
      columnGap: 0,
      charsPerLine: 38,
      linesPerColumn: 16,
      nombrePosition: 'center',
      nombreDistance: 6,
    },
    cols2: {
      marginTop: 12,
      marginBottom: 12,
      marginGutter: 14,
      marginOuter: 10,
      fontSizePt: 7.5,
      lineSpacing: 1.65,
      columnGap: 6,
      charsPerLine: 20,
      linesPerColumn: 18,
      nombrePosition: 'center',
      nombreDistance: 6,
    },
  },
  '文庫': {
    name: '文庫',
    width: 105,
    height: 148,
    cols1: {
      marginTop: 14,
      marginBottom: 14,
      marginGutter: 15,
      marginOuter: 10,
      fontSizePt: 8.5,
      lineSpacing: 1.7,
      columnGap: 0,
      charsPerLine: 38,
      linesPerColumn: 16,
      nombrePosition: 'center',
      nombreDistance: 6,
      nombreFontSize: 5,
    },
    cols2: {
      marginTop: 12,
      marginBottom: 12,
      marginGutter: 14,
      marginOuter: 10,
      fontSizePt: 7.5,
      lineSpacing: 1.65,
      columnGap: 6,
      charsPerLine: 20,
      linesPerColumn: 18,
      nombrePosition: 'center',
      nombreDistance: 6,
      nombreFontSize: 5,
    },
  },
  'Web閲覧用': {
    name: 'Web閲覧用',
    width: 768,
    height: 1024,
    isPx: true,
    cols1: {
      marginTop: 40,
      marginBottom: 40,
      marginGutter: 20,
      marginOuter: 20,
      fontSizePt: 36,
      lineSpacing: 1.8,
      columnGap: 0,
      // charsPerLine/linesPerColumn は margin/font から calculateCapacityFromMargins()
      // で導出した値と一致させてある（PageSettingsPanel.tsx の
      // handlePaperSizeChange/handleColumnCountChange が実際に適用する際は
      // このderiveを都度やり直すため、この2値自体は実行時には使われない —
      // ただしテンプレート単体として見た時にmargin/fontと矛盾しないよう
      // 値を合わせておく）。
      charsPerLine: 29,
      linesPerColumn: 12,
      nombrePosition: 'center',
      nombreDistance: 8,
      nombreFontSize: 15,
      headerFontSize: 20,
    },
    cols2: {
      marginTop: 40,
      marginBottom: 20,
      marginGutter: 20,
      marginOuter: 20,
      fontSizePt: 32,
      lineSpacing: 1.75,
      columnGap: 10,
      // 同上: margin/fontから導出した値と一致させてある。
      charsPerLine: 16,
      linesPerColumn: 14,
      nombrePosition: 'center',
      nombreDistance: 8,
      nombreFontSize: 15,
      headerFontSize: 20,
    },
  },
};
