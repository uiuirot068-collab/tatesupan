/**
 * TateSpun 文章チェック β 2.0 -- Phase 1: structured diagnostic model.
 *
 * NO React/DOM dependency anywhere in this module tree. Offsets are
 * UTF-16 code-unit indices into the raw manuscript string -- the SAME
 * convention `textarea.selectionStart`/`selectionEnd` use natively in
 * the DOM, so a `[start, end)` range maps directly onto a real editor
 * selection with no conversion step (this is DIFFERENT from, and
 * correctly so for THIS purpose, the v2 Publication bridge's own
 * code-point convention -- that bridge feeds v2 Core's own SourceSpan
 * model, this one feeds a live `<textarea>`).
 */

export type WritingRuleId = "R1-bracket" | "R2-punct" | "R3-tcy" | "R3-ruby";

export type WritingRuleCategory = "structure" | "punctuation" | "notation";

/**
 * Internal severity class (Phase 4). Only HIGH_CONFIDENCE rules are
 * enabled by default in Phase 1 -- there are no REVIEW-severity rules
 * shipped yet (every currently-enabled rule is a structural/mechanical
 * defect, not a stylistic judgment). The type exists now so later
 * phases can add REVIEW-severity rules without another schema rewrite.
 */
export type WritingSeverity = "HIGH_CONFIDENCE" | "REVIEW";

export interface WritingDiagnostic {
  /** Stable, deterministic key -- same input always produces the same id (ruleId+range), safe to use as a React list key. */
  id: string;
  ruleId: WritingRuleId;
  category: WritingRuleCategory;
  severity: WritingSeverity;
  /** UTF-16 code-unit index into the source string (inclusive). */
  start: number;
  /** UTF-16 code-unit index into the source string (exclusive). */
  end: number;
  /** User-facing Japanese explanation, phrased as a 確認候補 -- never a verdict. */
  message: string;
  /**
   * Present ONLY where a replacement is mechanically certain (e.g. a
   * rule that could deterministically prove there is exactly one
   * correct fix). No Phase 1 rule sets this -- Phase 1 explicitly does
   * not implement a fix/auto-correct UI. Reserved so a later phase can
   * add safe-fix metadata without another diagnostic-schema rewrite.
   */
  suggestedReplacement?: { text: string; mechanicallyCertain: true };
}

/** Backward-compatible alias -- `src/lib/writingCheck.ts` (pre-2.0) named this type `WritingIssue`. */
export type WritingIssue = WritingDiagnostic;

/**
 * Phase 1: every currently-enabled rule is always on (all are
 * HIGH_CONFIDENCE, structural/mechanical, no stylistic judgment). This
 * config type exists so a later phase can add opt-in/opt-out style
 * rules without changing the engine's own public call shape --
 * `enabledRuleIds` is additive-only in intent (omitting it runs every
 * currently-shipped rule, byte-identical to calling `analyzeWriting`
 * directly).
 */
export interface WritingCheckConfig {
  enabledRuleIds?: WritingRuleId[];
}
