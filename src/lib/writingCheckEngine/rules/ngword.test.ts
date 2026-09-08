import { describe, expect, it } from "vitest";
import { checkNgWords } from "./ngword";
import type { WritingCheckNgWordEntry } from "../types";

describe("checkNgWords (R12-ngword)", () => {
  it("returns nothing when no entries are configured", () => {
    expect(checkNgWords("これは普通の文章です", [])).toEqual([]);
  });

  it("flags every occurrence of a configured term, always NOTICE_ONLY with no replacement", () => {
    const entries: WritingCheckNgWordEntry[] = [{ id: "n1", term: "テスト用語" }];
    const text = "これはテスト用語です。テスト用語が二回。";
    const issues = checkNgWords(text, entries);
    expect(issues).toHaveLength(2);
    for (const issue of issues) {
      expect(issue).toMatchObject({ ruleId: "R12-ngword", category: "dictionary", fixClass: "NOTICE_ONLY", originalText: "テスト用語" });
      expect(issue.suggestedReplacement).toBeUndefined();
    }
  });

  it("includes the entry's own note in the message when present", () => {
    const entries: WritingCheckNgWordEntry[] = [{ id: "n1", term: "NG語", note: "差別的表現のため" }];
    const issues = checkNgWords("これはNG語です", entries);
    expect(issues[0].message).toContain("差別的表現のため");
  });

  it("treats regex special characters in a term as literal text", () => {
    const entries: WritingCheckNgWordEntry[] = [{ id: "n1", term: "A(B)" }];
    expect(checkNgWords("AxBx A(B)", entries)).toHaveLength(1);
  });
});
