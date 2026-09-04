import { PAPER_SIZE_TEMPLATES } from "@/constants/paperSizes";
import { createDefaultColophonSettings, type ColophonSettings } from "./colophon";

export type PaperSizeKey = keyof typeof PAPER_SIZE_TEMPLATES;

export interface PaperSize {
  label: string;
  widthMm: number;
  heightMm: number;
  /** True for presets (e.g. Web閲覧用) authored directly in screen pixels rather than physical mm. */
  isPx: boolean;
  /**
   * Raw px-authored outer width/height (e.g. 768/1024 for Web閲覧用), present
   * only when isPx. widthMm/heightMm above are scaled by the preview-only
   * PX_PER_MM constant, not a real DPI, so physical-size exports (PDF page
   * format) must derive from these via cssPxToPhysicalMm instead.
   */
  widthPx?: number;
  heightPx?: number;
}

export const MM_PER_PT = 25.4 / 72;

/** Screen scale used to size preview page cards from millimeter values. */
export const PX_PER_MM = 2.2;

/**
 * `isPx` presets (e.g. Web閲覧用) author their outer page *width/height*
 * directly as target screen pixels (e.g. 768×1024). Every other layout
 * calculation works in mm and re-multiplies by PX_PER_MM at render time, so
 * those two px-authored dimensions are converted back to the internal mm
 * unit here — this is the *only* place that conversion happens.
 *
 * Everything else on `PageSettings` (marginTop/Bottom/Gutter/Outer,
 * fontSizePt) is always canonical mm/pt, isPx or not — it must never be
 * treated as px and converted a second time here or anywhere downstream,
 * or it renders far larger (and re-derives a font size that's wrong) than
 * the value the user actually set.
 */
export function pxToInternalMm(px: number): number {
  return px / PX_PER_MM;
}

export function pxToInternalFontSizePt(px: number): number {
  return px / PX_PER_MM / MM_PER_PT;
}

/**
 * Real-world 96dpi CSS-px↔mm conversion — distinct from PX_PER_MM (a
 * preview render-scale constant, not a physical DPI). Used only when an
 * isPx page's outer px dimensions need a genuine physical size, e.g. a PDF
 * page format for Web閲覧用.
 */
const CSS_PX_PER_MM_96DPI = 96 / 25.4;

export function cssPxToPhysicalMm(px: number): number {
  return px / CSS_PX_PER_MM_96DPI;
}

/** 正式仕様の固定解像度（ユーザーが変更するUIは設けない）。 */
export const PDF_EXPORT_DPI = 600;

/**
 * 印刷用紙JPG（JPG/JPG一括/JPG ZIP共通）の正式仕様: dpiではなく、
 * アスペクト比を維持したまま長辺をこのpx数へ固定する。
 * Web閲覧用（isPxプリセット）はこの定数の対象外——canonicalな
 * px外形（768×1024等）をpixelRatio=1でそのまま出力する。
 */
export const PRINT_JPG_LONG_SIDE_PX = 1600;

/**
 * captureWidthPx/captureHeightPxは、html-to-imageのpixelRatioへ渡す前の
 * canonical CSS px寸法（＝実際にcaptureするexport surfaceの素の大きさ）。
 * ここで返すpixelRatioをそのままcapturePageToCanvasへ渡せば、
 * 最終bitmapの長辺がPRINT_JPG_LONG_SIDE_PXになる——二重にscaleしない
 * よう、呼び出し側はこの戻り値をそのままpixelRatioとして使うこと。
 */
export function computePrintJpgPixelRatio(captureWidthPx: number, captureHeightPx: number): number {
  const longSidePx = Math.max(captureWidthPx, captureHeightPx);
  return longSidePx > 0 ? PRINT_JPG_LONG_SIDE_PX / longSidePx : 1;
}

/**
 * 印刷用紙preset（mmベース）のページは、DOM上ではPX_PER_MMという
 * プレビュー専用の縮尺（実dpiではない）で描画されている。そのため
 * html-to-imageのpixelRatioへそのままdpi数値を渡しても物理解像度には
 * ならない——ページの物理サイズ(mm)に対して「dpi相当のpx数」を
 * 得るには、まずPX_PER_MMで割って実寸mmに戻し、そこから
 * 25.4mm/inchで割ったinch数にdpiを掛けた値を、DOM描画時のcanonical
 * px数（= mm × PX_PER_MM）で割り戻してpixelRatioを逆算する必要がある。
 * mm項がpixelRatio・canonical px双方で相殺されるため、結果はページの
 * 実寸に依存しない単一の係数になる: dpi / (PX_PER_MM × 25.4)。
 *
 * isPx preset（Web閲覧用）はこの関数の対象外——canonicalなpx外形
 * （768×1024等）をpixelRatio=1でそのまま出力する。
 */
