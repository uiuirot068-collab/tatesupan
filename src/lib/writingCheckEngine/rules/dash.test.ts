import { describe, expect, it } from "vitest";
import { checkDash } from "./dash";

describe("checkDash (R10-dash)", () => {
  it("does not flag the canonical 2-glyph form", () => {
    expect(checkDash("そして――彼は去った")).toEqual([]);
  });

  it("accepts either dash glyph (U+2015 or U+2014) in the canonical 2-glyph form", () => {
    expect(checkDash("そして——彼は去った")).toEqual([]);
  });

  it("flags a solo unpaired dash and proposes doubling the SAME glyph", () => {
    const text = "そして―彼は去った";
    const issues = checkDash(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ ruleId: "R10-dash", fixClass: "REVIEW_BEFORE_FIX", originalText: "―" });
    expect(issues[0].suggestedReplacement).toEqual({ text: "――", mechanicallyCertain: true });
  });

  it("flags a run of 3+ dashes as NOTICE_ONLY with no suggested replacement", () => {
    const text = "そして―――彼は去った";
    const issues = checkDash(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ ruleId: "R10-dash", fixClass: "NOTICE_ONLY", originalText: "―――" });
    expect(issues[0].suggestedReplacement).toBeUndefined();
  });
});
