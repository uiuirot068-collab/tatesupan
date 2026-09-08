import { describe, expect, it } from "vitest";
import { checkBlankRun } from "./blankRun";

describe("checkBlankRun (R8-blank-run)", () => {
  it("does not flag a single blank line (1 blank line = ordinary paragraph gap)", () => {
    expect(checkBlankRun("一段落目。\n\n二段落目。")).toEqual([]);
  });

  it("does not flag two consecutive blank lines (still ordinary in fiction)", () => {
    expect(checkBlankRun("一段落目。\n\n\n二段落目。")).toEqual([]);
  });

  it("flags three or more consecutive blank lines", () => {
    const text = "一段落目。\n\n\n\n二段落目。"; // 3 blank lines between the two real lines
    const issues = checkBlankRun(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ ruleId: "R8-blank-run", category: "whitespace", severity: "REVIEW", fixClass: "NOTICE_ONLY" });
  });

  it("flags an even longer blank run as a single diagnostic", () => {
    const text = "前。\n\n\n\n\n\n後。"; // 5 blank lines
    const issues = checkBlankRun(text);
    expect(issues).toHaveLength(1);
  });
});
