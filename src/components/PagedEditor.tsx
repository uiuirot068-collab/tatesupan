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
import {
  decideCompositionOutcome,
  decideWholeInputOutcome,
  type CompositionBase,
  type WholeInputPayloadSource,
} from "@/lib/windowedEditor/compositionTransaction";
import { resolveTextareaDeletion } from "@/lib/editorInputIntegrity";
import { perfMark, perfSpan } from "@/lib/perfDebug";
import WritingCheckOverlay from "./WritingCheckOverlay";
import DescriptionMarkOverlay from "./DescriptionMarkOverlay";
import { marksForPage } from "@/lib/descriptionMarkSegments";
import type { WritingDiagnostic } from "@/lib/writingCheckEngine";
import InfoTooltip from "./InfoTooltip";
import { EDITOR_PAGE_HELP } from "@/lib/editorTerminology";

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

/** An IME commit removing at least this much text re-applies (and reveals) its caret once the IME has finished. */
const LARGE_REPLACEMENT_LENGTH = 1_000;
/** How long an IME deletion absorbed over 全文選択 waits for its composition to start (see `endWholeImePre`). */
const WHOLE_IME_PRE_WINDOW_MS = 200;
/** How long a 全文選択 selection move nobody gestured waits for an IME key/composition before it counts as the user's (see `selectionGestureRef`). */
const SELECTION_DRIFT_MS = 300;
/** Keys that neither end a pending 全文選択 IME transaction nor count as a selection gesture: modifiers and IME mode keys. */
const IME_NEUTRAL_KEYS = new Set([
  "Shift", "Control", "Alt", "AltGraph", "Meta", "CapsLock", "Fn",
  "Process", "Unidentified", "Dead", "Compose",
  "Hiragana", "Katakana", "HiraganaKatakana", "KanaMode", "KanjiMode",
  "Zenkaku", "Hankaku", "ZenkakuHankaku", "Romaji", "Eisu", "Alphanumeric", "Convert", "NonConvert",
]);
/** Navigation keys: the user's own selection gesture (they may end 全文選択). */
const SELECTION_GESTURE_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]);

/**
 * ONE pagination per transaction: an edit handler paginates the text it
 * commits, and the render that follows reuses that result instead of
 * paginating the same 300k manuscript again. A single-entry cache keyed by
 * identity (pure input → output, so sharing it between instances is safe).
 */
