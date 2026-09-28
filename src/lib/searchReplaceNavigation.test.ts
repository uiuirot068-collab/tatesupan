import { describe, expect, it } from "vitest";
import {
  INITIAL_SEARCH_REPLACE_STATE,
  deriveSearchReplaceView,
  findMatchOffsets,
  planActiveReplace,
  minimalReplacementRange,
  replaceAllMatches,
  searchReplaceReducer,
  stepMatchIndex,
  type SearchReplaceState,
} from "./searchReplaceNavigation";
import { computeEditorPages, editorPageForGlobalOffset, globalToEditorPageLocal } from "./editorPagination/paginationModel";

// 検索・置換 (Phase 9 Human-QA repair): one whole-manuscript search shared by
// the FULL and WINDOWED editor surfaces. Real-browser reveal/scroll/selection
// is covered by tests/e2e/searchReplaceNavigation.e2e.mjs.

const TEXT = "瑠璃色の空、瑠璃色の海、瑠璃色の瓶。";
const search = (searchText: string, replaceText = ""): SearchReplaceState =>
  searchReplaceReducer(searchReplaceReducer(INITIAL_SEARCH_REPLACE_STATE, { type: "setSearch", searchText }), { type: "setReplace", replaceText });
/** Simulates 次へ / 前へ exactly as the dialog does: from the index valid for the current match list. */
const step = (content: string, state: SearchReplaceState, dir: 1 | -1): SearchReplaceState => {
  const view = deriveSearchReplaceView(content, state);
  return searchReplaceReducer(state, { type: "activate", index: stepMatchIndex(view.activeIndex, view.count, dir) });
};

describe("検索・置換 search state", () => {
  it("shows a match count as soon as a search text is typed", () => {
    const view = deriveSearchReplaceView(TEXT, search("瑠璃色"));
    expect(view.count).toBe(3);
    expect(view.statusLabel).toBe("3 件見つかりました");
    expect(view.activeIndex).toBe(-1);
    expect(deriveSearchReplaceView(TEXT, INITIAL_SEARCH_REPLACE_STATE).statusLabel).toBeNull();
  });

  it("次へ advances the index, shows `n / N 件目` and a snippet around the match", () => {
    let state = search("瑠璃色");
    state = step(TEXT, state, 1);
    let view = deriveSearchReplaceView(TEXT, state);
    expect(view.activeIndex).toBe(0);
    expect(view.statusLabel).toBe("1 / 3 件目");
    state = step(TEXT, state, 1);
    view = deriveSearchReplaceView(TEXT, state);
    expect(view.activeIndex).toBe(1);
    expect(view.activeOffset).toBe(6);
    expect(view.statusLabel).toBe("2 / 3 件目");
    expect(view.context).toContain("瑠璃色の海");
  });

  it("次へ wraps from the last match to the first", () => {
    let state = search("瑠璃色");
    for (let i = 0; i < 3; i++) state = step(TEXT, state, 1);
    expect(deriveSearchReplaceView(TEXT, state).activeIndex).toBe(2);
    state = step(TEXT, state, 1);
    expect(deriveSearchReplaceView(TEXT, state).activeIndex).toBe(0);
  });

  it("前へ starts at the last match and wraps backwards", () => {
    let state = search("瑠璃色");
    state = step(TEXT, state, -1);
    expect(deriveSearchReplaceView(TEXT, state).activeIndex).toBe(2);
    state = step(TEXT, state, 1); // → 0
    state = step(TEXT, state, -1);
    expect(deriveSearchReplaceView(TEXT, state).activeIndex).toBe(2);
    expect(stepMatchIndex(0, 3, -1)).toBe(2);
  });

  it("works as search only: an empty 置換後の文字列 never disables 前へ / 次へ", () => {
    const state = search("瑠璃色", "");
    const view = deriveSearchReplaceView(TEXT, state);
    expect(state.replaceText).toBe("");
    expect(view.canStep).toBe(true);
    expect(view.canReplaceAll).toBe(true); // replacing with "" (deletion) stays possible, as before
  });

  it("0 件: status says 0 件 and 前へ / 次へ / 選択箇所を置換 / すべて置換 are disabled", () => {
    const view = deriveSearchReplaceView(TEXT, search("存在しない"));
    expect(view.count).toBe(0);
    expect(view.statusLabel).toBe("0 件");
    expect(view.canStep).toBe(false);
    expect(view.canReplaceActive).toBe(false);
    expect(view.canReplaceAll).toBe(false);
    expect(stepMatchIndex(-1, 0, 1)).toBe(-1);
  });

  it("changing the search text resets the current index (no stale active match can be replaced)", () => {
    let state = step(TEXT, step(TEXT, search("瑠璃色"), 1), 1);
    expect(state.matchIndex).toBe(1);
    state = searchReplaceReducer(state, { type: "setSearch", searchText: "瑠璃" });
    const view = deriveSearchReplaceView(TEXT, state);
    expect(state.matchIndex).toBe(-1);
    expect(view.activeIndex).toBe(-1);
    expect(view.canReplaceActive).toBe(false);
    expect(view.context).toBe("");
    // …and the next 次へ goes to the FIRST match of the new query.
    expect(deriveSearchReplaceView(TEXT, step(TEXT, state, 1)).activeOffset).toBe(0);
  });

  it("an index left over from an edit that removed matches is treated as no active match", () => {
    const state = searchReplaceReducer(search("瑠璃色"), { type: "activate", index: 2 });
    const view = deriveSearchReplaceView("瑠璃色の空", state);
    expect(view.activeIndex).toBe(-1);
    expect(view.canReplaceActive).toBe(false);
    expect(deriveSearchReplaceView("瑠璃色の空", step("瑠璃色の空", state, 1)).activeIndex).toBe(0);
  });
});

