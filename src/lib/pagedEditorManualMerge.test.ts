/**
 * TSP-EDITOR-MANUAL-SPLIT-MERGE-012C — "前のページとつなぐ": the reversible
 * counterpart to 012B's "ここで区切る". Removing a manual forced boundary
 * never edits canonical content; it only hands the surrounding text back to
 * ordinary automatic ~50k pagination (`computeEditorPages` with one fewer
 * `forcedBoundaries` entry). Split into two halves, mirroring the rest of
 * this test suite's own convention:
 *
 * - pure pagination-model behavior (examples A/B, multiple boundaries,
 *   caret preservation) via `computeEditorPages`/`editorPageForGlobalOffset`
 *   directly, exactly like `editorPagination/paginationModel.test.ts`.
 * - PagedEditor.tsx structural coverage (visibility gating, no manuscript
 *   mutation, selection guard, styling) via source-text assertions, exactly
 *   like `pagedEditorWaitingUxHotfix.test.ts` (no React Testing Library in
 *   this project).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeEditorPages,
  editorPageForGlobalOffset,
  globalToEditorPageLocal,
} from "./editorPagination/paginationModel";

const source = (path: string) => readFileSync(resolve(path), "utf8");

/** Deterministic filler with no newlines, matching paginationModel.test.ts's own convention. */
function flatText(length: number): string {
  return "あ".repeat(length);
}

describe("removing a manual boundary hands text back to automatic pagination (TSP-EDITOR-MANUAL-SPLIT-MERGE-012C examples A/B)", () => {
  it("Example A: 20k + manual boundary + 15k (35k total) recomputes to a single automatic page", () => {
    const content = flatText(35_000);
    const withBoundary = computeEditorPages(content, { forcedBoundaries: [20_000] });
    expect(withBoundary).toHaveLength(2);
    expect(withBoundary[0].end).toBe(20_000);

    // Remove the manual boundary -- the ONLY input change.
    const afterRemoval = computeEditorPages(content, { forcedBoundaries: [] });
    expect(afterRemoval).toHaveLength(1);
    expect(afterRemoval[0].end).toBe(35_000);
  });

  it("Example B: 40k + manual boundary + 30k (70k total) still repaginates to 2 pages after the boundary is removed", () => {
    const content = flatText(70_000);
    const withBoundary = computeEditorPages(content, { forcedBoundaries: [40_000] });
    expect(withBoundary).toHaveLength(2);
    expect(withBoundary[0].end).toBe(40_000);

    const afterRemoval = computeEditorPages(content, { forcedBoundaries: [] });
    expect(afterRemoval.length).toBeGreaterThanOrEqual(2);
    // No newlines anywhere: automatic pagination hard-cuts at the ~50k target,
    // NOT at the removed manual offset (40k) -- this is a genuinely different
    // boundary, confirming the removal doesn't just silently recreate it.
    expect(afterRemoval[0].end).toBe(50_000);
    expect(afterRemoval[0].end).not.toBe(40_000);
  });

  it("does not alter canonical text -- only forcedBoundaries changes between before/after", () => {
    const content = flatText(35_000);
    const before = computeEditorPages(content, { forcedBoundaries: [20_000] });
    const after = computeEditorPages(content, { forcedBoundaries: [] });
    const reconstruct = (pages: typeof before) => pages.map((p) => content.slice(p.start, p.end)).join("");
    expect(reconstruct(before)).toBe(content);
    expect(reconstruct(after)).toBe(content);
    expect(reconstruct(before)).toBe(reconstruct(after));
  });
});

describe("multiple manual boundaries: removing one preserves the others (TSP-EDITOR-MANUAL-SPLIT-MERGE-012C §E)", () => {
  it("removing the boundary immediately before the current page leaves an earlier manual boundary intact", () => {
    const content = flatText(140_000);
    // 60,000 sits within Page 1's own automatic reach from 30,000 (a hard
    // cut at exactly 30,000 + 50,000 = 80,000 with no nearby newline), so it
    // genuinely divides Page 1 rather than being swallowed by an earlier
    // automatic boundary -- see computeEditorPages's own "a later forced
    // boundary must not swallow an earlier automatic boundary" doc.
    const boundaries = [30_000, 60_000]; // "manual A" and "manual B"
    const before = computeEditorPages(content, { forcedBoundaries: boundaries });
    expect(before.map((p) => p.end).slice(0, 2)).toEqual(boundaries);

    // User is on the page starting at 60,000 (preceded by manual B) and
    // presses "前のページとつなぐ" -- only 60_000 should be removed.
    const boundaryToRemove = 60_000;
    const nextBoundaries = boundaries.filter((b) => b !== boundaryToRemove);
    expect(nextBoundaries).toEqual([30_000]);

    const after = computeEditorPages(content, { forcedBoundaries: nextBoundaries });
    // Manual A still splits the manuscript at exactly 30,000.
    expect(after[0].end).toBe(30_000);
    // Manual B no longer appears as an exact page boundary end for the page
    // starting at 30,000 (it has been handed back to automatic pagination,
    // which reclaims a DIFFERENT natural offset here -- 80,000 -- rather
    // than silently recreating the removed 60,000 boundary).
    expect(after.some((p) => p.start === 30_000 && p.end === boundaryToRemove)).toBe(false);
    expect(after[1].end).toBe(80_000);
  });
});

