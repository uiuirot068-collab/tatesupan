'use client';

import { readPsd } from 'ag-psd';

/**
 * PSDファイルをArrayBufferから読み込み、ブラウザで表示可能なPNG DataURLに変換します。
 */
export async function convertPsdToPngDataUrl(file: File): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('PSD conversion is only supported in browser environment.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const buffer = reader.result as ArrayBuffer;
        // ag-psdでPSD構造を解析（ブラウザ標準Canvasを利用）
        const psd = readPsd(buffer, { skipLayerImageData: true });

        if (!psd.canvas) {
          throw new Error('Failed to render PSD canvas.');
        }

        // HTMLCanvasElementからDataURLを出力
        const pngDataUrl = psd.canvas.toDataURL('image/png');
        resolve(pngDataUrl);
      } catch (err) {
        reject(new Error('PSDの解析に失敗しました。RGBモードのPSDを使用しているか確認してください。'));
      }
    };

    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました。'));
    reader.readAsArrayBuffer(file);
  });
}
