'use client';

import React, { useState } from 'react';
import { db } from '@/lib/db';
import type { PageSettings } from '@/lib/pageLayout';
import { DEFAULT_PAGE_SETTINGS } from '@/lib/pageLayout';
import { combineNovelTexts, canUsePremiumFeatures, UserStatus } from '@/utils/combineProjects';

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
  const [insertTitleAsHeader, setInsertTitleAsHeader] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const isAllowed = canUsePremiumFeatures(userStatus);

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
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

    try {
      // 選択順に作品を取得
      const targetDocs = selectedIds
        .map((id) => documents.find((d) => d.id === id))
        .filter((d): d is NonNullable<typeof d> => d !== undefined);

      // 本文の結合
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

      alert('短編集を作成しました！');
      onSuccess(newId);
      onClose();
    } catch (error) {
      console.error('結合エラー:', error);
      alert('結合処理に失敗しました。');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-neutral-900 p-6 shadow-xl border border-gray-200 dark:border-neutral-800">
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
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              className="rounded text-indigo-600"
            />
            各作品の先頭に作品タイトル（# 見出し）を自動挿入する
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg"
          >
            キャンセル
          </button>
          <button
            onClick={handleCombine}
            disabled={isProcessing || selectedIds.length < 2 || !newTitle.trim()}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-all"
          >
            {isProcessing ? '結合中...' : '短編集を作成'}
          </button>
        </div>
      </div>
    </div>
  );
};
