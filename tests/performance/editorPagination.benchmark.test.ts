import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { computeEditorPages, EDITOR_PAGE_TARGET_SIZE } from "../../src/lib/editorPagination/paginationModel";
import { makeLongDocumentFixture } from "./longDocumentFixtures";

/**
 * TSP-PREVIEW-SYNC-STABILITY-011 §F: `PagedEditor.tsx` recomputes
 * `computeEditorPages(content)` from scratch on EVERY keystroke (it's a bare
 * `useMemo(() => computeEditorPages(content), [content])`), since `content`
 * is a new string reference every keystroke regardless of WHERE the edit
 * happened. This benchmark isolates that one call (no DOM/React) to measure,
 * with real numbers instead of guessing, whether its cost is (a) uniform
 * regardless of caret position, or (b) measurably worse when the edit sits
 * near a page's ~50k target size (where `chooseSafeEditorPageBoundary` may
 * have to widen its newline search from the 5k default radius out to the
 * 15k extended radius before falling back to a hard cut).
 */
describe("editor pagination boundary-typing cost", () => {
  it("compares mid-page vs near-page-boundary single-keystroke pagination cost on a ~300k document", () => {
    const base = makeLongDocumentFixture(300_000);

    const timeInsertAt = (position: number, iterations: number): number => {
      let total = 0;
      let content = base;
      for (let i = 0; i < iterations; i++) {
        const next = content.slice(0, position) + "あ" + content.slice(position);
        const start = performance.now();
        computeEditorPages(next);
        total += performance.now() - start;
        content = next; // keep growing, same as real typing
      }
      return total / iterations;
    };

    // Mid-page: far from any page's target-size threshold.
    const midPagePosition = Math.floor(EDITOR_PAGE_TARGET_SIZE / 2);
    // Near-boundary: right at page 1's ~50,000 target size, where the
    // boundary search is most likely to need its widest radius.
    const nearBoundaryPosition = EDITOR_PAGE_TARGET_SIZE - 50;
    // Deep middle of a later page, for a second uniformity data point.
    const laterMidPagePosition = EDITOR_PAGE_TARGET_SIZE * 3 + Math.floor(EDITOR_PAGE_TARGET_SIZE / 2);

    const ITERATIONS = 40;
    const midMs = timeInsertAt(midPagePosition, ITERATIONS);
    const boundaryMs = timeInsertAt(nearBoundaryPosition, ITERATIONS);
    const laterMidMs = timeInsertAt(laterMidPagePosition, ITERATIONS);

    const report = {
      documentLength: base.length,
      iterations: ITERATIONS,
      midPageMs: Number(midMs.toFixed(4)),
      nearBoundaryMs: Number(boundaryMs.toFixed(4)),
      laterMidPageMs: Number(laterMidMs.toFixed(4)),
      boundaryVsMidRatio: Number((boundaryMs / midMs).toFixed(2)),
    };
    console.log(`TSP_PAGINATION_PERF ${JSON.stringify(report)}`);

    // Sanity: pagination must still be fast in absolute terms regardless of
    // where the edit lands (this is the actual product bar -- "near-boundary
    // typing should feel approximately as immediate as ordinary within-page
    // typing" -- not a specific ratio, which can vary by machine).
    expect(midMs).toBeLessThan(20);
    expect(boundaryMs).toBeLessThan(20);
    expect(laterMidMs).toBeLessThan(20);
  }, 60_000);
});
