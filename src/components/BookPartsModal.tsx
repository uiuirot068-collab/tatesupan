'use client';

import React, { useEffect, useRef, useState } from 'react';
import { generateTitlePageText, generateColophonText, ColophonData } from '@/utils/bookStructure';
import { extractHeadings, type TocItem } from '@/utils/tocGenerator';
import { computeTocItemsWithV2 } from '@/lib/v2Bridge/tocPageNumbers';
import { ReusablePreviewWorker, referencedImages } from '@/lib/v2Bridge/previewWorkerClient';
import type { V2PreviewLayout } from '@/lib/v2Bridge/previewWorkerProtocol';
import type { PageLayout, PageSettings } from '@/lib/pageLayout';
import InfoTooltip from './InfoTooltip';
import { TOC_REDETECT_HELP } from '@/lib/editorTerminology';
import {
  normalizeTocLeader,
  normalizeTocPosition,
  resolveTocInsertion,
  TOC_LEADER_OPTIONS,
  type TocLeaderStyle,
  type TocPosition,
  type TocSettings,
} from '@/lib/tocSettings';

interface BookPartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (textToInsert: string, position: 'start' | 'end') => void;
  onTocChange: (toc: TocSettings) => void;
  /** 「奥付（横）」= 本文とは独立した横書き専用ページ（ColophonModal）を開く。 */
  onOpenColophonModal: () => void;
  currentTitle?: string;
  content: string;
  layout: PageLayout;
  settings: PageSettings;
  images: Record<string, string>;
  initialTab?: BookPartTab;
}

export type BookPartTab = 'colophon' | 'colophon-h' | 'title' | 'toc';

// 「本のパーツ」入口。初見でも違いが分かるよう、1行の補足を必ず添える。
//
// TSP-LOOP-021 §7: 扉（タイトルページ）作成 UI は一時的に非表示にしている。
// 現状の扉ジェネレーターは技術的には安定・HUMAN QA PASS だが、専用機能として
// の価値がまだ足りないという製品判断による。実装（generateTitlePageText /
// 既存の扉レンダリング / 既に扉を含む原稿）はすべて温存しているので、下の
// 'title' 行を戻すだけで再表示できる。再有効化の条件はこのループの範囲外。
const BOOK_PART_TABS: { id: BookPartTab; label: string; description: string }[] = [
  { id: 'colophon', label: '奥付（縦）', description: '本文ページとして縦書きの奥付を作成' },
  { id: 'colophon-h', label: '奥付（横）', description: '独立した横書き専用ページを作成' },
  // { id: 'title', label: '扉（タイトルページ）', description: '作品タイトルなどの扉を本文へ挿入' },
  { id: 'toc', label: '目次作成', description: '本文とは別の目次ページを作成' },
];

