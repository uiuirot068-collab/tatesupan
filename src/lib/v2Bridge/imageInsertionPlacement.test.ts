import { encode } from "fast-png";
import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SETTINGS } from "../pageLayout";
import { findImageTokenRange, formatImageMarker, type ImagePosition } from "../tategaki";
import { createFakeMeasurementProvider } from "../../../typesetting-v2/core/measurement/fakeProvider";
import { renderPaintPlanToPdf, type PaintCommand } from "../../../typesetting-v2/renderer/publication/pdfGenerator";
import { exportPaintPlanToJpgPages } from "../../../typesetting-v2/renderer/publication/jpgExport";
import { composeV2Document } from "./composeV2Document";

const ID = "9976b325-fd67-4832-b0e1-2d2250a47e68";
const WIDTH_MM = 67.50321384083045;
const HEIGHT_MM = 101.6064;
const POSITIONS: ImagePosition[] = ["top", "center", "bottom", "full"];

const pngBytes = encode({
  width: 2,
  height: 3,
  channels: 4,
  data: new Uint8Array([
    220, 30, 30, 255, 220, 30, 30, 255,
    220, 30, 30, 255, 220, 30, 30, 255,
    220, 30, 30, 255, 220, 30, 30, 255,
  ]),
});

function marker(position: ImagePosition): string {
  return formatImageMarker({ type: "image", id: ID, widthMm: WIDTH_MM, heightMm: HEIGHT_MM, position });
}

function imageCommand(commands: PaintCommand[]) {
  const command = commands.find((candidate) => candidate.op === "image");
  expect(command?.op).toBe("image");
  return command as Extract<PaintCommand, { op: "image" }>;
}

describe("actual Editor IMG insertion/placement contract", () => {
  it("rewrites only the selected marker and preserves every current UI placement value", () => {
    const inserted = marker("center");
    for (const position of POSITIONS) {
      const match = findImageTokenRange(inserted, ID);
      expect(match).not.toBeNull();
      const rewritten = inserted.slice(0, match!.start) + formatImageMarker({ ...match!.token, position }) + inserted.slice(match!.end);
      expect(rewritten).toBe(`【IMG:${ID}:${WIDTH_MM}:${HEIGHT_MM}:${position}】`);
      expect(findImageTokenRange(rewritten, ID)?.token.position).toBe(position);
    }
  });

  it.each(POSITIONS)("preserves %s through IMG -> Canonical -> Publication and uses marker mm, not refId fallback", (position) => {
    const bridge = composeV2Document({
      title: "image placement",
      content: marker(position),
      settings: DEFAULT_PAGE_SETTINGS,
      measurement: createFakeMeasurementProvider(),
      imageResolver: () => ({ kind: "RESOLVED", url: "data:image/png;base64,qa", bytes: pngBytes, format: "PNG", pixelWidth: 2, pixelHeight: 3 }),
    });
    const logical = bridge.units.find((unit) => unit.kind === "IMAGE");
    expect(logical?.kind).toBe("IMAGE");
    if (logical?.kind !== "IMAGE") throw new Error("IMAGE unit missing");
    expect(logical.placement).toBe(position.toUpperCase());

    const painted = bridge.model.pages.flatMap((page) => page.columns.flatMap((column) => column.lines.flatMap((line) => line.units))).find((unit) => unit.kind === "IMAGE");
    expect(painted?.imagePlacement).toBe(position.toUpperCase());
    expect(painted?.imageIntrinsicWidthMm).toBeCloseTo(WIDTH_MM, 3);
    expect(painted?.heightMm).toBeCloseTo(HEIGHT_MM, 3);

    const command = imageCommand(bridge.plan[0].commands);
    const geometry = bridge.pageGeometry;
    if (position === "full") {
      expect(command.widthMm).toBeGreaterThanOrEqual(geometry.paperWidthMm);
      expect(command.heightMm).toBeGreaterThanOrEqual(geometry.paperHeightMm);
      expect(command.xMm).toBeLessThanOrEqual(0);
      expect(command.yMm).toBeLessThanOrEqual(0);
    } else {
      const contentHeight = geometry.paperHeightMm - geometry.marginTopMm - geometry.marginBottomMm;
      const expectedY = position === "top"
        ? geometry.marginTopMm
        : position === "bottom"
          ? geometry.marginTopMm + contentHeight - command.heightMm
          : geometry.marginTopMm + (contentHeight - command.heightMm) / 2;
      expect(command.yMm).toBeCloseTo(expectedY, 6);
      expect(command.widthMm).toBeGreaterThan(40);
      expect(command.heightMm).toBeGreaterThan(60);
    }
  });

  it("the shared physical PaintPlan renders to both PDF and JPG without changing placement geometry", async () => {
    const bridge = composeV2Document({
      title: "full image",
      content: marker("full"),
      settings: DEFAULT_PAGE_SETTINGS,
      measurement: createFakeMeasurementProvider(),
      imageResolver: () => ({ kind: "RESOLVED", url: "data:image/png;base64,qa", bytes: pngBytes, format: "PNG", pixelWidth: 2, pixelHeight: 3 }),
    });
    const before = imageCommand(bridge.plan[0].commands);
    const pdf = renderPaintPlanToPdf(bridge.plan);
    const jpg = await exportPaintPlanToJpgPages(bridge.plan, undefined, "image-placement", "WEB", 72);
    expect(pdf.pageCount).toBe(1);
    expect(pdf.bytes.length).toBeGreaterThan(500);
    expect(jpg).toHaveLength(1);
    expect(jpg[0].bytes.length).toBeGreaterThan(500);
    expect(imageCommand(bridge.plan[0].commands)).toEqual(before);
  });
});
