/**
 * V2 page-index vocabulary — the ONE place Preview/export convert between
 * the Editor's BODY page index and V2's PHYSICAL publication page index.
 *
 * - body index: 0-based position among manuscript body pages only (what the
 *   Preview page list, selection, image-break warnings and JPG file names use).
 * - physical index: 0-based position in `CanonicalDocument.pageSequence`, the
 *   final publication order Core decided (body pages + the colophon wherever
 *   `resolveColophonInsertion` put it). PaintPlan pages are in this order.
 *
 * Pure lookups over Core's own `pageSequence`; this module never re-derives
 * pagination or colophon placement. -1 means "no such canonical page" and
 * callers must fail closed (never export a guessed page).
 */
import type { PhysicalPageRef } from "../../../typesetting-v2/core/layout/schema";

export function physicalIndexForBodyIndex(pageSequence: readonly PhysicalPageRef[] | undefined, bodyIndex: number): number {
  return pageSequence?.findIndex((ref) => ref.kind === "body" && ref.index === bodyIndex) ?? -1;
}

export function colophonPhysicalIndex(pageSequence: readonly PhysicalPageRef[] | undefined): number {
  return pageSequence?.findIndex((ref) => ref.kind === "colophon") ?? -1;
}

/**
 * Physical PaintPlan indices for a PDF export: every canonical page for
 * `scope: "all"`, otherwise the selected body pages (+ the colophon when
 * requested), de-duplicated and in publication order. An unresolvable body
 * index stays -1 so the caller's "could not resolve" guard fires.
 */
export function resolvePdfPhysicalIndices(input: {
  pageSequence: readonly PhysicalPageRef[] | undefined;
  planLength: number;
  scope: "all" | "selected";
  bodyIndices: readonly number[];
  includeColophon: boolean;
}): number[] {
  const indices = input.scope === "all"
    ? Array.from({ length: input.planLength }, (_, index) => index)
    : input.bodyIndices.map((bodyIndex) => physicalIndexForBodyIndex(input.pageSequence, bodyIndex));
  if (input.scope === "selected" && input.includeColophon) {
    const colophon = colophonPhysicalIndex(input.pageSequence);
    if (colophon >= 0) indices.push(colophon);
  }
  return Array.from(new Set(indices)).sort((a, b) => a - b);
}
