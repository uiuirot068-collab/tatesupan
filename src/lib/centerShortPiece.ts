// SPN-XFIX-001: 短歌一首・短い詩などを、用紙の中央に置くための版面計算。
//
// 新しい永続フィールドは足さない。本文の量（いちばん長い行の字数・行数）に
// ぴったりの版面を「文字数・行数から設定する」モード（TSP-LOOP-031 の
// 版面の位置）で中央に置き、既存の天地・ノド・小口の4余白として書き戻す。
// 余白として保存されるので、プレビュー・JPG・PDF のどれでも同じ位置になる。
import { PAGE_BREAK_MARKER, countVisualLength, paragraphNeedsAutoIndent, stripBoutenNotation } from "./tategaki";
import { computePageLayout, type PageSettings } from "./pageLayout";
import { deriveFrameMargins, type TextFramePosition } from "./textFramePosition";

/** 1ページ（改ページで分けた一首・一篇）あたりの行数の上限。 */
export const CENTER_PIECE_MAX_LINES = 40;

export interface ShortPieceMeasure {
  /** いちばん長い行のマス数（自動の一字下げを含む）。 */
  longestLine: number;
  /** 行数（先頭・末尾の空行は数えない）。 */
  lineCount: number;
}

/**
 * 本文の行の長さと行数を数える。改ページで分けた一首・一篇ごとに数え、
 * いちばん長い行といちばん行数の多いページに合わせる。本文が空なら null。
 */
export function measureShortPiece(content: string): ShortPieceMeasure | null {
  let result: ShortPieceMeasure | null = null;
  for (const piece of content.split(PAGE_BREAK_MARKER)) {
    const measured = measureOnePiece(piece);
    if (!measured) continue;
    result = result
      ? { longestLine: Math.max(result.longestLine, measured.longestLine), lineCount: Math.max(result.lineCount, measured.lineCount) }
      : measured;
  }
  return result;
}

function measureOnePiece(content: string): ShortPieceMeasure | null {
  const rawLines = content.replace(/\r\n?/g, "\n").split("\n");
  let start = 0;
  let end = rawLines.length;
  while (start < end && rawLines[start].trim() === "") start++;
  while (end > start && rawLines[end - 1].trim() === "") end--;
  const lines = rawLines.slice(start, end);
  if (lines.length === 0) return null;
  let longestLine = 0;
  for (const line of lines) {
    const visible = stripBoutenNotation(line);
    const length = countVisualLength(visible);
    const indent = length > 0 && paragraphNeedsAutoIndent(firstVisibleChar(visible)) ? 1 : 0;
    longestLine = Math.max(longestLine, length + indent);
  }
  return { longestLine: Math.max(1, longestLine), lineCount: lines.length };
}

function firstVisibleChar(line: string): string {
  // ルビ記法の先頭「｜」は表示されないので、その次の文字で判定する。
  const trimmed = line.startsWith("｜") || line.startsWith("|") ? line.slice(1) : line;
  return trimmed.charAt(0);
}

export type CenterShortPieceResult =
  | { ok: true; settings: PageSettings; measure: ShortPieceMeasure }
  | { ok: false; reason: string };

/**
 * 本文を用紙の中央（縦方向・横方向は個別に選べる）に置いた設定を返す。
 * 中央にしない方向は、いまの天（上）・ノドの余白をそのまま基準にする。
 */
export function centerShortPiece(
  settings: PageSettings,
  content: string,
  options: { vertical: boolean; horizontal: boolean }
): CenterShortPieceResult {
  const measure = measureShortPiece(content);
  if (!measure) {
    return { ok: false, reason: "本文が空です。短歌や詩を入力してから押してください。" };
  }
  if (measure.lineCount > CENTER_PIECE_MAX_LINES) {
    return { ok: false, reason: "本文が長いため中央に置けません。一首・一篇ずつ改ページで分けた短い作品で使ってください。" };
  }
  if (settings.columnCount !== 1) {
    return { ok: false, reason: "1段組のときに使えます。段数を「1段」にしてから押してください。" };
  }
  const position: TextFramePosition = {
    vertical: options.vertical ? "center" : "top",
    horizontal: options.horizontal ? "center" : "gutter",
  };
  const derived = deriveFrameMargins({
    paperSize: settings.paperSize,
    fontSizePt: settings.fontSizePt,
    lineHeightRatio: settings.lineHeightRatio,
    columnCount: 1,
    columnGapMm: settings.columnGapMm,
    charsPerLine: measure.longestLine,
    linesPerColumn: measure.lineCount,
    position,
    verticalAnchorMargin: settings.marginTop,
    horizontalAnchorMargin: settings.marginGutter,
  });
  if (!derived.ok) {
    return {
      ok: false,
      reason: "この用紙・文字の大きさでは1ページに収まりません。フォントサイズを小さくするか、大きい用紙を選んでください。",
    };
  }
  const next: PageSettings = {
    ...settings,
    layoutMode: "capacity",
    marginTop: derived.marginTop,
    marginBottom: derived.marginBottom,
    marginGutter: derived.marginGutter,
    marginOuter: derived.marginOuter,
    charsPerLine: measure.longestLine,
    linesPerColumn: measure.lineCount,
  };
  const layout = computePageLayout(next);
  if (layout.charsPerLine < measure.longestLine || layout.linesPerColumn < measure.lineCount) {
    return {
      ok: false,
      reason: "この用紙・文字の大きさでは1ページに収まりません。フォントサイズを小さくするか、大きい用紙を選んでください。",
    };
  }
  return { ok: true, settings: { ...next, charsPerLine: layout.charsPerLine, linesPerColumn: layout.linesPerColumn }, measure };
}
