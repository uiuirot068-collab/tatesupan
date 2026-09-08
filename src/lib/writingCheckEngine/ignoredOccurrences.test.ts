import { describe, expect, it } from "vitest";
import { filterIgnored } from "./ignoredOccurrences";
import { runWritingCheck } from "./engine";

describe("filterIgnored", () => {
  it("returns every diagnostic unchanged when nothing is ignored", () => {
    const text = "「未閉じ　「もう一つ";
    const diagnostics = runWritingCheck(text);
    expect(filterIgnored(diagnostics, new Set())).toEqual(diagnostics);
  });

  it("removes only the ignored occurrence, not every occurrence of the same rule", () => {
    const text = "「未閉じ　「もう一つ";
    const diagnostics = runWritingCheck(text);
    expect(diagnostics.length).toBeGreaterThanOrEqual(2);
    const ignored = new Set([diagnostics[0].id]);
    const result = filterIgnored(diagnostics, ignored);
    expect(result).toHaveLength(diagnostics.length - 1);
    expect(result.some((d) => d.id === diagnostics[0].id)).toBe(false);
    expect(result.some((d) => d.id === diagnostics[1].id)).toBe(true);
  });

  it("an ignore fingerprint tied to stale offsets naturally stops matching after upstream text shifts (accepted trade-off)", () => {
    const before = "「未閉じ";
    const diagnosticsBefore = runWritingCheck(before);
    const staleIgnored = new Set([diagnosticsBefore[0].id]);

    const after = "追加された文章。" + before; // inserts text BEFORE the flagged bracket
    const diagnosticsAfter = runWritingCheck(after);
    const result = filterIgnored(diagnosticsAfter, staleIgnored);
    // The occurrence still exists (shifted offsets => different id) and is
    // no longer suppressed by the old fingerprint.
    expect(result).toHaveLength(diagnosticsAfter.length);
  });
});
