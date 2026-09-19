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
}): { totalPages: number } | null {
  if (params.scope !== "all") return null;
  // 奥付ページ（ON のとき）も物理的な1枚なので総数へ含める。
  const totalPages = params.bodyPageCount + (params.includeColophon ? 1 : 0);
  return totalPages % 2 !== 0 ? { totalPages } : null;
}
