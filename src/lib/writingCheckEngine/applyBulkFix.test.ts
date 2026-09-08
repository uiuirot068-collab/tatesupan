import { describe, expect, it } from "vitest";
import { applyBulkFix } from "./applyBulkFix";
import { runWritingCheck } from "./engine";
import type { WritingDiagnostic } from "./types";

describe("applyBulkFix", () => {
  it("applies every SAFE_AUTO_FIX diagnostic and leaves REVIEW_BEFORE_FIX/NOTICE_ONLY ones untouched", () => {
    const text = "ﾃｽﾄです。行末に空白がある \n三点は...気になる";
    const diagnostics = runWritingCheck(text);
    const result = applyBulkFix(text, diagnostics);
    // Half-width kana (SAFE_AUTO_FIX) and trailing whitespace (SAFE_AUTO_FIX) applied;
    // the ASCII ellipsis (REVIEW_BEFORE_FIX) is left exactly as-is.
    expect(result.text).toContain("テスト");
    expect(result.text).toContain("...");
    expect(result.text).not.toMatch(/ \n/);
  });

  it("applies in descending-offset order so an earlier fix's splice never shifts a later diagnostic's indices", () => {
    const text = "ﾃ\x00ｽ\x00ﾄ"; // two control chars + half-width kana, interleaved
    const diagnostics = runWritingCheck(text);
    const result = applyBulkFix(text, diagnostics);
    expect(result.text).toBe("テスト");
    expect(result.appliedIds).toHaveLength(diagnostics.filter((d) => d.fixClass === "SAFE_AUTO_FIX").length);
  });

  it("skips a diagnostic whose range is stale (current text no longer matches originalText)", () => {
    const text = "行末に空白がある \n";
    const diagnostic = runWritingCheck(text)[0];
    const changedText = "もう空白は無い\n";
    const result = applyBulkFix(changedText, [diagnostic]);
    expect(result.appliedIds).toEqual([]);
    expect(result.skippedStaleIds).toEqual([diagnostic.id]);
    expect(result.text).toBe(changedText);
  });

  it("skips (does not double-apply) an overlapping SAFE_AUTO_FIX diagnostic", () => {
    const text = "abc";
    const a: WritingDiagnostic = {
      id: "fake-a",
      ruleId: "R5-control-char",
      category: "character",
      severity: "HIGH_CONFIDENCE",
      fixClass: "SAFE_AUTO_FIX",
      start: 0,
      end: 2,
      originalText: "ab",
      suggestedReplacement: { text: "X", mechanicallyCertain: true },
      message: "test",
    };
    const b: WritingDiagnostic = {
      id: "fake-b",
      ruleId: "R5-control-char",
      category: "character",
      severity: "HIGH_CONFIDENCE",
      fixClass: "SAFE_AUTO_FIX",
      start: 1,
      end: 3,
      originalText: "bc",
      suggestedReplacement: { text: "Y", mechanicallyCertain: true },
      message: "test",
    };
    // Descending-start order visits b (start=1) before a (start=0).
    const result = applyBulkFix(text, [a, b]);
    expect(result.appliedIds).toEqual(["fake-b"]);
    expect(result.skippedOverlapIds).toEqual(["fake-a"]);
    expect(result.text).toBe("aY");
  });

  it("never touches REVIEW_BEFORE_FIX or NOTICE_ONLY diagnostics even when they carry a suggestedReplacement", () => {
    const text = "彼は…黙っていた";
    const diagnostics = runWritingCheck(text); // R9-ellipsis, REVIEW_BEFORE_FIX
    const result = applyBulkFix(text, diagnostics);
    expect(result.text).toBe(text);
    expect(result.appliedIds).toEqual([]);
  });
});
