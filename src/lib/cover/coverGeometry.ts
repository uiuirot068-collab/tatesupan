/**
 * CST-PORT-011: 表紙の寸法（COLUMNSTAND `src/lib/coverGeometry.ts` の移植）。
 *
 * すべての面をここで1度だけ mm で計算し、描画（プレビュー・書き出し）は
 * この数字を読むだけにする。表示倍率はここに入れない。
 *
 * TateSpun は縦書きだけなので綴じは常に右綴じ。表紙・背・裏表紙を1枚に
 * 並べると、外側から見て [表紙][背][裏表紙]（表紙が左）になる。
 */
import { BLEED_MM, resolvePaperSize } from "../pageLayout";
import type { CoverFaceSide } from "./coverModel";

/** 文字を置かない安全域（仕上がり線から内側 10mm）。画面には描かない。 */
export const COVER_SAFE_MM = 10;

/**
 * 塗り足し込みの1面を描くときの基準幅（px）。COLUMNSTAND の Human QA で
 * 合格した文字組みはこの幅（308px）で調整されたので、TSP も同じ基準で
 * 組んでから、プレビュー・書き出しで全体を一様に拡大縮小する。
 */
export const COVER_FACE_REF_WIDTH_PX = 308;

export const SPINE_TEXT_MIN_WIDTH_MM = 4;
export const SPINE_NORMAL_MIN_WIDTH_MM = 6;
export const SPINE_FONT_MIN_PT = 4;
export const SPINE_FONT_MAX_PT = 30;
export const MM_PER_PT = 25.4 / 72;

export type SpineTextState = "disabled" | "narrow" | "ready";

export function roundSpineWidthMm(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value * 10) / 10);
}

export function spineTextState(widthMm: number): SpineTextState {
  const width = roundSpineWidthMm(widthMm);
  if (width < SPINE_TEXT_MIN_WIDTH_MM) return "disabled";
  if (width < SPINE_NORMAL_MIN_WIDTH_MM) return "narrow";
  return "ready";
}

export function clampSpineFontPt(value: number): number {
  if (!Number.isFinite(value)) return 10;
  return Math.min(SPINE_FONT_MAX_PT, Math.max(SPINE_FONT_MIN_PT, value));
}

export function ptToMm(pt: number): number {
  return pt * MM_PER_PT;
}

export type MmRect = { x: number; y: number; width: number; height: number };

export type CoverFaceGeometry = {
  trimWidthMm: number;
  trimHeightMm: number;
  bleedMm: number;
  safeMm: number;
  /** 塗り足し込みの1面: 仕上がり + 天地左右の塗り足し */
  widthMm: number;
  heightMm: number;
  /** 基準描画の px/mm */
  pxPerMm: number;
  widthPx: number;
  heightPx: number;
  /** Web閲覧用（px の用紙）。PDF は書き出さない */
  isPx: boolean;
};

export function getCoverFaceGeometry(paperSize: string): CoverFaceGeometry {
  const paper = resolvePaperSize(paperSize);
  const widthMm = paper.widthMm + BLEED_MM * 2;
  const heightMm = paper.heightMm + BLEED_MM * 2;
  const pxPerMm = COVER_FACE_REF_WIDTH_PX / widthMm;
  return {
    trimWidthMm: paper.widthMm,
    trimHeightMm: paper.heightMm,
    bleedMm: BLEED_MM,
    safeMm: COVER_SAFE_MM,
    widthMm,
    heightMm,
    pxPerMm,
    widthPx: widthMm * pxPerMm,
    heightPx: heightMm * pxPerMm,
    isPx: paper.isPx,
  };
}

export type CoverSpreadFaceRegion = {
  side: CoverFaceSide;
  /** 見開きの中で、その面を見せる窓（mm） */
  rect: MmRect;
  /**
   * 窓の中での塗り足し込みの面のずれ（mm）。左の面は 0（背側の塗り足しは
   * 右で切れる）、右の面は -塗り足し（背側の塗り足しは左で切れる）。
   */
  faceOffsetXMm: number;
};

export type CoverSpreadGeometry = {
  binding: "right";
  face: CoverFaceGeometry;
  spineWidthMm: number;
  bleedMm: number;
  widthMm: number;
  heightMm: number;
  pxPerMm: number;
  widthPx: number;
  heightPx: number;
  left: CoverSpreadFaceRegion;
  right: CoverSpreadFaceRegion;
  spine: MmRect;
  /** 見開き全体の仕上がり線 */
  trim: MmRect;
  /** 背の折り位置（mm）。背幅0なら同じ値 */
  foldXsMm: [number, number];
};

/**
 * 1枚の印刷面:
 *   [塗り足し][表紙の仕上がり][背][裏表紙の仕上がり][塗り足し]
 * 天地の塗り足しは全体に通す。背と接する辺には塗り足しを付けず、
 * 面と背のあいだに隙間も線も入れない。
 */
export function getCoverSpreadGeometry(paperSize: string, spineWidthMmRaw: number): CoverSpreadGeometry {
  const face = getCoverFaceGeometry(paperSize);
  const bleed = face.bleedMm;
  const spineWidthMm = roundSpineWidthMm(spineWidthMmRaw);
  const faceRegionWidthMm = face.trimWidthMm + bleed;
  const widthMm = faceRegionWidthMm * 2 + spineWidthMm;
  const heightMm = face.heightMm;
  const spineX = faceRegionWidthMm;
  const rightX = spineX + spineWidthMm;

  return {
    binding: "right",
    face,
    spineWidthMm,
    bleedMm: bleed,
    widthMm,
    heightMm,
    pxPerMm: face.pxPerMm,
    widthPx: widthMm * face.pxPerMm,
    heightPx: heightMm * face.pxPerMm,
    // 右綴じ: 表紙が左、裏表紙が右
    left: { side: "front", rect: { x: 0, y: 0, width: faceRegionWidthMm, height: heightMm }, faceOffsetXMm: 0 },
    right: { side: "back", rect: { x: rightX, y: 0, width: faceRegionWidthMm, height: heightMm }, faceOffsetXMm: -bleed },
    spine: { x: spineX, y: 0, width: spineWidthMm, height: heightMm },
    trim: { x: bleed, y: bleed, width: widthMm - bleed * 2, height: heightMm - bleed * 2 },
    foldXsMm: [spineX, rightX],
  };
}

/** 画面に収める倍率（中身は組み直さず、この1つの数字だけ変える）。 */
export function fitScale(
  contentWidthPx: number,
  contentHeightPx: number,
  viewportWidthPx: number,
  viewportHeightPx: number,
): number {
  if (contentWidthPx <= 0 || contentHeightPx <= 0) return 1;
  if (viewportWidthPx <= 0 || viewportHeightPx <= 0) return 1;
  return Math.min(viewportWidthPx / contentWidthPx, viewportHeightPx / contentHeightPx);
}
