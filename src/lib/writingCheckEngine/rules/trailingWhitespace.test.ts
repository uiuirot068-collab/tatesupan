import { describe, expect, it } from "vitest";
import { checkTrailingWhitespace } from "./trailingWhitespace";

describe("checkTrailingWhitespace (R6-trailing-whitespace)", () => {
  it("flags trailing half-width spaces before a newline", () => {
    const text = "本文である。   \n次の行";
    const issues = checkTrailingWhitespace(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ ruleId: "R6-trailing-whitespace", category: "whitespace", severity: "HIGH_CONFIDENCE", fixClass: "SAFE_AUTO_FIX" });
    expect(text.slice(issues[0].start, issues[0].end)).toBe("   ");
  });

  it("flags a trailing tab", () => {
    const issues = checkTrailingWhitespace("本文\t\n次");
    expect(issues).toHaveLength(1);
  });

  it("flags trailing whitespace at end-of-document (no following newline)", () => {
    const text = "最後の行に余分な空白がある   ";
    const issues = checkTrailingWhitespace(text);
    expect(issues).toHaveLength(1);
    expect(issues[0].end).toBe(text.length);
  });

  it("does NOT flag leading full-width indentation (paragraph-start 全角スペース)", () => {
    expect(checkTrailingWhitespace("　これは字下げされた段落である。")).toEqual([]);
  });

  it("does not flag ordinary clean prose with no trailing whitespace", () => {
    expect(checkTrailingWhitespace("一行目。\n二行目。\n三行目。")).toEqual([]);
  });

  it("suggestedReplacement (empty string) correctly reconstructs the intended clean text", () => {
    const text = "本文である。  \n次の行";
    const issues = checkTrailingWhitespace(text);
    const rebuilt = text.slice(0, issues[0].start) + issues[0].suggestedReplacement!.text + text.slice(issues[0].end);
    expect(rebuilt).toBe("本文である。\n次の行");
  });

  it("CRLF: the \\r is not consumed as part of the flagged trailing-whitespace run", () => {
    const text = "本文。  \r\n次の行";
    const issues = checkTrailingWhitespace(text);
    expect(issues).toHaveLength(1);
    expect(text.slice(issues[0].start, issues[0].end)).toBe("  ");
  });
});
