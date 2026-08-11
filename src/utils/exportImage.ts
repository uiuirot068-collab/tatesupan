'use client';

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { capturePageToCanvas, EXPORT_TIMING_ENABLED, type RelativeRect } from './exportCapture';

/** 書き出し対象の1ページ分: キャプチャ元DOM要素と、出力ファイル名。 */
export interface ExportPageItem {
  element: HTMLElement;
  fileName: string;
}

/**
 * 印刷用紙JPG（JPG/JPG一括/JPG ZIP共通）の正式仕様: captureは常に塗り
 * 足し込み(bleed)サイズになるため、長辺1600px化の前に仕上がり(trim)範囲
 * だけへcropする必要がある。crop位置は「3mmという理論値」から逆算する
 * のではなく、実際にプレビューへ描画されているTrimGuide（仕上がり線）
 * の位置をそのまま使う——`cropRatio`は
 * `exportCapture.ts`の`measureTrimGuideRatioRect`が返す、.page-card
 * canonical widthに対する比率。crop後は仕上がり物理比率(例:A5なら
 * 148:210)を保った最終px（`finalWidthPx`/`finalHeightPx`、長辺1600px）
 * へ1回だけresizeする。Web閲覧用は未指定（＝cropもresizeもしない）。
 */
export interface PrintJpgGeometry {
  /** ログ表示用（実際のcrop計算はcanvas.width/heightから直接算出するため使わない）。 */
  pageWidthPx: number;
  pageHeightPx: number;
  cropRatio: RelativeRect;
  finalWidthPx: number;
  finalHeightPx: number;
}

let hasLoggedPrintJpgGeometry = false;

function cropCanvasByRatio(
  canvas: HTMLCanvasElement,
  rect: RelativeRect,
  geometryForLog: PrintJpgGeometry
): HTMLCanvasElement {
  const sourceX = Math.round(canvas.width * rect.xRatio);
  const sourceY = Math.round(canvas.height * rect.yRatio);
  // 丸め誤差でsourceX/Y + sourceWidth/Heightがcanvas外へはみ出さないよう、
  // 残り幅/高さでclampする。
  const sourceWidth = Math.min(Math.round(canvas.width * rect.widthRatio), canvas.width - sourceX);
  const sourceHeight = Math.min(Math.round(canvas.height * rect.heightRatio), canvas.height - sourceY);

  if (EXPORT_TIMING_ENABLED && !hasLoggedPrintJpgGeometry) {
    hasLoggedPrintJpgGeometry = true;
    console.log(
      `[export geometry]\n\n` +
        `page:\nw=${geometryForLog.pageWidthPx}, h=${geometryForLog.pageHeightPx}\n\n` +
        `trim guide relative rect:\nx=${rect.xRatio.toFixed(4)}, y=${rect.yRatio.toFixed(4)}, ` +
        `w=${rect.widthRatio.toFixed(4)}, h=${rect.heightRatio.toFixed(4)}\n\n` +
        `capture canvas:\nw=${canvas.width}, h=${canvas.height}\n\n` +
        `crop:\nx=${sourceX}, y=${sourceY}, w=${sourceWidth}, h=${sourceHeight}`
    );
  }

  const cropped = document.createElement('canvas');
  cropped.width = sourceWidth;
  cropped.height = sourceHeight;
  const ctx = cropped.getContext('2d');
  if (ctx) {
    ctx.drawImage(canvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
  }
  return cropped;
}

function resizeCanvasTo(canvas: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  const resized = document.createElement('canvas');
  resized.width = width;
  resized.height = height;
  const ctx = resized.getContext('2d');
  if (ctx) {
    ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, width, height);
  }
  return resized;
}

/**
 * `geometry`指定時は、TrimGuide位置に基づいて仕上がり範囲へcropした後、
 * 仕上がり物理比率を保った最終px（長辺1600px）へ1回だけresizeする
 * （scaleは維持しつつ、html-to-image/crop双方の丸め誤差を最後に1回で
 * 吸収する——正式仕様、通常は数%以内の微調整に留まる）。中間canvasは
 * 都度解放する。未指定（Web閲覧用）ならcanvasをそのまま返す。
 */
function applyPrintJpgGeometry(
  canvas: HTMLCanvasElement,
  geometry: PrintJpgGeometry | undefined
): HTMLCanvasElement {
  if (!geometry) return canvas;

  const tCropStart = performance.now();
  const cropped = cropCanvasByRatio(canvas, geometry.cropRatio, geometry);
  if (EXPORT_TIMING_ENABLED) {
    console.log(`canvas crop（仕上がり）: ${(performance.now() - tCropStart).toFixed(1)} ms`);
  }
  canvas.width = 0;
  canvas.height = 0;

  const tResizeStart = performance.now();
  const resized = resizeCanvasTo(cropped, geometry.finalWidthPx, geometry.finalHeightPx);
  if (EXPORT_TIMING_ENABLED) {
    console.log(`canvas resize（長辺1600固定）: ${(performance.now() - tResizeStart).toFixed(1)} ms`);
  }
  cropped.width = 0;
  cropped.height = 0;

  return resized;
}

