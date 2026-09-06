import { describe, expect, it } from "vitest";
import { createFakeMeasurementProvider } from "../measurement/fakeProvider";
import type { SourceSpan } from "../source/span";
import type { ImageUnit } from "../units";
import { placeImage } from "./index";

const measurement = createFakeMeasurementProvider();

function span(start: number, end: number): SourceSpan {
  return { blockId: "body-1", start, end };
}

describe("F14 — image block fits-capacity check", () => {
  it("reports fits: true when the image's intrinsic height is within the available extent", () => {
    const image: ImageUnit = {
      kind: "IMAGE",
      span: span(0, 1),
      refId: "cover",
      intrinsicWidth: 800000,
      intrinsicHeight: 600000,
      placement: "CENTER",
    };
    const { height } = measurement.imageIntrinsicTick(image.refId);
    const result = placeImage(image, measurement, height); // exactly enough room
    expect(result.fits).toBe(true);
    expect(result.intrinsicHeightTick).toBe(height);
  });

  it("reports fits: false when the available extent is smaller than the image's intrinsic height", () => {
    const image: ImageUnit = {
      kind: "IMAGE",
      span: span(0, 1),
      refId: "cover",
      intrinsicWidth: 800000,
      intrinsicHeight: 600000,
      placement: "CENTER",
    };
    const { height } = measurement.imageIntrinsicTick(image.refId);
    const result = placeImage(image, measurement, height - 1);
    expect(result.fits).toBe(false);
  });
});

describe("F14 — break-before/break-after decision (Contract §14)", () => {
  it("forces isolation on both sides for FULL placement", () => {
    const image: ImageUnit = {
      kind: "IMAGE",
      span: span(0, 1),
      refId: "full-spread",
      intrinsicWidth: 800000,
      intrinsicHeight: 600000,
      placement: "FULL",
    };
    const result = placeImage(image, measurement, 10_000_000);
    expect(result.breakBefore).toBe(true);
    expect(result.breakAfter).toBe(true);
  });

  it("does not force isolation for CENTER/TOP/BOTTOM placement", () => {
    for (const placement of ["CENTER", "TOP", "BOTTOM"] as const) {
      const image: ImageUnit = {
        kind: "IMAGE",
        span: span(0, 1),
        refId: "inline",
        intrinsicWidth: 800000,
        intrinsicHeight: 600000,
        placement,
      };
      const result = placeImage(image, measurement, 10_000_000);
      expect(result.breakBefore).toBe(false);
      expect(result.breakAfter).toBe(false);
    }
  });
});

describe("Determinism (INV-005 foundation)", () => {
  it("returns identical intrinsic size for repeated calls with the same refId", () => {
    const image: ImageUnit = {
      kind: "IMAGE",
      span: span(0, 1),
      refId: "cover-sketch",
      intrinsicWidth: 800000,
      intrinsicHeight: 600000,
      placement: "CENTER",
    };
    const first = placeImage(image, measurement, 10_000_000);
    const second = placeImage(image, measurement, 10_000_000);
    expect(second).toEqual(first);
  });
});
