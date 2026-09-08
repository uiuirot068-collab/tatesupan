/**
 * R6-trailing-whitespace -- 行末の余分な空白 (Phase 2, 文章チェックβ v2
 * category 2: 段落・空白 / paragraph & whitespace).
 *
 * Flags half-width space/tab and full-width ideographic space (U+3000)
 * runs immediately before a line break or end-of-document. This is
 * DELIBERATELY only about TRAILING (line-end) whitespace -- LEADING
 * whitespace (e.g. a real 全角スペース paragraph-start indent) is a
 * completely different, intentional, style-governed convention this
 * rule never touches. Trailing whitespace serves no purpose in vertical
 * Japanese prose (no wrapping/markup significance) and is essentially
 * always a stray keystroke -- genuinely SAFE_AUTO_FIX.
 */
import type { WritingDiagnostic } from "../types";

const TRAILING_WHITESPACE = /[ \t　]+(?=\r?\n|$)/g;

export function checkTrailingWhitespace(text: string): WritingDiagnostic[] {
  const issues: WritingDiagnostic[] = [];
  for (const match of text.matchAll(TRAILING_WHITESPACE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    issues.push({
      id: `R6-trailing-whitespace:${start}:${end}`,
      start,
      end,
      ruleId: "R6-trailing-whitespace",
      category: "whitespace",
      severity: "HIGH_CONFIDENCE",
      fixClass: "SAFE_AUTO_FIX",
      suggestedReplacement: { text: "", mechanicallyCertain: true },
      message: "行末に余分な空白があります",
    });
  }
  return issues;
}
