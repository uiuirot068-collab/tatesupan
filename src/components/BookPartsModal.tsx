'use client';

import React, { useState } from 'react';
import { generateTitlePageText, generateColophonText, ColophonData } from '@/utils/bookStructure';

interface BookPartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (textToInsert: string, position: 'start' | 'end') => void;
  currentTitle?: string;
}

export const BookPartsModal: React.FC<BookPartsModalProps> = ({
  isOpen,
  onClose,
  onInsert,
  currentTitle = '',
}) => {
  const [activeTab, setActiveTab] = useState<'title' | 'colophon'>('colophon');

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
        ) : (
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
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            キャンセル
          </button>
          <button
            onClick={activeTab === 'colophon' ? handleInsertColophon : handleInsertTitlePage}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
          >
            {activeTab === 'colophon' ? '本文の末尾に挿入' : '本文の先頭に挿入'}
          </button>
        </div>
      </div>
    </div>
  );
};
