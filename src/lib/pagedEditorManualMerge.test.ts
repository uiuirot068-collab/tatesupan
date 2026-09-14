/**
 * TSP-EDITOR-MANUAL-SPLIT-MERGE-012C / TSP-EDITOR-UNIFIED-SPLIT-JOIN-012D —
 * "前のページとつなぐ", the reversible counterpart to "ここで区切る". 012D
 * unifies the user-facing model: the button is shown for EVERY Editor Page
 * after Page 1 (never gated on whether the preceding boundary happened to
 * be a `forcedBoundaries` entry or ordinary automatic pagination), and is
 * only ever DISABLED -- for the Editor Page hard-maximum limit, or an
 * active selection -- never hidden for that reason.
 *
 * Joining across a forced (manual) boundary still just removes it (012C,
 * unchanged). Joining across an automatic boundary instead records a
 * `joinedRanges` preference (see `paginationModel.ts`) so ordinary
 * automatic pagination doesn't immediately recreate a split inside the
 * newly combined region.
 *
 * Split into two halves, mirroring this suite's own convention:
 * - pure pagination-model behavior via `computeEditorPages`/
 *   `adjustJoinedRanges` directly, like `editorPagination/paginationModel.test.ts`.
 * - PagedEditor.tsx structural coverage via source-text assertions, like
 *   `pagedEditorWaitingUxHotfix.test.ts` (no React Testing Library here).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EDITOR_PAGE_HARD_MAXIMUM_SIZE,
  EDITOR_PAGE_TARGET_SIZE,
  adjustJoinedRanges,
  computeEditorPages,
  computePartialJoinBoundary,
  editorPageForGlobalOffset,
  globalToEditorPageLocal,
} from "./editorPagination/paginationModel";

const source = (path: string) => readFileSync(resolve(path), "utf8");

/** Deterministic filler with no newlines, matching paginationModel.test.ts's own convention. */
function flatText(length: number): string {
  return "あ".repeat(length);
}

describe("joinedRanges: joining across an ORIGINALLY AUTOMATIC boundary (TSP-EDITOR-UNIFIED-SPLIT-JOIN-012D)", () => {
  it("Example A: 30k + automatic boundary + 15k (45k total) becomes one page once a join preference covers the whole span", () => {
    // A genuine two-automatic-page scenario first, to confirm there really
    // are two pages before any join preference exists (no newlines
    // anywhere: page 0 hard-cuts at exactly the 50,000 target).
    const bigContent = flatText(60_000);
    const automatic = computeEditorPages(bigContent);
    expect(automatic).toHaveLength(2);
    expect(automatic[0].end).toBe(50_000);

    // Now the 30k+15k example itself: at 45,000 chars total (under the
    // 50,000 target) automatic pagination alone already yields one page --
    // the meaningful case is a manuscript that WOULD split automatically at
    // 30,000 without a join preference (forced here to stand in for "the
    // user's two original automatic pages"), and does not once one is
    // recorded over the combined 45,000-char span.
    const content = flatText(45_000);
    const beforeJoin = computeEditorPages(content, { forcedBoundaries: [30_000] });
    expect(beforeJoin).toHaveLength(2);

    const afterJoin = computeEditorPages(content, { forcedBoundaries: [], joinedRanges: [{ start: 0, end: 45_000 }] });
    expect(afterJoin).toHaveLength(1);
    expect(afterJoin[0].end).toBe(45_000);
  });

  it("does not alter canonical text -- only forcedBoundaries/joinedRanges change between before/after", () => {
    const content = flatText(45_000);
    const before = computeEditorPages(content, { forcedBoundaries: [30_000] });
    const after = computeEditorPages(content, { forcedBoundaries: [], joinedRanges: [{ start: 0, end: 45_000 }] });
    const reconstruct = (pages: typeof before) => pages.map((p) => content.slice(p.start, p.end)).join("");
    expect(reconstruct(before)).toBe(content);
    expect(reconstruct(after)).toBe(content);
    expect(reconstruct(before)).toBe(reconstruct(after));
  });
});

