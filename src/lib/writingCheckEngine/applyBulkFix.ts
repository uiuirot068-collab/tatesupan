/**
 * 安全な項目をまとめて直す -- Safe Bulk Fix (Phase 13, 文章チェックβ v2).
 * Pure -- no DOM, no React. Applies EVERY currently-visible SAFE_AUTO_FIX
 * diagnostic that carries a `suggestedReplacement`, and nothing else:
 * REVIEW_BEFORE_FIX and NOTICE_ONLY diagnostics are never touched by bulk
 * fix, matching the Phase 3 task's own explicit scoping (bulk fix must
 * never silently apply a fix whose correctness depends on context).
 *
 * Descending-offset application: sorted by `start` descending before any
 * splice runs, so applying a fix at a higher offset never shifts the
 * indices of a fix still waiting to apply at a lower offset -- no running
 * offset-adjustment bookkeeping needed.
 *
 * Overlap-safe: if two eligible diagnostics' ranges overlap (should not
 * happen for well-behaved rules, but not assumed), the later ([start,end)
 * further left) one is skipped rather than applied on top of
 * already-mutated text -- `skippedOverlapIds` reports exactly which.
 *
 * Stale-range-safe: reuses the SAME staleness check `applyFix.ts` uses
 * (current substring must still equal `originalText`) -- since fixes are
 * applied right-to-left, only fixes to a range's OWN left ever remain
 * unmutated by the time it is checked, so slicing the running `text`
 * (not the original) is correct here.
 */
import type { WritingDiagnostic } from "./types";

export interface ApplyBulkFixResult {
  text: string;
  appliedIds: string[];
  skippedStaleIds: string[];
  skippedOverlapIds: string[];
}

export function applyBulkFix(text: string, diagnostics: WritingDiagnostic[]): ApplyBulkFixResult {
  const eligible = diagnostics.filter((d) => d.fixClass === "SAFE_AUTO_FIX" && d.suggestedReplacement);
  const sortedDescending = [...eligible].sort((a, b) => b.start - a.start);

  let result = text;
  const appliedIds: string[] = [];
  const skippedStaleIds: string[] = [];
  const skippedOverlapIds: string[] = [];
  let rightEdge = Number.POSITIVE_INFINITY; // start of the most-recently-applied (rightmost so far) range

  for (const d of sortedDescending) {
    if (d.end > rightEdge) {
      skippedOverlapIds.push(d.id);
      continue;
    }
    if (result.slice(d.start, d.end) !== d.originalText) {
      skippedStaleIds.push(d.id);
      continue;
    }
    result = result.slice(0, d.start) + d.suggestedReplacement!.text + result.slice(d.end);
    appliedIds.push(d.id);
    rightEdge = d.start;
  }

  return { text: result, appliedIds, skippedStaleIds, skippedOverlapIds };
}
