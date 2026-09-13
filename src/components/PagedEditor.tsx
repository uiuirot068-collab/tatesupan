"use client";

/**
 * TSP-EDITOR-PAGINATION-AND-PREVIEW-NAVIGATION-009 — production editor-page
 * long-document editor surface. Supersedes the rejected `WindowedEditor.tsx`
 * (a centred, continuously-sliding window with visible prefix/suffix strips)
 * behind the SAME rollout gate (`editorSurfaceRollout.ts`'s `"WINDOWED"`
 * value now selects this component instead).
 *
 * MODEL: the canonical manuscript is split into stable, discrete ~50,000
 * code-unit "編集ページ" (`@/lib/editorPagination/paginationModel.ts`) that
 * never move once written (an edit strictly after a page's `end` can only
 * ever affect later pages -- see that module's own doc). Exactly ONE page's
 * text is ever mounted into the native textarea at a time; navigating
 * between pages is an explicit user action (prev/next, a Preview click, a
 * Writing Check jump) rather than a continuous caret-follow shift. This is
 * what lets this component drop the old sliding window's prefix/suffix
 * strips entirely: there is no "nearby" text to preview, only a discrete
 * page to switch to.
 *
 * `content` IS the canonical manuscript (same contract as the plain
 * textarea and the old WindowedEditor) -- autosave/save/Preview/export/
 * writing-check all keep reading `content`/calling `onContentChange`
 * unchanged; this component only changes which SLICE of it is ever mounted.
 *
 * UNDO/REDO: reuses `windowedEditor/undoModel.ts` AS-IS. That module already
 * operates purely on canonical offsets, independent of any "window" concept
 * -- a page switch never touches it, so cross-page undo/redo (Phase 10) is
 * correct for free, exactly as it was for cross-window undo/redo.
 *
 * WRITING CHECK: `writingCheck` (optional) mirrors `EditorPane`'s own
 * gating (`analysisCurrent`) and mounts `WritingCheckOverlay` itself, over
 * only the current page's own local text/issue-offsets -- never a
 * full-document shadow textarea (Phase 8; Phase 14's "no second 300k
 * editable DOM").
 *
 * SELECTION: TSP-PAGED-EDITOR-QA-FIXES-AND-DEMO-010 §C/§D -- Ctrl/Cmd+A is
 * native, unintercepted browser "select all" over the MOUNTED page only
 * (matching what's actually visible/editable, and ordinary user
 * expectation of the shortcut). Selecting the WHOLE canonical manuscript
 * (for Copy/Cut/typed-replacement) is instead an explicit, separate
 * "全文を選択" action (see `selectEntireManuscript`) -- `allSelectedRef`
 * (and the `isFullManuscriptSelected` state mirroring it for the button's
 * own label) is now ONLY ever set by that action, never by Ctrl+A.
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  computeEditorPages,
  editorPageForGlobalOffset,
  editorPageLocalToGlobal,
  globalToEditorPageLocal,
  type EditorPage,
} from "@/lib/editorPagination/paginationModel";
import {
  computeRawEditFromBeforeInput,
  createUndoHistory,
  flushBatch,
  pushEdit,
  redo as redoHistory,
  undo as undoHistory,
  type BeforeInputEditSnapshot,
  type UndoHistory,
} from "@/lib/windowedEditor/undoModel";
import WritingCheckOverlay from "./WritingCheckOverlay";
import type { WritingDiagnostic } from "@/lib/writingCheckEngine";

export interface PagedEditorHandle {
  focus(): void;
  getSelectionGlobal(): { start: number; end: number };
  /** Switches to the editor page containing `[start, end)` (if needed), selects it, and focuses. Used for jumps that originate outside the current page (a Preview click, a Writing Check issue). Deferred until `compositionend` if mid-IME. */
  moveSelectionToGlobal(start: number, end: number): void;
  /** Replaces `[start, end)` of the canonical text with `text` as ONE atomic, undoable edit (e.g. page-break insertion), then places the caret `caretOffsetInInsertedText` code units into `text` (default: its end). */
  replaceRangeGlobal(start: number, end: number, text: string, options?: { caretOffsetInInsertedText?: number }): void;
  /** Application-level undo/redo -- see the module doc for why this replaces native history here. */
  runHistory(command: "undo" | "redo"): void;
}

