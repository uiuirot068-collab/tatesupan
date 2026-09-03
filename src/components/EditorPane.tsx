import { useEffect, useRef, useState } from "react";
import { countVisualLength, insertPageBreakMarker, PAGE_BREAK_MARKER } from "@/lib/tategaki";
import type { PageLayout, PageSettings } from "@/lib/pageLayout";
import { analyzeWriting, type WritingIssue } from "@/lib/writingCheck";
import { useWritingCheckEnabled } from "@/hooks/useWritingCheckEnabled";
import { BETA_FEEDBACK_ENABLED } from "@/lib/betaFeedback";
import PageSettingsPanel from "./PageSettingsPanel";
import WritingCheckOverlay from "./WritingCheckOverlay";
import WritingCheckBar from "./WritingCheckBar";

// TSP-LOOP-004: debounce between a keystroke and a re-check. Long enough to
// avoid re-analysing on every key of a fast typist, short enough to feel live.
const WRITING_CHECK_DEBOUNCE_MS = 300;

// Plain-text form of the footer syntax reminder, used as the hover `title`
// so the full guidance is still reachable when the one-line footer truncates
// it. (The full DOM text stays present for screen readers regardless of the
// visual `truncate`.) The detailed 3-case 改ページ explanation lives in Help /
// 使い方ガイド — see PageBreakGuide.
const FOOTER_SYNTAX_HELP =
  "ルビ: ｜漢字《かんじ》 ／ 縦中横: 半角数字2桁を自動検知・[tate]A5[/tate] ／ 改ページ: 【改ページ】（詳しい使い方はヘルプ）";

const DEFAULT_INITIAL_TEXT = `■ 基本的な機能と記法

1. ここに本文を入力してください
2. 上部の「ドキュメント名」はファイルの保存名になります

■ 設定メニューの使い方
編集画面のメニューから以下の調整が行えます：
・① ページ設定：用紙サイズ・余白・フォント・段組みの変更
・② ノンブル・柱：ページ番号やヘッダー／フッターの表示設定
・③ メモ：プロットや執筆メモの記録
・④ ヘルプ：ショートカットキーや特殊記法の使い方（「？」マークからも開けます）

■ 特殊記法・装飾
1. 改ページ（記法は【改ページ】。＃改ページは使いません）
・行に【改ページ】だけを書く → その行でページを区切る
・行の最後に【改ページ】をつける → その行の文章を表示してから区切る（例：章タイトル【改ページ】）
・行の途中に【改ページ】があり後ろにも文字が続く → 文字としてそのまま表示（改ページにならない）

2. 見出し（目次抽出対応）
「# 第一章」や「■ はじめに」と書くと見出しとして認識され、目次機能でページ番号が自動抽出されます。

3. ルビ（ふりがな）
《 》を使うと文字にルビを振ることができます。（例：漢字《かんじ》）

4. 縦中横（たてちゅうよこ）
半角2桁の数字（例：12月25日）は自動的に縦中横になります。
それ以外を縦中横にしたいときは [tate]…[/tate] で挟みます（例：用紙は[tate]A5[/tate]）。`;

interface EditorPaneProps {
  title: string;
  onTitleChange: (title: string) => void;
  content: string;
  onContentChange: (content: string) => void;
  onOpenSearchReplace: () => void;
  onOpenBookParts: () => void;
  /** β限定「報告」ボタン。BETA_FEEDBACK_ENABLED のときだけ表示。 */
  onOpenBetaFeedback: () => void;
  settings: PageSettings;
  layout: PageLayout;
  onSettingsChange: (settings: PageSettings) => void;
  plotNote: string;
  onPlotNoteChange: (plotNote: string) => void;
  onOpenHelp: () => void;
  /** Fired whenever the caret's character index into `content` changes, so the preview can scroll to the matching page. */
  onCursorIndexChange?: (index: number) => void;
  /** 1-based printed page numbers currently selected in PreviewPane, for the 「ノンブル・柱」タブの選択ページパネル. */
  selectedPageNumbers: number[];
  /**
   * TSP-LOOP-012: narrow-viewport 集中モード. When true, the title + toolbar
   * strip and the PageSettings/help strip are removed from the layout on
   * `< md` only (`max-md:hidden` → display:none, zero height, state kept). The
   * desktop / tablet-wide layout is unaffected.
   */
  focusMode?: boolean;
}

