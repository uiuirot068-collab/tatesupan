import { describe, expect, it } from "vitest";
import { checkEllipsis } from "./ellipsis";

describe("checkEllipsis (R9-ellipsis)", () => {
  it("does not flag the already-canonical paired form", () => {
    expect(checkEllipsis("それは……分からない。")).toEqual([]);
  });

  it("flags ASCII '...' and proposes the canonical '……'", () => {
    const text = "待って...本当に？";
    const issues = checkEllipsis(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ ruleId: "R9-ellipsis", fixClass: "REVIEW_BEFORE_FIX", originalText: "..." });
    expect(issues[0].suggestedReplacement).toEqual({ text: "……", mechanicallyCertain: true });
    expect(text.slice(issues[0].start, issues[0].end)).toBe("...");
  });

  it("flags a run of middle dots '・・・' and proposes '……'", () => {
    const text = "そう・・・かもしれない";
    const issues = checkEllipsis(text);
    expect(issues).toHaveLength(1);
    expect(issues[0].originalText).toBe("・・・");
    expect(issues[0].suggestedReplacement).toEqual({ text: "……", mechanicallyCertain: true });
  });

  it("flags a solo unpaired '…' and proposes doubling it to '……'", () => {
    const text = "彼は…黙っていた";
    const issues = checkEllipsis(text);
    expect(issues).toHaveLength(1);
    expect(issues[0].originalText).toBe("…");
    expect(issues[0].suggestedReplacement).toEqual({ text: "……", mechanicallyCertain: true });
  });

  it("does not double-flag inside an already-paired '……' run", () => {
    const text = "……そして……";
    expect(checkEllipsis(text)).toEqual([]);
  });
});
