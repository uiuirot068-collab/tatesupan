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

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

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

/**
 * CST-PORT-015: what the dialog just changed, kept on screen until the next
 * search action so the writer can check it in place (the editor does not
 * move on to the next match by itself any more).
 *
 * - "replaced": 置換 wrote `text` at `start` (it was `previousText`); `ordinal` is the match number it had.
 * - "restored": この置換を戻す put `text` (the search text) back at `start`.
 * - "all": すべて置換 replaced `ordinal` matches (`start` is -1).
 */
export interface ReplaceReceipt {
  kind: "replaced" | "restored" | "all";
  start: number;
  text: string;
  previousText: string;
  ordinal: number;
}

export interface SearchReplaceState {
  searchText: string;
  replaceText: string;
  /** Index into the current match list; -1 = no active match (nothing selected by the dialog yet). */
  matchIndex: number;
  receipt: ReplaceReceipt | null;
}

export type SearchReplaceAction =
  /** A new query always drops the active match, so a stale range can never be replaced. */
  | { type: "setSearch"; searchText: string }
  | { type: "setReplace"; replaceText: string }
  | { type: "activate"; index: number }
  /** A replace / restore landed: show it, with `matchIndex` (-1 = none) as the active match. */
  | { type: "receipt"; receipt: ReplaceReceipt; matchIndex: number };

export const INITIAL_SEARCH_REPLACE_STATE: SearchReplaceState = { searchText: "", replaceText: "", matchIndex: -1, receipt: null };

export function searchReplaceReducer(state: SearchReplaceState, action: SearchReplaceAction): SearchReplaceState {
  switch (action.type) {
    case "setSearch":
      return action.searchText === state.searchText && state.matchIndex === -1 && state.receipt === null
        ? state
        : { ...state, searchText: action.searchText, matchIndex: -1, receipt: null };
    case "setReplace":
      return { ...state, replaceText: action.replaceText };
    case "activate":
      return { ...state, matchIndex: action.index, receipt: null };
    case "receipt":
      return { ...state, matchIndex: action.matchIndex, receipt: action.receipt };
  }
}

/** The receipt while it still describes `content` (an edit elsewhere that shifts or changes it drops it). */
export function validReceipt(content: string, receipt: ReplaceReceipt | null): ReplaceReceipt | null {
  if (!receipt) return null;
  if (receipt.kind === "all") return receipt;
  return content.slice(receipt.start, receipt.start + receipt.text.length) === receipt.text ? receipt : null;
}

export interface MatchContext {
  before: string;
  hit: string;
  after: string;
}

const CONTEXT_CHARS = 12;
const showBreaks = (text: string) => text.replace(/\r?\n/g, "↵");

/**
 * B7 / CST-PORT-015: up to 12 characters on each side of `[start, end)`, line
 * breaks shown as ↵, never cutting a surrogate pair in half at either edge.
 */
export function matchContext(content: string, start: number, end: number, chars = CONTEXT_CHARS): MatchContext {
  let from = Math.max(0, start - chars);
  if (from > 0 && from < start && isLowSurrogate(content.charCodeAt(from))) from += 1;
  let to = Math.min(content.length, end + chars);
  if (to < content.length && to > end && isHighSurrogate(content.charCodeAt(to - 1))) to -= 1;
  return {
    before: showBreaks(content.slice(from, start)),
    hit: showBreaks(content.slice(start, end)),
    after: showBreaks(content.slice(end, to)),
  };
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
  /** The same window split around the match, so the match itself can be marked (null when none). */
  contextParts: MatchContext | null;
  /** The last replace / restore while it still holds (see `validReceipt`). */
  receipt: ReplaceReceipt | null;
  /** 「3件目を置換しました」 etc. (null when there is no receipt). */
  receiptLabel: string | null;
  /** The changed text with its surroundings (null for すべて置換). */
  receiptContext: MatchContext | null;
  /** The range to tint in the editor: the text just replaced / restored. */
  markRange: { start: number; end: number } | null;
  /** この置換を戻す is offered right after a single 置換. */
  canUndoReceipt: boolean;
  canStep: boolean;
  canReplaceActive: boolean;
  canReplaceAll: boolean;
}

