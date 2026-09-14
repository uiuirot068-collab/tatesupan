/**
 * TSP-WINDOWED-EDITOR-PRODUCTION-PARITY-008 — bounded, operation-based
 * undo/redo for the canonical manuscript, independent of the active editing
 * window's bounds.
 *
 * Phase 6 of the windowed-editor production task established this as a
 * release blocker: the native textarea's own undo/redo stack does not
 * survive a window shift (assigning `.value` to a DIFFERENT string --
 * exactly what a shift does -- clears the browser's own history, unlike an
 * ordinary controlled re-render that echoes back the same string the
 * browser already produced). So while the windowed editor is active, this
 * module is the single source of truth for undo/redo; native Ctrl/Cmd+Z/Y
 * and the toolbar buttons must be intercepted and routed here instead of to
 * `document.execCommand`.
 *
 * Every offset in this module is a canonical (whole-manuscript) UTF-16
 * code-unit offset -- the SAME index space as `offsetModel.ts` and the rest
 * of the app (see that module's own doc). Every `EditOp` is a plain
 * (rangeStart, removedText, insertedText) splice against the CANONICAL
 * text, never against a window-local slice -- so undo/redo is correct
 * regardless of where the active window happens to be when undo/redo is
 * invoked. This is what makes "undo across a window shift" and "redo after
 * cross-window undo" hold for free: a window shift never touches this
 * history at all.
 *
 * No React, no DOM: plain functions over a small immutable history value,
 * exhaustively unit-testable independent of the textarea/IME integration
 * that calls them.
 */

export interface EditOp {
  /** Canonical UTF-16 code-unit offset where this operation begins. */
  rangeStart: number;
  /** Text that was at `[rangeStart, rangeStart + insertedText.length)` before this op (restored by undo). */
  removedText: string;
  /** Text now at `[rangeStart, rangeStart + insertedText.length)` (restored by redo). */
  insertedText: string;
  /** False once sealed (by an atomic edit, a batch timeout/boundary, or an explicit flush) -- a sealed op never accepts a later merge. */
  mergeable: boolean;
  /** Clock time (ms) this op was last extended by a merge; used for the batch timeout. */
  updatedAt: number;
}

export interface UndoHistory {
  readonly undoStack: readonly EditOp[];
  readonly redoStack: readonly EditOp[];
}

export function createUndoHistory(): UndoHistory {
  return { undoStack: [], redoStack: [] };
}

export function canUndo(history: UndoHistory): boolean {
  return history.undoStack.length > 0;
}

export function canRedo(history: UndoHistory): boolean {
  return history.redoStack.length > 0;
}

// Bounds total memory: oldest entries are dropped once exceeded. A typical
// editing session (even a long one) stays far under this; it exists purely
// so an unbounded session can never leak memory (Phase 12).
const MAX_HISTORY_ENTRIES = 500;
// Ordinary contiguous typing/deleting batches into one undo step while
// keystrokes keep landing within this window of each other; a pause longer
// than this starts a fresh step, same idea as most native text editors.
const BATCH_TIMEOUT_MS = 800;
// Caps a single batched op's combined text size, independent of the time
// window above -- an unusually long uninterrupted typing burst still can't
// grow one op without bound.
const MAX_BATCH_CHARS = 200;

export interface RawEdit {
  /** Canonical UTF-16 code-unit offset where the edit begins. */
  rangeStart: number;
  removedText: string;
  insertedText: string;
  /** Never merged with a neighboring edit (paste, IME composition, selection replace, automated fix, ...). */
  atomic?: boolean;
  /** Injectable clock, for deterministic tests. Defaults to `Date.now()`. */
  now?: number;
}

