import { describe, expect, it } from "vitest";
import {
  groupIndexForPhysicalPage,
  pageAtViewport,
  parsePageNumberInput,
  presentationIndexForPhysicalPage,
  previewNavigationGroups,
  stepPreviewPage,
} from "./pageJump";

const plain = (count: number) => Array.from({ length: count }, (_, index) => index + 1);

describe("parsePageNumberInput", () => {
  it("accepts half-width and full-width digits", () => {
    expect(parsePageNumberInput("15", 226)).toBe(15);
    expect(parsePageNumberInput("１５", 226)).toBe(15);
    expect(parsePageNumberInput(" ７ ", 226)).toBe(7);
    expect(parsePageNumberInput("　３　", 226)).toBe(3);
  });

  it("clamps out-of-range numbers to the first / last page", () => {
    expect(parsePageNumberInput("0", 12)).toBe(1);
    expect(parsePageNumberInput("-5", 12)).toBe(1);
    expect(parsePageNumberInput("－５", 12)).toBe(1);
    expect(parsePageNumberInput("999", 12)).toBe(12);
    expect(parsePageNumberInput("９９９", 12)).toBe(12);
  });

  it("returns null (revert) for anything that is not a whole number", () => {
    for (const raw of ["", "  ", "abc", "1.5", "1-2", "三", "p3", "3ページ"]) {
      expect(parsePageNumberInput(raw, 12)).toBeNull();
    }
  });

  it("returns null when there are no pages", () => {
    expect(parsePageNumberInput("1", 0)).toBeNull();
  });
});

describe("previewNavigationGroups", () => {
  it("見開き: page 1 alone, then 2-3, 4-5 …", () => {
    expect(previewNavigationGroups(6, "spread")).toEqual([[0], [1, 2], [3, 4], [5]]);
  });

  it("1ページ: every page alone", () => {
    expect(previewNavigationGroups(3, "single")).toEqual([[0], [1], [2]]);
    expect(previewNavigationGroups(0, "single")).toEqual([]);
  });
});

describe("physical page → group", () => {
  // 目次 2ページ + 本文 5ページ + 奥付 = 8 physical pages, numbered 1..8.
  const numbers = plain(8);

  it("finds the spread that shows a page (目次・奥付も物理ページ番号で数える)", () => {
    const spreads = previewNavigationGroups(8, "spread");
    expect(groupIndexForPhysicalPage(spreads, numbers, 1)).toBe(0); // 目次1
    expect(groupIndexForPhysicalPage(spreads, numbers, 2)).toBe(1); // 目次2
    expect(groupIndexForPhysicalPage(spreads, numbers, 3)).toBe(1); // 本文1
    expect(groupIndexForPhysicalPage(spreads, numbers, 8)).toBe(4); // 奥付
  });

  it("finds the page in 1ページ表示", () => {
    const singles = previewNavigationGroups(8, "single");
    expect(groupIndexForPhysicalPage(singles, numbers, 5)).toBe(4);
  });

  it("uses the preview's physical-number table when it is not a plain run", () => {
    expect(presentationIndexForPhysicalPage([1, 2, 5, 6], 5)).toBe(2);
    // Unknown numbers fall back to page - 1, clamped into range.
    expect(presentationIndexForPhysicalPage([1, 2, 3], 9)).toBe(2);
    expect(presentationIndexForPhysicalPage([], 4)).toBe(0);
  });

  it("returns null with no pages", () => {
    expect(groupIndexForPhysicalPage([], [], 1)).toBeNull();
  });
});

describe("stepPreviewPage (‹ ›)", () => {
  const numbers = plain(7);
  const spreads = previewNavigationGroups(7, "spread"); // [1] [2,3] [4,5] [6,7]
  const singles = previewNavigationGroups(7, "single");

  it("見開き moves a whole spread and lands on its first page", () => {
    expect(stepPreviewPage(1, 1, spreads, numbers)).toBe(2);
    expect(stepPreviewPage(2, 1, spreads, numbers)).toBe(4);
    expect(stepPreviewPage(3, 1, spreads, numbers)).toBe(4);
    expect(stepPreviewPage(5, -1, spreads, numbers)).toBe(2);
    expect(stepPreviewPage(2, -1, spreads, numbers)).toBe(1);
  });

  it("1ページ moves one page", () => {
    expect(stepPreviewPage(3, 1, singles, numbers)).toBe(4);
    expect(stepPreviewPage(3, -1, singles, numbers)).toBe(2);
  });

  it("stays put at either end", () => {
    expect(stepPreviewPage(1, -1, spreads, numbers)).toBe(1);
    expect(stepPreviewPage(7, 1, spreads, numbers)).toBe(7);
    expect(stepPreviewPage(6, 1, spreads, numbers)).toBe(6);
    expect(stepPreviewPage(7, 1, singles, numbers)).toBe(7);
  });
});

describe("pageAtViewport", () => {
  const numbers = plain(5);
  const spreads = previewNavigationGroups(5, "spread"); // [1] [2,3] [4,5]
  const layouts = [
    { spreadIndex: 0, top: 0, height: 100 },
    { spreadIndex: 1, top: 124, height: 100 },
    { spreadIndex: 2, top: 248, height: 100 },
  ];

  it("shows the first page of the spread under the viewport centre", () => {
    expect(pageAtViewport(layouts, 50, spreads, numbers, 1)).toBe(1);
    expect(pageAtViewport(layouts, 170, spreads, numbers, 1)).toBe(2);
    expect(pageAtViewport(layouts, 300, spreads, numbers, 2)).toBe(4);
  });

  it("keeps the current page when it is in that spread (e.g. after jumping to page 3)", () => {
    expect(pageAtViewport(layouts, 170, spreads, numbers, 3)).toBe(3);
  });

  it("attaches the gap between spreads to the nearest spread", () => {
    expect(pageAtViewport(layouts, 110, spreads, numbers, 1)).toBe(1);
    expect(pageAtViewport(layouts, 120, spreads, numbers, 1)).toBe(2);
  });

  it("returns null without layout", () => {
    expect(pageAtViewport([], 10, spreads, numbers, 1)).toBeNull();
  });
});
