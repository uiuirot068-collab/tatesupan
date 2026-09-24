import { PX_PER_MM } from "./pageLayout";

export interface PdfCaptureExpectation {
  widthPx: number;
  heightPx: number;
}

export interface PdfCaptureSize {
  width: number;
  height: number;
}

export const PDF_CAPTURE_SIZE_TOLERANCE_RATIO = 0.15;

export function expectedPdfCapturePixels(
  bleedWidthMm: number,
  bleedHeightMm: number,
  pixelRatio: number
): PdfCaptureExpectation {
  return {
    widthPx: bleedWidthMm * PX_PER_MM * pixelRatio,
    heightPx: bleedHeightMm * PX_PER_MM * pixelRatio,
  };
}

export function isPdfCaptureSizePlausible(
  actual: PdfCaptureSize,
  expected: PdfCaptureExpectation,
  toleranceRatio = PDF_CAPTURE_SIZE_TOLERANCE_RATIO
): boolean {
  if (
    !Number.isFinite(actual.width) ||
    !Number.isFinite(actual.height) ||
    actual.width <= 0 ||
    actual.height <= 0 ||
    !Number.isFinite(expected.widthPx) ||
    !Number.isFinite(expected.heightPx) ||
    expected.widthPx <= 0 ||
    expected.heightPx <= 0
  ) {
    return false;
  }

  const widthRatio = actual.width / expected.widthPx;
  const heightRatio = actual.height / expected.heightPx;
  return (
    widthRatio >= 1 - toleranceRatio &&
    widthRatio <= 1 + toleranceRatio &&
    heightRatio >= 1 - toleranceRatio &&
    heightRatio <= 1 + toleranceRatio
  );
}

export function describePdfCaptureSizeMismatch(
  pageNumber: number,
  actual: PdfCaptureSize,
  expected: PdfCaptureExpectation
): string {
  return (
    `PDF ${pageNumber}ページ目の描画サイズが異常です。` +
    ` 実際: ${actual.width}×${actual.height}px / ` +
    `想定: 約${Math.round(expected.widthPx)}×${Math.round(expected.heightPx)}px。` +
    " 安全のためPDF書き出しを中止しました。もう一度お試しください。"
  );
}
