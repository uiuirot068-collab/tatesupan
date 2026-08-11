'use client';

import { jsPDF } from 'jspdf';
import { encode } from 'fast-png';
import { capturePageToCanvas, EXPORT_TIMING_ENABLED } from './exportCapture';
import { BLEED_MM } from '@/lib/pageLayout';

export type PdfExportMode = 'trim' | 'bleed' | 'full';

// 全選択サイズ（mm）の判別マップ。
// Web閲覧用（isPxプリセット）はここに存在しない——px単位の用紙なので
// mmの実寸表には載せられない。呼び出し側が customWidth/customHeight を
// 明示的に渡すこと。渡さないと下の matchedKey 検索がヒットせず A5 に
// フォールバックしてしまうので注意。
export const PAPER_SIZES: Record<string, { width: number; height: number }> = {
  'A5': { width: 148, height: 210 },
  'B5': { width: 182, height: 257 },
  'B6': { width: 128, height: 182 },
  '新書': { width: 103, height: 182 },
  'A6': { width: 105, height: 148 },
  '文庫': { width: 105, height: 148 },
};

interface PdfOptions {
  mode: PdfExportMode;
  paperSizeName?: string; // 例: "A5", "B5", "新書" など
  customWidth?: number;   // 直接数値指定の場合（mm）。Web閲覧用は必須
  customHeight?: number;  // 直接数値指定の場合（mm）。Web閲覧用は必須
  bleed?: number;         // デフォルト: BLEED_MM(3mm)
  fileName: string;
  /**
   * capturePageToCanvas の pixelRatio。正式仕様はPDF固定600dpiのため、
   * 呼び出し側は pageLayout.ts の pixelRatioForDpi(PDF_EXPORT_DPI) の
   * 結果を明示的に渡すこと（このモジュール自身はdpiを知らない）。
   */
  scale: number;
  onProgress?: (current: number, total: number) => void;
}

/**
 * capturePageToCanvas は常に塗り足し込みページ（bleedWidthMm×bleedHeightMm
 * 相当）の.page-card要素全体をcaptureする——仕上がりPDF(trim)はこの中央
 * から仕上がり範囲(trimWidthMm×trimHeightMm)だけを原寸でcropする必要が
 * ある。「154×216を148×210へstretchする」旧バグ（正式仕様C）を避けるため、
 * scaleせず対応するbitmap範囲をそのまま切り出す。
 *
 * crop量はcanvas実寸(px)とbleed物理寸法(mm)の比から算出し、magic pixelを
 * 書かない。左右・上下それぞれのpx/mm比を独立に使うのは、captureが
 * pixelRatioで等方倍率されている前提でも、canvas.width/heightの丸め
 * （整数px化）が縦横で独立に生じ得るため——比を共有すると丸め誤差が
 * 蓄積し、中央からずれた非対称cropになり得る。
 *
 * exportImage.ts（印刷用紙JPG/JPG一括/JPG ZIP）からも同じcrop（塗り足し
 * 込み→仕上がり）が必要になったためexport——ロジックの複製を避け、
 * PDF/JPG両方でこの1か所のみを共有する。
 */
export function cropToTrimCanvas(
  canvas: HTMLCanvasElement,
  bleedWidthMm: number,
  bleedHeightMm: number,
  trimWidthMm: number,
  trimHeightMm: number,
  bleedMm: number
): HTMLCanvasElement {
  const pxPerMmX = canvas.width / bleedWidthMm;
  const pxPerMmY = canvas.height / bleedHeightMm;

  const sourceX = Math.round(bleedMm * pxPerMmX);
  const sourceY = Math.round(bleedMm * pxPerMmY);
  // 丸め誤差でsourceX/Y + sourceWidth/Heightがcanvas外へはみ出さないよう、
  // 残り幅/高さでclampして中央cropを保つ。
  const sourceWidth = Math.min(Math.round(trimWidthMm * pxPerMmX), canvas.width - sourceX);
  const sourceHeight = Math.min(Math.round(trimHeightMm * pxPerMmY), canvas.height - sourceY);

  const cropped = document.createElement('canvas');
  cropped.width = sourceWidth;
  cropped.height = sourceHeight;
  const ctx = cropped.getContext('2d');
  if (ctx) {
    ctx.drawImage(canvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
  }
  return cropped;
}

/**
 * PDF出力（このファイルのみ）を正式仕様のDeviceGrayにするための変換。
 * canvas→JPEGだとjsPDFは常にJPEGの3-componentを見て/DeviceRGBと判定
 * するため、jsPDFが/DeviceGrayと判定する「本物の1-channel grayscale
 * PNG」をfast-pngの公開API（deep importなし）でencodeしてから渡す。
 * JPG/JPG一括/JPG ZIP export（exportImage.ts）はこの関数を経由しない。
 *
 * capturePageToCanvasはhtml-to-imageの`backgroundColor: '#ffffff'`
 * （＋対象要素自体へのbackgroundColor/background強制指定）により常に
 * 不透明white背景の上へcaptureし、cropToTrimCanvasもその不透明pixelを
 * drawImageでそのまま複製するだけなので、この経路のcanvasは常に
 * alpha=255——white合成の追加コストはここでは発生させない。
 */
function canvasToGrayscalePng(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context for grayscale PDF conversion.');
  }
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const gray = new Uint8Array(width * height);
  for (let src = 0, dst = 0; dst < gray.length; src += 4, dst++) {
    gray[dst] = Math.round(0.299 * data[src] + 0.587 * data[src + 1] + 0.114 * data[src + 2]);
  }
  return encode({ width, height, channels: 1, depth: 8, data: gray });
}

