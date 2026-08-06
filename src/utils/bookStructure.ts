'use client';

export interface ColophonData {
  title: string;
  author: string;
  publisher?: string;      // 発行元・サークル名
  printedBy?: string;      // 印刷所名
  publishedAt?: string;    // 発行日（例: 2026年8月10日）
  contact?: string;        // 連絡先・Twitter/X ID・メール
  notice?: string;         // 「無断転載・複製を禁じます」等
}

/**
 * 扉（タイトルページ）テキストの生成
 */
export function generateTitlePageText(title: string, author: string): string {
  return `# ${title}\n\n  著：${author}\n\n【改ページ】\n\n`;
}

/**
 * 奥付（巻末権利表記）テキストの生成
 */
export function generateColophonText(data: ColophonData): string {
  const lines: string[] = [
    '【改ページ】',
    '----------------------------------------',
    `■ ${data.title}`,
    `【著者】${data.author}`,
  ];

  if (data.publishedAt) lines.push(`【発行日】${data.publishedAt}`);
  if (data.publisher) lines.push(`【発行】${data.publisher}`);
  if (data.printedBy) lines.push(`【印刷】${data.printedBy}`);
  if (data.contact) lines.push(`【連絡先】${data.contact}`);

  lines.push('----------------------------------------');
  lines.push(data.notice || '※ 本書の無断転載・複写・Web上への転載を禁じます。');

  return lines.join('\n');
}
