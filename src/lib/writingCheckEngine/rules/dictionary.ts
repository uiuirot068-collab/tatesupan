/**
 * R11-dictionary -- 表記ゆれ (Phase 3, 文章チェックβ v2 category 5:
 * 表記 / dictionary / NG-word features).
 *
 * Purely deterministic, configured-alternatives matching -- this rule
 * has no semantic/AI knowledge of Japanese; it never infers that two
 * words are "probably" the same concept. A variant is flagged ONLY when
 * the user has explicitly configured it as one, via their own local
 * dictionary (`WritingCheckDictionaryEntry`).
 *
 * A match overlapping a protected structural range (ruby/TCY/image/
 * page-break, see `protectedRanges.ts`) is still reported (a stray
 * variant word could legitimately appear inside a ruby reading) but
 * never offered a `suggestedReplacement` -- splicing text into the
 * middle of TateSpun notation could corrupt it, and this rule never
 * builds a second manuscript parser to reason about that safely.
 */
import type { WritingCheckDictionaryEntry, WritingDiagnostic } from "../types";
import { computeProtectedRanges, overlapsProtectedRange } from "../protectedRanges";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function checkDictionary(text: string, entries: WritingCheckDictionaryEntry[]): WritingDiagnostic[] {
  if (entries.length === 0) return [];
  const issues: WritingDiagnostic[] = [];
  const protectedRanges = computeProtectedRanges(text);

  for (const entry of entries) {
    for (const variant of entry.variants) {
      if (variant.length === 0 || variant === entry.preferred) continue;
      const pattern = new RegExp(escapeRegExp(variant), "g");
      for (const match of text.matchAll(pattern)) {
        const start = match.index ?? 0;
        const end = start + variant.length;
        const safe = !overlapsProtectedRange(start, end, protectedRanges);
        issues.push({
          id: `R11-dictionary:${entry.id}:${start}:${end}`,
          start,
          end,
          ruleId: "R11-dictionary",
          category: "dictionary",
          severity: "REVIEW",
          fixClass: "REVIEW_BEFORE_FIX",
          originalText: variant,
          ...(safe ? { suggestedReplacement: { text: entry.preferred, mechanicallyCertain: true as const } } : {}),
          message: `「${variant}」は登録された表記ゆれです（推奨表記: 「${entry.preferred}」）`,
        });
      }
    }
  }
  issues.sort((a, b) => a.start - b.start || a.end - b.end);
  return issues;
}