export interface PagedEditorWritingCheckProps {
  enabled: boolean;
  /** The exact manuscript `issues` was computed against; the overlay only renders while this matches `content` (mirrors `EditorPane`'s `analysisCurrent`). */
  analysisText: string;
  /** GLOBAL (canonical) offsets; this component maps the ones intersecting the current page into page-local coordinates for the overlay. */
  issues: WritingDiagnostic[];
}

export interface PagedEditorProps {
  /** The canonical manuscript, owned by the parent exactly as with a plain textarea. */
  content: string;
  onContentChange: (next: string) => void;
  onCursorIndexChange?: (globalIndex: number) => void;
  /** Passthrough for `EditorPane`'s existing written-character activity tracking, fed the current page's own local textarea element. */
  onNativeKeyDown?: (el: HTMLTextAreaElement) => void;
  onNativeBeforeInput?: (el: HTMLTextAreaElement, inputType: string) => void;
  onNativeCompositionStart?: (el: HTMLTextAreaElement) => void;
  onNativeCompositionEnd?: (el: HTMLTextAreaElement) => void;
  /** Fired after every committed (non-composition-internal) text change, page-local el. */
  onNativeChangeCommitted?: (el: HTMLTextAreaElement) => void;
  writingCheck?: PagedEditorWritingCheckProps;
  placeholder?: string;
  className?: string;
}

function clampPageIndex(index: number, pageCount: number): number {
  return Math.max(0, Math.min(pageCount - 1, index));
}

