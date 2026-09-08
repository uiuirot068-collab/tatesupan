import { describe, expect, it } from "vitest";
import { checkTcyNotation } from "./tcy";

describe("checkTcyNotation (R3-tcy)", () => {
  it("a well-formed explicit TCY run produces no diagnostics", () => {
    expect(checkTcyNotation("形式は[tate]A5[/tate]である。")).toEqual([]);
  });

  it("plain text with bare digits (auto-detect TCY, handled by the tokenizer, not this rule) produces no diagnostics", () => {
    expect(checkTcyNotation("西暦20年のことだった。")).toEqual([]);
  });

  it("flags an unmatched [tate] with no closing [/tate]", () => {
    const issues = checkTcyNotation("形式は[tate]A5である。");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ ruleId: "R3-tcy", category: "notation", severity: "HIGH_CONFIDENCE" });
  });

  it("flags an unmatched [/tate] with no preceding [tate]", () => {
    const issues = checkTcyNotation("形式はA5[/tate]である。");
    expect(issues).toHaveLength(1);
  });

  it("flags content longer than the canonical 1-8 character limit as a malformed pair (both markers reported, since neither is 'covered')", () => {
    const issues = checkTcyNotation("[tate]123456789[/tate]"); // 9 chars, exceeds the canonical limit
    expect(issues.length).toBe(2);
  });
});
