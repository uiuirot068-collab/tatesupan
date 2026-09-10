import { useEffect, useMemo, useRef, useState } from "react";
import { countVisualLength, insertPageBreakMarker, PAGE_BREAK_MARKER } from "@/lib/tategaki";
import type { PageLayout, PageSettings } from "@/lib/pageLayout";
import { applyBulkFix, applyFix, filterIgnored, runWritingCheck, type WritingCheckConfig, type WritingDiagnostic } from "@/lib/writingCheckEngine";
import { useWritingCheckEnabled } from "@/hooks/useWritingCheckEnabled";
import { useWritingCheckDictionary } from "@/hooks/useWritingCheckDictionary";
import { useWritingCheckNgWords } from "@/hooks/useWritingCheckNgWords";
import { useWritingCheckRuleConfig } from "@/hooks/useWritingCheckRuleConfig";
import { BETA_FEEDBACK_ENABLED } from "@/lib/betaFeedback";
import {
  applyTextInputChange,
  captureBeforeInput,
  createTextInputActivityState,
  finishComposition,
  startComposition,
  syncTextInputActivityState,
  type ActivityDelta,
  type CompletedWorkSession,
  type WorkSessionState,
} from "@/lib/editorSessionActivity";
import PageSettingsPanel from "./PageSettingsPanel";
import EditorSyntaxHelp from "./EditorSyntaxHelp";
import WorkSessionTracker from "./WorkSessionTracker";
import WritingCheckOverlay from "./WritingCheckOverlay";
import WritingCheckBar from "./WritingCheckBar";
import WritingCheckSettingsPanel from "./WritingCheckSettingsPanel";

// TSP-LOOP-004: debounce between a keystroke and a re-check. Long enough to
// avoid re-analysing on every key of a fast typist, short enough to feel live.
const WRITING_CHECK_DEBOUNCE_MS = 300;

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
  workSession: WorkSessionState;
  onRecordActivity: (delta: ActivityDelta) => void;
  onStartWorkSession: () => void;
  onEndWorkSession: () => CompletedWorkSession | null;
  onOpenSearchReplace: () => void;
  onOpenBookParts: () => void;
  onImportTxt: () => void;
  onExportTxt: () => void;
  onOpenMemo: () => void;
  onOpenChecklist: () => void;
  onOpenSettingsDrawer: () => void;
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
  /** Demo-only narrow viewport shell: let the manuscript fill remaining height and scroll internally. */
  guidedViewport?: boolean;
}

