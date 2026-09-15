/**
 * R2 -- narrow punctuation checks.
 *
 * Duplicated 。 / 、 is the original pre-2.0 rule. Runs of ! / ? remain valid
 * fiction punctuation and are never treated as duplicates. FRIEND QA adds a
 * separate, notice-only check for a !/? run immediately followed by a letter
 * or number: in that one situation the likely issue is the missing separator,
 * not the punctuation run itself. Closing punctuation, whitespace, newline,
 * and end-of-text therefore remain intentionally unflagged.
 */
import type { WritingDiagnostic } from "../types";

const PUNCT_RUN = /。{2,}|、{2,}/g;
const QUESTION_EXCLAMATION_WITHOUT_SPACE = /[!?！？]+(?=[\p{L}\p{N}])/gu;

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
      // A collapse-to-single-character replacement is a reasonable, usually-
      // correct proposal, but not certain in every context (rare deliberate
      // doubling) -- REVIEW_BEFORE_FIX, not SAFE_AUTO_FIX.
      fixClass: "REVIEW_BEFORE_FIX",
      originalText: run,
      message: run[0] === "。" ? "句点（。）が連続しています" : "読点（、）が連続しています",
    });
  }
  for (const match of text.matchAll(QUESTION_EXCLAMATION_WITHOUT_SPACE)) {
    const run = match[0];
    const start = match.index ?? 0;
    const end = start + run.length;
    issues.push({
      id: `R2-punct:${start}:${end}:missing-space`,
      start,
      end,
      ruleId: "R2-punct",
      category: "punctuation",
      severity: "REVIEW",
      // TateSpun only points out the boundary. It never inserts a space into
      // the author's manuscript or guesses whether a half/full-width space is
      // appropriate for that work.
      fixClass: "NOTICE_ONLY",
      originalText: run,
      message: "疑問符・感嘆符の後に空白がありません",
    });
  }
  return issues;
}
