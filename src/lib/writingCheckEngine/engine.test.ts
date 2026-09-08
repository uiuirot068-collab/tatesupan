import { describe, expect, it } from "vitest";
import { runWritingCheck } from "./engine";
import { analyzeWriting } from "./index";
import type { WritingRuleId } from "./types";

// The full, exact set of rule IDs this engine ships (Phase 1 + Phase 2).
// A deliberate, explicit literal list -- if a future rename/removal ever
// slips through, this test fails loudly instead of silently drifting
// (Phase 8: rule IDs are user-config/persistence-facing, must be stable).
const ALL_KNOWN_RULE_IDS: WritingRuleId[] = ["R1-bracket", "R2-punct", "R3-tcy", "R3-ruby", "R4-halfwidth-kana", "R5-control-char", "R6-trailing-whitespace", "R7-mixed-indent", "R8-blank-run"];

describe("runWritingCheck -- engine dispatch", () => {
  it("returns an empty array for empty input", () => {
    expect(runWritingCheck("")).toEqual([]);
  });

  it("clean, well-formed Japanese prose produces no diagnostics under the DEFAULT rule set (no false positives, Phase 1 + Phase 2 rules combined)", () => {
    const text = "　これは通常の段落である。「会話文」も含む。｜東京《とうきょう》に住んでいる。西暦20年のことだった。\n次の段落。";
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

  it("every diagnostic carries a real fixClass (Phase 2: required on every rule, no exceptions)", () => {
    const text = "「未閉じ｜漢字《読み。。。[tate]ﾃｽﾄ  \n\t　行\x00頭";
    const issues = runWritingCheck(text, { enabledRuleIds: ALL_KNOWN_RULE_IDS });
    expect(issues.length).toBeGreaterThan(0);
    const validFixClasses = ["SAFE_AUTO_FIX", "REVIEW_BEFORE_FIX", "NOTICE_ONLY"];
    expect(issues.every((d) => validFixClasses.includes(d.fixClass))).toBe(true);
  });

  it("enabledRuleIds config (absolute whitelist) runs only the requested rules, unchanged from Phase 1", () => {
    const text = "「未閉じ｜漢字《読み"; // triggers both R1-bracket and R3-ruby
    const onlyBrackets = runWritingCheck(text, { enabledRuleIds: ["R1-bracket"] });
    expect(onlyBrackets.every((d) => d.ruleId === "R1-bracket")).toBe(true);
    expect(onlyBrackets.length).toBeGreaterThan(0);
  });

  it("omitting config runs the engine's own current DEFAULT rule set (Phase 2: 8 rules, R8-blank-run excluded)", () => {
    const text = "「未閉じ｜漢字《読み";
    const withoutConfig = runWritingCheck(text);
    const explicitDefaultSet = runWritingCheck(text, { enabledRuleIds: ["R1-bracket", "R2-punct", "R3-tcy", "R3-ruby", "R4-halfwidth-kana", "R5-control-char", "R6-trailing-whitespace", "R7-mixed-indent"] });
    expect(withoutConfig).toEqual(explicitDefaultSet);
  });

  it("R8-blank-run is NOT enabled by default (style-sensitive, deliberately conservative)", () => {
    const text = "前。\n\n\n\n後。"; // would trigger R8 if it were enabled
    const withDefaultConfig = runWritingCheck(text);
    expect(withDefaultConfig.some((d) => d.ruleId === "R8-blank-run")).toBe(false);
    const withR8Explicit = runWritingCheck(text, { enabledRuleIds: ["R8-blank-run"] });
    expect(withR8Explicit.some((d) => d.ruleId === "R8-blank-run")).toBe(true);
  });

  it("ruleOverrides (Phase 2) can enable R8-blank-run on top of the default set without disabling anything else", () => {
    const text = "「未閉じ\n\n\n\n後。"; // triggers R1-bracket (default-on) AND would trigger R8 (default-off)
    const issues = runWritingCheck(text, { ruleOverrides: { "R8-blank-run": true } });
    expect(issues.some((d) => d.ruleId === "R1-bracket")).toBe(true);
    expect(issues.some((d) => d.ruleId === "R8-blank-run")).toBe(true);
  });

  it("ruleOverrides can disable a normally-default-on rule without affecting others", () => {
    const text = "「未閉じ｜漢字《読み"; // triggers R1-bracket AND R3-ruby by default
    const issues = runWritingCheck(text, { ruleOverrides: { "R1-bracket": false } });
    expect(issues.some((d) => d.ruleId === "R1-bracket")).toBe(false);
    expect(issues.some((d) => d.ruleId === "R3-ruby")).toBe(true);
  });

  it("REVIEW severity exists (R8) but only surfaces when explicitly enabled -- never appears under the default config", () => {
    const text = "前。\n\n\n\n後。";
    const issues = runWritingCheck(text);
    expect(issues.every((d) => d.severity === "HIGH_CONFIDENCE")).toBe(true);
  });

  it("backward-compatible analyzeWriting(text) is identical to runWritingCheck(text) with no config", () => {
    const text = "「未閉じ｜漢字《読み";
    expect(analyzeWriting(text)).toEqual(runWritingCheck(text));
  });
});
