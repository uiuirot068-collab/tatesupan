export type PublicationPdfMode = "trim" | "bleed" | "full";

export const PDF_BLEED_MM = 3;
export const PDF_CROP_MARK_MARGIN_MM = 15;
export const PDF_CROP_MARK_LENGTH_MM = 10;

export interface PdfCropMarkSegment {
  x1Mm: number;
  y1Mm: number;
  x2Mm: number;
  y2Mm: number;
}

export interface PublicationPdfPageBoxMm {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

export interface PublicationPdfPageOutput {
  mode: PublicationPdfMode;
  widthMm: number;
  heightMm: number;
  contentOffsetXMm: number;
  contentOffsetYMm: number;
  /** Finished/trim size, measured in output-sheet coordinates. */
  trimBox: PublicationPdfPageBoxMm;
  /** 3 mm bleed region. Equals trim in trim mode and the full sheet in bleed mode. */
  bleedBox: PublicationPdfPageBoxMm;
  /** Viewer/print clipping region. Kept at the emitted sheet so full-mode crop marks remain visible. */
  cropBox: PublicationPdfPageBoxMm;
  cropMarks: PdfCropMarkSegment[];
}

function assertFinitePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a finite positive number.`);
  }
}

function assertPublicationPdfMode(mode: string): asserts mode is PublicationPdfMode {
  if (mode !== "trim" && mode !== "bleed" && mode !== "full") {
    throw new Error(`Unsupported publication PDF mode: ${mode}`);
  }
}

/**
 * Resolves only the PDF output sheet. The canonical PaintPlan remains the
 * finished/trim page and is never resized or reflowed. Non-trim modes place
 * that unchanged page at the trim origin inside a larger output sheet.
 */
export function resolvePublicationPdfPageOutput(
  trimWidthMm: number,
  trimHeightMm: number,
  mode: PublicationPdfMode,
): PublicationPdfPageOutput {
  assertFinitePositive(trimWidthMm, "trimWidthMm");
  assertFinitePositive(trimHeightMm, "trimHeightMm");
  assertPublicationPdfMode(mode);

  if (mode === "trim") {
    const trimBox = { xMm: 0, yMm: 0, widthMm: trimWidthMm, heightMm: trimHeightMm };
    return {
      mode,
      widthMm: trimWidthMm,
      heightMm: trimHeightMm,
      contentOffsetXMm: 0,
      contentOffsetYMm: 0,
      trimBox,
      bleedBox: { ...trimBox },
      cropBox: { ...trimBox },
      cropMarks: [],
    };
  }

  const cropMarkMarginMm = mode === "full" ? PDF_CROP_MARK_MARGIN_MM : 0;
  const trimOriginMm = cropMarkMarginMm + PDF_BLEED_MM;
  const widthMm = trimWidthMm + PDF_BLEED_MM * 2 + cropMarkMarginMm * 2;
  const heightMm = trimHeightMm + PDF_BLEED_MM * 2 + cropMarkMarginMm * 2;
  const trimBox = {
    xMm: trimOriginMm,
    yMm: trimOriginMm,
    widthMm: trimWidthMm,
    heightMm: trimHeightMm,
  };
  const bleedBox = {
    xMm: cropMarkMarginMm,
    yMm: cropMarkMarginMm,
    widthMm: trimWidthMm + PDF_BLEED_MM * 2,
    heightMm: trimHeightMm + PDF_BLEED_MM * 2,
  };
  const cropBox = { xMm: 0, yMm: 0, widthMm, heightMm };

  return {
    mode,
    widthMm,
    heightMm,
    contentOffsetXMm: trimOriginMm,
    contentOffsetYMm: trimOriginMm,
    trimBox,
    bleedBox,
    cropBox,
    cropMarks: mode === "full"
      ? buildLegacyParityCropMarks(widthMm, heightMm)
      : [],
  };
}

/** Exact output-coordinate equivalent of the established Legacy full-mode marks. */
export function buildLegacyParityCropMarks(
  outputWidthMm: number,
  outputHeightMm: number,
): PdfCropMarkSegment[] {
  assertFinitePositive(outputWidthMm, "outputWidthMm");
  assertFinitePositive(outputHeightMm, "outputHeightMm");

  const margin = PDF_CROP_MARK_MARGIN_MM;
  const bleed = PDF_BLEED_MM;
  const length = PDF_CROP_MARK_LENGTH_MM;
  const right = outputWidthMm - margin;
  const bottom = outputHeightMm - margin;

  return [
    { x1Mm: margin, y1Mm: margin + bleed, x2Mm: margin - length, y2Mm: margin + bleed },
    { x1Mm: margin, y1Mm: margin, x2Mm: margin - length, y2Mm: margin },
    { x1Mm: margin + bleed, y1Mm: margin, x2Mm: margin + bleed, y2Mm: margin - length },
    { x1Mm: margin, y1Mm: margin, x2Mm: margin, y2Mm: margin - length },
    { x1Mm: right, y1Mm: margin + bleed, x2Mm: right + length, y2Mm: margin + bleed },
    { x1Mm: right, y1Mm: margin, x2Mm: right + length, y2Mm: margin },
    { x1Mm: right - bleed, y1Mm: margin, x2Mm: right - bleed, y2Mm: margin - length },
    { x1Mm: right, y1Mm: margin, x2Mm: right, y2Mm: margin - length },
    { x1Mm: margin, y1Mm: bottom - bleed, x2Mm: margin - length, y2Mm: bottom - bleed },
    { x1Mm: margin, y1Mm: bottom, x2Mm: margin - length, y2Mm: bottom },
    { x1Mm: margin + bleed, y1Mm: bottom, x2Mm: margin + bleed, y2Mm: bottom + length },
    { x1Mm: margin, y1Mm: bottom, x2Mm: margin, y2Mm: bottom + length },
    { x1Mm: right, y1Mm: bottom - bleed, x2Mm: right + length, y2Mm: bottom - bleed },
    { x1Mm: right, y1Mm: bottom, x2Mm: right + length, y2Mm: bottom },
    { x1Mm: right - bleed, y1Mm: bottom, x2Mm: right - bleed, y2Mm: bottom + length },
    { x1Mm: right, y1Mm: bottom, x2Mm: right, y2Mm: bottom + length },
  ];
}
