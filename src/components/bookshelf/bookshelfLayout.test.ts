import { describe, expect, it } from "vitest";
import { bookWidthForCharacterCount } from "./bookshelfLayout";

describe("bookWidthForCharacterCount — TSP-PAGED-EDITOR-QA-FIXES-AND-DEMO-010 §H 5-level scheme", () => {
  it.each([
    [0, 30],
    [9_999, 30],
    [10_000, 40],
    [49_999, 40],
    [50_000, 50],
    [99_999, 50],
    [100_000, 60],
    [299_999, 60],
    [300_000, 70],
    [300_001, 70],
    [500_000, 70],
  ])("maps %i characters to a %ipx spine", (characterCount, expectedWidth) => {
    expect(bookWidthForCharacterCount(characterCount)).toBe(expectedWidth);
  });

  it("never exceeds the maximum thickness for arbitrarily long manuscripts", () => {
    expect(bookWidthForCharacterCount(1_000_000)).toBe(70);
    expect(bookWidthForCharacterCount(10_000_000)).toBe(70);
  });
});
