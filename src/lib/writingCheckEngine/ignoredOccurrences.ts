/**
 * 無視 (Ignore) -- occurrence-level, in-memory-only dismissal (Phase 12,
 * 文章チェックβ v2). Deliberately NOT persisted anywhere (no localStorage,
 * no server) -- a page reload is explicitly allowed to forget it, per the
 * Phase 3 task's own scoping. Deliberately occurrence-level, not
 * rule-level: ignoring one flagged bracket must never silently suppress
 * every OTHER bracket diagnostic in the document.
 *
 * Reuses `WritingDiagnostic.id` itself as the fingerprint (already a
 * deterministic `ruleId:start:end[:...]` key -- see each rule file's own
 * `id` construction) rather than inventing a second identity scheme.
 * Trade-off, stated plainly: if the user edits text BEFORE an ignored
 * occurrence, its offsets shift, its `id` changes, and the ignore is
 * naturally "forgotten" (the occurrence reappears). This is accepted, not
 * a bug -- Phase 12 asks for the narrowest possible mechanism, not a
 * content-addressed scheme that survives arbitrary edits elsewhere.
 */
import type { WritingDiagnostic } from "./types";

export function filterIgnored(diagnostics: WritingDiagnostic[], ignoredIds: ReadonlySet<string>): WritingDiagnostic[] {
  if (ignoredIds.size === 0) return diagnostics;
  return diagnostics.filter((d) => !ignoredIds.has(d.id));
}
