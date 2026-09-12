import { describe, expect, it } from "vitest";
import {
  PREVIEW_INITIAL_SPREAD_COUNT,
  PREVIEW_VIRTUALIZATION_MIN_SPREADS,
  findPreviewSpreadIndex,
  initialPreviewSpreadIndices,
  shouldVirtualizePreview,
} from "./previewPageVirtualization";

describe("preview page virtualization", () => {
  it("keeps short previews eager and windows long v2 previews", () => {
    expect(shouldVirtualizePreview(PREVIEW_VIRTUALIZATION_MIN_SPREADS, true)).toBe(false);
    expect(shouldVirtualizePreview(PREVIEW_VIRTUALIZATION_MIN_SPREADS + 1, true)).toBe(true);
    expect(shouldVirtualizePreview(100, false)).toBe(false);
  });

  it("seeds a bounded first-paint window", () => {
    expect([...initialPreviewSpreadIndices(100)]).toEqual(
      Array.from({ length: PREVIEW_INITIAL_SPREAD_COUNT }, (_, index) => index)
    );
    expect([...initialPreviewSpreadIndices(2)]).toEqual([0, 1]);
  });

  it("maps presentation pages to the right spread, including the lone first page", () => {
    const spreads = [[0], [1, 2], [3, 4], [5]];
    expect(findPreviewSpreadIndex(spreads, 0)).toBe(0);
    expect(findPreviewSpreadIndex(spreads, 2)).toBe(1);
    expect(findPreviewSpreadIndex(spreads, 5)).toBe(3);
    expect(findPreviewSpreadIndex(spreads, 99)).toBeNull();
  });
});
