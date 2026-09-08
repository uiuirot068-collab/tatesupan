/**
 * TSP-LOOP-004 「文章チェック β」 -- pure, local, deterministic writing-check
 * rules.
 *
 * Phase 1 (文章チェック β 2.0, "Local Rule Engine Foundation"): the actual
 * rule engine now lives in `./writingCheckEngine/` (a proper, extensible,
 * pure rule registry -- see that module's own doc). This file is now a
 * thin, deliberately UNCHANGED-SHAPE re-export, so every existing
 * consumer (`EditorPane.tsx`, `WritingCheckOverlay.tsx`,
 * `WritingCheckBar.tsx`) keeps working with zero changes: same import
 * path, same `analyzeWriting`/`mergeIssueRanges`/`buildWritingSegments`/
 * `issueContext` names, same `WritingIssue` type shape (now an alias of
 * the richer `WritingDiagnostic`, itself a strict superset -- `start`,
 * `end`, `ruleId`, `message` are unchanged; `id`/`category`/`severity`
 * are new, additive fields no existing consumer reads).
 *
 * NO network, NO external API, NO AI, NO auto-fix -- unchanged from
 * before Phase 1.
 */
export {
  analyzeWriting,
  mergeIssueRanges,
  buildWritingSegments,
  issueContext,
  type WritingIssue,
  type WritingRuleId,
  type WritingSegment,
} from "./writingCheckEngine";
