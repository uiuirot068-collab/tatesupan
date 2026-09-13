/**
 * TSP-LONG-DOCUMENT-WINDOWED-EDITOR-ARCHITECTURE-007 — pure, diagnostic-only
 * offset-mapping functions for a prototype windowed (chunked) long-document
 * editor. No React, no DOM, no app state: these are plain functions over
 * strings and numbers so the offset arithmetic can be exhaustively unit
 * tested independent of the textarea/IME prototype that calls them.
 *
 * Index space: every offset here is a UTF-16 code UNIT index (ordinary
 * `String.prototype.slice` / `HTMLTextAreaElement.selectionStart` indexing)
 * -- the SAME index space the app already uses for `cursorIndex`, page-break
 * marker insertion, and `beforeinput` selection snapshots (see
 * EditorPane.tsx, editorSessionActivity/model.ts's `BeforeInputSnapshot`).
 * This deliberately does NOT switch to Unicode code points: that index
 * space (`codePointLength` in editorSessionActivity/model.ts) is scoped
 * exclusively to written-character counting and is never used for
 * splicing or selection anywhere in the current app. Introducing a second
 * offset space here would silently change the app's existing index
 * semantics, which TSP-LONG-DOCUMENT-WINDOWED-EDITOR-ARCHITECTURE-007
 * Phase 4 explicitly rules out.
 *
 * A window boundary must still never fall inside a UTF-16 surrogate pair
 * (an astral character, e.g. some emoji) -- slicing there would corrupt
 * that character in both the canonical text and the window. Every function
 * that chooses a boundary snaps it outward to the nearest safe code-unit
 * index; `globalToLocalOffset`/`localToGlobalOffset` are trusted to be
 * called with boundaries that are already safe (i.e. produced by
 * `chooseEditorWindowAroundGlobalOffset`, not picked ad hoc).
 */

export interface EditorWindow {
  /** Inclusive UTF-16 code-unit offset into the canonical text. */
  start: number;
  /** Exclusive UTF-16 code-unit offset into the canonical text. */
  end: number;
}

/**
 * True if `text[index]` would split a surrogate pair, i.e. index falls
 * strictly between a high surrogate (at index-1) and its low surrogate
 * (at index).
 */
function splitsSurrogatePair(text: string, index: number): boolean {
  if (index <= 0 || index >= text.length) return false;
  const before = text.charCodeAt(index - 1);
  const after = text.charCodeAt(index);
  return before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff;
}

/**
 * Clamps `index` into `[0, text.length]` and, if it would split a surrogate
 * pair, nudges it by one code unit in `preferDirection` (-1: earlier/shrink
 * a window-start candidate; +1: later/grow a window-end candidate) so the
 * boundary always lands between two complete characters.
 */
export function snapToSafeBoundary(text: string, index: number, preferDirection: -1 | 1): number {
  const clamped = Math.max(0, Math.min(text.length, index));
  if (!splitsSurrogatePair(text, clamped)) return clamped;
  return clamped + preferDirection;
}

/** Maps a canonical-text offset to an offset local to the active window. */
export function globalToLocalOffset(windowStart: number, globalOffset: number): number {
  return globalOffset - windowStart;
}

/** Maps an offset local to the active window back to the canonical text. */
export function localToGlobalOffset(windowStart: number, localOffset: number): number {
  return windowStart + localOffset;
}

export interface ChooseWindowOptions {
  /**
   * Minimum code units of hysteresis to try to keep between the caret and
   * each non-pinned window edge, so an in-window edit doesn't force a
   * window shift on the very next keystroke. Default: `windowSize / 4`.
   */
  margin?: number;
}

/**
 * Picks an at-most-`windowSize`-code-unit `[start, end)` window of
 * `canonicalText` around `globalOffset`, clamped to the manuscript's own
 * bounds and snapped to surrogate-safe boundaries. Centers the caret when
 * there is room on both sides; otherwise pins to whichever manuscript edge
 * it's closest to. If `windowSize` already covers the whole manuscript,
 * returns the whole thing (no windowing needed).
 */
export function chooseEditorWindowAroundGlobalOffset(
  canonicalText: string,
  globalOffset: number,
  windowSize: number,
  options: ChooseWindowOptions = {}
): EditorWindow {
  const length = canonicalText.length;
  if (windowSize >= length) {
    return { start: 0, end: length };
  }

  const caret = Math.max(0, Math.min(length, globalOffset));
  const margin = options.margin ?? Math.floor(windowSize / 4);

  let start = caret - Math.floor(windowSize / 2);
  let end = start + windowSize;
  if (start < 0) {
    start = 0;
    end = windowSize;
  } else if (end > length) {
    end = length;
    start = length - windowSize;
  }

  // Slide (never resize) the window so the caret keeps `margin` clearance
  // from whichever edge isn't already pinned to a manuscript boundary.
  if (start > 0 && caret - start < margin) {
    const shift = Math.min(start, margin - (caret - start));
    start -= shift;
    end -= shift;
  }
  if (end < length && end - caret < margin) {
    const shift = Math.min(length - end, margin - (end - caret));
    start += shift;
    end += shift;
  }

  return {
    start: snapToSafeBoundary(canonicalText, start, -1),
    end: snapToSafeBoundary(canonicalText, end, 1),
  };
}

/**
 * Splices the active window's (possibly edited) text back into the full
 * canonical manuscript. This is the ONLY function in this module that
 * touches the canonical text outside the window -- everything else is
 * local <-> global offset bookkeeping. The caller is responsible for
 * ensuring `windowStart`/`windowEnd` still describe the window's bounds
 * *before* the edit (i.e. this is not idempotent against a stale window).
 */
export function replaceWindowRangeInCanonicalText(
  canonicalText: string,
  windowStart: number,
  windowEnd: number,
  newWindowText: string
): string {
  return canonicalText.slice(0, windowStart) + newWindowText + canonicalText.slice(windowEnd);
}

/**
 * True if `globalOffset` sits within `margin` code units of either edge of
 * `window` that is not already pinned to a manuscript boundary (`length`) --
 * i.e. the caret is close enough to the window's edge that a window-shift
 * should be considered before the next edit. Pure decision helper; callers
 * decide separately whether a shift is actually SAFE right now (see Phase 5:
 * never mid-composition, never losing uncommitted local edits).
 */
export function isNearWindowEdge(
  window: EditorWindow,
  globalOffset: number,
  canonicalLength: number,
  margin: number
): boolean {
  const nearStart = window.start > 0 && globalOffset - window.start < margin;
  const nearEnd = window.end < canonicalLength && window.end - globalOffset < margin;
  return nearStart || nearEnd;
}
