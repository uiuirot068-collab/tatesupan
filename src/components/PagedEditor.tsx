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
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
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
  // Application-level Ctrl/Cmd+A (native selection can only ever cover the
  // mounted page) -- Copy/Cut/typed-replacement act on the full canonical
  // text while this is set (Phase 9).
  const allSelectedRef = useRef(false);
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

  /** Switches the mounted page (if needed) so `globalOffset` is visible, restoring a page-local caret at `localCaretHint` when already on the right page, or at a sensible default otherwise. */
  const switchToPageForOffset = (
    globalOffset: number,
    latestPages: EditorPage[],
    selectLocal?: { start: number; end: number }
  ) => {
    const targetIndex = editorPageForGlobalOffset(latestPages, globalOffset);
    setCurrentPageIndex(targetIndex);
    const targetPage = latestPages[targetIndex];
    const localStart = selectLocal
      ? globalToEditorPageLocal(targetPage, selectLocal.start)
      : globalToEditorPageLocal(targetPage, globalOffset);
    const localEnd = selectLocal ? globalToEditorPageLocal(targetPage, selectLocal.end) : localStart;
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      el?.focus({ preventScroll: true });
      el?.setSelectionRange(localStart, localEnd);
    });
    return targetIndex;
  };

  /** Re-anchors the current page (and invalidates undo history) after a `content` change this component did NOT itself produce. Never called mid-composition (deferred to compositionend instead). */
  const reanchorForExternalContent = (newContent: string) => {
    const priorGlobalCaret = editorPageLocalToGlobal(currentPage, textareaRef.current?.selectionStart ?? 0);
    const clampedCaret = Math.max(0, Math.min(newContent.length, priorGlobalCaret));
    const newPages = computeEditorPages(newContent);
    lastOwnContentRef.current = newContent;
    undoHistoryRef.current = createUndoHistory();
    allSelectedRef.current = false;
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

  /** Application-level Ctrl/Cmd+A: replaces the WHOLE canonical document with `typed` (or removes it, for Delete/Backspace/Cut), as ONE atomic undo step. */
  const replaceWholeDocument = (typed: string) => {
    const removedText = content;
    allSelectedRef.current = false;
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

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    const isMod = event.ctrlKey || event.metaKey;
    if (isMod && !event.nativeEvent.isComposing) {
      const key = event.key.toLowerCase();
      if (key === "a") {
        event.preventDefault();
        allSelectedRef.current = true;
        justSetAllSelectedRef.current = true;
        el.setSelectionRange(0, el.value.length);
        onNativeKeyDown?.(el);
        return;
      }
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
    onNativeKeyDown?.(el);
  };

  const handleSelect = (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    if (justSetAllSelectedRef.current) {
      justSetAllSelectedRef.current = false;
    } else {
      allSelectedRef.current = false;
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
    setCurrentPageIndex(clamped);
    const localCaret = 0;
    reportCaret(editorPageLocalToGlobal(pages[clamped], localCaret));
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      el?.focus({ preventScroll: true });
      el?.setSelectionRange(localCaret, localCaret);
    });
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
        className="flex flex-none items-center justify-center gap-3 border-b border-ink/10 bg-ink/[0.02] px-2 py-1 text-xs text-ink/70"
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
