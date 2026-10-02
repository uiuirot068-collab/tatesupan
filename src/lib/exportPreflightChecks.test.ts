import { describe, expect, it } from "vitest";
import {
  effectiveImageDpi,
  findLowResolutionImages,
  paintedImageSizeMm,
  shouldWarnPageCountNotMultipleOfFour,
} from "./exportPreflightChecks";
import { PDF_BLEED_MM } from "../../typesetting-v2/renderer/publication/pdfOutputGeometry";

const A5 = { widthMm: 148, heightMm: 210 };
const FRAME = { widthMm: 120, heightMm: 170 };

describe("TSP-PHASE13-001 preflight: painted image size", () => {
  it("keeps an inline image that fits the text frame at its own size", () => {
    expect(paintedImageSizeMm({ id: "a", widthMm: 80, heightMm: 60, position: "top" }, FRAME, A5)).toEqual({ widthMm: 80, heightMm: 60 });
  });

  it("clamps an oversized inline image into the text frame like the export", () => {
    const size = paintedImageSizeMm({ id: "a", widthMm: 240, heightMm: 100, position: "center" }, FRAME, A5);
    expect(size.widthMm).toBeCloseTo(120);
    expect(size.heightMm).toBeCloseTo(50);
  });

  it("covers trim + bleed for a 「全面」 image", () => {
    const size = paintedImageSizeMm({ id: "a", widthMm: 100, heightMm: 100, position: "full" }, FRAME, A5);
    const coverH = A5.heightMm + PDF_BLEED_MM * 2;
    expect(size.heightMm).toBeCloseTo(coverH);
    expect(size.widthMm).toBeCloseTo(coverH);
  });
});

describe("TSP-PHASE13-001 preflight: effective dpi", () => {
  it("is pixels per painted inch, taking the weaker axis", () => {
    expect(effectiveImageDpi({ widthPx: 1000, heightPx: 2000 }, { widthMm: 25.4 * 5, heightMm: 25.4 * 5 })).toBeCloseTo(200);
  });
});

describe("TSP-PHASE13-001 preflight: low-resolution images", () => {
  const pages = [
    { bodyIndex: 0, images: [{ id: "big", widthMm: 50.8, heightMm: 50.8, position: "top" as const }] },
    { bodyIndex: 2, images: [{ id: "small", widthMm: 50.8, heightMm: 50.8, position: "bottom" as const }] },
    { bodyIndex: 3, images: [{ id: "unknown", widthMm: 50.8, heightMm: 50.8, position: "top" as const }] },
  ];
  const pixelSizes = new Map([
    ["big", { widthPx: 800, heightPx: 800 }], // 400 dpi
    ["small", { widthPx: 300, heightPx: 300 }], // 150 dpi
  ]);

  it("reports the pages and the lowest dpi below 300", () => {
    expect(findLowResolutionImages({ pages, pixelSizes, textFrame: FRAME, paper: A5 })).toEqual({ pageNumbers: [3], lowestDpi: 150 });
  });

  it("is silent when every known image is sharp enough or sizes are unknown/unreadable", () => {
    const sharp = new Map([
      ["big", { widthPx: 800, heightPx: 800 }],
      ["small", { widthPx: 0, heightPx: 0 }],
    ]);
    expect(findLowResolutionImages({ pages, pixelSizes: sharp, textFrame: FRAME, paper: A5 })).toBeNull();
  });

  it("judges a 「全面」 image at its bleed-cover size", () => {
    // 1748 px over 216 mm (A5 height + bleed) ≈ 205 dpi.
    const full = [{ bodyIndex: 0, images: [{ id: "f", widthMm: 100, heightMm: 141, position: "full" as const }] }];
    const result = findLowResolutionImages({ pages: full, pixelSizes: new Map([["f", { widthPx: 1240, heightPx: 1748 }]]), textFrame: FRAME, paper: A5 });
    expect(result?.pageNumbers).toEqual([1]);
    expect(result?.lowestDpi).toBeLessThan(300);
  });
});

describe("TSP-PHASE13-001 preflight: page count multiple of 4", () => {
  it("warns only for an even, non-multiple-of-4 whole-book export", () => {
    expect(shouldWarnPageCountNotMultipleOfFour("all", 6)).toBe(true);
    expect(shouldWarnPageCountNotMultipleOfFour("all", 8)).toBe(false);
    expect(shouldWarnPageCountNotMultipleOfFour("all", 7)).toBe(false); // the odd-page warning covers it
    expect(shouldWarnPageCountNotMultipleOfFour("selected", 6)).toBe(false);
    expect(shouldWarnPageCountNotMultipleOfFour("all", 0)).toBe(false);
  });
});
