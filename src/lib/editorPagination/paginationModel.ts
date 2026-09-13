/**
 * TSP-EDITOR-PAGINATION-AND-PREVIEW-NAVIGATION-009 — pure editor-pagination
 * model for the long-document editor surface.
 *
 * These are EDITOR pages, not publication pages: a UI-only projection over
 * the canonical manuscript that decides which ~50,000-UTF-16-code-unit slice
 * of `content` the native textarea mounts at a time (see `PagedEditor.tsx`).
 * They are never persisted (Supabase/IndexedDB always hold the single
 * canonical string) and have no relationship to `computePageSourceRanges` /
 * publication pagination in `tategaki.ts`.
 *
 * Index space: every offset here is a UTF-16 code-UNIT index into the
 * canonical manuscript -- the same index space `cursorIndex`,
 * `editorSessionActivity`, and (previously) `windowedEditor/offsetModel.ts`
 * already use. A page boundary must never fall inside a surrogate pair;
 * `chooseSafeEditorPageBoundary` reuses `snapToSafeBoundary` (from the
 * former sliding-window model, still generically true here) as its final
 * fallback so that guarantee holds even when no paragraph boundary exists.
 *
 * STABILITY: `computeEditorPages` is a plain left-to-right greedy scan --
 * each page's `[start, end)` depends only on the canonical text up to its
 * own `end`. An edit strictly after page K's `end` can only ever change
 * pages K+1 and later; it can never move an earlier page's boundary. This
 * is what keeps ordinary typing from causing visible page churn (Phase 2)
 * without needing separate hysteresis state -- recomputing from scratch on
 * every edit is already stable by construction.
 */

/** One editor page: a `[start, end)` UTF-16 code-unit slice of the canonical manuscript. */
export interface EditorPage {
  /** 0-based position in the page list. */
  index: number;
  /** Inclusive UTF-16 code-unit offset into the canonical manuscript. */
  start: number;
  /** Exclusive UTF-16 code-unit offset into the canonical manuscript. */
  end: number;
  /** `end - start`. */
  length: number;
}

/** Task's own target: the largest human-tested size that stayed immediate. */
export const EDITOR_PAGE_TARGET_SIZE = 50_000;
/** Preferred paragraph-boundary search range: target ± this (45k–55k at the default target). */
const DEFAULT_SEARCH_RADIUS = 5_000;
/** Modest extension of the search before giving up and hard-cutting, per the task's own "avoid pathological splitting" guidance. */
const DEFAULT_EXTENDED_SEARCH_RADIUS = 15_000;
/**
 * If a hard cut would leave a trailing remainder shorter than this, the
 * current page absorbs the remainder instead (avoids a pathological
 * near-empty final page). Scales with `targetSize` by default.
 */
const DEFAULT_MIN_TRAILING_FRACTION = 0.1;
/**
 * TSP-EDITOR-PAGE-WAITING-UX-HOTFIX-012A: the actual, enforced ceiling on an
 * Editor Page's length at the default target/minTrailing settings --
 * `chooseSafeEditorPageBoundary` never lets a page grow past this (see its
 * own doc). Exported so the UI can show a truthful "最大あと約N字" countdown
 * instead of treating `EDITOR_PAGE_TARGET_SIZE` itself as the ceiling (the
 * page legitimately keeps growing, without searching for a boundary at all,
 * for up to `DEFAULT_MIN_TRAILING_FRACTION` beyond target -- see below).
 */
export const EDITOR_PAGE_HARD_MAXIMUM_SIZE =
  EDITOR_PAGE_TARGET_SIZE + Math.max(1, Math.floor(EDITOR_PAGE_TARGET_SIZE * DEFAULT_MIN_TRAILING_FRACTION));

function splitsSurrogatePair(text: string, index: number): boolean {
  if (index <= 0 || index >= text.length) return false;
  const before = text.charCodeAt(index - 1);
  const after = text.charCodeAt(index);
  return before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff;
}

/**
 * Clamps `index` into `[0, text.length]` and, if it would split a surrogate
 * pair, nudges it by one code unit in `preferDirection` so the boundary
 * always lands between two complete characters. (Same contract as
 * `windowedEditor/offsetModel.ts`'s `snapToSafeBoundary`, reimplemented
 * locally so this module has no dependency on the retired sliding-window
 * editor surface.)
 */