export function pixelRatioForDpi(dpi: number): number {
  return dpi / (PX_PER_MM * 25.4);
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
    widthPx: isPx ? template.width : undefined,
    heightPx: isPx ? template.height : undefined,
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
  // TSP-LOOP-005: 本文とは独立した横書き専用の奥付ページ設定。本文文字列
  // （content）・ページ分割・改ページ位置には一切影響しない（enabled=true の
  // ときのみ、pagePosition が指す位置＝本文の指定ページ後 or 作品末尾へ
  // 1ページ差し込まれる）。旧ドキュメントは db.ts / useEditorSettings 側の
  // normalizeColophonSettings 経由で既定値へフォールバックする。
  colophon: ColophonSettings;
}

/** 特定ページ単位でマスターページ設定を上書きする項目 */
export interface PageOverride {
  hideNombre?: boolean;
  hideHashira?: boolean;
  // 未指定(undefined)=奇数/偶数の共通柱を使用。空文字列は「柱を消す」ではなく
  // 「空の柱文字列を明示指定」を意味する（消したい場合は hideHashira を使う）。
  hashiraOverride?: string;
}

/**
 * `pageNumbers` の各ページに対して `updater` を適用し、結果を新しい
 * pageOverrides マップとして返す（`overrides` 自体は変更しない）。
 * 各ページのオーバーライドは、有効な項目が1つも残らなくなった時点で
 * マップからキーごと削除する——「キーが存在しない = 何も上書きしていない
 * （常にマスター設定へフォールバック）」という既存の hideNombre の慣例を、
 * 複数フィールドが共存する場合にも保つため。
 */
export function updatePageOverrides(
  overrides: Record<number, PageOverride>,
  pageNumbers: number[],
  updater: (prev: PageOverride) => PageOverride
): Record<number, PageOverride> {
  const next = { ...overrides };
  for (const pageNumber of pageNumbers) {
    const updated = updater(next[pageNumber] ?? {});
    const cleaned: PageOverride = {};
    if (updated.hideNombre) cleaned.hideNombre = true;
    if (updated.hideHashira) cleaned.hideHashira = true;
    if (updated.hashiraOverride !== undefined) cleaned.hashiraOverride = updated.hashiraOverride;
    if (Object.keys(cleaned).length > 0) {
      next[pageNumber] = cleaned;
    } else {
      delete next[pageNumber];
    }
  }
  return next;
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
  // ノンブルのフォントサイズ (pt)。推奨デフォルトは本文フォント -3pt / 最小6pt
  // （recommendedNombreFontSizePt。TSP-LOOP-021 §4）。手動変更後は保持される。
  nombreFontSize?: number;
  // ノンブル（ページ番号）のフォント。"" = 本文と同じ（既定）。それ以外は
  // FONT_FAMILY_OPTIONS の CSS font-family 文字列。位置・サイズ・組版には
  // 一切影響しない（見た目の書体だけ）。
  nombreFontFamily?: string;
  // TSP-LOOP-021 §7C: ユーザーがノンブルの位置・サイズを手動で変更したか。
  // 省略(undefined)/false = 未カスタム → 用紙サイズ preset を切り替えると、
  // その preset 推奨のノンブル位置・距離・サイズが自動で追従する。
  // true = カスタム済み → preset を切り替えてもユーザーの指定を維持する
  // （上書きしない）。旧レコードはキーが無く false 扱い（後方互換）。
  nombreLayoutCustomized?: boolean;
}

/**
 * TSP-LOOP-021 §4: recommended default page-number size — body font size
 * minus 3pt, never below 6pt (e.g. 10pt→7, 9pt→6, 8pt→6). Applied only to a
 * layout the user has NOT customised (see MasterPageSettings.nombreLayoutCustomized);
 * a manual choice is always preserved, including across a paper-preset switch.
 */
export function recommendedNombreFontSizePt(bodyFontSizePt: number): number {
  return Math.max(6, Math.round(bodyFontSizePt - 3));
}