function PagedEditorInner(
  {
    content,
    onContentChange,
    onCursorIndexChange,
    onNativeKeyDown,
    onNativeBeforeInput,
    onNativeCompositionStart,
    onNativeCompositionEnd,
    onNativeChangeCommitted,
    writingCheck,
    placeholder,
    className,
  }: PagedEditorProps,
  ref: React.Ref<PagedEditorHandle>
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);
  const compositionSnapshotRef = useRef<BeforeInputEditSnapshot | null>(null);
  const pendingBeforeInputRef = useRef<BeforeInputEditSnapshot | null>(null);
  const undoHistoryRef = useRef<UndoHistory>(createUndoHistory());
  // TSP-PAGED-EDITOR-QA-FIXES-AND-DEMO-010 §D: application-level "select the
  // WHOLE canonical manuscript" state, entered ONLY via the explicit
  // "全文を選択" action (never by Ctrl/Cmd+A -- see the module doc). While
  // set, Copy/Cut/typed-replacement act on the full canonical text instead
  // of just the mounted page. `isFullManuscriptSelected` mirrors the ref
  // into React state purely so the button's own label can react to it --
  // every actual DECISION (Copy/Cut/replace) still reads the ref
  // synchronously, never the possibly-stale state.
  const allSelectedRef = useRef(false);
  const [isFullManuscriptSelected, setIsFullManuscriptSelected] = useState(false);
  const setAllSelected = (value: boolean) => {
    allSelectedRef.current = value;
    setIsFullManuscriptSelected(value);
  };
  const justSetAllSelectedRef = useRef(false);
  const contentRef = useRef(content);
  useEffect(() => {
    contentRef.current = content;
  });
  // The last canonical text THIS component itself produced via
  // `onContentChange`. Distinguishes "the parent echoed our own edit back"
  // (page boundaries already locally consistent with it) from "content
  // changed for an external reason" (project switch, TXT import,
  // search/replace, a writing-check fix, cross-page undo from a DIFFERENT
  // mount) -- which must re-anchor the current page and invalidate this
  // component's own undo history (its offsets describe the
  // pre-external-edit document).
  const lastOwnContentRef = useRef(content);
  const pageTextRef = useRef("");

  const [currentPageIndex, setCurrentPageIndex] = useState(() => {
    const pages = computeEditorPages(content);
    return editorPageForGlobalOffset(pages, content.length);
  });
  // Deferred cross-page action (Phase 5: never switch pages mid-composition).
  const pendingJumpRef = useRef<
    | { kind: "global"; start: number; end: number }
    | { kind: "external" }
    | null
  >(null);

  const pages = useMemo(() => computeEditorPages(content), [content]);
  const pageCount = pages.length;

  const safePageIndex = clampPageIndex(currentPageIndex, pageCount);
  const currentPage: EditorPage = pages[safePageIndex];
  const pageText = content.slice(currentPage.start, currentPage.end);
  useEffect(() => {
    pageTextRef.current = pageText;
  });

  const reportCaret = (globalCaret: number) => onCursorIndexChange?.(globalCaret);

  // TSP-PAGED-EDITOR-QA-FIXES-AND-DEMO-010 §A/§B: a selection to apply once
  // the textarea's DOM `value` actually reflects the page we just switched
  // to. A bare `requestAnimationFrame` scheduled at the SAME time as
  // `setCurrentPageIndex` is not reliably ordered after React's commit in
  // every invocation path (confirmed by Human QA: a Preview-page jump and a
  // same-page-boundary IME transition both landed at the wrong end of the
  // page instead of the intended local offset) -- `setSelectionRange`
  // running against the textarea's STALE (pre-switch) value still succeeds
  // silently (the old value is simply longer), and the selection it set is
  // then clobbered when React reassigns `.value` moments later (browsers
  // clamp/reset selection on a full value replacement). The
  // `useLayoutEffect` below is tied to React's own commit for `pageText`,
  // so it is GUARANTEED to run after the new value is in the DOM.
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);

  /** Switches the mounted page (if needed) so `globalOffset` is visible, then applies `selectLocal` (or a plain caret at the mapped local offset) once the target page's text is actually in the DOM. */
  const switchToPageForOffset = (
    globalOffset: number,
    latestPages: EditorPage[],
    selectLocal?: { start: number; end: number }
  ) => {
    const targetIndex = editorPageForGlobalOffset(latestPages, globalOffset);
    const targetPage = latestPages[targetIndex];
    const localStart = selectLocal
      ? globalToEditorPageLocal(targetPage, selectLocal.start)
      : globalToEditorPageLocal(targetPage, globalOffset);
    const localEnd = selectLocal ? globalToEditorPageLocal(targetPage, selectLocal.end) : localStart;

    if (targetIndex === safePageIndex) {
      // Already the mounted page: its DOM value already matches, so apply
      // immediately -- `setCurrentPageIndex` with an unchanged value is a
      // React no-op render, which the layout effect below would never see.
      const el = textareaRef.current;
      el?.focus({ preventScroll: true });
      el?.setSelectionRange(localStart, localEnd);
    } else {
      pendingSelectionRef.current = { start: localStart, end: localEnd };
      setCurrentPageIndex(targetIndex);
    }
    return targetIndex;
  };

  // Applies a pending cross-page selection exactly once the switched-to
  // page's text has actually committed to the textarea's DOM value.
  useLayoutEffect(() => {
    const pending = pendingSelectionRef.current;
    if (!pending) return;
    pendingSelectionRef.current = null;
    const el = textareaRef.current;
    el?.focus({ preventScroll: true });
    el?.setSelectionRange(pending.start, pending.end);
  }, [currentPageIndex, pageText]);

  /** Re-anchors the current page (and invalidates undo history) after a `content` change this component did NOT itself produce. Never called mid-composition (deferred to compositionend instead). */
  const reanchorForExternalContent = (newContent: string) => {
    const priorGlobalCaret = editorPageLocalToGlobal(currentPage, textareaRef.current?.selectionStart ?? 0);
    const clampedCaret = Math.max(0, Math.min(newContent.length, priorGlobalCaret));
    const newPages = computeEditorPages(newContent);
    lastOwnContentRef.current = newContent;
    undoHistoryRef.current = createUndoHistory();
    setAllSelected(false);
    switchToPageForOffset(clampedCaret, newPages);
  };

  useEffect(() => {
    if (content === lastOwnContentRef.current) return;
    if (isComposingRef.current) {
      pendingJumpRef.current = { kind: "external" };
      return;
    }
    reanchorForExternalContent(content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  const commitCanonical = (nextCanonical: string) => {
    lastOwnContentRef.current = nextCanonical;
    onContentChange(nextCanonical);
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    const nextPageText = el.value;

    const pending = pendingBeforeInputRef.current;
    pendingBeforeInputRef.current = null;
    if (!isComposingRef.current) {
      const rawEdit = pending
        ? computeRawEditFromBeforeInput(pending, nextPageText, currentPage.start)
        : computeRawEditFromBeforeInput(
            { beforeText: pageTextRef.current, selectionStart: 0, selectionEnd: 0, inputType: "" },
            nextPageText,
            currentPage.start
          );
      if (rawEdit) undoHistoryRef.current = pushEdit(undoHistoryRef.current, rawEdit);
    }

    const nextCanonical = content.slice(0, currentPage.start) + nextPageText + content.slice(currentPage.end);
    const globalCaret = editorPageLocalToGlobal(currentPage, el.selectionStart);

    commitCanonical(nextCanonical);
    reportCaret(globalCaret);
    onNativeChangeCommitted?.(el);

    if (isComposingRef.current) return;

    // The edit may have moved where THIS page's own boundary falls (e.g. a
    // newline landing near the split threshold); reconcile immediately so
    // the caret never silently drifts onto a page the user isn't looking
    // at. Almost always a no-op switch (see the module doc: an edit can
    // only ever move ITS OWN page's `end`, never an earlier page).
    const nextPages = computeEditorPages(nextCanonical);
    const targetIndex = editorPageForGlobalOffset(nextPages, globalCaret);
    if (targetIndex !== safePageIndex) {
      switchToPageForOffset(globalCaret, nextPages);
    }
  };

  /** Replaces the WHOLE canonical document with `typed` (or removes it, for Delete/Backspace/Cut) while explicit full-manuscript selection is active, as ONE atomic undo step. */
  const replaceWholeDocument = (typed: string) => {
    const removedText = content;
    setAllSelected(false);
    undoHistoryRef.current = pushEdit(undoHistoryRef.current, { rangeStart: 0, removedText, insertedText: typed, atomic: true });
    commitCanonical(typed);
    const newPages = computeEditorPages(typed);
    switchToPageForOffset(typed.length, newPages);
    reportCaret(typed.length);
  };

  /**
   * `onBeforeInput`'s React prop does not forward the native `inputType`
   * (see `WindowedEditor.tsx`'s own doc for the confirmed-empirically
   * reasoning this is copied from); listen on the DOM node directly.
   */
  const handleBeforeInputNative = (el: HTMLTextAreaElement, nativeEvent: InputEvent) => {
    const inputType = nativeEvent.inputType ?? "";

    if (allSelectedRef.current && !isComposingRef.current && (inputType.startsWith("insert") || inputType.startsWith("delete"))) {
      nativeEvent.preventDefault();
      replaceWholeDocument(inputType.startsWith("insert") ? nativeEvent.data ?? "" : "");
      onNativeBeforeInput?.(el, inputType);
      return;
    }

    pendingBeforeInputRef.current = {
      beforeText: el.value,
      selectionStart: el.selectionStart,
      selectionEnd: el.selectionEnd,
      inputType,
    };
    onNativeBeforeInput?.(el, inputType);
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const listener = (event: Event) => handleBeforeInputNative(el, event as InputEvent);
    el.addEventListener("beforeinput", listener);
    return () => el.removeEventListener("beforeinput", listener);
  });

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    pendingBeforeInputRef.current = {
      beforeText: el.value,
      selectionStart: el.selectionStart,
      selectionEnd: el.selectionEnd,
      inputType: "insertFromPaste",
    };
    onNativeBeforeInput?.(el, "insertFromPaste");
  };

  const handleCopy = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!allSelectedRef.current) return;
    event.preventDefault();
    event.clipboardData.setData("text/plain", content);
  };

  const handleCut = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (allSelectedRef.current) {
      event.preventDefault();
      event.clipboardData.setData("text/plain", content);
      replaceWholeDocument("");
      return;
    }
    const el = event.currentTarget;
    pendingBeforeInputRef.current = {
      beforeText: el.value,
      selectionStart: el.selectionStart,
      selectionEnd: el.selectionEnd,
      inputType: "deleteByCut",
    };
    onNativeBeforeInput?.(el, "deleteByCut");
  };

  const runHistory = (command: "undo" | "redo") => {
    if (isComposingRef.current) return;
    const result = command === "undo" ? undoHistory(undoHistoryRef.current, content) : redoHistory(undoHistoryRef.current, content);
    if (!result) return;
    undoHistoryRef.current = result.history;
    commitCanonical(result.canonicalText);
    const newPages = computeEditorPages(result.canonicalText);
    switchToPageForOffset(result.selectionEnd, newPages, { start: result.selectionStart, end: result.selectionEnd });
    reportCaret(result.selectionEnd);
  };

  /**
   * TSP-PAGED-EDITOR-QA-FIXES-AND-DEMO-010 §D: the explicit "全文を選択"
   * action -- the ONLY way `allSelectedRef` is ever set now that Ctrl/Cmd+A
   * is native, page-only selection (see the module doc). Also visually
   * selects the mounted page's own text (the closest native affordance
   * available -- unmounted pages have no DOM to highlight), matching the
   * "全文選択中" label shown while this is active.
   */
  const selectEntireManuscript = () => {
    if (isComposingRef.current) return;
    setAllSelected(true);
    justSetAllSelectedRef.current = true;
    const el = textareaRef.current;
    el?.focus({ preventScroll: true });
    el?.setSelectionRange(0, el.value.length);
  };

  const deselectEntireManuscript = () => {
    setAllSelected(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    const isMod = event.ctrlKey || event.metaKey;
    if (isMod && !event.nativeEvent.isComposing) {
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        runHistory("undo");
        return;
      }
      if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        runHistory("redo");
        return;
      }
    }
    if (event.key === "Escape" && allSelectedRef.current) {
      deselectEntireManuscript();
    }
    onNativeKeyDown?.(el);
  };

  const handleSelect = (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    if (justSetAllSelectedRef.current) {
      justSetAllSelectedRef.current = false;
    } else {
      setAllSelected(false);
    }
    reportCaret(editorPageLocalToGlobal(currentPage, el.selectionStart));
  };

  const handleBlur = () => {
    undoHistoryRef.current = flushBatch(undoHistoryRef.current);
  };

  const handleCompositionStart = (event: React.CompositionEvent<HTMLTextAreaElement>) => {
    isComposingRef.current = true;
    const el = event.currentTarget;
    compositionSnapshotRef.current = {
      beforeText: el.value,
      selectionStart: el.selectionStart,
      selectionEnd: el.selectionEnd,
      inputType: "insertFromComposition",
    };
    pendingBeforeInputRef.current = null;
    onNativeCompositionStart?.(el);
  };

  const handleCompositionEnd = (event: React.CompositionEvent<HTMLTextAreaElement>) => {
    isComposingRef.current = false;
    const el = event.currentTarget;
    const finalPageText = el.value;
    const snapshot = compositionSnapshotRef.current;
    compositionSnapshotRef.current = null;
    onNativeCompositionEnd?.(el);

    if (snapshot && snapshot.beforeText !== finalPageText) {
      const rawEdit = computeRawEditFromBeforeInput(snapshot, finalPageText, currentPage.start);
      if (rawEdit) undoHistoryRef.current = pushEdit(undoHistoryRef.current, rawEdit);
      const nextCanonical = content.slice(0, currentPage.start) + finalPageText + content.slice(currentPage.end);
      const globalCaret = editorPageLocalToGlobal(currentPage, el.selectionStart);
      commitCanonical(nextCanonical);
      reportCaret(globalCaret);

      // TSP-PAGED-EDITOR-QA-FIXES-AND-DEMO-010 §B: an IME composition can
      // ALSO push this page past its target size, exactly like ordinary
      // typing (see `handleChange`'s identical reconciliation, which this
      // path was previously missing entirely). When that happens, this
      // page's own `end` moves EARLIER (a new page boundary now falls
      // partway through what used to be one page -- see the module doc),
      // so the just-composed text -- and the caret the IME left there --
      // silently end up on the NEXT page while `currentPageIndex` still
      // pointed at this one. The next render's now-shorter `pageText`
      // slice then made the browser clamp the stale caret to that
      // truncated length, landing it at this page's end instead of near
      // the start of the (correct) next page.
      const nextPages = computeEditorPages(nextCanonical);
      const targetIndex = editorPageForGlobalOffset(nextPages, globalCaret);
      if (targetIndex !== safePageIndex) {
        switchToPageForOffset(globalCaret, nextPages);
      }
    }

    const pendingJump = pendingJumpRef.current;
    pendingJumpRef.current = null;
    if (pendingJump?.kind === "global") {
      switchToPageForOffset(pendingJump.end, computeEditorPages(contentRef.current), pendingJump);
    } else if (pendingJump?.kind === "external" || contentRef.current !== lastOwnContentRef.current) {
      reanchorForExternalContent(contentRef.current);
    }
  };

  const moveSelectionToGlobal = (start: number, end: number) => {
    if (isComposingRef.current) {
      pendingJumpRef.current = { kind: "global", start, end };
      return;
    }
    switchToPageForOffset(end, pages, { start, end });
    reportCaret(end);
  };

  const replaceRangeGlobal = (start: number, end: number, text: string, options?: { caretOffsetInInsertedText?: number }) => {
    if (isComposingRef.current) return;
    const removedText = content.slice(start, end);
    undoHistoryRef.current = pushEdit(undoHistoryRef.current, { rangeStart: start, removedText, insertedText: text, atomic: true });
    const nextCanonical = content.slice(0, start) + text + content.slice(end);
    const caretOffset = options?.caretOffsetInInsertedText ?? text.length;
    const globalCaret = start + caretOffset;
    commitCanonical(nextCanonical);
    const newPages = computeEditorPages(nextCanonical);
    switchToPageForOffset(globalCaret, newPages);
    reportCaret(globalCaret);
  };

  const goToPage = (targetIndex: number) => {
    const clamped = clampPageIndex(targetIndex, pageCount);
    if (clamped === safePageIndex) return;
    if (isComposingRef.current) {
      pendingJumpRef.current = { kind: "global", start: pages[clamped].start, end: pages[clamped].start };
      return;
    }
    undoHistoryRef.current = flushBatch(undoHistoryRef.current);
    // §D: an explicit full-manuscript selection can't mean anything once
    // the mounted page (the only page with real DOM selection) changes.
    setAllSelected(false);
    const target = pages[clamped].start;
    switchToPageForOffset(target, pages);
    reportCaret(target);
  };

  useImperativeHandle(
    ref,
    (): PagedEditorHandle => ({
      focus: () => textareaRef.current?.focus({ preventScroll: true }),
      getSelectionGlobal: () => {
        const el = textareaRef.current;
        if (!el) return { start: currentPage.start, end: currentPage.start };
        return {
          start: editorPageLocalToGlobal(currentPage, el.selectionStart),
          end: editorPageLocalToGlobal(currentPage, el.selectionEnd),
        };
      },
      moveSelectionToGlobal,
      replaceRangeGlobal,
      runHistory,
    }),
    [currentPage, moveSelectionToGlobal, replaceRangeGlobal, runHistory]
  );

  const showWritingCheck = Boolean(writingCheck?.enabled && writingCheck.analysisText === content);
  const pageLocalIssues = useMemo(() => {
    if (!showWritingCheck || !writingCheck) return [];
    const { start, end } = currentPage;
    return writingCheck.issues
      .filter((issue) => issue.start < end && issue.end > start)
      .map((issue) => ({
        ...issue,
        start: Math.max(0, issue.start - start),
        end: Math.min(end - start, issue.end - start),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWritingCheck, writingCheck, currentPage.start, currentPage.end]);

  return (
    <div className="absolute inset-0 flex flex-col">
      <div
        data-editor-page-navigator=""
        className="flex flex-none flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-ink/10 bg-ink/[0.02] px-2 py-1 text-xs text-ink/70"
      >
        <button
          type="button"
          aria-label="前の編集ページへ移動"
          disabled={safePageIndex === 0}
          onClick={() => goToPage(safePageIndex - 1)}
          className="flex min-h-7 min-w-7 items-center justify-center rounded border border-ink/20 text-ink/70 hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <span aria-hidden="true">←</span>
        </button>
        <span aria-live="polite" data-editor-page-indicator="" className="whitespace-nowrap font-medium">
          編集ページ {safePageIndex + 1} / {pageCount}
        </span>
        <button
          type="button"
          aria-label="次の編集ページへ移動"
          disabled={safePageIndex === pageCount - 1}
          onClick={() => goToPage(safePageIndex + 1)}
          className="flex min-h-7 min-w-7 items-center justify-center rounded border border-ink/20 text-ink/70 hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <span aria-hidden="true">→</span>
        </button>
        {/* TSP-PAGED-EDITOR-QA-FIXES-AND-DEMO-010 §D: Ctrl/Cmd+A only ever
            selects the mounted page now (native browser behaviour); this is
            the sole entry point for the explicit full-canonical-manuscript
            selection Copy/Cut/replace need. Unmounted pages have no DOM to
            visually select, so the active state is announced in the label
            itself instead of relying on a native highlight spanning pages
            it can't reach. */}
        <button
          type="button"
          aria-pressed={isFullManuscriptSelected}
          data-editor-select-all=""
          onClick={isFullManuscriptSelected ? deselectEntireManuscript : selectEntireManuscript}
          className={`whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-medium ${
            isFullManuscriptSelected
              ? "border-accent bg-accent/10 text-ink"
              : "border-ink/20 text-ink/70 hover:bg-ink/5"
          }`}
        >
          {isFullManuscriptSelected ? "全文選択中　解除" : "全文を選択"}
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        {showWritingCheck && (
          <div className="pointer-events-none absolute inset-0">
            <WritingCheckOverlay textareaRef={textareaRef} text={pageText} issues={pageLocalIssues} />
          </div>
        )}
        <textarea
          ref={textareaRef}
          data-demo-target="editor"
          data-editor-surface="paged"
          aria-label={`原稿本文（編集ページ ${safePageIndex + 1} / ${pageCount}）`}
          value={pageText}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCopy={handleCopy}
          onCut={handleCut}
          onChange={handleChange}
          onSelect={handleSelect}
          onClick={handleSelect}
          onKeyUp={handleSelect}
          onBlur={handleBlur}
          onCompositionStart={handleCompositionStart}
          onCompositionUpdate={(event) => onNativeKeyDown?.(event.currentTarget)}
          onCompositionEnd={handleCompositionEnd}
          placeholder={placeholder}
          spellCheck={false}
          className={className ?? "absolute inset-0 h-full w-full resize-none overflow-y-auto overflow-x-hidden bg-transparent p-4 font-mono text-sm leading-relaxed text-ink outline-none"}
        />
      </div>
    </div>
  );
}

const PagedEditor = forwardRef(PagedEditorInner);
export default PagedEditor;
