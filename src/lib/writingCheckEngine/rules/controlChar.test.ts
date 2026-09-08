import { describe, expect, it } from "vitest";
import { checkControlChars } from "./controlChar";

describe("checkControlChars (R5-control-char)", () => {
  it("flags a stray NUL/backspace-style control character", () => {
    const text = "本文\x00続き";
    const issues = checkControlChars(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ ruleId: "R5-control-char", category: "character", severity: "HIGH_CONFIDENCE", fixClass: "SAFE_AUTO_FIX" });
    expect(issues[0].suggestedReplacement).toEqual({ text: "", mechanicallyCertain: true });
    expect(text.slice(issues[0].start, issues[0].end)).toBe("\x00");
  });

  it("does not flag tab, newline, or CRLF (legitimate control characters)", () => {
    expect(checkControlChars("本文\t続き\n次の行\r\n次々行")).toEqual([]);
  });

  it("does not flag ordinary clean prose", () => {
    expect(checkControlChars("これは通常の文章である。")).toEqual([]);
  });

  it("the suggestedReplacement range, when applied, removes exactly the flagged run and nothing else", () => {
    const text = "前\x01\x02後";
    const issues = checkControlChars(text);
    expect(issues).toHaveLength(1);
    const rebuilt = text.slice(0, issues[0].start) + issues[0].suggestedReplacement!.text + text.slice(issues[0].end);
    expect(rebuilt).toBe("前後");
  });
});