export const DEFAULT_MASTER_PAGE_SETTINGS: MasterPageSettings = {
  nombrePosition: "center",
  hideNombreOnFirstPage: false,
  nombreStart: 1,
  // 文庫（既定用紙）1段組の推奨ノンブル距離と一致させる（TSP-LOOP-021 §7B）。
  // 以前の 8mm は既定の地余白 12mm と近く、中央ノンブルが本文最終行へ
  // 迫って見えていた。
  nombreBottomMargin: 6,
  showHiddenNombre: false,
  hashiraOdd: "",
  hashiraEven: "",
  hashiraPosition: "top",
  headerFontSize: 8,
  // 文庫（既定用紙）の preset 値。TSP-LOOP-022 HUMAN-QA で 6pt → 5pt。
  nombreFontSize: 5,
  nombreFontFamily: "", // 本文と同じ（既存ドキュメントも含め既定はこれ）
  nombreLayoutCustomized: false,
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
  // TSP-LOOP-029 issue C: self-consistent with the geometry above — 文庫
  // (105×148) minus 天地12 at 9pt holds 39 lines-of-characters, minus ノド12/
  // 小口10 at line-height 1.7 holds 15 columns. `computePageLayout` used to
  // clamp the old 40/17 targets down to these while the Settings panel kept
  // showing 40/17, disagreeing with the Preview status ("39字×15行").
  charsPerLine: 39,
  linesPerColumn: 15,
  layoutMode: "capacity",
  masterPage: DEFAULT_MASTER_PAGE_SETTINGS,
  pageOverrides: {},
  colophon: createDefaultColophonSettings(),
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

/**
 * TSP-LOOP-031: floating-point slack added on top of the exact boundary a
 * required-size formula solves for, so 1-decimal margin rounding downstream
 * can never eat back into the space a target 文字数・行数 needs. Deliberately
 * larger than PAGE_SAFETY_MARGIN_CHARS's own epsilon (0.001) — that one only
 * guards a single floor() boundary, this one also has to survive a later
 * mm-value round-trip through display rounding.
 */
const REQUIRED_FRAME_SIZE_EPSILON_MM = 0.01;

/**
 * TSP-LOOP-031: exact inverse of the *actual* clamp `computePageLayout` uses
 * for a positive (non-auto) `settings.charsPerLine` target — `maxCapacityChars
 * = Math.floor(textAreaHeightMm / fontSizeMm)`, checked against the FULL
 * 天地 text-area height, not the per-column height, and with no
 * PAGE_SAFETY_MARGIN_CHARS subtraction. (That safety-margined, per-column
 * `computeAutoCharsPerLine` formula is a different code path — it only feeds
 * the *fallback* value used when `charsPerLine` is 0/auto, not the cap
 * applied to a target the user actually typed.) DEFAULT_PAGE_SETTINGS itself
 * (文庫, 39字) only clears the `maxCapacityChars` gate, not the stricter one —
 * confirmed by `computePageLayout(DEFAULT_PAGE_SETTINGS).charsPerLine === 39`
 * — so mirroring the safety-margined formula here would derive a frame
 * visibly larger (and free margin visibly smaller) than what's already
 * shipped and verified. See MATH CONTRACT §4: use the existing calc as
 * source of truth, don't invent a stricter one.
 */
export function computeRequiredTextAreaHeightMm(
  charsPerLine: number,
  fontSizeMm: number
): number {
  return charsPerLine * fontSizeMm + REQUIRED_FRAME_SIZE_EPSILON_MM;
}

/**
 * TSP-LOOP-031: exact inverse of `computeAutoLinesPerColumn` — which, for a
 * positive (non-auto) `settings.linesPerColumn` target, is ALSO the real
 * clamp `computePageLayout` applies (not just the auto-fallback value), and
 * already carries no PAGE_SAFETY_MARGIN_CHARS term and no columnCount
 * dependency (縦書きの段組みは天地方向のスタックで、幅方向は段数の影響を
 * 受けない — computeAutoLinesPerColumn's own unused `columnCount` parameter
 * confirms this).
 */
export function computeRequiredTextAreaWidthMm(
  linesPerColumn: number,
  linePitchMm: number
): number {
  return linesPerColumn * linePitchMm + REQUIRED_FRAME_SIZE_EPSILON_MM;
}

/**
 * TSP-LOOP-031B: the actual clamp `computePageLayout` applies to a positive
 * (non-auto) `settings.charsPerLine` target — extracted out of
 * `computePageLayout` so a second call site (余白から設定するモードの
 * 「最大」算出, see `deriveMaxCapacityFromMargins`) can call the exact same
 * formula instead of re-deriving it and risking the kind of ~1.5mm drift
 * TSP-031 already caught once. Deliberately unchanged from the inline
 * expression this replaces: checked against the FULL 天地 text-area height
 * (not the per-column height — see computeRequiredTextAreaHeightMm's own
 * comment for why that's the established, already-verified clamp dimension),
 * no PAGE_SAFETY_MARGIN_CHARS subtraction.
 */
export function computeMaxCapacityChars(textAreaHeightMm: number, fontSizeMm: number): number {
  return fontSizeMm > 0 ? Math.floor(textAreaHeightMm / fontSizeMm) : 0;
}

export interface PageLayout {
  paper: PaperSize;
  fontSizeMm: number;
  linePitchMm: number;
  textAreaWidthMm: number;
  textAreaHeightMm: number;
  charsPerLine: number;
  /** 1行（縦書きの1本）の高さ (mm)。段組みでは天地方向を段数で分割した1段分。 */
  columnHeightMm: number;
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

  // settings.marginTop/Bottom/Gutter/Outer と fontSizePt は、用紙が isPx
  // （Web閲覧用など）かどうかに関わらず常に mm / pt のcanonical値。isPxで
  // 変換が必要なのは用紙の外形（width/height）だけで、それは
  // resolvePaperSize() 側で既に完結している——ここで再度 px→mm/pt 変換を
  // 行うと二重変換になり、意図した値より大きく描画されてしまう。
  const fontSizeMm = computeFontSizeMm(settings.fontSizePt);
  const linePitchMm = computeLinePitchMm(settings.fontSizePt, settings.lineHeightRatio);

  const textAreaWidthMm = computeTextAreaWidthMm(
    paper,
    settings.marginGutter,
    settings.marginOuter
  );
  const textAreaHeightMm = Math.max(
    paper.heightMm - settings.marginTop - settings.marginBottom,
    0
  );

  const columnCount = settings.columnCount;

  // 段組みでは天地方向の利用可能な高さも段数で分割される（段間の分だけ差し引く）。
  // これを考慮しないと、2段組で1行の長さ（縦書きの高さ方向）が1段組と同じまま
  // 計算されてしまい、1行の文字数が異常に多くなる。
  const columnHeightMm = computeColumnHeightMm(
    paper,
    settings.marginTop,
    settings.marginBottom,
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
  const rawCharsPerLine =
    settings.charsPerLine > 0 ? settings.charsPerLine : autoCharsPerLine;
  const maxCapacityChars = computeMaxCapacityChars(textAreaHeightMm, fontSizeMm);
  const charsPerLine = Math.min(rawCharsPerLine, maxCapacityChars);

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
    columnHeightMm,
    columnWidthMm,
    linesPerColumn,
    charsPerColumn,
    linesPerPage,
    charsPerPage: charsPerLine * linesPerPage,
  };
}

export interface MaxCapacityFromMarginsInput {
  paperSize: PaperSizeKey;
  marginTop: number;
  marginBottom: number;
  marginGutter: number;
  marginOuter: number;
  fontSizePt: number;
  lineHeightRatio: number;
  columnCount: ColumnCount;
  columnGapMm: number;
}

export interface MaxCapacityFromMarginsResult {
  charsPerLine: number;
  linesPerColumn: number;
  /** charsPerLine * linesPerColumn * columnCount — display-only, see §11: never feed into pagination. */
  maxBodyCharsPerPage: number;
}

/**
 * TSP-LOOP-031B: 余白から設定するモード用 —— 現在の余白・タイポグラフィが
 * 実際に保持できる最大の charsPerLine / linesPerColumn を算出する。
 *
 * MATH CONTRACT: 新しい式を発明せず、`computePageLayout` が明示的な
 * （0/autoでない）ターゲットに対して実際に適用するclampをそのまま呼ぶ——
 * charsPerLine は computeMaxCapacityChars（computePageLayout 内で使われる
 * のと同一関数）、linesPerColumn は computeAutoLinesPerColumn（同関数が
 * auto-fallbackと明示ターゲットclampの両方に使われることは pageLayout.ts
 * 内の computeRequiredTextAreaWidthMm のコメントで確認済み）。
 * これにより、ここで返した値をそのまま settings.charsPerLine /
 * linesPerColumn へ書き戻して computePageLayout に渡しても、追加の
 * clamp/downshiftは一切発生しない（derived value + 1 は逆に必ず
 * clampされ、これが「maximum」の証明になる）。
 */
export function deriveMaxCapacityFromMargins(
  input: MaxCapacityFromMarginsInput
): MaxCapacityFromMarginsResult {
  const paper = resolvePaperSize(input.paperSize);
  const fontSizeMm = computeFontSizeMm(input.fontSizePt);
  const linePitchMm = computeLinePitchMm(input.fontSizePt, input.lineHeightRatio);

  const textAreaWidthMm = computeTextAreaWidthMm(paper, input.marginGutter, input.marginOuter);
  const textAreaHeightMm = Math.max(paper.heightMm - input.marginTop - input.marginBottom, 0);

  const charsPerLine = computeMaxCapacityChars(textAreaHeightMm, fontSizeMm);
  const linesPerColumn = computeAutoLinesPerColumn(textAreaWidthMm, linePitchMm, input.columnCount);

  return {
    charsPerLine,
    linesPerColumn,
    maxBodyCharsPerPage: charsPerLine * linesPerColumn * input.columnCount,
  };
}