export const BookPartsModal: React.FC<BookPartsModalProps> = ({
  isOpen,
  onClose,
  onInsert,
  onTocChange,
  onOpenColophonModal,
  currentTitle = '',
  content,
  layout,
  settings,
  images,
  initialTab = 'colophon',
}) => {
  const [activeTab, setActiveTab] = useState<BookPartTab>(initialTab);

  // 目次作成タブ — Phase 11: page numbers are owned by the same V2
  // composition/pageModel Preview and export use. No LEGACY synchronous
  // paginator fallback is used here.
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [tocDetected, setTocDetected] = useState(false);
  const [tocLoading, setTocLoading] = useState(initialTab === 'toc');
  const [tocError, setTocError] = useState<string | null>(null);
  // 挿入位置（作品データ。本文 content には書き込まない）。既存TOCはその位置、新規は「本文の前」から選び直せる。
  // リーダー（作品ごと）。既存作品で未設定なら従来どおりの点線。
  const [tocLeader, setTocLeader] = useState<TocLeaderStyle>(() => normalizeTocLeader(settings.toc?.leader));
  const [tocPosition, setTocPosition] = useState<TocPosition>(
    () => resolveTocInsertion(content, normalizeTocPosition(settings.toc?.position)).resolved
  );
  const [tocWorker] = useState(
    () =>
      new ReusablePreviewWorker(
        () => new Worker(new URL("../workers/v2Preview.worker.ts", import.meta.url), { type: "module" })
      )
  );

  useEffect(() => () => tocWorker.dispose(), [tocWorker]);

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

  const composeTocCandidate = (items: TocItem[], position: TocPosition): Promise<V2PreviewLayout> =>
    new Promise((resolve, reject) => {
      const candidateSettings: PageSettings = {
        ...settings,
        toc: { enabled: true, items: items.map((item) => ({ ...item })), position, leader: tocLeader, updatedAt: null },
      };
      tocWorker.request(
        {
          content,
          settings: candidateSettings,
          title: currentTitle.trim() || "TateSpun",
          images: referencedImages(images, content),
        },
        (outcome) => {
          if (!outcome.ok) {
            reject(new Error(outcome.message));
            return;
          }
          const candidate = outcome.reply.layout as V2PreviewLayout | undefined;
          if (!candidate) {
            reject(new Error("V2目次判定用のページ情報を取得できませんでした。"));
            return;
          }
          resolve(candidate);
        }
      );
    });

  // 目次の検出は V2 worker への非同期リクエスト。結果の state 反映は必ず
  // Promise の resolve/reject コールバック内で行い、effect 本体や同期経路から
  // setState しない（react-hooks/set-state-in-effect）。
  // `tocRequestIdRef` は最後に開始した検出だけを反映するための世代番号
  // （再検出の連打・初回検出中の再検出で古い結果が後から上書きしないように）。
  const tocRequestIdRef = useRef(0);

  /** Pure request: resolves to the detected items. Never touches React state. */
  const requestTocItems = (position: TocPosition): Promise<TocItem[]> =>
    computeTocItemsWithV2({
      content,
      nombreStart: settings.masterPage.nombreStart,
      compose: (items) => composeTocCandidate(items, position),
    });

  const applyTocDetected = (requestId: number, items: TocItem[]) => {
    if (requestId !== tocRequestIdRef.current) return;
    setTocItems(items);
    setTocDetected(true);
    setTocLoading(false);
  };

  const applyTocFailed = (requestId: number, cause: unknown) => {
    if (requestId !== tocRequestIdRef.current) return;
    setTocItems([]);
    setTocDetected(false);
    setTocError(cause instanceof Error ? cause.message : "目次ページ番号の判定に失敗しました。");
    setTocLoading(false);
  };

  /** User-initiated (再検出 / 目次タブを開く): event handlers may set state synchronously. */
  const detectToc = (position: TocPosition = tocPosition) => {
    tocRequestIdRef.current += 1;
    const requestId = tocRequestIdRef.current;
    setTocLoading(true);
    setTocError(null);
    requestTocItems(position).then(
      (items) => applyTocDetected(requestId, items),
      (cause: unknown) => applyTocFailed(requestId, cause)
    );
  };

  // 「目次」から直接開いた場合の初回検出。`tocLoading` は initialTab === 'toc'
  // で true から始まるので、ここでは同期的に state を変えずリクエストだけ開始し、
  // 結果はコールバックで反映する。アンマウント（閉じる）後の結果は破棄する。
  useEffect(() => {
    if (initialTab !== 'toc') return;
    tocRequestIdRef.current += 1;
    const requestId = tocRequestIdRef.current;
    let active = true;
    requestTocItems(tocPosition).then(
      (items) => {
        if (active) applyTocDetected(requestId, items);
      },
      (cause: unknown) => {
        if (active) applyTocFailed(requestId, cause);
      }
    );
    return () => {
      // A late worker reply after close (or StrictMode's re-run) is ignored.
      active = false;
    };
    // The modal is mounted fresh for each open. Re-running on every object
    // identity change would restart V2 composition while the user edits the
    // detected numbers manually.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every hook above runs unconditionally (Rules of Hooks); only the render
  // bails out while closed.
  if (!isOpen) return null;

  const handleOpenTocTab = () => {
    setActiveTab('toc');
    detectToc();
  };

  // 挿入位置の選択肢: 本文の前 / 各見出しの前 / 本文の後。位置で目次自身のページが
  // 動くので、変更したらページ番号を V2 で再検出する。
  const tocHeadingTitles = extractHeadings(content);
  const tocPositionValue =
    tocPosition.mode === 'before-heading' ? `heading:${tocPosition.headingIndex}` : tocPosition.mode;
  const handleTocPositionChange = (value: string) => {
    let next: TocPosition = { mode: 'start' };
    if (value === 'end') next = { mode: 'end' };
    else if (value.startsWith('heading:')) {
      const headingIndex = Number(value.slice('heading:'.length));
      const headingTitle = tocHeadingTitles[headingIndex];
      if (headingTitle !== undefined) next = { mode: 'before-heading', headingIndex, headingTitle };
    }
    setTocPosition(next);
    detectToc(next);
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
    onTocChange({
      enabled: true,
      items: tocItems.map((item) => ({ ...item })),
      position: tocPosition,
      leader: tocLeader,
      updatedAt: Date.now(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-neutral-900 p-6 shadow-xl border border-gray-200 dark:border-neutral-800">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          📖 奥付・目次
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
            <div className="text-left">
              <p className="text-gray-500">
                本文中の「# 見出し」「■ 見出し」を検出し、ページ番号を自動判定します。
              </p>
              <label className="mt-2 flex items-center gap-2 text-gray-600 dark:text-gray-300">
                <span className="shrink-0 font-semibold">挿入位置</span>
                <select
                  data-toc-position-select=""
                  value={tocPositionValue}
                  onChange={(event) => handleTocPositionChange(event.target.value)}
                  disabled={tocLoading}
                  className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                >
                  <option value="start">本文の前（先頭）</option>
                  {tocHeadingTitles.map((title, index) => (
                    <option key={`${index}-${title}`} value={`heading:${index}`}>
                      「{title}」の前
                    </option>
                  ))}
                  <option value="end">本文の後（末尾）</option>
                </select>
              </label>
              <label className="mt-2 flex items-center gap-2 text-gray-600 dark:text-gray-300">
                <span className="shrink-0 font-semibold">リーダー</span>
                <select
                  data-toc-leader-select=""
                  value={tocLeader}
                  onChange={(event) => setTocLeader(normalizeTocLeader(event.target.value))}
                  className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                >
                  {TOC_LEADER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => detectToc()}
                  disabled={tocLoading}
                  className="block rounded-md border border-gray-300 px-2 py-1 text-left text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:cursor-wait disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  {tocLoading ? '⏳ V2でページ番号を判定中…' : '🔄 再検出'}
                </button>
                <InfoTooltip text={TOC_REDETECT_HELP} label="目次の再検出について" />
              </div>
            </div>

            {tocError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-left text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
                V2でページ番号を判定できませんでした：{tocError}
              </p>
            )}
            {tocLoading && !tocDetected ? (
              <p className="py-4 text-left text-gray-400">現在の組版で目次ページ番号を計算しています…</p>
            ) : tocDetected && tocItems.length === 0 ? (
              <p className="py-4 text-left text-gray-400">
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
            disabled={activeTab === 'toc' && (tocLoading || !!tocError || !tocDetected)}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 rounded-lg"
          >
            {activeTab === 'colophon-h'
              ? '奥付（横）の設定を開く'
              : activeTab === 'colophon'
                ? '本文の末尾に挿入'
                : activeTab === 'title'
                  ? '本文の先頭に挿入'
                  : tocLoading
                    ? 'ページ番号を判定中…'
                    : settings.toc?.enabled ? '目次を更新' : '目次を作成'}
          </button>
        </div>
      </div>
    </div>
  );
};