export function snapToSafeEditorPageBoundary(text: string, index: number, preferDirection: -1 | 1): number {
  const clamped = Math.max(0, Math.min(text.length, index));
  if (!splitsSurrogatePair(text, clamped)) return clamped;
  return clamped + preferDirection;
}

export interface ChooseEditorPageBoundaryOptions {
  /** Preferred paragraph-boundary search radius around the target offset. Default 5,000. */
  searchRadius?: number;
  /** Modest extension tried before falling back to a hard cut. Default 15,000. */
  extendedSearchRadius?: number;
  /** A hard-cut remainder shorter than this is absorbed into the current page instead. Default `10%` of `targetSize`. */
  minTrailingSize?: number;
}

/**
 * Picks the end of the editor page that starts at `pageStart`, targeting
 * `targetSize` code units. Prefers the newline closest to the ideal offset
 * within `searchRadius`; failing that, the closest one within
 * `extendedSearchRadius`; failing that, hard-cuts at the ideal offset
 * (surrogate-safe). If the ideal offset already reaches (or nearly reaches,
 * per `minTrailingSize`) the end of `text`, returns `text.length` so the
 * manuscript's true tail is never split into a near-empty trailing page.
 */
export function chooseSafeEditorPageBoundary(
  text: string,
  pageStart: number,
  targetSize: number,
  options: ChooseEditorPageBoundaryOptions = {}
): number {
  const length = text.length;
  const idealEnd = pageStart + targetSize;

  const searchRadius = options.searchRadius ?? DEFAULT_SEARCH_RADIUS;
  const extendedSearchRadius = Math.max(options.extendedSearchRadius ?? DEFAULT_EXTENDED_SEARCH_RADIUS, searchRadius);
  const minTrailingSize = options.minTrailingSize ?? Math.max(1, Math.floor(targetSize * DEFAULT_MIN_TRAILING_FRACTION));

  if (idealEnd >= length || length - idealEnd < minTrailingSize) {
    return length;
  }

  // Scan outward from the ideal offset for a newline boundary (a split
  // right AFTER a "\n", so the newline itself stays with the page it
  // closes). The narrow radius is checked first and returned immediately
  // (closest-first, since delta increases monotonically); a hit only found
  // beyond it is remembered as a fallback in case nothing closer turns up.
  let extendedMatch: number | null = null;
  for (let delta = 0; delta <= extendedSearchRadius; delta++) {
    const candidates = delta === 0 ? [idealEnd] : [idealEnd + delta, idealEnd - delta];
    for (const candidate of candidates) {
      if (candidate <= pageStart || candidate > length) continue;
      if (text.charCodeAt(candidate - 1) !== 10 /* \n */) continue;
      if (delta <= searchRadius) return candidate;
      if (extendedMatch === null) extendedMatch = candidate;
    }
  }
  if (extendedMatch !== null) return extendedMatch;

  return snapToSafeEditorPageBoundary(text, idealEnd, 1);
}

export interface ComputeEditorPagesOptions extends ChooseEditorPageBoundaryOptions {
  /** Target code units per page. Default `EDITOR_PAGE_TARGET_SIZE` (50,000). */
  targetSize?: number;
  /**
   * Session-only global manuscript offsets where an Editor Page MUST end.
   * 012B records the exact valid caret selected by "ここで区切る"; no
   * paragraph-boundary search is performed for a manual split. Each offset
   * only divides the ordinary automatic page that contains it, so a split
   * in Page 2+ never replaces an earlier automatic boundary. Invalid
   * endpoints and surrogate-pair interiors are ignored defensively.
   */
  forcedBoundaries?: readonly number[];
}

/**
 * Splits `content` into editor pages left-to-right (see the module doc for
 * why this is stable under editing). An empty manuscript still yields one
 * (empty) page, so the editor UI never has to special-case "no pages".
 */
