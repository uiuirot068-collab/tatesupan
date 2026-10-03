import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEMO_STEPS } from "@/constants/demoData";
import { computeDemoCardPlacement, type DemoRect } from "./demoPlacement";

// TSP-DEMO-001 — the おためしデモ on phones (first-visit retest: the guide hid
// the toolbar / preview, the preview was too small to read, printing words
// went unexplained, and ［デモを終了］ left the demo when people only wanted
// the guide gone).

const source = (path: string) => readFileSync(resolve(path), "utf8");
const phone = { width: 390, height: 844 };
const card = { width: 366, height: 520 };

describe("TSP-DEMO-001 phone placement", () => {
  it("caps the guide's height so it never covers most of the screen", () => {
    const target: DemoRect = { top: 240, bottom: 280, left: 12, right: 80, width: 68, height: 40 };
    const cap = Math.round(phone.height * 0.42);
    const placement = computeDemoCardPlacement(target, card, phone, "auto", { maxCardHeight: cap });
    expect(placement.maxHeight).toBeLessThanOrEqual(cap);
    expect(placement.top).toBeGreaterThanOrEqual(280);
  });

  it("docks a guide with nothing to point at to the bottom, not the middle", () => {
    const small = { width: 366, height: 200 };
    const placement = computeDemoCardPlacement(null, small, phone, "auto", { freeDock: "bottom" });
    expect(placement.top).toBe(phone.height - small.height - 12);
    const desktopDefault = computeDemoCardPlacement(null, small, phone);
    expect(desktopDefault.top).toBe((phone.height - small.height) / 2);
  });

  it("keeps the target uncovered when the capped card fits on neither side", () => {
    const target: DemoRect = { top: 380, bottom: 460, left: 12, right: 320, width: 308, height: 80 };
    const placement = computeDemoCardPlacement(target, { width: 366, height: 900 }, phone, "auto", { maxCardHeight: 300 });
    const bottom = placement.top + placement.maxHeight;
    expect(placement.top >= target.bottom || bottom <= target.top).toBe(true);
    expect(placement.maxHeight).toBeLessThanOrEqual(300);
  });
});

describe("TSP-DEMO-001 plain words for printing terms", () => {
  const terms = new Map(DEMO_STEPS.flatMap((step) => step.terms ?? []).map((t) => [t.word, t.meaning]));
  it("explains ノンブル・柱・段組・奥付・ルビ・縦中横", () => {
    for (const word of ["ノンブル", "柱", "段組", "奥付", "ルビ", "縦中横"]) {
      expect(terms.get(word)).toBeTruthy();
    }
    const nombre = DEMO_STEPS.find((step) => step.title === "ノンブルや柱も設定できるよ");
    expect(nombre?.terms?.map((t) => t.word)).toEqual(["ノンブル", "柱"]);
  });
});

describe("TSP-DEMO-001 guide controls", () => {
  const tour = source("src/components/DemoTour.tsx");
  const pane = source("src/components/PreviewPane.tsx");
  const shell = source("src/components/TategakiEditor.tsx");

  it("can fold the guide away without leaving the demo", () => {
    expect(tour).toContain('data-demo-collapse=""');
    expect(tour).toContain('data-demo-expand=""');
    expect(tour).toContain("案内をたたむ");
    expect(tour).toContain("案内を開く");
  });

  it("asks once before ［デモを終了］ leaves the demo", () => {
    expect(tour).toContain('onClick={() => setConfirmingExit(true)}');
    expect(tour).toContain('data-demo-exit-confirm-button=""');
    expect(tour).toContain("デモを続ける");
    const exitButton = tour.slice(tour.indexOf('data-demo-exit=""'), tour.indexOf("デモを終了"));
    expect(exitButton).not.toContain("onClick={onExit}");
  });

  it("opens the demo's phone preview one page at a time without rewriting the saved choice", () => {
    expect(shell).toContain("startSinglePageOnNarrow={demoMode}");
    expect(pane).toContain('const pageLayout = isNarrow && singlePageOverride ? "single" : storedPageLayout;');
    expect(pane).toContain("setSinglePageOverride(false);");
  });

  it("shows the phone preview's real size (100% floor), never 50%", () => {
    expect(pane).toContain("const zoomFloor = isNarrow ? 1 : ZOOM_MIN;");
    expect(pane).toContain("{Math.round(displayedZoom * 100)}%");
  });
});
