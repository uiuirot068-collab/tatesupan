// TSP-LOOP-031: 「文字数・行数から設定する」モード専用の版面配置ヘルパー。
//
// 責務は1つだけ——既に確定した版面サイズ（1行の文字数・1段の行数から導かれる
// frameVertical/frameHorizontal）を、ページ内のどこに置くかを TateSpun独自の
// 3×3「版面の位置」セレクタから天地・ノド・小口の4余白へ変換すること。
// 版面サイズそのものの算出（文字数→mm 変換の安全マージン等）は一切ここで
// 再発明せず、pageLayout.ts の computeRequiredColumnHeightMm /
// computeRequiredTextAreaWidthMm / computeRequiredTextAreaHeightMm を
// そのまま呼ぶ——同じ式を使うことで、ここで算出した4余白を実際の
// computePageLayout() に渡したときに指定した文字数・行数と実描画が
// 食い違わないことを保証する（TSP-029 issue C と同じ設計原則）。
//
// 新しい永続フィールドは追加しない。TextFramePosition / anchorMargin は
// UI-derived な一時状態であり、Apply時にのみ既存の marginTop/Bottom/
// Gutter/Outer（canonical persisted result）へ書き戻す。
import {
  computeFontSizeMm,
  computeLinePitchMm,
  computeRequiredTextAreaHeightMm,
  computeRequiredTextAreaWidthMm,
  resolvePaperSize,
  type ColumnCount,
  type PaperSizeKey,
} from "./pageLayout";

/** 縦軸（天地方向）の版面位置アンカー。 */
export type VerticalAnchor = "top" | "center" | "bottom";
/** 横軸（ノド・小口方向）の版面位置アンカー。 */
export type HorizontalAnchor = "gutter" | "center" | "outer";

export interface TextFramePosition {
  vertical: VerticalAnchor;
  horizontal: HorizontalAnchor;
}

export const CENTER_POSITION: TextFramePosition = { vertical: "center", horizontal: "center" };

export const VERTICAL_ANCHORS: readonly VerticalAnchor[] = ["top", "center", "bottom"];
export const HORIZONTAL_ANCHORS: readonly HorizontalAnchor[] = ["gutter", "center", "outer"];

export const VERTICAL_ANCHOR_LABELS: Record<VerticalAnchor, string> = {
  top: "天",
  center: "中央",
  bottom: "地",
};
export const HORIZONTAL_ANCHOR_LABELS: Record<HorizontalAnchor, string> = {
  gutter: "ノド",
  center: "中央",
  outer: "小口",
};

/** 「天寄せ」「ノド寄せ×天寄せ」等、選択中の位置を表す短いラベルを組み立てる。 */
export function positionLabel(position: TextFramePosition): string {
  const v = VERTICAL_ANCHOR_LABELS[position.vertical];
  const h = HORIZONTAL_ANCHOR_LABELS[position.horizontal];
  if (position.vertical === "center" && position.horizontal === "center") return "中央";
  if (position.vertical === "center") return h;
  if (position.horizontal === "center") return v;
  return `${v}×${h}`;
}

export function positionsEqual(a: TextFramePosition, b: TextFramePosition): boolean {
  return a.vertical === b.vertical && a.horizontal === b.horizontal;
}

/**
 * 既存 MarginField（天/地/ノド/小口の直接入力）が課している下限と同じ値。
 * 監査: `src/components/PageSettingsPanel.tsx` の `MarginField` は
 * `min={0}` のみで、それ以外の product-level 最小値は存在しない。
 */
export const MIN_ANCHOR_MARGIN_MM = 0;

