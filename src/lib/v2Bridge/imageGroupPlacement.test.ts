// TSP-PHASE13-001 item 2: several 天/中央/地 images on one page are placed
// with the shared `layoutImageGroup` rule in export (the V2 Preview overlay
// uses the same function), so they flow in a row instead of overlapping.
import { encode } from "fast-png";
import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SETTINGS } from "../pageLayout";
import { IMAGE_GROUP_GAP_MM, layoutImageGroup } from "../imageGeometry";
import { formatImageMarker, type ImagePosition } from "../tategaki";
import { createFakeMeasurementProvider } from "../../../typesetting-v2/core/measurement/fakeProvider";
import type { PaintCommand } from "../../../typesetting-v2/renderer/publication/pdfGenerator";
import { composeV2Document } from "./composeV2Document";

const pngBytes = encode({ width: 2, height: 2, channels: 3, data: new Uint8Array(12).fill(90) });
const IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];

function compose(position: ImagePosition, widthMm = 30, heightMm = 20) {
  const content = IDS.map((id) => formatImageMarker({ type: "image", id, widthMm, heightMm, position })).join("");
  return composeV2Document({
    title: "image group",
    content,
    settings: DEFAULT_PAGE_SETTINGS,
    measurement: createFakeMeasurementProvider(),
    imageResolver: () => ({ kind: "RESOLVED", url: "data:image/png;base64,qa", bytes: pngBytes, format: "PNG", pixelWidth: 2, pixelHeight: 2 }),
  });
}

function images(commands: PaintCommand[]) {
  return commands.filter((c): c is Extract<PaintCommand, { op: "image" }> => c.op === "image");
}

function overlaps(a: { xMm: number; yMm: number; widthMm: number; heightMm: number }, b: typeof a): boolean {
  return a.xMm < b.xMm + b.widthMm - 1e-6 && b.xMm < a.xMm + a.widthMm - 1e-6 && a.yMm < b.yMm + b.heightMm - 1e-6 && b.yMm < a.yMm + a.heightMm - 1e-6;
}

describe("layoutImageGroup", () => {
  const box = { leftMm: 10, topMm: 20, widthMm: 100, heightMm: 150 };

  it("a single image keeps the historical single-image centring", () => {
    for (const [pos, y] of [["TOP", 20], ["CENTER", 20 + (150 - 40) / 2], ["BOTTOM", 20 + 150 - 40]] as const) {
      const [rect] = layoutImageGroup([{ widthMm: 30, heightMm: 40 }], box, pos);
      expect(rect.xMm).toBeCloseTo(10 + (100 - 30) / 2, 9);
      expect(rect.yMm).toBeCloseTo(y, 9);
    }
  });

  it("flows images left-to-right with the gap and wraps to a new row", () => {
    const rects = layoutImageGroup([{ widthMm: 40, heightMm: 10 }, { widthMm: 40, heightMm: 20 }, { widthMm: 40, heightMm: 10 }], box, "TOP");
    expect(rects[1].xMm - (rects[0].xMm + 40)).toBeCloseTo(IMAGE_GROUP_GAP_MM, 9);
    expect(rects[0].yMm).toBe(20);
    expect(rects[1].yMm).toBe(20);
    // third does not fit (40+4+40+4+40 > 100) → next row under the tallest
    expect(rects[2].yMm).toBeCloseTo(20 + 20 + IMAGE_GROUP_GAP_MM, 9);
    expect(rects[2].xMm).toBeCloseTo(10 + (100 - 40) / 2, 9);
  });

  it("地 bottom-aligns each row and puts the block on the frame bottom", () => {
    const rects = layoutImageGroup([{ widthMm: 20, heightMm: 10 }, { widthMm: 20, heightMm: 30 }], box, "BOTTOM");
    expect(rects[0].yMm + 10).toBeCloseTo(170, 9);
    expect(rects[1].yMm + 30).toBeCloseTo(170, 9);
  });
});

describe("V2 export places grouped images with the shared rule", () => {
  it.each(["top", "center", "bottom"] as const)("%s: three images on one page never overlap and match layoutImageGroup", (position) => {
    const bridge = compose(position);
    const page = bridge.plan.find((p) => images(p.commands).length === 3);
    expect(page).toBeDefined();
    const painted = images(page!.commands);
    for (let i = 0; i < painted.length; i += 1) {
      for (let j = i + 1; j < painted.length; j += 1) expect(overlaps(painted[i], painted[j])).toBe(false);
    }
    const g = bridge.pageGeometry;
    const expected = layoutImageGroup(
      painted.map((c) => ({ widthMm: c.widthMm, heightMm: c.heightMm })),
      {
        leftMm: g.marginLeftMm,
        topMm: g.marginTopMm,
        widthMm: g.paperWidthMm - g.marginLeftMm - g.marginRightMm,
        heightMm: g.paperHeightMm - g.marginTopMm - g.marginBottomMm,
      },
      position.toUpperCase() as "TOP" | "CENTER" | "BOTTOM"
    );
    const key = (r: { xMm: number; yMm: number }) => [Math.round(r.yMm * 1e4), Math.round(r.xMm * 1e4)];
    const sort = <T extends { xMm: number; yMm: number }>(list: T[]) => [...list].sort((a, b) => key(a)[0] - key(b)[0] || key(a)[1] - key(b)[1]);
    const actual = sort(painted);
    sort(expected).forEach((rect, i) => {
      expect(actual[i].xMm).toBeCloseTo(rect.xMm, 6);
      expect(actual[i].yMm).toBeCloseTo(rect.yMm, 6);
    });
  });
});
