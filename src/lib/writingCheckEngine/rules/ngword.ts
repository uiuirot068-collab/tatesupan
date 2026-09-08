/**
 * R12-ngword -- NGワード (Phase 3, 文章チェックβ v2 category 5). Flags
 * occurrences of a user-configured term; NEVER an automatic replacement
 * -- an NG word has no single "correct" alternative by definition
 * (unlike a 表記ゆれ preferred form), so this rule is always NOTICE_ONLY.
 */
import type { WritingCheckNgWordEntry, WritingDiagnostic } from "../types";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function checkNgWords(text: string, entries: WritingCheckNgWordEntry[]): WritingDiagnostic[] {
  if (entries.length === 0) return [];
  const issues: WritingDiagnostic[] = [];

  for (const entry of entries) {
    if (entry.term.length === 0) continue;
    const pattern = new RegExp(escapeRegExp(entry.term), "g");
    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;
      const end = start + entry.term.length;
      issues.push({
        id: `R12-ngword:${entry.id}:${start}:${end}`,
        start,
        end,
        ruleId: "R12-ngword",
        category: "dictionary",
        severity: "REVIEW",
        fixClass: "NOTICE_ONLY",
        originalText: entry.term,
        message: entry.note ? `NGワード「${entry.term}」が使われています（${entry.note}）` : `NGワード「${entry.term}」が使われています`,
      });
    }
  }
  issues.sort((a, b) => a.start - b.start || a.end - b.end);
  return issues;
}