function tryMerge(top: EditOp, edit: RawEdit, now: number): EditOp | null {
  if (edit.atomic || !top.mergeable) return null;
  if (now - top.updatedAt > BATCH_TIMEOUT_MS) return null;
  if (top.insertedText.length + top.removedText.length >= MAX_BATCH_CHARS) return null;

  // Pure forward insertion (ordinary typing): the new op's start must land
  // exactly where the batch's own insertion left off, and neither side may
  // carry a deletion (a replace is always atomic; see `computeRawEditFromBeforeInput`).
  if (
    top.removedText === "" &&
    edit.removedText === "" &&
    edit.insertedText.length === 1 &&
    edit.insertedText !== "\n" &&
    top.rangeStart + top.insertedText.length === edit.rangeStart
  ) {
    return { ...top, insertedText: top.insertedText + edit.insertedText, updatedAt: now };
  }

  // Pure backward deletion (repeated Backspace): each new deletion lands
  // immediately BEFORE the batch's current start.
  if (
    top.insertedText === "" &&
    edit.insertedText === "" &&
    edit.removedText.length === 1 &&
    edit.rangeStart + edit.removedText.length === top.rangeStart
  ) {
    return { ...top, rangeStart: edit.rangeStart, removedText: edit.removedText + top.removedText, updatedAt: now };
  }

  // Pure forward deletion (repeated Delete key): each new deletion lands at
  // the same offset (text keeps sliding left under a stationary caret).
  if (
    top.insertedText === "" &&
    edit.insertedText === "" &&
    edit.removedText.length === 1 &&
    edit.rangeStart === top.rangeStart
  ) {
    return { ...top, removedText: top.removedText + edit.removedText, updatedAt: now };
  }

  return null;
}

/**
 * Records one committed edit against the canonical text. Merges into the
 * current batch when it sensibly continues it (see `tryMerge`); otherwise
 * seals the previous batch and starts a new one. ALWAYS clears the redo
 * branch, per ordinary undo/redo semantics -- including when the edit merges
 * into an existing (already-undo-only) batch.
 */
export function pushEdit(history: UndoHistory, edit: RawEdit): UndoHistory {
  if (edit.removedText === "" && edit.insertedText === "") return history;
  const now = edit.now ?? Date.now();

  const top = history.undoStack[history.undoStack.length - 1];
  if (top) {
    const merged = tryMerge(top, edit, now);
    if (merged) {
      return { undoStack: history.undoStack.slice(0, -1).concat(merged), redoStack: [] };
    }
  }

  const op: EditOp = {
    rangeStart: edit.rangeStart,
    removedText: edit.removedText,
    insertedText: edit.insertedText,
    mergeable: !edit.atomic,
    updatedAt: now,
  };
  let nextStack = history.undoStack.concat(op);
  if (nextStack.length > MAX_HISTORY_ENTRIES) {
    nextStack = nextStack.slice(nextStack.length - MAX_HISTORY_ENTRIES);
  }
  return { undoStack: nextStack, redoStack: [] };
}

/** Seals the in-progress batch (if any) so a later edit can never merge into it -- e.g. on blur, selection change, or window shift boundary. */
export function flushBatch(history: UndoHistory): UndoHistory {
  const last = history.undoStack[history.undoStack.length - 1];
  if (!last || !last.mergeable) return history;
  const sealed: EditOp = { ...last, mergeable: false };
  return { ...history, undoStack: history.undoStack.slice(0, -1).concat(sealed) };
}

export interface ApplyResult {
  history: UndoHistory;
  canonicalText: string;
  /** Selection to restore after applying, as canonical offsets (start === end: a plain caret). */
  selectionStart: number;
  selectionEnd: number;
}

/** Applies the top undo entry to `canonicalText`. `canonicalText` must be the CURRENT canonical manuscript -- this is what makes cross-window undo correct: the caller never needs to know or restore the window that was active when the edit happened. */
export function undo(history: UndoHistory, canonicalText: string): ApplyResult | null {
  const top = history.undoStack[history.undoStack.length - 1];
  if (!top) return null;
  const nextCanonical =
    canonicalText.slice(0, top.rangeStart) +
    top.removedText +
    canonicalText.slice(top.rangeStart + top.insertedText.length);
  const nextHistory: UndoHistory = {
    undoStack: history.undoStack.slice(0, -1),
    redoStack: history.redoStack.concat(top),
  };
  return {
    history: nextHistory,
    canonicalText: nextCanonical,
    selectionStart: top.rangeStart,
    selectionEnd: top.rangeStart + top.removedText.length,
  };
}

/** Applies the top redo entry to `canonicalText`. Symmetric with `undo`; also canonical-offset-only, so redo is correct after an undo that crossed a window shift. */
export function redo(history: UndoHistory, canonicalText: string): ApplyResult | null {
  const top = history.redoStack[history.redoStack.length - 1];
  if (!top) return null;
  const nextCanonical =
    canonicalText.slice(0, top.rangeStart) +
    top.insertedText +
    canonicalText.slice(top.rangeStart + top.removedText.length);
  const nextHistory: UndoHistory = {
    undoStack: history.undoStack.concat(top),
    redoStack: history.redoStack.slice(0, -1),
  };
  const caret = top.rangeStart + top.insertedText.length;
  return {
    history: nextHistory,
    canonicalText: nextCanonical,
    selectionStart: caret,
    selectionEnd: caret,
  };
}

