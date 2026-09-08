import { describe, expect, it } from "vitest";
import { checkHalfwidthKana } from "./halfwidthKana";

describe("checkHalfwidthKana (R4-halfwidth-kana)", () => {
  it("flags a real half-width katakana run", () => {
    const text = "ﾃｽﾄ";
    const issues = checkHalfwidthKana(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ ruleId: "R4-halfwidth-kana", category: "character", severity: "HIGH_CONFIDENCE", fixClass: "REVIEW_BEFORE_FIX" });
    expect(text.slice(issues[0].start, issues[0].end)).toBe("ﾃｽﾄ");
  });

  it("does not flag ordinary full-width katakana", () => {
    expect(checkHalfwidthKana("テスト")).toEqual([]);
  });

  it("does not flag Latin letters/digits", () => {
    expect(checkHalfwidthKana("TateSpun v2, 2026 edition.")).toEqual([]);
  });

  it("does not flag valid TCY or ruby notation", () => {
    expect(checkHalfwidthKana("[tate]A5[/tate]｜東京《とうきょう》")).toEqual([]);
  });

  it("has no suggestedReplacement yet (conversion table deferred, see module doc)", () => {
    const issues = checkHalfwidthKana("ﾃｽﾄ");
    expect(issues[0].suggestedReplacement).toBeUndefined();
  });
});
