/**
 * TateSpun 文章チェック β 2.0 -- structured diagnostic model (Phase 1
 * foundation + Phase 2 fix-class/config extension).
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

export type WritingRuleId =
  | "R1-bracket"
  | "R2-punct"
  | "R3-tcy"
  | "R3-ruby"
  | "R4-halfwidth-kana"
  | "R5-control-char"
  | "R6-trailing-whitespace"
  | "R7-mixed-indent"
  | "R8-blank-run"
  | "R9-ellipsis"
  | "R10-dash"
  | "R11-dictionary"
  | "R12-ngword";

export type WritingRuleCategory = "structure" | "punctuation" | "notation" | "whitespace" | "character" | "dictionary";

/**
 * Internal severity class (Phase 4, still in force in Phase 2).
 * HIGH_CONFIDENCE = the manuscript defect itself is mechanically
 * certain (a real bracket mismatch, a real stray control character,
 * etc). REVIEW = the underlying observation is real, but the correct
 * *handling* may depend on context/style TateSpun's engine cannot see.
 * Independent of `fixClass` below -- a HIGH_CONFIDENCE diagnostic can
 * still be NOTICE_ONLY (e.g. an unmatched bracket: certain something is
 * wrong, but not certain what the one correct edit is).
 */
export type WritingSeverity = "HIGH_CONFIDENCE" | "REVIEW";

/**
 * Fix-class (Phase 2, historical 文章チェックβ v2 spec, recovered via
 * `docs/specs/TateSpun_11A_11B_SPEC.md`). Answers a DIFFERENT question
 * than `severity`: not "how certain is this diagnostic" but "how safely
 * could TateSpun ever act on it." No Phase 1/2 rule's classification
 * here implies an actual auto-fix runs -- Phase 2 defines the contract
 * and metadata only; no manuscript mutation exists anywhere yet.
 *
 * - SAFE_AUTO_FIX: exactly one correct replacement exists and applying
 *   it can never destroy meaningful authorial content (e.g. deleting
 *   trailing whitespace before a line break).
 * - REVIEW_BEFORE_FIX: a replacement CAN be mechanically proposed, but
 *   style/context genuinely matters (e.g. collapsing duplicated
 *   punctuation -- often right, not certain in every context).
 * - NOTICE_ONLY: no single unambiguous correction exists (e.g. an
 *   unmatched bracket -- something is wrong, but which side to edit is
 *   not determinable from the text alone).
 */
export type WritingFixClass = "SAFE_AUTO_FIX" | "REVIEW_BEFORE_FIX" | "NOTICE_ONLY";

export interface WritingDiagnostic {
  /** Stable, deterministic key -- same input always produces the same id (ruleId+range), safe to use as a React list key. */
  id: string;
  ruleId: WritingRuleId;
  category: WritingRuleCategory;
  severity: WritingSeverity;
  /** Phase 2: every diagnostic now carries a deterministic fix classification -- see `WritingFixClass`'s own doc. Required, not optional: every rule must decide this, never leave it implicit. */
  fixClass: WritingFixClass;
  /** UTF-16 code-unit index into the source string (inclusive). */
  start: number;
  /** UTF-16 code-unit index into the source string (exclusive). */
  end: number;
  /** User-facing Japanese explanation, phrased as a 確認候補 -- never a verdict. */
  message: string;
  /**
   * The exact source substring this diagnostic was computed against
   * (`text.slice(start, end)` at the moment the diagnostic was created).
   * Phase 3's own stale-range protection (`applyFix.ts`) re-slices the
   * CURRENT manuscript at `[start, end)` and compares it against this
   * value before ever mutating -- if the manuscript changed since this
   * diagnostic was computed, the fix is refused rather than silently
   * applied to the wrong text.
   */
  originalText: string;
  /**
   * Present ONLY where a replacement is mechanically certain. Reserved
   * metadata -- Phase 1/2 build no Fix UI and no code path anywhere
   * applies this automatically; it exists purely so a later phase can
   * build that UI without another diagnostic-schema rewrite.
   */
  suggestedReplacement?: { text: string; mechanicallyCertain: true };
}

/** Backward-compatible alias -- `src/lib/writingCheck.ts` (pre-2.0) named this type `WritingIssue`. */
export type WritingIssue = WritingDiagnostic;

/**
 * `enabledRuleIds` (Phase 1): an ABSOLUTE whitelist -- when present,
 * ONLY these rules run, overriding every default. Preserved unchanged
 * for backward compatibility (existing callers/tests keep working
 * byte-identically).
 *
 * `ruleOverrides` (Phase 2, additive): flips SPECIFIC rules on/off
 * relative to the engine's own default set (`DEFAULT_ENABLED_RULE_IDS`
 * in `engine.ts`) -- this is the real per-rule configuration contract a
 * future Settings UI needs, without disturbing every OTHER rule's own
 * default. Ignored when `enabledRuleIds` is present (the whitelist wins
 * outright, matching Phase 1's own simpler all-or-nothing semantics for
 * that field).
 */
/**
 * 表記ゆれ (Phase 3, 文章チェックβ v2 category 5). A user-maintained local
 * entry: any occurrence of a `variants` string is flagged and the
 * `preferred` form is suggested. Deterministic, configured-alternatives
 * only -- never an inferred/AI synonym relationship (this engine has no
 * way to know `科学` vs `化学` is a typo, and does not pretend to).
 */
export interface WritingCheckDictionaryEntry {
  /** Stable id, generated once at creation time -- never derived from content (content can be edited). */
  id: string;
  preferred: string;
  variants: string[];
}

/** NG word (Phase 3, 文章チェックβ v2 category 5). Flags occurrences only -- no automatic replacement by default. */
export interface WritingCheckNgWordEntry {
  id: string;
  term: string;
  note?: string;
}

export type WritingCheckPresetId = "submission-recommended" | "symbols-only" | "thorough";

export interface WritingCheckConfig {
  enabledRuleIds?: WritingRuleId[];
  ruleOverrides?: Partial<Record<WritingRuleId, boolean>>;
  /** Real user dictionary/NG-word entries (Phase 3) -- both browser-local only, never transmitted, never embedded in Preview/PDF/JPG/TXT output. */
  dictionary?: WritingCheckDictionaryEntry[];
  ngWords?: WritingCheckNgWordEntry[];
}
