/**
 * TSP-UX-V3-LOOP3-MOBILE-SHARED-EXPORT: on a phone, the Editor view keeps the
 * Preview mounted but `display:none` (`max-md:hidden`). The LEGACY renderer's
 * JPG/PDF capture measures the LIVE page-card geometry, so exporting from a
 * `display:none` subtree silently yields a 2x2px JPEG (measured on the
 * pre-Loop-3 build: 759 bytes vs 1135x1600 / 108,793 bytes when the Preview
 * is displayed). The export must therefore never depend on the Preview being
 * visible to the user: while an export is running and the Preview is not the
 * displayed phone workspace, the Preview section is given layout OFF-SCREEN
 * (fixed, far left of the viewport) -- invisible, non-interactive, and gone the
 * moment the export finishes. It changes nothing about which workspace the
 * user sees and never switches to the Preview.
 */
export type MobileWorkspace = "editor" | "preview";

/** Same `md` breakpoint as every `md:` / `max-md:` class in the Editor. */
export const PHONE_LAYOUT_MAX_WIDTH_PX = 767;

export function shouldStagePreviewForExport(params: {
  /** `useIsNarrowViewport()` -- the phone (`< md`) layout is active. */
  isNarrowViewport: boolean;
  mobileView: MobileWorkspace;
  /** An export (any format) is currently running. */
  exporting: boolean;
}): boolean {
  return params.exporting && params.isNarrowViewport && params.mobileView !== "preview";
}

/**
 * Applied to the Preview `<section>` while staged (phone only, every class is
 * `max-md:` scoped so desktop is untouched). `pointer-events-none` is
 * deliberately NOT used: pointer-events inherits, and the export progress
 * overlay lives inside the Preview subtree; it is `fixed`, so it stays on
 * screen while the section itself sits off-screen.
 */
export const PREVIEW_EXPORT_STAGE_CLASS =
  "max-md:fixed max-md:left-[-200vw] max-md:top-0 max-md:flex max-md:h-[100dvh] max-md:w-screen max-md:flex-col";
