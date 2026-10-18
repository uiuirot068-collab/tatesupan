import { coreContentRange } from "@/utils/tocGenerator";
import type { V2PreviewPageModel } from "./previewPageModel";

/**
 * TSP-PRINT-002 (P4-4): the Editor body pages a book part (扉・縦の奥付)
 * inserted at the manuscript start or end occupies, counted on the V2 page
 * model Preview and export print — not on the LEGACY character-grid
 * paginator (`computeInsertedPartPageRange`), which does not know full-page
 * images and so hid the ノンブル/柱 of the wrong pages.
 *
 * `model` must be composed from `finalContent` (the manuscript with the part
 * already inserted). Returns 1-based Editor body page numbers — the keys of
 * `PageSettings.pageOverrides` — or null when the part has no content.
 */
export function insertedPartBodyPagesFromV2(
  model: Pick<V2PreviewPageModel, "bodyPages">,
  finalContent: string,
  insertedText: string,
  position: "start" | "end"
): number[] | null {
  const core = coreContentRange(insertedText);
  if (core.end <= core.start) return null;
  const insertOffset = position === "start" ? 0 : finalContent.length - insertedText.length;
  const start = insertOffset + core.start;
  const end = insertOffset + core.end;
  const pages: number[] = [];
  for (const page of model.bodyPages) {
    const range = page.sourceRange;
    if (!range || page.bodyIndex === undefined || range.end <= range.start) continue;
    if (range.start < end && range.end > start) pages.push(page.bodyIndex + 1);
  }
  return pages.length > 0 ? pages : null;
}
