'use client';

import { PAGE_BREAK_MARKER } from '@/lib/tategaki';
import type { DocumentRecord } from '@/lib/db';
import type { CloudPlan } from '@/lib/supabase/plans';

export interface UserStatus {
  // 未ログイン（Traveler）は DB 上の plan を持たないため null で表す。
  // 「traveler」という plan 値を DB / plans.ts 側に追加することはしない。
  plan: CloudPlan | null;
}

/**
 * ユーザーがプレミアム機能（短編集・再録本メーカー）を利用可能か判定
 * Light / Unlimited プランのみ利用可（Traveler・Resident は不可）
 */
export function canUsePremiumFeatures(user: UserStatus): boolean {
  return user.plan === 'light' || user.plan === 'unlimited';
}

/**
 * 複数の作品本文を【改ページ】を挟んで1つの本文テキストに結合する
 */
export function combineNovelTexts(
  documents: Array<Pick<DocumentRecord, 'title' | 'content'>>,
  insertTitleAsHeader: boolean = true
): string {
  if (documents.length === 0) return '';

  return documents
    .map((doc) => {
      const titleHeader = insertTitleAsHeader ? `${doc.title}\n\n` : '';
      return `${titleHeader}${doc.content.trim()}`;
    })
    .join(`\n\n${PAGE_BREAK_MARKER}\n\n`);
}
