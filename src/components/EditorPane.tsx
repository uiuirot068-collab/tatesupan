import { useRef } from "react";
import { countVisualLength, PAGE_BREAK_MARKER } from "@/lib/tategaki";
import type { PageLayout, PageSettings } from "@/lib/pageLayout";
import PageSettingsPanel from "./PageSettingsPanel";

const DEFAULT_INITIAL_TEXT = `■ 基本的な機能と記法
１.ここに本文を入力してください
２.上の「ドキュメント・タイトル名」はファイルの保存名になります


タイトルの下の下記のメニューでは以下の調整ができます
▶①ページ設定｜▶②ノンブル・柱｜▶③メモ｜④？
①用紙サイズ・余白・フォント
②ノンブル・柱記載
③プロット等にご活用ください
④ショートカットや記号での太字の方法等のやり方について

1. 改ページ
【改ページ】と入力すると、任意の場所で強制的に改ページが挿入されます。

2. 見出し（目次自動生成対応）
「# 第一章」「■ はじめに」のように書くと見出しとして認識され、目次機能でページ番号が自動抽出されます。

3. ルビ（ふりがな）
《》を使うことで文字にルビ《ふりがな》を振ることができます。

4. 縦中横（たてちゅうよこ）
半角数字（例：12月、3丁目）は、自動的に縦書きの中で横組み表示されます。`;

interface EditorPaneProps {
  title: string;
  onTitleChange: (title: string) => void;
  content: string;
  onContentChange: (content: string) => void;
  onOpenSearchReplace: () => void;
  onOpenBookParts: () => void;
  settings: PageSettings;
  layout: PageLayout;
  onSettingsChange: (settings: PageSettings) => void;
  plotNote: string;
  onPlotNoteChange: (plotNote: string) => void;
  onOpenHelp: () => void;
  /** Fired whenever the caret's character index into `content` changes, so the preview can scroll to the matching page. */
  onCursorIndexChange?: (index: number) => void;
}

export default function EditorPane({
  title,
  onTitleChange,
  content,
  onContentChange,
  onOpenSearchReplace,
  onOpenBookParts,
  settings,
  layout,
  onSettingsChange,
  plotNote,
  onPlotNoteChange,
  onOpenHelp,
  onCursorIndexChange,
}: EditorPaneProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const reportCursorIndex = () => {
    const el = textareaRef.current;
    if (!el || !onCursorIndexChange) return;
    onCursorIndexChange(el.selectionStart);
  };

  const insertPageBreak = () => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? content.length;
    const end = el?.selectionEnd ?? content.length;
    onContentChange(content.slice(0, start) + PAGE_BREAK_MARKER + content.slice(end));
    const caret = start + PAGE_BREAK_MARKER.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-base">
      <div className="flex flex-none flex-col gap-2 border-b border-ink/10 px-4 py-3">
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="ドキュメント・タイトル名"
          className="w-full min-w-0 bg-transparent text-base md:text-lg font-bold text-ink outline-none placeholder:text-ink/40"
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={insertPageBreak}
            title="カーソル位置に改ページを挿入"
            className="rounded border border-ink/20 px-3 py-1 text-xs text-ink/70 hover:bg-ink/5"
          >
            改ページ挿入
          </button>
          <button
            type="button"
            onClick={onOpenSearchReplace}
            className="rounded border border-ink/20 px-3 py-1 text-xs text-ink/70 hover:bg-ink/5"
          >
            検索・置換
          </button>
          <button
            type="button"
            onClick={onOpenBookParts}
            title="扉・奥付テキストを自動生成して挿入"
            className="rounded border border-ink/20 px-3 py-1 text-xs text-ink/70 hover:bg-ink/5"
          >
            📖 扉・奥付
          </button>
        </div>
      </div>

      <div className="flex-none">
        <PageSettingsPanel
          settings={settings}
          layout={layout}
          onChange={onSettingsChange}
          plotNote={plotNote}
          onPlotNoteChange={onPlotNoteChange}
          onOpenHelp={onOpenHelp}
        />
      </div>

      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => {
          onContentChange(e.target.value);
          requestAnimationFrame(reportCursorIndex);
        }}
        onSelect={reportCursorIndex}
        onClick={reportCursorIndex}
        onKeyUp={reportCursorIndex}
        placeholder={DEFAULT_INITIAL_TEXT}
        spellCheck={false}
        className="w-full flex-1 min-h-0 resize-none overflow-y-auto bg-transparent p-4 font-mono text-sm leading-relaxed text-ink outline-none placeholder:text-ink/40"
      />

      <div className="flex flex-none items-center justify-between border-t border-ink/10 px-4 py-2 text-xs text-ink/60">
        <span>
          ルビ記法: <code>｜漢字《かんじ》</code>／縦中横: 半角数字2桁・
          <code>!!</code>
          <code>??</code> を自動検知／改ページ: <code>{PAGE_BREAK_MARKER}</code>
        </span>
        <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-paper-ink">
          {countVisualLength(content)} 文字
        </span>
      </div>
    </div>
  );
}