export function deriveSearchReplaceView(content: string, state: SearchReplaceState, matches = findMatchOffsets(content, state.searchText)): SearchReplaceView {
  const count = matches.length;
  const activeIndex = state.matchIndex >= 0 && state.matchIndex < count ? state.matchIndex : -1;
  const activeOffset = activeIndex >= 0 ? matches[activeIndex] : -1;
  const receipt = validReceipt(content, state.receipt);
  const statusLabel = state.searchText === ""
    ? null
    : activeIndex >= 0
      ? `${activeIndex + 1} / ${count} 件目`
      : receipt
        ? `残り ${count} 件`
        : count === 0
          ? "0 件"
          : `${count} 件見つかりました`;
  const contextParts = activeOffset >= 0 ? matchContext(content, activeOffset, activeOffset + state.searchText.length) : null;
  const context = contextParts ? contextParts.before + contextParts.hit + contextParts.after : "";
  const receiptLabel = !receipt
    ? null
    : receipt.kind === "all"
      ? `${receipt.ordinal} 件を置換しました`
      : receipt.kind === "restored"
        ? `${receipt.ordinal} 件目を元に戻しました`
        : `${receipt.ordinal} 件目を置換しました`;
  const markRange = receipt && receipt.kind !== "all" ? { start: receipt.start, end: receipt.start + receipt.text.length } : null;
  return {
    matches,
    count,
    activeIndex,
    activeOffset,
    statusLabel,
    context,
    contextParts,
    receipt,
    receiptLabel,
    receiptContext: markRange ? matchContext(content, markRange.start, markRange.end) : null,
    markRange,
    canUndoReceipt: receipt?.kind === "replaced",
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
   * The match after the replaced one: the first match
   * that starts at or after the end of the inserted text, wrapping to the
   * first match. Matches that lie inside the inserted text itself (a
   * replacement that contains the search text, e.g. 山 → 山田) are skipped so
   * 選択箇所を置換 can never loop on the text it just wrote. -1 when no match
   * is left. (Since CST-PORT-015 the dialog stays on the replaced text and
   * 次へ reaches this match through `stepFromView`.)
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

/**
 * CST-PORT-015 次へ / 前へ: from the active match, or -- right after a 置換,
 * when no match is active -- from the replaced text: 次へ goes to the first
 * match after it, 前へ to the last match before it (wrapping, never onto a
 * match inside the replaced text itself). -1 when there is no match.
 */
export function stepFromView(view: Pick<SearchReplaceView, "matches" | "activeIndex" | "markRange" | "receipt">, searchLength: number, dir: 1 | -1): number {
  const { matches, activeIndex, markRange } = view;
  const count = matches.length;
  if (activeIndex >= 0 || !markRange || view.receipt?.kind !== "replaced") return stepMatchIndex(activeIndex, count, dir);
  const after = (offset: number) => offset >= markRange.end;
  const before = (offset: number) => offset + searchLength <= markRange.start;
  if (dir === 1) {
    const next = matches.findIndex(after);
    return next !== -1 ? next : matches.findIndex(before);
  }
  const lastIndex = (test: (offset: number) => boolean) => {
    for (let i = count - 1; i >= 0; i -= 1) if (test(matches[i])) return i;
    return -1;
  };
  const previous = lastIndex(before);
  return previous !== -1 ? previous : lastIndex(after);
}

/** CST-PORT-015 この置換を戻す: put the replaced match back, as one edit; `null` once the text there has changed. */
export function planUndoReceipt(content: string, receipt: ReplaceReceipt | null): { start: number; end: number; text: string; nextContent: string } | null {
  const valid = validReceipt(content, receipt);
  if (!valid || valid.kind !== "replaced") return null;
  const end = valid.start + valid.text.length;
  return { start: valid.start, end, text: valid.previousText, nextContent: content.slice(0, valid.start) + valid.previousText + content.slice(end) };
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
