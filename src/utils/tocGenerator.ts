'use client';

import {
  PAGE_BREAK_MARKER,
  computePageSourceRanges,
  findPageIndexForCharIndex,
  type PageLineMetrics,
} from '@/lib/tategaki';

export interface TocItem {
  title: string;
  pageNumber: number;
}

export interface HeadingOffset {
  title: string;
  /** 見出し行の先頭（行頭の空白を除く）を指す、本文内の文字インデックス */
  index: number;
}

/**
 * 本文テキストから `# 見出し` または `■ 見出し` を抽出する
 */
export function extractHeadings(content: string): string[] {
  return extractHeadingOffsets(content).map((heading) => heading.title);
}

/**
 * 本文テキストから見出しを抽出し、各見出しの本文内での文字インデックスを併せて返す。
 * ページ番号の自動判定（見出しがどのページに属するか）に使う。
 */
export function extractHeadingOffsets(content: string): HeadingOffset[] {
  if (!content) return [];
  const headings: HeadingOffset[] = [];
  let offset = 0;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    const leadingWhitespace = line.length - line.trimStart().length;

    if (trimmed.startsWith('# ')) {
      headings.push({
        title: trimmed.replace(/^#\s+/, ''),
        index: offset + leadingWhitespace,
      });
    } else if (trimmed.startsWith('■ ')) {
      headings.push({
        title: trimmed.replace(/^■\s+/, ''),
        index: offset + leadingWhitespace,
      });
    }

    offset += line.length + 1;
  }

  return headings;
}

/**
 * 抽出された目次項目とページ番号から縦書き用の目次テキスト（【改ページ】付き）を生成する
 */
export function generateTocText(tocItems: TocItem[]): string {
  if (tocItems.length === 0) return '';

  const lines: string[] = ['# 目次', ''];

  tocItems.forEach((item) => {
    lines.push(` ${item.title} ・・・・・ ${item.pageNumber}`);
  });

  lines.push('', '【改ページ】', '');
  return lines.join('\n');
}

/**
 * 見出しの到達ページ番号を、目次自身を本文先頭に挿入した場合のページ送りを
 * 織り込んだ上で算定する。
 *
 * 目次テキストの長さ（＝目次が占めるページ数）はページ番号の桁数などに
 * よってわずかに変わり得るため、目次を仮生成しては到達ページ番号を再計算
 * する処理を、結果が安定するまで数回繰り返す（収束しない極端なケースの
 * ための上限あり）。
 */
export function computeTocItemsWithOffset(
  content: string,
  layout: PageLineMetrics,
  nombreStart: number
): TocItem[] {
  const headings = extractHeadingOffsets(content);
  if (headings.length === 0) return [];

  const MAX_ITERATIONS = 5;
  let items: TocItem[] = headings.map((heading) => ({
    title: heading.title,
    pageNumber: nombreStart,
  }));

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const tocText = generateTocText(items);
    const combinedContent = tocText + content;
    const ranges = computePageSourceRanges(combinedContent, layout);

    const nextItems = headings.map((heading, index) => {
      const shiftedIndex = tocText.length + heading.index;
      const pageIndex = findPageIndexForCharIndex(ranges, shiftedIndex);
      return { title: items[index].title, pageNumber: nombreStart + pageIndex };
    });

    const stable = nextItems.every(
      (item, index) => item.pageNumber === items[index].pageNumber
    );
    items = nextItems;
    if (stable) break;
  }

  return items;
}

/** 1始まりの物理ページ番号の範囲（両端含む）。 */
export interface InsertedPartPageRange {
  startPage: number;
  endPage: number;
}

/**
 * 生成テキスト中の先頭・末尾に付随する【改ページ】マーカーおよびその前後の
 * 空行を取り除き、実際に内容が存在する範囲（本文相対のインデックス）を返す。
 * 末尾の【改ページ】以降（次のパーツの先頭に流れ込む空行など）を「このパーツ
 * のページ」と誤検出しないようにするための下処理。
 */
function coreContentRange(text: string): { start: number; end: number } {
  let start = 0;
  if (text.startsWith(PAGE_BREAK_MARKER)) {
    start = PAGE_BREAK_MARKER.length;
    while (start < text.length && text[start] === '\n') start += 1;
  }

  let end = text.length;
  const trailingMarkerIndex = text.slice(start).lastIndexOf(PAGE_BREAK_MARKER);
  if (trailingMarkerIndex !== -1) {
    end = start + trailingMarkerIndex;
    while (end > start && text[end - 1] === '\n') end -= 1;
  }

  return { start, end: Math.max(start, end) };
}

/**
 * 扉・目次・奥付などのパーツを本文の先頭/末尾に挿入した際、そのパーツが
 * 実際に占める物理ページ番号の範囲を算定する。挿入直後にノンブル非表示を
 * 自動連動させる用途に使う。
 */
export function computeInsertedPartPageRange(
  finalContent: string,
  insertedText: string,
  position: 'start' | 'end',
  layout: PageLineMetrics
): InsertedPartPageRange | null {
  const core = coreContentRange(insertedText);
  if (core.end <= core.start) return null;

  const insertOffset = position === 'start' ? 0 : finalContent.length - insertedText.length;
  const ranges = computePageSourceRanges(finalContent, layout);

  const startPageIndex = findPageIndexForCharIndex(ranges, insertOffset + core.start);
  const endPageIndex = findPageIndexForCharIndex(ranges, insertOffset + core.end - 1);

  return {
    startPage: startPageIndex + 1,
    endPage: Math.max(startPageIndex, endPageIndex) + 1,
  };
}
