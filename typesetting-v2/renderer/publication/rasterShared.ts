// P3-O08 -- JPG Export, shared raster semantics (Human Visual QA HOLD
// round 32: browser production integration). Pure, environment-agnostic
// math/constants shared between the Node raster executor
// (`rasterGenerator.ts`, `@napi-rs/canvas`, Node/Vitest QA reference only)
// and the browser raster executor (`rasterGeneratorBrowser.ts`, native
// Canvas 2D, the real production path). Zero platform imports (no
// `@napi-rs/canvas`, no `Buffer`/`fs`/`path`, no DOM) -- safe to import
// from either environment, and the ONE place these numbers are defined,
// per this round's own "do not maintain two independent command
// interpreters" / "do not duplicate layout logic" instruction.

export const MM_PER_INCH = 25.4;

// Reuses the ONE real, cited Publication raster-quality precedent that
// exists anywhere in this product's history -- legacy's own
// `PDF_EXPORT_DPI = 600` (`src/lib/pageLayout.ts`, ported by reference
// only, never imported from `src/`). See `rasterGenerator.ts`'s own
// original doc for the full disclosed rationale (no distinct "Web JPG
// DPI" value exists to recover separately).
export const RASTER_DPI = 600;

// Reused verbatim from legacy `PRINT_JPG_LONG_SIDE_PX` (`src/lib/pageLayout.ts`).
export const PRINT_JPG_LONG_SIDE_PX = 1600;

// Reused verbatim from legacy (`exportImage.ts`'s three `toDataURL`/`toBlob`
// call sites, all `'image/jpeg', 0.95`).
export const JPEG_QUALITY = 0.95;

export function mmToPx(mm: number, dpi: number): number {
  return (mm / MM_PER_INCH) * dpi;
}

export function ptToPx(pt: number, dpi: number): number {
  return (pt / 72) * dpi;
}

/**
 * TSP-PRINT-003: where a text command with `baseline: "middle"` puts its
 * alphabetic baseline, below its y, in em. jsPDF (the PDF) moves it by
 * (1/2 − 0.15) em (its default line-height factor 1.15); Canvas 2D's own
 * "middle" is the em box's middle, 0.38 em above the baseline in every
 * bundled font, so JPG ノンブル / 柱 / 縦中横 sat 0.03 em lower than PDF.
 * Both raster executors draw unrotated "middle" text at this offset instead.
 * Rotated text (the 90° ー fallback) keeps Canvas's own baseline and no
 * shift: its offset would point the wrong way after the rotation, and the
 * rotated path was never matched to jsPDF anyway.
 */
export const JSPDF_MIDDLE_BASELINE_EM = 0.5 - 0.15;

/** Canvas `textBaseline` and y shift (px) that place a command's baseline as PDF does. */
export function rasterTextBaseline(
  baseline: "alphabetic" | "middle" | undefined,
  fontSizePx: number,
  angle?: number
): { textBaseline: "alphabetic" | "middle"; dyPx: number } {
  if (angle) return { textBaseline: baseline ?? "alphabetic", dyPx: 0 };
  return { textBaseline: "alphabetic", dyPx: baseline === "middle" ? fontSizePx * JSPDF_MIDDLE_BASELINE_EM : 0 };
}

// v2 has no bleed/trim geometry (see `jpgExport.ts`'s own module doc for
// the full disclosed rationale) -- the print transform is therefore
// exactly this: resize the full base raster (already == the "trim"
// extent) so its long side equals `longSidePx`, preserving aspect ratio.
export function computeLongSideResize(pixelWidth: number, pixelHeight: number, longSidePx: number): { width: number; height: number } {
  const longSide = Math.max(pixelWidth, pixelHeight);
  const scale = longSidePx / longSide;
  return { width: Math.max(1, Math.round(pixelWidth * scale)), height: Math.max(1, Math.round(pixelHeight * scale)) };
}
