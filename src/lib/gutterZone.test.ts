import { describe, expect, it } from "vitest";
import { BOOK3D_BINDING_LABEL, defaultBinding, getGutterModel } from "./gutterZone";

// CST-PORT-004 (C6): the same tests run in COLUMNSTAND and TateSpun, so the
// shared ノドの見づらい範囲 stays the same calculation in both apps.

describe("ノドの見づらい範囲 (gutterZone)", () => {
  it("defaults to 中綴じ up to 64 pages, 平綴じ above", () => {
    expect(defaultBinding(8)).toBe("saddle");
    expect(defaultBinding(64)).toBe("saddle");
    expect(defaultBinding(65)).toBe("perfect");
    expect(BOOK3D_BINDING_LABEL).toEqual({ saddle: "中綴じ", perfect: "平綴じ" });
  });

  it("keeps the COLUMNSTAND 3D values (ノド注意 width in mm)", () => {
    const warn = (binding: "saddle" | "perfect", mm: number) => getGutterModel(binding, mm).warnMm;
    expect([1.2, 5, 12, 25].map((mm) => warn("saddle", mm))).toEqual([5, 6.5, 7.5, 9]);
    expect([1.2, 5, 12, 25].map((mm) => warn("perfect", mm))).toEqual([21, 28.5, 34, 39]);
  });

  it("keeps the curl and shading parameters", () => {
    const saddle = getGutterModel("saddle", 12);
    expect(saddle.curlZoneMm).toBeCloseTo(12, 6);
    expect(saddle.difficulty).toBeCloseTo(0.2556, 4);
    expect(saddle.maxCurlDeg).toBeCloseTo(25.204, 3);
    expect(saddle.openAngleDeg).toBe(176);
    expect(saddle.strips).toBe(3);
    expect(saddle.shadowAlpha).toBeCloseTo(0.215, 4);

    const perfect = getGutterModel("perfect", 12);
    expect(perfect.curlZoneMm).toBeCloseTo(30.97038, 4);
    expect(perfect.difficulty).toBeCloseTo(0.8743, 4);
    expect(perfect.maxCurlDeg).toBeCloseTo(93.705, 3);
    expect(perfect.openAngleDeg).toBeCloseTo(153.912, 3);
    expect(perfect.strips).toBe(7);
    expect(perfect.shadowAlpha).toBeCloseTo(0.4934, 4);
  });

  it("grows with thickness and stops growing once the book is thick enough", () => {
    for (const binding of ["saddle", "perfect"] as const) {
      let last = 0;
      for (const mm of [0, 1.2, 2, 4, 8, 16, 25]) {
        const { warnMm } = getGutterModel(binding, mm);
        expect(warnMm).toBeGreaterThanOrEqual(last);
        last = warnMm;
      }
      expect(getGutterModel(binding, 60)).toEqual(getGutterModel(binding, 25));
    }
  });

  it("平綴じ always hides more of the page than 中綴じ, and the guide reaches past the rolled band", () => {
    for (const mm of [1.2, 5, 12, 25]) {
      const saddle = getGutterModel("saddle", mm);
      const perfect = getGutterModel("perfect", mm);
      expect(perfect.warnMm).toBeGreaterThan(saddle.warnMm);
      expect(perfect.difficulty).toBeGreaterThan(saddle.difficulty);
      expect(perfect.warnMm).toBeGreaterThanOrEqual(perfect.curlZoneMm + 2.5);
    }
  });
});