export async function exportCustomPdf(
  elements: HTMLElement[],
  options: PdfOptions
): Promise<void> {
  if (typeof window === 'undefined' || elements.length === 0) return;

  const {
    mode,
    paperSizeName = 'A5',
    customWidth,
    customHeight,
    bleed = BLEED_MM,
    fileName,
    scale,
    onProgress
  } = options;

  // 用紙サイズの確定（仕上がり/trim寸法。例: A5 = 148×210mm）
  let pageWidth = customWidth;
  let pageHeight = customHeight;

  if (!pageWidth || !pageHeight) {
    // マップから幅と高さを自動割り出し（部分一致検索対応）
    const matchedKey = Object.keys(PAPER_SIZES).find(key => paperSizeName.includes(key));
    const size = matchedKey ? PAPER_SIZES[matchedKey] : PAPER_SIZES['A5'];
    pageWidth = size.width;
    pageHeight = size.height;
  }

  // 塗り足し込み(bleed)寸法——DOM側(PageCard.tsx sheetStyle)がcaptureする
  // .page-card要素の物理サイズと一致する（例: A5 = 154×216mm）。
  const bleedWidth = pageWidth + bleed * 2;
  const bleedHeight = pageHeight + bleed * 2;
  const margin = 15; // トンボ用余白（入稿用フルサイズのみ）

  let pdfWidth = pageWidth;
  let pdfHeight = pageHeight;

  if (mode === 'bleed') {
    pdfWidth = bleedWidth;
    pdfHeight = bleedHeight;
  } else if (mode === 'full') {
    pdfWidth = bleedWidth + margin * 2;
    pdfHeight = bleedHeight + margin * 2;
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pdfWidth, pdfHeight],
  });

  for (let i = 0; i < elements.length; i++) {
    if (i > 0) pdf.addPage();
    if (onProgress) onProgress(i + 1, elements.length);

    const el = elements[i];
    if (EXPORT_TIMING_ENABLED) {
      console.groupCollapsed(`[export timing] ${fileName} page ${i + 1}/${elements.length}`);
    }
    // capturePageToCanvasは常に塗り足し込み(bleedWidth×bleedHeight相当)の
    // .page-card要素全体をcaptureする——trim/bleed/fullいずれのmodeでも
    // ここでのsource canvasは同じ。
    const canvas = await capturePageToCanvas(el, { pixelRatio: scale });

    if (mode === 'trim') {
      // 仕上がりPDF: 中央から仕上がり範囲だけを原寸でcrop——scale/stretch
      // しない（正式仕様C）。
      const tCropStart = performance.now();
      const cropped = cropToTrimCanvas(canvas, bleedWidth, bleedHeight, pageWidth, pageHeight, bleed);
      if (EXPORT_TIMING_ENABLED) {
        console.log(`canvas crop（仕上がり）: ${(performance.now() - tCropStart).toFixed(1)} ms`);
      }
      const tEncodeStart = performance.now();
      const pngData = canvasToGrayscalePng(cropped);
      if (EXPORT_TIMING_ENABLED) {
        console.log(`canvas → grayscale PNG (fast-png encode): ${(performance.now() - tEncodeStart).toFixed(1)} ms`);
      }
      const tAddImageStart = performance.now();
      pdf.addImage(pngData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'MEDIUM');
      if (EXPORT_TIMING_ENABLED) {
        console.log(`PDF addImage: ${(performance.now() - tAddImageStart).toFixed(1)} ms`);
      }
      cropped.width = 0;
      cropped.height = 0;
    } else if (mode === 'bleed') {
      // 断ち落としPDF: 塗り足し込みページを原寸のまま出力。
      const tEncodeStart = performance.now();
      const pngData = canvasToGrayscalePng(canvas);
      if (EXPORT_TIMING_ENABLED) {
        console.log(`canvas → grayscale PNG (fast-png encode): ${(performance.now() - tEncodeStart).toFixed(1)} ms`);
      }
      const tAddImageStart = performance.now();
      pdf.addImage(pngData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'MEDIUM');
      if (EXPORT_TIMING_ENABLED) {
        console.log(`PDF addImage: ${(performance.now() - tAddImageStart).toFixed(1)} ms`);
      }
    } else if (mode === 'full') {
      // 入稿用フルサイズPDF: 塗り足し込み原稿をmargin位置へ原寸配置
      // （正式仕様E。以前はここでtrim寸法へ縮小してしまっていた）。
      const tEncodeStart = performance.now();
      const pngData = canvasToGrayscalePng(canvas);
      if (EXPORT_TIMING_ENABLED) {
        console.log(`canvas → grayscale PNG (fast-png encode): ${(performance.now() - tEncodeStart).toFixed(1)} ms`);
      }

      // ページ全面(pdfWidth×pdfHeight)を不透明whiteで塗ってから画像を
      // 配置する——jsPDFの新規ページはデフォルトで背景塗り矩形を持たず、
      // 画像はmargin分内側のbleedWidth×bleedHeight範囲にしか描かれない
      // ため、その外側＝トンボ周辺の余白がPDF上で未描画（transparent）の
      // まま残ってしまっていた（既知QA項目）。画像・トンボ自体の配置/
      // 寸法はここでは変更しない。
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');

      const tAddImageStart = performance.now();
      pdf.addImage(pngData, 'PNG', margin, margin, bleedWidth, bleedHeight, undefined, 'MEDIUM');
      if (EXPORT_TIMING_ENABLED) {
        console.log(`PDF addImage: ${(performance.now() - tAddImageStart).toFixed(1)} ms`);
      }

      // トンボ（トリムマーク）の動的描画: 仕上がり線(trim boundary =
      // margin+bleed)の位置を示す——bleed boundaryではない（正式仕様E-2）。
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.1);
      const drawLine = (x1: number, y1: number, x2: number, y2: number) => pdf.line(x1, y1, x2, y2);

      // 左上
      drawLine(margin, margin + bleed, margin - 10, margin + bleed);
      drawLine(margin, margin, margin - 10, margin);
      drawLine(margin + bleed, margin, margin + bleed, margin - 10);
      drawLine(margin, margin, margin, margin - 10);

      // 右上
      drawLine(pdfWidth - margin, margin + bleed, pdfWidth - margin + 10, margin + bleed);
      drawLine(pdfWidth - margin, margin, pdfWidth - margin + 10, margin);
      drawLine(pdfWidth - margin - bleed, margin, pdfWidth - margin - bleed, margin - 10);
      drawLine(pdfWidth - margin, margin, pdfWidth - margin, margin - 10);

      // 左下
      drawLine(margin, pdfHeight - margin - bleed, margin - 10, pdfHeight - margin - bleed);
      drawLine(margin, pdfHeight - margin, margin - 10, pdfHeight - margin);
      drawLine(margin + bleed, pdfHeight - margin, margin + bleed, pdfHeight - margin + 10);
      drawLine(margin, pdfHeight - margin, margin, pdfHeight - margin + 10);

      // 右下
      drawLine(pdfWidth - margin, pdfHeight - margin - bleed, pdfWidth - margin + 10, pdfHeight - margin - bleed);
      drawLine(pdfWidth - margin, pdfHeight - margin, pdfWidth - margin + 10, pdfHeight - margin);
      drawLine(pdfWidth - margin - bleed, pdfHeight - margin, pdfWidth - margin - bleed, pdfHeight - margin + 10);
      drawLine(pdfWidth - margin, pdfHeight - margin, pdfWidth - margin, pdfHeight - margin + 10);
    }

    // メモリ領域の明示的クリア
    canvas.width = 0;
    canvas.height = 0;

    if (EXPORT_TIMING_ENABLED) console.groupEnd();

    // マクロタスク挿入（UI開放・フリーズ防止）
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  pdf.save(fileName);
}