export function computeEditorPages(content: string, options: ComputeEditorPagesOptions = {}): EditorPage[] {
  const targetSize = options.targetSize ?? EDITOR_PAGE_TARGET_SIZE;
  const length = content.length;

  if (length === 0) {
    return [{ index: 0, start: 0, end: 0, length: 0 }];
  }

  const forced =
    options.forcedBoundaries && options.forcedBoundaries.length > 0
      ? Array.from(new Set(options.forcedBoundaries))
          .filter((b) => b > 0 && b < length && !splitsSurrogatePair(content, b))
          .sort((a, b) => a - b)
      : null;

  const pages: EditorPage[] = [];
  let start = 0;
  let index = 0;
  while (start < length) {
    const automaticEnd = chooseSafeEditorPageBoundary(content, start, targetSize, options);
    // A forced boundary only divides the automatic page that actually
    // contains it. A later forced boundary must not swallow an earlier
    // automatic boundary (important when the user splits inside Page 2+).
    const forcedEnd = forced?.find((b) => b > start && b <= automaticEnd);
    const end = forcedEnd ?? automaticEnd;
    pages.push({ index, start, end, length: end - start });
    start = end;
    index += 1;
  }
  return pages;
}

/**
 * TSP-EDITOR-PAGE-WAITING-UX-HOTFIX-012A §E: keeps a set of forced page
 * boundaries (see `ComputeEditorPagesOptions.forcedBoundaries`) meaningful
 * after an edit that replaced `[editStart, editEnd)` of the OLD text with
 * `insertedLength` code units of new text. A boundary strictly INSIDE the
 * edited range is dropped (the text it split no longer exists, so forcing a
 * split there no longer means anything); one at or after `editEnd` shifts
 * by the length delta; one at or before `editStart` is untouched.
 */
export function adjustForcedBoundaries(
  boundaries: readonly number[],
  editStart: number,
  editEnd: number,
  insertedLength: number
): number[] {
  const delta = insertedLength - (editEnd - editStart);
  const next: number[] = [];
  for (const b of boundaries) {
    if (b <= editStart) next.push(b);
    else if (b >= editEnd) next.push(b + delta);
    // else: b fell inside the edited range -- drop it.
  }
  return next;
}

/**
 * The index into `pages` containing `globalOffset`. Matches
 * `tategaki.ts`'s `findPageIndexForCharIndex` semantics: with the default
 * `"forward"` affinity, an offset exactly at a boundary belongs to the page
 * it OPENS (not the one it closes), and the last page absorbs any offset
 * beyond the manuscript's end. This is the convention every OTHER caller in
 * the app relies on (Preview/Writing-Check jumps, forward typing,
 * undo/redo) and is unchanged here.
 *
 * TSP-EDITOR-MANUAL-SPLIT-AND-BACKSPACE-HOTFIX-012B §G/§H: `"backward"`
 * affinity is the one narrow, EXPLICIT exception -- a boundary-exact offset
 * instead belongs to the page it CLOSES. This exists only for landing
 * Backspace-across-a-page-boundary at the END of the previous page (its
 * natural, "as if one continuous textarea" result) instead of the START of
 * the next one, and must never become the default: every other caller
 * (forward typing/navigation) keeps calling this with no third argument.
 */
export function editorPageForGlobalOffset(
  pages: readonly EditorPage[],
  globalOffset: number,
  affinity: "forward" | "backward" = "forward"
): number {
  if (pages.length === 0) return 0;
  if (affinity === "backward") {
    for (let i = pages.length - 1; i >= 0; i--) {
      if (globalOffset > pages[i].start || i === 0) return i;
    }
    return 0;
  }
  for (let i = 0; i < pages.length; i++) {
    if (globalOffset < pages[i].end || i === pages.length - 1) return i;
  }
  return pages.length - 1;
}

/** Maps an offset local to `page`'s own text back to the canonical manuscript. */
export function editorPageLocalToGlobal(page: EditorPage, localOffset: number): number {
  return page.start + localOffset;
}

/** Maps a canonical manuscript offset to an offset local to `page`'s own text, clamped to `[0, page.length]`. */
export function globalToEditorPageLocal(page: EditorPage, globalOffset: number): number {
  return Math.max(0, Math.min(page.length, globalOffset - page.start));
}
