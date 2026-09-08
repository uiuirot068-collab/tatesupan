/**
 * Performance sanity checks (Phase 10). No wall-clock assertions (no
 * `Date.now()`/`performance.now()` thresholds -- flaky under CI/load).
 * Instead relies on Vitest's own default test timeout: a catastrophic
 * regex-backtracking regression would hang and fail these tests, which
 * IS the desired signal, without hand-tuning a brittle millisecond
 * budget.
 */
import { describe, expect, it } from "vitest";
import { runWritingCheck } from "./engine";
import type { WritingCheckDictionaryEntry, WritingCheckNgWordEntry } from "./types";

function repeatSentence(n: number): string {
  const sentence = "　これは通常の段落である。「会話文」も含む。｜東京《とうきょう》に住んでいる。西暦20年のことだった。\n";
  return sentence.repeat(n);
}

describe("performance -- long manuscript, no pathological slowdown", () => {
  it("a realistic full-novel-length manuscript (~2000 repeated sentences) completes well within the test's own timeout", () => {
    const text = repeatSentence(2000); // ~150k characters
    const issues = runWritingCheck(text);
    expect(Array.isArray(issues)).toBe(true);
  });

  it("adversarial input -- many unclosed ruby/TCY markers in a row -- does not trigger catastrophic regex backtracking", () => {
    const text = "｜漢字《".repeat(5000) + "[tate]".repeat(5000);
    const issues = runWritingCheck(text);
    expect(Array.isArray(issues)).toBe(true);
    expect(issues.length).toBeGreaterThan(0);
  });

  it("adversarial input -- many unmatched brackets -- does not trigger quadratic-or-worse blowup", () => {
    const text = "「".repeat(20000);
    const issues = runWritingCheck(text);
    expect(issues.length).toBe(20000);
  });

  it("a realistic-scale local dictionary + NG-word list (Phase 3) scanned against a full-novel-length manuscript completes within the test's own timeout", () => {
    const dictionary: WritingCheckDictionaryEntry[] = Array.from({ length: 200 }, (_, i) => ({
      id: `d${i}`,
      preferred: `見出し語${i}`,
      variants: [`表記ゆれ${i}`],
    }));
    const ngWords: WritingCheckNgWordEntry[] = Array.from({ length: 100 }, (_, i) => ({ id: `n${i}`, term: `禁止語${i}` }));
    const text = repeatSentence(2000);
    const issues = runWritingCheck(text, { dictionary, ngWords });
    expect(Array.isArray(issues)).toBe(true);
  });
});