export interface BeforeInputEditSnapshot {
  /** Window-LOCAL text and offsets -- never canonical. See `windowStartGlobal` below. */
  beforeText: string;
  selectionStart: number;
  selectionEnd: number;
  inputType: string;
}

/**
 * Derives a `RawEdit` (in CANONICAL offsets) from a single beforeinput-style
 * snapshot + the resulting window-local text, given where the active
 * window currently starts in the canonical text. Mirrors the measurement
 * approach in `editorSessionActivity/model.ts`'s `measureBeforeInputCommit`
 * (selection-aware insert/delete fast paths, contiguous-diff fallback), but
 * returns the actual text spans (for splicing) rather than code-point
 * counts (for the written-character product count) -- the two modules
 * intentionally stay independent since they answer different questions.
 *
 * Returns `null` for a no-op (identical before/after) or for native
 * history commands, which must never be recorded here -- native undo/redo
 * is exactly what this module replaces while the windowed editor is active.
 */
export function computeRawEditFromBeforeInput(
  snapshot: BeforeInputEditSnapshot,
  afterText: string,
  windowStartGlobal: number
): RawEdit | null {
  if (snapshot.inputType === "historyUndo" || snapshot.inputType === "historyRedo") return null;

  const selectedText = snapshot.beforeText.slice(snapshot.selectionStart, snapshot.selectionEnd);
  const replacedSelection = selectedText.length > 0;
  const atomic =
    replacedSelection ||
    snapshot.inputType === "insertFromPaste" ||
    snapshot.inputType === "insertFromComposition" ||
    snapshot.inputType === "insertFromDrop";

  if (snapshot.inputType.startsWith("insert")) {
    const insertedCodeUnits = afterText.length - (snapshot.beforeText.length - selectedText.length);
    if (insertedCodeUnits >= 0) {
      const inserted = afterText.slice(snapshot.selectionStart, snapshot.selectionStart + insertedCodeUnits);
      if (inserted === "" && selectedText === "") return null;
      return {
        rangeStart: windowStartGlobal + snapshot.selectionStart,
        removedText: selectedText,
        insertedText: inserted,
        atomic,
      };
    }
    return fallbackDiff(snapshot.beforeText, afterText, windowStartGlobal);
  }

  if (snapshot.inputType.startsWith("delete")) {
    if (replacedSelection) {
      return {
        rangeStart: windowStartGlobal + snapshot.selectionStart,
        removedText: selectedText,
        insertedText: "",
        atomic: true,
      };
    }
    const deletedCodeUnits = snapshot.beforeText.length - afterText.length;
    if (deletedCodeUnits > 0) {
      const backward = snapshot.inputType.includes("Backward");
      const deleteStart = backward ? snapshot.selectionStart - deletedCodeUnits : snapshot.selectionStart;
      const deleted = snapshot.beforeText.slice(deleteStart, deleteStart + deletedCodeUnits);
      return { rangeStart: windowStartGlobal + deleteStart, removedText: deleted, insertedText: "", atomic: false };
    }
    return fallbackDiff(snapshot.beforeText, afterText, windowStartGlobal);
  }

  return fallbackDiff(snapshot.beforeText, afterText, windowStartGlobal);
}

/** Common-prefix/suffix diff fallback (UTF-16 code units), for input paths with no reliable selection-aware fast path. Always atomic: an edit this module couldn't classify shouldn't silently batch with its neighbors. */
function fallbackDiff(before: string, after: string, windowStartGlobal: number): RawEdit | null {
  if (before === after) return null;
  const maxPrefix = Math.min(before.length, after.length);
  let prefix = 0;
  while (prefix < maxPrefix && before[prefix] === after[prefix]) prefix += 1;

  const beforeRemaining = before.length - prefix;
  const afterRemaining = after.length - prefix;
  let suffix = 0;
  while (
    suffix < beforeRemaining &&
    suffix < afterRemaining &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const removedText = before.slice(prefix, before.length - suffix);
  const insertedText = after.slice(prefix, after.length - suffix);
  if (removedText === "" && insertedText === "") return null;
  return { rangeStart: windowStartGlobal + prefix, removedText, insertedText, atomic: true };
}