export interface DeriveFrameMarginsInput {
  paperSize: PaperSizeKey;
  fontSizePt: number;
  lineHeightRatio: number;
  columnCount: ColumnCount;
  /**
   * columnCount/columnGapMm は PageSettings 形状との整合のために受け取るが、
   * 版面サイズの算出には使わない——正の（auto=0でない）charsPerLine /
   * linesPerColumn ターゲットに対して computePageLayout 自身が課す実際の
   * clamp は、縦・横どちらもページ全体のtext areaに対して判定しており、
   * 段（column）単位の分割は関与しない（pageLayout.ts の
   * computeRequiredTextAreaHeightMm / computeRequiredTextAreaWidthMm 側の
   * コメントで検証済み）。将来 computePageLayout 側のclamp仕様が段数を
   * 考慮するよう変わった場合に備え、呼び出し側のシグネチャは変えずに済むよう
   * ここに残してある。
   */
  columnGapMm: number;
  /** 1行の文字数（ターゲット値。effective grid ではなく draft の目標値でよい） */
  charsPerLine: number;
  /** 1段の行数（同上） */
  linesPerColumn: number;
  position: TextFramePosition;
  /** position.vertical が "center" のときは無視される。 */
  verticalAnchorMargin: number;
  /** position.horizontal が "center" のときは無視される。 */
  horizontalAnchorMargin: number;
}

export interface DerivedFrameMargins {
  marginTop: number;
  marginBottom: number;
  marginGutter: number;
  marginOuter: number;
  /** 版面の縦方向の長さ (mm) — 天地余白を引く前の paper.heightMm から算出。 */
  frameVerticalMm: number;
  /** 版面の横方向の幅 (mm)。 */
  frameHorizontalMm: number;
  /** 天地に配分できる残り空間 (mm)。 */
  freeVerticalMm: number;
  /** ノド・小口に配分できる残り空間 (mm)。 */
  freeHorizontalMm: number;
}

export type DeriveFrameMarginsResult =
  | ({ ok: true } & DerivedFrameMargins)
  | { ok: false; reason: string };

// 表示用の丸め値を内部計算へ戻すことは絶対にしない（round-trip drift 禁止、
// MATH CONTRACT §4.1）——ここでの丸めは浮動小数点の表示ノイズ
// （例: 18.399999999999995）を消すだけの目的で、REQUIRED_FRAME_SIZE_EPSILON_MM
// （0.01mm）より一桁小さい精度に留め、版面が収まらなくなることはない。
const roundMm = (value: number): number => Math.round(value * 1000) / 1000;

/**
 * 「文字数・行数から設定する」モード用の中核計算。既に確定した版面サイズ
 * （charsPerLine × linesPerColumn, フォント・行間・段組みから算出）を
 * 3×3位置アンカーに従ってページ内に配置し、天地・ノド・小口の4余白を返す。
 *
 * `ok: false` の場合、呼び出し側は既存のどの余白も書き換えてはならない
 * （§5 INVALID STATE CONTRACT — Apply不可・無音clamp禁止）。
 */
