'use client';

import React, { useState } from 'react';
import { generateTitlePageText, generateColophonText, ColophonData } from '@/utils/bookStructure';
import { extractHeadingOffsets, generateTocText, TocItem } from '@/utils/tocGenerator';
import { computePageSourceRanges, findPageIndexForCharIndex } from '@/lib/tategaki';
import type { PageLayout, PageSettings } from '@/lib/pageLayout';

interface BookPartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (textToInsert: string, position: 'start' | 'end') => void;
  currentTitle?: string;
  content: string;
  layout: PageLayout;
  settings: PageSettings;
}

export const BookPartsModal: React.FC<BookPartsModalProps> = ({
  isOpen,
  onClose,
  onInsert,
  currentTitle = '',
  content,
  layout,
  settings,
}) => {
  const [activeTab, setActiveTab] = useState<'title' | 'colophon' | 'toc'>('colophon');

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
    const headings = extractHeadingOffsets(content);
    if (headings.length === 0) {
      setTocItems([]);
      setTocDetected(true);
      return;
    }
    const ranges = computePageSourceRanges(content, {
      charsPerLine: layout.charsPerLine,
      linesPerPage: layout.linesPerPage,
    });
    setTocItems(
      headings.map((heading) => {
        const pageIndex = findPageIndexForCharIndex(ranges, heading.index);
        return {
          title: heading.title,
          pageNumber: settings.masterPage.nombreStart + pageIndex,
        };
      })
    );
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
    const text = generateTitlePageText(currentTitle, titleAuthor || '著者名未設定');
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
          📖 書籍パーツの自動挿入
        </h2>

        {/* タブ切替 */}
        <div className="flex border-b border-gray-200 dark:border-neutral-800 mb-4">
          <button
            onClick={() => setActiveTab('colophon')}
            className={`pb-2 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'colophon'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            奥付（巻末の権利表記）
          </button>
          <button
            onClick={() => setActiveTab('title')}
            className={`pb-2 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'title'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            扉（タイトルページ）
          </button>
          <button
            onClick={handleOpenTocTab}
            className={`pb-2 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'toc'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            目次作成
          </button>
        </div>

        {/* フォーム内容 */}
        {activeTab === 'colophon' ? (
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
              <label className="block font-semibold mb-1">著者名</label>
              <input
                type="text"
                placeholder="著者名を入力"
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
              activeTab === 'colophon'
                ? handleInsertColophon
                : activeTab === 'title'
                  ? handleInsertTitlePage
                  : handleInsertToc
            }
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
          >
            {activeTab === 'colophon'
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
