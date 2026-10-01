/**
 * Canonical V2 Preview page model (Phase 5) — a VIEW over an already-composed
 * V2 layout, never a second paginator. Everything here is read from Core's
 * `pageSequence`, its placed atoms, the IMAGE units and the adapter's
 * flow→raw source map.
 *
 * In V2 mode the Preview's page list, page count, colophon slot, selection,
 * export scope, image-warning pages, caret→page mapping, page reorder and
 * image insertion point all come from this one model, so they agree with the
 * pages JPG/ZIP/PDF export. (LEGACY mode keeps `paginateTokens`.)
 *
 * Image ownership follows the V2 flow model (Phase 5 product decision): an
 * image is a layout unit; if it does not fit on the current page it belongs
 * to the NEXT page. The LEGACY "trailing image stays on the previous page"
 * rule is intentionally not reproduced.
 */
import type { TategakiPage, TategakiToken } from "../tategaki";
import type { V2LayoutResult } from "./composeV2Document";
import { mmToTicks } from "../../../typesetting-v2/core/geometry/tick";
import type { CanonicalPage } from "../../../typesetting-v2/core/layout/schema";
import type { LogicalUnit } from "../../../typesetting-v2/core/units";
import { bodyPageNumber, physicalPageNumber } from "./pageIndex";

export interface SourceRange {
  start: number;
  end: number;
}

export interface V2PreviewPage {
  /** 0-based position in the publication (= PaintPlan index). */
  physicalIndex: number;
  physicalPageNumber: number;
  kind: "body" | "toc" | "colophon";
  /** Editable body pages only: 0-based Editor body index / 1-based body page number. */
  bodyIndex?: number;
  bodyPageNumber?: number;
  /** Canonical Core body-page index. TOC pages occupy canonical body pages too. */
  canonicalBodyIndex?: number;
  /** Body pages only: raw manuscript [start, end) this page renders (UTF-16 offsets). */
  sourceRange?: SourceRange;
  /** Editor image ids whose IMG marker this page owns (V2 flow ownership). */
  imageIds: string[];
}

export interface V2PreviewPageModel {
  /** The manuscript the layout was composed from — every `sourceRange` indexes THIS string. */
  sourceContent: string;
  /** Publication (physical) order: body pages and the colophon wherever Core placed it. */
  pages: V2PreviewPage[];
  /** Editable body pages in Editor order (synthetic TOC excluded). */
  bodyPages: V2PreviewPage[];
  /** Synthetic TOC pages in physical order. */
  tocPages: V2PreviewPage[];
  /** Editable body page count (0 for an empty manuscript). */
  bodyPageCount: number;
  /** Preview list length: at least one card, so an empty manuscript keeps its blank page. */
  listLength: number;
  /** Per list index: the page's image tokens only (what PageCard overlays need), stable per model. */
  overlayPages: TategakiPage[];
  /** Per list index: raw source range (an empty manuscript maps to the whole text). */
  bodySourceRanges: SourceRange[];
  /** Editor image id → body indices of the page(s) owning its marker. */
  imagePageIndicesById: Map<string, number[]>;
}

type ImageUnit = Extract<LogicalUnit, { kind: "IMAGE" }>;

const TICKS_PER_MM = mmToTicks(1);

function placedSpans(page: CanonicalPage) {
  return page.columns.flatMap((column) => column.lines.flatMap((line) => line.placedUnits.map((unit) => unit.sourceSpan)));
}

/** Keeps a page's own 傍点 markers with it (they produce no flow text). */
function includeBoutenMarkers(content: string, range: SourceRange): SourceRange {
  let { start, end } = range;
  while (start >= 2 && content.startsWith("《《", start - 2)) start -= 2;
  while (content.startsWith("》》", end)) end += 2;
  return { start, end };
}

function imageToken(unit: ImageUnit): Extract<TategakiToken, { type: "image" }> {
  return {
    type: "image",
    id: unit.refId,
    widthMm: unit.intrinsicWidth / TICKS_PER_MM,
    heightMm: unit.intrinsicHeight / TICKS_PER_MM,
    position: unit.placement.toLowerCase() as "top" | "center" | "bottom" | "full",
  };
}

