/**
 * R9-ellipsis -- 三点リーダー (ellipsis) form review (Phase 3, 文章チェッ
 * クβ v2 category 1: 約物 / punctuation).
 *
 * Flags nonstandard ellipsis forms and proposes the canonical paired
 * `……` form where the conversion is mechanically unambiguous:
 *   - ASCII `...` (3+ periods) -> REVIEW_BEFORE_FIX, replace with `……`
 *   - `・・・` (3+ middle dots) -> REVIEW_BEFORE_FIX, replace with `……`
 *   - a single, UNPAIRED `…` (U+2026, not part of `……`) -> REVIEW_BEFORE_FIX,
 *     replace by doubling it to `……` (the established TateSpun/P3 typography
 *     convention already treats `……` as the canonical paired form)
 * The already-valid canonical `……` itself is never flagged. TateSpun
 * notation markers (`｜`/`《》`/`[tate]`) contain no ellipsis-like
 * characters, so there is no overlap risk with ruby/TCY syntax.
 */
import type { WritingDiagnostic } from "../types";

// Order matters: canonical pairs first (consumed via lastIndex tracking),
// so a real "……" is never later mis-matched by the single-"…" branch.
const ELLIPSIS_CANDIDATE = /\.{3,}|・{3,}|……|…/g;

export function checkEllipsis(text: string): WritingDiagnostic[] {
  const issues: WritingDiagnostic[] = [];
  for (const match of text.matchAll(ELLIPSIS_CANDIDATE)) {
    const run = match[0];
    const start = match.index ?? 0;
    const end = start + run.length;

    if (run === "……") continue; // already canonical, never flagged

    if (run[0] === ".") {
      issues.push({
        id: `R9-ellipsis:${start}:${end}`,
        start,
        end,
        ruleId: "R9-ellipsis",
        category: "punctuation",
        severity: "REVIEW",
        fixClass: "REVIEW_BEFORE_FIX",
        suggestedReplacement: { text: "……", mechanicallyCertain: true },
        originalText: run,
        message: "半角ピリオドの連続は三点リーダー「……」への変更を検討してください",
      });
    } else if (run[0] === "・") {
      issues.push({
        id: `R9-ellipsis:${start}:${end}`,
        start,
        end,
        ruleId: "R9-ellipsis",
        category: "punctuation",
        severity: "REVIEW",
        fixClass: "REVIEW_BEFORE_FIX",
        suggestedReplacement: { text: "……", mechanicallyCertain: true },
        originalText: run,
        message: "中黒の連続は三点リーダー「……」への変更を検討してください",
      });
    } else {
      // A single, unpaired "…" (the regex's "……" alternative already
      // consumed every real pair before this branch can match).
      issues.push({
        id: `R9-ellipsis:${start}:${end}`,
        start,
        end,
        ruleId: "R9-ellipsis",
        category: "punctuation",
        severity: "REVIEW",
        fixClass: "REVIEW_BEFORE_FIX",
        suggestedReplacement: { text: "……", mechanicallyCertain: true },
        originalText: run,
        message: "三点リーダーは通常2つ連ねた「……」が使われます",
      });
    }
  }
  return issues;
}
