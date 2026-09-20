/**
 * TSP-UX-V3-LOOP3-MOBILE-SHARED-EXPORT: the single source of truth for the
 * 「書き出し」menu's DATA (ids, labels, order, availability). The desktop
 * dropdown inside PreviewPane's header and the phone Editor-view export sheet
 * BOTH render this list (PreviewPane attaches its own handlers to it in one
 * place), so a second, drifting copy of the export menu cannot exist.
 *
 * Pure data with no React/DOM imports so it is unit-testable in this repo's
 * Node-only vitest environment. Handlers are deliberately NOT passed in here:
 * they read refs, and handing them to a function during render trips the
 * react-hooks/refs rule -- PreviewPane maps `id -> handler` itself.
 */
export type ExportMenuEntryId = "jpg" | "jpg-batch" | "jpg-zip" | "colophon-jpg" | "pdf";

export interface ExportMenuEntryDescriptor {
  id: ExportMenuEntryId;
  label: string;
  disabled?: boolean;
  /** Tooltip explaining why the entry is disabled. */
  disabledReason?: string;
}

/** Shown wherever PDF is unavailable (Web閲覧用 px paper presets). */
export const PDF_UNAVAILABLE_NOTE =
  "PDF書き出しは印刷用の用紙サイズで利用できます。 Web閲覧用はJPGで書き出してください。";
export const PDF_UNAVAILABLE_TITLE =
  "PDF書き出しは印刷用の用紙サイズで利用できます。Web閲覧用はJPGで書き出してください。";

export function describeExportMenu(params: {
  showColophon: boolean;
  /** `layout.paper.isPx` -- Web閲覧用 presets cannot export PDF. */
  pdfUnavailable: boolean;
}): ExportMenuEntryDescriptor[] {
  const { showColophon, pdfUnavailable } = params;
  return [
    { id: "jpg", label: "JPG" },
    { id: "jpg-batch", label: "JPG一括（個別ダウンロード）" },
    { id: "jpg-zip", label: "JPG ZIP" },
    ...(showColophon ? [{ id: "colophon-jpg" as const, label: "奥付ページ（JPG）" }] : []),
    {
      id: "pdf",
      label: "PDF",
      disabled: pdfUnavailable,
      disabledReason: pdfUnavailable ? PDF_UNAVAILABLE_TITLE : undefined,
    },
  ];
}