describe("hard-maximum limit on joining (TSP-EDITOR-UNIFIED-SPLIT-JOIN-012D)", () => {
  it("a combined region exceeding EDITOR_PAGE_HARD_MAXIMUM_SIZE is safely ignored -- automatic pagination still repaginates", () => {
    const content = flatText(70_000); // 40k + 30k style combined total, well past 55,000
    // Even if a (hypothetically bad) join preference were recorded over
    // the WHOLE manuscript, computeEditorPages must never honor it once it
    // exceeds the hard maximum.
    const pages = computeEditorPages(content, { joinedRanges: [{ start: 0, end: 70_000 }] });
    expect(pages.length).toBeGreaterThanOrEqual(2);
    for (const page of pages) {
      expect(page.length).toBeLessThanOrEqual(EDITOR_PAGE_HARD_MAXIMUM_SIZE);
    }
  });

  it("EDITOR_PAGE_HARD_MAXIMUM_SIZE is exactly the boundary used by the UI's own combinedLength check", () => {
    expect(EDITOR_PAGE_HARD_MAXIMUM_SIZE).toBe(55_000);
  });
});

describe("explicit split after join wins (TSP-EDITOR-UNIFIED-SPLIT-JOIN-012D)", () => {
  it("a forced boundary strictly inside a joined range is honored instead of the range's own end", () => {
    const content = flatText(45_000);
    const pages = computeEditorPages(content, {
      forcedBoundaries: [20_000],
      joinedRanges: [{ start: 0, end: 45_000 }],
    });
    expect(pages[0].end).toBe(20_000);
    expect(pages[1].start).toBe(20_000);
  });
});

describe("progressive joining replaces the prior range for the same start (TSP-EDITOR-UNIFIED-SPLIT-JOIN-012D)", () => {
  it("15k / 15k / 15k: joining the first pair then the remaining pair produces one 45k page", () => {
    const content = flatText(45_000);
    // Initial state: three forced 15k pages.
    const initial = computeEditorPages(content, { forcedBoundaries: [15_000, 30_000] });
    expect(initial.map((p) => p.end)).toEqual([15_000, 30_000, 45_000]);

    // Join Page 2 (start 15,000) with Page 1 (start 0): the forced boundary
    // at 15,000 is removed and a join range [0, 30000) is recorded (matches
    // combinedLength 30,000, under the hard maximum).
    const afterFirstJoin = computeEditorPages(content, {
      forcedBoundaries: [30_000],
      joinedRanges: [{ start: 0, end: 30_000 }],
    });
    expect(afterFirstJoin.map((p) => p.end)).toEqual([30_000, 45_000]);

    // Join again: Page 2 now starts at 30,000; previous page starts at 0.
    // The stored range for start=0 is REPLACED (not duplicated) with the
    // new combined span [0, 45000).
    const afterSecondJoin = computeEditorPages(content, {
      forcedBoundaries: [],
      joinedRanges: [{ start: 0, end: 45_000 }],
    });
    expect(afterSecondJoin).toHaveLength(1);
    expect(afterSecondJoin[0].end).toBe(45_000);
  });
});

describe("adjustJoinedRanges (TSP-EDITOR-UNIFIED-SPLIT-JOIN-012D)", () => {
  it("leaves a range entirely before the edited span untouched", () => {
    expect(adjustJoinedRanges([{ start: 100, end: 200 }], 500, 510, 3)).toEqual([{ start: 100, end: 200 }]);
  });

  it("shifts a range entirely after the edited span by the length delta (insertion)", () => {
    expect(adjustJoinedRanges([{ start: 1_000, end: 2_000 }], 100, 100, 50)).toEqual([{ start: 1_050, end: 2_050 }]);
  });

  it("shifts a range entirely after the edited span by the length delta (deletion)", () => {
    expect(adjustJoinedRanges([{ start: 1_000, end: 2_000 }], 100, 150, 0)).toEqual([{ start: 950, end: 1_950 }]);
  });

  it("drops a range whose start fell strictly inside the edited span", () => {
    expect(adjustJoinedRanges([{ start: 120, end: 2_000 }], 100, 150, 0)).toEqual([]);
  });

  it("drops a range whose end fell strictly inside the edited span", () => {
    expect(adjustJoinedRanges([{ start: 0, end: 120 }], 100, 150, 0)).toEqual([]);
  });

  it("drops a degenerate range (end <= start after adjustment)", () => {
    // Both endpoints land at the same collapsed point after a deletion that
    // spans the entire range.
    expect(adjustJoinedRanges([{ start: 100, end: 150 }], 100, 150, 0)).toEqual([]);
  });

  it("keeps a range spanning an edit that occurs strictly before its start and strictly after its end", () => {
    const shifted = adjustJoinedRanges([{ start: 10_000, end: 20_000 }], 5_000, 5_000, 3);
    expect(shifted).toEqual([{ start: 10_003, end: 20_003 }]);
  });
});

