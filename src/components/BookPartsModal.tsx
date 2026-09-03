'use client';

import React, { useState } from 'react';
import { generateTitlePageText, generateColophonText, ColophonData } from '@/utils/bookStructure';
import { computeTocItemsWithOffset, generateTocText, TocItem } from '@/utils/tocGenerator';
import type { PageLayout, PageSettings } from '@/lib/pageLayout';

interface BookPartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (textToInsert: string, position: 'start' | 'end') => void;
  /** 「奥付（横）」= 本文とは独立した横書き専用ページ（ColophonModal）を開く。 */
  onOpenColophonModal: () => void;
  currentTitle?: string;
  content: string;
  layout: PageLayout;
  settings: PageSettings;
}

type BookPartTab = 'colophon' | 'colophon-h' | 'title' | 'toc';

// 4つの「本のパーツ」入口。初見でも違いが分かるよう、1行の補足を必ず添える。
const BOOK_PART_TABS: { id: BookPartTab; label: string; description: string }[] = [
  { id: 'colophon', label: '奥付（縦）', description: '本文ページとして縦書きの奥付を作成' },
  { id: 'colophon-h', label: '奥付（横）', description: '独立した横書き専用ページを作成' },
  { id: 'title', label: '扉（タイトルページ）', description: '作品タイトルなどの扉を本文へ挿入' },
  { id: 'toc', label: '目次作成', description: '目次用テキストを作成' },
];

