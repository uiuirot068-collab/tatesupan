/**
 * R8-blank-run -- 3行以上の連続する空行 (Phase 2, 文章チェックβ v2
 * category 2: 段落・空白 / paragraph & whitespace).
 *
 * Deliberately conservative: fiction legitimately uses blank lines for
 * pacing/scene breaks, and 1-2 consecutive blank lines are ordinary. A
 * run of 3+ fully blank lines in a row is unusual enough to be worth a
 * quiet notice, but there is no single "correct" number of blank lines
 * to collapse to -- purely informational (NOTICE_ONLY), and DEFAULT
 * DISABLED (see `engine.ts`'s own `DEFAULT_ENABLED_RULE_IDS`) since
 * blank-line conventions genuinely vary by author/genre; this must not
 * become a noisy default for every Editor user.
 *
 * Pattern: a newline followed by 3 or more repetitions of
 * (optional-whitespace + newline) -- i.e. at least 4 total line breaks
 * with only whitespace between them, which is exactly 3 genuinely blank
 * lines between two real content lines. Verified against a concrete
 * fixture in this rule's own test, not just derived on paper.
 */
import type { WritingDiagnostic } from "../types";

const BLANK_RUN = /\n(?:[ \t　]*\r?\n){3,}/g;

export function checkBlankRun(text: string): WritingDiagnostic[] {
  const issues: WritingDiagnostic[] = [];
  for (const match of text.matchAll(BLANK_RUN)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    issues.push({
      id: `R8-blank-run:${start}:${end}`,
      start,
      end,
      ruleId: "R8-blank-run",
      category: "whitespace",
      severity: "REVIEW",
      fixClass: "NOTICE_ONLY",
      originalText: match[0],
      message: "3行以上の空行が連続しています",
    });
  }
  return issues;
}
