import { describe, expect, it } from "vitest";
import { folioPlacement, furnitureFrameMargins, headerPlacement, type FurniturePageFrame } from "./furnitureGeometry";

// Phase 11 残件③: the one folio/柱 placement function shared by the
// Publication paint plan (PDF/JPG) and the Editor Preview overlays.

const LEGACY_FRAME: FurniturePageFrame = {
  paperWidthMm: 105,
  paperHeightMm: 148,
  marginTopMm: 15,
  marginBottomMm: 12,
  marginLeftMm: 10,
  marginRightMm: 18,
};
const EDITOR_FRAME: FurniturePageFrame = {
  ...LEGACY_FRAME,
  furniture: { marginGutterMm: 18, marginOuterMm: 10, folioBottomEdgeMm: 5 },
};
const MM_PER_PT = 25.4 / 72;

describe("furnitureFrameMargins", () => {
  it("without Editor geometry keeps the fixed, parity-independent frame", () => {
    expect(furnitureFrameMargins(LEGACY_FRAME, true)).toEqual({ leftMm: 10, rightMm: 18 });
    expect(furnitureFrameMargins(LEGACY_FRAME, false)).toEqual({ leftMm: 10, rightMm: 18 });
  });

  it("with Editor geometry mirrors ノド/小口 per parity (odd: 小口 left, ノド right; even mirrored)", () => {
    expect(furnitureFrameMargins(EDITOR_FRAME, true)).toEqual({ leftMm: 10, rightMm: 18 });
    expect(furnitureFrameMargins(EDITOR_FRAME, false)).toEqual({ leftMm: 18, rightMm: 10 });
  });
});

describe("folioPlacement", () => {
  it("without Editor geometry reproduces the historical Publication formula byte-for-byte", () => {
    expect(folioPlacement("left", LEGACY_FRAME, true, 8, 4)).toEqual({ xMm: 12, align: "center", yCenterMm: 142 });
    expect(folioPlacement("right", LEGACY_FRAME, false, 8, 4)).toEqual({ xMm: 85, align: "center", yCenterMm: 142 });
    expect(folioPlacement("center", LEGACY_FRAME, true, 8, 4)).toEqual({ xMm: 52.5, align: "center", yCenterMm: 142 });
  });

  it("with Editor geometry anchors the number's outer edge on the frame edge and its bottom edge at nombreBottomMargin", () => {
    const yCenterMm = 148 - 5 - (8 * MM_PER_PT) / 2;
    // odd page: 小口 = left (10mm), ノド = right (18mm)
    expect(folioPlacement("left", EDITOR_FRAME, true, 8, 4)).toEqual({ xMm: 10, align: "left", yCenterMm });
    expect(folioPlacement("right", EDITOR_FRAME, true, 8, 4)).toEqual({ xMm: 105 - 18, align: "right", yCenterMm });
    // even page: ノド = left (18mm), 小口 = right (10mm)
    expect(folioPlacement("left", EDITOR_FRAME, false, 8, 4)).toEqual({ xMm: 18, align: "left", yCenterMm });
    expect(folioPlacement("right", EDITOR_FRAME, false, 8, 4)).toEqual({ xMm: 105 - 10, align: "right", yCenterMm });
    expect(folioPlacement("center", EDITOR_FRAME, false, 8, 4)).toEqual({ xMm: 52.5, align: "center", yCenterMm });
  });

  it("the folio's vertical centre moves with its own font size so its bottom edge stays put", () => {
    const small = folioPlacement("center", EDITOR_FRAME, true, 4, 4);
    const large = folioPlacement("center", EDITOR_FRAME, true, 12, 4);
    expect(small.yCenterMm + (4 * MM_PER_PT) / 2).toBeCloseTo(143, 10);
    expect(large.yCenterMm + (12 * MM_PER_PT) / 2).toBeCloseTo(143, 10);
  });
});

describe("headerPlacement", () => {
  it("is vertically centred in its margin band", () => {
    expect(headerPlacement({ band: "top", horizontal: "left" }, EDITOR_FRAME, true, 4).yCenterMm).toBe(7.5);
    expect(headerPlacement({ band: "bottom", horizontal: "left" }, EDITOR_FRAME, true, 4).yCenterMm).toBe(142);
  });

  it("is flush with the parity-aware frame edge with Editor geometry", () => {
    expect(headerPlacement({ band: "top", horizontal: "left" }, EDITOR_FRAME, true, 4)).toMatchObject({ xMm: 10, align: "left" });
    expect(headerPlacement({ band: "top", horizontal: "right" }, EDITOR_FRAME, false, 4)).toMatchObject({ xMm: 95, align: "right" });
    expect(headerPlacement({ band: "top", horizontal: "center" }, EDITOR_FRAME, false, 4)).toMatchObject({ xMm: 52.5, align: "center" });
  });

  it("without Editor geometry keeps the historical body placement (frame edge) and colophon centring", () => {
    expect(headerPlacement({ band: "top", horizontal: "left" }, LEGACY_FRAME, false, 4)).toEqual({ xMm: 10, align: "left", yCenterMm: 7.5 });
    expect(headerPlacement({ band: "top", horizontal: "right" }, LEGACY_FRAME, true, 4, true)).toEqual({ xMm: 85, align: "center", yCenterMm: 7.5 });
  });

  it("the colophon centring flag is ignored once Editor geometry is supplied (one placement for every page)", () => {
    expect(headerPlacement({ band: "top", horizontal: "right" }, EDITOR_FRAME, true, 4, true)).toEqual(
      headerPlacement({ band: "top", horizontal: "right" }, EDITOR_FRAME, true, 4)
    );
  });
});
