import { describe, expect, it } from "vitest";
import { paintBodyExtentTicks, paintColumnPlacementTicks } from "../columnStack";

describe("column paint stacking", () => {
  const base = { lineExtentTicks: 100, columnExtentTicks: 300, columnsPerPage: 2, columnGapTicks: 20 };

  it("keeps the historical horizontal placement unless explicitly opted in", () => {
    expect(paintColumnPlacementTicks(1, base)).toEqual({ rightTicks: 300, topTicks: 0 });
    expect(paintBodyExtentTicks(base)).toEqual({ widthTicks: 600, heightTicks: 100 });
  });

  it("stacks Japanese 2段 top-to-bottom with the declared gap", () => {
    const ctx = { ...base, columnStackDirection: "vertical" as const };
    expect(paintColumnPlacementTicks(0, ctx)).toEqual({ rightTicks: 0, topTicks: 0 });
    expect(paintColumnPlacementTicks(1, ctx)).toEqual({ rightTicks: 0, topTicks: 120 });
    expect(paintBodyExtentTicks(ctx)).toEqual({ widthTicks: 300, heightTicks: 220 });
  });

  it("starts the lower 段 at the full 段 frame (legacy PageCard), never inside a longer line", () => {
    const ctx = { ...base, columnStackDirection: "vertical" as const, columnFrameTicks: 130 };
    expect(paintColumnPlacementTicks(1, ctx)).toEqual({ rightTicks: 0, topTicks: 150 });
    expect(paintBodyExtentTicks(ctx)).toEqual({ widthTicks: 300, heightTicks: 280 });
    const shortFrame = { ...ctx, columnFrameTicks: 50 };
    expect(paintColumnPlacementTicks(1, shortFrame)).toEqual({ rightTicks: 0, topTicks: 120 });
  });

  it("ignores the 段 frame for horizontal placement (colophon / Core fixtures)", () => {
    const ctx = { ...base, columnFrameTicks: 130 };
    expect(paintColumnPlacementTicks(1, ctx)).toEqual({ rightTicks: 300, topTicks: 0 });
    expect(paintBodyExtentTicks(ctx)).toEqual({ widthTicks: 600, heightTicks: 100 });
  });
});
