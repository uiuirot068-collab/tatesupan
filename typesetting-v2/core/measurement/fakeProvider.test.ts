import { describe, expect, it } from "vitest";
import { createFakeMeasurementProvider } from "./fakeProvider";

describe("createFakeMeasurementProvider — determinism", () => {
  it("returns the same naturalAdvanceTick for repeated calls with identical inputs", () => {
    const provider = createFakeMeasurementProvider();
    const first = provider.naturalAdvanceTick("body", 10, "東");
    const second = provider.naturalAdvanceTick("body", 10, "東");
    expect(second).toBe(first);
    expect(Number.isInteger(first)).toBe(true);
  });

  it("gives every character the same advance for a given font+size (Natural Pitch fixture)", () => {
    const provider = createFakeMeasurementProvider();
    expect(provider.naturalAdvanceTick("body", 10, "東")).toBe(provider.naturalAdvanceTick("body", 10, "、"));
  });

  it("scales rubyReadingExtentTick by code-point length, not UTF-16 length", () => {
    const provider = createFakeMeasurementProvider();
    const perChar = provider.naturalAdvanceTick("body", 8, "");
    expect(provider.rubyReadingExtentTick("body", 8, "とうきょう")).toBe(perChar * 5);
  });
});
