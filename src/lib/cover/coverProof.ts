/**
 * CST-PORT-013: 確認用PDF（表紙＋本文＋裏表紙）の約束（COLUMNSTAND の
 * 書き出し画面「確認用PDF」の移植）。
 *
 * 読む順に1冊のPDFへまとめる: 表紙 → 本文（奥付があれば奥付まで）→ 裏表紙。
 * 背表紙はページとして入れない。反映していない面は飛ばす（止めない）。
 * 表紙は表紙の書き出しと同じ描画（coverPaint → coverCanvas）で画像にし、
 * 本文と同じ大きさのページに「塗り足し込みの面」として置く。仕上がりPDFでは
 * 外側3mmがページの外に出て切れ、塗り足し込みPDFではそのまま全部が入る。
 * 本文のページはふだんのPDFと同じもの（グレー）、表紙はカラーのまま。
 */
import type { PaintPagePlan } from "../../../typesetting-v2/renderer/publication/pdfGenerator";
import type { CoverFaceSide, CoverSettings } from "./coverModel";

export const COVER_PROOF_LABEL = "確認用PDF（表紙＋本文＋裏表紙）";
export const COVER_PROOF_HINT = "読む順に1冊のPDFへ。背表紙はページとして入りません。印刷入稿用ではありません。";

/** 確認用PDFで選べる出力（トンボ付きの入稿用は出さない）。 */
export type CoverProofPdfMode = "trim" | "bleed";

/** 確認用PDFの保存名は、ふだんの名前の後ろに `_proof` を付ける（CST と同じ）。 */
export function coverProofFileStem(stem: string): string {
  return `${stem}_proof`;
}

/** 反映済みの面（表紙が先、裏表紙が後）。 */
export function coverProofSides(cover: CoverSettings | undefined): CoverFaceSide[] {
  const sides: CoverFaceSide[] = [];
  if (cover?.frontApplied) sides.push("front");
  if (cover?.backApplied) sides.push("back");
  return sides;
}

/** 画面に出す並び（この順に1つのPDFにまとめる）。`innerPageCount` は本文側のページ数（目次・奥付を含む）。 */
export function coverProofOrderText(cover: CoverSettings | undefined, innerPageCount: number): string {
  const front = cover?.frontApplied ? "表紙" : "（表紙は未反映）";
  const back = cover?.backApplied ? "裏表紙" : "（裏表紙は未反映）";
  return `${front} → 本文（${innerPageCount}ページ） → ${back}`;
}

/** 表紙1面を画像にしたもの（塗り足し込みの面全体）。 */
export interface CoverProofRaster {
  side: CoverFaceSide;
  jpeg: Uint8Array;
  /** 仕上がりの大きさ（本文のページと同じ） */
  trimWidthMm: number;
  trimHeightMm: number;
  /** 画像に含まれている塗り足し（各辺） */
  bleedMm: number;
}

/**
 * 画像の置き場所（ページ左上からの mm）。ページは仕上がり（trim）か
 * 塗り足し込み（bleed）の大きさで、画像はいつも塗り足し込みの面全体。
 */
export function coverProofImageBox(
  raster: CoverProofRaster,
  mode: CoverProofPdfMode,
): { xMm: number; yMm: number; widthMm: number; heightMm: number } {
  const widthMm = raster.trimWidthMm + raster.bleedMm * 2;
  const heightMm = raster.trimHeightMm + raster.bleedMm * 2;
  const offset = mode === "trim" ? -raster.bleedMm : 0;
  return { xMm: offset, yMm: offset, widthMm, heightMm };
}

/**
 * V2 の PDF（書き出し用ワーカー）に渡す1ページ。ページは仕上がりの大きさで、
 * 画像は塗り足しの分だけ外へはみ出させて置く。PDF の出力形式が塗り足し込み
 * なら、ワーカーがページの外側3mmを足すので、はみ出した部分がそのまま入る。
 */
export function coverProofPaintPage(raster: CoverProofRaster): PaintPagePlan {
  return {
    widthMm: raster.trimWidthMm,
    heightMm: raster.trimHeightMm,
    commands: [{ op: "image", ...coverProofImageBox(raster, "trim"), bytes: raster.jpeg, format: "JPEG" }],
  };
}

/** 本文の前と後ろに入れるページ。 */
export function coverProofPagesAround(rasters: readonly CoverProofRaster[]): {
  leading: CoverProofRaster[];
  trailing: CoverProofRaster[];
} {
  return {
    leading: rasters.filter((raster) => raster.side === "front"),
    trailing: rasters.filter((raster) => raster.side === "back"),
  };
}
