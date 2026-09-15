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

  it.each([
    "本当？次へ",
    "本当！次へ",
    "本当！？次へ",
    "本当?!次へ",
    "本当！！次へ",
  ])("flags a missing separator after a question/exclamation run: %s", (text) => {
    expect(checkPunctuation(text)).toEqual([
      expect.objectContaining({
        ruleId: "R2-punct",
        category: "punctuation",
        severity: "REVIEW",
        fixClass: "NOTICE_ONLY",
        message: "疑問符・感嘆符の後に空白がありません",
      }),
    ]);
  });

  it.each([
    "「本当？」",
    "『本当！』",
    "本当？\n次へ",
    "本当？　次へ",
    "本当? 次へ",
    "本当？",
  ])("does not flag a closing mark, line boundary, existing space, or end-of-text: %s", (text) => {
    expect(checkPunctuation(text)).toEqual([]);
  });
});
