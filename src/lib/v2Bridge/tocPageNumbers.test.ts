import { describe, expect, it } from "vitest";
import { computeTocItemsWithV2 } from "./tocPageNumbers";
import type { V2PreviewLayout } from "./previewWorkerProtocol";

function layoutForRanges(
  ranges: Array<{ start: number; end: number; physicalPageNumber: number }>
): V2PreviewLayout {
  const bodyPages = ranges.map((range, bodyIndex) => ({
    physicalIndex: range.physicalPageNumber - 1,
    physicalPageNumber: range.physicalPageNumber,
    kind: "body" as const,
    bodyIndex,
    bodyPageNumber: bodyIndex + 1,
    sourceRange: { start: range.start, end: range.end },
    imageIds: [],
  }));
  return {
    layoutId: 1,
    pageSequence: bodyPages.map((page) => ({ kind: "body" as const, index: page.bodyIndex! })),
    pageModel: {
      sourceContent: "",
      pages: bodyPages,
      bodyPages,
      bodyPageCount: bodyPages.length,
      listLength: Math.max(bodyPages.length, 1),
      overlayPages: bodyPages.map(() => ({ tokens: [], columns: null, lines: [], columnLines: null })),
      bodySourceRanges: bodyPages.map((page) => page.sourceRange!),
      imagePageIndicesById: new Map(),
    },
  };
}

describe("computeTocItemsWithV2", () => {
  it("uses V2 physical page numbers rather than body indices", async () => {
    const content = "# 一章\n本文\n# 二章\n本文";
    const seen: string[] = [];
    const items = await computeTocItemsWithV2({
      content,
      nombreStart: 1,
      compose: async (combined) => {
        seen.push(combined);
        const firstHeading = combined.indexOf("# 一章");
        const secondHeading = combined.indexOf("# 二章");
        return layoutForRanges([
          { start: 0, end: firstHeading, physicalPageNumber: 1 },
          { start: firstHeading, end: secondHeading, physicalPageNumber: 2 },
          // Simulate a horizontal colophon inserted before the second body page:
          // the second heading's BODY index is 2 but its physical page is 4.
          { start: secondHeading, end: combined.length, physicalPageNumber: 4 },
        ]);
      },
    });

    expect(items).toEqual([
      { title: "一章", pageNumber: 2 },
      { title: "二章", pageNumber: 4 },
    ]);
    expect(seen.length).toBeGreaterThanOrEqual(2);
  });

  it("applies nombreStart to the V2 physical page", async () => {
    const content = "# 章\n本文";
    const items = await computeTocItemsWithV2({
      content,
      nombreStart: 5,
      compose: async (combined) => {
        const heading = combined.indexOf("# 章");
        return layoutForRanges([
          { start: 0, end: heading, physicalPageNumber: 1 },
          { start: heading, end: combined.length, physicalPageNumber: 3 },
        ]);
      },
    });
    expect(items[0]?.pageNumber).toBe(7);
  });

  it("returns no entries when the manuscript has no headings", async () => {
    let composed = false;
    const items = await computeTocItemsWithV2({
      content: "本文だけ",
      nombreStart: 1,
      compose: async () => {
        composed = true;
        return layoutForRanges([]);
      },
    });
    expect(items).toEqual([]);
    expect(composed).toBe(false);
  });
});
