/**
 * Phase 11 Human-QA round 3: who decides a Preview page's ノンブル.
 *
 * V2 Preview pages carry Core's canonical `folio` (Core assigns it per
 * PHYSICAL page; `v2Bridge/pageFurniture.ts` then applies the Editor's
 * per-page「ノンブル非表示」and the synthetic TOC rule). PDF/JPG paint that same
 * folio, so in V2 mode the Preview follows it too — present or absent, and the
 * same number — instead of re-deciding visibility from PageCard props (which
 * let a stale `hideNombre` on the TOC card hide a folio PDF/JPG printed).
 *
 * LEGACY mode (no V2 page) keeps the established prop-based rule unchanged.
 */
export interface PreviewNombreInput {
  /** True when this card paints a V2 canonical page. */
  hasCanonicalPage: boolean;
  /** The canonical page's folio text (`CanonicalPage.folio.text`), undefined when Core/pageFurniture gave none. */
  canonicalFolioText: string | undefined;
  nombrePosition: string;
  hideNombre: boolean;
  hideNombreOnFirstPage: boolean;
  /** 1-based physical page number this card shows. */
  pageNumber: number;
  nombreStart: number;
}

export function resolvePreviewNombre(input: PreviewNombreInput): { show: boolean; value: number } {
  const derivedValue = input.nombreStart + input.pageNumber - 1;
  if (input.hasCanonicalPage) {
    const parsed = input.canonicalFolioText === undefined ? Number.NaN : Number(input.canonicalFolioText);
    return {
      show: input.canonicalFolioText !== undefined && input.nombrePosition !== "hidden",
      value: Number.isFinite(parsed) ? parsed : derivedValue,
    };
  }
  const suppressed = input.hideNombre || (input.hideNombreOnFirstPage && input.pageNumber === 1);
  return { show: input.nombrePosition !== "hidden" && !suppressed, value: derivedValue };
}