describe("global caret preserved across a join (TSP-EDITOR-UNIFIED-SPLIT-JOIN-012D)", () => {
  it("a caret inside the now-merged region maps to the correct page/local offset after the join", () => {
    const content = flatText(45_000);
    const globalCaret = 35_000; // inside what was Page 2 before the join
    const before = computeEditorPages(content, { forcedBoundaries: [30_000] });
    expect(editorPageForGlobalOffset(before, globalCaret)).toBe(1);

    const after = computeEditorPages(content, { forcedBoundaries: [], joinedRanges: [{ start: 0, end: 45_000 }] });
    const targetIndex = editorPageForGlobalOffset(after, globalCaret);
    expect(targetIndex).toBe(0);
    expect(globalToEditorPageLocal(after[targetIndex], globalCaret)).toBe(globalCaret);
  });
});

describe("computePartialJoinBoundary (TSP-EDITOR-PARTIAL-JOIN-AND-CARET-LANDING-012E)", () => {
  it("40k + 30k: pulls the previous page up to the ordinary ~50k target", () => {
    const content = flatText(70_000);
    const boundary = computePartialJoinBoundary(content, 0, 40_000, 70_000);
    expect(boundary).toBe(50_000);
  });

  it("45k + 30k: pulls roughly a 5k prefix into the previous page", () => {
    const content = flatText(75_000);
    const boundary = computePartialJoinBoundary(content, 0, 45_000, 75_000);
    expect(boundary).toBe(50_000);
  });

  it("49k + a large current page: a small valid prefix still moves", () => {
    const content = flatText(200_000);
    const boundary = computePartialJoinBoundary(content, 0, 49_000, 200_000);
    expect(boundary).toBe(50_000);
    expect(boundary! - 49_000).toBeGreaterThan(0);
  });

  it("never moves the boundary backward -- returns null once the previous page is already at/above the normal target", () => {
    const content = flatText(200_000);
    expect(computePartialJoinBoundary(content, 0, 50_000, 200_000)).toBeNull();
    expect(computePartialJoinBoundary(content, 0, 52_000, 200_000)).toBeNull();
  });

  it("returns null rather than exceeding the hard maximum", () => {
    // A previousStart far enough along that the ordinary ~50k target would
    // still be reachable in isolation, but force the ceiling check by
    // giving oldBoundary a value where the computed candidate would need to
    // exceed EDITOR_PAGE_HARD_MAXIMUM_SIZE from previousStart. Since the
    // natural computation targets exactly previousStart + targetSize
    // (50,000, well under the 55,000 hard maximum), this only triggers when
    // a custom targetSize pushes the ideal offset itself past the ceiling.
    const content = flatText(200_000);
    const boundary = computePartialJoinBoundary(content, 0, 40_000, 200_000, 60_000);
    expect(boundary).toBeNull();
  });

  it("clamps to the current page's own end -- never pulls from beyond it", () => {
    // idealEnd sits past currentEnd entirely: nothing left to pull that is
    // still inside the current page.
    const content = flatText(200_000);
    const boundary = computePartialJoinBoundary(content, 0, 30_000, 32_000);
    // idealEnd (50,000) > currentEnd (32,000); clamped candidate <= 32,000
    // must still be > oldBoundary (30,000) to count as real movement.
    expect(boundary === null || boundary! <= 32_000).toBe(true);
  });

  it("never splits a surrogate pair", () => {
    const astral = "\u{1F600}";
    const content = flatText(49_999) + astral + flatText(50_000);
    const boundary = computePartialJoinBoundary(content, 0, 40_000, content.length);
    expect(boundary === 49_999 || boundary === 50_001).toBe(true);
  });

  it("prefers a natural newline near the target over an exact hard cut", () => {
    const content = flatText(48_000) + "\n" + flatText(50_000);
    const boundary = computePartialJoinBoundary(content, 0, 40_000, content.length);
    expect(boundary).toBe(48_001);
  });

  it("uses EDITOR_PAGE_TARGET_SIZE as the default target, not the hard maximum", () => {
    const content = flatText(200_000);
    const boundary = computePartialJoinBoundary(content, 0, 10_000, 200_000);
    expect(boundary).toBe(EDITOR_PAGE_TARGET_SIZE);
    expect(boundary).not.toBe(EDITOR_PAGE_HARD_MAXIMUM_SIZE);
  });
});

