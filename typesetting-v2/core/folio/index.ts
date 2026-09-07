// Folio (ノンブル/page number) generation — Contract §15 page-decoration
// layer. Human Visual QA HOLD round 21 (P3-O08 final-page completion,
// Step 1B).
//
// Ported field names/defaults/semantics VERBATIM from the already-shipped
// legacy `src/lib/pageLayout.ts`'s `MasterPageSettings`
// (`nombreStart`/`hideNombreOnFirstPage`/`nombrePosition`,
// `DEFAULT_MASTER_PAGE_SETTINGS`) — never re-derived or guessed. Legacy's
// fuller contract (per-page `hideNombre` override, `nombreBottomMargin`,
// `nombreFontSize`/`nombreFontFamily`, `showHiddenNombre`, gutter/outer
// physical resolution) is real but out of this round's own scope — see
// `qa/evidence/P3_O08_FOLIO_HEADER_CORE_CONTRACT.md` for the full
// recorded audit and what remains a genuine open Human/Product decision
// (gutter/outer physical-side resolution specifically).
//
// This module owns WHAT text/semantic-position each page gets — never
// physical mm/pt coordinates (Core does not own paper geometry, see
// `core/layout/schema.ts`'s own `GeneratedPageFurniture` doc comment).

import type { GeneratedPageFurniture } from "../layout/schema";

export interface FolioSettings {
  // Matches legacy `MasterPageSettings.nombreStart` exactly (1-based).
  nombreStart: number;
  // Matches legacy `MasterPageSettings.hideNombreOnFirstPage` exactly.
  hideNombreOnFirstPage: boolean;
  // Matches legacy `MasterPageSettings.nombrePosition`, restricted to
  // "center" this round (see this file's own header comment) — the
  // type itself still carries the full `FolioPosition` union so a
  // future round adding gutter/outer resolution needs no schema change.
  position: "center";
}

// Matches legacy `DEFAULT_MASTER_PAGE_SETTINGS`'s own folio-relevant
// fields exactly (`nombreStart: 1`, `hideNombreOnFirstPage: false`,
// `nombrePosition: "center"`).
export const DEFAULT_FOLIO_SETTINGS: FolioSettings = {
  nombreStart: 1,
  hideNombreOnFirstPage: false,
  position: "center",
};

/**
 * `pageIndex` is 0-based (matches `CanonicalPage.order`'s own
 * convention). Suppression (legacy `hideNombreOnFirstPage`) is
 * represented by returning `undefined` — the SAME optional-field
 * convention `CanonicalPage.folio` already uses; there is no separate
 * "hidden" flag on the generated furniture itself.
 */
export function composeFolioForPage(pageIndex: number, settings: FolioSettings): GeneratedPageFurniture | undefined {
  if (pageIndex === 0 && settings.hideNombreOnFirstPage) return undefined;
  const displayNumber = settings.nombreStart + pageIndex;
  return { text: String(displayNumber), position: settings.position };
}
