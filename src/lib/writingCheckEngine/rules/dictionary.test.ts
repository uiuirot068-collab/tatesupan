import { describe, expect, it } from "vitest";
import { checkDictionary } from "./dictionary";
import type { WritingCheckDictionaryEntry } from "../types";

describe("checkDictionary (R11-dictionary)", () => {
  it("returns nothing when no entries are configured", () => {
    expect(checkDictionary("科学と化学は違う", [])).toEqual([]);
  });

  it("flags a configured variant and suggests the preferred form", () => {
    const entries: WritingCheckDictionaryEntry[] = [{ id: "d1", preferred: "サーバー", variants: ["サーバ"] }];
    const text = "サーバに接続する";
    const issues = checkDictionary(text, entries);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ ruleId: "R11-dictionary", category: "dictionary", fixClass: "REVIEW_BEFORE_FIX", originalText: "サーバ" });
    expect(issues[0].suggestedReplacement).toEqual({ text: "サーバー", mechanicallyCertain: true });
  });

  it("never flags the preferred form itself, even if it also appears in variants by mistake", () => {
    const entries: WritingCheckDictionaryEntry[] = [{ id: "d1", preferred: "サーバー", variants: ["サーバー", "計算機"] }];
    const text = "サーバーは正常です";
    // "サーバー" (preferred) is self-skipped; "計算機" is a real distinct
    // variant that genuinely does not occur anywhere in this text.
    expect(checkDictionary(text, entries)).toEqual([]);
  });

  it("matches every occurrence across multiple entries, sorted by position", () => {
    const entries: WritingCheckDictionaryEntry[] = [
      { id: "d1", preferred: "サーバー", variants: ["サーバ"] },
      { id: "d2", preferred: "コンピューター", variants: ["コンピュータ"] },
    ];
    const text = "コンピュータとサーバの話";
    const issues = checkDictionary(text, entries);
    expect(issues).toHaveLength(2);
    expect(issues[0].originalText).toBe("コンピュータ");
    expect(issues[1].originalText).toBe("サーバ");
    expect(issues[0].start).toBeLessThan(issues[1].start);
  });

  it("omits suggestedReplacement when the match overlaps protected TateSpun notation (ruby)", () => {
    const entries: WritingCheckDictionaryEntry[] = [{ id: "d1", preferred: "サーバー", variants: ["サーバ"] }];
    const text = "｜サーバ《さーば》administration";
    const issues = checkDictionary(text, entries);
    expect(issues.length).toBeGreaterThan(0);
    const overlapping = issues.find((i) => text.slice(i.start, i.end) === "サーバ");
    expect(overlapping?.suggestedReplacement).toBeUndefined();
  });

  it("treats regex special characters in a variant as literal text, not a pattern", () => {
    const entries: WritingCheckDictionaryEntry[] = [{ id: "d1", preferred: "A.B", variants: ["A(B)"] }];
    expect(checkDictionary("AxBx AB A(B)", entries)).toHaveLength(1);
  });
});
