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
 * SELECTION: the WHOLE canonical manuscript (for Copy/Cut/typed-replacement)
 * is selected by the 「全文を選択」 action or by Ctrl/Cmd+A in the editor --
 * both call `selectEntireManuscript`, so they are one state
 * (`allSelectedRef`, mirrored into `isFullManuscriptSelected` for the
 * button's label). This matches the single-textarea (FULL) editor, where
 * Ctrl+A covers the whole manuscript (product decision, 2026-09-29; it
 * replaces TSP-010 §C's page-only Ctrl+A). An ordinary drag/Shift selection
 * stays within the mounted 編集ページ: operating on text across pages goes
 * through 全文を選択 / Ctrl+A, or 前のページとつなぐ
 * (docs/TATESPUN_WINDOWED_DEFAULT_READINESS.md).
 */

import {
  forwardRef,
  useEffect,
  useId,
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
import { decideCompositionOutcome, type CompositionBase } from "@/lib/windowedEditor/compositionTransaction";
import { resolveTextareaDeletion } from "@/lib/editorInputIntegrity";
import { perfMark } from "@/lib/perfDebug";
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
  marks: readonly PagedEditorDescriptionMarkRange[];
}

export interface PagedEditorDescriptionMarkRange {
  start: number;
  end: number;
  category?: "A" | "B" | "C";
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
  /** GLOBAL ranges to ghost-highlight (B4's held 選択範囲, B5's current candidate) while the textarea is not painting a native selection. */
  ghostRanges?: readonly { start: number; end: number }[];
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
export function scrollCaretNearUpperView(el: HTMLTextAreaElement, localOffset: number): void {
  const caretTop = measureCaretOffsetTop(el, localOffset);
  const margin = Math.min(caretTop, Math.round(el.clientHeight * 0.15));
  el.scrollTop = Math.max(0, caretTop - margin);
}

/**
 * The text an `insert*` beforeinput would insert. `data` is null for a line
 * break (Enter) and may be null for paste/drop, whose text is in
 * `dataTransfer` -- falling back to "" there replaced a 全文選択 manuscript
 * with NOTHING on Enter, where a native textarea (FULL) leaves one line break.
 */
function insertedTextOf(event: InputEvent): string {
  if (event.inputType === "insertLineBreak" || event.inputType === "insertParagraph") return "\n";
  const text = event.data ?? event.dataTransfer?.getData("text/plain") ?? "";
  // A textarea value never holds CR: a native paste of Windows CRLF text
  // arrives as LF, so this bypass of the native insert must match it.
  return text.replace(/\r\n?/g, "\n");
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
    ghostRanges,
    placeholder,
    className,
  }: PagedEditorProps,
  ref: React.Ref<PagedEditorHandle>
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);
  // The IME composition in progress, as ONE transaction (see
  // `compositionTransaction.ts`): what it began on, and the IME's latest
  // string. Nothing is committed to `content` until it ends -- committing each
  // update re-paginated the manuscript and re-sliced the mounted page under
  // the IME (a large selection shrinks the page), corrupting the text and undo.
  const compositionTxnRef = useRef<(CompositionBase & { lastData: string | null }) | null>(null);
  // While a composition is in progress the textarea shows the IME's view of
  // the mounted page; `content` stays untouched until the composition ends.
  // Mirroring the DOM here keeps React from restoring the controlled value
  // under the IME (which silently drops the composition in Blink).
  const [compositionText, setCompositionText] = useState<string | null>(null);
  // Set by an IME keydown (keyCode 229) over 全文選択 and held until the
  // composition starts or a non-IME action (pointer, another key, blur): the
  // IME may move or shrink the native selection before compositionstart --
  // on a real OS even after the key's own keyup -- and that must not end
  // 全文選択 (it did, leaving the rest of the manuscript behind).
  const wholeInputArmedRef = useRef(false);
  // A 全文選択 edit whose beforeinput could not be canceled: its text, which
  // the following input event commits instead of the page's own DOM value.
  const pendingWholeInsertRef = useRef<string | null>(null);
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

  // Phones only (< md): whether the 編集ページ navigator shows its secondary
  // tools (ここで区切る / 前のページとつなぐ / progress). Starts collapsed to
  // give the manuscript its height; ←/→, the page indicator and 全文を選択 are
  // always in the row. Session-only UI state, never persisted.
  const [pageToolsExpanded, setPageToolsExpanded] = useState(false);
  const pageToolsId = useId();

  // TSP-EDITOR-MANUAL-SPLIT-AND-BACKSPACE-HOTFIX-012B §C: the textarea's own
  // live selection, in GLOBAL (canonical) offsets, purely so
  // `canForceSplitAtCaret` below can be evaluated at render time (React
  // can't read the DOM directly during render). Kept fresh by `handleSelect`
  // (native selection changes -- click/drag/keyup/arrow keys) and by
  // `reportCaret` (every programmatic caret placement elsewhere already
  // calls it with a single collapsed offset).
  const [globalCaretRange, setGlobalCaretRange] = useState(() => ({ start: content.length, end: content.length }));
  // The same range, readable synchronously (re-anchoring runs in an effect,
  // after React has already replaced the textarea's value and moved its caret).
  const globalCaretRangeRef = useRef(globalCaretRange);

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
  // What the textarea shows: the mounted page, or the IME's view of it during a composition.
  const displayedPageText = compositionText ?? pageText;
  useEffect(() => {
    pageTextRef.current = pageText;
  });

  const reportCaretRange = (start: number, end: number, options?: { notify?: boolean }) => {
    const range = { start, end };
    globalCaretRangeRef.current = range;
    setGlobalCaretRange(range);
    if (options?.notify !== false) onCursorIndexChange?.(start);
  };
  const reportCaret = (globalCaret: number) => reportCaretRange(globalCaret, globalCaret);

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
  const pendingSelectionRef = useRef<{ start: number; end: number; scrollHint?: "upper"; focus?: boolean } | null>(null);

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
    options?: {
      scrollHint?: "upper";
      affinity?: "forward" | "backward";
      /**
       * The canonical text `latestPages` describes, when this call follows an
       * edit (or a split/join that re-slices the mounted page) React has not
       * committed yet. If the mounted page's DOM value is
       * still the pre-edit text, the selection waits for the layout effect
       * below: applying it now would be clobbered when React assigns the new
       * value (the browser moves the caret to the END of an assigned value).
       */
      nextContent?: string;
      /** False: place the selection without moving focus into the editor (re-anchoring on document open). */
      focus?: boolean;
    }
  ) => {
    const targetIndex = editorPageForGlobalOffset(latestPages, globalOffset, options?.affinity ?? "forward");
    const targetPage = latestPages[targetIndex];
    const localStart = selectLocal
      ? globalToEditorPageLocal(targetPage, selectLocal.start)
      : globalToEditorPageLocal(targetPage, globalOffset);
    const localEnd = selectLocal ? globalToEditorPageLocal(targetPage, selectLocal.end) : localStart;
    const focus = options?.focus ?? true;

    const mountedValue = textareaRef.current?.value;
    const staleSamePage =
      targetIndex === safePageIndex &&
      options?.nextContent !== undefined &&
      mountedValue !== undefined &&
      mountedValue !== options.nextContent.slice(targetPage.start, targetPage.end);
    if (staleSamePage) {
      pendingSelectionRef.current = { start: localStart, end: localEnd, scrollHint: options?.scrollHint, focus };
    } else if (targetIndex === safePageIndex) {
      // Already the mounted page: its DOM value already matches, so apply
      // immediately -- `setCurrentPageIndex` with an unchanged value is a
      // React no-op render, which the layout effect below would never see.
      const el = textareaRef.current;
      if (focus) el?.focus({ preventScroll: true });
      el?.setSelectionRange(localStart, localEnd);
      if (el && options?.scrollHint === "upper") scrollCaretNearUpperView(el, localStart);
    } else {
      pendingSelectionRef.current = { start: localStart, end: localEnd, scrollHint: options?.scrollHint, focus };
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
    if (pending.focus !== false) el?.focus({ preventScroll: true });
    el?.setSelectionRange(pending.start, pending.end);
    if (el && pending.scrollHint === "upper") scrollCaretNearUpperView(el, pending.start);
  }, [currentPageIndex, pageText, compositionText]);

  /** Re-anchors the current page (and invalidates undo history) after a `content` change this component did NOT itself produce. Never called mid-composition (deferred to compositionend instead). */
  const reanchorForExternalContent = (newContent: string) => {
    // The caret as last REPORTED, not the textarea's live selection: this runs
    // after React has already committed the new text, and assigning a value
    // moves the browser caret to its END -- which used to open a multi-page
    // manuscript on 編集ページ 2 (the end of page 1 belongs to page 2).
    const priorGlobalCaret = globalCaretRangeRef.current.start;
    const clampedCaret = Math.max(0, Math.min(newContent.length, priorGlobalCaret));
    const newPages = computeEditorPages(newContent);
    lastOwnContentRef.current = newContent;
    undoHistoryRef.current = createUndoHistory();
    setAllSelected(false);
    // Loading or switching a document must not pull focus into the editor
    // (FULL does not either); an editor that already has focus keeps it.
    const hadFocus = typeof document !== "undefined" && document.activeElement === textareaRef.current;
    switchToPageForOffset(clampedCaret, newPages, undefined, { focus: hadFocus });
    reportCaretRange(clampedCaret, clampedCaret, { notify: false });
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

  /** Replaces the WHOLE canonical document with `typed` (or removes it, for Delete/Backspace/Cut) while explicit full-manuscript selection is active, as ONE atomic undo step. */
  const replaceWholeDocument = (typed: string, options?: { typedCharacter?: boolean; focus?: boolean }) => {
    const removedText = content;
    setAllSelected(false);
    wholeInputArmedRef.current = false;
    // One typed character stays extendable by the typing that follows it, so
    // Ctrl+A → "abc" is still ONE undo step back to the manuscript.
    const extendableByTyping = options?.typedCharacter === true;
    undoHistoryRef.current = pushEdit(undoHistoryRef.current, {
      rangeStart: 0,
      removedText,
      insertedText: typed,
      atomic: !extendableByTyping,
      extendableByTyping,
    });
    const nextState = commitCanonical(typed, {
      editStart: 0,
      editEnd: content.length,
      insertedLength: typed.length,
    });
    const newPages = computeEditorPages(typed, nextState);
    switchToPageForOffset(typed.length, newPages, undefined, { nextContent: typed, focus: options?.focus });
    reportCaret(typed.length);
  };

  /**
   * Opens the composition transaction: what the IME is about to edit, captured
   * before it touches the page. Membership in 全文選択 is decided by 全文選択
   * itself, not the DOM selection -- the IME may already have moved or
   * narrowed that (a page-local composition then left the rest of the
   * manuscript behind). Normally at compositionstart; `beforeinput`/`input`/
   * compositionupdate open it when an IME skipped compositionstart, and a
   * compositionstart over a still-open transaction first finishes that one.
   */
  const beginComposition = (
    el: HTMLTextAreaElement,
    source: string,
    before?: { beforeText: string; selectionStart: number; selectionEnd: number }
  ) => {
    if (compositionTxnRef.current) finishComposition(el, null, `restart:${source}`);
    isComposingRef.current = true;
    wholeInputArmedRef.current = false;
    pendingBeforeInputRef.current = null;
    // A clamped selection: `before` may come from the last reported caret.
    const beforeText = before?.beforeText ?? el.value;
    const clamp = (offset: number) => Math.max(0, Math.min(beforeText.length, offset));
    compositionTxnRef.current = {
      baseCanonical: content,
      pageStart: currentPage.start,
      pageEnd: currentPage.end,
      beforeText,
      selectionStart: clamp(before?.selectionStart ?? el.selectionStart),
      selectionEnd: clamp(before?.selectionEnd ?? el.selectionEnd),
      whole: allSelectedRef.current,
      lastData: null,
    };
    perfMark("PagedEditor:ime:begin", {
      source,
      whole: allSelectedRef.current,
      page: currentPage.index,
      selectionStart: el.selectionStart,
      selectionEnd: el.selectionEnd,
      pageLength: beforeText.length,
    });
    onNativeCompositionStart?.(el);
  };

  /**
   * Closes the composition transaction with ONE commit (or none), whatever
   * ended it: compositionend (`data` = its committed string), or a recovery
   * signal when compositionend never arrived (`data` null: the IME's last
   * compositionupdate string stands in). Idempotent -- a late compositionend
   * after a recovery finds no transaction and does nothing.
   */
  const finishComposition = (el: HTMLTextAreaElement, data: string | null, reason: string) => {
    const txn = compositionTxnRef.current;
    if (!txn) return;
    compositionTxnRef.current = null;
    isComposingRef.current = false;
    wholeInputArmedRef.current = false;
    const finalPageText = el.value;
    // Finishing on blur must not pull focus back from wherever it went.
    const keepFocus = reason !== "blur";
    setCompositionText(null);
    onNativeCompositionEnd?.(el);
    // Read before this composition's own commit below, which is not external.
    const pendingJump = pendingJumpRef.current;
    pendingJumpRef.current = null;
    const externalChangePending = pendingJump?.kind === "external" || contentRef.current !== lastOwnContentRef.current;

    const outcome = decideCompositionOutcome(txn, content, finalPageText, data ?? txn.lastData, el.selectionStart);
    perfMark("PagedEditor:ime:finish", {
      reason,
      outcome: outcome.kind,
      detail: "reason" in outcome ? outcome.reason : null,
      whole: txn.whole,
      dataLength: (data ?? txn.lastData)?.length ?? null,
      finalLength: finalPageText.length,
    });
    // Puts the textarea back on the unchanged mounted page. React would too
    // (the value prop returns to `pageText`), but only if that prop differs
    // from what it last rendered -- the DOM may have moved on without an input.
    const restoreMountedPage = () => {
      if (el.value !== pageText) el.value = pageText;
    };

    if (outcome.kind === "whole-replace") {
      // ONE atomic undo step back to the whole manuscript.
      replaceWholeDocument(outcome.text, { focus: keepFocus });
    } else if (outcome.kind === "whole-unchanged") {
      // Canceled, or the IME's text is unknown: never a page-local or guessed
      // replacement. The manuscript and 全文選択 stay as they were.
      restoreMountedPage();
      setAllSelected(true);
      el.setSelectionRange(0, pageText.length);
      pendingSelectionRef.current = { start: 0, end: pageText.length, focus: keepFocus };
    } else if (outcome.kind === "discard") {
      // The manuscript changed under the composition: keep it as it is now.
      restoreMountedPage();
    } else if (outcome.kind === "page-commit") {
      const { nextCanonical, edit } = outcome;
      undoHistoryRef.current = pushEdit(undoHistoryRef.current, edit);
      const globalCaret = editorPageLocalToGlobal(currentPage, outcome.caretLocal);
      const nextState = commitCanonical(nextCanonical, {
        editStart: edit.rangeStart,
        editEnd: edit.rangeStart + edit.removedText.length,
        insertedLength: edit.insertedText.length,
      });
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
        switchToPageForOffset(globalCaret, nextPages, undefined, { focus: keepFocus });
      }
    }

    if (pendingJump?.kind === "global") {
      // Its offsets describe the manuscript a 全文選択 composition just replaced.
      if (outcome.kind === "whole-replace") return;
      switchToPageForOffset(
        pendingJump.end,
        computeEditorPages(contentRef.current, { forcedBoundaries, joinedRanges }),
        pendingJump,
        { scrollHint: "upper" }
      );
    } else if (externalChangePending) {
      reanchorForExternalContent(contentRef.current);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    let nextPageText = el.value;

    // A composition only mirrors the IME's view of the mounted page; the
    // manuscript is changed once, when it ends. A composing input without a
    // compositionstart (an IME that skipped it) begins the transaction from
    // the page as it was before this input.
    if (!compositionTxnRef.current && (event.nativeEvent as InputEvent).isComposing) {
      beginComposition(el, "input", {
        beforeText: pageTextRef.current,
        selectionStart: globalToEditorPageLocal(currentPage, globalCaretRangeRef.current.start),
        selectionEnd: globalToEditorPageLocal(currentPage, globalCaretRangeRef.current.end),
      });
    }
    if (compositionTxnRef.current) {
      pendingBeforeInputRef.current = null;
      setCompositionText(nextPageText);
      onNativeChangeCommitted?.(el);
      return;
    }
    const pendingWhole = pendingWholeInsertRef.current;
    if (pendingWhole !== null) {
      pendingWholeInsertRef.current = null;
      pendingBeforeInputRef.current = null;
      replaceWholeDocument(pendingWhole);
      onNativeChangeCommitted?.(el);
      return;
    }

    const pending = pendingBeforeInputRef.current;
    pendingBeforeInputRef.current = null;
    if (pending) {
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
    const rawEdit = pending
      ? computeRawEditFromBeforeInput(pending, nextPageText, currentPage.start)
      : computeRawEditFromBeforeInput(
          { beforeText: pageTextRef.current, selectionStart: 0, selectionEnd: 0, inputType: "" },
          nextPageText,
          currentPage.start
        );
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
    switchToPageForOffset(deleteFrom, newPages, undefined, { affinity: "backward", nextContent: nextCanonical });
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
    switchToPageForOffset(globalCaret, newPages, undefined, { nextContent: nextCanonical });
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
    // IME text is committed when the composition ends, never here. A
    // composition beforeinput without a compositionstart (an IME that skipped
    // it) begins the transaction while the page is still unedited.
    if (inputType.includes("Composition") || nativeEvent.isComposing) {
      if (!compositionTxnRef.current) beginComposition(el, "beforeinput");
      pendingBeforeInputRef.current = null;
      onNativeBeforeInput?.(el, inputType);
      return;
    }

    if (
      allSelectedRef.current &&
      !isComposingRef.current &&
      (inputType.startsWith("insert") || inputType.startsWith("delete"))
    ) {
      wholeInputArmedRef.current = false;
      const typed = inputType.startsWith("insert") ? insertedTextOf(nativeEvent) : "";
      const typedCharacter = inputType === "insertText" && typed.length === 1 && typed !== "\n";
      if (nativeEvent.cancelable) {
        nativeEvent.preventDefault();
        replaceWholeDocument(typed, { typedCharacter });
      } else {
        // The browser will edit the mounted page anyway; its input event
        // commits `typed` as the whole manuscript, never that page's value.
        pendingWholeInsertRef.current = typed;
      }
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
    switchToPageForOffset(result.selectionEnd, newPages, { start: result.selectionStart, end: result.selectionEnd }, { nextContent: result.canonicalText });
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
    const el = textareaRef.current;
    el?.focus({ preventScroll: true });
    el?.setSelectionRange(0, el.value.length);
  };

  // A click INSIDE the full-page selection collapses it only after `click`
  // (a late native `selectionchange`, which React's onSelect does not report),
  // so neither onClick nor onSelect sees it: end 全文選択 from the native event.
  useEffect(() => {
    const onSelectionChange = () => {
      const el = textareaRef.current;
      if (!allSelectedRef.current || wholeInputArmedRef.current || isComposingRef.current || !el || document.activeElement !== el) return;
      if (el.selectionStart !== 0 || el.selectionEnd !== el.value.length) {
        allSelectedRef.current = false;
        setIsFullManuscriptSelected(false);
      }
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  const deselectEntireManuscript = () => {
    setAllSelected(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    // Blink marks every keydown during a composition `isComposing`. One that
    // is not, while a transaction is still open, means the composition ended
    // without a compositionend (Blink dropped it): finish it now, or the
    // editor stays "composing" -- Ctrl+A, 全文を選択 and undo all refuse to run.
    if (compositionTxnRef.current && !event.nativeEvent.isComposing) {
      finishComposition(el, null, "keydown");
    }
    // A no-op beforeinput (Backspace at document start, Delete at its end)
    // has no matching input event to consume its snapshot. The next physical
    // key always starts a new transaction.
    pendingBeforeInputRef.current = null;
    // Deliberately NOT tied to the DOM selection still covering the page: a
    // real-OS IME may already have moved it, and the async selectionchange
    // reporting that must not end 全文選択 either.
    wholeInputArmedRef.current =
      allSelectedRef.current &&
      !isComposingRef.current &&
      (event.key === "Process" || event.nativeEvent.keyCode === 229);
    const isMod = event.ctrlKey || event.metaKey;
    if (isMod && !event.nativeEvent.isComposing) {
      const key = event.key.toLowerCase();
      // Product decision (docs/TATESPUN_WINDOWED_DEFAULT_READINESS.md): Ctrl/Cmd+A
      // in the editor selects the WHOLE manuscript, as in the single-textarea
      // (FULL) editor -- the same state as the 「全文を選択」 action. Only this
      // textarea's own keydown is handled, so Ctrl+A in the search, settings
      // and other inputs keeps the browser's own field select-all.
      if (key === "a" && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        selectEntireManuscript();
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
    if (event.key === "Escape" && allSelectedRef.current) {
      deselectEntireManuscript();
    }
    onNativeKeyDown?.(el);
  };

  const handleSelect = (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    // 全文選択 lasts exactly while the mounted page stays fully selected: any
    // click / arrow / drag that changes that ends it. (A one-shot "ignore the
    // next select event" guard used to live here; it failed for Ctrl+A, whose
    // own keyup reaches this handler after the select event, and it could go
    // stale when the page was already fully selected.) An IME key's own
    // selection move before compositionstart does not count (`wholeInputArmedRef`),
    // nor does the composition's own caret (its transaction decides the result).
    if (
      allSelectedRef.current &&
      !wholeInputArmedRef.current &&
      !isComposingRef.current &&
      (el.selectionStart !== 0 || el.selectionEnd !== el.value.length)
    ) {
      setAllSelected(false);
    }
    // §C: the ONE place a genuinely non-collapsed selection can appear (a
    // user drag-select) -- captures the true range, unlike `reportCaret`
    // (used everywhere else, always with a single already-collapsed
    // offset), so `canForceSplitAtCaret` can correctly disable while text
    // is selected.
    const globalStart = editorPageLocalToGlobal(currentPage, el.selectionStart);
    const globalEnd = editorPageLocalToGlobal(currentPage, el.selectionEnd);
    reportCaretRange(globalStart, globalEnd);
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Does NOT disarm `wholeInputArmedRef`: on a real OS the IME key's keyup
    // can arrive before its compositionstart, after the IME has already moved
    // the selection -- disarming here ended 全文選択 and the composition then
    // replaced only the mounted page.
    handleSelect(event);
  };

  const disarmWholeInput = () => {
    wholeInputArmedRef.current = false;
  };

  const handleBlur = (event: React.FocusEvent<HTMLTextAreaElement>) => {
    pendingBeforeInputRef.current = null;
    wholeInputArmedRef.current = false;
    // Blink finishes a composition (compositionend) before the blur; a
    // transaction still open here never got it. Finish it so a click on
    // 全文を選択 / a toolbar button acts on a settled editor.
    if (compositionTxnRef.current) finishComposition(event.currentTarget, null, "blur");
    undoHistoryRef.current = flushBatch(undoHistoryRef.current);
  };

  const handleCompositionStart = (event: React.CompositionEvent<HTMLTextAreaElement>) => {
    beginComposition(event.currentTarget, "compositionstart");
  };

  const handleCompositionUpdate = (event: React.CompositionEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    if (!compositionTxnRef.current) beginComposition(el, "compositionupdate");
    // The IME's whole current string: what a composition that never gets its
    // compositionend commits (the text the user sees).
    if (compositionTxnRef.current) compositionTxnRef.current.lastData = event.data ?? null;
    onNativeKeyDown?.(el);
  };

  const handleCompositionEnd = (event: React.CompositionEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    if (!compositionTxnRef.current) {
      // Already finished by a recovery signal (or never begun): nothing to commit.
      perfMark("PagedEditor:ime:stray-compositionend", { dataLength: event.data?.length ?? 0 });
      return;
    }
    finishComposition(el, event.data ?? "", "compositionend");
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
    // A jump to a specific range ends an explicit 全文を選択 (like goToPage).
    setAllSelected(false);
    // A non-empty range belongs to the page holding its LAST character, so a
    // match ending exactly at an 編集ページ boundary stays on its own page
    // (forward affinity on `end` would mount the next page and clamp the
    // selection to its offset 0). Collapsed carets (a Preview click) keep the
    // app-wide forward convention.
    switchToPageForOffset(end, pages, { start, end }, { scrollHint: "upper", affinity: start < end ? "backward" : "forward" });
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
    switchToPageForOffset(globalCaret, newPages, undefined, { nextContent: nextCanonical });
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
    switchToPageForOffset(forcedOffset, newPages, undefined, { scrollHint: "upper", nextContent: content });
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
    switchToPageForOffset(selectionStart, newPages, undefined, { scrollHint: "upper", nextContent: content });
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

  const pageLocalGhostRanges = useMemo(
    () => (ghostRanges && ghostRanges.length > 0 ? marksForPage(ghostRanges, currentPage.start, currentPage.end) : []),
    [ghostRanges, currentPage.start, currentPage.end],
  );

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
        {/* 全文を選択 (also Ctrl/Cmd+A in the editor): the whole-manuscript
            selection Copy/Cut/replace use across 編集ページ. Unmounted pages
            have no DOM to visually select, so the active state is announced
            in the label itself instead of a native highlight spanning pages
            it can't reach. Stays in the row on phones too (never folded). */}
        <button
          type="button"
          aria-pressed={isFullManuscriptSelected}
          data-editor-select-all=""
          title={isFullManuscriptSelected ? "全文の選択を解除します（Esc）" : "原稿全体を選択します（Ctrl+A）。編集ページをまたいで操作するときに使います。"}
          onClick={isFullManuscriptSelected ? deselectEntireManuscript : selectEntireManuscript}
          className={`whitespace-nowrap rounded-full border px-1.5 py-1 text-[11px] font-medium sm:px-2 ${
            isFullManuscriptSelected
              ? "border-accent bg-accent/10 text-ink"
              : "border-ink/20 text-ink/70 hover:bg-ink/5"
          }`}
        >
          {isFullManuscriptSelected ? "全文選択中　解除" : "全文を選択"}
        </button>
        {/* Phones (< md) only: folds the less frequent page tools below into
            this one row to give the manuscript its height back (320×568:
            181 → FULL-like height). Session-only UI state, never persisted;
            desktop/tablet never render the toggle and always show the tools. */}
        <button
          type="button"
          data-editor-page-tools-toggle=""
          aria-expanded={pageToolsExpanded}
          aria-controls={pageToolsId}
          aria-label={pageToolsExpanded ? "編集ページの操作を閉じる" : "編集ページの操作（ここで区切る・前のページとつなぐ・文字数）を開く"}
          onClick={() => setPageToolsExpanded((open) => !open)}
          className="inline-flex min-h-7 items-center gap-0.5 whitespace-nowrap rounded-full border border-ink/20 px-2 py-1 text-[11px] font-medium text-ink/70 hover:bg-ink/5 md:hidden"
        >
          {!pageToolsExpanded && isWaitingForBoundary && <span aria-hidden="true" className="text-amber-600">●</span>}
          {pageToolsExpanded ? "閉じる" : "操作"}
          <span aria-hidden="true">{pageToolsExpanded ? "▴" : "▾"}</span>
        </button>
        <span id={pageToolsId} data-editor-page-tools="" data-expanded={pageToolsExpanded ? "true" : "false"} className={`contents ${pageToolsExpanded ? "" : "max-md:hidden"}`}>
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
        </span>
      </div>

      <div className="relative min-h-0 flex-1">
        {pageLocalGhostRanges.length > 0 && (
          <div className="pointer-events-none absolute inset-0">
            <DescriptionMarkOverlay variant="held" textareaRef={textareaRef} text={displayedPageText} marks={compositionText === null ? pageLocalGhostRanges : []} />
          </div>
        )}
        {showDescriptionMarks && (
          <div className="pointer-events-none absolute inset-0">
            <DescriptionMarkOverlay textareaRef={textareaRef} text={displayedPageText} marks={compositionText === null ? pageLocalDescriptionMarks : []} />
          </div>
        )}
        {/* Stays mounted while the check is enabled: a stale analysis
            already yields no `pageLocalIssues`, so the overlay paints nothing
            until the re-check lands. Unmounting/remounting it on every edit
            forced two full-page compositor updates (~100 ms each with a
            300k-character Preview) that delayed the compose request. */}
        {writingCheck?.enabled && (
          <div className="pointer-events-none absolute inset-0">
            <WritingCheckOverlay textareaRef={textareaRef} text={displayedPageText} issues={compositionText === null ? pageLocalIssues : []} />
          </div>
        )}
        <textarea
          ref={textareaRef}
          data-demo-target="editor"
          data-editor-surface="paged"
          aria-label={`原稿本文（編集ページ ${safePageIndex + 1} / ${pageCount}）`}
          value={displayedPageText}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCopy={handleCopy}
          onCut={handleCut}
          onChange={handleChange}
          onSelect={handleSelect}
          onPointerDown={disarmWholeInput}
          onClick={handleSelect}
          onKeyUp={handleKeyUp}
          onBlur={handleBlur}
          onCompositionStart={handleCompositionStart}
          onCompositionUpdate={handleCompositionUpdate}
          onCompositionEnd={handleCompositionEnd}
          placeholder={placeholder}
          spellCheck={false}
          className={className ?? "absolute inset-0 h-full w-full resize-none overflow-y-auto overflow-x-hidden bg-transparent p-4 font-mono text-sm leading-relaxed text-ink outline-none placeholder:text-ink/40"}
        />
      </div>
    </div>
  );
}

const PagedEditor = forwardRef(PagedEditorInner);
export default PagedEditor;
