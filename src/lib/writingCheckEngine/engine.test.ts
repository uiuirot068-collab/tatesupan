import { describe, expect, it } from "vitest";
import { runWritingCheck } from "./engine";
import { analyzeWriting } from "./index";

describe("runWritingCheck -- engine dispatch", () => {
  it("returns an empty array for empty input", () => {
    expect(runWritingCheck("")).toEqual([]);
  });

  it("clean, well-formed Japanese prose produces no diagnostics (no false positives)", () => {
    const text = "　これは通常の段落である。「会話文」も含む。｜東京《とうきょう》に住んでいる。西暦20年のことだった。";
    expect(runWritingCheck(text)).toEqual([]);
  });

  it("results are sorted by start position regardless of which rule found them", () => {
    const text = "「未閉じ｜漢字《読み"; // unmatched bracket AND unmatched ruby, in source order
    const issues = runWritingCheck(text);
    expect(issues.length).toBeGreaterThan(1);
    for (let i = 1; i < issues.length; i++) {
      expect(issues[i].start).toBeGreaterThanOrEqual(issues[i - 1].start);
    }
  });

  it("every diagnostic has a stable, deterministic id (same input -> same ids, across repeated calls)", () => {
    const text = "「未閉じ";
    const first = runWritingCheck(text).map((d) => d.id);
    const second = runWritingCheck(text).map((d) => d.id);
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
  });

  it("enabledRuleIds config runs only the requested rules", () => {
    const text = "「未閉じ｜漢字《読み"; // triggers both R1-bracket and R3-ruby
    const onlyBrackets = runWritingCheck(text, { enabledRuleIds: ["R1-bracket"] });
    expect(onlyBrackets.every((d) => d.ruleId === "R1-bracket")).toBe(true);
    expect(onlyBrackets.length).toBeGreaterThan(0);
  });

  it("omitting config runs every currently-shipped rule (Phase 1: all HIGH_CONFIDENCE, always on)", () => {
    const text = "「未閉じ｜漢字《読み";
    const withoutConfig = runWritingCheck(text);
    const explicitAll = runWritingCheck(text, { enabledRuleIds: ["R1-bracket", "R2-punct", "R3-tcy", "R3-ruby"] });
    expect(withoutConfig).toEqual(explicitAll);
  });

  it("no diagnostic uses REVIEW severity in Phase 1 (only HIGH_CONFIDENCE rules are shipped)", () => {
    const text = "「未閉じ｜漢字《読み。。。[tate]";
    const issues = runWritingCheck(text);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((d) => d.severity === "HIGH_CONFIDENCE")).toBe(true);
  });

  it("backward-compatible analyzeWriting(text) is identical to runWritingCheck(text) with no config", () => {
    const text = "「未閉じ｜漢字《読み";
    expect(analyzeWriting(text)).toEqual(runWritingCheck(text));
  });
});
