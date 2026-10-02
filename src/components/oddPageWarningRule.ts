/**
 * TSP-UX-V3-LOOP2-ODD-PAGE-012: the exact trigger condition the old
 * `window.confirm` used, pulled out as a pure function so it's testable
 * without mounting PreviewPane. Deliberately preserves the original scope:
 * only whole-book ("all") exports are ever checked -- a selected-page PDF
 * has no bearing on whether the *book* binds evenly, so it's never warned.
 */
export function shouldWarnOddPageExport(params: {
  scope: "all" | "selected";
  bodyPageCount: number;
  includeColophon: boolean;
  /**
   * Phase 11: work-owned TOC pages (V2 synthetic pages before the body).
   * They are real printed sheets in an all-pages PDF, so they count toward
   * the binding total. Omitted / 0 for works without a TOC (unchanged result).
   */
  tocPageCount?: number;
  /**
   * TSP-PHASE13-001: pages the colophon actually occupies (V2 can lay a long
   * colophon over several pages). Omitted = 1, the historical assumption.
   */
  colophonPageCount?: number;
}): { totalPages: number } | null {
  if (params.scope !== "all") return null;
  const totalPages = exportTotalPageCount(params);
  return totalPages % 2 !== 0 ? { totalPages } : null;
}

/** Physical pages of a whole-book export: body + colophon (when ON) + TOC. */
export function exportTotalPageCount(params: {
  bodyPageCount: number;
  includeColophon: boolean;
  tocPageCount?: number;
  colophonPageCount?: number;
}): number {
  // 奥付ページ（ON のとき）・目次ページも物理的な1枚なので総数へ含める。
  const tocPages = Math.max(0, Math.trunc(params.tocPageCount ?? 0));
  const colophonPages = params.includeColophon ? Math.max(1, Math.trunc(params.colophonPageCount ?? 1)) : 0;
  return params.bodyPageCount + colophonPages + tocPages;
}
