/**
 * R2 -- 明らかな句読点重複 (obvious duplicated 。 / 、). Ported verbatim
 * from pre-2.0 `src/lib/writingCheck.ts`. Deliberately only 。 and 、 --
 * ！！／！？／？！／……／―― are frequently intentional in fiction and
 * are NOT flagged (Phase 6.E: "do not classify literary repetition as
 * an error" -- this scoping was already correct before Phase 1, kept
 * unchanged, not re-derived).
 */
import type { WritingDiagnostic } from "../types";

const PUNCT_RUN = /。{2,}|、{2,}/g;

export function checkPunctuation(text: string): WritingDiagnostic[] {
  const issues: WritingDiagnostic[] = [];
  for (const match of text.matchAll(PUNCT_RUN)) {
    const run = match[0];
    const start = match.index ?? 0;
    const end = start + run.length;
    issues.push({
      id: `R2-punct:${start}:${end}`,
      start,
      end,
      ruleId: "R2-punct",
      category: "punctuation",
      severity: "HIGH_CONFIDENCE",
      message: run[0] === "。" ? "句点（。）が連続しています" : "読点（、）が連続しています",
    });
  }
  return issues;
}