export default function EditorPane({
  title,
  onTitleChange,
  content,
  onContentChange,
  onOpenSearchReplace,
  onOpenBookParts,
  onOpenBetaFeedback,
  settings,
  layout,
  onSettingsChange,
  plotNote,
  onPlotNoteChange,
  onOpenHelp,
  onCursorIndexChange,
  selectedPageNumbers,
  focusMode = false,
}: EditorPaneProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // TSP-LOOP-020: explicit "本文を書く" action (phone only). scrollIntoView is
  // always done; focus() is only ever called from this direct user tap —
  // never on project load / mount — so it can't trigger a Safari
  // keyboard/viewport jump on open.
  const goToManuscript = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
  };

  // ---- TSP-LOOP-004 「文章チェック β」 (local, deterministic, no network) ----
  const [writingCheckEnabled, setWritingCheckEnabled] = useWritingCheckEnabled();
  const isComposingRef = useRef(false);
  const [recheckNonce, setRecheckNonce] = useState(0);
  // The analysis is always kept paired with the exact text it ran against, so
  // an underline is only ever drawn while `analysis.text === content`.
  const [analysis, setAnalysis] = useState<{ text: string; issues: WritingIssue[] }>({
    text: "",
    issues: [],
  });

  useEffect(() => {
    if (!writingCheckEnabled || isComposingRef.current) return;
    const timer = setTimeout(() => {
      setAnalysis({ text: content, issues: analyzeWriting(content) });
    }, WRITING_CHECK_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [content, writingCheckEnabled, recheckNonce]);

  const writingIssuesForContent = analysis.text === content ? analysis.issues : [];

  const handleSelectWritingIssue = (issue: WritingIssue) => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    const start = Math.min(issue.start, el.value.length);
    const end = Math.min(issue.end, el.value.length);
    el.setSelectionRange(start, end);
    reportCursorIndex();
  };

  const reportCursorIndex = () => {
    const el = textareaRef.current;
    if (!el || !onCursorIndexChange) return;
    onCursorIndexChange(el.selectionStart);
  };

  const insertPageBreak = () => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? content.length;
    const end = el?.selectionEnd ?? content.length;
    const before = content.slice(0, start);
    const after = content.slice(end);
    // A break inserted mid-line (the common case: cursor between two
    // sentences on the same line) must still land on its own line, or the
    // marker would render as literal text instead of a real page break —
    // see `insertPageBreakMarker`'s doc.
    const marker = insertPageBreakMarker(before, after);
    onContentChange(before + marker + after);
    const caret = start + marker.indexOf(PAGE_BREAK_MARKER) + PAGE_BREAK_MARKER.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-base">
      <div
        className={`flex flex-none flex-col gap-2 border-b border-ink/10 px-4 py-3 ${
          focusMode ? "max-md:hidden" : ""
        }`}
      >
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="ドキュメント・タイトル名"
          className="w-full min-w-0 bg-transparent text-base md:text-lg font-bold text-ink outline-none placeholder:text-ink/40"
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onOpenBookParts}
            title="奥付（縦／横）・目次を作成"
            className="rounded border border-ink/20 px-3 py-1 text-xs text-ink/70 hover:bg-ink/5"
          >
            📖 奥付・目次
          </button>
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
            置換
          </button>
          {BETA_FEEDBACK_ENABLED && (
            <button
              type="button"
              onClick={onOpenBetaFeedback}
              title="β版フィードバック（不具合・気になる事・要望）"
              className="rounded border border-amber-400 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              報告
            </button>
          )}
        </div>
      </div>

      <div
        id="tsp-settings"
        className={`flex-none scroll-mt-28 md:scroll-mt-0 ${focusMode ? "max-md:hidden" : ""}`}
      >
        <PageSettingsPanel
          settings={settings}
          layout={layout}
          onChange={onSettingsChange}
          plotNote={plotNote}
          onPlotNoteChange={onPlotNoteChange}
          onOpenHelp={onOpenHelp}
          selectedPageNumbers={selectedPageNumbers}
        />
      </div>

      {/* TSP-LOOP-020: phone-only manuscript identity. After opening a saved
          work the user must immediately see "this is where I continue
          writing". `md:hidden` — desktop never shows this tutorial line. */}
      <div className="flex flex-none items-center justify-between gap-3 border-b border-ink/10 bg-ink/[0.03] px-4 py-2 md:hidden">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">✏️ 本文を書く</p>
          <p className="text-[11px] leading-snug text-ink/55">
            ここに原稿を入力すると、縦書きプレビューに反映されます。
          </p>
        </div>
        <button
          type="button"
          onClick={goToManuscript}
          className="shrink-0 whitespace-nowrap rounded-full border border-ink/20 px-3 py-1 text-xs font-medium text-ink/70 hover:bg-ink/5"
        >
          本文を書く
        </button>
      </div>

      {/* The textarea stays the sole input surface. WritingCheckOverlay is a
          read-only, pointer-events-none mirror rendered behind it (only the
          red wavy underline is visible); it shares the textarea's wrapping
          box via the same p-4/font-mono/text-sm/leading-relaxed classes.
          Phone: a fixed-height (56dvh) intentional manuscript scroll surface
          inside the scrolling document; desktop: flex-1 fills the pane. */}
      <div className="relative min-h-0 max-md:h-[56dvh] md:flex-1">
        {writingCheckEnabled && (
          <WritingCheckOverlay
            textareaRef={textareaRef}
            text={content}
            issues={writingIssuesForContent}
          />
        )}
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
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false;
            setRecheckNonce((value) => value + 1);
          }}
          placeholder={DEFAULT_INITIAL_TEXT}
          spellCheck={false}
          className="absolute inset-0 h-full w-full resize-none overflow-y-auto overflow-x-hidden bg-transparent p-4 font-mono text-sm leading-relaxed text-ink outline-none placeholder:text-ink/40"
        />
      </div>

      <WritingCheckBar
        enabled={writingCheckEnabled}
        onToggle={setWritingCheckEnabled}
        text={analysis.text}
        issues={analysis.issues}
        onSelectIssue={handleSelectWritingIssue}
      />

      {/* Two fixed zones: the syntax help sacrifices text with an ellipsis
          first (min-w-0 + truncate), the character count is never wrapped
          and never covered (shrink-0). No absolute positioning, one line,
          footer height unchanged. Hovering the help text shows the full
          string via the native `title`; the full DOM text also stays present
          for screen readers regardless of the visual truncation. */}
      <div className="flex flex-none items-center gap-3 border-t border-ink/10 px-4 py-2 text-xs text-ink/60">
        <span className="min-w-0 flex-1 cursor-help truncate" title={FOOTER_SYNTAX_HELP}>
          ルビ: <code>｜漢字《かんじ》</code>／縦中横: 半角数字2桁を自動検知・
          <code>[tate]A5[/tate]</code>／改ページ: <code>{PAGE_BREAK_MARKER}</code>
        </span>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-paper-ink">
          {countVisualLength(content)} 文字
        </span>
      </div>
    </div>
  );
}