describe("partial join via computeEditorPages (TSP-EDITOR-PARTIAL-JOIN-AND-CARET-LANDING-012E)", () => {
  it("40k + 30k: after recording the pull-up joinedRange, previous page is ~50k and current keeps the remainder", () => {
    const content = flatText(70_000);
    const before = computeEditorPages(content, { forcedBoundaries: [40_000] });
    expect(before).toHaveLength(2);
    expect(before[0].end).toBe(40_000);

    const boundary = computePartialJoinBoundary(content, 0, 40_000, before[1].end)!;
    expect(boundary).toBe(50_000);

    const after = computeEditorPages(content, { forcedBoundaries: [], joinedRanges: [{ start: 0, end: boundary }] });
    expect(after[0].end).toBe(50_000);
    expect(after[after.length - 1].end).toBe(70_000);
    for (const page of after) {
      expect(page.length).toBeLessThanOrEqual(EDITOR_PAGE_HARD_MAXIMUM_SIZE);
    }
  });

  it("the old boundary does not immediately return once a pull-up joinedRange is recorded", () => {
    const content = flatText(70_000);
    const after = computeEditorPages(content, { forcedBoundaries: [], joinedRanges: [{ start: 0, end: 50_000 }] });
    expect(after.some((p) => p.end === 40_000)).toBe(false);
  });

  it("does not alter canonical text across a partial join", () => {
    const content = flatText(70_000);
    const before = computeEditorPages(content, { forcedBoundaries: [40_000] });
    const after = computeEditorPages(content, { forcedBoundaries: [], joinedRanges: [{ start: 0, end: 50_000 }] });
    const reconstruct = (pages: typeof before) => pages.map((p) => content.slice(p.start, p.end)).join("");
    expect(reconstruct(before)).toBe(content);
    expect(reconstruct(after)).toBe(content);
  });

  it("repeating the join after a partial pull-up has no further safe capacity, so it must be disabled next time", () => {
    const content = flatText(70_000);
    const afterFirstPartialJoin = computeEditorPages(content, { joinedRanges: [{ start: 0, end: 50_000 }] });
    expect(afterFirstPartialJoin[0].end).toBe(50_000);
    const nextBoundary = computePartialJoinBoundary(
      content,
      0,
      afterFirstPartialJoin[1].start,
      afterFirstPartialJoin[1].end
    );
    expect(nextBoundary).toBeNull();
  });

  it("preserves surrounding unrelated pages when partially joining in the middle of 3+ pages", () => {
    const content = flatText(150_000);
    // Page 0: [0, 40000) forced; Page 1: [40000, 70000) forced (the pair
    // being partially joined); Page 2: [70000, 100000) forced; remainder
    // automatic.
    const before = computeEditorPages(content, { forcedBoundaries: [40_000, 70_000, 100_000] });
    expect(before.map((p) => p.end)).toEqual([40_000, 70_000, 100_000, 150_000]);

    const boundary = computePartialJoinBoundary(content, 0, 40_000, 70_000)!;
    expect(boundary).toBe(50_000);

    const after = computeEditorPages(content, {
      forcedBoundaries: [70_000, 100_000],
      joinedRanges: [{ start: 0, end: boundary }],
    });
    expect(after[0].end).toBe(50_000);
    expect(after.some((p) => p.end === 70_000)).toBe(true);
    expect(after.some((p) => p.end === 100_000)).toBe(true);
  });

  it("an explicit split inside the pulled-up region still wins", () => {
    const content = flatText(70_000);
    const after = computeEditorPages(content, {
      forcedBoundaries: [45_000],
      joinedRanges: [{ start: 0, end: 50_000 }],
    });
    expect(after[0].end).toBe(45_000);
  });
});

