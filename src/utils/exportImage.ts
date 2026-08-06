'use client';

import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { resetScaleTransformOnClone } from './exportCapture';

/**
 * 指定された単一の原稿ページDOM要素を高画質JPGとしてダウンロード
 */
export async function exportPageToJpg(element: HTMLElement, fileName: string = 'page.jpg'): Promise<void> {
  if (typeof window === 'undefined' || !element) return;

  const canvas = await html2canvas(element, {
    scale: 3, // 高画質化（300dpi相当）
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    onclone: resetScaleTransformOnClone,
  });

  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  saveAs(dataUrl, fileName);
}

/**
 * 全原稿ページのDOM要素を順番にキャプチャして1つのZIPファイルにまとめて保存
 */
export async function exportAllPagesToZip(
  elements: HTMLElement[],
  zipFileName: string = 'tatespun_pages.zip',
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (typeof window === 'undefined' || elements.length === 0) return;

  const zip = new JSZip();

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (onProgress) onProgress(i + 1, elements.length);

    const canvas = await html2canvas(el, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: resetScaleTransformOnClone,
    });

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95);
    });

    if (blob) {
      const pageNum = String(i + 1).padStart(3, '0');
      zip.file(`page_${pageNum}.jpg`, blob);
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, zipFileName);
}
