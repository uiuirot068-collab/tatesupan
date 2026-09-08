/**
 * Single-diagnostic Fix application (Phase 11, 文章チェックβ v2). Pure --
 * no DOM, no React, no mutation of its inputs. A fix NEVER applies
 * silently: this function only ever RETURNS a proposed new text; the
 * caller (EditorPane) decides whether/when to actually replace the live
 * manuscript, always in direct response to an explicit Human action
 * (clicking 直す).
 *
 * Stale-range protection (explicitly required by the Phase 3 task): the
 * manuscript may have changed since `diagnostic` was computed (the user
 * kept typing while the result panel was open). Before ever mutating,
 * re-slice the CURRENT text at [start, end) and compare it against the
 * diagnostic's own `originalText` snapshot. If they differ, the fix is
 * refused outright -- the caller must rerun diagnostics instead of
 * mutating a range that no longer means what it meant when computed.
 */
import type { WritingDiagnostic } from "./types";

export type ApplyFixRefusalReason = "no-suggested-replacement" | "stale-range";

export interface ApplyFixResult {
  text: string;
  applied: boolean;
  reason?: ApplyFixRefusalReason;
}

export function applyFix(text: string, diagnostic: WritingDiagnostic): ApplyFixResult {
  if (!diagnostic.suggestedReplacement) {
    return { text, applied: false, reason: "no-suggested-replacement" };
  }
  if (text.slice(diagnostic.start, diagnostic.end) !== diagnostic.originalText) {
    return { text, applied: false, reason: "stale-range" };
  }
  const nextText = text.slice(0, diagnostic.start) + diagnostic.suggestedReplacement.text + text.slice(diagnostic.end);
  return { text: nextText, applied: true };
}
