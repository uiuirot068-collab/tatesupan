import { describe, expect, it } from "vitest";
import {
  describePdfCaptureSizeMismatch,
  expectedPdfCapturePixels,
  isPdfCaptureSizePlausible,
} from "./pdfCaptureSafety";

describe("pdf capture safety", () => {
  it("derives the expected raster size from physical page geometry and export scale", () => {
    const expected = expectedPdfCapturePixels(111, 154, 600 / (25.4 * 2.2));
    expect(expected.widthPx).toBeCloseTo((111 / 25.4) * 600, 5);
    expect(expected.heightPx).toBeCloseTo((154 / 25.4) * 600, 5);
  });

  it("accepts a normal 600dpi 文庫 bleed capture within tolerance", () => {
    const expected = expectedPdfCapturePixels(111, 154, 600 / (25.4 * 2.2));
    expect(isPdfCaptureSizePlausible({ width: 2622, height: 3638 }, expected)).toBe(true);
  });

  it("rejects the observed tiny blank-page failure shape", () => {
    const expected = expectedPdfCapturePixels(111, 154, 600 / (25.4 * 2.2));
    expect(isPdfCaptureSizePlausible({ width: 10, height: 11 }, expected)).toBe(false);
  });

  it("returns a user-facing fail-closed message with the page number", () => {
    const expected = { widthPx: 2622, heightPx: 3638 };
    const message = describePdfCaptureSizeMismatch(3, { width: 10, height: 11 }, expected);
    expect(message).toContain("3ページ目");
    expect(message).toContain("10×11px");
    expect(message).toContain("安全のためPDF書き出しを中止");
  });
});
