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
  adjustForcedBoundaries,
  adjustJoinedRanges,
  computeEditorPages,
  computePartialJoinBoundary,
  editorPageForGlobalOffset,
  editorPageLocalToGlobal,
  globalToEditorPageLocal,
  EDITOR_PAGE_HARD_MAXIMUM_SIZE,
  EDITOR_PAGE_TARGET_SIZE,
  type EditorPage,
  type JoinedEditorPageRange,
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
import { resolveTextareaDeletion } from "@/lib/editorInputIntegrity";
import WritingCheckOverlay from "./WritingCheckOverlay";
import DescriptionMarkOverlay from "./DescriptionMarkOverlay";
import { marksForPage } from "@/lib/descriptionMarkSegments";
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

/** B5: yellow 描写語・修飾表現 markers (GLOBAL offsets; this component maps them to the current page like `writingCheck`). */
export interface PagedEditorDescriptionMarksProps {
  enabled: boolean;
  /** The exact manuscript `marks` was computed against; drawn only while it matches `content`. */
  analysisText: string;
  marks: readonly { start: number; end: number }[];
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
  /** Fired only when a native deletion contradicted its beforeinput range and was repaired. */
  onNativeIntegrityRepair?: (
    el: HTMLTextAreaElement,
    detail: { inputType: string; beforeLength: number; rejectedLength: number; repairedLength: number }
  ) => void;
  writingCheck?: PagedEditorWritingCheckProps;
  descriptionMarks?: PagedEditorDescriptionMarksProps;
  placeholder?: string;
  className?: string;
}

function clampPageIndex(index: number, pageCount: number): number {
  return Math.max(0, Math.min(pageCount - 1, index));
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}
function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

/**
 * TSP-EDITOR-PAGE-WAITING-UX-HOTFIX-012A §E: the common-prefix/suffix span
 * that changed between `before` and `after`, as `[editStart, editEnd)` in
 * `before`'s own offsets plus `after`'s length for that same span --
 * exactly what `adjustForcedBoundaries` needs to keep a forced page
 * boundary meaningful across an edit, without every call site having to
 * thread its own already-known edit range through `commitCanonical`.
 */
function commonPrefixSuffixDiff(before: string, after: string): { editStart: number; editEnd: number; insertedLength: number } {
  const maxPrefix = Math.min(before.length, after.length);
  let prefix = 0;
  while (prefix < maxPrefix && before[prefix] === after[prefix]) prefix += 1;
  const beforeRemaining = before.length - prefix;
  const afterRemaining = after.length - prefix;
  let suffix = 0;
  while (suffix < beforeRemaining && suffix < afterRemaining && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) {
    suffix += 1;
  }
  return { editStart: prefix, editEnd: before.length - suffix, insertedLength: after.length - prefix - suffix };
}

const CARET_SCROLL_MIRROR_PROPS = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "letterSpacing",
  "lineHeight",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "boxSizing",
  "width",
  "whiteSpace",
  "wordBreak",
  "tabSize",
] as const;

/**
 * TSP-EDITOR-PAGE-BOUNDARY-AND-PREVIEW-LANDING-012 §B: how tall `el`'s OWN
 * wrapping would render if its value were truncated at `localOffset` --
 * i.e. the caret's pixel `scrollTop` if it were the very last character
 * visible. Built from a detached clone `<textarea>` (never the live `el`)
 * so this can never itself perturb the live selection/composition/React
 * value it's measuring around. Reuses the BROWSER's own line-wrapping
 * (a real `<textarea>`, not a hand-rolled mirror div) instead of
 * reimplementing wrap width/glyph-metrics math, which is exactly the kind
 * of fragile glyph hit-testing the task explicitly asked to avoid.
 */
function measureCaretOffsetTop(el: HTMLTextAreaElement, localOffset: number): number {
  if (typeof document === "undefined" || typeof window === "undefined") return 0;
  const style = window.getComputedStyle(el);
  const mirror = document.createElement("textarea");
  mirror.setAttribute("aria-hidden", "true");
  mirror.tabIndex = -1;
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.top = "-9999px";
  mirror.style.left = "-9999px";
  mirror.style.height = "0px";
  mirror.style.overflow = "hidden";
  for (const prop of CARET_SCROLL_MIRROR_PROPS) {
    mirror.style[prop] = style[prop];
  }
  document.body.appendChild(mirror);
  mirror.value = el.value.slice(0, localOffset);
  const top = mirror.scrollHeight;
  document.body.removeChild(mirror);
  return top;
}

/**
 * Scrolls `el` so the character at `localOffset` lands near the UPPER
 * portion of the visible area, never forced to the very top (offset 0) and
 * never forced to the very bottom (the reported bug: `setSelectionRange`
 * alone only scrolls the minimum distance needed, which for a forward jump
 * typically leaves the target flush against the bottom edge -- reading as
 * "landed at the wrong place" even though the selection offset itself is
 * exact). A small margin above the target keeps a bit of preceding context
 * visible "when practical" per the task's own requirement.
 */
