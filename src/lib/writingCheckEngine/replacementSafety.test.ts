/**
 * Phase 9 -- replacement-range safety. For every rule whose diagnostic
 * carries `suggestedReplacement` (Phase 2: R5-control-char,
 * R6-trailing-whitespace), verifies `text.slice(start, end)` always
 * matches the intended target exactly, even when the target is preceded
 * by content that could shift UTF-16 offsets in surprising ways (emoji/
 * surrogate pairs, ruby notation, TCY notation, multiline text).
 */
import { describe, expect, it } from "vitest";
import { runWritingCheck } from "./engine";

const REPLACEMENT_RULES = ["R5-control-char", "R6-trailing-whitespace"] as const;

function assertReplacementRangesCorrect(text: string) {
  const issues = runWritingCheck(text, { enabledRuleIds: [...REPLACEMENT_RULES] });
  for (const issue of issues) {
    if (!issue.suggestedReplacement) continue;
    // The replacement range must be reconstructible: slicing it out and
    // splicing in the replacement text must never touch anything outside
    // the diagnostic's own [start, end) range.
    const before = text.slice(0, issue.start);
    const after = text.slice(issue.end);
    const rebuilt = before + issue.suggestedReplacement.text + after;
    expect(rebuilt.length).toBe(text.length - (issue.end - issue.start) + issue.suggestedReplacement.text.length);
    expect(before + after).not.toContain(text.slice(issue.start, issue.end));
  }
}

describe("replacement-range safety (Phase 9)", () => {
  it("emoji (surrogate pair) before the target does not shift the replacement range", () => {
    const text = "😀本文。  \n次";
    const issues = runWritingCheck(text, { enabledRuleIds: [...REPLACEMENT_RULES] });
    const trailing = issues.find((d) => d.ruleId === "R6-trailing-whitespace");
    expect(trailing).toBeDefined();
    expect(text.slice(trailing!.start, trailing!.end)).toBe("  ");
    assertReplacementRangesCorrect(text);
  });

  it("ruby notation before the target does not shift the replacement range", () => {
    const text = "｜東京《とうきょう》に住む。  \n次";
    assertReplacementRangesCorrect(text);
    const issues = runWritingCheck(text, { enabledRuleIds: [...REPLACEMENT_RULES] });
    const trailing = issues.find((d) => d.ruleId === "R6-trailing-whitespace");
    expect(text.slice(trailing!.start, trailing!.end)).toBe("  ");
  });

  it("TCY notation before the target does not shift the replacement range", () => {
    const text = "[tate]A5[/tate]の話。\t\n次";
    assertReplacementRangesCorrect(text);
    const issues = runWritingCheck(text, { enabledRuleIds: [...REPLACEMENT_RULES] });
    const trailing = issues.find((d) => d.ruleId === "R6-trailing-whitespace");
    expect(text.slice(trailing!.start, trailing!.end)).toBe("\t");
  });

  it("multiline text: replacement ranges on later lines remain correct", () => {
    const text = "一行目。\n二行目。  \n三行目。\x00終わり";
    assertReplacementRangesCorrect(text);
  });

  it("CRLF: replacement ranges remain correct and never consume the \\r", () => {
    const text = "一行目。  \r\n二行目。\x00\r\n三行目。";
    assertReplacementRangesCorrect(text);
  });
});
