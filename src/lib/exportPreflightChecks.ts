/**
 * TSP-PHASE13-001: additional 書き出し前チェック (入稿前の安全チェック).
 *
 * Pure rules so they are testable without mounting PreviewPane:
 * - low-resolution images (effective dpi at the size the export paints them),
 * - a whole-book page count that is even but not a multiple of 4.
 *
 * Painted sizes follow the V2 export paint plan (`pdfGenerator.ts`): a
 * top/center/bottom image is clamped into the text frame
 * (`min(1, boxW / w, boxH / h)`), and a 「全面」 image covers the trim page
 * plus the bleed on every side.
 */
import { PDF_BLEED_MM } from "../../typesetting-v2/renderer/publication/pdfOutputGeometry";

/** Below this effective resolution an image is likely to look rough in print. */
export const LOW_RESOLUTION_IMAGE_DPI = 300;

const MM_PER_INCH = 25.4;

export interface ImagePixelSize {
  widthPx: number;
  heightPx: number;
}

export interface PreflightImageToken {
  id: string;
  widthMm: number;
  heightMm: number;
  position: "top" | "center" | "bottom" | "full";
}

/** Size (mm) the export paints an image at. */
export function paintedImageSizeMm(
  token: PreflightImageToken,
  textFrame: { widthMm: number; heightMm: number },
  paper: { widthMm: number; heightMm: number }
): { widthMm: number; heightMm: number } {
  if (!(token.widthMm > 0) || !(token.heightMm > 0)) return { widthMm: 0, heightMm: 0 };
  if (token.position === "full") {
    const coverW = paper.widthMm + PDF_BLEED_MM * 2;
    const coverH = paper.heightMm + PDF_BLEED_MM * 2;
    const scale = Math.max(coverW / token.widthMm, coverH / token.heightMm);
    return { widthMm: token.widthMm * scale, heightMm: token.heightMm * scale };
  }
  const scale = Math.min(1, textFrame.widthMm / token.widthMm, textFrame.heightMm / token.heightMm);
  return { widthMm: token.widthMm * scale, heightMm: token.heightMm * scale };
}

/** Effective resolution (dpi) of `pixels` painted at `painted` mm; the lower axis wins. */
export function effectiveImageDpi(pixels: ImagePixelSize, painted: { widthMm: number; heightMm: number }): number {
  if (!(painted.widthMm > 0) || !(painted.heightMm > 0)) return Number.POSITIVE_INFINITY;
  return Math.min(
    pixels.widthPx / (painted.widthMm / MM_PER_INCH),
    pixels.heightPx / (painted.heightMm / MM_PER_INCH)
  );
}

export interface LowResolutionImageResult {
  /** 1-based body page numbers carrying at least one low-resolution image. */
  pageNumbers: number[];
  /** Lowest effective dpi found (rounded down). */
  lowestDpi: number;
}

/**
 * Pages whose images would print below `thresholdDpi`. Images whose pixel
 * size is not known yet (still decoding) or is unreadable (0 px — a broken
 * link has its own blocker) are skipped rather than guessed.
 */
export function findLowResolutionImages(params: {
  /** Target body pages: 0-based body index + that page's image tokens. */
  pages: ReadonlyArray<{ bodyIndex: number; images: readonly PreflightImageToken[] }>;
  pixelSizes: ReadonlyMap<string, ImagePixelSize>;
  textFrame: { widthMm: number; heightMm: number };
  paper: { widthMm: number; heightMm: number };
  thresholdDpi?: number;
}): LowResolutionImageResult | null {
  const threshold = params.thresholdDpi ?? LOW_RESOLUTION_IMAGE_DPI;
  const pageNumbers = new Set<number>();
  let lowest = Number.POSITIVE_INFINITY;
  for (const page of params.pages) {
    for (const token of page.images) {
      const pixels = params.pixelSizes.get(token.id);
      if (!pixels || !(pixels.widthPx > 0) || !(pixels.heightPx > 0)) continue;
      const dpi = effectiveImageDpi(pixels, paintedImageSizeMm(token, params.textFrame, params.paper));
      if (dpi < threshold) {
        pageNumbers.add(page.bodyIndex + 1);
        lowest = Math.min(lowest, dpi);
      }
    }
  }
  if (pageNumbers.size === 0) return null;
  return { pageNumbers: [...pageNumbers].sort((a, b) => a - b), lowestDpi: Math.floor(lowest) };
}

/**
 * Whole-book page count that is even but not a multiple of 4. Odd totals are
 * already covered by the odd-page warning, so they are not reported twice.
 */
export function shouldWarnPageCountNotMultipleOfFour(scope: "all" | "selected", totalPages: number): boolean {
  if (scope !== "all") return false;
  return totalPages > 0 && totalPages % 2 === 0 && totalPages % 4 !== 0;
}
