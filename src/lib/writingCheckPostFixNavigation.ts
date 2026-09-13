/**
 * TSP-PAGED-EDITOR-QA-FIXES-AND-DEMO-010 §E — where the caret/view lands
 * after applying a single Writing Check fix (直す).
 *
 * `RETURN_TO_PREVIOUS` (current default, Human-QA-approved): the editor
 * surface's own external-content reconciliation already keeps the caret
 * wherever the user's own last edit left it (`PagedEditor.tsx`'s
 * `reanchorForExternalContent`; the legacy full-document textarea's simply
 * untouched native caret) -- so this policy needs no active repositioning
 * of its own. `resolvePostFixCaretTarget` returns `null` for it: "don't
 * explicitly navigate, let the editor surface's existing behavior stand."
 *
 * `STAY_AT_FIXED_LOCATION` is a real, ready-to-flip alternative for a
 * future product decision -- it resolves to the offset immediately after
 * the fix's own replacement text, for the caller to explicitly navigate to.
 *
 * Flipping `WRITING_CHECK_POST_FIX_NAVIGATION` below is the ONLY change a
 * future product decision needs to make; no caller or navigation logic
 * (`EditorPane.tsx`'s `handleFixIssue`, `PagedEditor.tsx`/the legacy
 * textarea's `navigateToGlobalOffset`) has to change.
 */

export type WritingCheckPostFixNavigation = "RETURN_TO_PREVIOUS" | "STAY_AT_FIXED_LOCATION";

/** Current product default -- keep in sync with Human QA's approved behavior. */
export const WRITING_CHECK_POST_FIX_NAVIGATION: WritingCheckPostFixNavigation = "RETURN_TO_PREVIOUS";

export interface FixedIssueRange {
  /** Canonical (global) UTF-16 offset where the fix's replacement text begins. */
  start: number;
  /** Length of the text the fix inserted in place of the original flagged range. */
  replacementLength: number;
}

/**
 * Returns the GLOBAL offset to explicitly navigate to after applying a fix,
 * or `null` if `policy` wants no explicit navigation at all (the editor
 * surface's own existing caret-preserving behavior is already correct for
 * it -- see the module doc for `RETURN_TO_PREVIOUS`).
 */
export function resolvePostFixCaretTarget(
  policy: WritingCheckPostFixNavigation,
  fixed: FixedIssueRange
): number | null {
  if (policy === "STAY_AT_FIXED_LOCATION") {
    return fixed.start + fixed.replacementLength;
  }
  return null;
}
