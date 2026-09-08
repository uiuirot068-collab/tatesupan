/**
 * TateSpun 文章チェック β 2.0 -- rule engine (Phase 1 foundation +
 * Phase 2 paragraph/whitespace + vertical-writing-character rules).
 *
 * `manuscript string (+ optional WritingCheckConfig) -> WritingDiagnostic[]`.
 * A small registry of pure rule functions -- adding a future rule means
 * adding one entry here, never touching the dispatch loop or any UI
 * consumer. NO network, NO external API, NO AI: every rule here is a
 * synchronous, local, deterministic string scan.
 */
import type { WritingCheckConfig, WritingDiagnostic, WritingRuleId } from "./types";
import { checkBrackets } from "./rules/brackets";
import { checkPunctuation } from "./rules/punctuation";
import { checkTcyNotation } from "./rules/tcy";
import { checkRubyNotation } from "./rules/ruby";
import { checkHalfwidthKana } from "./rules/halfwidthKana";
import { checkControlChars } from "./rules/controlChar";
import { checkTrailingWhitespace } from "./rules/trailingWhitespace";
import { checkMixedIndent } from "./rules/mixedIndent";
import { checkBlankRun } from "./rules/blankRun";

const RULES: Record<WritingRuleId, (text: string) => WritingDiagnostic[]> = {
  "R1-bracket": checkBrackets,
  "R2-punct": checkPunctuation,
  "R3-tcy": checkTcyNotation,
  "R3-ruby": checkRubyNotation,
  "R4-halfwidth-kana": checkHalfwidthKana,
  "R5-control-char": checkControlChars,
  "R6-trailing-whitespace": checkTrailingWhitespace,
  "R7-mixed-indent": checkMixedIndent,
  "R8-blank-run": checkBlankRun,
};

const ALL_RULE_IDS = Object.keys(RULES) as WritingRuleId[];

/**
 * Phase 2: which rules run when no config is supplied at all (the real
 * Editor's own call shape, `analyzeWriting(text)`). Every Phase 1 rule
 * plus the new mechanical, low-false-positive Phase 2 rules default ON;
 * `R8-blank-run` defaults OFF -- blank-line conventions genuinely vary
 * by author/genre (a real style question), so it must not become a
 * noisy default for every real Editor user until a later phase's own
 * product decision (see `docs/specs/TateSpun_11A_11B_SPEC.md`).
 */
const DEFAULT_ENABLED_RULE_IDS: Record<WritingRuleId, boolean> = {
  "R1-bracket": true,
  "R2-punct": true,
  "R3-tcy": true,
  "R3-ruby": true,
  "R4-halfwidth-kana": true,
  "R5-control-char": true,
  "R6-trailing-whitespace": true,
  "R7-mixed-indent": true,
  "R8-blank-run": false,
};

function resolveEnabledRuleIds(config: WritingCheckConfig | undefined): WritingRuleId[] {
  // `enabledRuleIds` (Phase 1) is an ABSOLUTE whitelist -- takes total
  // precedence, preserving Phase 1's own exact semantics unchanged.
  if (config?.enabledRuleIds) return config.enabledRuleIds;
  const overrides = config?.ruleOverrides ?? {};
  return ALL_RULE_IDS.filter((ruleId) => overrides[ruleId] ?? DEFAULT_ENABLED_RULE_IDS[ruleId]);
}

/**
 * Runs every enabled rule over `text` and returns the 確認候補 sorted by
 * position. Pure and side-effect-free. Omitting `config` runs the
 * engine's own current default set (`DEFAULT_ENABLED_RULE_IDS`) --
 * Phase 1 callers (`analyzeWriting(text)`) automatically pick up new
 * Phase 2 default-on rules through the SAME call path, with zero UI
 * code changes required.
 */
export function runWritingCheck(text: string, config?: WritingCheckConfig): WritingDiagnostic[] {
  if (!text) return [];
  const enabledIds = resolveEnabledRuleIds(config);
  const issues = enabledIds.flatMap((ruleId) => RULES[ruleId](text));
  issues.sort((a, b) => a.start - b.start || a.end - b.end);
  return issues;
}
