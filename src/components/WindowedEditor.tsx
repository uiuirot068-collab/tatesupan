"use client";

/**
 * TSP-WINDOWED-EDITOR-PRODUCTION-PARITY-008 — production active-window
 * manuscript textarea. Promotes the proven `WindowedEditorProbe`
 * architecture (see that file's own doc, and `offsetModel.ts`) from a
 * diagnostic prototype to a real editing surface, gated by
 * `resolveEditorSurfaceRolloutMode()` and mounted by `EditorPane` as an
 * alternative to its plain full-document `<textarea>` -- never on by
 * default (see `editorSurfaceRollout.ts`).
 *
 * KEY SIMPLIFICATION VS. THE PROBE: the probe kept its own private copy of
 * the manuscript (`canonicalRef`) because it deliberately never talks to
 * the real app. Here, `content` IS the canonical manuscript -- the exact
 * same prop/callback contract `EditorPane`'s plain textarea already has
 * with `TategakiEditor`. That single fact is what satisfies almost every
 * "canonical content ownership" requirement for free: autosave, cloud save,
 * Preview, TXT/PDF/JPG export, and the writing-check engine all already
 * read `content`/call `onContentChange` exactly as before and need ZERO
 * changes -- this component only changes which SLICE of that text is ever
 * mounted into the native textarea's DOM value.
 *
 * What genuinely needs new machinery, and why:
 *  - WINDOW BOUNDS: which `[start, end)` slice of `content` is mounted right
 *    now (`offsetModel.ts`, reused as-is from the probe).
 *  - UNDO/REDO: a window shift reassigns the textarea's `.value` to a
 *    DIFFERENT string, which (unlike an ordinary controlled re-render that
 *    echoes back the same string the browser already produced) silently
 *    clears the browser's native undo/redo stack. `undoModel.ts` replaces
 *    native history while this component is mounted; native Ctrl/Cmd+Z/Y
 *    and `execCommand` must never be used here.
 *  - APPLICATION-LEVEL SELECT-ALL: the DOM can only ever select what's
 *    mounted (the active window), so Ctrl/Cmd+A is intercepted and tracked
 *    as an app-level flag; Copy/Cut/typed-replacement while it's active act
 *    on the FULL canonical text, not the window.
 *
 * Known, explicitly accepted production limitations (see the task's own
 * Phase 7/9 -- not silently hidden):
 *  - Native mouse DRAG selection cannot span text outside the active
 *    window (nothing outside it is in the DOM to select). Ordinary
 *    in-window selection, and application-level Ctrl+A, both work.
 *  - The prefix/suffix preview strips are `aria-hidden` -- a screen-reader
 *    user does not get a continuous-document reading experience across a
 *    window boundary. Full parity there is flagged as a follow-up
 *    accessibility task, not solved here.
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  chooseEditorWindowAroundGlobalOffset,
  globalToLocalOffset,
  isNearWindowEdge,
  localToGlobalOffset,
  replaceWindowRangeInCanonicalText,
  type EditorWindow,
} from "@/lib/windowedEditor/offsetModel";
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

/** Task's own proven production candidate (largest human-tested size that stayed immediate). */
export const WINDOWED_EDITOR_WINDOW_SIZE = 50_000;
const SHIFT_MARGIN = Math.floor(WINDOWED_EDITOR_WINDOW_SIZE / 4);
// A paste (or an automated fix landing inside the window) can grow/shrink
// the window text far past the target size in one commit; recentre
// immediately rather than letting the window drift arbitrarily large.
const RESHAPE_DRIFT_FACTOR = 1.5;

