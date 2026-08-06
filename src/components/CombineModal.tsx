'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/db';
import type { PageSettings } from '@/lib/pageLayout';
import { DEFAULT_PAGE_SETTINGS } from '@/lib/pageLayout';
import { combineNovelTexts, canUsePremiumFeatures, UserStatus } from '@/utils/combineProjects';

/** 選択中の作品から「〜」ほか○編（短編集）形式のデフォルトタイトルを生成する */
function buildDefaultTitle(titles: string[]): string {
  if (titles.length === 0) return '';
  const [first, ...rest] = titles;
  const firstTitle = first || '無題の作品';
  if (rest.length === 0) return `「${firstTitle}」（短編集）`;
  return `「${firstTitle}」ほか${rest.length}編（短編集）`;
}

interface CombineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newDocumentId: number) => void;
  documents: Array<{ id: number; title: string; content: string; settings?: PageSettings }>;
  userStatus?: UserStatus;
}

export const CombineModal: React.FC<CombineModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  documents,
  userStatus = { isRegistered: true, isPremium: false }, // 現段階では登録済み扱いで解放
}) => {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [insertTitleAsHeader, setInsertTitleAsHeader] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // モーダルを開くたびに選択状態をリセットし、古い選択のまま結合してしまう事故を防ぐ
  useEffect(() => {
    if (isOpen) {
      setSelectedIds([]);
      setNewTitle('');
      setTitleTouched(false);
      setIsProcessing(false);
    }
  }, [isOpen]);

  // 選択作品が変わるたびにタイトル未編集ならデフォルトタイトルを自動生成する
  useEffect(() => {
    if (titleTouched) return;
    const targetDocs = selectedIds
      .map((id) => documents.find((d) => d.id === id))
      .filter((d): d is NonNullable<typeof d> => d !== undefined);
    setNewTitle(buildDefaultTitle(targetDocs.map((d) => d.title)));
  }, [selectedIds, documents, titleTouched]);

  if (!isOpen) return null;

  const isAllowed = canUsePremiumFeatures(userStatus);

  const handleToggleSelect = (id: number) => {
    if (isProcessing) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleTitleChange = (value: string) => {
    setNewTitle(value);
    setTitleTouched(true);
  };

  const handleClose = () => {
    if (isProcessing) return;
    onClose();
  };

  const handleCombine = async () => {
    if (!isAllowed) {
      alert('短編集メーカーはユーザー登録（プレミアム機能）が必要です。');
      return;
    }
    if (selectedIds.length < 2) {
      alert('結合する作品を2つ以上選択してください。');
      return;
    }
    if (!newTitle.trim()) {
      alert('新しい短編集のタイトルを入力してください。');
      return;
    }

    setIsProcessing(true);
    // setState直後は同期処理でメインスレッドを占有しがちなので、
    // 「結合データを生成中...」の描画を確実に挟んでから重い処理へ進む
    await new Promise((resolve) => setTimeout(resolve, 0));

    try {
      // 選択順に作品を取得
      const targetDocs = selectedIds
        .map((id) => documents.find((d) => d.id === id))
        .filter((d): d is NonNullable<typeof d> => d !== undefined);

      if (targetDocs.length !== selectedIds.length) {
        throw new Error('選択された作品の一部が見つかりませんでした。');
      }

      // 本文の結合（作品間には必ず【改ページ】を挿入）
      const combinedContent = combineNovelTexts(targetDocs, insertTitleAsHeader);

      // 最初の作品の組版設定をベースに保存（存在する場合）
      const baseSettings = targetDocs[0]?.settings ?? DEFAULT_PAGE_SETTINGS;

      // DBへ新規短編集として保存
      const newId = Date.now();
      await db.documents.add({
        id: newId,
        title: newTitle.trim(),
        content: combinedContent,
        settings: baseSettings,
        updatedAt: Date.now(),
        isCollection: true,
        includedDocumentIds: selectedIds,
      });

      onSuccess(newId);
      onClose();
    } catch (error) {
      console.error('結合エラー:', error);
      alert('結合処理に失敗しました。作品数やデータ容量をご確認のうえ、もう一度お試しください。');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-neutral-900 p-6 shadow-xl border border-gray-200 dark:border-neutral-800">
        {isProcessing && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/90 dark:bg-neutral-900/90">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">結合データを生成中...</p>
          </div>
        )}

        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
          📚 短編集・再録本メーカー <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-normal">PREMIUM</span>
        </h2>
        <p className="text-xs text-gray-500 mb-4">選択した作品を【改ページ】を挟んで1つの作品に結合します。</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              新短編集のタイトル
            </label>
            <input
              type="text"
              placeholder="例：短編集 2026夏"
              value={newTitle}
              onChange={(e) => handleTitleChange(e.target.value)}
              disabled={isProcessing}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
              結合する作品を選択（2つ以上）
            </label>
            <div className="max-h-48 overflow-y-auto space-y-1.5 border border-gray-200 dark:border-neutral-800 rounded-lg p-2">
              {documents.map((doc) => (
                <label
                  key={doc.id}
                  className={`flex items-center gap-2 p-2 rounded-lg text-sm cursor-pointer transition-colors ${
                    selectedIds.includes(doc.id)
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-medium'
                      : 'hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(doc.id)}
                    onChange={() => handleToggleSelect(doc.id)}
                    disabled={isProcessing}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="truncate">{doc.title || '無題のドキュメント'}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={insertTitleAsHeader}
              onChange={(e) => setInsertTitleAsHeader(e.target.checked)}
              disabled={isProcessing}
              className="rounded text-indigo-600"
            />
            各作品の先頭に作品タイトル（# 見出し）を自動挿入する
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleCombine}
            disabled={isProcessing || selectedIds.length < 2 || !newTitle.trim()}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-all"
          >
            {isProcessing ? '結合データを生成中...' : '短編集を作成'}
          </button>
        </div>
      </div>
    </div>
  );
};