export const BookPartsModal: React.FC<BookPartsModalProps> = ({
  isOpen,
  onClose,
  onInsert,
  onOpenColophonModal,
  currentTitle = '',
  content,
  layout,
  settings,
}) => {
  const [activeTab, setActiveTab] = useState<BookPartTab>('colophon');

  // 目次作成タブ
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [tocDetected, setTocDetected] = useState(false);

  // 扉フォーム
  const [titleAuthor, setTitleAuthor] = useState('');

  // 奥付フォーム
  const [colophon, setColophon] = useState<ColophonData>({
    title: currentTitle,
    author: '',
    publisher: '',
    printedBy: '',
    publishedAt: new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }),
    contact: '',
    notice: '※ 本書の無断転載・複写・Web上への転載を禁じます。',
  });

  if (!isOpen) return null;

  const detectToc = () => {
    const items = computeTocItemsWithOffset(
      content,
      { charsPerLine: layout.charsPerLine, linesPerPage: layout.linesPerPage },
      settings.masterPage.nombreStart
    );
    setTocItems(items);
    setTocDetected(true);
  };

  const handleOpenTocTab = () => {
    detectToc();
    setActiveTab('toc');
  };

  const handleTocPageNumberChange = (index: number, pageNumber: number) => {
    setTocItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, pageNumber } : item))
    );
  };

  const handleInsertTitlePage = () => {
    if (!currentTitle) {
      alert('作品タイトルを入力してください。');
      return;
    }
    // 著者名は空欄可。空欄なら generateTitlePageText 側で「著：」行ごと省く。
    // プレースホルダー文字列で埋めない（TSP-LOOP-021 §8）。
    const text = generateTitlePageText(currentTitle, titleAuthor);
    onInsert(text, 'start');
    onClose();
  };

  const handleInsertColophon = () => {
    if (!colophon.title || !colophon.author) {
      alert('タイトルと著者名は必須です。');
      return;
    }
    const text = generateColophonText(colophon);
    onInsert(text, 'end');
    onClose();
  };

  const handleInsertToc = () => {
    if (tocItems.length === 0) {
      alert('見出しが見つかりませんでした。本文に「# 見出し」または「■ 見出し」を追加してください。');
      return;
    }
    const text = generateTocText(tocItems);
    onInsert(text, 'start');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-neutral-900 p-6 shadow-xl border border-gray-200 dark:border-neutral-800">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          📖 奥付・扉・目次
        </h2>

        {/* タブ切替（4種類の本のパーツ） */}
        <div className="flex flex-wrap border-b border-gray-200 dark:border-neutral-800">
          {BOOK_PART_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => (tab.id === 'toc' ? handleOpenTocTab() : setActiveTab(tab.id))}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="mt-2 mb-4 text-[11px] text-gray-500 dark:text-gray-400">
          {BOOK_PART_TABS.find((t) => t.id === activeTab)?.description}
        </p>

        {/* フォーム内容 */}
        {activeTab === 'colophon-h' ? (
          <div className="space-y-3 text-xs">
            <p className="leading-relaxed text-gray-600 dark:text-gray-300">
              「奥付（横）」は、本文とは独立した横書き専用ページとして、本文の最後に追加されます。
              テンプレート・項目編集・フォント・自由記述・ノンブルなどは専用の設定画面で行います。
              本文の文字数・改ページ・縦書き設定には影響しません。
            </p>
            <p className="leading-relaxed text-gray-500 dark:text-gray-400">
              縦書きの奥付にしたい場合は「奥付（縦）」を選んでください。どちらかを強制するものではありません。
            </p>
          </div>
        ) : activeTab === 'colophon' ? (
          <div className="space-y-3 text-xs max-h-80 overflow-y-auto pr-1">
            <div>
              <label className="block font-semibold mb-1">誌名・作品タイトル *</label>
              <input
                type="text"
                value={colophon.title}
                onChange={(e) => setColophon({ ...colophon, title: e.target.value })}
                className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-neutral-700 dark:bg-neutral-800"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">著者名 *</label>
              <input
                type="text"
                placeholder="ペンネーム"
                value={colophon.author}
                onChange={(e) => setColophon({ ...colophon, author: e.target.value })}
                className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-neutral-700 dark:bg-neutral-800"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold mb-1">発行元（サークル名）</label>
                <input
                  type="text"
                  placeholder="例: タテスパン文庫"
                  value={colophon.publisher}
                  onChange={(e) => setColophon({ ...colophon, publisher: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-neutral-700 dark:bg-neutral-800"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">印刷所</label>
                <input
                  type="text"
                  placeholder="例: ○○印刷株式会社"
                  value={colophon.printedBy}
                  onChange={(e) => setColophon({ ...colophon, printedBy: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-neutral-700 dark:bg-neutral-800"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold mb-1">発行日</label>
              <input
                type="text"
                value={colophon.publishedAt}
                onChange={(e) => setColophon({ ...colophon, publishedAt: e.target.value })}
                className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-neutral-700 dark:bg-neutral-800"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">連絡先 / SNS ID</label>
              <input
                type="text"
                placeholder="例: @twitter_id / mail@example.com"
                value={colophon.contact}
                onChange={(e) => setColophon({ ...colophon, contact: e.target.value })}
                className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-neutral-700 dark:bg-neutral-800"
              />
            </div>
          </div>
        ) : activeTab === 'title' ? (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold mb-1">作品タイトル</label>
              <input
                type="text"
                disabled
                value={currentTitle}
                className="w-full px-3 py-1.5 rounded-md border border-gray-200 bg-gray-100 dark:bg-neutral-800 text-gray-500"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">著者名（任意）</label>
              <input
                type="text"
                placeholder="著者名を入力（空欄なら著者行は入りません）"
                value={titleAuthor}
                onChange={(e) => setTitleAuthor(e.target.value)}
                className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-neutral-700 dark:bg-neutral-800"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <p className="text-gray-500">
                本文中の「# 見出し」「■ 見出し」を検出し、ページ番号を自動判定します。
              </p>
              <button
                type="button"
                onClick={detectToc}
                className="shrink-0 rounded-md border border-gray-300 dark:border-neutral-700 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800"
              >
                🔄 再検出
              </button>
            </div>

            {tocDetected && tocItems.length === 0 ? (
              <p className="text-gray-400 py-4 text-center">
                見出しが見つかりませんでした。本文に「# 見出し」または「■
                見出し」の形式で見出しを追加してください。
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto pr-1 space-y-1.5">
                {tocItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 rounded-md border border-gray-200 dark:border-neutral-800 px-2 py-1.5"
                  >
                    <span className="flex-1 truncate" title={item.title}>
                      {item.title}
                    </span>
                    <span className="text-gray-400">p.</span>
                    <input
                      type="number"
                      min={1}
                      value={item.pageNumber}
                      onChange={(e) =>
                        handleTocPageNumberChange(index, Number(e.target.value) || 1)
                      }
                      className="w-16 px-2 py-1 rounded-md border border-gray-300 dark:border-neutral-700 dark:bg-neutral-800 text-right"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            キャンセル
          </button>
          <button
            onClick={
              activeTab === 'colophon-h'
                ? onOpenColophonModal
                : activeTab === 'colophon'
                  ? handleInsertColophon
                  : activeTab === 'title'
                    ? handleInsertTitlePage
                    : handleInsertToc
            }
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
          >
            {activeTab === 'colophon-h'
              ? '奥付（横）の設定を開く'
              : activeTab === 'colophon'
                ? '本文の末尾に挿入'
                : activeTab === 'title'
                  ? '本文の先頭に挿入'
                  : '目次を挿入'}
          </button>
        </div>
      </div>
    </div>
  );
};
