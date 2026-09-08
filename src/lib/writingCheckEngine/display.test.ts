import { describe, expect, it } from "vitest";
import { runWritingCheck } from "./engine";
import { mergeIssueRanges, buildWritingSegments, issueContext } from "./display";

describe("buildWritingSegments -- reconstruction guarantee (no manuscript mutation)", () => {
  it("segments always reconstruct the original text exactly, byte-for-byte, for any range set", () => {
    const text = "「未閉じ｜漢字《読み\n次の行にも問題がある。。";
    const issues = runWritingCheck(text);
    const ranges = mergeIssueRanges(issues);
    const segments = buildWritingSegments(text, ranges);
    expect(segments.map((s) => s.text).join("")).toBe(text);
  });

  it("with no ranges, returns the whole text as a single unflagged segment", () => {
    const segments = buildWritingSegments("普通の文章である。", []);
    expect(segments).toEqual([{ text: "普通の文章である。", flagged: false }]);
  });

  it("empty text with no ranges returns an empty segment list", () => {
    expect(buildWritingSegments("", [])).toEqual([]);
  });

  it("out-of-bounds ranges are clamped defensively, never throwing and never corrupting reconstruction", () => {
    const text = "短い文";
    const segments = buildWritingSegments(text, [{ start: -5, end: 9999 }]);
    expect(segments.map((s) => s.text).join("")).toBe(text);
  });
});

describe("mergeIssueRanges", () => {
  it("merges overlapping and touching ranges into the minimal set", () => {
    const merged = mergeIssueRanges([
      { id: "a", start: 0, end: 3, ruleId: "R1-bracket", category: "structure", severity: "HIGH_CONFIDENCE", message: "x" },
      { id: "b", start: 3, end: 6, ruleId: "R1-bracket", category: "structure", severity: "HIGH_CONFIDENCE", message: "x" },
      { id: "c", start: 10, end: 12, ruleId: "R1-bracket", category: "structure", severity: "HIGH_CONFIDENCE", message: "x" },
    ]);
    expect(merged).toEqual([
      { start: 0, end: 6 },
      { start: 10, end: 12 },
    ]);
  });
});

describe("Unicode / offset safety", () => {
  it("a diagnostic range for text after an emoji (surrogate pair) still lands on the correct real characters", () => {
    // "😀" is a surrogate pair (2 UTF-16 code units), matching textarea
    // selectionStart/End semantics exactly -- diagnostics must use the
    // SAME UTF-16 indexing, not a code-point count, or highlighting
    // would visibly drift after any astral-plane character.
    const text = "😀「未閉じ";
    const issues = runWritingCheck(text);
    expect(issues).toHaveLength(1);
    const bracketIndex = text.indexOf("「");
    expect(issues[0].start).toBe(bracketIndex);
    expect(text.slice(issues[0].start, issues[0].end)).toBe("「");
  });

  it("multiline text: diagnostic offsets remain correct across newline boundaries", () => {
    const text = "一行目は正常。\n二行目に「未閉じがある";
    const issues = runWritingCheck(text);
    expect(issues).toHaveLength(1);
    expect(text.slice(issues[0].start, issues[0].end)).toBe("「");
  });

  it("CRLF line endings do not shift diagnostic offsets", () => {
    const text = "一行目。\r\n「未閉じ";
    const issues = runWritingCheck(text);
    expect(issues).toHaveLength(1);
    expect(text.slice(issues[0].start, issues[0].end)).toBe("「");
  });

  it("issueContext renders embedded newlines as ↵ so a snippet stays on one line", () => {
    const text = "前置き\n「未閉じ\n後書き";
    const issues = runWritingCheck(text);
    const ctx = issueContext(text, issues[0], 10);
    expect(ctx.before).not.toContain("\n");
    expect(ctx.after).not.toContain("\n");
    expect(ctx.before).toContain("↵");
  });
});
