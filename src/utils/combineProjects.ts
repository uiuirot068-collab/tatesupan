'use client';

import { PAGE_BREAK_MARKER } from '@/lib/tategaki';
import type { DocumentRecord } from '@/lib/db';

export interface UserStatus {
  isRegistered: boolean; // ユーザー登録済みか
  isPremium: boolean;    // 有料プラン加入済みか（開発最終段階でStripe等と連動）
}

/**
 * ユーザーがプレミアム機能（短編集メーカー）を利用可能か判定
 * 現段階ではユーザー登録済み（isRegistered === true）であれば解放
 */
export function canUsePremiumFeatures(user: UserStatus): boolean {
  return user.isRegistered || user.isPremium;
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