describe("global caret is preserved across boundary removal and repagination (TSP-EDITOR-MANUAL-SPLIT-MERGE-012C §C/§F)", () => {
  it("a caret inside the now-merged region maps to the correct page/local offset after removal", () => {
    const content = flatText(35_000);
    const globalCaret = 25_000; // inside what was Page 2 before removal
    const before = computeEditorPages(content, { forcedBoundaries: [20_000] });
    expect(editorPageForGlobalOffset(before, globalCaret)).toBe(1);

    const after = computeEditorPages(content, { forcedBoundaries: [] });
    const targetIndex = editorPageForGlobalOffset(after, globalCaret);
    expect(targetIndex).toBe(0); // now a single page
    expect(globalToEditorPageLocal(after[targetIndex], globalCaret)).toBe(globalCaret);
  });

  it("page index may change while the caret's actual text position does not, when large content still repaginates", () => {
    const content = flatText(70_000);
    const globalCaret = 45_000; // was on Page 1 (ends at the manual 40k boundary is NOT true here -- caret is before it)
    const before = computeEditorPages(content, { forcedBoundaries: [40_000] });
    const beforeIndex = editorPageForGlobalOffset(before, globalCaret);
    expect(beforeIndex).toBe(1); // 45,000 is past the manual boundary at 40,000

    const after = computeEditorPages(content, { forcedBoundaries: [] });
    const afterIndex = editorPageForGlobalOffset(after, globalCaret);
    // The automatic hard-cut now falls at 50,000, so 45,000 is on Page 0.
    expect(afterIndex).toBe(0);
    expect(afterIndex).not.toBe(beforeIndex);
    // But the caret's own manuscript offset is untouched either way.
    expect(globalToEditorPageLocal(after[afterIndex], globalCaret)).toBe(45_000);
  });
});

describe("PagedEditor.tsx: 前のページとつなぐ (TSP-EDITOR-MANUAL-SPLIT-MERGE-012C)", () => {
  const editor = source("src/components/PagedEditor.tsx");

  it("is visible only when the boundary immediately before the current page is itself a forced (manual) one", () => {
    expect(editor).toContain(
      "const precedingBoundaryIsManual = safePageIndex > 0 && forcedBoundaries.includes(currentPage.start);"
    );
  });

  it("renders exactly one such button, gated on precedingBoundaryIsManual, never on page 1 or an automatic-only boundary", () => {
    const navigator = editor.slice(editor.indexOf('data-editor-page-navigator=""'), editor.indexOf('data-demo-target="editor"'));
    expect(navigator.match(/data-editor-merge-with-previous=""/g)).toHaveLength(1);
    expect(navigator).toContain("{precedingBoundaryIsManual && (");
    expect(navigator).toContain("前のページとつなぐ");
  });

  it("disables the button (rather than hiding it) while a non-collapsed selection or full-manuscript selection is active", () => {
    expect(editor).toContain(
      "const canMergeWithPreviousPage =\n    precedingBoundaryIsManual && !isFullManuscriptSelected && globalCaretRange.start === globalCaretRange.end;"
    );
    expect(editor).toContain("disabled={!canMergeWithPreviousPage}");
  });

  it("uses neutral secondary styling, matching ここで区切る, never destructive/gold/accent styling", () => {
    const idx = editor.indexOf('data-editor-merge-with-previous=""');
    const slice = editor.slice(idx, idx + 400);
    expect(slice).toContain("border-ink/20");
    expect(slice).not.toMatch(/amber|accent|red|destructive/);
  });

  it("has the required accessible title describing it as reversible and manuscript-safe", () => {
    expect(editor).toContain(
      'title="この手動区切りを解除して、前の編集ページとつなぎます。原稿本文には影響しません。"'
    );
  });

  it("never touches canonical content -- no commitCanonical/onContentChange/pushEdit call, so it creates NO manuscript undo entry", () => {
    const fn = editor.slice(editor.indexOf("const mergeWithPreviousPage ="), editor.indexOf("useImperativeHandle("));
    expect(fn).not.toContain("commitCanonical(");
    expect(fn).not.toContain("onContentChange(");
    expect(fn).not.toContain("pushEdit(");
  });

  it("removes only the forced boundary at the current page's own start, preserving every other forced boundary", () => {
    const fn = editor.slice(editor.indexOf("const mergeWithPreviousPage ="), editor.indexOf("useImperativeHandle("));
    expect(fn).toContain("const boundaryToRemove = currentPage.start;");
    expect(fn).toContain("forcedBoundaries.filter((b) => b !== boundaryToRemove)");
  });

  it("bails out on a non-collapsed selection instead of guessing which endpoint to preserve", () => {
    const fn = editor.slice(editor.indexOf("const mergeWithPreviousPage ="), editor.indexOf("useImperativeHandle("));
    expect(fn).toContain("if (selectionStart !== selectionEnd) return;");
  });

  it("recomputes pages and reconciles the mounted page/caret through the same switchToPageForOffset/reportCaret path as every other jump", () => {
    const fn = editor.slice(editor.indexOf("const mergeWithPreviousPage ="), editor.indexOf("useImperativeHandle("));
    expect(fn).toContain("computeEditorPages(content, { forcedBoundaries: nextForced })");
    expect(fn).toContain("switchToPageForOffset(selectionStart, newPages)");
    expect(fn).toContain("reportCaret(selectionStart)");
  });
});