export interface WindowedEditorHandle {
  focus(): void;
  getSelectionGlobal(): { start: number; end: number };
  /** Moves the window (if needed) so `[start, end)` is mounted, then selects it and focuses. Used for jumps (e.g. a writing-check issue) that originate outside the current window. */
  moveSelectionToGlobal(start: number, end: number): void;
  /** Replaces `[start, end)` of the canonical text with `text` as ONE atomic, undoable edit (e.g. page-break insertion), then places the caret `caretOffsetInInsertedText` code units into `text` (default: its end). */
  replaceRangeGlobal(start: number, end: number, text: string, options?: { caretOffsetInInsertedText?: number }): void;
  /** Application-level undo/redo -- see the module doc for why this replaces native history here. */
  runHistory(command: "undo" | "redo"): void;
}

export interface WindowedEditorProps {
  /** The canonical manuscript, owned by the parent exactly as with a plain textarea. */
  content: string;
  onContentChange: (next: string) => void;
  onCursorIndexChange?: (globalIndex: number) => void;
  /**
   * Passthrough for `EditorPane`'s existing written-character activity
   * tracking (`@/lib/editorSessionActivity`), which only ever needs the
   * WINDOW-LOCAL textarea element (its own before/after deltas are correct
   * regardless of the window's position -- see the module doc). Mirrors
   * the legacy plain-textarea handlers 1:1 so that tracking logic itself
   * never needs to change for windowed mode.
   */
  onNativeKeyDown?: (el: HTMLTextAreaElement) => void;
  onNativeBeforeInput?: (el: HTMLTextAreaElement, inputType: string) => void;
  onNativeCompositionStart?: (el: HTMLTextAreaElement) => void;
  onNativeCompositionEnd?: (el: HTMLTextAreaElement) => void;
  /** Fired after every committed (non-composition-internal) text change, window-local el. */
  onNativeChangeCommitted?: (el: HTMLTextAreaElement) => void;
  placeholder?: string;
  className?: string;
}

