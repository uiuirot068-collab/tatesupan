// Folio (ノンブル/page number) generation — Contract §15 page-decoration
// layer. Human Visual QA HOLD round 21/22 (P3-O08 final-page completion,
// Steps 1B/1C).
//
// Ported field names/defaults/semantics VERBATIM from the already-shipped
// legacy `src/lib/pageLayout.ts`'s `MasterPageSettings`
// (`nombreStart`/`hideNombreOnFirstPage`/`nombrePosition`,
// `DEFAULT_MASTER_PAGE_SETTINGS`) and `src/components/PageCard.tsx`'s own
// parity resolution (`isOddPage`, `sheetStyle`'s padding logic, and
// `NombreOverlay`'s own `anchoredSide` logic) — never re-derived or
// guessed. Legacy's fuller contract (per-page `hideNombre` override,
// `nombreBottomMargin`, `nombreFontSize`/`nombreFontFamily`,
// `showHiddenNombre`) is real but out of this round's own scope — see
// `qa/evidence/P3_O08_FOLIO_HEADER_CORE_CONTRACT.md` and
// `qa/evidence/P3_O08_FOLIO_HEADER_COMPLETE_CONTRACT.md` for the full
// recorded audit.
//
// This module owns WHAT text/resolved-side each page gets — never
// physical mm/pt coordinates (Core does not own paper geometry, see
// `core/layout/schema.ts`'s own `GeneratedPageFurniture` doc comment).

import type { FolioPosition, GeneratedPageFurniture, ResolvedFolioPosition } from "../layout/schema";

export interface FolioSettings {
  // Matches legacy `MasterPageSettings.nombreStart` exactly (1-based).
  nombreStart: number;
  // Matches legacy `MasterPageSettings.hideNombreOnFirstPage` exactly.
  hideNombreOnFirstPage: boolean;
  // Matches legacy `MasterPageSettings.nombrePosition` (minus "hidden",
  // represented by `composeFolioForPage` returning `undefined`).
  position: FolioPosition;
}

// Matches legacy `DEFAULT_MASTER_PAGE_SETTINGS`'s own folio-relevant
// fields exactly (`nombreStart: 1`, `hideNombreOnFirstPage: false`,
// `nombrePosition: "center"`).
export const DEFAULT_FOLIO_SETTINGS: FolioSettings = {
  nombreStart: 1,
  hideNombreOnFirstPage: false,
  position: "center",
};

// Ported VERBATIM from `src/components/PageCard.tsx:335`
// (`isOddPage = pageNumber % 2 === 1`) and its own `sheetStyle`
// (:357-363) / `NombreOverlay`'s `anchoredSide` (:1384-1391) logic,
// cross-checked identical in both places: right-bound (右綴じ) tategaki
// convention — an odd page (recto) is the LEFT side of a spread
// (小口/outer=left, ノド/gutter=right); an even page (verso) mirrors.
export function resolveFolioPhysicalSide(position: FolioPosition, isOddPage: boolean): ResolvedFolioPosition {
  if (position === "center") return "center";
  if (position === "outer") return isOddPage ? "left" : "right";
  return isOddPage ? "right" : "left"; // "gutter"
}

/**
 * `pageIndex` is 0-based (matches `CanonicalPage.order`'s own
 * convention); legacy's own `pageNumber` (1-based, `isOddPage`'s own
 * input) is `pageIndex + 1`. Suppression (legacy
 * `hideNombreOnFirstPage`) is represented by returning `undefined` —
 * the SAME optional-field convention `CanonicalPage.folio` already
 * uses; there is no separate "hidden" flag on the generated furniture
 * itself.
 */
export function composeFolioForPage(pageIndex: number, settings: FolioSettings): GeneratedPageFurniture | undefined {
  if (pageIndex === 0 && settings.hideNombreOnFirstPage) return undefined;
  const pageNumber = pageIndex + 1;
  const isOddPage = pageNumber % 2 === 1;
  const displayNumber = settings.nombreStart + pageIndex;
  return { text: String(displayNumber), position: resolveFolioPhysicalSide(settings.position, isOddPage) };
}
