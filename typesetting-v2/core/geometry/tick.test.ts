import { describe, expect, it } from "vitest";
import { mmToTicks } from "./tick";

describe("mmToTicks", () => {
  it("returns an integer number of ticks, never a float (INV-013)", () => {
    const ticks = mmToTicks(12.3456);
    expect(Number.isInteger(ticks)).toBe(true);
  });

  it("converts known mm values to the expected integer tick count (1 tick = 0.001mm)", () => {
    expect(mmToTicks(0)).toBe(0);
    expect(mmToTicks(1)).toBe(1000);
    expect(mmToTicks(12.345)).toBe(12345);
    expect(mmToTicks(128)).toBe(128000); // B6 width reference
  });

  it("rounds to the nearest tick rather than truncating sub-tick precision", () => {
    expect(mmToTicks(1.0004)).toBe(1000);
    expect(mmToTicks(1.0006)).toBe(1001);
  });
});