describe("選択箇所を置換", () => {
  it("replaces only the active match and activates the next one", () => {
    const state = step(TEXT, step(TEXT, search("瑠璃色", "群青"), 1), 1); // active = 2nd
    const view = deriveSearchReplaceView(TEXT, state);
    const plan = planActiveReplace(TEXT, state, view.activeOffset)!;
    expect(plan.start).toBe(6);
    expect(plan.end).toBe(9);
    expect(plan.nextContent).toBe("瑠璃色の空、群青の海、瑠璃色の瓶。");
    expect(findMatchOffsets(plan.nextContent, "瑠璃色")).toHaveLength(2);
    // The old 3rd match is now the 2nd one, at its shifted offset.
    expect(plan.nextIndex).toBe(1);
    expect(plan.nextOffset).toBe(plan.nextContent.indexOf("瑠璃色の瓶"));
  });

  it("after the last match it wraps to the first remaining match, and finishes with -1", () => {
    let content = TEXT;
    let state = step(TEXT, search("瑠璃色", "群青"), -1); // active = last
    const visited: string[] = [];
    for (let i = 0; i < 5; i++) {
      const view = deriveSearchReplaceView(content, state);
      const plan = planActiveReplace(content, state, view.activeOffset);
      if (!plan) break;
      content = plan.nextContent;
      visited.push(content);
      state = searchReplaceReducer(state, { type: "activate", index: plan.nextIndex });
      if (plan.nextIndex === -1) break;
    }
    expect(visited).toEqual([
      "瑠璃色の空、瑠璃色の海、群青の瓶。",
      "群青の空、瑠璃色の海、群青の瓶。",
      "群青の空、群青の海、群青の瓶。",
    ]);
    expect(deriveSearchReplaceView(content, state).canReplaceActive).toBe(false);
  });

  it("never loops on its own output when the replacement contains the search text", () => {
    const content = "山と山と山";
    let state = step(content, search("山", "山田"), 1);
    let current = content;
    const offsets: number[] = [];
    for (let i = 0; i < 3; i++) {
      const view = deriveSearchReplaceView(current, state);
      const plan = planActiveReplace(current, state, view.activeOffset)!;
      offsets.push(plan.start);
      current = plan.nextContent;
      state = searchReplaceReducer(state, { type: "activate", index: plan.nextIndex });
    }
    expect(current).toBe("山田と山田と山田");
    expect(offsets).toEqual([0, 3, 6]);
    // Every original match is done; the only matches left are inside the inserted text, so it wraps onto the first one (index 0, offset 0)
    // — a fresh pass, not a same-position loop.
    expect(offsets[2]).not.toBe(offsets[1]);
  });

  it("refuses a stale range (the text at the offset is no longer the search text)", () => {
    const state = searchReplaceReducer(search("瑠璃色", "群青"), { type: "activate", index: 0 });
    expect(planActiveReplace(TEXT, state, 1)).toBeNull();
    expect(planActiveReplace(TEXT, state, -1)).toBeNull();
  });

  it("keeps UTF-16 offsets across astral characters and line breaks", () => {
    const content = "𠮷野\n瑠璃色\n𠮷野";
    const state = step(content, search("𠮷野", "吉野"), -1);
    const view = deriveSearchReplaceView(content, state);
    expect(view.activeOffset).toBe(content.lastIndexOf("𠮷野"));
    const plan = planActiveReplace(content, state, view.activeOffset)!;
    expect(plan.nextContent).toBe("𠮷野\n瑠璃色\n吉野");
    expect(plan.nextOffset).toBe(0); // wraps to the first
  });
});