let paginationCache: {
  text: string;
  forcedBoundaries: number[];
  joinedRanges: JoinedEditorPageRange[];
  pages: EditorPage[];
} | null = null;
function paginate(
  text: string,
  state: { forcedBoundaries: number[]; joinedRanges: JoinedEditorPageRange[] }
): EditorPage[] {
  const cached = paginationCache;
  if (
    cached &&
    cached.text === text &&
    cached.forcedBoundaries === state.forcedBoundaries &&
    cached.joinedRanges === state.joinedRanges
  ) {
    return cached.pages;
  }
  const end = perfSpan("PagedEditor:paginate", { length: text.length });
  const result = computeEditorPages(text, state);
  end({ pages: result.length });
  paginationCache = { text, forcedBoundaries: state.forcedBoundaries, joinedRanges: state.joinedRanges, pages: result };
  return result;
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

/** Scrolls the caret at `localOffset` into view (near the upper portion) only when it is outside the visible area. */
function revealCaret(el: HTMLTextAreaElement, localOffset: number): void {
  const caretTop = measureCaretOffsetTop(el, localOffset);
  const lineHeight = Number.parseFloat(window.getComputedStyle(el).lineHeight) || 20;
  if (caretTop - lineHeight < el.scrollTop || caretTop > el.scrollTop + el.clientHeight) {
    scrollCaretNearUpperView(el, localOffset);
  }
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
  // The PRE-composition phase of a 全文選択 IME transaction: opened by an IME
  // keydown (keyCode 229 / "Process") over 全文選択, held until the
  // composition starts (which takes it over) or a non-IME action (pointer,
  // another key, blur) ends it. On a real OS the IME/TSF may act on the
  // native textarea BEFORE compositionstart -- move or shrink its selection,
  // or delete the selected page text as an ordinary (sometimes uncancelable)
  // deletion. None of that is committed on its own: the deletion is absorbed
  // (`absorbed`), and the manuscript changes exactly once, when the
  // composition ends (or not at all, if it is canceled). Only an absorbed
  // deletion that no composition follows is the user's own edit (a
  // soft-keyboard Backspace): see `endWholeImePre`.
  const wholeImePreRef = useRef<{ absorbed: boolean } | null>(null);
  // Whether the user is making a selection gesture right now: a pointer down
  // on the textarea, or a navigation key. Such a gesture ends 全文選択 at
  // once. A selection move WITHOUT one may be the IME/TSF's own (before the
  // keydown, before compositionstart, after keyup, in whatever order): it
  // ends 全文選択 only if no IME key or composition follows within
  // `SELECTION_DRIFT_MS` (a phone's selection-handle drag sends no pointer
  // event to the textarea, and must still narrow the selection).
  const selectionGestureRef = useRef(false);
  const selectionDriftTokenRef = useRef(0);
  // After an IME commit that re-sliced the mounted page (or replaced the
  // whole manuscript), the intended caret is re-applied once the IME/browser
  // has finished with the textarea: Blink/the OS may still put the native
  // caret back at its own pre-commit offset -- which, on a page that now
  // starts elsewhere, is somewhere else in the manuscript. Any user action
  // (key, pointer, blur, a new composition) cancels it (`imeSettleTokenRef`).
  const imeSettleTokenRef = useRef(0);
  // Deferred work (the settle above, the pre-composition window below) runs
  // from a timer against the LATEST render's handlers, never a stale closure.
  const latestHandlersRef = useRef<{
    runImeSettle: (caret: number, affinity: "forward" | "backward", reveal: boolean) => void;
    endWholeImePre: (reason: string) => void;
  } | null>(null);
  // 全文選択's IME receptacle: while 全文選択 is on, input (typing, IME,
  // paste, deletion, copy / cut) goes to this separate textarea, which starts
  // EMPTY and never holds manuscript text -- the page's own textarea holds a
  // whole 編集ページ, and a real Windows IME composed over that selection
  // INCLUDING old text (its compositionupdate data was ~39k old characters; no
  // event carried the user's string). The IME composes over nothing here, and
  // the committed string is checked against the receptacle exactly
  // (`decideWholeInputOutcome`). The page's native selection is not used for
  // 全文選択 at all; the page is shown with the held-selection highlight.
  const wholeInputRef = useRef<HTMLTextAreaElement>(null);
  const wholeInputTxnRef = useRef<{ baseCanonical: string; startValue: string; lastData: string | null } | null>(null);
  // A receptacle input whose beforeinput could not be canceled: its own text.
  const pendingWholeInputInsertRef = useRef<string | null>(null);
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
    () => paginate(content, { forcedBoundaries, joinedRanges }),
    [content, forcedBoundaries, joinedRanges]
  );
  const pageCount = pages.length;

  const safePageIndex = clampPageIndex(currentPageIndex, pageCount);
  const currentPage: EditorPage = pages[safePageIndex];
  const pageText = content.slice(currentPage.start, currentPage.end);
  // What the textarea shows: the mounted page, or the IME's view of it during a composition.
  const displayedPageText = compositionText ?? pageText;
  // A layout effect: the next input event must compare against the page React
  // just committed, never the previous one (see the DOM-divergence guard in
  // `handleChange`).
  useLayoutEffect(() => {
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

  /** Re-applies `caret` once the IME/browser has finished with the textarea (after compositionend, then a frame later); cancelled by any user action. */
  const scheduleImeSettle = (caret: number, affinity: "forward" | "backward", reveal: boolean) => {
    const token = ++imeSettleTokenRef.current;
    const run = () => {
      if (imeSettleTokenRef.current === token) latestHandlersRef.current?.runImeSettle(caret, affinity, reveal);
    };
    setTimeout(() => {
      run();
      requestAnimationFrame(run);
    }, 0);
  };
  const cancelImeSettle = () => {
    imeSettleTokenRef.current += 1;
  };
  const runImeSettle = (settleCaret: number, affinity: "forward" | "backward", reveal: boolean) => {
    const el = textareaRef.current;
    if (!el || isComposingRef.current || document.activeElement !== el) return;
    const caret = Math.max(0, Math.min(content.length, settleCaret));
    const targetIndex = editorPageForGlobalOffset(pages, caret, affinity);
    if (targetIndex !== safePageIndex) {
      perfMark("PagedEditor:ime:settle", { action: "page", from: safePageIndex, to: targetIndex });
      switchToPageForOffset(caret, pages, undefined, { affinity, scrollHint: "upper" });
      reportCaret(caret);
      return;
    }
    if (el.value !== pageText) {
      // The IME/browser wrote into the textarea after the commit: the page
      // shown must be the manuscript's, never a leftover of the IME's view.
      perfMark("PagedEditor:ime:settle", { action: "resync", domLength: el.value.length, pageLength: pageText.length });
      el.value = pageText;
      onNativeIntegrityRepair?.(el, { inputType: "imeSettle", beforeLength: pageText.length, rejectedLength: pageText.length, repairedLength: pageText.length });
    }
    const local = globalToEditorPageLocal(currentPage, caret);
    if (el.selectionStart !== local || el.selectionEnd !== local) {
      perfMark("PagedEditor:ime:settle", { action: "caret", from: el.selectionStart, to: local });
      el.setSelectionRange(local, local);
      reportCaret(caret);
    }
    if (reveal) revealCaret(el, local);
  };

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
    wholeImePreRef.current = null;
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
    const newPages = paginate(typed, nextState);
    switchToPageForOffset(typed.length, newPages, undefined, { nextContent: typed, focus: options?.focus });
    reportCaret(typed.length);
  };

  /**
   * Ends the pre-composition phase of a 全文選択 IME transaction WITHOUT a
   * composition (a non-IME key, a pointer, blur, or no compositionstart
   * within `WHOLE_IME_PRE_WINDOW_MS` of an absorbed deletion). Nothing
   * absorbed: nothing to do. An absorbed deletion with no composition after it
   * (a soft-keyboard Backspace -- keyCode 229 on Android -- or an IME that
   * deletes without composing) was the user's edit: over 全文選択 it deletes
   * the WHOLE manuscript, once, as one undo step; never the mounted page only.
   */
  const endWholeImePre = (reason: string) => {
    const pre = wholeImePreRef.current;
    if (!pre) return;
    wholeImePreRef.current = null;
    perfMark("PagedEditor:ime:pre-end", { reason, absorbed: pre.absorbed });
    if (!pre.absorbed) return;
    setCompositionText(null);
    replaceWholeDocument("", { focus: reason !== "blur" });
  };
  // An absorbed deletion's window for its composition to start (see above).
  const armWholeImePreWindow = () => {
    const pre = wholeImePreRef.current;
    if (!pre) return;
    setTimeout(() => {
      if (wholeImePreRef.current === pre && !compositionTxnRef.current) {
        latestHandlersRef.current?.endWholeImePre("no-composition");
      }
    }, WHOLE_IME_PRE_WINDOW_MS);
  };
  useLayoutEffect(() => {
    latestHandlersRef.current = { runImeSettle, endWholeImePre };
  });

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
    // The pre-composition phase (if any) becomes this transaction: whatever the
    // IME did to the textarea before compositionstart is part of it.
    const pre = wholeImePreRef.current;
    wholeImePreRef.current = null;
    selectionGestureRef.current = false;
    cancelImeSettle();
    isComposingRef.current = true;
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
      // 全文選択 itself decides -- never the DOM selection or value, which the
      // IME may already have moved, narrowed or deleted.
      whole: allSelectedRef.current || pre !== null,
      lastData: null,
    };
    perfMark("PagedEditor:ime:begin", {
      source,
      whole: compositionTxnRef.current.whole,
      pre: pre !== null,
      preAbsorbed: pre?.absorbed ?? false,
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
    wholeImePreRef.current = null;
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
      // Where the committed string came from: compositionend's data, else the
      // last compositionupdate's (a recovery), else none. Never the DOM.
      payloadSource: data !== null ? "compositionend" : txn.lastData !== null ? "compositionupdate" : "none",
      dataLength: (data ?? txn.lastData)?.length ?? null,
      compositionendDataLength: data?.length ?? null,
      lastUpdateDataLength: txn.lastData?.length ?? null,
      beforePageLength: txn.beforeText.length,
      beforeSelection: txn.selectionEnd - txn.selectionStart,
      finalLength: finalPageText.length,
    });
    // Puts the textarea back on the unchanged mounted page. React would too
    // (the value prop returns to `pageText`), but only if that prop differs
    // from what it last rendered -- the DOM may have moved on without an input.
    const restoreMountedPage = () => {
      if (el.value !== pageText) el.value = pageText;
    };

    if (outcome.kind === "whole-replace") {
      // ONE atomic undo step back to the whole manuscript. Built from the
      // IME's string alone: whatever the textarea still holds (the IME may
      // have composed beside, inside or instead of the page's text) is never
      // read, and is replaced by the new page when React renders -- and again
      // after the IME has finished, if it wrote into the textarea later.
      replaceWholeDocument(outcome.text, { focus: keepFocus });
      if (keepFocus) scheduleImeSettle(outcome.text.length, "backward", true);
    } else if (outcome.kind === "whole-unchanged") {
      // Canceled, or the IME's text is unknown: never a page-local or guessed
      // replacement. The manuscript and 全文選択 stay as they were.
      restoreMountedPage();
      setAllSelected(true);
      if (keepFocus) wholeInputRef.current?.focus({ preventScroll: true });
    } else if (outcome.kind === "discard") {
      // The manuscript changed under the composition: keep it as it is now.
      restoreMountedPage();
    } else if (outcome.kind === "page-commit") {
      const { nextCanonical, edit } = outcome;
      undoHistoryRef.current = pushEdit(undoHistoryRef.current, edit);
      // The caret goes right after the committed text -- taken from the edit
      // itself, never the DOM caret: Blink/the IME may still move that after
      // compositionend, in the OLD page's offsets.
      const globalCaret = edit.rangeStart + edit.insertedText.length;
      const nextState = commitCanonical(nextCanonical, {
        editStart: edit.rangeStart,
        editEnd: edit.rangeStart + edit.removedText.length,
        insertedLength: edit.insertedText.length,
      });
      reportCaret(globalCaret);

      // TSP-PAGED-EDITOR-QA-FIXES-AND-DEMO-010 §B, extended: the commit can
      // re-slice the 編集ページ -- grow this page past its size (the text and
      // caret move to the NEXT page), or shrink it enough (a large selection
      // replaced) to join the page before it, changing the page count. The
      // caret's page is mounted, the caret placed right after the committed
      // text (the page holding its LAST character: backward affinity) and
      // scrolled into view; then re-applied once the IME has finished.
      const nextPages = paginate(nextCanonical, nextState);
      const affinity = edit.insertedText.length > 0 ? "backward" : "forward";
      const targetIndex = editorPageForGlobalOffset(nextPages, globalCaret, affinity);
      const targetPage = nextPages[targetIndex];
      // Re-sliced whenever the textarea will NOT simply keep the IME's final
      // text: another page, or this page's start or END moved (a large
      // replacement pulls the next page's text in). React then assigns a new
      // value, and the browser puts the caret at its END -- so the caret is
      // placed again in that same commit.
      const resliced =
        targetIndex !== safePageIndex ||
        targetPage.start !== currentPage.start ||
        nextCanonical.slice(targetPage.start, targetPage.end) !== finalPageText;
      const largeReplacement = edit.removedText.length >= LARGE_REPLACEMENT_LENGTH;
      if (resliced) {
        switchToPageForOffset(globalCaret, nextPages, undefined, {
          focus: keepFocus,
          affinity,
          scrollHint: "upper",
          nextContent: nextCanonical,
        });
      }
      if (keepFocus && (resliced || largeReplacement)) scheduleImeSettle(globalCaret, affinity, true);
      perfMark("PagedEditor:ime:page-commit", {
        removed: edit.removedText.length,
        inserted: edit.insertedText.length,
        fromPage: safePageIndex,
        toPage: targetIndex,
        pagesBefore: pageCount,
        pagesAfter: nextPages.length,
        resliced,
      });
    }

    if (pendingJump?.kind === "global") {
      // Its offsets describe the manuscript a 全文選択 composition just replaced.
      if (outcome.kind === "whole-replace") return;
      switchToPageForOffset(
        pendingJump.end,
        paginate(contentRef.current, { forcedBoundaries, joinedRanges }),
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
    perfMark("PagedEditor:trace:input", {
      inputType: (event.nativeEvent as InputEvent).inputType ?? "",
      dataLength: (event.nativeEvent as InputEvent).data?.length ?? null,
      isComposing: (event.nativeEvent as InputEvent).isComposing ?? false,
      whole: allSelectedRef.current,
      pre: wholeImePreRef.current !== null,
      txn: compositionTxnRef.current !== null,
      length: nextPageText.length,
      pageLength: pageTextRef.current.length,
      start: el.selectionStart,
    });

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
    // 全文選択's pre-composition phase: the IME/TSF changed the textarea
    // (typically deleting the selected page text) before compositionstart.
    // Mirrored, never committed: the composition that follows replaces the
    // whole manuscript once, or nothing changes (`endWholeImePre`).
    if (wholeImePreRef.current) {
      if (!wholeImePreRef.current.absorbed) {
        wholeImePreRef.current.absorbed = true;
        armWholeImePreWindow();
      }
      pendingBeforeInputRef.current = null;
      perfMark("PagedEditor:ime:pre-absorb", { source: "input", domLength: nextPageText.length });
      setCompositionText(nextPageText);
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
    // 全文選択 takes its input in the receptacle; the page's textarea changing
    // without focus meanwhile is never the user's edit: refused, page restored.
    if (allSelectedRef.current && document.activeElement !== el) {
      perfMark("PagedEditor:dom-diverged", { inputType: "unfocused-during-whole", domLength: nextPageText.length, pageLength: pageTextRef.current.length });
      pendingBeforeInputRef.current = null;
      el.value = pageTextRef.current;
      return;
    }

    const pending = pendingBeforeInputRef.current;
    pendingBeforeInputRef.current = null;
    if (pending && pending.beforeText !== pageTextRef.current) {
      // The textarea no longer held the manuscript's page when this edit began
      // (an IME/browser wrote into it outside any transaction): a page-local
      // commit of its value would splice that foreign text into the
      // manuscript. Refused -- the page is put back, the manuscript untouched.
      perfMark("PagedEditor:dom-diverged", {
        inputType: pending.inputType,
        domLength: pending.beforeText.length,
        pageLength: pageTextRef.current.length,
      });
      const rejectedLength = el.value.length;
      el.value = pageTextRef.current;
      const caret = globalToEditorPageLocal(
        currentPage,
        Math.max(currentPage.start, Math.min(currentPage.end, globalCaretRangeRef.current.start))
      );
      el.setSelectionRange(caret, caret);
      onNativeIntegrityRepair?.(el, {
        inputType: pending.inputType,
        beforeLength: pending.beforeText.length,
        rejectedLength,
        repairedLength: pageTextRef.current.length,
      });
      return;
    }
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
    const nextPages = paginate(nextCanonical, nextState);
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
    const newPages = paginate(nextCanonical, nextState);
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
    const newPages = paginate(nextCanonical, nextState);
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
    perfMark("PagedEditor:trace:beforeinput", {
      inputType,
      cancelable: nativeEvent.cancelable,
      isComposing: nativeEvent.isComposing,
      dataLength: nativeEvent.data?.length ?? null,
      whole: allSelectedRef.current,
      pre: wholeImePreRef.current !== null,
      txn: compositionTxnRef.current !== null,
      start: el.selectionStart,
      end: el.selectionEnd,
      length: el.value.length,
    });
    // IME text is committed when the composition ends, never here. A
    // composition beforeinput without a compositionstart (an IME that skipped
    // it) begins the transaction while the page is still unedited.
    if (inputType.includes("Composition") || nativeEvent.isComposing) {
      if (!compositionTxnRef.current) beginComposition(el, "beforeinput");
      pendingBeforeInputRef.current = null;
      onNativeBeforeInput?.(el, inputType);
      return;
    }

    // 全文選択's pre-composition phase: a deletion now is the IME/TSF removing
    // the selected page text before its composition -- part of the IME's
    // replacement, never a commit of its own (an empty manuscript, or a
    // page-local deletion when it could not be canceled).
    if (wholeImePreRef.current && inputType.startsWith("delete")) {
      if (!wholeImePreRef.current.absorbed) {
        wholeImePreRef.current.absorbed = true;
        armWholeImePreWindow();
      }
      if (nativeEvent.cancelable) nativeEvent.preventDefault();
      perfMark("PagedEditor:ime:pre-absorb", { source: "beforeinput", inputType, cancelable: nativeEvent.cancelable });
      pendingBeforeInputRef.current = null;
      return;
    }

    if (
      allSelectedRef.current &&
      !isComposingRef.current &&
      (inputType.startsWith("insert") || inputType.startsWith("delete"))
    ) {
      // An insert with no composition (an IME that commits directly) is the
      // user's replacement text itself.
      wholeImePreRef.current = null;
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
    const newPages = paginate(result.canonicalText, nextState);
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
    // A pointer gesture that preceded this (a click in the textarea before
    // the 全文を選択 button) must not end it through a later selection move.
    selectionGestureRef.current = false;
    setAllSelected(true);
    // Input now goes to the EMPTY receptacle (never the page's own textarea,
    // whose native selection is left alone): see `wholeInputRef`. Focused in
    // this same event, so a phone's soft keyboard opens (or stays) with it.
    const input = wholeInputRef.current;
    if (input) {
      if (!wholeInputTxnRef.current) input.value = "";
      input.focus({ preventScroll: true });
    }
    perfMark("PagedEditor:whole-input:enter", { page: safePageIndex, pageLength: pageText.length });
  };

  /** Leaves 全文選択 back to ordinary editing on the mounted page (its own caret, as it was). */
  const exitWholeToPage = (reason: string) => {
    perfMark("PagedEditor:whole-input:exit", { reason });
    setAllSelected(false);
    const input = wholeInputRef.current;
    if (input && !wholeInputTxnRef.current) input.value = "";
    textareaRef.current?.focus({ preventScroll: true });
  };

  /** ONE whole-manuscript commit from the receptacle (typed / pasted / deleted / cut text), then back to the page. */
  const commitWholeInput = (text: string, source: WholeInputPayloadSource, options?: { typedCharacter?: boolean }) => {
    perfMark("PagedEditor:whole-input:commit", { source, committedLength: text.length });
    const input = wholeInputRef.current;
    if (input) input.value = "";
    replaceWholeDocument(text, { typedCharacter: options?.typedCharacter, focus: true });
  };

  const openWholeInputTxn = (el: HTMLTextAreaElement, source: string) => {
    wholeInputTxnRef.current = { baseCanonical: content, startValue: el.value, lastData: null };
    isComposingRef.current = true;
    cancelImeSettle();
    perfMark("PagedEditor:whole-input:begin", { source, startLength: el.value.length });
  };

  /**
   * Closes a receptacle composition with ONE commit or none, whatever ended
   * it: compositionend (`data`), or a recovery (keydown / blur / a new
   * composition) with the last compositionupdate's data. The payload is the
   * IME's string only, verified against the receptacle (`decideWholeInputOutcome`);
   * the page's textarea is never read.
   */
  const finishWholeInput = (data: string | null, source: WholeInputPayloadSource, reason: string) => {
    const txn = wholeInputTxnRef.current;
    if (!txn) return;
    wholeInputTxnRef.current = null;
    isComposingRef.current = false;
    const input = wholeInputRef.current;
    const receptacleValue = input?.value ?? "";
    const outcome = decideWholeInputOutcome({
      baseCanonical: txn.baseCanonical,
      currentCanonical: content,
      startValue: txn.startValue,
      receptacleValue,
      data,
      source,
    });
    perfMark("PagedEditor:whole-input:finish", {
      reason,
      outcome: outcome.kind,
      detail: outcome.kind === "whole-unchanged" ? outcome.reason : null,
      payloadSource: outcome.source,
      dataLength: data?.length ?? null,
      lastUpdateDataLength: txn.lastData?.length ?? null,
      receptacleLength: receptacleValue.length,
      committedLength: outcome.kind === "whole-replace" ? outcome.text.length : null,
    });
    const keepFocus = reason !== "blur";
    if (outcome.kind === "whole-replace") {
      if (input) input.value = "";
      replaceWholeDocument(outcome.text, { focus: keepFocus });
      if (keepFocus) scheduleImeSettle(outcome.text.length, "backward", true);
      return;
    }
    // Nothing changes: 全文選択 stays, the receptacle is empty again.
    if (input) input.value = "";
    if (keepFocus && allSelectedRef.current) input?.focus({ preventScroll: true });
  };

  const handleWholeInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    const composing = event.nativeEvent.isComposing;
    perfMark("PagedEditor:trace:whole-input:keydown", {
      key: event.key.length === 1 ? "char" : event.key,
      keyCode: event.nativeEvent.keyCode,
      isComposing: composing,
      txn: wholeInputTxnRef.current !== null,
      length: el.value.length,
    });
    // A non-composing key while a composition is still open: it ended without
    // compositionend. Its last update is the payload (still verified).
    const txn = wholeInputTxnRef.current;
    if (txn && !composing) finishWholeInput(txn.lastData, txn.lastData !== null ? "compositionupdate" : "none", "keydown");
    if (composing) return;
    cancelImeSettle();
    const isMod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (isMod && key === "a" && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      return;
    }
    if (isMod && (key === "z" || key === "y")) {
      event.preventDefault();
      exitWholeToPage("history");
      runHistory(key === "y" || event.shiftKey ? "redo" : "undo");
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      exitWholeToPage("escape");
      return;
    }
    // Backspace / Delete over 全文選択: the whole manuscript, once. Handled at
    // the key (an empty textarea may send no beforeinput for them).
    if (!isMod && !event.altKey && (event.key === "Backspace" || event.key === "Delete")) {
      event.preventDefault();
      commitWholeInput("", "beforeinput");
      return;
    }
    if (SELECTION_GESTURE_KEYS.has(event.key)) {
      event.preventDefault();
      exitWholeToPage("navigation");
    }
  };

  const handleWholeInputBeforeInput = (el: HTMLTextAreaElement, nativeEvent: InputEvent) => {
    const inputType = nativeEvent.inputType ?? "";
    perfMark("PagedEditor:trace:whole-input:beforeinput", {
      inputType,
      cancelable: nativeEvent.cancelable,
      isComposing: nativeEvent.isComposing,
      dataLength: nativeEvent.data?.length ?? null,
      txn: wholeInputTxnRef.current !== null,
      length: el.value.length,
    });
    // The IME writes into the empty receptacle; its string is taken at the end.
    if (inputType.includes("Composition") || nativeEvent.isComposing) {
      if (!wholeInputTxnRef.current) openWholeInputTxn(el, "beforeinput");
      return;
    }
    if (!inputType.startsWith("insert") && !inputType.startsWith("delete")) {
      if (nativeEvent.cancelable) nativeEvent.preventDefault();
      return;
    }
    const typed = inputType.startsWith("insert") ? insertedTextOf(nativeEvent) : "";
    const typedCharacter = inputType === "insertText" && typed.length === 1 && typed !== "\n";
    if (nativeEvent.cancelable) {
      nativeEvent.preventDefault();
      commitWholeInput(typed, "beforeinput", { typedCharacter });
    } else {
      pendingWholeInputInsertRef.current = typed;
    }
  };

  useEffect(() => {
    const el = wholeInputRef.current;
    if (!el) return;
    const onBeforeInput = (event: Event) => handleWholeInputBeforeInput(el, event as InputEvent);
    // Copy / Cut act on an EMPTY textarea here: canceling beforecopy /
    // beforecut keeps Blink's Copy / Cut commands enabled (keyboard and
    // context menu), so the copy / cut events below still fire.
    const enableClipboard = (event: Event) => event.preventDefault();
    el.addEventListener("beforeinput", onBeforeInput);
    el.addEventListener("beforecopy", enableClipboard);
    el.addEventListener("beforecut", enableClipboard);
    return () => {
      el.removeEventListener("beforeinput", onBeforeInput);
      el.removeEventListener("beforecopy", enableClipboard);
      el.removeEventListener("beforecut", enableClipboard);
    };
  });

  const handleWholeInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    perfMark("PagedEditor:trace:whole-input:input", {
      inputType: (event.nativeEvent as InputEvent).inputType ?? "",
      isComposing: (event.nativeEvent as InputEvent).isComposing ?? false,
      dataLength: (event.nativeEvent as InputEvent).data?.length ?? null,
      txn: wholeInputTxnRef.current !== null,
      length: el.value.length,
    });
    if (!wholeInputTxnRef.current && (event.nativeEvent as InputEvent).isComposing) openWholeInputTxn(el, "input");
    if (wholeInputTxnRef.current) return; // the IME's own view; decided at its end
    const pending = pendingWholeInputInsertRef.current;
    pendingWholeInputInsertRef.current = null;
    if (pending !== null) {
      commitWholeInput(pending, "beforeinput");
      return;
    }
    // An input whose text is unknown: nothing changes.
    perfMark("PagedEditor:whole-input:finish", { reason: "input", outcome: "whole-unchanged", detail: "unknown-text", payloadSource: "none" });
    el.value = "";
  };

  const handleWholeInputCompositionStart = (event: React.CompositionEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    const txn = wholeInputTxnRef.current;
    perfMark("PagedEditor:trace:whole-input:compositionstart", { dataLength: event.data?.length ?? null, txn: txn !== null, length: el.value.length });
    if (txn) finishWholeInput(txn.lastData, txn.lastData !== null ? "compositionupdate" : "none", "restart");
    openWholeInputTxn(el, "compositionstart");
  };

  const handleWholeInputCompositionUpdate = (event: React.CompositionEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    perfMark("PagedEditor:trace:whole-input:compositionupdate", { dataLength: event.data?.length ?? null, txn: wholeInputTxnRef.current !== null, length: el.value.length });
    if (!wholeInputTxnRef.current) openWholeInputTxn(el, "compositionupdate");
    if (wholeInputTxnRef.current) wholeInputTxnRef.current.lastData = event.data ?? null;
  };

  const handleWholeInputCompositionEnd = (event: React.CompositionEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    perfMark("PagedEditor:trace:whole-input:compositionend", { dataLength: event.data?.length ?? null, txn: wholeInputTxnRef.current !== null, length: el.value.length });
    if (!wholeInputTxnRef.current) {
      // Already finished by a recovery: nothing to commit.
      el.value = "";
      return;
    }
    finishWholeInput(event.data ?? "", "compositionend", "compositionend");
  };

  const handleWholeInputPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    commitWholeInput(event.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n"), "beforeinput");
  };

  const handleWholeInputCopy = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    event.clipboardData.setData("text/plain", content);
  };

  const handleWholeInputCut = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    event.clipboardData.setData("text/plain", content);
    commitWholeInput("", "beforeinput");
  };

  const handleWholeInputBlur = () => {
    const txn = wholeInputTxnRef.current;
    if (txn) finishWholeInput(txn.lastData, txn.lastData !== null ? "compositionupdate" : "none", "blur");
  };

  /** The page's own textarea taking focus (a click / tap on it, Tab) ends 全文選択: ordinary editing resumes there. */
  const handlePageFocus = () => {
    if (!allSelectedRef.current) return;
    perfMark("PagedEditor:whole-input:exit", { reason: "page-focus" });
    setAllSelected(false);
  };

  /**
   * The native selection no longer covers the mounted page while 全文選択 is
   * on. The user's own selection gesture ends 全文選択 at once; a move nobody
   * gestured (the IME/TSF's own, in any order around the IME key's keydown /
   * keyup / compositionstart -- or a phone's selection-handle drag) ends it
   * only if no IME transaction has started `SELECTION_DRIFT_MS` later. Never
   * while an IME transaction (its pre-phase or composition) is open: that
   * transaction decides the result. Refs only (the selectionchange listener
   * below is registered once).
   */
  const endWholeSelectionIfLeft = (el: HTMLTextAreaElement) => {
    // 全文選択 takes its input in the receptacle, and the page taking focus
    // ends it (`handlePageFocus`): an unfocused page's own selection (it is not
    // used for 全文選択) never counts.
    if (typeof document !== "undefined" && document.activeElement !== el) return;
    if (!allSelectedRef.current || wholeImePreRef.current || isComposingRef.current) return;
    if (el.selectionStart === 0 && el.selectionEnd === el.value.length) return;
    if (selectionGestureRef.current) {
      allSelectedRef.current = false;
      setIsFullManuscriptSelected(false);
      return;
    }
    const token = ++selectionDriftTokenRef.current;
    setTimeout(() => {
      const current = textareaRef.current;
      if (selectionDriftTokenRef.current !== token || !current || !allSelectedRef.current) return;
      if (document.activeElement !== current) return;
      if (wholeImePreRef.current || compositionTxnRef.current || isComposingRef.current) return;
      if (current.selectionStart === 0 && current.selectionEnd === current.value.length) return;
      perfMark("PagedEditor:selection-drift:end-whole", { start: current.selectionStart, end: current.selectionEnd, length: current.value.length });
      allSelectedRef.current = false;
      setIsFullManuscriptSelected(false);
    }, SELECTION_DRIFT_MS);
  };

  // A click INSIDE the full-page selection collapses it only after `click`
  // (a late native `selectionchange`, which React's onSelect does not report),
  // so neither onClick nor onSelect sees it: end 全文選択 from the native event.
  useEffect(() => {
    const onSelectionChange = () => {
      const el = textareaRef.current;
      if (!el || document.activeElement !== el) return;
      perfMark("PagedEditor:trace:selectionchange", {
        start: el.selectionStart,
        end: el.selectionEnd,
        length: el.value.length,
        whole: allSelectedRef.current,
        gesture: selectionGestureRef.current,
        pre: wholeImePreRef.current !== null,
        composing: isComposingRef.current,
      });
      endWholeSelectionIfLeft(el);
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
    cancelImeSettle();
    const imeKey = event.key === "Process" || event.nativeEvent.keyCode === 229;
    perfMark("PagedEditor:trace:keydown", {
      key: event.key.length === 1 ? "char" : event.key,
      keyCode: event.nativeEvent.keyCode,
      isComposing: event.nativeEvent.isComposing,
      whole: allSelectedRef.current,
      pre: wholeImePreRef.current !== null,
      txn: compositionTxnRef.current !== null,
      start: el.selectionStart,
      end: el.selectionEnd,
      length: el.value.length,
    });
    selectionGestureRef.current = false;
    if (imeKey) {
      // An IME key over 全文選択 opens its transaction's pre-composition phase
      // now -- NOT tied to the DOM selection still covering the page: the IME
      // may already have moved it, or be about to.
      if (allSelectedRef.current && !isComposingRef.current && !wholeImePreRef.current) {
        wholeImePreRef.current = { absorbed: false };
      }
    } else if (!IME_NEUTRAL_KEYS.has(event.key)) {
      endWholeImePre("keydown");
      // A navigation key is the user's own selection gesture.
      if (!event.nativeEvent.isComposing && SELECTION_GESTURE_KEYS.has(event.key)) selectionGestureRef.current = true;
    }
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
    // 全文選択 lasts while the mounted page stays fully selected: a click /
    // arrow / drag -- the user's own selection gesture -- that changes that
    // ends it. (A one-shot "ignore the next select event" guard used to live
    // here; it failed for Ctrl+A, whose own keyup reaches this handler after
    // the select event, and it could go stale when the page was already fully
    // selected.) A selection move nobody gestured -- the IME/TSF's, before or
    // after the IME key's keydown, keyup or compositionstart -- ends it only
    // when no IME transaction follows, and the composition's own caret never
    // does (its transaction decides the result): `endWholeSelectionIfLeft`.
    endWholeSelectionIfLeft(el);
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
    // Does NOT end the pre-composition phase: on a real OS the IME key's keyup
    // can arrive before its compositionstart, after the IME has already moved
    // the selection -- ending it here ended 全文選択 and the composition then
    // replaced only the mounted page.
    perfMark("PagedEditor:trace:keyup", {
      key: event.key.length === 1 ? "char" : event.key,
      keyCode: event.nativeEvent.keyCode,
      whole: allSelectedRef.current,
      pre: wholeImePreRef.current !== null,
      txn: compositionTxnRef.current !== null,
    });
    handleSelect(event);
  };

  const handlePointerDown = () => {
    selectionGestureRef.current = true;
    cancelImeSettle();
    endWholeImePre("pointer");
  };

  const handleBlur = (event: React.FocusEvent<HTMLTextAreaElement>) => {
    pendingBeforeInputRef.current = null;
    selectionGestureRef.current = false;
    cancelImeSettle();
    endWholeImePre("blur");
    // Blink finishes a composition (compositionend) before the blur; a
    // transaction still open here never got it. Finish it so a click on
    // 全文を選択 / a toolbar button acts on a settled editor.
    if (compositionTxnRef.current) finishComposition(event.currentTarget, null, "blur");
    undoHistoryRef.current = flushBatch(undoHistoryRef.current);
  };

  const traceComposition = (type: string, event: React.CompositionEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    perfMark(`PagedEditor:trace:${type}`, {
      dataLength: event.data?.length ?? null,
      whole: allSelectedRef.current,
      pre: wholeImePreRef.current !== null,
      txn: compositionTxnRef.current !== null,
      start: el.selectionStart,
      end: el.selectionEnd,
      length: el.value.length,
      page: safePageIndex,
    });
  };

  const handleCompositionStart = (event: React.CompositionEvent<HTMLTextAreaElement>) => {
    traceComposition("compositionstart", event);
    beginComposition(event.currentTarget, "compositionstart");
  };

  const handleCompositionUpdate = (event: React.CompositionEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    traceComposition("compositionupdate", event);
    if (!compositionTxnRef.current) beginComposition(el, "compositionupdate");
    // The IME's whole current string: what a composition that never gets its
    // compositionend commits (the text the user sees).
    if (compositionTxnRef.current) compositionTxnRef.current.lastData = event.data ?? null;
    onNativeKeyDown?.(el);
  };

  const handleCompositionEnd = (event: React.CompositionEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    traceComposition("compositionend", event);
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
    const newPages = paginate(nextCanonical, nextState);
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
    const newPages = paginate(content, { forcedBoundaries: nextForced, joinedRanges: nextJoined });
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

    const newPages = paginate(content, { forcedBoundaries: nextForced, joinedRanges: nextJoined });
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

  const wholePageMark = useMemo(() => [{ start: 0, end: pageText.length }], [pageText.length]);

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
          className="flex min-h-7 min-w-7 items-center justify-center rounded border border-ink/20 text-ink/70 hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
        >
          <span aria-hidden="true">←</span>
        </button>
        <span className="inline-flex items-center gap-0.5">
          <span aria-live="polite" data-editor-page-indicator="" className="whitespace-nowrap font-medium">
            編集ページ {safePageIndex + 1} / {pageCount}
          </span>
          <InfoTooltip text={EDITOR_PAGE_HELP} label="編集ページの説明" />
        </span>
        <button
          type="button"
          aria-label="次の編集ページへ移動"
          disabled={safePageIndex === pageCount - 1}
          onClick={() => goToPage(safePageIndex + 1)}
          className="flex min-h-7 min-w-7 items-center justify-center rounded border border-ink/20 text-ink/70 hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
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
          className="whitespace-nowrap rounded-full border border-ink/20 px-1.5 py-1 text-[11px] font-medium text-ink/70 hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent sm:px-2"
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
            className="whitespace-nowrap rounded-full border border-ink/20 px-1.5 py-1 text-[11px] font-medium text-ink/70 hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent sm:px-2"
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
        {(pageLocalGhostRanges.length > 0 || isFullManuscriptSelected) && (
          <div className="pointer-events-none absolute inset-0">
            {/* 全文選択 shows the mounted page with the held-selection
                highlight: the page's native selection is not used for it. */}
            <DescriptionMarkOverlay variant="held" textareaRef={textareaRef} text={displayedPageText} marks={compositionText !== null ? [] : isFullManuscriptSelected ? wholePageMark : pageLocalGhostRanges} />
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
          onPointerDown={handlePointerDown}
          onClick={handleSelect}
          onKeyUp={handleKeyUp}
          onBlur={handleBlur}
          onFocus={handlePageFocus}
          onCompositionStart={handleCompositionStart}
          onCompositionUpdate={handleCompositionUpdate}
          onCompositionEnd={handleCompositionEnd}
          placeholder={placeholder}
          spellCheck={false}
          className={className ?? "absolute inset-0 h-full w-full resize-none overflow-y-auto overflow-x-hidden bg-transparent p-4 font-mono text-sm leading-relaxed text-ink outline-none placeholder:text-ink/40"}
        />
        {/* 全文選択's IME receptacle (see `wholeInputRef`): always mounted so
            全文選択 can focus it inside the same key / tap event, shown only
            while 全文選択 is on. Never holds manuscript text. 16px text: iOS
            does not zoom into it on focus. */}
        <textarea
          ref={wholeInputRef}
          data-editor-whole-input=""
          data-active={isFullManuscriptSelected ? "true" : "false"}
          aria-hidden={!isFullManuscriptSelected}
          tabIndex={isFullManuscriptSelected ? 0 : -1}
          aria-label="全文選択中の入力欄（入力すると原稿全体を置き換えます）"
          placeholder="全文選択中：入力すると原稿全体を置き換えます（Escで解除）"
          rows={1}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          onKeyDown={handleWholeInputKeyDown}
          onChange={handleWholeInputChange}
          onPaste={handleWholeInputPaste}
          onCopy={handleWholeInputCopy}
          onCut={handleWholeInputCut}
          onBlur={handleWholeInputBlur}
          onCompositionStart={handleWholeInputCompositionStart}
          onCompositionUpdate={handleWholeInputCompositionUpdate}
          onCompositionEnd={handleWholeInputCompositionEnd}
          className={
            isFullManuscriptSelected
              ? "absolute left-2 right-2 top-2 z-10 h-10 resize-none overflow-hidden rounded border border-accent bg-base px-2 py-2 text-base leading-snug text-ink shadow-sm outline-none placeholder:text-[13px] placeholder:text-ink/60"
              : "pointer-events-none absolute left-0 top-0 h-px w-px resize-none overflow-hidden border-0 p-0 opacity-0"
          }
        />
      </div>
    </div>
  );
}

const PagedEditor = forwardRef(PagedEditorInner);
export default PagedEditor;
