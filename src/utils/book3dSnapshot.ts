'use client';

import { saveAs } from 'file-saver';

/**
 * SPN-XFIX-001: 3Dプレビュー（表紙付きの仮冊子）を、いま見えている角度のまま
 * PNG 画像で保存する。画面に出ている舞台（.eb3d-stage）をそのまま写すだけで、
 * 本文・表紙のデータや書き出し（PDF/JPG）には一切触れない。
 * ノド注意範囲（ピンクの帯）は確認用の表示なので写さない。
 */
export async function saveBook3DSnapshot(stage: HTMLElement, fileName: string): Promise<void> {
  const { toBlob } = await import('html-to-image');
  const rect = stage.getBoundingClientRect();
  const background = resolveBackground(stage);
  const blob = await toBlob(stage, {
    pixelRatio: Math.max(2, Math.min(3, window.devicePixelRatio || 1)),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    backgroundColor: background,
    cacheBust: false,
    filter: (node) => !(node instanceof HTMLElement && node.dataset.gutterGuide !== undefined),
  });
  if (!blob) throw new Error('3Dプレビューを画像にできませんでした。');
  saveAs(blob, fileName);
}

function resolveBackground(stage: HTMLElement): string {
  // 舞台自体は半透明のグラデーションなので、画面の地の色を敷く。
  let node: HTMLElement | null = stage;
  while (node) {
    const color = getComputedStyle(node).backgroundColor;
    if (color && color !== 'transparent' && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(color)) return color;
    node = node.parentElement;
  }
  return '#ffffff';
}

/** 保存名: 作品の書き出し名_3d.png */
export function book3dSnapshotFileName(stem: string): string {
  const safe = stem.trim() || 'tatespun';
  return `${safe}_3d.png`;
}