/**
 * 指定された単一の原稿ページDOM要素を高画質JPGとしてダウンロード。
 * `scale` は呼び出し側（PreviewPane）が正式仕様の長辺1600px仕様から
 * 逆算したpixelRatioを渡す — pageLayout.ts の computePrintJpgPixelRatio
 * を参照。`geometry`は印刷用紙のみ指定（Web閲覧用は未指定でcrop/resizeしない）。
 */
export async function exportPageToJpg(
  element: HTMLElement,
  fileName: string,
  scale: number,
  geometry?: PrintJpgGeometry
): Promise<void> {
  if (typeof window === 'undefined' || !element) return;

  if (EXPORT_TIMING_ENABLED) console.groupCollapsed(`[export timing] ${fileName}`);
  try {
    const canvas = await capturePageToCanvas(element, { pixelRatio: scale });
    const finalCanvas = applyPrintJpgGeometry(canvas, geometry);
    const tEncodeStart = performance.now();
    const dataUrl = finalCanvas.toDataURL('image/jpeg', 0.95);
    if (EXPORT_TIMING_ENABLED) {
      console.log(`canvas → JPEG/dataURL: ${(performance.now() - tEncodeStart).toFixed(1)} ms`);
    }
    saveAs(dataUrl, fileName);
  } finally {
    if (EXPORT_TIMING_ENABLED) console.groupEnd();
  }
}

/**
 * 選択された各ページDOM要素を順番にキャプチャして1つのZIPファイルに
 * まとめて保存。`items` は呼び出し側が選択済みページだけを物理ページ順に
 * 詰めて渡す——このファイル自身は「全ページ」かどうかを判断しない。
 */
export async function exportPagesToZip(
  items: ExportPageItem[],
  zipFileName: string,
  onProgress: ((current: number, total: number) => void) | undefined,
  scale: number,
  geometry?: PrintJpgGeometry
): Promise<void> {
  if (typeof window === 'undefined' || items.length === 0) return;

  const zip = new JSZip();

  for (let i = 0; i < items.length; i++) {
    const { element, fileName } = items[i];
    onProgress?.(i + 1, items.length);

    if (EXPORT_TIMING_ENABLED) console.groupCollapsed(`[export timing] ${fileName}`);
    try {
      const canvas = await capturePageToCanvas(element, { pixelRatio: scale });
      const finalCanvas = applyPrintJpgGeometry(canvas, geometry);

      const tEncodeStart = performance.now();
      const blob = await new Promise<Blob | null>((resolve) => {
        finalCanvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95);
      });
      if (EXPORT_TIMING_ENABLED) {
        console.log(`canvas → JPEG blob: ${(performance.now() - tEncodeStart).toFixed(1)} ms`);
      }

      const tZipStart = performance.now();
      if (blob) {
        zip.file(fileName, blob);
      }
      if (EXPORT_TIMING_ENABLED) {
        console.log(`ZIP追加: ${(performance.now() - tZipStart).toFixed(1)} ms`);
      }

      finalCanvas.width = 0;
      finalCanvas.height = 0;
    } finally {
      if (EXPORT_TIMING_ENABLED) console.groupEnd();
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, zipFileName);
}

/**
 * 選択された各ページを個別のJPEGファイルとして、1枚ずつ順番に
 * ブラウザダウンロードをtriggerする（ZIP化しない — スマートフォンで
 * ZIPを開けない／扱いにくい場合への対策、正式仕様C参照）。
 *
 * ブラウザは短時間に連続する自動ダウンロードを警告/ブロックすることが
 * あるため、各ダウンロードの間に短い待機を挟む。ただしこれは緩和策で
 * あり、大量ページ選択時の完全な回避を保証するものではない
 * （実ブラウザでの挙動は呼び出し側のQAで確認すること）。
 */
export async function exportPagesAsIndividualJpgs(
  items: ExportPageItem[],
  onProgress: ((current: number, total: number) => void) | undefined,
  scale: number,
  geometry?: PrintJpgGeometry,
  delayMs: number = 300
): Promise<void> {
  if (typeof window === 'undefined' || items.length === 0) return;

  for (let i = 0; i < items.length; i++) {
    const { element, fileName } = items[i];
    onProgress?.(i + 1, items.length);

    if (EXPORT_TIMING_ENABLED) console.groupCollapsed(`[export timing] ${fileName}`);
    try {
      const canvas = await capturePageToCanvas(element, { pixelRatio: scale });
      const finalCanvas = applyPrintJpgGeometry(canvas, geometry);
      const tEncodeStart = performance.now();
      const dataUrl = finalCanvas.toDataURL('image/jpeg', 0.95);
      if (EXPORT_TIMING_ENABLED) {
        console.log(`canvas → JPEG/dataURL: ${(performance.now() - tEncodeStart).toFixed(1)} ms`);
      }
      saveAs(dataUrl, fileName);

      finalCanvas.width = 0;
      finalCanvas.height = 0;
    } finally {
      if (EXPORT_TIMING_ENABLED) console.groupEnd();
    }

    if (i < items.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
