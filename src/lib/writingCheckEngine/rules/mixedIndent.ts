/**
 * R7-mixed-indent -- 行頭のタブと全角スペースの混在 (Phase 2, 文章チェッ
 * クβ v2 category 2: 段落・空白 / paragraph & whitespace).
 *
 * Deliberately NARROW: only flags a leading-whitespace run that mixes a
 * half-width TAB (U+0009) together with a full-width ideographic space
 * (U+3000) on the SAME line. Neither "always indent with 全角スペース"
 * nor "never indent" is assumed as a house style (both are real,
 * legitimate TateSpun conventions depending on the author/paragraph
 * type) -- but mixing a tab character into an otherwise ideographic-
 * space indentation convention (or vice versa) has no legitimate
 * typesetting purpose and is almost always an accidental artifact
 * (autocomplete, copy-paste). Broader indentation-consistency checking
 * (e.g. "this manuscript sometimes indents, sometimes doesn't") is
 * explicitly deferred -- that requires a style judgment this rule does
 * not make.
 */
import type { WritingDiagnostic } from "../types";

const LEADING_WHITESPACE = /^[\t　]+/gm;

export function checkMixedIndent(text: string): WritingDiagnostic[] {
  const issues: WritingDiagnostic[] = [];
  for (const match of text.matchAll(LEADING_WHITESPACE)) {
    const run = match[0];
    if (!run.includes("\t") || !run.includes("　")) continue;
    const start = match.index ?? 0;
    const end = start + run.length;
    issues.push({
      id: `R7-mixed-indent:${start}:${end}`,
      start,
      end,
      ruleId: "R7-mixed-indent",
      category: "whitespace",
      severity: "HIGH_CONFIDENCE",
      // Which character to keep (tab vs ideographic space) depends on
      // the author's own indentation convention for this manuscript --
      // not determinable from this one line alone.
      fixClass: "REVIEW_BEFORE_FIX",
      message: "行頭でタブと全角スペースが混在しています",
    });
  }
  return issues;
}
