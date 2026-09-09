import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { computeDemoCardPlacement, type DemoRect } from "./demoPlacement";

const viewport = { width: 390, height: 844 };
const card = { width: 366, height: 220 };

function rect(top: number, bottom: number): DemoRect {
  return { top, bottom, left: 24, right: 366, width: 342, height: bottom - top };
}

describe("responsive demo card placement", () => {
  it("places a narrow-viewport card above a bottom target", () => {
    const placement = computeDemoCardPlacement(rect(760, 800), card, viewport);
    expect(placement.side).toBe("above");
    expect(placement.top + card.height).toBeLessThanOrEqual(748);
  });

  it("places the card below a top target when it fits", () => {
    const placement = computeDemoCardPlacement(rect(40, 80), card, viewport);
    expect(placement.side).toBe("below");
    expect(placement.top).toBeGreaterThanOrEqual(92);
  });

  it("keeps the fallback and its fixed action controls inside the viewport", () => {
    const oversized = computeDemoCardPlacement(rect(390, 450), { width: 366, height: 900 }, viewport);
    expect(oversized.side).toBe("floating");
    expect(oversized.top).toBe(12);
    expect(oversized.maxHeight).toBe(820);
    expect(oversized.left).toBeGreaterThanOrEqual(12);
  });

  it("is used by the real tour while its navigation controls stay fixed", () => {
    const tour = readFileSync(join(__dirname, "..", "components", "DemoTour.tsx"), "utf8");
    expect(tour).toContain("computeDemoCardPlacement(");
    expect(tour).toContain("data-demo-placement={placement?.side");
    expect(tour).toMatch(/data-demo-exit=""[\s\S]{0,200}デモを終了/);
    expect(tour).toMatch(/data-demo-next=""[\s\S]{0,200}次へ/);
    expect(tour.match(/flex-none/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
