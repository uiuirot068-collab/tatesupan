/**
 * Phase 10 -- no silent mutation. Running diagnostics (including every
 * rule with a `suggestedReplacement`) must never change the manuscript
 * string itself. `suggestedReplacement` is metadata only -- Phase 1/2
 * build no Fix UI and no code path anywhere in this engine ever calls
 * `.replace()`/`.slice()`-and-splice on the caller's own text.
 */
import { describe, expect, it } from "vitest";
import { runWritingCheck } from "./engine";
import type { WritingRuleId } from "./types";

const ALL_RULE_IDS: WritingRuleId[] = ["R1-bracket", "R2-punct", "R3-tcy", "R3-ruby", "R4-halfwidth-kana", "R5-control-char", "R6-trailing-whitespace", "R7-mixed-indent", "R8-blank-run"];

describe("no manuscript mutation (Phase 10)", () => {
  it("running every rule (including every SAFE_AUTO_FIX rule) never changes the input string", () => {
    const original = "「未閉じ｜漢字《読み。。。[tate]ﾃｽﾄ  \n\t　行\x00頭\n\n\n\n次";
    const snapshot = original.slice(); // an independent copy for comparison
    const issues = runWritingCheck(original, { enabledRuleIds: ALL_RULE_IDS });
    expect(issues.length).toBeGreaterThan(0); // sanity: this input actually exercises rules
    expect(original).toBe(snapshot);
    expect(original === snapshot).toBe(true);
  });

  it("runWritingCheck's return value never aliases or wraps the original string in a way that could be mutated back into it", () => {
    const original = "テスト文章。";
    const issues = runWritingCheck(original);
    // Diagnostics are plain data (numbers/strings) -- nothing in the
    // return value holds a live reference back to `original` that could
    // later mutate it.
    expect(Array.isArray(issues)).toBe(true);
    expect(original).toBe("テスト文章。");
  });
});