describe("PagedEditor.tsx: unified 前のページとつなぐ visibility/enablement (TSP-EDITOR-UNIFIED-SPLIT-JOIN-012D)", () => {
  const editor = source("src/components/PagedEditor.tsx");

  it("is shown for every page after Page 1, never gated on forcedBoundaries membership", () => {
    expect(editor).toContain("const previousPage = safePageIndex > 0 ? pages[safePageIndex - 1] : null;");
    expect(editor).not.toContain("precedingBoundaryIsManual");
    const navigator = editor.slice(editor.indexOf('data-editor-page-navigator=""'), editor.indexOf('data-demo-target="editor"'));
    expect(navigator.match(/data-editor-merge-with-previous=""/g)).toHaveLength(1);
    expect(navigator).toContain("{previousPage && (");
  });

  it("disables (never hides) the button only when neither a full nor a partial join is possible", () => {
    expect(editor).toContain(
      "const fullJoinPossible = previousPage !== null && combinedLengthWithPreviousPage <= EDITOR_PAGE_HARD_MAXIMUM_SIZE;"
    );
    expect(editor).toContain("const joinHasSafeTarget = fullJoinPossible || partialJoinBoundary !== null;");
    expect(editor).toContain(
      "前の編集ページにこれ以上つなげると文字数上限を超えるため、つなげません。"
    );
  });

  it("disables the button while a non-collapsed or full-manuscript selection is active, with concise wording", () => {
    expect(editor).toContain(
      "const mergeBlockedBySelection = isFullManuscriptSelected || globalCaretRange.start !== globalCaretRange.end;"
    );
    expect(editor).toContain("選択を解除すると、前の編集ページとつなげます。");
  });

  it("has the enabled title describing it as reversible and manuscript-safe", () => {
    expect(editor).toContain("前の編集ページとつなぎます。原稿や印刷ページには影響しません。");
  });

  it("uses neutral secondary styling, never destructive/gold/accent styling", () => {
    const idx = editor.indexOf('data-editor-merge-with-previous=""');
    const slice = editor.slice(idx, idx + 400);
    expect(slice).toContain("border-ink/20");
    expect(slice).not.toMatch(/amber|accent|red|destructive/);
  });

  it("re-verifies the selection guard and the partial-join null result inside the click handler itself, not just via `disabled`", () => {
    const fn = editor.slice(editor.indexOf("const mergeWithPreviousPage ="), editor.indexOf("useImperativeHandle("));
    expect(fn).toContain("if (selectionStart !== selectionEnd) return;");
    expect(fn).toContain("if (partial === null) return;");
  });

  it("never touches canonical content -- no commitCanonical/onContentChange/pushEdit call, so it creates NO manuscript undo entry", () => {
    const fn = editor.slice(editor.indexOf("const mergeWithPreviousPage ="), editor.indexOf("useImperativeHandle("));
    expect(fn).not.toContain("commitCanonical(");
    expect(fn).not.toContain("onContentChange(");
    expect(fn).not.toContain("pushEdit(");
  });

  it("removes the forced boundary when one exists at the join point, otherwise records a joinedRanges preference", () => {
    const fn = editor.slice(editor.indexOf("const mergeWithPreviousPage ="), editor.indexOf("useImperativeHandle("));
    expect(fn).toContain("forcedBoundaries.includes(boundaryOffset)");
    expect(fn).toContain("forcedBoundaries.filter((b) => b !== boundaryOffset)");
    expect(fn).toContain("joinedRanges.filter((r) => r.start !== previous.start)");
    expect(fn).toContain("{ start: previous.start, end: newRangeEnd }");
  });

  it("forceSplitAtCaret trims any join preference that would otherwise claim the new forced boundary as interior", () => {
    const fn = editor.slice(
      editor.indexOf("const forceSplitAtCaret ="),
      editor.indexOf("/**\n   * TSP-EDITOR-UNIFIED-SPLIT-JOIN-012D, extended by")
    );
    expect(fn).toContain("joinedRanges.filter((r) => !(r.start < forcedOffset && r.end > forcedOffset))");
  });

  it("commitCanonical adjusts both forcedBoundaries and joinedRanges via their respective adjust functions", () => {
    const fn = editor.slice(editor.indexOf("const commitCanonical ="), editor.indexOf("const handleChange ="));
    expect(fn).toContain("adjustForcedBoundaries(forcedBoundaries, editStart, editEnd, insertedLength)");
    expect(fn).toContain("adjustJoinedRanges(joinedRanges, editStart, editEnd, insertedLength)");
    expect(fn).toContain("setJoinedRanges(adjustedJoined)");
  });

  it("joinedRanges is session-only React state, never written to a persistence layer", () => {
    expect(editor).toContain("useState<JoinedEditorPageRange[]>([])");
    expect(editor).not.toMatch(/joinedRanges[\s\S]{0,80}(supabase|localStorage|indexedDB)/i);
  });
});

