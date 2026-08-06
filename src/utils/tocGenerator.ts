'use client';

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
