import { extractHeadingOffsets, type TocItem } from "@/utils/tocGenerator";
import type { V2PreviewLayout } from "./previewWorkerProtocol";

export interface ComputeV2TocItemsInput {
  content: string;
  nombreStart: number;
  compose: (items: TocItem[]) => Promise<V2PreviewLayout>;
}

function physicalPageForSourceOffset(layout: V2PreviewLayout, sourceOffset: number): number {
  const pages = layout.pageModel.bodyPages;
  for (const page of pages) {
    const range = page.sourceRange;
    if (!range) continue;
    if (sourceOffset >= range.start && sourceOffset < range.end) {
      return page.physicalPageNumber;
    }
  }

  // A heading can land exactly on a page boundary. Prefer the page whose
  // range starts there, otherwise fail closed to the nearest preceding body
  // page rather than inventing a LEGACY page number.
  const exact = pages.find((page) => page.sourceRange?.start === sourceOffset);
  if (exact) return exact.physicalPageNumber;

  const preceding = [...pages]
    .reverse()
    .find((page) => (page.sourceRange?.end ?? -1) <= sourceOffset);
  return preceding?.physicalPageNumber ?? pages[0]?.physicalPageNumber ?? 1;
}

/**
 * Canonical TOC page-number calculation.
 *
 * The TOC is inserted at the manuscript start, so it changes pagination.
 * Recompose the candidate manuscript until the generated page numbers stop
 * changing. Page ownership comes from the same V2 pageModel Preview/export
 * use, including a mid-book horizontal colophon in physical page order.
 */
export async function computeTocItemsWithV2({
  content,
  nombreStart,
  compose,
}: ComputeV2TocItemsInput): Promise<TocItem[]> {
  const headings = extractHeadingOffsets(content);
  if (headings.length === 0) return [];

  const MAX_ITERATIONS = 5;
  let items: TocItem[] = headings.map((heading) => ({
    title: heading.title,
    pageNumber: nombreStart,
  }));

  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    const layout = await compose(items);

    const next = headings.map((heading) => {
      const physicalPage = physicalPageForSourceOffset(layout, heading.index);
      return {
        title: heading.title,
        pageNumber: nombreStart + physicalPage - 1,
      };
    });

    const stable = next.every((item, index) => item.pageNumber === items[index]?.pageNumber);
    items = next;
    if (stable) break;
  }

  return items;
}
