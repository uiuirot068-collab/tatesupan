/**
 * TateSpun 文章チェック β 2.0 -- public API (Phase 1: rule-engine
 * foundation). Pure, local, deterministic. NO network, NO external API,
 * NO AI, NO auto-fix -- this module only ever reads the manuscript
 * string and returns 「確認候補」 (things worth a human look); it never
 * writes back to it. See `qa/evidence/` (or the Phase 1 result report)
 * for the full privacy/offset/IME audit this module was built against.
 */
export type {
  WritingRuleId,
  WritingRuleCategory,
  WritingSeverity,
  WritingFixClass,
  WritingDiagnostic,
  WritingIssue,
  WritingCheckConfig,
  WritingCheckDictionaryEntry,
  WritingCheckNgWordEntry,
  WritingCheckPresetId,
} from "./types";
export { runWritingCheck, DEFAULT_ENABLED_RULE_IDS } from "./engine";
export { mergeIssueRanges, buildWritingSegments, issueContext, type WritingSegment, type WritingDisplayRange } from "./display";
export { PRESET_LABELS, PRESET_DEFINITIONS, ALL_TOGGLEABLE_RULE_IDS, type PresetDefinition } from "./presets";
export { applyFix, type ApplyFixResult, type ApplyFixRefusalReason } from "./applyFix";
export { applyBulkFix, type ApplyBulkFixResult } from "./applyBulkFix";
export { filterIgnored } from "./ignoredOccurrences";

import { runWritingCheck } from "./engine";
import type { WritingDiagnostic } from "./types";

/** Backward-compatible alias for the pre-2.0 `analyzeWriting(text)` call shape -- `src/lib/writingCheck.ts` now re-exports this unchanged. */
export function analyzeWriting(text: string): WritingDiagnostic[] {
  return runWritingCheck(text);
}
