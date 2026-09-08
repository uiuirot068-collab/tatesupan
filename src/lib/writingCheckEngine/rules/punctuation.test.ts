import { describe, expect, it } from "vitest";
import { checkPunctuation } from "./punctuation";

describe("checkPunctuation (R2-punct)", () => {
  it("ordinary single 。 and 、 produce no diagnostics", () => {
    expect(checkPunctuation("これは、普通の文である。")).toEqual([]);
  });

  it("flags a duplicated 。。", () => {
    const issues = checkPunctuation("おかしい。。");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ ruleId: "R2-punct", category: "punctuation", severity: "HIGH_CONFIDENCE" });
  });

  it("flags a duplicated 、、", () => {
    const issues = checkPunctuation("おかしい、、それで");
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("読点");
  });

  it("does NOT flag intentional fiction-style repetition (！！, ！？, ……, ――)", () => {
    expect(checkPunctuation("すごい！！　そうなの？！　……そうか。　――だがしかし。")).toEqual([]);
  });
});
