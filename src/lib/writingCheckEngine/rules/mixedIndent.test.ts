import { describe, expect, it } from "vitest";
import { checkMixedIndent } from "./mixedIndent";

describe("checkMixedIndent (R7-mixed-indent)", () => {
  it("flags a leading run mixing a tab and a full-width ideographic space", () => {
    const text = "一行目。\n\t　二行目。";
    const issues = checkMixedIndent(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ ruleId: "R7-mixed-indent", category: "whitespace", severity: "HIGH_CONFIDENCE", fixClass: "REVIEW_BEFORE_FIX" });
  });

  it("flags the mix regardless of order (space-then-tab)", () => {
    expect(checkMixedIndent("　\t行頭")).toHaveLength(1);
  });

  it("does NOT flag pure ideographic-space indentation (a real, common convention)", () => {
    expect(checkMixedIndent("　これは通常の字下げである。")).toEqual([]);
  });

  it("does NOT flag pure tab indentation alone", () => {
    expect(checkMixedIndent("\tこれもタブのみである。")).toEqual([]);
  });

  it("does NOT flag no indentation at all (dialogue lines starting with 「, a real convention)", () => {
    expect(checkMixedIndent("「おい」と彼は言った。")).toEqual([]);
  });
});
