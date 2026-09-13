import { describe, expect, it } from "vitest";
import {
  PREVIEW_INITIAL_SPREAD_COUNT,
  PREVIEW_VIRTUALIZATION_MIN_SPREADS,
  findPreviewSpreadIndex,
  findPreviewZoomAnchor,
  initialPreviewSpreadIndices,
  previewZoomScrollTop,
  shouldVirtualizePreview,
} from "./previewPageVirtualization";

describe("preview page virtualization", () => {
  it("keeps short previews eager and windows long previews regardless of renderer", () => {
    // TSP-LEGACY-PREVIEW-VIRTUALIZATION-001: this windowing is renderer-
    // agnostic -- both LEGACY and V2 windows once a preview exceeds the
    // threshold; there is no longer a per-renderer gate.
    expect(shouldVirtualizePreview(PREVIEW_VIRTUALIZATION_MIN_SPREADS)).toBe(false);
    expect(shouldVirtualizePreview(PREVIEW_VIRTUALIZATION_MIN_SPREADS + 1)).toBe(true);
    expect(shouldVirtualizePreview(100)).toBe(true);
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

  it("captures and restores zoom anchors entirely in untransformed layout space", () => {
    const spreads = [
      { spreadIndex: 0, top: 0, height: 404 },
      { spreadIndex: 1, top: 428, height: 404 },
      { spreadIndex: 2, top: 856, height: 404 },
    ];
    const wrapperLayoutTop = 24;
    const clientHeight = 921;
    const oldScale = 1.10823;
    const oldScrollTop = 700;
    const logicalViewportY =
      (oldScrollTop + clientHeight / 2 - wrapperLayoutTop) / oldScale;
    const anchor = findPreviewZoomAnchor(spreads, logicalViewportY);

    expect(anchor).not.toBeNull();
    expect(anchor?.spreadIndex).toBe(2);

    const zoomedScrollTop = previewZoomScrollTop(
      anchor!,
      spreads[2],
      wrapperLayoutTop,
      oldScale * 2,
      clientHeight
    );
    const restoredScrollTop = previewZoomScrollTop(
      anchor!,
      spreads[2],
      wrapperLayoutTop,
      oldScale,
      clientHeight
    );

    expect(zoomedScrollTop).toBeCloseTo(1836.5, 5);
    expect(restoredScrollTop).toBeCloseTo(oldScrollTop, 5);
  });

  it("anchors a viewport point in a spread gap to the nearest spread edge", () => {
    const anchor = findPreviewZoomAnchor(
      [
        { spreadIndex: 3, top: 100, height: 40 },
        { spreadIndex: 4, top: 160, height: 40 },
      ],
      151
    );

    expect(anchor).toEqual({ spreadIndex: 4, offsetRatio: 0 });
  });
});
