'use client';

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { capturePageToCanvas } from './exportCapture';

/**
 * 指定された単一の原稿ページDOM要素を高画質JPGとしてダウンロード。
 * `scale` は印刷用プリセット向けの既定値3（300dpi相当の高画質化）。
 * Web閲覧用（isPxプリセット）は呼び出し側から1を渡し、canvasの実pxサイズを
 * 用紙のcanonicalなpx外形（例: 768×1024）と一致させる。
 */
export async function exportPageToJpg(
  element: HTMLElement,
  fileName: string = 'page.jpg',
  scale: number = 3
): Promise<void> {
  if (typeof window === 'undefined' || !element) return;

  const canvas = await capturePageToCanvas(element, { pixelRatio: scale });
  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  saveAs(dataUrl, fileName);
}

/**
 * 全原稿ページのDOM要素を順番にキャプチャして1つのZIPファイルにまとめて保存。
 * `scale` の既定・意味は exportPageToJpg と同じ。
 */
export async function exportAllPagesToZip(
  elements: HTMLElement[],
  zipFileName: string = 'tatespun_pages.zip',
  onProgress?: (current: number, total: number) => void,
  scale: number = 3
): Promise<void> {
  if (typeof window === 'undefined' || elements.length === 0) return;

  const zip = new JSZip();

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (onProgress) onProgress(i + 1, elements.length);

    const canvas = await capturePageToCanvas(el, { pixelRatio: scale });

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
