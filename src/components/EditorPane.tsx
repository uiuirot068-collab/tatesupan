import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { countVisualLength, insertPageBreakMarker, PAGE_BREAK_MARKER } from "@/lib/tategaki";
import { ensureLongtaskObserver, getEditorProbeMode, isPerfDebugEnabled, perfMark, perfSpan } from "@/lib/perfDebug";
import DiagnosticShadowEditor from "./DiagnosticShadowEditor";
import WindowedEditorProbe from "./WindowedEditorProbe";
import PagedEditor, { type PagedEditorHandle } from "./PagedEditor";
import { isWindowedEditorEnabled } from "@/lib/editorSurfaceRollout";
import { applyBulkFix, applyFix, filterIgnored, runWritingCheck, type WritingCheckConfig, type WritingDiagnostic } from "@/lib/writingCheckEngine";
import { resolvePostFixCaretTarget, WRITING_CHECK_POST_FIX_NAVIGATION } from "@/lib/writingCheckPostFixNavigation";
import { resolveTextareaDeletion, type TextareaDeletionSnapshot } from "@/lib/editorInputIntegrity";
import { useWritingCheckEnabled } from "@/hooks/useWritingCheckEnabled";
import { useEditorFooterCollapsed } from "@/hooks/useEditorFooterCollapsed";
import { useWritingCheckDictionary } from "@/hooks/useWritingCheckDictionary";
import { useWritingCheckNgWords } from "@/hooks/useWritingCheckNgWords";
import { useWritingCheckRuleConfig } from "@/hooks/useWritingCheckRuleConfig";
import { useReviewHubDisclosure } from "@/hooks/useReviewHubDisclosure";
import { summarizeWritingIssues } from "@/lib/writingCheckSummary";
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
import EditorSyntaxHelp from "./EditorSyntaxHelp";
import WorkSessionTracker from "./WorkSessionTracker";
import WritingCheckOverlay from "./WritingCheckOverlay";
import WritingCheckBar from "./WritingCheckBar";
import WritingCheckSettingsPanel from "./WritingCheckSettingsPanel";
import InlineMemoAccordion from "./InlineMemoAccordion";
import { CharacterCountReviewSection, ReviewHubPanel, ReviewHubTrigger, WritingCheckReviewSection } from "./ReviewHub";
import { ReviewHubFooterPinnedTools } from "./ReviewHubFooterPinnedTools";
import { ReadAloudFooterControl, ReadAloudReviewSection } from "./ReadAloudControls";
import { DesktopReviewBar } from "./DesktopReviewBar";
import { ReadAloudPronunciationSection } from "./ReadAloudPronunciationPanel";
import { useReadAloudPronunciation } from "@/hooks/useReadAloudPronunciation";
import type { ReviewSurface } from "@/hooks/useReviewSurface";
import { captureHeldSelection, sameHeldSelection, validHeldSelection, type HeldSelection } from "@/lib/readAloudHeldSelection";
import { stepDescriptionCandidate } from "@/lib/descriptionCandidateNav";
import { useReadAloud } from "@/hooks/useReadAloud";
import { useDescriptionCheck } from "@/hooks/useDescriptionCheck";
import DescriptionMarkOverlay from "./DescriptionMarkOverlay";
import {
  DescriptionCheckFooterPill,
  DescriptionCheckReviewSection,
  DescriptionMarkDetailCard,
} from "./DescriptionCheckControls";
import { findMarkAt, type DescriptionMark } from "@/lib/descriptionCheckManuscript";
import { useReviewHubFooterPins } from "@/hooks/useReviewHubFooterPins";

// TSP-LOOP-004: debounce between a keystroke and a re-check. Long enough to
// avoid re-analysing on every key of a fast typist, short enough to feel live.
const WRITING_CHECK_DEBOUNCE_MS = 300;