export default function EditorPane({
  title,
  onTitleChange,
  content,
  onContentChange,
  workSession,
  onRecordActivity,
  onStartWorkSession,
  onEndWorkSession,
  onOpenSearchReplace,
  onOpenBookParts,
  onImportTxt,
  onExportTxt,
  onOpenMemo,
  onOpenChecklist,
  onOpenSettingsDrawer,
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
  guidedViewport = false,
}: EditorPaneProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputActivityStateRef = useRef(createTextInputActivityState(content));

  // Parent-driven changes (load/switch, structural UI, Preview operations)
  // become the next input baseline without themselves becoming activity.
  useEffect(() => {
    inputActivityStateRef.current = syncTextInputActivityState(
      inputActivityStateRef.current,
      content
    );
  }, [content]);

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

  // Keep the textarea's native browser history as the single source of truth.
  // Preventing toolbar focus on pointer-down preserves the current selection;
  // execCommand then takes the same native undo/redo path as Ctrl/Cmd+Z/Y and
  // emits the ordinary input event consumed by the controlled textarea.
  const runNativeHistory = (command: "undo" | "redo") => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    // Chrome's command-driven Redo can emit `input` without `beforeinput`.
    // Seed the existing input-state path with the native history inputType so
    // both visible buttons retain the same written-count exclusion as keys.
    inputActivityStateRef.current = captureBeforeInput(inputActivityStateRef.current, {
      beforeText: el.value,
      selectionStart: el.selectionStart,
      selectionEnd: el.selectionEnd,
      inputType: command === "undo" ? "historyUndo" : "historyRedo",
    });
    document.execCommand(command);
    // Clear a pending snapshot if the command had no history entry; if its
    // input event was asynchronous, syncing the resulting DOM value still
    // makes that later event a zero delta rather than suppressing future text.
    const synchronizedState = syncTextInputActivityState(
      inputActivityStateRef.current,
      el.value
    );
    inputActivityStateRef.current = {
      ...synchronizedState,
      pendingBeforeInput: null,
    };
  };

  // ---- TSP-LOOP-004 → 文章チェック β 2.0 (local, deterministic, no network) ----
  const [writingCheckEnabled, setWritingCheckEnabled] = useWritingCheckEnabled();
  const isComposingRef = useRef(false);
  const [recheckNonce, setRecheckNonce] = useState(0);
  const { presetId, ruleOverrides, selectPreset, setRuleEnabled } = useWritingCheckRuleConfig();
  const dictionary = useWritingCheckDictionary();
  const ngWords = useWritingCheckNgWords();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Phase 12: occurrence-level, in-memory-only ignore state -- never
  // persisted, naturally forgotten on remount/reload (see `ignoredOccurrences.ts`).
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());
  // Phase 14: the narrowest possible one-step undo -- only ever holds the
  // manuscript state immediately before the last Fix/まとめて直す, and is
  // cleared the moment the user makes ANY further edit (see the textarea
  // onChange handler below), so 元に戻す never surprises the user by
  // discarding keystrokes typed after the automated change.
  const [undoState, setUndoState] = useState<{
    before: string;
    after: string;
  } | null>(null);

  const writingCheckConfig: WritingCheckConfig = useMemo(
    () => ({ ruleOverrides, dictionary: dictionary.entries, ngWords: ngWords.entries }),
    [ruleOverrides, dictionary.entries, ngWords.entries]
  );

  // The analysis is always kept paired with the exact text it ran against, so
  // an underline is only ever drawn while `analysis.text === content`.
  const [analysis, setAnalysis] = useState<{ text: string; issues: WritingDiagnostic[] }>({
    text: "",
    issues: [],
  });

  useEffect(() => {
    if (!writingCheckEnabled || isComposingRef.current) return;
    const timer = setTimeout(() => {
      setAnalysis({ text: content, issues: runWritingCheck(content, writingCheckConfig) });
    }, WRITING_CHECK_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [content, writingCheckEnabled, recheckNonce, writingCheckConfig]);

  const analysisCurrent = analysis.text === content;
  const writingIssuesForContent = analysisCurrent ? filterIgnored(analysis.issues, ignoredIds) : [];

  const handleSelectWritingIssue = (issue: WritingDiagnostic) => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    const start = Math.min(issue.start, el.value.length);
    const end = Math.min(issue.end, el.value.length);
    el.setSelectionRange(start, end);
    reportCursorIndex();
  };

  /** Mutates the manuscript ONLY in direct response to an explicit Human action (直す / まとめて直す / 元に戻す). */
  const applyAutomatedTextChange = (next: string) => {
    if (next === content) return;
    setUndoState({ before: content, after: next });
    inputActivityStateRef.current = syncTextInputActivityState(inputActivityStateRef.current, next);
    onContentChange(next);
  };

  const handleFixIssue = (issue: WritingDiagnostic) => {
    const result = applyFix(content, issue);
    if (!result.applied) {
      // Stale range (manuscript changed since this diagnostic was computed) --
      // never mutate; rerun diagnostics instead, per Phase 11's own contract.
      setRecheckNonce((v) => v + 1);
      return;
    }
    applyAutomatedTextChange(result.text);
  };

  const handleIgnoreIssue = (issue: WritingDiagnostic) => {
    setIgnoredIds((prev) => new Set(prev).add(issue.id));
  };

  const handleBulkFix = () => {
    const result = applyBulkFix(content, writingIssuesForContent);
    if (result.appliedIds.length === 0) return;
    applyAutomatedTextChange(result.text);
  };

  const handleUndoFix = () => {
    if (!undoState) return;
    inputActivityStateRef.current = syncTextInputActivityState(
      inputActivityStateRef.current,
      undoState.before
    );
    onContentChange(undoState.before);
    setUndoState(null);
  };

  const reportCursorIndex = () => {
    const el = textareaRef.current;
    if (!el || !onCursorIndexChange) return;
    onCursorIndexChange(el.selectionStart);
  };

  const captureTextareaInput = (el: HTMLTextAreaElement, inputType: string) => {
    inputActivityStateRef.current = captureBeforeInput(inputActivityStateRef.current, {
      beforeText: el.value,
      selectionStart: el.selectionStart,
      selectionEnd: el.selectionEnd,
      inputType,
    });
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
    const next = before + marker + after;
    // Dedicated structural page-break UI is explicitly outside 11-B.
    inputActivityStateRef.current = syncTextInputActivityState(inputActivityStateRef.current, next);
    onContentChange(next);
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
          data-demo-target="title"
          className="w-full min-w-0 bg-transparent text-base md:text-lg font-bold text-ink outline-none placeholder:text-ink/40"
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={onOpenSettingsDrawer} className="hidden rounded border border-ink/20 px-3 py-1 text-xs font-medium text-ink/70 hover:bg-ink/5 md:inline-flex">設定</button>
          <button
            type="button"
            data-editor-history-action="undo"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runNativeHistory("undo")}
            title="元に戻す（Ctrl/Cmd+Z）"
            className="rounded border border-ink/20 px-3 py-1 text-xs text-ink/70 hover:bg-ink/5"
          >
            <span aria-hidden="true">↶</span> 元に戻す
          </button>
          <button
            type="button"
            data-editor-history-action="redo"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runNativeHistory("redo")}
            title="やり直す（Ctrl/Cmd+Y）"
            className="rounded border border-ink/20 px-3 py-1 text-xs text-ink/70 hover:bg-ink/5"
          >
            <span aria-hidden="true">↷</span> やり直す
          </button>
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
            onClick={onImportTxt}
            className="rounded border border-ink/20 px-3 py-1 text-xs text-ink/70 hover:bg-ink/5"
          >
            TXTを読み込む
          </button>
          <button
            type="button"
            onClick={onExportTxt}
            className="rounded border border-ink/20 px-3 py-1 text-xs text-ink/70 hover:bg-ink/5"
          >
            TXTを書き出す
          </button>
          <button type="button" onClick={onOpenMemo} className="rounded border border-ink/20 px-3 py-1 text-xs text-ink/70 hover:bg-ink/5">メモ</button>
          <button type="button" onClick={onOpenChecklist} className="rounded border border-ink/20 px-3 py-1 text-xs text-ink/70 hover:bg-ink/5">完成前チェック</button>
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

      {/* TSP-LOOP-022: on a phone 設定 is its own workspace (rendered by
          TategakiEditor, `md:hidden`), so this inline settings strip is
          desktop / tablet-wide only. TSP-LOOP-023: it also hides in desktop
          「集中モード」 — the whole point of focus mode is to give the
          manuscript this space; the settings data is untouched and the strip
          returns on exit. */}
      <div
        id="tsp-settings"
        className={`flex-none ${focusMode ? "hidden" : "hidden md:block"}`}
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
          Phone: a fixed-height intentional manuscript scroll surface inside
          the scrolling document (TSP-022 gave it more of the viewport now
          that the settings strip is a separate workspace); desktop: flex-1
          fills the pane. */}
      <div className={`relative min-h-0 ${guidedViewport ? "max-md:flex-1" : "max-md:h-[62dvh]"} md:flex-1`}>
        {writingCheckEnabled && (
          <WritingCheckOverlay
            textareaRef={textareaRef}
            text={content}
            issues={writingIssuesForContent}
          />
        )}
        <textarea
          ref={textareaRef}
          data-demo-target="editor"
          value={content}
          onBeforeInput={(event) => {
            const nativeEvent = event.nativeEvent as InputEvent;
            captureTextareaInput(event.currentTarget, nativeEvent.inputType ?? "");
          }}
          // Explicit fallbacks preserve selection-aware Cut/Paste accounting
          // in browsers that do not expose InputEvent.inputType reliably.
          onPaste={(event) => captureTextareaInput(event.currentTarget, "insertFromPaste")}
          onCut={(event) => captureTextareaInput(event.currentTarget, "deleteByCut")}
          onChange={(e) => {
            const next = e.target.value;
            // Any edit that isn't exactly the automated fix's own output
            // ends the one-step undo window (see `undoState`'s own doc).
            if (undoState && next !== undoState.after) setUndoState(null);
            const transition = applyTextInputChange(inputActivityStateRef.current, next);
            inputActivityStateRef.current = transition.state;
            onRecordActivity(transition.delta);
            onContentChange(next);
            requestAnimationFrame(reportCursorIndex);
          }}
          onSelect={reportCursorIndex}
          onClick={reportCursorIndex}
          onKeyUp={reportCursorIndex}
          onCompositionStart={(event) => {
            isComposingRef.current = true;
            const el = event.currentTarget;
            inputActivityStateRef.current = startComposition(
              inputActivityStateRef.current,
              el.value,
              el.selectionStart,
              el.selectionEnd
            );
          }}
          onCompositionEnd={(event) => {
            isComposingRef.current = false;
            const transition = finishComposition(
              inputActivityStateRef.current,
              event.currentTarget.value
            );
            inputActivityStateRef.current = transition.state;
            onRecordActivity(transition.delta);
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
        text={content}
        issues={writingIssuesForContent}
        onSelectIssue={handleSelectWritingIssue}
        onFixIssue={handleFixIssue}
        onIgnoreIssue={handleIgnoreIssue}
        onBulkFix={handleBulkFix}
        onOpenSettings={() => setSettingsOpen(true)}
        undoAvailable={undoState !== null}
        onUndo={handleUndoFix}
      />

      {settingsOpen && (
        <WritingCheckSettingsPanel
          onClose={() => setSettingsOpen(false)}
          presetId={presetId}
          ruleOverrides={ruleOverrides}
          onSelectPreset={selectPreset}
          onSetRuleEnabled={setRuleEnabled}
          dictionaryEntries={dictionary.entries}
          onAddDictionaryEntry={dictionary.addEntry}
          onRemoveDictionaryEntry={dictionary.removeEntry}
          ngWordEntries={ngWords.entries}
          onAddNgWordEntry={ngWords.addEntry}
          onRemoveNgWordEntry={ngWords.removeEntry}
        />
      )}

      {/* Compact syntax help never creates a second line; touch/keyboard users
          can open its full text without permanently growing the footer. */}
      <div className="flex flex-none flex-col gap-1.5 border-t border-ink/10 px-4 py-2 text-xs text-ink/60">
        <EditorSyntaxHelp />
        <div
          data-editor-footer-controls
          className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5"
        >
          <WorkSessionTracker
            state={workSession}
            onStart={onStartWorkSession}
            onEnd={onEndWorkSession}
          />
          <span
            title="現在の原稿文字数"
            className="shrink-0 whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-paper-ink"
          >
            現在の原稿文字数 {countVisualLength(content)}文字
          </span>
        </div>
      </div>
    </div>
  );
}
