/**
 * 検索・置換 (Phase 9 Human-QA repair): the whole-manuscript search state
 * behind `SearchReplaceModal`, kept pure so it is testable without a DOM.
 *
 * Offsets are canonical UTF-16 offsets into the full manuscript -- the same
 * contract `EditorPaneHandle` uses on both editor surfaces (FULL textarea and
 * the WINDOWED `PagedEditor`, which maps them to its mounted 編集ページ). There
 * is exactly one search implementation; the surfaces only differ in how they
 * reveal/replace a range.
 */

/** Start offsets of every non-overlapping occurrence (the same matches `split`/replace-all count). */
export function findMatchOffsets(content: string, searchText: string): number[] {
  if (searchText === "") return [];
  const offsets: number[] = [];
  for (let at = content.indexOf(searchText); at !== -1; at = content.indexOf(searchText, at + searchText.length)) {
    offsets.push(at);
  }
  return offsets;
}

/** The match index after `current` in direction `dir`, wrapping around. */
export function stepMatchIndex(current: number, count: number, dir: 1 | -1): number {
  if (count === 0) return -1;
  if (current < 0) return dir === 1 ? 0 : count - 1;
  return (current + dir + count) % count;
}

export interface SearchReplaceState {
  searchText: string;
  replaceText: string;
  /** Index into the current match list; -1 = no active match (nothing selected by the dialog yet). */
  matchIndex: number;
}

export type SearchReplaceAction =
  /** A new query always drops the active match, so a stale range can never be replaced. */
  | { type: "setSearch"; searchText: string }
  | { type: "setReplace"; replaceText: string }
  | { type: "activate"; index: number };

export const INITIAL_SEARCH_REPLACE_STATE: SearchReplaceState = { searchText: "", replaceText: "", matchIndex: -1 };

export function searchReplaceReducer(state: SearchReplaceState, action: SearchReplaceAction): SearchReplaceState {
  switch (action.type) {
    case "setSearch":
      return action.searchText === state.searchText && state.matchIndex === -1
        ? state
        : { ...state, searchText: action.searchText, matchIndex: -1 };
    case "setReplace":
      return { ...state, replaceText: action.replaceText };
    case "activate":
      return { ...state, matchIndex: action.index };
  }
}

export interface SearchReplaceView {
  matches: number[];
  count: number;
  /** -1 when there is no active match (or the stored index no longer exists after an edit). */
  activeIndex: number;
  activeOffset: number;
  statusLabel: string | null;
  /** A short window around the active match for the panel's snippet ("" when none). */
  context: string;
  canStep: boolean;
  canReplaceActive: boolean;
  canReplaceAll: boolean;
}

const CONTEXT_CHARS = 16;

export function deriveSearchReplaceView(content: string, state: SearchReplaceState, matches = findMatchOffsets(content, state.searchText)): SearchReplaceView {
  const count = matches.length;
  const activeIndex = state.matchIndex >= 0 && state.matchIndex < count ? state.matchIndex : -1;
  const activeOffset = activeIndex >= 0 ? matches[activeIndex] : -1;
  const statusLabel = state.searchText === ""
    ? null
    : activeIndex >= 0
      ? `${activeIndex + 1} / ${count} 件目`
      : count === 0
        ? "0 件"
        : `${count} 件見つかりました`;
  const context = activeOffset >= 0
    ? content
      .slice(Math.max(0, activeOffset - CONTEXT_CHARS), Math.min(content.length, activeOffset + state.searchText.length + CONTEXT_CHARS))
      .replace(/\s+/g, " ")
    : "";
  return {
    matches,
    count,
    activeIndex,
    activeOffset,
    statusLabel,
    context,
    canStep: count > 0,
    canReplaceActive: activeIndex >= 0,
    canReplaceAll: state.searchText !== "" && count > 0,
  };
}

export interface ActiveReplacePlan {
  /** The canonical range the edit replaces (exactly the active match). */
  start: number;
  end: number;
  nextContent: string;
  /**
   * The match to activate once `nextContent` is committed: the first match
   * that starts at or after the end of the inserted text, wrapping to the
   * first match. Matches that lie inside the inserted text itself (a
   * replacement that contains the search text, e.g. 山 → 山田) are skipped so
   * 選択箇所を置換 can never loop on the text it just wrote. -1 when no match
   * is left.
   */
  nextIndex: number;
  nextOffset: number;
}

/** Plans 選択箇所を置換 for the active match; `null` when there is no active match or it is stale. */
export function planActiveReplace(content: string, state: SearchReplaceState, activeOffset: number): ActiveReplacePlan | null {
  const { searchText, replaceText } = state;
  if (searchText === "" || activeOffset < 0) return null;
  const end = activeOffset + searchText.length;
  if (content.slice(activeOffset, end) !== searchText) return null;
  const nextContent = content.slice(0, activeOffset) + replaceText + content.slice(end);
  const nextMatches = findMatchOffsets(nextContent, searchText);
  const resumeAt = activeOffset + replaceText.length;
  let nextIndex = nextMatches.findIndex((offset) => offset >= resumeAt);
  if (nextIndex === -1) {
    // Wrap, but never onto a match overlapping the text just inserted.
    nextIndex = nextMatches.findIndex((offset) => offset + searchText.length <= activeOffset);
  }
  return { start: activeOffset, end, nextContent, nextIndex, nextOffset: nextIndex >= 0 ? nextMatches[nextIndex] : -1 };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** すべて置換: every non-overlapping occurrence, literally (no regex / `$&` semantics in either string). */
export function replaceAllMatches(content: string, searchText: string, replaceText: string): { nextContent: string; count: number } {
  if (searchText === "") return { nextContent: content, count: 0 };
  const count = findMatchOffsets(content, searchText).length;
  const nextContent = content.replace(new RegExp(escapeRegExp(searchText), "g"), () => replaceText);
  return { nextContent, count };
}

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/**
 * The single contiguous edit turning `before` into `after`: replace
 * `before[start, end)` with `text`. すべて置換 applies its whole result as
 * this ONE edit, so a single 元に戻す / Ctrl+Z reverts the whole operation on
 * both editor surfaces while everything outside the first..last match stays
 * untouched (WINDOWED keeps its manual 編集ページ boundaries there). The range
 * never splits a surrogate pair.
 */
export function minimalReplacementRange(before: string, after: string): { start: number; end: number; text: string } {
  const max = Math.min(before.length, after.length);
  let prefix = 0;
  while (prefix < max && before.charCodeAt(prefix) === after.charCodeAt(prefix)) prefix += 1;
  // The shared prefix is identical in both strings: never end it on a high surrogate.
  if (prefix > 0 && isHighSurrogate(before.charCodeAt(prefix - 1))) prefix -= 1;
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before.charCodeAt(before.length - 1 - suffix) === after.charCodeAt(after.length - 1 - suffix)
  ) {
    suffix += 1;
  }
  // …nor start the shared suffix on a low surrogate.
  if (suffix > 0 && isLowSurrogate(before.charCodeAt(before.length - suffix))) suffix -= 1;
  return { start: prefix, end: before.length - suffix, text: after.slice(prefix, after.length - suffix) };
}
