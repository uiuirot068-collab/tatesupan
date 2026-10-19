// TSP-PRINT-003 (P4-7): the Preview draws ノンブル / 柱 where PDF writes them.
import { describe, expect, it } from "vitest";
import { MM_PER_PT, PX_PER_MM } from "@/lib/pageLayout";
import { furnitureRunPlacement } from "./previewFurniture";

describe("furnitureRunPlacement", () => {
  const sizePt = 9;
  const sizeMm = sizePt * MM_PER_PT;
  // A run 1.5 em wide (1500 of 1000 units).
  const advance = 1500;

  it("puts the baseline where jsPDF's baseline \"middle\" does (centre + 0.35 em)", () => {
    const at = furnitureRunPlacement(advance, 1000, { xMm: 50, align: "center", yCenterMm: 140 }, sizePt, 0);
    expect(at.baselineY / PX_PER_MM).toBeCloseTo(140 + sizeMm * 0.35, 9);
    expect(at.scale).toBeCloseTo((sizeMm * PX_PER_MM) / 1000, 12);
  });

  it("anchors the run by its advance width: left edge, centre or right edge", () => {
    const widthMm = 1.5 * sizeMm;
    const left = furnitureRunPlacement(advance, 1000, { xMm: 12, align: "left", yCenterMm: 140 }, sizePt, 0);
    const right = furnitureRunPlacement(advance, 1000, { xMm: 93, align: "right", yCenterMm: 140 }, sizePt, 0);
    const center = furnitureRunPlacement(advance, 1000, { xMm: 52.5, align: "center", yCenterMm: 140 }, sizePt, 0);
    expect(left.x / PX_PER_MM).toBeCloseTo(12, 9);
    expect(right.x / PX_PER_MM).toBeCloseTo(93 - widthMm, 9);
    expect(center.x / PX_PER_MM).toBeCloseTo(52.5 - widthMm / 2, 9);
  });

  it("shifts by the bleed on both axes (the card's outer box includes it)", () => {
    const a = furnitureRunPlacement(advance, 1000, { xMm: 12, align: "left", yCenterMm: 140 }, sizePt, 0);
    const b = furnitureRunPlacement(advance, 1000, { xMm: 12, align: "left", yCenterMm: 140 }, sizePt, 3);
    expect((b.x - a.x) / PX_PER_MM).toBeCloseTo(3, 9);
    expect((b.baselineY - a.baselineY) / PX_PER_MM).toBeCloseTo(3, 9);
  });
});