const DEFAULT_INITIAL_TEXT = `■ 基本的な機能と記法

1. ここに本文を入力してください
2. 上部の「ドキュメント名」はファイルの保存名になります

■ 上部メニューの使い方
・▶設定：用紙・余白・フォント・段組み・ノンブル・柱
・▶オプション：奥付・目次・完成前チェック・TXT出入力
・▶メモ：プロットや執筆メモ
・▶ヘルプ：ショートカットキーや特殊記法

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
  onPauseWorkSession: () => void;
  onResumeWorkSession: () => void;
  onEndWorkSession: () => CompletedWorkSession | null;
  onOpenSearchReplace: () => void;
  /** Opens the existing beta Report flow. Omitted when beta feedback is disabled. */
  onOpenBetaFeedback?: () => void;
  onOpenOptions: () => void;
  onToggleMemo: () => void;
  memoOpen: boolean;
  memoStorageKey: string;
  confirmedMemo: string;
  onConfirmMemo: (memo: string) => void;
  onCloseMemo: () => void;
  onOpenSettingsDrawer: () => void;
  onOpenHelp: () => void;
  /** Fired whenever the caret's character index into `content` changes, so the preview can scroll to the matching page. */
  onCursorIndexChange?: (index: number) => void;
  /**
   * Canonical 集中モード flag. Existing `< md` suppression stays intact;
   * at `md+`, writing-adjacent settings/status surfaces are visually hidden
   * without changing their underlying state.
   */
  focusMode?: boolean;
  /**
   * Exits desktop focus mode, restoring the global header. Reuses the same
   * `exitFocusMode` handler as the header's own toggle and MobileEditorNav —
   * this is not a second focus-mode state. Only rendered (as `通常に戻す`
   * beside 報告) at `md+` while `focusMode` is on, since the header — and its
   * own toggle — is hidden there; mobile keeps its existing exit affordance.
   */
  onExitFocus?: () => void;
  /** Demo-only narrow viewport shell: let the manuscript fill remaining height and scroll internally. */
  /**
   * TSP-FRIEND-QA-MOBILE-VISUAL-VIEWPORT-001: true while the mobile
   * on-screen keyboard appears open (see `useMobileKeyboardViewport`).
   * Temporarily folds away the bottom footer chrome (syntax help,
   * writing-check bar, work counter -- both the expanded and one-line
   * collapsed forms) to free height for the textarea -- never persisted,
   * and clears automatically the moment the keyboard closes. The
   * settings/options/memo/help row, the title, the undo/redo/page-break/
   * replace/report action row, and the textarea itself are unaffected
   * (kept reachable, per the existing `focusMode`-only contract those
   * controls already have). Always false outside mobile scope, so desktop
   * is unchanged.
   */
  keyboardActive?: boolean;
  /**
   * TSP-Review-UI (Revision 4): where pinned Review tools (音読β / 描写・修飾チェックβ) render.
   * "desktop" portals the interactive `<DesktopReviewBar>` (見直し + per-tool quick popovers) into
   * `reviewBarNode` (a mount point TategakiEditor renders at the bottom of the Preview pane);
   * "compact" shows a one-line mini control instead and the full Review Hub panel becomes a
   * Bottom Sheet. See `useReviewSurface`.
   */
  reviewSurface: ReviewSurface;
  /** The DOM node to portal the Desktop Review Bar into. Only used while `reviewSurface === "desktop"`. */
  reviewBarNode?: HTMLDivElement | null;
}

export interface EditorPaneHandle {
  /**
   * TSP-EDITOR-PAGINATION-AND-PREVIEW-NAVIGATION-009 Phase 6: navigates the
   * editor to canonical offset range `[start, end)` -- e.g. a Preview page
   * click. Routes to the paged editor's own page switch when it's mounted,
   * or a plain `setSelectionRange` on the legacy full-document textarea
   * otherwise. Never mutates `content`.
   */
  navigateToGlobalOffset(start: number, end: number): void;
}

function EditorPaneInner(
  {
    title,
    onTitleChange,
    content,
    onContentChange,
    workSession,
    onRecordActivity,
    onStartWorkSession,
    onPauseWorkSession,
    onResumeWorkSession,
    onEndWorkSession,
    onOpenSearchReplace,
    onOpenBetaFeedback,
    onOpenOptions,
    onToggleMemo,
    memoOpen,
    memoStorageKey,
    confirmedMemo,
    onConfirmMemo,
    onCloseMemo,
    onOpenSettingsDrawer,
    onOpenHelp,
    onCursorIndexChange,
    focusMode = false,
    onExitFocus,
    keyboardActive = false,
    reviewSurface,
    reviewBarNode = null,
  }: EditorPaneProps,
  ref: React.Ref<EditorPaneHandle>
) {
  perfMark("EditorPane:render", { contentLength: content.length });
  ensureLongtaskObserver();
  // TSP-LONG-DOCUMENT-EDITOR-SURFACE-FORENSIC-005: the paint-probe rAF chain
  // below was being rescheduled on every keystroke with no coalescing, so a
  // fast typing burst queued many overlapping rAF1->rAF2 chains -- adding
  // real (if small) rAF callback pressure of its own and muddying the
  // report's picture of where time actually goes. At most one chain may be
  // outstanding at a time now.
  const paintProbePendingRef = useRef(false);
  // TSP-EDITOR-NATIVE-SURFACE-AB-006: which diagnostic-only editor surface
  // variant to render (`?perfDebug=1&editorProbe=<mode>`). Always "normal"
  // outside perfDebug, so this can never affect normal product behavior.
  const probeMode = isPerfDebugEnabled() ? getEditorProbeMode() : "normal";
  const logNativeEvent = (
    type: string,
    el: HTMLTextAreaElement,
    extra?: Record<string, string | number | boolean | null>
  ) => {
    perfMark(`EditorPane:native:${type}`, {
      selectionStart: el.selectionStart,
      selectionEnd: el.selectionEnd,
      isComposing: isComposingRef.current,
      contentLength: el.value.length,
      ...extra,
    });
  };
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // TSP-EDITOR-PAGINATION-AND-PREVIEW-NAVIGATION-009: internal rollout gate,
  // off by default (see editorSurfaceRollout.ts) -- independent of the
  // perfDebug-only `probeMode === "windowed"` diagnostic probe above. When
  // enabled, <PagedEditor> (one ~50k-char 編集ページ mounted at a time)
  // replaces the plain full-document textarea; every other feature below
  // (undo/redo, page-break insertion, writing-check jump) is routed through
  // `pagedEditorRef`'s imperative handle instead of `textareaRef` so the
  // SAME call sites serve both editor surfaces.
  const isWindowed = isWindowedEditorEnabled();
  const pagedEditorRef = useRef<PagedEditorHandle>(null);
  const inputActivityStateRef = useRef(createTextInputActivityState(content));
  const deletionSnapshotRef = useRef<TextareaDeletionSnapshot | null>(null);
  // TSP-EDITOR-LIVE-INPUT-LATENCY-002: `useDeferredValue` only lowers this
  // recompute's scheduler priority -- it cannot interrupt `countVisualLength`
  // (which re-tokenizes the WHOLE manuscript) mid-call, so on a 260k-char
  // document the "deferred" low-priority render still ran inside the same
  // task as the keystroke's own commit, blocking the browser's paint of the
  // just-typed character. A real `setTimeout` macrotask boundary (matching
  // PreviewPane's own content debounce) guarantees a paint opportunity first.
  const VISUAL_LENGTH_DEBOUNCE_MS = 180;
  const [deferredContent, setDeferredContent] = useState(content);
  useEffect(() => {
    perfMark("EditorPane:visualLengthDebounce:scheduled", { contentLength: content.length });
    const timer = window.setTimeout(() => {
      perfMark("EditorPane:visualLengthDebounce:fired", { contentLength: content.length });
      setDeferredContent(content);
    }, VISUAL_LENGTH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [content]);
  const visualLength = useMemo(() => {
    const end = perfSpan("EditorPane:countVisualLength", { contentLength: deferredContent.length });
    const result = countVisualLength(deferredContent);
    end();
    return result;
  }, [deferredContent]);

  // Parent-driven changes (load/switch, structural UI, Preview operations)
  // become the next input baseline without themselves becoming activity.
  useEffect(() => {
    const before = inputActivityStateRef.current;
    const after = syncTextInputActivityState(before, content);
    perfMark("EditorPane:syncEffect:fired", {
      contentLength: content.length,
      hadPendingBeforeInput: before.pendingBeforeInput !== null,
      wasMismatch: before.lastText !== content,
      clearedPending: before.pendingBeforeInput !== null && before.lastText !== content,
    });
    inputActivityStateRef.current = after;
  }, [content]);

  // Keep the textarea's native browser history as the single source of truth.
  // Preventing toolbar focus on pointer-down preserves the current selection;
  // execCommand then takes the same native undo/redo path as Ctrl/Cmd+Z/Y and
  // emits the ordinary input event consumed by the controlled textarea.
  const runNativeHistory = (command: "undo" | "redo") => {
    const el = textareaRef.current;
    if (!el) return;
    deletionSnapshotRef.current = null;
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

  // Phase 6 (windowed-editor production parity): native textarea history does
  // not survive a window shift (assigning `.value` to a DIFFERENT string
  // clears the browser's own undo stack -- see WindowedEditor.tsx's module
  // doc), so the toolbar buttons must route to the windowed editor's own
  // application-level undo/redo instead of `execCommand` while it's mounted.
  const runHistory = (command: "undo" | "redo") => {
    if (isWindowed) {
      pagedEditorRef.current?.runHistory(command);
      return;
    }
    runNativeHistory(command);
  };

  // ---- TSP-LOOP-004 → 文章チェック β 2.0 (local, deterministic, no network) ----
  const [writingCheckEnabled, setWritingCheckEnabled] = useWritingCheckEnabled();
  // TSP-RC-LATIN-AND-MOBILE-COMPACT-001: collapse/expand for the 文章
  // チェックβ + 作業カウンター footer area (mobile input-area space).
  const [footerCollapsed, setFooterCollapsed] = useEditorFooterCollapsed();
  const isComposingRef = useRef(false);
  const [recheckNonce, setRecheckNonce] = useState(0);
  const { presetId, ruleOverrides, selectPreset, setRuleEnabled } = useWritingCheckRuleConfig();
  const dictionary = useWritingCheckDictionary();
  const ngWords = useWritingCheckNgWords();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // TSP-B1 Review Hub: session-only open state that follows the footer's own
  // focus-mode / mobile-keyboard hiding, plus a counter that asks the existing
  // WritingCheckBar to open its result list.
  const paneRef = useRef<HTMLDivElement>(null);
  // TSP-Review-UI (Revision 4): the Review Hub panel can be portalled into the Desktop Review Bar
  // (bottom of Preview) instead of rendered inline here -- a press inside it is DOM-outside
  // `reviewHubFooterRef`, so it must count as "inside" for the disclosure hook's outside-press check
  // too, or the panel would close itself the instant it opens on the desktop surface.
  const desktopBarWrapperRef = useRef<HTMLDivElement>(null);
  // (destructured on purpose: the hook also returns a ref, and React Compiler lint
  // treats property reads on a value that carries a ref as ref access during render)
  const {
    open: reviewHubOpen,
    toggle: toggleReviewHub,
    close: closeReviewHub,
    wrapperRef: reviewHubFooterRef,
    onKeyDown: handleReviewHubKeyDown,
    maxHeightPx: reviewHubMaxHeightPx,
  } = useReviewHubDisclosure({ focusMode, keyboardActive }, paneRef, [desktopBarWrapperRef]);
  const [writingCheckResultsRequest, setWritingCheckResultsRequest] = useState(0);
  // TSP-B2: which Review Hub tools are shown in the footer. 文章チェックβ's footer strip / one-line checkbox follow
  // this (display only -- `writingCheckEnabled` is separate). With both shown, pin order = top-to-bottom order.
  const { pins: footerPins } = useReviewHubFooterPins();
  const writingCheckPinned = footerPins.includes("writing-check");
  // TSP-B4 音読β: ONE controller for the Hub section and the footer control. It reads the selection / caret /
  // manuscript only at the moment of a press (never automatically) and hands the text to the device speech engine only.
  // TSP-B4 (Revision 3): local pronunciation dictionary, browser-local, applied only to plain text (ruby always wins) -- see readAloudPronunciation.ts.
  const pronunciation = useReadAloudPronunciation();
  const getReadAloudSource = useCallback(() => {
    if (isWindowed) {
      return { content, selection: pagedEditorRef.current?.getSelectionGlobal() ?? { start: 0, end: 0 }, pronunciation: pronunciation.entries };
    }
    const el = textareaRef.current;
    return { content, selection: { start: el?.selectionStart ?? 0, end: el?.selectionEnd ?? 0 }, pronunciation: pronunciation.entries };
  }, [content, isWindowed, pronunciation.entries]);
  const readAloud = useReadAloud(memoStorageKey, getReadAloudSource);
  // TSP-B4 (Revision 2) held 選択範囲: the browser keeps a textarea's selection when focus moves to the footer / Review
  // Hub but stops PAINTING it. We record the last non-empty selection so the UI can say 「選択範囲を保持中」 (and paint a
  // ghost highlight) -- and derive validity (same document, same text at the same place), so a stale range is never shown.
  const [heldRaw, setHeldRaw] = useState<HeldSelection | null>(null);
  const held = useMemo(() => validHeldSelection(heldRaw, content, memoStorageKey), [heldRaw, content, memoStorageKey]);
  const refreshHeldSelection = useCallback(() => {
    const source = getReadAloudSource();
    const next = captureHeldSelection(source.content, source.selection, memoStorageKey);
    setHeldRaw((previous) => (sameHeldSelection(previous, next) ? previous : next));
  }, [getReadAloudSource, memoStorageKey]);
  // TSP-B5 描写語・修飾表現チェックβ: default OFF; while OFF nothing is analysed. The caret is tracked (only while ON) so the
  // candidate under it can show its category / reason -- the "select a marker, see why" detail.
  const descriptionCheck = useDescriptionCheck(content, () => isComposingRef.current, recheckNonce);
  // -1 = the writer has not put a caret anywhere yet: no candidate is 'under the caret' until they do.
  const [descriptionCaret, setDescriptionCaret] = useState(-1);
  const [descriptionDismissed, setDescriptionDismissed] = useState<DescriptionMark | null>(null);
  // The candidate last visited with 前へ / 次へ (the caret's candidate wins while the caret is inside one).
  const [descriptionNavMark, setDescriptionNavMark] = useState<DescriptionMark | null>(null);
  // Focusing the editor for 前へ / 次へ makes the browser / React report the OLD selection first; those stale reports must
  // not un-mark the candidate we just moved to, so cursor events are ignored for a moment after a navigation.
  const descriptionNavGuardUntil = useRef(0);
  const {
    enabled: descriptionEnabled,
    current: descriptionCurrent,
    marks: descriptionMarks,
    analysisText: descriptionAnalysisText,
  } = descriptionCheck;
  const descriptionActiveMark = useMemo(
    () => (descriptionEnabled && descriptionCurrent ? findMarkAt(descriptionMarks, descriptionCaret) : null),
    [descriptionEnabled, descriptionCurrent, descriptionMarks, descriptionCaret]
  );
  const descriptionCurrentMark = useMemo(() => {
    if (descriptionActiveMark) return descriptionActiveMark;
    const nav = descriptionNavMark;
    if (!nav) return null;
    return descriptionMarks.find((mark) => mark.start === nav.start && mark.end === nav.end && mark.ruleId === nav.ruleId) ?? null;
  }, [descriptionActiveMark, descriptionNavMark, descriptionMarks]);
  const handleCursorIndexChange = useCallback(
    (index: number) => {
      if (performance.now() < descriptionNavGuardUntil.current) {
        onCursorIndexChange?.(index);
        return;
      }
      if (descriptionEnabled) setDescriptionCaret(index);
      // The place 前へ / 次へ marked stays marked only while the caret is still on it.
      setDescriptionNavMark((nav) => (nav && (index < nav.start || index >= nav.end) ? null : nav));
      refreshHeldSelection();
      onCursorIndexChange?.(index);
    },
    [descriptionEnabled, refreshHeldSelection, onCursorIndexChange]
  );
  const descriptionPagedProps = useMemo(
    () => (descriptionEnabled ? { enabled: true, analysisText: descriptionAnalysisText, marks: descriptionMarks } : undefined),
    [descriptionEnabled, descriptionAnalysisText, descriptionMarks]
  );
  // Ghost highlights (blue, behind the text): B4's held 選択範囲 while 選択範囲 is the reading target, and the candidate B5's
  // 前へ / 次へ is on (so the place stays obvious even when the editor is not focused, e.g. after blurring on a phone).
  const ghostRanges = useMemo(() => {
    const ranges: { start: number; end: number }[] = [];
    if (readAloud.target === "selection" && held) ranges.push({ start: held.start, end: held.end });
    if (descriptionEnabled && footerPins.includes("description-check") && descriptionNavMark && descriptionCurrentMark) {
      ranges.push({ start: descriptionCurrentMark.start, end: descriptionCurrentMark.end });
    }
    return ranges;
  }, [readAloud.target, held, descriptionEnabled, footerPins, descriptionNavMark, descriptionCurrentMark]);
  const readAloudViewProps = {
    state: readAloud.state,
    target: readAloud.target,
    onTargetChange: readAloud.setTarget,
    held,
    onStart: readAloud.start,
    onStartTarget: readAloud.startTarget,
    onPause: readAloud.pause,
    onResume: readAloud.resume,
    onStop: readAloud.stop,
    onRateChange: readAloud.setRate,
    onVoiceChange: readAloud.setPreferredVoice,
  };
  const footerToolsSwapped =
    writingCheckPinned && footerPins.includes("character-count") && footerPins.indexOf("character-count") < footerPins.indexOf("writing-check");
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
      const end = perfSpan("EditorPane:runWritingCheck", { contentLength: content.length });
      const issues = runWritingCheck(content, writingCheckConfig);
      end({ issueCount: issues.length });
      setAnalysis({ text: content, issues });
    }, WRITING_CHECK_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [content, writingCheckEnabled, recheckNonce, writingCheckConfig]);

  const analysisCurrent = analysis.text === content;
  const writingIssuesForAnalysis = useMemo(
    () => filterIgnored(analysis.issues, ignoredIds),
    [analysis.issues, ignoredIds]
  );
  const writingIssuesForContent = analysisCurrent ? writingIssuesForAnalysis : [];

  const reportCursorIndex = () => {
    const el = textareaRef.current;
    if (!el) return;
    perfMark("EditorPane:cursorIndex", { index: el.selectionStart });
    perfMark("EditorPane:native:select", {
      selectionStart: el.selectionStart,
      selectionEnd: el.selectionEnd,
      isComposing: isComposingRef.current,
      contentLength: el.value.length,
    });
    handleCursorIndexChange(el.selectionStart);
  };

  /**
   * Shared navigation entry point for both a Writing Check issue click
   * (Phase 8) and a Preview page click (Phase 6) -- never mutates `content`.
   * Routes to the paged editor's own page switch when it's mounted, or a
   * plain `setSelectionRange` on the legacy full-document textarea otherwise.
   */
  const navigateToGlobalOffset = (start: number, end: number) => {
    if (isWindowed) {
      const s = Math.min(start, content.length);
      const e = Math.min(end, content.length);
      pagedEditorRef.current?.moveSelectionToGlobal(s, e);
      return;
    }
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    const s = Math.min(start, el.value.length);
    const e = Math.min(end, el.value.length);
    el.setSelectionRange(s, e);
    reportCursorIndex();
  };

  /** B5 前へ / 次へ: visit the next candidate of the categories that are on. On a phone the editor is blurred again so the software keyboard does not swallow the footer; the ghost highlight keeps the place visible. */
  const stepDescription = (dir: 1 | -1) => {
    const step = stepDescriptionCandidate(descriptionMarks, descriptionCurrentMark, descriptionCaret, dir);
    if (!step) return;
    descriptionNavGuardUntil.current = performance.now() + 500;
    setDescriptionNavMark(step.mark);
    setDescriptionCaret(step.mark.start);
    setDescriptionDismissed(null);
    navigateToGlobalOffset(step.mark.start, step.mark.end);
    window.setTimeout(refreshHeldSelection, 550); // the phrase is now selected: let B4's held selection follow once the guard has passed
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      requestAnimationFrame(() => (document.activeElement as HTMLElement | null)?.blur?.());
    }
  };

  const handleSelectWritingIssue = (issue: WritingDiagnostic) => {
    navigateToGlobalOffset(issue.start, issue.end);
  };

  useImperativeHandle(ref, (): EditorPaneHandle => ({ navigateToGlobalOffset }), [navigateToGlobalOffset]);

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
    // TSP-PAGED-EDITOR-QA-FIXES-AND-DEMO-010 §E: see writingCheckPostFixNavigation.ts's
    // own doc -- the current default (RETURN_TO_PREVIOUS) resolves to `null`
    // here, so this is a no-op and today's Human-QA-approved behavior is
    // unchanged; flipping the policy constant is the only future change needed.
    const postFixTarget = resolvePostFixCaretTarget(WRITING_CHECK_POST_FIX_NAVIGATION, {
      start: issue.start,
      replacementLength: issue.suggestedReplacement?.text.length ?? 0,
    });
    if (postFixTarget != null) navigateToGlobalOffset(postFixTarget, postFixTarget);
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

  const captureTextareaInput = (el: HTMLTextAreaElement, inputType: string) => {
    perfMark("EditorPane:beforeinput", {
      inputType,
      selectionStart: el.selectionStart,
      selectionEnd: el.selectionEnd,
      isComposing: isComposingRef.current,
      contentLength: el.value.length,
    });
    inputActivityStateRef.current = captureBeforeInput(inputActivityStateRef.current, {
      beforeText: el.value,
      selectionStart: el.selectionStart,
      selectionEnd: el.selectionEnd,
      inputType,
    });
    deletionSnapshotRef.current = {
      beforeText: el.value,
      selectionStart: el.selectionStart,
      selectionEnd: el.selectionEnd,
      inputType,
    };
  };

  // React's onBeforeInput prop does not reliably expose InputEvent.inputType
  // for textarea edits. Read the native event directly, matching PagedEditor,
  // so the FULL rollback surface enforces the same deletion contract.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const listener = (event: Event) => {
      captureTextareaInput(el, (event as InputEvent).inputType ?? "");
    };
    el.addEventListener("beforeinput", listener);
    return () => el.removeEventListener("beforeinput", listener);
  });

  const insertPageBreak = () => {
    const selection = isWindowed
      ? pagedEditorRef.current?.getSelectionGlobal() ?? { start: content.length, end: content.length }
      : { start: textareaRef.current?.selectionStart ?? content.length, end: textareaRef.current?.selectionEnd ?? content.length };
    const { start, end } = selection;
    const before = content.slice(0, start);
    const after = content.slice(end);
    // A break inserted mid-line (the common case: cursor between two
    // sentences on the same line) must still land on its own line, or the
    // marker would render as literal text instead of a real page break —
    // see `insertPageBreakMarker`'s doc.
    const marker = insertPageBreakMarker(before, after);
    const caretOffsetInMarker = marker.indexOf(PAGE_BREAK_MARKER) + PAGE_BREAK_MARKER.length;

    if (isWindowed) {
      // Dedicated structural page-break UI is explicitly outside 11-B.
      // WindowedEditor's own undo model records this as one atomic,
      // undoable edit (Phase 6: "page-break insertion is undoable").
      pagedEditorRef.current?.replaceRangeGlobal(start, end, marker, { caretOffsetInInsertedText: caretOffsetInMarker });
      return;
    }

    const el = textareaRef.current;
    const next = before + marker + after;
    // Dedicated structural page-break UI is explicitly outside 11-B.
    inputActivityStateRef.current = syncTextInputActivityState(inputActivityStateRef.current, next);
    onContentChange(next);
    const caret = start + caretOffsetInMarker;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  const resumeWorkSession = () => {
    // Paused-period edits are valid manuscript changes but must never become
    // one large insertion when counting resumes. Re-anchor to the current
    // controlled document and clear any stale beforeinput/composition state.
    inputActivityStateRef.current = createTextInputActivityState(content);
    onResumeWorkSession();
  };

  // TSP-B1: Review Hub entries reuse the existing 文章チェックβ surfaces. The
  // mobile one-line footer hides both the result list and the settings
  // dialog's host, so expand it first — the same action as its own ▲ button.
  const revealWritingCheckSurface = () => {
    closeReviewHub();
    if (footerCollapsed) setFooterCollapsed(false);
  };
  const handleReviewHubShowResults = () => {
    revealWritingCheckSurface();
    setWritingCheckResultsRequest((value) => value + 1);
  };
  const handleReviewHubOpenSettings = () => {
    revealWritingCheckSurface();
    setSettingsOpen(true);
  };

  // TSP-Review-UI (Revision 4): ONE element, used in exactly one of two mutually-exclusive places
  // depending on `reviewSurface` -- portalled into the Desktop Review Bar (bottom of Preview) on
  // "desktop", or rendered inline here (its own `sheet` variant) on "compact". Built once so both
  // call sites always agree on open state / sections / content.
  const reviewHubPanelElement = (
    <ReviewHubPanel
      open={reviewHubOpen}
      onClose={closeReviewHub}
      maxHeightPx={reviewHubMaxHeightPx}
      sheet={reviewSurface === "compact"}
      sections={{
        "writing-check": (
          <WritingCheckReviewSection
            enabled={writingCheckEnabled}
            onToggle={setWritingCheckEnabled}
            summary={summarizeWritingIssues(writingIssuesForContent)}
            onShowResults={handleReviewHubShowResults}
            onOpenSettings={handleReviewHubOpenSettings}
          />
        ),
        "character-count": <CharacterCountReviewSection count={visualLength} />,
        "read-aloud": (
          <>
            <ReadAloudReviewSection {...readAloudViewProps} />
            <ReadAloudPronunciationSection
              held={held}
              entries={pronunciation.entries}
              onUpsert={pronunciation.upsertEntry}
              onRemove={pronunciation.removeEntry}
            />
          </>
        ),
        "description-check": (
          <DescriptionCheckReviewSection
            enabled={descriptionCheck.enabled}
            categories={descriptionCheck.categories}
            onToggle={descriptionCheck.setEnabled}
            onToggleCategory={descriptionCheck.toggleCategory}
            marks={descriptionCheck.marks}
            current={descriptionCheck.current}
            activeMark={descriptionActiveMark}
            onJump={(mark) => navigateToGlobalOffset(mark.start, mark.end)}
          />
        ),
      }}
    />
  );

  return (
    <div ref={paneRef} className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-base">
      <div className="flex flex-none flex-col gap-1.5 border-b border-ink/10 px-2 py-1.5 md:gap-2 md:px-4 md:py-3">
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="ドキュメント・タイトル名"
          data-demo-target="title"
          className={`w-full min-w-0 bg-transparent text-base font-bold text-ink outline-none placeholder:text-ink/40 md:text-lg ${focusMode ? "max-md:hidden" : ""}`}
        />
        <div data-editor-action-row="" className={`grid min-w-0 max-w-full ${focusMode ? "grid-cols-[44px_44px_max-content_max-content_max-content_max-content]" : "grid-cols-[44px_44px_max-content_max-content_max-content]"} items-stretch justify-center gap-0.5 sm:gap-1 md:flex md:flex-wrap md:items-center md:justify-end md:gap-2 md:@max-[905px]:gap-1`}>
          <button
            type="button"
            data-editor-action="undo"
            data-editor-history-action="undo"
            aria-label="元に戻す"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runHistory("undo")}
            title="元に戻す（Ctrl/Cmd+Z）"
            className="inline-flex min-h-9 min-w-11 items-center justify-center gap-1 rounded border border-ink/20 px-2 text-ink/70 hover:bg-ink/5 md:min-h-0 md:px-3 md:py-1 md:text-xs md:@max-[905px]:[&>span:not([aria-hidden])]:hidden"
          >
            <span aria-hidden="true" className="text-xl leading-none md:text-xs md:@max-[905px]:text-[16px]">↶</span>
            <span className="hidden md:inline">元に戻す</span>
          </button>
          <button
            type="button"
            data-editor-action="redo"
            data-editor-history-action="redo"
            aria-label="やり直す"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runHistory("redo")}
            title="やり直す（Ctrl/Cmd+Y）"
            className="inline-flex min-h-9 min-w-11 items-center justify-center gap-1 rounded border border-ink/20 px-2 text-ink/70 hover:bg-ink/5 md:min-h-0 md:px-3 md:py-1 md:text-xs md:@max-[905px]:[&>span:not([aria-hidden])]:hidden"
          >
            <span aria-hidden="true" className="text-xl leading-none md:text-xs md:@max-[905px]:text-[16px]">↷</span>
            <span className="hidden md:inline">やり直す</span>
          </button>
          <button
            type="button"
            data-editor-action="page-break"
            onClick={insertPageBreak}
            title="カーソル位置に改ページを挿入"
            className="min-h-9 min-w-0 whitespace-nowrap rounded border border-ink/20 px-2 py-0.5 text-xs text-ink/70 hover:bg-ink/5 md:min-h-0 md:px-3 md:py-1 md:@max-[905px]:px-2"
          >
            改ページ挿入
          </button>
          <button
            type="button"
            data-editor-action="replace"
            onClick={onOpenSearchReplace}
            className="min-h-9 whitespace-nowrap rounded border border-ink/20 px-2 py-0.5 text-xs text-ink/70 hover:bg-ink/5 md:min-h-0 md:px-3 md:py-1 md:@max-[905px]:px-2"
          >
            置換
          </button>
          {focusMode && (
            <button
              type="button"
              data-editor-action="memo"
              aria-expanded={memoOpen}
              onClick={onToggleMemo}
              title="メモを開く/閉じる"
              className="min-h-9 whitespace-nowrap rounded border border-ink/20 px-2 py-0.5 text-xs text-ink/70 hover:bg-ink/5 md:min-h-0 md:px-3 md:py-1"
            >
              📝メモ
            </button>
          )}
          {onOpenBetaFeedback && (
            <button
              type="button"
              data-editor-action="report"
              onClick={onOpenBetaFeedback}
              title="β版フィードバック（不具合・気になる事・要望）"
              className="min-h-9 whitespace-nowrap rounded border border-amber-400 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-100 md:min-h-0 md:px-3 md:py-1 md:@max-[905px]:px-2"
            >
              報告
            </button>
          )}
          {focusMode && onExitFocus && (
            <button
              type="button"
              data-editor-action="exit-focus"
              data-focus-mode-toggle=""
              onClick={onExitFocus}
              title="集中モードを終了して通常表示に戻します"
              className="hidden min-h-9 whitespace-nowrap rounded border border-ink/20 px-2 py-0.5 text-xs font-medium text-ink/70 hover:bg-ink/5 md:inline-flex md:min-h-0 md:px-3 md:py-1"
            >
              通常に戻す
            </button>
          )}
        </div>
        <div className={focusMode ? "hidden" : ""}>
          {/* TSP-RC-LATIN-AND-MOBILE-COMPACT-001: mobile-only padding trim
              (pt-2->pt-1, py-1.5->py-1) to reclaim a few px of manuscript
              height; min-h-10 keeps the tap target unchanged, and every
              md: value is unchanged so desktop is pixel-identical. */}
          <nav data-editor-secondary-row="" aria-label="エディタ機能" className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto_auto] gap-0.5 border-t border-ink/10 pt-1 md:gap-1 md:grid-cols-4 md:pt-2">
            <button type="button" data-editor-secondary="settings" data-demo-target="settings" onClick={onOpenSettingsDrawer} className={`min-h-10 whitespace-nowrap rounded px-1 py-1 text-[11px] font-medium text-ink/70 hover:bg-ink/5 md:min-h-0 md:px-2 md:py-1.5 md:text-xs ${focusMode ? "md:hidden" : ""}`}>▶設定</button>
            <button type="button" data-editor-secondary="options" data-demo-target="options" onClick={onOpenOptions} className={`min-h-10 min-w-0 whitespace-nowrap rounded px-1 py-1 text-[11px] font-medium text-ink/70 hover:bg-ink/5 md:min-h-0 md:px-2 md:py-1.5 md:text-xs ${focusMode ? "md:hidden" : ""}`}>▶オプション</button>
            <button type="button" data-editor-secondary="memo" aria-expanded={memoOpen} onClick={onToggleMemo} className="min-h-10 whitespace-nowrap rounded px-1 py-1 text-[11px] font-medium text-ink/70 hover:bg-ink/5 md:min-h-0 md:px-2 md:py-1.5 md:text-xs">{memoOpen ? "▼メモ" : "▶メモ"}</button>
            <button type="button" data-editor-secondary="help" data-demo-target="help" onClick={onOpenHelp} className={`min-h-10 whitespace-nowrap rounded px-1 py-1 text-[11px] font-medium text-ink/70 hover:bg-ink/5 md:min-h-0 md:px-2 md:py-1.5 md:text-xs ${focusMode ? "md:hidden" : ""}`}>▶ヘルプ</button>
          </nav>
        </div>
        <InlineMemoAccordion
          key={memoStorageKey}
          open={memoOpen}
          storageKey={memoStorageKey}
          confirmedMemo={confirmedMemo}
          onConfirm={onConfirmMemo}
          onClose={onCloseMemo}
        />
      </div>

      {/* The textarea stays the sole input surface. WritingCheckOverlay is a
          read-only, pointer-events-none mirror rendered behind it (only the
          red wavy underline is visible); it shares the textarea's wrapping
          box via the same p-4/font-mono/text-sm/leading-relaxed classes.
          Phone and desktop both assign remaining pane height here; the
          textarea itself owns vertical scrolling. */}
      <div className="relative min-h-0 flex-1">
        {probeMode === "uncontrolled-shadow" ? (
          <DiagnosticShadowEditor initialContent={content} />
        ) : probeMode === "windowed" ? (
          <WindowedEditorProbe initialContent={content} />
        ) : isWindowed ? (
          // TSP-EDITOR-PAGINATION-AND-PREVIEW-NAVIGATION-009: production
          // long-document editor surface, gated by
          // `resolveEditorSurfaceRolloutMode()` (off by default). Mounts
          // exactly ONE ~50k-char 編集ページ at a time; the writing-check
          // list, jump, fix, ignore, bulk-fix AND the inline red-wavy
          // underline (via `writingCheck`, mapped to page-local coordinates
          // inside PagedEditor) all work here.
          <PagedEditor
            ref={pagedEditorRef}
            content={content}
            onContentChange={(next) => {
              // Mirrors the legacy textarea's own undoState-clearing rule
              // below, compared against canonical text (not a page-local
              // slice) -- see PagedEditor.tsx's module doc.
              if (undoState && next !== undoState.after) setUndoState(null);
              onContentChange(next);
            }}
            onCursorIndexChange={handleCursorIndexChange}
            descriptionMarks={descriptionPagedProps}
            ghostRanges={ghostRanges}
            onNativeKeyDown={(el) => logNativeEvent("keydown", el)}
            onNativeBeforeInput={(el, inputType) => captureTextareaInput(el, inputType)}
            onNativeCompositionStart={(el) => {
              logNativeEvent("compositionstart", el);
              // See the matching disable in the legacy textarea's own handler below.
              // eslint-disable-next-line react-hooks/immutability
              isComposingRef.current = true;
              inputActivityStateRef.current = startComposition(
                inputActivityStateRef.current,
                el.value,
                el.selectionStart,
                el.selectionEnd
              );
            }}
            onNativeCompositionEnd={(el) => {
              logNativeEvent("compositionend", el);
              // eslint-disable-next-line react-hooks/immutability
              isComposingRef.current = false;
              const transition = finishComposition(inputActivityStateRef.current, el.value);
              inputActivityStateRef.current = transition.state;
              onRecordActivity(transition.delta);
              setRecheckNonce((value) => value + 1);
            }}
            onNativeChangeCommitted={(el) => {
              logNativeEvent("input", el, { nextLength: el.value.length });
              const endActivitySpan = perfSpan("EditorPane:applyTextInputChange");
              const transition = applyTextInputChange(inputActivityStateRef.current, el.value);
              endActivitySpan();
              inputActivityStateRef.current = transition.state;
              onRecordActivity(transition.delta);
            }}
            onNativeIntegrityRepair={(el, detail) => {
              perfMark("EditorPane:inputIntegrityRepair", detail);
              // Consume the parent's matching beforeinput snapshot without
              // counting the rejected DOM mutation. The repaired value is the
              // only transaction that reaches activity/source state.
              const transition = applyTextInputChange(inputActivityStateRef.current, el.value);
              inputActivityStateRef.current = transition.state;
            }}
            writingCheck={
              writingCheckEnabled
                ? { enabled: true, analysisText: analysis.text, issues: writingIssuesForAnalysis }
                : undefined
            }
            placeholder={DEFAULT_INITIAL_TEXT}
          />
        ) : (
        <>
        {ghostRanges.length > 0 && (
          <div className="pointer-events-none absolute inset-0">
            <DescriptionMarkOverlay variant="held" textareaRef={textareaRef} text={content} marks={ghostRanges} />
          </div>
        )}
        {descriptionCheck.enabled && (
          <div className={`pointer-events-none absolute inset-0 ${descriptionCheck.current ? "visible" : "invisible"}`}>
            <DescriptionMarkOverlay
              textareaRef={textareaRef}
              text={descriptionCheck.analysisText}
              marks={descriptionCheck.marks}
            />
          </div>
        )}
        {writingCheckEnabled && (
          <div className={`pointer-events-none absolute inset-0 ${analysisCurrent ? "visible" : "invisible"}`}>
            <WritingCheckOverlay
              textareaRef={textareaRef}
              text={analysis.text}
              issues={writingIssuesForAnalysis}
            />
          </div>
        )}
        <textarea
          ref={textareaRef}
          data-demo-target="editor"
          data-editor-probe-mode={probeMode}
          value={content}
          // TSP-EDITOR-NATIVE-SURFACE-AB-006: `wrap="off"` only in the
          // diagnostic-only "nowrap" probe -- normal product behavior keeps
          // the browser default (soft-wrap).
          wrap={probeMode === "nowrap" ? "off" : undefined}
          // TSP-EDITOR-NATIVE-SURFACE-AB-006: autoCorrect/autoCapitalize off
          // only in the diagnostic-only "no-spellcheck" probe -- spellCheck
          // itself is already off in normal product behavior (see below).
          autoCorrect={probeMode === "no-spellcheck" ? "off" : undefined}
          autoCapitalize={probeMode === "no-spellcheck" ? "off" : undefined}
          onKeyDown={(event) => {
            // A beforeinput with no following input (for example Backspace at
            // offset 0) must never describe the next physical key.
            deletionSnapshotRef.current = null;
            logNativeEvent("keydown", event.currentTarget);
          }}
          // Explicit fallbacks preserve selection-aware Cut/Paste accounting
          // in browsers that do not expose InputEvent.inputType reliably.
          onPaste={(event) => captureTextareaInput(event.currentTarget, "insertFromPaste")}
          onCut={(event) => captureTextareaInput(event.currentTarget, "deleteByCut")}
          onChange={(e) => {
            const el = e.currentTarget;
            const snapshot = deletionSnapshotRef.current;
            deletionSnapshotRef.current = null;
            let next = e.target.value;
            if (!isComposingRef.current && snapshot) {
              const rejectedLength = next.length;
              const resolution = resolveTextareaDeletion(snapshot, next);
              if (resolution.repaired) {
                next = resolution.text;
                el.value = next;
                el.setSelectionRange(resolution.selectionStart, resolution.selectionEnd);
                perfMark("EditorPane:inputIntegrityRepair", {
                  inputType: snapshot.inputType,
                  beforeLength: snapshot.beforeText.length,
                  rejectedLength,
                  repairedLength: next.length,
                });
              }
            }
            logNativeEvent("input", el, { nextLength: next.length });
            perfMark("EditorPane:onChange:start", { nextLength: next.length });
            // Any edit that isn't exactly the automated fix's own output
            // ends the one-step undo window (see `undoState`'s own doc).
            if (undoState && next !== undoState.after) setUndoState(null);
            const endActivitySpan = perfSpan("EditorPane:applyTextInputChange");
            const transition = applyTextInputChange(inputActivityStateRef.current, next);
            endActivitySpan();
            inputActivityStateRef.current = transition.state;
            onRecordActivity(transition.delta);
            perfMark("EditorPane:onContentChange:call");
            onContentChange(next);
            perfMark("EditorPane:onChange:end");
            // Two chained rAFs approximate "first paint after this commit":
            // the first fires once the browser is ready to paint the frame
            // that includes this commit, the second confirms a full frame
            // has actually elapsed (not just been scheduled). Coalesced: a
            // fast typing burst shares one outstanding chain instead of
            // queueing a new one per keystroke.
            if (!paintProbePendingRef.current) {
              paintProbePendingRef.current = true;
              requestAnimationFrame(() => {
                perfMark("EditorPane:paint:rAF1");
                requestAnimationFrame(() => {
                  perfMark("EditorPane:paint:rAF2");
                  paintProbePendingRef.current = false;
                });
              });
            }
            requestAnimationFrame(reportCursorIndex);
          }}
          onSelect={reportCursorIndex}
          onClick={reportCursorIndex}
          onKeyUp={reportCursorIndex}
          onBlur={() => {
            deletionSnapshotRef.current = null;
          }}
          onCompositionStart={(event) => {
            const el = event.currentTarget;
            logNativeEvent("compositionstart", el);
            // Ordinary ref flag, unrelated to the writing-check effect's own
            // read of isComposingRef; the rule's effect-adjacency heuristic
            // doesn't apply since React Compiler isn't enabled (AGENTS.md).
            // eslint-disable-next-line react-hooks/immutability
            isComposingRef.current = true;
            deletionSnapshotRef.current = null;
            inputActivityStateRef.current = startComposition(
              inputActivityStateRef.current,
              el.value,
              el.selectionStart,
              el.selectionEnd
            );
          }}
          onCompositionUpdate={(event) => logNativeEvent("compositionupdate", event.currentTarget)}
          onCompositionEnd={(event) => {
            logNativeEvent("compositionend", event.currentTarget);
            // See the matching disable in onCompositionStart above.
            // eslint-disable-next-line react-hooks/immutability
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
          className={`absolute inset-0 h-full w-full resize-none overflow-y-auto ${probeMode === "nowrap" ? "overflow-x-auto whitespace-pre" : "overflow-x-hidden"} bg-transparent p-4 font-mono text-sm leading-relaxed text-ink outline-none placeholder:text-ink/40`}
        />
        </>
        )}
      </div>

      {/* TSP-B1: one relative wrapper around the whole footer stack. It is the
          anchor the Review Hub panel opens upward from (`bottom-full`), so the
          panel never changes the textarea's height and the three footer
          surfaces below keep their own focus-mode / keyboard-active classes. */}
      <div
        ref={reviewHubFooterRef}
        data-editor-footer=""
        onKeyDown={handleReviewHubKeyDown}
        onPointerDownCapture={refreshHeldSelection}
        className="relative flex min-w-0 flex-none flex-col"
      >
      {/* TSP-RC-LATIN-AND-MOBILE-COMPACT-001: mobile-only, one-line collapsed
          form of the 文章チェックβ + 作業カウンター area below, reusing the
          exact same state/handlers (no new counter logic). Desktop (md+)
          always shows the full form regardless of this preference. */}
      {footerCollapsed && !focusMode && !keyboardActive && (
        <div
          data-editor-footer-collapsed=""
          className="flex min-w-0 flex-none items-center gap-1 overflow-hidden border-t border-ink/10 px-2 py-1 text-[11px] text-ink/70 md:hidden"
        >
          {writingCheckPinned && (
            <>
              <label className="flex shrink-0 cursor-pointer select-none items-center gap-1">
                <input
                  type="checkbox"
                  checked={writingCheckEnabled}
                  onChange={(event) => setWritingCheckEnabled(event.target.checked)}
                  className="h-3 w-3 shrink-0 accent-[#dc2626]"
                />
                <span className="whitespace-nowrap font-medium">チェックβ</span>
              </label>
              <span aria-hidden="true" className="shrink-0 text-ink/25 max-[359px]:hidden">｜</span>
            </>
          )}
          <WorkSessionTracker
            state={workSession}
            onStart={onStartWorkSession}
            onPause={onPauseWorkSession}
            onResume={resumeWorkSession}
            onEnd={onEndWorkSession}
            compact
          />
          <span aria-hidden="true" className="shrink-0 text-ink/25 max-[359px]:hidden">｜</span>
          <span className="min-w-0 shrink truncate whitespace-nowrap tabular-nums text-ink/70">
            現在{visualLength.toLocaleString("ja-JP")}字
          </span>
          {(footerPins.includes("read-aloud") || readAloud.state.status !== "idle") && <ReadAloudFooterControl {...readAloudViewProps} />}
          {footerPins.includes("description-check") && (
            <DescriptionCheckFooterPill
              enabled={descriptionCheck.enabled}
              current={descriptionCheck.current}
              count={descriptionCheck.marks.length}
              onOpen={toggleReviewHub}
            />
          )}
          <ReviewHubTrigger open={reviewHubOpen} onToggle={toggleReviewHub} compact />
          <button
            type="button"
            data-editor-footer-collapse-toggle="expand"
            onClick={() => setFooterCollapsed(false)}
            aria-expanded={false}
            aria-label="文章チェックβ・作業カウンターを展開"
            title="展開"
            className="ml-auto shrink-0 rounded px-1 py-0.5 text-ink/50 hover:bg-ink/5"
          >
            ▲
          </button>
        </div>
      )}

      {/* TSP-Review-UI (Revision 4): on the "desktop" surface the interactive Review Bar (見直し +
          per-tool quick popovers) is portalled into the mount point TategakiEditor renders at the
          bottom of the Preview pane (`reviewBarNode`) -- NOT rendered here -- so it costs the
          manuscript zero height and sits visually with Preview instead of the editor. On the
          "compact" surface (phone + narrower desktop widths) there is no permanent card at all; a
          one-line mini control lives in the status row below instead, and full controls open in the
          Review Hub Bottom Sheet. */}
      {reviewSurface === "desktop" &&
        reviewBarNode &&
        createPortal(
          <DesktopReviewBar
            wrapperRef={desktopBarWrapperRef}
            reviewHubOpen={reviewHubOpen}
            onToggleReviewHub={toggleReviewHub}
            reviewHubPanel={reviewHubPanelElement}
            readAloudPinned={footerPins.includes("read-aloud")}
            readAloud={readAloudViewProps}
            descriptionPinned={footerPins.includes("description-check")}
            description={{
              enabled: descriptionCheck.enabled,
              categories: descriptionCheck.categories,
              onToggle: descriptionCheck.setEnabled,
              onToggleCategory: descriptionCheck.toggleCategory,
              marks: descriptionCheck.marks,
              current: descriptionCheck.current,
              activeMark: descriptionActiveMark,
              currentMark: descriptionCurrentMark,
              onJump: (mark) => navigateToGlobalOffset(mark.start, mark.end),
              onPrev: () => stepDescription(-1),
              onNext: () => stepDescription(1),
            }}
          />,
          reviewBarNode,
        )}
      <div
        data-writing-check-surface=""
        className={`${focusMode ? "max-md:hidden md:hidden" : footerCollapsed || keyboardActive ? "max-md:hidden" : ""} ${footerToolsSwapped ? "order-2" : "order-1"}`}
      >
      <WritingCheckBar
        showBar={writingCheckPinned}
        enabled={writingCheckEnabled}
        onToggle={setWritingCheckEnabled}
        text={analysisCurrent ? analysis.text : ""}
        issues={writingIssuesForContent}
        onSelectIssue={handleSelectWritingIssue}
        onFixIssue={handleFixIssue}
        onIgnoreIssue={handleIgnoreIssue}
        onBulkFix={handleBulkFix}
        onOpenSettings={() => setSettingsOpen(true)}
        undoAvailable={undoState !== null}
        onUndo={handleUndoFix}
        resultsRequestNonce={writingCheckResultsRequest}
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
      </div>

      {/* Compact syntax help never creates a second line; touch/keyboard users
          can open its full text without permanently growing the footer. */}
      <div
        data-editor-status-surfaces=""
        className={`flex flex-none flex-col gap-1.5 border-t border-ink/10 px-4 py-2 text-xs text-ink/60 ${focusMode ? "max-md:hidden md:hidden" : footerCollapsed || keyboardActive ? "max-md:hidden" : ""} ${footerToolsSwapped ? "order-1" : "order-2"}`}
      >
        {/* TSP-B1: the Review Hub trigger shares this already one-line, truncating row rather than the
            controls row below. In the ~335px Editor column of a 768-900px split screen the controls row
            (作業カウンター + 現在の原稿文字数) has no spare width, so a third item there wrapped and cost the
            manuscript a full extra line. Here it only narrows the hint, which already truncates (its full
            text stays in the title / dialog). */}
        <div className="flex min-w-0 items-center gap-2">
          <div data-ruby-tcy-status="" className="min-w-0 flex-1"><EditorSyntaxHelp /></div>
          {/* TSP-Review-UI (Revision 4): on the "desktop" surface the Desktop Review Bar (bottom of
              Preview) owns the ONE 見直し trigger instead -- rendering a second one here would be
              redundant and confusing (two buttons that both open the same panel). */}
          {reviewSurface !== "desktop" && <ReviewHubTrigger open={reviewHubOpen} onToggle={toggleReviewHub} flush />}
        </div>
        <div
          data-editor-footer-controls
          className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5"
        >
          <WorkSessionTracker
            state={workSession}
            onStart={onStartWorkSession}
            onPause={onPauseWorkSession}
            onResume={resumeWorkSession}
            onEnd={onEndWorkSession}
          />
          <span className="flex shrink-0 flex-wrap items-center gap-1.5">
            {/* Revision 3: a mini playback control stays reachable on the compact surface even while
                UNPINNED, whenever 音読β is actually speaking/paused -- closing the Bottom Sheet must
                never make an in-progress reading uncontrollable. */}
            {reviewSurface === "compact" && (footerPins.includes("read-aloud") || readAloud.state.status !== "idle") && (
              <ReadAloudFooterControl {...readAloudViewProps} />
            )}
            {reviewSurface === "compact" && footerPins.includes("description-check") && (
              <DescriptionCheckFooterPill
                enabled={descriptionCheck.enabled}
                current={descriptionCheck.current}
                count={descriptionCheck.marks.length}
                onOpen={toggleReviewHub}
              />
            )}
            <ReviewHubFooterPinnedTools
              characterCount={
                <span
                  title="現在の原稿文字数"
                  className="shrink-0 whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-paper-ink"
                >
                  現在の原稿文字数 {visualLength}文字
                </span>
              }
            />
            {/* TSP-RC-LATIN-AND-MOBILE-COMPACT-001: mobile-only collapse
                toggle for the compact one-line form above. Desktop always
                shows the full form, so this control has no desktop role. */}
            <button
              type="button"
              data-editor-footer-collapse-toggle="collapse"
              onClick={() => setFooterCollapsed(true)}
              aria-expanded={true}
              aria-label="文章チェックβ・作業カウンターを折りたたむ"
              title="折りたたむ"
              className="shrink-0 rounded px-1 py-0.5 text-ink/50 hover:bg-ink/5 md:hidden"
            >
              ▼
            </button>
          </span>
        </div>
      </div>

      {descriptionActiveMark && !(reviewSurface === "desktop" && footerPins.includes("description-check")) && descriptionActiveMark !== descriptionDismissed && !reviewHubOpen && !focusMode && !keyboardActive && (
        <DescriptionMarkDetailCard mark={descriptionActiveMark} onDismiss={() => setDescriptionDismissed(descriptionActiveMark)} />
      )}
      {/* On "desktop" this same element is portalled into the Desktop Review Bar instead (see above);
          rendering it a second time here would duplicate `id={REVIEW_HUB_PANEL_ID}` in the DOM. */}
      {reviewSurface !== "desktop" && reviewHubPanelElement}
      </div>
    </div>
  );
}

const EditorPane = forwardRef(EditorPaneInner);
export default EditorPane;
