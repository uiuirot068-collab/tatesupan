import { describe, expect, it } from "vitest";
import {
  BOOK3D_AJAR_ANGLE,
  book3dFitScale,
  book3dOpenAngle,
  book3dSpreadForPage,
  book3dViewForOpenState,
  parseGutterGuidePref,
  parseGutterHelpPref,
} from "./book3dModel";
import {
  BOOK3D_MAX_VISUAL_THICKNESS_MM,
  BOOK3D_MIN_VISUAL_THICKNESS_MM,
  describeBook3DThickness,
  describeBook3DThicknessNotice,
  getBook3DThickness,
} from "./book3dThickness";
import { buildGutterChain } from "./book3dBinding";
import { clampPitch, normalizeYaw, spineViewYaw } from "./book3dView";
import { getGutterModel } from "../gutterZone";

const run = (n: number) => Array.from({ length: n }, (_, index) => index + 1);

describe("CST-PORT-012 3D: which two pages the open book shows", () => {
  it("page 1 stands alone on the left (inside of the front cover on the right)", () => {
    expect(book3dSpreadForPage(run(10), 1)).toEqual({ leftIndex: 0, rightIndex: null, leftPage: 1, rightPage: null });
  });

  it("pairs 2-3, 4-5 like the 見開き preview: odd on the left, even on the right", () => {
    expect(book3dSpreadForPage(run(10), 2)).toEqual({ leftIndex: 2, rightIndex: 1, leftPage: 3, rightPage: 2 });
    expect(book3dSpreadForPage(run(10), 3)).toEqual({ leftIndex: 2, rightIndex: 1, leftPage: 3, rightPage: 2 });
    expect(book3dSpreadForPage(run(10), 5)).toEqual({ leftIndex: 4, rightIndex: 3, leftPage: 5, rightPage: 4 });
  });

  it("a last even page faces the back cover", () => {
    expect(book3dSpreadForPage(run(10), 10)).toEqual({ leftIndex: null, rightIndex: 9, leftPage: null, rightPage: 10 });
  });

  it("clamps out-of-range pages and handles an empty book", () => {
    expect(book3dSpreadForPage(run(4), 99).rightPage).toBe(4);
    expect(book3dSpreadForPage([], 1)).toEqual({ leftIndex: null, rightIndex: null, leftPage: null, rightPage: null });
  });

  it("uses the physical page numbers (目次・奥付 included) for left / right", () => {
    // presentation index 0..4 → physical 1..5
    expect(book3dSpreadForPage([1, 2, 3, 4, 5], 4)).toEqual({ leftIndex: 4, rightIndex: 3, leftPage: 5, rightPage: 4 });
  });
});

describe("CST-PORT-012 3D: open angles, cameras and fit (CST values)", () => {
  const saddle = getGutterModel("saddle", 3);
  const perfect = getGutterModel("perfect", 12);

  it("closed 0°, ajar 34°, open from the binding model", () => {
    expect(book3dOpenAngle("closed", saddle)).toBe(0);
    expect(book3dOpenAngle("ajar", perfect)).toBe(BOOK3D_AJAR_ANGLE);
    expect(book3dOpenAngle("open", saddle)).toBe(176);
    expect(book3dOpenAngle("open", perfect)).toBeLessThan(164);
  });

  it("each open state has its own camera; the closed one shows the spine side", () => {
    expect(book3dViewForOpenState("open", "right")).toEqual({ yaw: 0, pitch: 16 });
    expect(book3dViewForOpenState("ajar", "right")).toEqual({ yaw: 30, pitch: -10 });
    expect(book3dViewForOpenState("closed", "right")).toEqual({ yaw: -32, pitch: -8 });
    expect(spineViewYaw("right")).toBe(-90);
  });

  it("fits inside the stage and never rescales by angle", () => {
    const scale = book3dFitScale({ width: 800, height: 600 }, 300, 420, "closed");
    expect(scale * 300).toBeLessThanOrEqual(800 * 0.86);
    expect(scale * 420).toBeLessThanOrEqual(600 * 0.8);
    expect(book3dFitScale({ width: 0, height: 0 }, 300, 420, "open")).toBe(0.5);
    // a very small stage still leaves the safe margin
    const small = book3dFitScale({ width: 200, height: 160 }, 300, 420, "ajar");
    expect(small * 420 * 1.36).toBeLessThanOrEqual(160 - 28 + 0.001);
  });

  it("camera values stay in range", () => {
    expect(normalizeYaw(190)).toBe(-170);
    expect(normalizeYaw(-180)).toBe(180);
    expect(clampPitch(90)).toBe(24);
  });
});

describe("CST-PORT-012 3D: thickness (visual only)", () => {
  it("the cover's spine width wins when set", () => {
    const t = getBook3DThickness(8, 120);
    expect(t.source).toBe("spine");
    expect(t.thicknessMm).toBe(8);
    expect(describeBook3DThickness(t)).toBe("厚み 8.0mm（設定した背幅）");
  });

  it("estimates from the page count otherwise", () => {
    const t = getBook3DThickness(0, 100);
    expect(t.source).toBe("estimate");
    expect(t.estimateMm).toBeCloseTo(50 * 0.09 + 0.5);
    expect(describeBook3DThickness(t)).toBe("厚み 約5.0mm（ページ数から推定）");
  });

  it("clamps for display and warns about an implausible spine", () => {
    expect(getBook3DThickness(0, 0).thicknessMm).toBe(BOOK3D_MIN_VISUAL_THICKNESS_MM);
    expect(getBook3DThickness(80, 100).thicknessMm).toBe(BOOK3D_MAX_VISUAL_THICKNESS_MM);
    expect(describeBook3DThicknessNotice(getBook3DThickness(30, 20))).toContain("背幅が大きく");
    expect(describeBook3DThicknessNotice(getBook3DThickness(1, 400))).toContain("背幅が小さく");
    expect(describeBook3DThicknessNotice(getBook3DThickness(5, 100))).toBeNull();
  });
});

describe("CST-PORT-012 3D: gutter curl chain", () => {
  it("starts on the spine axis and rises outward", () => {
    const model = getGutterModel("perfect", 10);
    const chain = buildGutterChain(60, model, 1);
    expect(chain.strips).toHaveLength(model.strips);
    expect(chain.strips[0].fromSpinePx).toBe(0);
    expect(chain.strips[0].risePx).toBe(0);
    expect(chain.reachPx).toBeGreaterThan(0);
    expect(chain.reachPx).toBeLessThanOrEqual(60);
    expect(chain.risePx).toBeGreaterThan(0);
    // steepest at the spine
    expect(chain.strips[0].angleDeg).toBeGreaterThan(chain.strips[chain.strips.length - 1].angleDeg);
    expect(chain.shadeAt(0)).toBeGreaterThan(chain.shadeAt(model.strips));
  });

  it("is flat when the book is closed (intensity 0)", () => {
    const chain = buildGutterChain(60, getGutterModel("saddle", 3), 0);
    expect(chain.risePx).toBe(0);
    expect(chain.reachPx).toBeCloseTo(60);
  });
});

describe("CST-PORT-012 3D: per-browser preferences", () => {
  it("ノド注意 is on and its explanation shows until turned off", () => {
    expect(parseGutterGuidePref(null)).toBe(true);
    expect(parseGutterGuidePref("off")).toBe(false);
    expect(parseGutterHelpPref(null)).toBe(true);
    expect(parseGutterHelpPref("dismissed")).toBe(false);
  });
});
