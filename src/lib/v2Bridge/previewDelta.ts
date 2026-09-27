/**
 * Phase 9: Preview paint pages sent as a delta against the Preview the main
 * thread already shows.
 *
 * After Phase 8 the layout reply was almost entirely Preview paint geometry
 * (~8 MB per 100 pages), cloned on every layout although a one-character
 * edit changes one or a few pages. Now:
 *
 *  - The main thread tells the worker which layout it currently shows
 *    (`basePreviewLayoutId`: the layoutId of the applied Preview), or none.
 *  - The worker keeps the Preview documents it recently sent. If it still
 *    holds that base, each new page that is structurally equal
 *    (`samePaintPage`) to a base page is sent as that page's index; only the
 *    other pages are sent. Otherwise it sends a full snapshot.
 *  - The main thread rebuilds the document from its base (reused pages keep
 *    their object identity, so PageCard's memo skips them for free). A delta
 *    whose base is not the Preview it holds is rejected, and the adapter asks
 *    again for a full snapshot.
 *
 * Full snapshots: the first layout, a new worker, a document switch (the
 * adapter sends no base), a different page size or font size (every page
 * changes), and a delta that would reuse nothing.
 *
 * Correctness never depends on the matching heuristic: a page is reused only
 * when it is structurally equal to the new one, so the rebuilt document is
 * always equal to the full one (previewDelta.test.ts).
 */
import type { PaintDocument, PaintPage } from "../../../typesetting-v2/renderer/preview/paintModel";
import { samePaintPage } from "./paintPageEquality";

/** A new page, or the index of the base page (same list) that is equal to it. */
export type PreviewPageSlot = PaintPage | number;

export type PreviewDocumentMeta = Omit<PaintDocument, "pages" | "colophonPages">;

export type PreviewTransfer =
  | { kind: "full"; document: PaintDocument }
  | {
      kind: "delta";
      baseLayoutId: number;
      meta: PreviewDocumentMeta;
      pages: PreviewPageSlot[];
      colophonPages?: PreviewPageSlot[];
    };

export interface KeptPreview {
  layoutId: number;
  document: PaintDocument;
}

function metaOf(document: PaintDocument): PreviewDocumentMeta {
  const meta: Partial<PaintDocument> = { ...document };
  delete meta.pages;
  delete meta.colophonPages;
  return meta as PreviewDocumentMeta;
}

function sameGeometry(a: PaintDocument, b: PaintDocument): boolean {
  const pa = a.pages[0];
  const pb = b.pages[0];
  return a.fontSizePx === b.fontSizePx && (!pa || !pb || (pa.widthPx === pb.widthPx && pa.heightPx === pb.heightPx));
}

/**
 * Candidates for new page `i`: the base page at the same index, then the one
 * at the same distance from the end (pages after an insertion or removal).
 */
function encodePages(next: readonly PaintPage[], base: readonly PaintPage[]): { slots: PreviewPageSlot[]; reused: number } {
  const shift = base.length - next.length;
  let reused = 0;
  const slots = next.map((page, i): PreviewPageSlot => {
    for (const candidate of shift === 0 ? [i] : [i, i + shift]) {
      if (candidate >= 0 && candidate < base.length && samePaintPage(page, base[candidate])) {
        reused += 1;
        return candidate;
      }
    }
    return page;
  });
  return { slots, reused };
}

export function encodePreviewTransfer(next: PaintDocument, base: KeptPreview | null): PreviewTransfer {
  if (!base || !sameGeometry(next, base.document)) return { kind: "full", document: next };
  const pages = encodePages(next.pages, base.document.pages);
  const colophon = next.colophonPages ? encodePages(next.colophonPages, base.document.colophonPages ?? []) : null;
  if (pages.reused + (colophon?.reused ?? 0) === 0) return { kind: "full", document: next };
  return {
    kind: "delta",
    baseLayoutId: base.layoutId,
    meta: metaOf(next),
    pages: pages.slots,
    ...(colophon ? { colophonPages: colophon.slots } : {}),
  };
}

/** The document a transfer describes, or null when it is a delta against another base (stale). */
export function applyPreviewTransfer(transfer: PreviewTransfer, current: KeptPreview | null): PaintDocument | null {
  if (transfer.kind === "full") return transfer.document;
  if (!current || current.layoutId !== transfer.baseLayoutId) return null;
  const rebuild = (slots: readonly PreviewPageSlot[], base: readonly PaintPage[] | undefined): PaintPage[] | null => {
    const pages: PaintPage[] = [];
    for (const slot of slots) {
      const page = typeof slot === "number" ? base?.[slot] : slot;
      if (!page) return null;
      pages.push(page);
    }
    return pages;
  };
  const pages = rebuild(transfer.pages, current.document.pages);
  const colophonPages = transfer.colophonPages ? rebuild(transfer.colophonPages, current.document.colophonPages) : undefined;
  if (!pages || colophonPages === null) return null;
  return { ...transfer.meta, pages, ...(colophonPages ? { colophonPages } : {}) };
}

/** Diagnostics (tests, benchmark, E2E probe). */
export function previewTransferStats(transfer: PreviewTransfer): { kind: PreviewTransfer["kind"]; pagesSent: number; pagesReused: number } {
  if (transfer.kind === "full") {
    return { kind: "full", pagesSent: transfer.document.pages.length + (transfer.document.colophonPages?.length ?? 0), pagesReused: 0 };
  }
  const slots = [...transfer.pages, ...(transfer.colophonPages ?? [])];
  const pagesReused = slots.filter((slot) => typeof slot === "number").length;
  return { kind: "delta", pagesSent: slots.length - pagesReused, pagesReused };
}
