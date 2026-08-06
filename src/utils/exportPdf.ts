'use client';

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export type PdfExportMode = 'trim' | 'bleed' | 'full';

// 全選択サイズ（mm）の判別マップ
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
  customWidth?: number;   // 直接数値指定の場合
  customHeight?: number;  // 直接数値指定の場合
  bleed?: number;         // デフォルト: 3mm
  fileName?: string;
  onProgress?: (current: number, total: number) => void;
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
    bleed = 3,
    fileName = 'tatespun_document.pdf',
    onProgress
  } = options;

  // 用紙サイズの確定
  let pageWidth = customWidth;
  let pageHeight = customHeight;

  if (!pageWidth || !pageHeight) {
    // マップから幅と高さを自動割り出し（部分一致検索対応）
    const matchedKey = Object.keys(PAPER_SIZES).find(key => paperSizeName.includes(key));
    const size = matchedKey ? PAPER_SIZES[matchedKey] : PAPER_SIZES['A5'];
    pageWidth = size.width;
    pageHeight = size.height;
  }

  let pdfWidth = pageWidth;
  let pdfHeight = pageHeight;
  let offsetX = 0;
  let offsetY = 0;
  const margin = 15; // トンボ用余白

  if (mode === 'bleed') {
    pdfWidth = pageWidth + (bleed * 2);
    pdfHeight = pageHeight + (bleed * 2);
  } else if (mode === 'full') {
    pdfWidth = pageWidth + (bleed * 2) + (margin * 2);
    pdfHeight = pageHeight + (bleed * 2) + (margin * 2);
    offsetX = margin + bleed;
    offsetY = margin + bleed;
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
    const canvas = await html2canvas(el, {
      scale: 4,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    if (mode === 'trim') {
      pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
    } else if (mode === 'bleed') {
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    } else if (mode === 'full') {
      pdf.addImage(imgData, 'JPEG', offsetX, offsetY, pageWidth, pageHeight);

      // トンボ（トリムマーク）の動的描画
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

    // マクロタスク挿入（UI開放・フリーズ防止）
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  pdf.save(fileName);
}
