// Post-beta typography Phase 1 (傍点): the `circle` PaintCommand reaches every
// Publication executor — vector PDF (jsPDF) and the raster executor that
// shares its command semantics with the browser JPG path. Plan-level dot
// placement/parity lives in `src/lib/v2Bridge/typographyPhase1.test.ts`.
import { describe, expect, it } from "vitest";
import { renderPaintPlanToPdf, type PaintPlan } from "./pdfGenerator";
import { renderPaintPlanToRasterPages } from "./rasterGenerator";
import { emphasisDotFlowCenters, emphasisDotLane, takesEmphasisDot } from "../emphasisMarks";
import { rubyLaneGeometry } from "../rubyLane";

const PLAN: PaintPlan = [
  { widthMm: 20, heightMm: 20, commands: [{ op: "circle", xMm: 10, yMm: 10, radiusMm: 2 }] },
];

describe("傍点 circle command executors", () => {
  it("vector PDF: renders the filled circle without error", () => {
    const result = renderPaintPlanToPdf(PLAN);
    expect(result.pageCount).toBe(1);
    const pdf = new TextDecoder("latin1").decode(result.bytes);
    expect(pdf.startsWith("%PDF")).toBe(true);
  });

  it("raster (JPG) executor: inks the dot centre and leaves the page corner white", async () => {
    const [page] = await renderPaintPlanToRasterPages(PLAN, undefined, 254); // 10 px/mm
    const ctx = page.canvas.getContext("2d");
    const centre = ctx.getImageData(100, 100, 1, 1).data;
    const corner = ctx.getImageData(5, 5, 1, 1).data;
    expect(centre[0]).toBeLessThan(40);
    expect(corner[0]).toBeGreaterThan(215);
  });
});

describe("傍点 shared geometry (emphasisMarks.ts)", () => {
  it("sits in the ruby lane on the right, mirrored to the left for ruby-bearing bases", () => {
    const right = emphasisDotLane(10, 17, "RIGHT");
    const left = emphasisDotLane(10, 17, "LEFT");
    expect(right.centerFromParentCenter).toBeCloseTo(rubyLaneGeometry(10, 17).annotationCenterFromParentCenter, 9);
    expect(left.centerFromParentCenter).toBeCloseTo(-right.centerFromParentCenter, 9);
    expect(right.radius).toBeCloseTo(0.9, 9);
  });

  it("never overlaps the base em box even at a very tight 行間", () => {
    const lane = emphasisDotLane(10, 10.5, "RIGHT");
    expect(lane.centerFromParentCenter - lane.radius).toBeGreaterThan(5);
  });

  it("one flow centre per dot-bearing grapheme, skipping punctuation and spaces", () => {
    expect(emphasisDotFlowCenters("強い。", 30)).toEqual([5, 15]);
    expect(["、", "」", "！", "　", "―", "…"].some(takesEmphasisDot)).toBe(false);
    expect(["漢", "か", "ー", "A", "1"].every(takesEmphasisDot)).toBe(true);
  });
});