function WindowedEditorInner(
  {
    content,
    onContentChange,
    onCursorIndexChange,
    onNativeKeyDown,
    onNativeBeforeInput,
    onNativeCompositionStart,
    onNativeCompositionEnd,
    onNativeChangeCommitted,
    placeholder,
    className,
  }: WindowedEditorProps,
  ref: React.Ref<WindowedEditorHandle>
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);
  const compositionSnapshotRef = useRef<BeforeInputEditSnapshot | null>(null);
  const pendingBeforeInputRef = useRef<BeforeInputEditSnapshot | null>(null);
  // Deferred window shift (Phase 5: never shift active window during IME
  // composition); resolved on compositionend.
  const shiftDeferredRef = useRef(false);
  // Deferred re-adoption of an external `content` change that arrived
  // mid-composition (see the `content`-change effect below).
  const pendingExternalAdoptRef = useRef(false);
  const undoHistoryRef = useRef<UndoHistory>(createUndoHistory());
  // Application-level Ctrl/Cmd+A (Phase 5) -- native selection can only ever
  // cover the mounted window, so "select all" is tracked here and Copy/Cut/
  // typed-replacement act on the full canonical text while it's set.
  const allSelectedRef = useRef(false);
  const justSetAllSelectedRef = useRef(false);
  // "Latest content" ref (the standard pattern for reading a fresh prop
  // value from inside a callback without re-subscribing effects to it).
  const contentRef = useRef(content);
  useEffect(() => {
    contentRef.current = content;
  });
  // The last canonical text THIS component itself produced via
  // `onContentChange`. Used to tell "the parent echoed back our own edit"
  // (expected; `content === lastOwnContentRef.current`, window bounds are
  // already locally consistent with it) apart from "content changed for an
  // external reason" (project switch, TXT import, search/replace, a
  // writing-check fix or its one-step undo) -- which must re-anchor the
  // window and invalidate this component's own undo history, since that
  // history's offsets describe the PRE-external-edit document and could
  // otherwise corrupt unrelated text if ever applied.
  const lastOwnContentRef = useRef(content);
  const windowTextRef = useRef("");

  const [editorWindow, setEditorWindow] = useState<EditorWindow>(() =>
    chooseEditorWindowAroundGlobalOffset(content, content.length, WINDOWED_EDITOR_WINDOW_SIZE, { margin: SHIFT_MARGIN })
  );
  const windowText = content.slice(editorWindow.start, editorWindow.end);
  useEffect(() => {
    windowTextRef.current = windowText;
  });

  const [prefixText, setPrefixText] = useState(() => content.slice(0, editorWindow.start));
  const [suffixText, setSuffixText] = useState(() => content.slice(editorWindow.end));
  // Recomputed only when the window's own bounds change -- typing inside the
  // window never re-slices these (see the module doc for why excluding
  // `content` from these deps is intentional, not an oversight).
  useEffect(() => {
    setPrefixText(contentRef.current.slice(0, editorWindow.start));
  }, [editorWindow.start]);
  useEffect(() => {
    setSuffixText(contentRef.current.slice(editorWindow.end));
  }, [editorWindow.end]);

  const reportCaret = (globalCaret: number) => onCursorIndexChange?.(globalCaret);

  const shiftWindowTo = (globalCaret: number, canonicalText: string) => {
    const nextWindow = chooseEditorWindowAroundGlobalOffset(canonicalText, globalCaret, WINDOWED_EDITOR_WINDOW_SIZE, {
      margin: SHIFT_MARGIN,
    });
    setEditorWindow(nextWindow);
    const nextLocalCaret = globalToLocalOffset(nextWindow.start, globalCaret);
    requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(nextLocalCaret, nextLocalCaret);
    });
  };

  const maybeShiftAfterEdit = (
    globalCaret: number,
    liveWindow: EditorWindow,
    liveWindowTextLength: number,
    canonicalText: string
  ) => {
    if (isComposingRef.current) {
      if (isNearWindowEdge(liveWindow, globalCaret, canonicalText.length, SHIFT_MARGIN)) {
        shiftDeferredRef.current = true;
      }
      return;
    }
    const grewFarPastTarget = liveWindowTextLength > WINDOWED_EDITOR_WINDOW_SIZE * RESHAPE_DRIFT_FACTOR;
    const nearEdge = isNearWindowEdge(liveWindow, globalCaret, canonicalText.length, SHIFT_MARGIN);
    if (grewFarPastTarget || nearEdge) shiftWindowTo(globalCaret, canonicalText);
  };

  /** Re-anchors the window (and invalidates undo history) after a `content` change this component did NOT itself produce. Never called mid-composition (deferred to compositionend instead). */
  const reanchorWindow = (newContent: string) => {
    const priorGlobalCaret = localToGlobalOffset(editorWindow.start, textareaRef.current?.selectionStart ?? 0);
    const clampedCaret = Math.max(0, Math.min(newContent.length, priorGlobalCaret));
    const win = chooseEditorWindowAroundGlobalOffset(newContent, clampedCaret, WINDOWED_EDITOR_WINDOW_SIZE, {
      margin: SHIFT_MARGIN,
    });
    setEditorWindow(win);
    setPrefixText(newContent.slice(0, win.start));
    setSuffixText(newContent.slice(win.end));
    lastOwnContentRef.current = newContent;
    undoHistoryRef.current = createUndoHistory();
    allSelectedRef.current = false;
    const localCaret = globalToLocalOffset(win.start, clampedCaret);
    requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(localCaret, localCaret);
    });
  };

  useEffect(() => {
    if (content === lastOwnContentRef.current) return;
    if (isComposingRef.current) {
      pendingExternalAdoptRef.current = true;
      return;
    }
    reanchorWindow(content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  const commitCanonical = (nextCanonical: string, liveWindow: EditorWindow) => {
    lastOwnContentRef.current = nextCanonical;
    setEditorWindow(liveWindow);
    onContentChange(nextCanonical);
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    const nextWindowText = el.value;
    const liveWindow: EditorWindow = { start: editorWindow.start, end: editorWindow.start + nextWindowText.length };

    const pending = pendingBeforeInputRef.current;
    pendingBeforeInputRef.current = null;
    if (!isComposingRef.current) {
      const rawEdit = pending
        ? computeRawEditFromBeforeInput(pending, nextWindowText, editorWindow.start)
        : computeRawEditFromBeforeInput(
            { beforeText: windowTextRef.current, selectionStart: 0, selectionEnd: 0, inputType: "" },
            nextWindowText,
            editorWindow.start
          );
      if (rawEdit) undoHistoryRef.current = pushEdit(undoHistoryRef.current, rawEdit);
    }

    const nextCanonical = replaceWindowRangeInCanonicalText(content, editorWindow.start, editorWindow.end, nextWindowText);
    const globalCaret = localToGlobalOffset(liveWindow.start, el.selectionStart);

    commitCanonical(nextCanonical, liveWindow);
    reportCaret(globalCaret);
    onNativeChangeCommitted?.(el);
    maybeShiftAfterEdit(globalCaret, liveWindow, nextWindowText.length, nextCanonical);
  };

  /** Application-level Ctrl/Cmd+A: replaces the WHOLE canonical document with `typed` (or removes it, for Delete/Backspace/Cut), as ONE atomic undo step. */
  const replaceWholeDocument = (typed: string) => {
    const removedText = content;
    allSelectedRef.current = false;
    undoHistoryRef.current = pushEdit(undoHistoryRef.current, { rangeStart: 0, removedText, insertedText: typed, atomic: true });
    const win = chooseEditorWindowAroundGlobalOffset(typed, typed.length, WINDOWED_EDITOR_WINDOW_SIZE, { margin: SHIFT_MARGIN });
    commitCanonical(typed, win);
    const localCaret = typed.length - win.start;
    reportCaret(typed.length);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      el?.focus({ preventScroll: true });
      el?.setSelectionRange(localCaret, localCaret);
    });
  };

  /**
   * React's `onBeforeInput` prop does NOT forward the native `beforeinput`
   * `InputEvent` -- it reconstructs its own legacy `TextEvent`-based event
   * for cross-browser composition normalization, and a `TextEvent` has no
   * `inputType` property at all (confirmed empirically against this app's
   * real React 19 runtime: `"inputType" in event.nativeEvent` is `false`).
   * Every inputType-based branch below (insert vs. delete, atomic vs.
   * mergeable) needs the REAL native event, so this listens on the DOM node
   * directly instead of using the `onBeforeInput` JSX prop (see the effect
   * below). `onNativeBeforeInput` is still fed a real inputType this way --
   * an incidental improvement for EditorPane's word-count passthrough too.
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
    const win = chooseEditorWindowAroundGlobalOffset(result.canonicalText, result.selectionEnd, WINDOWED_EDITOR_WINDOW_SIZE, {
      margin: SHIFT_MARGIN,
    });
    commitCanonical(result.canonicalText, win);
    reportCaret(result.selectionEnd);
    const localStart = globalToLocalOffset(win.start, result.selectionStart);
    const localEnd = globalToLocalOffset(win.start, result.selectionEnd);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      el?.focus({ preventScroll: true });
      el?.setSelectionRange(localStart, localEnd);
    });
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
    reportCaret(localToGlobalOffset(editorWindow.start, el.selectionStart));
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
    const finalWindowText = el.value;
    const snapshot = compositionSnapshotRef.current;
    compositionSnapshotRef.current = null;
    onNativeCompositionEnd?.(el);

    if (snapshot && snapshot.beforeText !== finalWindowText) {
      const rawEdit = computeRawEditFromBeforeInput(snapshot, finalWindowText, editorWindow.start);
      if (rawEdit) undoHistoryRef.current = pushEdit(undoHistoryRef.current, rawEdit);
    }

    if (shiftDeferredRef.current) {
      shiftDeferredRef.current = false;
      const globalCaret = localToGlobalOffset(editorWindow.start, el.selectionStart);
      maybeShiftAfterEdit(globalCaret, editorWindow, finalWindowText.length, contentRef.current);
    }

    if (pendingExternalAdoptRef.current) {
      pendingExternalAdoptRef.current = false;
      if (contentRef.current !== lastOwnContentRef.current) reanchorWindow(contentRef.current);
    }
  };

  const moveSelectionToGlobal = (start: number, end: number) => {
    const win = chooseEditorWindowAroundGlobalOffset(content, end, WINDOWED_EDITOR_WINDOW_SIZE, { margin: SHIFT_MARGIN });
    setEditorWindow(win);
    const localStart = globalToLocalOffset(win.start, Math.max(win.start, start));
    const localEnd = globalToLocalOffset(win.start, Math.min(win.end, end));
    reportCaret(end);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      el?.focus({ preventScroll: true });
      el?.setSelectionRange(localStart, localEnd);
    });
  };

  const replaceRangeGlobal = (start: number, end: number, text: string, options?: { caretOffsetInInsertedText?: number }) => {
    const removedText = content.slice(start, end);
    undoHistoryRef.current = pushEdit(undoHistoryRef.current, { rangeStart: start, removedText, insertedText: text, atomic: true });
    const nextCanonical = content.slice(0, start) + text + content.slice(end);
    const caretOffset = options?.caretOffsetInInsertedText ?? text.length;
    const globalCaret = start + caretOffset;
    const win = chooseEditorWindowAroundGlobalOffset(nextCanonical, globalCaret, WINDOWED_EDITOR_WINDOW_SIZE, {
      margin: SHIFT_MARGIN,
    });
    commitCanonical(nextCanonical, win);
    reportCaret(globalCaret);
    const localCaret = globalToLocalOffset(win.start, globalCaret);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      el?.focus({ preventScroll: true });
      el?.setSelectionRange(localCaret, localCaret);
    });
  };

  useImperativeHandle(
    ref,
    (): WindowedEditorHandle => ({
      focus: () => textareaRef.current?.focus({ preventScroll: true }),
      getSelectionGlobal: () => {
        const el = textareaRef.current;
        if (!el) return { start: editorWindow.start, end: editorWindow.start };
        return {
          start: localToGlobalOffset(editorWindow.start, el.selectionStart),
          end: localToGlobalOffset(editorWindow.start, el.selectionEnd),
        };
      },
      moveSelectionToGlobal,
      replaceRangeGlobal,
      runHistory,
    }),
    [editorWindow, moveSelectionToGlobal, replaceRangeGlobal, runHistory]
  );

  return (
    <div className="absolute inset-0 flex flex-col">
      {prefixText.length > 0 && (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          data-windowed-editor-prefix=""
          onClick={() => moveSelectionToGlobal(editorWindow.start, editorWindow.start)}
          className="max-h-[18%] flex-none cursor-text overflow-y-auto whitespace-pre-wrap border-b border-dashed border-ink/15 bg-ink/[0.03] p-2 text-left font-mono text-xs text-ink/40"
        >
          {prefixText}
        </button>
      )}

      <textarea
        ref={textareaRef}
        data-demo-target="editor"
        data-editor-surface="windowed"
        aria-label="原稿本文（本文全体のうち現在編集中の範囲）"
        value={windowText}
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
        className={className ?? "min-h-0 flex-1 resize-none overflow-y-auto overflow-x-hidden bg-transparent p-4 font-mono text-sm leading-relaxed text-ink outline-none"}
      />

      {suffixText.length > 0 && (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          data-windowed-editor-suffix=""
          onClick={() => moveSelectionToGlobal(editorWindow.end, editorWindow.end)}
          className="max-h-[18%] flex-none cursor-text overflow-y-auto whitespace-pre-wrap border-t border-dashed border-ink/15 bg-ink/[0.03] p-2 text-left font-mono text-xs text-ink/40"
        >
          {suffixText}
        </button>
      )}
    </div>
  );
}

const WindowedEditor = forwardRef(WindowedEditorInner);
export default WindowedEditor;
