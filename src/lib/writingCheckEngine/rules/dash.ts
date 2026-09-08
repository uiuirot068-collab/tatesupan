/**
 * R10-dash -- ダッシュ (dash) form review (Phase 3, 文章チェックβ v2
 * category 1: 約物 / punctuation).
 *
 * Reuses the SAME dash-character family `src/lib/tategaki.ts`'s own
 * `DASH_RUN_FAMILY` defines (`[―—]` -- U+2015 HORIZONTAL BAR and U+2014
 * EM DASH both accepted) -- never a second dash grammar. Respects the
 * established P3 Publication typography contract: only the 2-glyph
 * "――" form is guaranteed to render/align correctly; this rule's own
 * classification follows that contract exactly, it does not re-derive
 * a new one.
 *
 *   - a solo (unpaired) dash -> REVIEW_BEFORE_FIX, suggest doubling to
 *     the same glyph's 2-glyph form (the user's own dash character is
 *     preserved, just doubled -- never silently swapped to a different
 *     dash glyph)
 *   - exactly 2 (the guaranteed canonical form) -> never flagged
 *   - 3+ (real prose usage, not typography-guaranteed but not wrong
 *     either) -> NOTICE_ONLY, no suggested replacement (collapsing a
 *     long dash run could lose real intended emphasis -- matches the
 *     historical `PHASE3_OPEN_ITEMS.md` future-item's own "notice
 *     suggesting the ―― 2-glyph form" framing, never an auto-fix)
 */
import type { WritingDiagnostic } from "../types";

const DASH_RUN = /[―—]+/g;

export function checkDash(text: string): WritingDiagnostic[] {
  const issues: WritingDiagnostic[] = [];
  for (const match of text.matchAll(DASH_RUN)) {
    const run = match[0];
    if (run.length === 2) continue; // the guaranteed canonical form

    const start = match.index ?? 0;
    const end = start + run.length;

    if (run.length === 1) {
      issues.push({
        id: `R10-dash:${start}:${end}`,
        start,
        end,
        ruleId: "R10-dash",
        category: "punctuation",
        severity: "REVIEW",
        fixClass: "REVIEW_BEFORE_FIX",
        suggestedReplacement: { text: run + run, mechanicallyCertain: true },
        originalText: run,
        message: "ダッシュは通常2つ連ねた「――」が使われます",
      });
    } else {
      issues.push({
        id: `R10-dash:${start}:${end}`,
        start,
        end,
        ruleId: "R10-dash",
        category: "punctuation",
        severity: "REVIEW",
        fixClass: "NOTICE_ONLY",
        originalText: run,
        message: "3つ以上連続するダッシュは、標準の2つ連ね「――」への変更を検討してください",
      });
    }
  }
  return issues;
}