function scrollCaretNearUpperView(el: HTMLTextAreaElement, localOffset: number): void {
  const caretTop = measureCaretOffsetTop(el, localOffset);
  const margin = Math.min(caretTop, Math.round(el.clientHeight * 0.15));
  el.scrollTop = Math.max(0, caretTop - margin);
}

/** Rounds a remaining/length character count for the progress indicator: exact under 100 (small counts read oddly rounded to 0), nearest 100 above that. */
function roundForDisplay(value: number): number {
  return value < 100 ? value : Math.round(value / 100) * 100;
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
    onNativeIntegrityRepair,
    writingCheck,
    descriptionMarks,
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

  // TSP-EDITOR-PAGE-WAITING-UX-HOTFIX-012A §C/§D/§E, extended by
  // TSP-EDITOR-MANUAL-SPLIT-AND-BACKSPACE-HOTFIX-012B §B: global-offset
  // overrides from an explicit "ここで区切る" action (see
  // `forceSplitAtCaret` and `computeEditorPages`'s own doc) -- kept in sync
  // with edits via `adjustForcedBoundaries` inside `commitCanonical` below.
  // Session-only by design (§F): never persisted, so a reload simply falls
  // back to ordinary automatic pagination, same as before this action ever
  // existed.
  const [forcedBoundaries, setForcedBoundaries] = useState<number[]>([]);

  // TSP-EDITOR-UNIFIED-SPLIT-JOIN-012D: "前のページとつなぐ" across an
  // ORIGINALLY AUTOMATIC boundary (no `forcedBoundaries` entry to simply
  // remove) instead records a join preference here -- see
  // `JoinedEditorPageRange`'s own doc. Session-only, exactly like
  // `forcedBoundaries`, and kept in sync with edits the same way (via
  // `adjustJoinedRanges` inside `commitCanonical`).
  const [joinedRanges, setJoinedRanges] = useState<JoinedEditorPageRange[]>([]);

  // TSP-EDITOR-MANUAL-SPLIT-AND-BACKSPACE-HOTFIX-012B §C: the textarea's own
  // live selection, in GLOBAL (canonical) offsets, purely so
  // `canForceSplitAtCaret` below can be evaluated at render time (React
  // can't read the DOM directly during render). Kept fresh by `handleSelect`
  // (native selection changes -- click/drag/keyup/arrow keys) and by
  // `reportCaret` (every programmatic caret placement elsewhere already
  // calls it with a single collapsed offset).
  const [globalCaretRange, setGlobalCaretRange] = useState(() => ({ start: content.length, end: content.length }));

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

  const pages = useMemo(
    () => computeEditorPages(content, { forcedBoundaries, joinedRanges }),
    [content, forcedBoundaries, joinedRanges]
  );
  const pageCount = pages.length;

  const safePageIndex = clampPageIndex(currentPageIndex, pageCount);
  const currentPage: EditorPage = pages[safePageIndex];
  const pageText = content.slice(currentPage.start, currentPage.end);
  useEffect(() => {
    pageTextRef.current = pageText;
  });

  const reportCaret = (globalCaret: number) => {
    setGlobalCaretRange({ start: globalCaret, end: globalCaret });
    onCursorIndexChange?.(globalCaret);
  };

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
  const pendingSelectionRef = useRef<{ start: number; end: number; scrollHint?: "upper" } | null>(null);

  /**
   * Switches the mounted page (if needed) so `globalOffset` is visible, then
   * applies `selectLocal` (or a plain caret at the mapped local offset) once
   * the target page's text is actually in the DOM. `scrollHint: "upper"`
   * (TSP-EDITOR-PAGE-BOUNDARY-AND-PREVIEW-LANDING-012 §B) additionally
   * scrolls the target near the upper portion of the textarea instead of
   * relying on `setSelectionRange`'s own minimal-scroll-into-view, which a
   * forward jump can otherwise leave flush against the bottom edge.
   * `affinity: "backward"` (TSP-EDITOR-MANUAL-SPLIT-AND-BACKSPACE-HOTFIX-012B
   * §G/§H) is the sole exception to the app-wide forward boundary
   * convention -- see `editorPageForGlobalOffset`'s own doc.
   */
  const switchToPageForOffset = (
    globalOffset: number,
    latestPages: EditorPage[],
    selectLocal?: { start: number; end: number },
    options?: { scrollHint?: "upper"; affinity?: "forward" | "backward" }
  ) => {
    const targetIndex = editorPageForGlobalOffset(latestPages, globalOffset, options?.affinity ?? "forward");
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
      if (el && options?.scrollHint === "upper") scrollCaretNearUpperView(el, localStart);
    } else {
      pendingSelectionRef.current = { start: localStart, end: localEnd, scrollHint: options?.scrollHint };
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
    if (el && pending.scrollHint === "upper") scrollCaretNearUpperView(el, pending.start);
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

  const commitCanonical = (
    nextCanonical: string,
    knownEdit?: { editStart: number; editEnd: number; insertedLength: number }
  ): { forcedBoundaries: number[]; joinedRanges: JoinedEditorPageRange[] } => {
    // §E: only worth the O(n) diff when a forced boundary or join
    // preference actually exists -- the overwhelming common case (nobody
    // has clicked "ここで区切る"/"前のページとつなぐ" this session) stays a
    // single pair of length checks.
    let nextForcedBoundaries = forcedBoundaries;
    let nextJoinedRanges = joinedRanges;
    if ((forcedBoundaries.length > 0 || joinedRanges.length > 0) && nextCanonical !== content) {
      // Prefer the operation's already-known canonical range. A full-text
      // prefix/suffix diff is only a fallback: repeated text cannot reveal
      // which identical code unit was deleted, while beforeinput and
      // toolbar edits know that position exactly.
      const { editStart, editEnd, insertedLength } = knownEdit ?? commonPrefixSuffixDiff(content, nextCanonical);
      if (forcedBoundaries.length > 0) {
        const adjusted = adjustForcedBoundaries(forcedBoundaries, editStart, editEnd, insertedLength);
        nextForcedBoundaries = adjusted;
        if (adjusted.length !== forcedBoundaries.length || adjusted.some((b, i) => b !== forcedBoundaries[i])) {
          setForcedBoundaries(adjusted);
        }
      }
      if (joinedRanges.length > 0) {
        const adjustedJoined = adjustJoinedRanges(joinedRanges, editStart, editEnd, insertedLength);
        nextJoinedRanges = adjustedJoined;
        if (
          adjustedJoined.length !== joinedRanges.length ||
          adjustedJoined.some((r, i) => r.start !== joinedRanges[i].start || r.end !== joinedRanges[i].end)
        ) {
          setJoinedRanges(adjustedJoined);
        }
      }
    }
    lastOwnContentRef.current = nextCanonical;
    onContentChange(nextCanonical);
    return { forcedBoundaries: nextForcedBoundaries, joinedRanges: nextJoinedRanges };
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    let nextPageText = el.value;

    const pending = pendingBeforeInputRef.current;
    pendingBeforeInputRef.current = null;
    if (!isComposingRef.current && pending) {
      const rejectedLength = nextPageText.length;
      const resolution = resolveTextareaDeletion(pending, nextPageText);
      if (resolution.repaired) {
        nextPageText = resolution.text;
        // React's next controlled commit echoes this repaired value. Restore
        // the caret immediately as well so a queued key-repeat/IME event sees
        // the repaired transaction boundary, never the corrupted DOM range.
        el.value = nextPageText;
        el.setSelectionRange(resolution.selectionStart, resolution.selectionEnd);
        onNativeIntegrityRepair?.(el, {
          inputType: pending.inputType,
          beforeLength: pending.beforeText.length,
          rejectedLength,
          repairedLength: nextPageText.length,
        });
      }
    }
    const rawEdit = !isComposingRef.current
      ? pending
        ? computeRawEditFromBeforeInput(pending, nextPageText, currentPage.start)
        : computeRawEditFromBeforeInput(
            { beforeText: pageTextRef.current, selectionStart: 0, selectionEnd: 0, inputType: "" },
            nextPageText,
            currentPage.start
          )
      : null;
    if (rawEdit) undoHistoryRef.current = pushEdit(undoHistoryRef.current, rawEdit);

    const nextCanonical = content.slice(0, currentPage.start) + nextPageText + content.slice(currentPage.end);
    const globalCaret = editorPageLocalToGlobal(currentPage, el.selectionStart);

    const nextState = commitCanonical(
      nextCanonical,
      rawEdit
        ? {
            editStart: rawEdit.rangeStart,
            editEnd: rawEdit.rangeStart + rawEdit.removedText.length,
            insertedLength: rawEdit.insertedText.length,
          }
        : undefined
    );
    reportCaret(globalCaret);
    onNativeChangeCommitted?.(el);

    if (isComposingRef.current) return;

    // The edit may have moved where THIS page's own boundary falls (e.g. a
    // newline landing near the split threshold); reconcile immediately so
    // the caret never silently drifts onto a page the user isn't looking
    // at. Almost always a no-op switch (see the module doc: an edit can
    // only ever move ITS OWN page's `end`, never an earlier page).
    const nextPages = computeEditorPages(nextCanonical, nextState);
    const navigationAffinity = pending?.inputType === "deleteContentBackward" ? "backward" : "forward";
    const targetIndex = editorPageForGlobalOffset(nextPages, globalCaret, navigationAffinity);
    if (targetIndex !== safePageIndex) {
      switchToPageForOffset(globalCaret, nextPages, undefined, { affinity: navigationAffinity });
    }
  };

  /** Replaces the WHOLE canonical document with `typed` (or removes it, for Delete/Backspace/Cut) while explicit full-manuscript selection is active, as ONE atomic undo step. */
  const replaceWholeDocument = (typed: string) => {
    const removedText = content;
    setAllSelected(false);
    undoHistoryRef.current = pushEdit(undoHistoryRef.current, { rangeStart: 0, removedText, insertedText: typed, atomic: true });
    const nextState = commitCanonical(typed, {
      editStart: 0,
      editEnd: content.length,
      insertedLength: typed.length,
    });
    const newPages = computeEditorPages(typed, nextState);
    switchToPageForOffset(typed.length, newPages);
    reportCaret(typed.length);
  };

  /**
   * TSP-EDITOR-PAGE-BOUNDARY-AND-PREVIEW-LANDING-012 §E: Backspace with a
   * collapsed caret at local offset 0 of any page after the first has
   * nothing to delete WITHIN the mounted page -- the native textarea sees
   * an empty selection at its own start and no-ops. This reaches past the
   * page boundary into the canonical manuscript instead, exactly as if the
   * whole document were one continuous textarea: deletes the ONE character
   * (never splitting a surrogate pair) immediately before the page's own
   * `start`, then reconciles pages/caret onto wherever that now lands
   * (typically the end of the previous page).
   */
  const deleteAcrossBoundaryBackward = () => {
    if (currentPage.index === 0 || currentPage.start === 0) return false;
    const globalCaret = currentPage.start;
    const prevCode = content.charCodeAt(globalCaret - 1);
    const deleteFrom =
      isLowSurrogate(prevCode) && globalCaret - 2 >= 0 && isHighSurrogate(content.charCodeAt(globalCaret - 2))
        ? globalCaret - 2
        : globalCaret - 1;
    const removedText = content.slice(deleteFrom, globalCaret);
    undoHistoryRef.current = pushEdit(undoHistoryRef.current, { rangeStart: deleteFrom, removedText, insertedText: "" });
    const nextCanonical = content.slice(0, deleteFrom) + content.slice(globalCaret);
    const nextState = commitCanonical(nextCanonical, {
      editStart: deleteFrom,
      editEnd: globalCaret,
      insertedLength: 0,
    });
    // Preserve the boundary that the deletion just crossed. Automatic
    // paragraph/hard-cut pagination may otherwise choose a different end
    // after its final character is removed, making the canonical caret no
    // longer equal to the previous page's end. Treating the adjusted end as
    // a session-only forced boundary keeps the textarea continuous for this
    // Backspace and for immediately repeated Backspaces.
    if (deleteFrom > 0 && !nextState.forcedBoundaries.includes(deleteFrom)) {
      nextState.forcedBoundaries = [...nextState.forcedBoundaries, deleteFrom].sort((a, b) => a - b);
      setForcedBoundaries(nextState.forcedBoundaries);
    }
    const newPages = computeEditorPages(nextCanonical, nextState);
    switchToPageForOffset(deleteFrom, newPages, undefined, { affinity: "backward" });
    reportCaret(deleteFrom);
    return true;
  };

  /**
   * TSP-EDITOR-PAGE-BOUNDARY-AND-PREVIEW-LANDING-012 §F: the symmetric
   * forward case -- Delete with a collapsed caret at the END of a page that
   * isn't the manuscript's own end. Deletes the ONE canonical character
   * immediately after this page's `end` (never splitting a surrogate pair)
   * and reconciles, exactly as a single continuous textarea would.
   */
  const deleteAcrossBoundaryForward = () => {
    const globalCaret = currentPage.end;
    if (globalCaret >= content.length) return false;
    const nextCode = content.charCodeAt(globalCaret);
    const deleteTo =
      isHighSurrogate(nextCode) && globalCaret + 1 < content.length && isLowSurrogate(content.charCodeAt(globalCaret + 1))
        ? globalCaret + 2
        : globalCaret + 1;
    const removedText = content.slice(globalCaret, deleteTo);
    undoHistoryRef.current = pushEdit(undoHistoryRef.current, { rangeStart: globalCaret, removedText, insertedText: "" });
    const nextCanonical = content.slice(0, globalCaret) + content.slice(deleteTo);
    const nextState = commitCanonical(nextCanonical, {
      editStart: globalCaret,
      editEnd: deleteTo,
      insertedLength: 0,
    });
    const newPages = computeEditorPages(nextCanonical, nextState);
    switchToPageForOffset(globalCaret, newPages);
    reportCaret(globalCaret);
    return true;
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

    // §E/§F: a collapsed caret sitting exactly at this page's own start/end
    // has nothing left for the native textarea to delete -- intercept
    // BEFORE the native no-op so Backspace/Delete reach across the page
    // boundary into the canonical manuscript instead.
    if (
      !isComposingRef.current &&
      inputType === "deleteContentBackward" &&
      el.selectionStart === 0 &&
      el.selectionEnd === 0 &&
      currentPage.index > 0
    ) {
      nativeEvent.preventDefault();
      deleteAcrossBoundaryBackward();
      onNativeBeforeInput?.(el, inputType);
      return;
    }
    if (
      !isComposingRef.current &&
      inputType === "deleteContentForward" &&
      el.selectionStart === el.value.length &&
      el.selectionEnd === el.value.length &&
      currentPage.end < content.length
    ) {
      nativeEvent.preventDefault();
      deleteAcrossBoundaryForward();
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
    const history = undoHistoryRef.current;
    const operation =
      command === "undo"
        ? history.undoStack[history.undoStack.length - 1]
        : history.redoStack[history.redoStack.length - 1];
    const result = command === "undo" ? undoHistory(history, content) : redoHistory(history, content);
    if (!result) return;
    undoHistoryRef.current = result.history;
    const nextState = commitCanonical(
      result.canonicalText,
      operation
        ? {
            editStart: operation.rangeStart,
            editEnd:
              operation.rangeStart +
              (command === "undo" ? operation.insertedText.length : operation.removedText.length),
            insertedLength:
              command === "undo" ? operation.removedText.length : operation.insertedText.length,
          }
        : undefined
    );
    const newPages = computeEditorPages(result.canonicalText, nextState);
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
    // A no-op beforeinput (Backspace at document start, Delete at its end)
    // has no matching input event to consume its snapshot. The next physical
    // key always starts a new transaction.
    pendingBeforeInputRef.current = null;
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
    // §C: the ONE place a genuinely non-collapsed selection can appear (a
    // user drag-select) -- captures the true range, unlike `reportCaret`
    // (used everywhere else, always with a single already-collapsed
    // offset), so `canForceSplitAtCaret` can correctly disable while text
    // is selected.
    const globalStart = editorPageLocalToGlobal(currentPage, el.selectionStart);
    const globalEnd = editorPageLocalToGlobal(currentPage, el.selectionEnd);
    setGlobalCaretRange({ start: globalStart, end: globalEnd });
    onCursorIndexChange?.(globalStart);
  };

  const handleBlur = () => {
    pendingBeforeInputRef.current = null;
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
      const nextState = commitCanonical(
        nextCanonical,
        rawEdit
          ? {
              editStart: rawEdit.rangeStart,
              editEnd: rawEdit.rangeStart + rawEdit.removedText.length,
              insertedLength: rawEdit.insertedText.length,
            }
          : undefined
      );
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
      const nextPages = computeEditorPages(nextCanonical, nextState);
      const targetIndex = editorPageForGlobalOffset(nextPages, globalCaret);
      if (targetIndex !== safePageIndex) {
        switchToPageForOffset(globalCaret, nextPages);
      }
    }

    const pendingJump = pendingJumpRef.current;
    pendingJumpRef.current = null;
    if (pendingJump?.kind === "global") {
      switchToPageForOffset(
        pendingJump.end,
        computeEditorPages(contentRef.current, { forcedBoundaries, joinedRanges }),
        pendingJump,
        { scrollHint: "upper" }
      );
    } else if (pendingJump?.kind === "external" || contentRef.current !== lastOwnContentRef.current) {
      reanchorForExternalContent(contentRef.current);
    }
  };

  /**
   * TSP-EDITOR-PAGE-BOUNDARY-AND-PREVIEW-LANDING-012 §B: the shared
   * Preview-click / Writing-Check-jump entry point (via `EditorPane.tsx`'s
   * `navigateToGlobalOffset`). `scrollHint: "upper"` keeps the jump target's
   * own text visible near the top of the textarea instead of flush against
   * whichever edge `setSelectionRange` happened to scroll to.
   */
  const moveSelectionToGlobal = (start: number, end: number) => {
    if (isComposingRef.current) {
      pendingJumpRef.current = { kind: "global", start, end };
      return;
    }
    switchToPageForOffset(end, pages, { start, end }, { scrollHint: "upper" });
    reportCaret(end);
  };

  const replaceRangeGlobal = (start: number, end: number, text: string, options?: { caretOffsetInInsertedText?: number }) => {
    if (isComposingRef.current) return;
    const removedText = content.slice(start, end);
    undoHistoryRef.current = pushEdit(undoHistoryRef.current, { rangeStart: start, removedText, insertedText: text, atomic: true });
    const nextCanonical = content.slice(0, start) + text + content.slice(end);
    const caretOffset = options?.caretOffsetInInsertedText ?? text.length;
    const globalCaret = start + caretOffset;
    const nextState = commitCanonical(nextCanonical, {
      editStart: start,
      editEnd: end,
      insertedLength: text.length,
    });
    const newPages = computeEditorPages(nextCanonical, nextState);
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

  // TSP-EDITOR-PAGE-BOUNDARY-AND-PREVIEW-LANDING-012 §H: guidance-only --
  // NEVER the source of truth for pagination (that's still
  // `computeEditorPages`, recomputed fresh every render above). Only the
  // active LAST/growing page has a meaningful "remaining" count.
  const isLastPage = safePageIndex === pageCount - 1;
  // TSP-EDITOR-PAGE-WAITING-UX-HOTFIX-012A §A: the active last page has
  // reached target and is now in the confirmed "not even searching for a
  // paragraph break yet" dead zone up to the hard maximum -- see
  // `chooseSafeEditorPageBoundary`'s own doc.
  const isWaitingForBoundary = isLastPage && currentPage.length >= EDITOR_PAGE_TARGET_SIZE;

  /**
   * TSP-EDITOR-MANUAL-SPLIT-AND-BACKSPACE-HOTFIX-012B: "ここで区切る"
   * creates a boundary at the exact collapsed canonical caret. It is a
   * normal editor action on every page, independent of the automatic
   * waiting state. The endpoint/duplicate/selection checks prevent empty or
   * ambiguous pages; a caret inside a surrogate pair is rejected rather
   * than moved, preserving both exact placement and Unicode integrity.
   */
  const manualSplitOffset = globalCaretRange.start;
  const manualSplitWouldBreakSurrogatePair =
    manualSplitOffset > 0 &&
    manualSplitOffset < content.length &&
    isHighSurrogate(content.charCodeAt(manualSplitOffset - 1)) &&
    isLowSurrogate(content.charCodeAt(manualSplitOffset));
  const canForceSplitAtCaret =
    !isFullManuscriptSelected &&
    globalCaretRange.start === globalCaretRange.end &&
    manualSplitOffset > currentPage.start &&
    manualSplitOffset < currentPage.end &&
    manualSplitOffset > 0 &&
    manualSplitOffset < content.length &&
    !forcedBoundaries.includes(manualSplitOffset) &&
    !manualSplitWouldBreakSurrogatePair;

  const forceSplitAtCaret = () => {
    const el = textareaRef.current;
    if (!el || isComposingRef.current || allSelectedRef.current) return;
    const selectionStart = editorPageLocalToGlobal(currentPage, el.selectionStart);
    const selectionEnd = editorPageLocalToGlobal(currentPage, el.selectionEnd);
    if (selectionStart !== selectionEnd) return;
    const forcedOffset = selectionStart;
    if (
      forcedOffset <= currentPage.start ||
      forcedOffset >= currentPage.end ||
      forcedOffset <= 0 ||
      forcedOffset >= content.length ||
      forcedBoundaries.includes(forcedOffset) ||
      (isHighSurrogate(content.charCodeAt(forcedOffset - 1)) &&
        isLowSurrogate(content.charCodeAt(forcedOffset)))
    ) {
      return;
    }
    const nextForced = [...forcedBoundaries, forcedOffset].sort((a, b) => a - b);
    setForcedBoundaries(nextForced);
    // TSP-EDITOR-UNIFIED-SPLIT-JOIN-012D "EXPLICIT SPLIT MUST WIN": trim any
    // join preference that would otherwise claim this brand-new boundary as
    // interior -- `computeEditorPages` already defensively prefers an
    // interior forced boundary over a join range on its own (see its own
    // doc), but the STORED preference must also stop covering this span so
    // it cannot resurface after a later edit.
    const nextJoined = joinedRanges.filter((r) => !(r.start < forcedOffset && r.end > forcedOffset));
    if (nextJoined.length !== joinedRanges.length) setJoinedRanges(nextJoined);
    const newPages = computeEditorPages(content, { forcedBoundaries: nextForced, joinedRanges: nextJoined });
    // TSP-EDITOR-PARTIAL-JOIN-AND-CARET-LANDING-012E §J/§K/§L: reuses the
    // same upper-view scroll landing Preview/Writing-Check jumps already
    // use (`scrollCaretNearUpperView`, invoked by `switchToPageForOffset`
    // itself) so the caret is immediately visible after an explicit layout
    // action instead of the user having to search the page for it.
    switchToPageForOffset(forcedOffset, newPages, undefined, { scrollHint: "upper" });
    reportCaret(forcedOffset);
  };

  /**
   * TSP-EDITOR-UNIFIED-SPLIT-JOIN-012D, extended by
   * TSP-EDITOR-PARTIAL-JOIN-AND-CARET-LANDING-012E: "前のページとつなぐ" is
   * shown for EVERY page after Page 1, regardless of whether the boundary
   * immediately before it originated from "ここで区切る" (a
   * `forcedBoundaries` entry) or from ordinary automatic ~50k pagination --
   * the user is never expected to know which. It is only DISABLED, never
   * hidden, when NEITHER a full nor a partial join is currently possible, or
   * while a non-collapsed/full-manuscript selection is active.
   *
   * 012E adds a PARTIAL join ("pull-up"): when the previous+current pages
   * together would exceed the hard maximum (so a FULL join is unsafe), only
   * a safe prefix of the current page moves into the previous one, toward
   * the ordinary ~50k target measured from the previous page's own start
   * (`computePartialJoinBoundary` -- reuses the same natural-boundary
   * policy `chooseSafeEditorPageBoundary` already applies for automatic
   * pagination, never inventing a second one). Either way this is recorded
   * as a `joinedRanges` preference spanning `[previousPage.start, newEnd)`
   * so automatic pagination does not immediately recreate a split anywhere
   * inside it (see `computeEditorPages`'s own doc); joining across a forced
   * boundary additionally removes that boundary outright (012C, unchanged).
   * Never touches canonical content -- no
   * commitCanonical/onContentChange/pushEdit call here, exactly like
   * `forceSplitAtCaret` above, so this is layout housekeeping and never a
   * manuscript undo step (§G).
   */
  const previousPage = safePageIndex > 0 ? pages[safePageIndex - 1] : null;
  const combinedLengthWithPreviousPage = previousPage ? currentPage.end - previousPage.start : 0;
  const fullJoinPossible = previousPage !== null && combinedLengthWithPreviousPage <= EDITOR_PAGE_HARD_MAXIMUM_SIZE;
  const partialJoinBoundary =
    previousPage !== null && !fullJoinPossible
      ? computePartialJoinBoundary(content, previousPage.start, currentPage.start, currentPage.end)
      : null;
  const joinHasSafeTarget = fullJoinPossible || partialJoinBoundary !== null;
  const mergeBlockedBySelection = isFullManuscriptSelected || globalCaretRange.start !== globalCaretRange.end;
  const canMergeWithPreviousPage = previousPage !== null && joinHasSafeTarget && !mergeBlockedBySelection;
  const mergeWithPreviousPageTitle = !previousPage
    ? ""
    : !joinHasSafeTarget
      ? "前の編集ページにこれ以上つなげると文字数上限を超えるため、つなげません。"
      : mergeBlockedBySelection
        ? "選択を解除すると、前の編集ページとつなげます。"
        : "前の編集ページとつなぎます。原稿や印刷ページには影響しません。";

  const mergeWithPreviousPage = () => {
    const el = textareaRef.current;
    if (!el || isComposingRef.current || allSelectedRef.current) return;
    if (safePageIndex === 0) return;
    const selectionStart = editorPageLocalToGlobal(currentPage, el.selectionStart);
    const selectionEnd = editorPageLocalToGlobal(currentPage, el.selectionEnd);
    if (selectionStart !== selectionEnd) return;
    const previous = pages[safePageIndex - 1];
    const boundaryOffset = currentPage.start;
    const combinedLength = currentPage.end - previous.start;

    let newRangeEnd: number;
    if (combinedLength <= EDITOR_PAGE_HARD_MAXIMUM_SIZE) {
      newRangeEnd = currentPage.end; // full join
    } else {
      const partial = computePartialJoinBoundary(content, previous.start, boundaryOffset, currentPage.end);
      if (partial === null) return; // no safe movement -- the button should already be disabled
      newRangeEnd = partial; // partial join / pull-up
    }

    const nextForced = forcedBoundaries.includes(boundaryOffset)
      ? forcedBoundaries.filter((b) => b !== boundaryOffset)
      : forcedBoundaries;
    if (nextForced !== forcedBoundaries) setForcedBoundaries(nextForced);

    const nextJoined = [
      ...joinedRanges.filter((r) => r.start !== previous.start),
      { start: previous.start, end: newRangeEnd },
    ].sort((a, b) => a.start - b.start);
    setJoinedRanges(nextJoined);

    const newPages = computeEditorPages(content, { forcedBoundaries: nextForced, joinedRanges: nextJoined });
    // §J/§K/§L: preserved GLOBAL caret (`selectionStart`) is authoritative --
    // `switchToPageForOffset` finds whichever page now actually contains it
    // (the shrunk current page, or the expanded previous page) and the
    // upper-view scroll hint makes it immediately visible either way.
    switchToPageForOffset(selectionStart, newPages, undefined, { scrollHint: "upper" });
    reportCaret(selectionStart);
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

  // TSP-EDITOR-PAGE-WAITING-UX-HOTFIX-012A §B: `isWaitingForBoundary` now
  // shows a truthful countdown to the actual enforced ceiling
  // (`EDITOR_PAGE_HARD_MAXIMUM_SIZE`) instead of a bare "区切り待ち" that
  // gave no indication of how much more typing (if any) was needed --
  // confirmed by the Phase 0 audit to span a real ~5,000-char window where
  // `chooseSafeEditorPageBoundary` isn't even searching for a break yet.
  const progressLabel = isLastPage
    ? currentPage.length < EDITOR_PAGE_TARGET_SIZE
      ? `次の編集ページまで あと約${roundForDisplay(EDITOR_PAGE_TARGET_SIZE - currentPage.length).toLocaleString("ja-JP")}字`
      : `区切り待ち・最大あと約${roundForDisplay(Math.max(0, EDITOR_PAGE_HARD_MAXIMUM_SIZE - currentPage.length)).toLocaleString("ja-JP")}字`
    : `この編集ページ：約${roundForDisplay(currentPage.length).toLocaleString("ja-JP")}字`;
  const compactProgressLabel = isLastPage
    ? currentPage.length < EDITOR_PAGE_TARGET_SIZE
      ? `あと約${roundForDisplay(EDITOR_PAGE_TARGET_SIZE - currentPage.length).toLocaleString("ja-JP")}字`
      : progressLabel
    : `約${roundForDisplay(currentPage.length).toLocaleString("ja-JP")}字`;
  const progressTitle = isWaitingForBoundary
    ? "段落の区切りで編集ページが切り替わります。最大約5.5万字で自動的に切り替わります。"
    : "最大約5.5万字で自動的に切り替わります";

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

  const showDescriptionMarks = Boolean(descriptionMarks?.enabled && descriptionMarks.analysisText === content);
  const pageLocalDescriptionMarks = useMemo(() => {
    if (!showDescriptionMarks || !descriptionMarks) return [];
    return marksForPage(descriptionMarks.marks, currentPage.start, currentPage.end);
  }, [showDescriptionMarks, descriptionMarks, currentPage.start, currentPage.end]);

  return (
    <div className="absolute inset-0 flex flex-col">
      <div
        data-editor-page-navigator=""
        className="flex flex-none flex-wrap items-center justify-center gap-x-1 gap-y-1 border-b border-ink/10 bg-ink/[0.02] px-1 py-1 text-[11px] text-ink/70 sm:gap-x-3 sm:px-2 sm:text-xs"
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
          className={`whitespace-nowrap rounded-full border px-1.5 py-1 text-[11px] font-medium sm:px-2 ${
            isFullManuscriptSelected
              ? "border-accent bg-accent/10 text-ink"
              : "border-ink/20 text-ink/70 hover:bg-ink/5"
          }`}
        >
          {isFullManuscriptSelected ? "全文選択中　解除" : "全文を選択"}
        </button>
        <button
          type="button"
          data-editor-force-split=""
          disabled={!canForceSplitAtCaret}
          onClick={forceSplitAtCaret}
          title="現在のカーソル位置で編集ページを区切ります。原稿や印刷ページには影響しません。"
          className="whitespace-nowrap rounded-full border border-ink/20 px-1.5 py-1 text-[11px] font-medium text-ink/70 hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent sm:px-2"
        >
          ここで区切る
        </button>
        {/* TSP-EDITOR-UNIFIED-SPLIT-JOIN-012D: shown for every page after
            Page 1 -- never gated on whether the preceding boundary was
            manual or automatic (see `previousPage`'s own doc). Disabled
            (never hidden) when joining would exceed the Editor Page hard
            maximum or a non-collapsed/full-manuscript selection is active,
            so the user can see the action exists and why it's currently
            unavailable. Neutral secondary styling, same as "ここで区切る"
            -- reversible layout housekeeping, never destructive. */}
        {previousPage && (
          <button
            type="button"
            data-editor-merge-with-previous=""
            disabled={!canMergeWithPreviousPage}
            onClick={mergeWithPreviousPage}
            title={mergeWithPreviousPageTitle}
            className="whitespace-nowrap rounded-full border border-ink/20 px-1.5 py-1 text-[11px] font-medium text-ink/70 hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent sm:px-2"
          >
            前のページとつなぐ
          </button>
        )}
        {/* The amber waiting status always owns a separate row. Ordinary
            progress may share the second wrapped row below 640px so the new
            neutral split action does not collapse the 320px editor into a
            three-row navigator; desktop keeps the established own row. */}
        {/* TSP-EDITOR-PAGE-WAITING-UX-HOTFIX-012A §B: gold (not red/error --
            this is guidance, never a failure) waiting status, reusing the
            same amber badge convention as `WorkSessionTracker`'s own
            paused-state pill. Manual splitting remains the neutral action
            above and is deliberately not duplicated in this row. */}
        <span
          data-editor-page-progress=""
          title={progressTitle}
          className={`flex flex-wrap items-center justify-center gap-1.5 whitespace-nowrap text-center text-[10px] ${
            isWaitingForBoundary ? "basis-full" : "sm:basis-full"
          }`}
        >
          <span
            className={
              isWaitingForBoundary
                ? "inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800"
                : "text-ink/50"
            }
          >
            {isWaitingForBoundary && <span aria-hidden="true">●</span>}
            <span className="min-[375px]:hidden">{compactProgressLabel}</span>
            <span className="hidden min-[375px]:inline">{progressLabel}</span>
          </span>
        </span>
      </div>

      <div className="relative min-h-0 flex-1">
        {showDescriptionMarks && (
          <div className="pointer-events-none absolute inset-0">
            <DescriptionMarkOverlay textareaRef={textareaRef} text={pageText} marks={pageLocalDescriptionMarks} />
          </div>
        )}
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