export function deriveFrameMargins(input: DeriveFrameMarginsInput): DeriveFrameMarginsResult {
  const paper = resolvePaperSize(input.paperSize);
  const fontSizeMm = computeFontSizeMm(input.fontSizePt);
  const linePitchMm = computeLinePitchMm(input.fontSizePt, input.lineHeightRatio);

  const frameVerticalMm = computeRequiredTextAreaHeightMm(input.charsPerLine, fontSizeMm);
  const frameHorizontalMm = computeRequiredTextAreaWidthMm(input.linesPerColumn, linePitchMm);

  const freeVerticalMm = paper.heightMm - frameVerticalMm;
  const freeHorizontalMm = paper.widthMm - frameHorizontalMm;

  if (freeVerticalMm < 0) {
    return {
      ok: false,
      reason: `1行 ${input.charsPerLine} 字は、この用紙サイズ・フォントサイズでは天地に収まりません。文字数を減らすかフォントサイズを見直してください。`,
    };
  }
  if (freeHorizontalMm < 0) {
    return {
      ok: false,
      reason: `1段 ${input.linesPerColumn} 行は、この用紙サイズ・フォントサイズではノド・小口に収まりません。行数を減らすか段数・段間を見直してください。`,
    };
  }

  if (input.position.vertical !== "center") {
    if (!Number.isFinite(input.verticalAnchorMargin) || input.verticalAnchorMargin < MIN_ANCHOR_MARGIN_MM) {
      return { ok: false, reason: `${VERTICAL_ANCHOR_LABELS[input.position.vertical]}の余白は0mm以上の値を指定してください。` };
    }
    if (input.verticalAnchorMargin > freeVerticalMm) {
      return {
        ok: false,
        reason: `${VERTICAL_ANCHOR_LABELS[input.position.vertical]}の余白が、天地に配分できる空き ${roundMm(freeVerticalMm).toFixed(1)}mm を超えています。値を小さくしてください。`,
      };
    }
  }
  if (input.position.horizontal !== "center") {
    if (!Number.isFinite(input.horizontalAnchorMargin) || input.horizontalAnchorMargin < MIN_ANCHOR_MARGIN_MM) {
      return { ok: false, reason: `${HORIZONTAL_ANCHOR_LABELS[input.position.horizontal]}の余白は0mm以上の値を指定してください。` };
    }
    if (input.horizontalAnchorMargin > freeHorizontalMm) {
      return {
        ok: false,
        reason: `${HORIZONTAL_ANCHOR_LABELS[input.position.horizontal]}の余白が、ノド・小口に配分できる空き ${roundMm(freeHorizontalMm).toFixed(1)}mm を超えています。値を小さくしてください。`,
      };
    }
  }

  let marginTop: number;
  let marginBottom: number;
  if (input.position.vertical === "top") {
    marginTop = input.verticalAnchorMargin;
    marginBottom = roundMm(freeVerticalMm - input.verticalAnchorMargin);
  } else if (input.position.vertical === "bottom") {
    marginBottom = input.verticalAnchorMargin;
    marginTop = roundMm(freeVerticalMm - input.verticalAnchorMargin);
  } else {
    marginTop = roundMm(freeVerticalMm / 2);
    marginBottom = marginTop;
  }

  let marginGutter: number;
  let marginOuter: number;
  if (input.position.horizontal === "gutter") {
    marginGutter = input.horizontalAnchorMargin;
    marginOuter = roundMm(freeHorizontalMm - input.horizontalAnchorMargin);
  } else if (input.position.horizontal === "outer") {
    marginOuter = input.horizontalAnchorMargin;
    marginGutter = roundMm(freeHorizontalMm - input.horizontalAnchorMargin);
  } else {
    marginGutter = roundMm(freeHorizontalMm / 2);
    marginOuter = marginGutter;
  }

  return {
    ok: true,
    marginTop,
    marginBottom,
    marginGutter,
    marginOuter,
    frameVerticalMm,
    frameHorizontalMm,
    freeVerticalMm,
    freeHorizontalMm,
  };
}

/**
 * 既存4余白（mm精度: MarginField step=0.5mm, marginOuter自動計算は1桁mm丸め
 * `Math.floor(x*10)/10`）に対して十分な余裕を持たせた同値判定のしきい値。
 * これより差が小さければ「意図的に均等」とみなし中央寄せと推定する。
 */
export const POSITION_INFERENCE_EPSILON_MM = 0.1;

export interface InferredPosition {
  position: TextFramePosition;
  verticalAnchorMargin: number;
  horizontalAnchorMargin: number;
}

/**
 * §6.1 EXISTING DOCUMENT COMPATIBILITY: 既存4余白から最も自然な「版面の位置」
 * を推定する。画面を開いただけでは settings を一切書き換えない
 * （呼び出し側は戻り値をローカルUI stateの初期値として使うだけに留めること）。
 */
export function inferPositionFromMargins(margins: {
  marginTop: number;
  marginBottom: number;
  marginGutter: number;
  marginOuter: number;
}): InferredPosition {
  const { marginTop, marginBottom, marginGutter, marginOuter } = margins;

  let vertical: VerticalAnchor;
  if (Math.abs(marginTop - marginBottom) <= POSITION_INFERENCE_EPSILON_MM) {
    vertical = "center";
  } else if (marginTop < marginBottom) {
    vertical = "top";
  } else {
    vertical = "bottom";
  }

  let horizontal: HorizontalAnchor;
  if (Math.abs(marginGutter - marginOuter) <= POSITION_INFERENCE_EPSILON_MM) {
    horizontal = "center";
  } else if (marginGutter < marginOuter) {
    horizontal = "gutter";
  } else {
    horizontal = "outer";
  }

  return {
    position: { vertical, horizontal },
    verticalAnchorMargin: Math.min(marginTop, marginBottom),
    horizontalAnchorMargin: Math.min(marginGutter, marginOuter),
  };
}
