import { describe, expect, it } from "vitest";
import { checkRubyNotation } from "./ruby";

describe("checkRubyNotation (R3-ruby)", () => {
  it("a well-formed explicit ruby attempt (｜base《reading》) produces no diagnostics", () => {
    expect(checkRubyNotation("｜東京《とうきょう》に住む。")).toEqual([]);
  });

  it("the half-width pipe marker form is also accepted", () => {
    expect(checkRubyNotation("|東京《とうきょう》に住む。")).toEqual([]);
  });

  it("a bare 《…》 with no ｜/| marker is never touched (ordinary guillemet quoting)", () => {
    expect(checkRubyNotation("《これは引用である》と書いてある。")).toEqual([]);
  });

  it("a lone ｜ with no following 《 is never touched (table/separator use)", () => {
    expect(checkRubyNotation("▶①ページ設定｜▶②書き出し")).toEqual([]);
  });

  it("flags an unclosed 《", () => {
    const issues = checkRubyNotation("｜東京《とうきょうに住む。");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ ruleId: "R3-ruby", category: "notation", severity: "HIGH_CONFIDENCE" });
    expect(issues[0].message).toContain("閉じられていません");
  });

  it("flags a missing base (marker directly followed by 《)", () => {
    const issues = checkRubyNotation("｜《とうきょう》に住む。");
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("前にありません");
  });

  it("flags an empty reading (《》 with nothing inside)", () => {
    const issues = checkRubyNotation("｜東京《》に住む。");
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("入力されていません");
  });
});
