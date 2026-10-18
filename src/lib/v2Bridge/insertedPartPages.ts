import { coreContentRange } from "@/utils/tocGenerator";
import { updatePageOverrides, type PageSettings } from "../pageLayout";
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

/**
 * TSP-PRINT-002 (QA 1): the hidden ノンブル/柱 follow a part that moved. The
 * pages were counted when the part was inserted; adding a full-page image
 * (or any text) before it later moves the part to another page, and the
 * page-number keyed overrides stayed behind on the old page. Given the
 * layout composed from `content`, each recorded part still at the start /
 * end of `content` is recounted, and its hide flags move from the old pages
 * to the new ones (each flag only if it was still set on the old pages, so
 * a page the writer un-hid by hand stays shown). A part no longer at its
 * place (edited or removed) is no longer followed; its pages stay as they
 * are. Returns null when nothing changes.
 */
export function followInsertedPartPages(
  settings: Pick<PageSettings, "pageOverrides" | "insertedParts">,
  content: string,
  model: Pick<V2PreviewPageModel, "bodyPages">
): Pick<PageSettings, "pageOverrides" | "insertedParts"> | null {
  const parts = settings.insertedParts;
  if (!parts || parts.length === 0) return null;
  let overrides = settings.pageOverrides;
  const nextParts: NonNullable<PageSettings["insertedParts"]> = [];
  let changed = false;
  for (const part of parts) {
    const inPlace = part.position === "start" ? content.startsWith(part.text) : content.endsWith(part.text);
    if (!inPlace) {
      changed = true;
      continue;
    }
    const pages = insertedPartBodyPagesFromV2(model, content, part.text, part.position);
    if (!pages || (pages.length === part.pages.length && pages.every((page, i) => page === part.pages[i]))) {
      nextParts.push(part);
      continue;
    }
    changed = true;
    const hideNombre = part.pages.some((page) => overrides[page]?.hideNombre);
    const hideHashira = part.pages.some((page) => overrides[page]?.hideHashira);
    const left = part.pages.filter((page) => !pages.includes(page));
    overrides = updatePageOverrides(overrides, left, (prev) => ({
      ...prev,
      ...(hideNombre ? { hideNombre: false } : {}),
      ...(hideHashira ? { hideHashira: false } : {}),
    }));
    overrides = updatePageOverrides(overrides, pages, (prev) => ({
      ...prev,
      ...(hideNombre ? { hideNombre: true } : {}),
      ...(hideHashira ? { hideHashira: true } : {}),
    }));
    nextParts.push({ ...part, pages });
  }
  return changed ? { pageOverrides: overrides, insertedParts: nextParts } : null;
}