describe("PagedEditor.tsx: partial join / pull-up branch (TSP-EDITOR-PARTIAL-JOIN-AND-CARET-LANDING-012E)", () => {
  const editor = source("src/components/PagedEditor.tsx");

  it("computes the partial-join candidate only when a full join is not possible", () => {
    expect(editor).toContain(
      "const partialJoinBoundary =\n    previousPage !== null && !fullJoinPossible\n      ? computePartialJoinBoundary(content, previousPage.start, currentPage.start, currentPage.end)\n      : null;"
    );
  });

  it("the click handler branches on the SAME combinedLength check as the enablement logic, full join first", () => {
    const fn = editor.slice(editor.indexOf("const mergeWithPreviousPage ="), editor.indexOf("useImperativeHandle("));
    expect(fn).toContain("if (combinedLength <= EDITOR_PAGE_HARD_MAXIMUM_SIZE) {");
    expect(fn).toContain("newRangeEnd = currentPage.end; // full join");
    expect(fn).toContain(
      "const partial = computePartialJoinBoundary(content, previous.start, boundaryOffset, currentPage.end);"
    );
    expect(fn).toContain("newRangeEnd = partial; // partial join / pull-up");
  });
});

describe("PagedEditor.tsx: caret auto-scroll on explicit split/join actions (TSP-EDITOR-PARTIAL-JOIN-AND-CARET-LANDING-012E §J-§N)", () => {
  const editor = source("src/components/PagedEditor.tsx");

  it("ここで区切る requests the upper-view scroll hint", () => {
    const fn = editor.slice(editor.indexOf("const forceSplitAtCaret ="), editor.indexOf("/**\n   * TSP-EDITOR-UNIFIED-SPLIT-JOIN-012D, extended by"));
    expect(fn).toContain('switchToPageForOffset(forcedOffset, newPages, undefined, { scrollHint: "upper" });');
  });

  it("前のページとつなぐ (full or partial) requests the upper-view scroll hint using the preserved global caret", () => {
    const fn = editor.slice(editor.indexOf("const mergeWithPreviousPage ="), editor.indexOf("useImperativeHandle("));
    expect(fn).toContain('switchToPageForOffset(selectionStart, newPages, undefined, { scrollHint: "upper" });');
  });

  it("reuses the existing scrollCaretNearUpperView/measureCaretOffsetTop helpers rather than a second scroll mechanism", () => {
    // Both explicit actions funnel through switchToPageForOffset, whose own
    // same-page and cross-page (useLayoutEffect) branches already call
    // scrollCaretNearUpperView -- no new scroll helper needed for 012E.
    expect(editor.match(/function scrollCaretNearUpperView/g)).toHaveLength(1);
    expect(editor.match(/function measureCaretOffsetTop/g)).toHaveLength(1);
    const switchFn = editor.slice(editor.indexOf("const switchToPageForOffset ="), editor.indexOf("// Applies a pending cross-page selection"));
    expect(switchFn).toContain("scrollCaretNearUpperView(el, localStart)");
  });

  it("does not add a new continuous/per-render scroll-follow effect (one-shot, action-triggered only)", () => {
    // scrollCaretNearUpperView is only ever reached via an explicit
    // scrollHint passed at the call site (forceSplitAtCaret,
    // mergeWithPreviousPage, moveSelectionToGlobal, runHistory's
    // undo/redo) -- never from a bare useEffect keyed on caret/content.
    expect(editor).not.toMatch(/useEffect\(\(\) => \{[\s\S]{0,200}scrollCaretNearUpperView/);
  });

  it("ordinary typing (handleChange's own boundary reconciliation) does not request the scroll hint", () => {
    const fn = editor.slice(editor.indexOf("const handleChange ="), editor.indexOf("/** Replaces the WHOLE canonical document"));
    expect(fn).not.toContain("scrollHint");
  });
});