export function buildV2PreviewPageModel(layout: V2LayoutResult, sourceContent: string): V2PreviewPageModel {
  const { rawStart, rawEnd } = layout.bodySourceMap;
  const imageByFlowStart = new Map<number, ImageUnit>();
  for (const unit of layout.units) if (unit.kind === "IMAGE") imageByFlowStart.set(unit.span.start, unit);

  const pages: V2PreviewPage[] = [];
  const bodyPages: V2PreviewPage[] = [];
  const tocPages: V2PreviewPage[] = [];
  const overlayPages: TategakiPage[] = [];
  const bodySourceRanges: SourceRange[] = [];
  const imagePageIndicesById = new Map<string, number[]>();
  // The ONE TOC placement composeV2Layout also hands to page furniture — so
  // Preview, export and furniture agree page-for-page. Raw offsets inside the
  // composed source map back to the Editor's body `content` by removing the
  // spliced, composition-only TOC text.
  const toc = layout.toc;
  const tocFirst = toc?.firstCanonicalPage ?? 0;
  const tocEnd = toc ? toc.firstCanonicalPage + toc.pageCount : 0;
  const toBodyOffset = (raw: number): number => {
    if (!toc || raw <= toc.rawOffset) return raw;
    if (raw >= toc.rawOffset + toc.rawLength) return raw - toc.rawLength;
    return toc.rawOffset;
  };
  let previousEnd = 0;
  let editorBodyIndex = 0;

  layout.document.pageSequence.forEach((ref, physicalIndex) => {
    if (ref.kind === "colophon") {
      pages.push({ physicalIndex, physicalPageNumber: physicalPageNumber(physicalIndex), kind: "colophon", imageIds: [] });
      return;
    }
    const canonicalBodyIndex = ref.index;
    if (toc && canonicalBodyIndex >= tocFirst && canonicalBodyIndex < tocEnd) {
      const entry: V2PreviewPage = {
        physicalIndex,
        physicalPageNumber: physicalPageNumber(physicalIndex),
        kind: "toc",
        canonicalBodyIndex,
        imageIds: [],
      };
      pages.push(entry);
      tocPages.push(entry);
      return;
    }
    let start = Number.POSITIVE_INFINITY;
    let end = Number.NEGATIVE_INFINITY;
    const images: ImageUnit[] = [];
    for (const span of placedSpans(layout.document.pages[canonicalBodyIndex])) {
      if (span.start >= rawStart.length) continue; // appended ruby readings are never placed; defensive
      start = Math.min(start, rawStart[span.start]);
      end = Math.max(end, rawEnd[Math.min(span.end, rawEnd.length) - 1]);
      const image = imageByFlowStart.get(span.start);
      if (image && span.end - span.start === 1) images.push(image);
    }
    const adjusted = Number.isFinite(start)
      ? { start: toBodyOffset(start), end: toBodyOffset(end) }
      : { start: previousEnd, end: previousEnd };
    previousEnd = adjusted.end;

    const sourceRange = includeBoutenMarkers(sourceContent, adjusted);
    const imageIds = images.map((image) => image.refId);
    imageIds.forEach((id) => imagePageIndicesById.set(id, [...(imagePageIndicesById.get(id) ?? []), editorBodyIndex]));
    const entry: V2PreviewPage = {
      physicalIndex,
      physicalPageNumber: physicalPageNumber(physicalIndex),
      kind: "body",
      bodyIndex: editorBodyIndex,
      bodyPageNumber: bodyPageNumber(editorBodyIndex),
      canonicalBodyIndex,
      sourceRange,
      imageIds,
    };
    pages.push(entry);
    bodyPages[editorBodyIndex] = entry;
    overlayPages[editorBodyIndex] = { tokens: images.map(imageToken), columns: null, lines: [], columnLines: null };
    bodySourceRanges[editorBodyIndex] = sourceRange;
    editorBodyIndex += 1;
  });

  const bodyPageCount = bodyPages.length;
  if (bodyPageCount === 0) {
    overlayPages.push({ tokens: [], columns: null, lines: [], columnLines: null });
    bodySourceRanges.push({ start: 0, end: sourceContent.length });
  }
  return {
    sourceContent,
    pages,
    bodyPages,
    tocPages,
    bodyPageCount,
    listLength: Math.max(bodyPageCount, 1),
    overlayPages,
    bodySourceRanges,
    imagePageIndicesById,
  };
}
