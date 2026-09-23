import { describe, expect, it } from "vitest";
import {
  DEFAULT_REVIEW_HUB_FOOTER_TOOLS,
  moveReviewHubFooterTool,
  normalizeReviewHubFooterTools,
  REVIEW_HUB_FOOTER_MAX,
  toggleReviewHubFooterTool,
} from "../../src/lib/reviewHubFooterPins";

describe("B2 review hub footer pins", () => {
  it("defaults to both tools shown, i.e. the footer exactly as it was before B2", () => {
    expect(DEFAULT_REVIEW_HUB_FOOTER_TOOLS).toEqual(["writing-check", "character-count"]);
  });

  it("keeps only supported unique tools and never exceeds two", () => {
    expect(REVIEW_HUB_FOOTER_MAX).toBe(2);
    expect(
      normalizeReviewHubFooterTools([
        "character-count",
        "writing-check",
        "character-count",
        "unknown",
      ]),
    ).toEqual(["character-count", "writing-check"]);
  });

  it("falls back safely when storage is structurally corrupt", () => {
    const fallback = ["writing-check", "character-count"];
    expect(normalizeReviewHubFooterTools(null)).toEqual(fallback);
    expect(normalizeReviewHubFooterTools("broken")).toEqual(fallback);
    expect(normalizeReviewHubFooterTools({ broken: true })).toEqual(fallback);
    // an explicit empty list is a real choice (0 shown), not corruption
    expect(normalizeReviewHubFooterTools([])).toEqual([]);
  });

  it("supports zero, one and two displayed tools", () => {
    expect(
      toggleReviewHubFooterTool(["character-count"], "character-count"),
    ).toEqual([]);
    expect(toggleReviewHubFooterTool([], "writing-check")).toEqual([
      "writing-check",
    ]);
    expect(
      toggleReviewHubFooterTool(["writing-check"], "character-count"),
    ).toEqual(["writing-check", "character-count"]);
  });

  it("reorders the two slots without changing tool state", () => {
    expect(
      moveReviewHubFooterTool(
        ["character-count", "writing-check"],
        "writing-check",
        -1,
      ),
    ).toEqual(["writing-check", "character-count"]);
  });
});
