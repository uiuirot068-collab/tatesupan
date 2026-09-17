import type { PdfExportMode } from "@/utils/exportPdf";

/**
 * The one and only state transition for "which PDF mode's `?` help panel is
 * open." Every `?` click routes through this single pure function -- there
 * is no parallel hover/focus/blur path that can also open or close it, so
 * those can never race one another (TSP-UX-V3-LOOP1-CORRECTION-011: the
 * hover flicker, the "unselected option's `?` won't open reliably," and the
 * "mobile tap closes immediately" bugs all traced back to hover/focus/blur
 * triggers fighting this same state from the side).
 *
 * Deliberately independent of radio selection: `target` is just the option
 * whose `?` was activated, never compared against the checked `pdfMode`.
 */
export function toggleHelp(
  current: PdfExportMode | null,
  target: PdfExportMode
): PdfExportMode | null {
  return current === target ? null : target;
}
