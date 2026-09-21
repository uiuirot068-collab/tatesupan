import { describe, expect, it } from "vitest";
import {
  DEFAULT_REVIEW_HUB_FOOTER_TOOLS,
  REVIEW_HUB_FOOTER_MAX,
  REVIEW_HUB_FOOTER_STORAGE_KEY,
  REVIEW_HUB_FOOTER_TOOL_IDS,
  moveReviewHubFooterTool,
  normalizeReviewHubFooterTools,
  toggleReviewHubFooterTool,
  type ReviewHubFooterToolId,
} from "./reviewHubFooterPins";
import { REVIEW_HUB_TOOLS } from "./reviewHub";

/**
 * B2 contract, re-proved as tools were added: max 2 pinned, pinned != enabled,
 * pin order = display order, browser-local persistence. B4 creates the first
 * true 3-tool state (文章チェックβ / 文字数カウント / 音読β).
 */
describe("B2 footer pins with three tools (B4)", () => {
  it("every registered Hub tool can be pinned, and the pin ids are exactly the registry ids", () => {
    expect([...REVIEW_HUB_FOOTER_TOOL_IDS]).toEqual(REVIEW_HUB_TOOLS.map((tool) => tool.id));
    expect(REVIEW_HUB_FOOTER_MAX).toBe(2);
  });

  it("the default is unchanged (文章チェックβ + 文字数カウント); the new tool is NOT pinned by default", () => {
    expect(DEFAULT_REVIEW_HUB_FOOTER_TOOLS).toEqual(["writing-check", "character-count"]);
    expect(normalizeReviewHubFooterTools(undefined)).toEqual(["writing-check", "character-count"]);
    expect(normalizeReviewHubFooterTools("junk")).toEqual(["writing-check", "character-count"]);
  });

  it("max-2 is enforced on pinning: a third pin is refused and the current pair is left untouched", () => {
    const pair: ReviewHubFooterToolId[] = ["writing-check", "character-count"];
    expect(toggleReviewHubFooterTool(pair, "read-aloud")).toEqual(pair);
    expect(toggleReviewHubFooterTool(["character-count", "read-aloud"], "writing-check")).toEqual(["character-count", "read-aloud"]);
    expect(toggleReviewHubFooterTool(["writing-check", "read-aloud"], "character-count")).toEqual(["writing-check", "read-aloud"]);
  });

  it("unpin then pin works: unpinning frees a slot, and the new pin appends (order = display order)", () => {
    let pins: ReviewHubFooterToolId[] = ["writing-check", "character-count"];
    pins = toggleReviewHubFooterTool(pins, "writing-check"); // unpin
    expect(pins).toEqual(["character-count"]);
    pins = toggleReviewHubFooterTool(pins, "read-aloud"); // now allowed
    expect(pins).toEqual(["character-count", "read-aloud"]);
    pins = toggleReviewHubFooterTool(pins, "character-count");
    pins = toggleReviewHubFooterTool(pins, "writing-check");
    expect(pins).toEqual(["read-aloud", "writing-check"]);
  });

  it("can hold zero pins and any pair of the three tools", () => {
    expect(normalizeReviewHubFooterTools([])).toEqual([]);
    const ids = [...REVIEW_HUB_FOOTER_TOOL_IDS];
    for (const a of ids) for (const b of ids) if (a !== b) expect(normalizeReviewHubFooterTools([a, b])).toEqual([a, b]);
  });

  it("reorders a pair with one swap and never exceeds two; moving an unpinned tool is a no-op", () => {
    expect(moveReviewHubFooterTool(["read-aloud", "writing-check"], "read-aloud", 1)).toEqual(["writing-check", "read-aloud"]);
    expect(moveReviewHubFooterTool(["read-aloud", "writing-check"], "read-aloud", -1)).toEqual(["read-aloud", "writing-check"]);
    expect(moveReviewHubFooterTool(["writing-check", "character-count"], "read-aloud", 1)).toEqual(["writing-check", "character-count"]);
  });

  it("a stored value (browser-local JSON) round-trips, is clamped to two, de-duplicated and stripped of unknown ids", () => {
    expect(REVIEW_HUB_FOOTER_STORAGE_KEY).toBe("tatespun.reviewHub.footerTools.v1"); // same key: B2 selections keep working
    const roundTrip = (value: unknown) => normalizeReviewHubFooterTools(JSON.parse(JSON.stringify(value)));
    expect(roundTrip(["read-aloud", "character-count"])).toEqual(["read-aloud", "character-count"]);
    expect(roundTrip(["read-aloud", "read-aloud", "writing-check", "character-count"])).toEqual(["read-aloud", "writing-check"]);
    expect(roundTrip(["nonexistent", "read-aloud", 7, null])).toEqual(["read-aloud"]);
    // a B2/B3-era stored value is still valid as-is
    expect(roundTrip(["character-count", "writing-check"])).toEqual(["character-count", "writing-check"]);
  });
});