describe("すべて置換", () => {
  it("replaces every match of the whole manuscript", () => {
    const { nextContent, count } = replaceAllMatches(TEXT, "瑠璃色", "群青");
    expect(count).toBe(3);
    expect(nextContent).toBe("群青の空、群青の海、群青の瓶。");
  });

  it("is literal: `$&` / regex characters in either string are plain text", () => {
    expect(replaceAllMatches("a.b a.b", "a.b", "$&!").nextContent).toBe("$&! $&!");
    expect(replaceAllMatches("abc", "", "x")).toEqual({ nextContent: "abc", count: 0 });
  });
});

describe("WINDOWED: a match on another 編集ページ", () => {
  // The dialog passes canonical offsets; PagedEditor.moveSelectionToGlobal maps
  // them with the pagination model (range → page of its LAST character).
  const paragraph = "　春の宵、窓辺に置いた硝子の瓶が淡い光を返していた。\n";
  const content = `${paragraph.repeat(1200)}ここに瑠璃色がある。\n${paragraph.repeat(1200)}最後の瑠璃色。`;
  const pages = computeEditorPages(content);
  const matches = findMatchOffsets(content, "瑠璃色");

  it("the second match lives on a later 編集ページ than the first", () => {
    expect(pages.length).toBeGreaterThan(1);
    const pageOf = (offset: number) => editorPageForGlobalOffset(pages, offset + 3, "backward");
    expect(pageOf(matches[1])).toBeGreaterThan(pageOf(matches[0]));
    const page = pages[pageOf(matches[1])];
    const localStart = globalToEditorPageLocal(page, matches[1]);
    expect(content.slice(page.start, page.end).slice(localStart, localStart + 3)).toBe("瑠璃色");
  });

  it("a match ending exactly at a page boundary maps to its own page (backward affinity), not offset 0 of the next", () => {
    const boundary = pages[1].start;
    const start = boundary - 2;
    expect(editorPageForGlobalOffset(pages, boundary, "forward")).toBe(1);
    expect(editorPageForGlobalOffset(pages, boundary, "backward")).toBe(0);
    expect(globalToEditorPageLocal(pages[0], start)).toBe(pages[0].length - 2);
  });
});

describe("すべて置換 as ONE undoable edit (minimalReplacementRange)", () => {
  const apply = (before: string, r: { start: number; end: number; text: string }) => before.slice(0, r.start) + r.text + before.slice(r.end);

  it("spans only first..last changed character and reproduces the replace-all result exactly", () => {
    const before = `前書き。${TEXT}後書き。`;
    const { nextContent } = replaceAllMatches(before, "瑠璃色", "群青");
    const range = minimalReplacementRange(before, nextContent);
    expect(apply(before, range)).toBe(nextContent);
    expect(range.start).toBe(before.indexOf("瑠璃色"));
    expect(range.end).toBe(before.lastIndexOf("瑠璃色") + 3);
    expect(before.slice(0, range.start)).toBe("前書き。");
  });

  it("handles a single replacement, deletion (empty replacement) and no change", () => {
    const one = planActiveReplace(TEXT, searchReplaceReducer(search("瑠璃色", "群青"), { type: "activate", index: 1 }), 6)!;
    const r1 = minimalReplacementRange(TEXT, one.nextContent);
    expect(apply(TEXT, r1)).toBe(one.nextContent);
    expect(r1.end - r1.start).toBeLessThanOrEqual(3);
    const deleted = replaceAllMatches(TEXT, "瑠璃色", "").nextContent;
    const r2 = minimalReplacementRange(TEXT, deleted);
    expect(apply(TEXT, r2)).toBe(deleted);
    expect(minimalReplacementRange(TEXT, TEXT)).toEqual({ start: TEXT.length, end: TEXT.length, text: "" });
  });

  it("never splits a surrogate pair at either edge", () => {
    // 𠮷 (D842 DFB7) → 𠮟 (D842 DF9F): same high surrogate, different low one.
    const before = "a𠮷b";
    const after = "a𠮟b";
    const range = minimalReplacementRange(before, after);
    expect(range).toEqual({ start: 1, end: 3, text: "𠮟" });
    expect(apply(before, range)).toBe(after);
    // Shared low surrogate at the suffix edge: 𠀋 (D840 DC0B) → 𡀋 (D844 DC0B).
    const r2 = minimalReplacementRange("x𠀋", "x𡀋");
    expect(r2).toEqual({ start: 1, end: 3, text: "𡀋" });
  });
});
