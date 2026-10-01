import { describe, expect, it } from "vitest";
import { computeTocItemsWithV2 } from "./tocPageNumbers";
import type { V2PreviewLayout } from "./previewWorkerProtocol";
import type { V2PreviewPage } from "./previewPageModel";
import type { TocItem } from "@/utils/tocGenerator";
import type { PhysicalPageRef } from "../../../typesetting-v2/core/layout/schema";

/**
 * A fake V2 layout in the exact shape the Preview worker returns: `tocPageCount`
 * synthetic TOC pages first (canonical body pages 0..n-1), then the Editor body
 * pages whose `sourceRange`s are BODY-relative (the TOC prefix is never part of
 * the Editor's content), optionally with a colophon after `colophonAfterBody`
 * Editor body pages.
 */
function fakeLayout(input: {
  tocPageCount: number;
  bodyRanges: Array<{ start: number; end: number }>;
  colophonAfterBody?: number;
}): V2PreviewLayout {
  const pageSequence: PhysicalPageRef[] = [];
  const pages: V2PreviewPage[] = [];
  const tocPages: V2PreviewPage[] = [];
  const bodyPages: V2PreviewPage[] = [];
  const pushColophon = () => {
    pageSequence.push({ kind: "colophon", index: 0 });
    const physicalIndex = pageSequence.length - 1;
    pages.push({ physicalIndex, physicalPageNumber: physicalIndex + 1, kind: "colophon", imageIds: [] });
  };
  for (let i = 0; i < input.tocPageCount; i += 1) {
    pageSequence.push({ kind: "body", index: i });
    const physicalIndex = pageSequence.length - 1;
    const page: V2PreviewPage = { physicalIndex, physicalPageNumber: physicalIndex + 1, kind: "toc", canonicalBodyIndex: i, imageIds: [] };
    pages.push(page);
    tocPages.push(page);
  }
  input.bodyRanges.forEach((range, bodyIndex) => {
    if (input.colophonAfterBody === bodyIndex) pushColophon();
    const canonicalBodyIndex = input.tocPageCount + bodyIndex;
    pageSequence.push({ kind: "body", index: canonicalBodyIndex });
    const physicalIndex = pageSequence.length - 1;
    const page: V2PreviewPage = {
      physicalIndex,
      physicalPageNumber: physicalIndex + 1,
      kind: "body",
      bodyIndex,
      bodyPageNumber: bodyIndex + 1,
      canonicalBodyIndex,
      sourceRange: { ...range },
      imageIds: [],
    };
    pages.push(page);
    bodyPages.push(page);
  });
  if (input.colophonAfterBody === input.bodyRanges.length) pushColophon();
  return {
    layoutId: 1,
    pageSequence,
    pageModel: {
      sourceContent: "",
      pages,
      bodyPages,
      tocPages,
      bodyPageCount: bodyPages.length,
      listLength: Math.max(bodyPages.length, 1),
      overlayPages: bodyPages.map(() => ({ tokens: [], columns: null, lines: [], columnLines: null })),
      bodySourceRanges: bodyPages.map((page) => page.sourceRange!),
      imagePageIndicesById: new Map(),
    },
  };
}

/** Body ranges splitting `content` at the given offsets (each offset starts a new body page). */
function rangesAt(content: string, starts: number[]): Array<{ start: number; end: number }> {
  const bounds = [0, ...starts.filter((offset) => offset > 0), content.length];
  return bounds.slice(0, -1).map((start, index) => ({ start, end: bounds[index + 1] }));
}

describe("computeTocItemsWithV2", () => {
  it("counts the TOC's own page: body headings land on physical pages after it", async () => {
    const content = "# 一章\n本文\n# 二章\n本文";
    const seen: TocItem[][] = [];
    const items = await computeTocItemsWithV2({
      content,
      nombreStart: 1,
      compose: async (candidate) => {
        seen.push(candidate.map((item) => ({ ...item })));
        return fakeLayout({ tocPageCount: 1, bodyRanges: rangesAt(content, [content.indexOf("# 二章")]) });
      },
    });

    // TOC = physical 1, 一章 = body 1 = physical 2, 二章 = body 2 = physical 3.
    expect(items).toEqual([
      { title: "一章", pageNumber: 2 },
      { title: "二章", pageNumber: 3 },
    ]);
    // Every candidate handed to V2 is the work-owned TOC data (titles), never body text.
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen.every((candidate) => candidate.map((item) => item.title).join() === "一章,二章")).toBe(true);
    expect(seen[seen.length - 1]).toEqual(items);
  });

  it("uses V2 physical page numbers, so a mid-book horizontal colophon shifts later chapters", async () => {
    const content = "# 一章\n本文\n# 二章\n本文";
    const items = await computeTocItemsWithV2({
      content,
      nombreStart: 1,
      compose: async () =>
        fakeLayout({ tocPageCount: 1, bodyRanges: rangesAt(content, [content.indexOf("# 二章")]), colophonAfterBody: 1 }),
    });
    // TOC p1, 一章 p2, colophon p3, 二章 p4.
    expect(items).toEqual([
      { title: "一章", pageNumber: 2 },
      { title: "二章", pageNumber: 4 },
    ]);
  });

  it("re-composes until stable when the TOC's own page count depends on its numbers", async () => {
    // 9 body pages; 二章 starts body page 9. A TOC that prints any 2-digit
    // number needs 2 pages in this fake, which pushes every chapter one page later.
    const filler = Array.from({ length: 8 }, (_, i) => `頁${i}\n`).join("");
    const content = `# 一章\n${filler}# 二章\n終`;
    const pageStarts: number[] = [];
    let offset = content.indexOf("頁0");
    for (let i = 0; i < 8; i += 1) {
      pageStarts.push(offset);
      offset = content.indexOf("\n", offset) + 1;
    }
    pageStarts.push(content.indexOf("# 二章"));
    // Merge: body page 0 = 一章 + 頁0 … keep 9 body pages total.
    const bodyStarts = pageStarts.slice(1);
    let composeCount = 0;
    const items = await computeTocItemsWithV2({
      content,
      nombreStart: 1,
      compose: async (candidate) => {
        composeCount += 1;
        const tocPageCount = candidate.some((item) => item.pageNumber >= 10) ? 2 : 1;
        return fakeLayout({ tocPageCount, bodyRanges: rangesAt(content, bodyStarts) });
      },
    });
    // Round 1 (placeholder numbers, 1-page TOC): 2, 10 → round 2 (2-page TOC): 3, 11 → stable.
    expect(items).toEqual([
      { title: "一章", pageNumber: 3 },
      { title: "二章", pageNumber: 11 },
    ]);
    expect(composeCount).toBe(3);
  });

  it("applies nombreStart to the V2 physical page", async () => {
    const content = "# 章\n本文";
    const items = await computeTocItemsWithV2({
      content,
      nombreStart: 5,
      compose: async () => fakeLayout({ tocPageCount: 1, bodyRanges: rangesAt(content, []) }),
    });
    // 章 = physical 2 → displayed 5 + 2 - 1.
    expect(items).toEqual([{ title: "章", pageNumber: 6 }]);
  });

  it("returns no entries (and never composes) when the manuscript has no headings", async () => {
    let composed = false;
    const items = await computeTocItemsWithV2({
      content: "本文だけ",
      nombreStart: 1,
      compose: async () => {
        composed = true;
        return fakeLayout({ tocPageCount: 0, bodyRanges: [] });
      },
    });
    expect(items).toEqual([]);
    expect(composed).toBe(false);
  });
});
