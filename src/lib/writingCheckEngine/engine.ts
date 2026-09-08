/**
 * TateSpun 文章チェック β 2.0 -- rule engine (Phase 1 foundation +
 * Phase 2 paragraph/whitespace + vertical-writing-character rules +
 * Phase 3 ellipsis/dash/表記ゆれ/NG-word rules).
 *
 * `manuscript string (+ optional WritingCheckConfig) -> WritingDiagnostic[]`.
 * A small registry of pure rule functions -- adding a future fixed rule
 * means adding one entry here, never touching the dispatch loop or any
 * UI consumer. Dictionary/NG-word rules are PARAMETERIZED (their real
 * content comes from the caller's own local entries, not a fixed
 * function), dispatched separately from the fixed registry. NO network,
 * NO external API, NO AI: every rule here is a synchronous, local,
 * deterministic string scan.
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
import { checkEllipsis } from "./rules/ellipsis";
import { checkDash } from "./rules/dash";
import { checkDictionary } from "./rules/dictionary";
import { checkNgWords } from "./rules/ngword";

// Fixed rules: no per-call parameters beyond the manuscript text itself.
const FIXED_RULES: Partial<Record<WritingRuleId, (text: string) => WritingDiagnostic[]>> = {
  "R1-bracket": checkBrackets,
  "R2-punct": checkPunctuation,
  "R3-tcy": checkTcyNotation,
  "R3-ruby": checkRubyNotation,
  "R4-halfwidth-kana": checkHalfwidthKana,
  "R5-control-char": checkControlChars,
  "R6-trailing-whitespace": checkTrailingWhitespace,
  "R7-mixed-indent": checkMixedIndent,
  "R8-blank-run": checkBlankRun,
  "R9-ellipsis": checkEllipsis,
  "R10-dash": checkDash,
};

// Parameterized rules: R11-dictionary/R12-ngword are always REGISTERED
// (toggleable like any other rule) but their real content comes from
// `config.dictionary`/`config.ngWords` at call time, never a fixed
// function -- dispatched via the small `if` below in `runWritingCheck`,
// not folded into `FIXED_RULES`.
const PARAMETERIZED_RULE_IDS: WritingRuleId[] = ["R11-dictionary", "R12-ngword"];

const ALL_RULE_IDS: WritingRuleId[] = [...(Object.keys(FIXED_RULES) as WritingRuleId[]), ...PARAMETERIZED_RULE_IDS];

/**
 * Which rules run when no config is supplied at all (the real Editor's
 * own call shape, `analyzeWriting(text)`). Every mechanical, low-
 * false-positive rule defaults ON; `R8-blank-run` defaults OFF --
 * blank-line conventions genuinely vary by author/genre (a real style
 * question). R11/R12 default ON but are harmless no-ops with zero
 * configured dictionary/NG entries (the common case until a user adds
 * one) -- see `docs/specs/TateSpun_11A_11B_SPEC.md`.
 */
export const DEFAULT_ENABLED_RULE_IDS: Record<WritingRuleId, boolean> = {
  "R1-bracket": true,
  "R2-punct": true,
  "R3-tcy": true,
  "R3-ruby": true,
  "R4-halfwidth-kana": true,
  "R5-control-char": true,
  "R6-trailing-whitespace": true,
  "R7-mixed-indent": true,
  "R8-blank-run": false,
  "R9-ellipsis": true,
  "R10-dash": true,
  "R11-dictionary": true,
  "R12-ngword": true,
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
 * engine's own current default set -- earlier-phase callers
 * (`analyzeWriting(text)`) automatically pick up new default-on rules
 * through the SAME call path, with zero UI code changes required.
 */
export function runWritingCheck(text: string, config?: WritingCheckConfig): WritingDiagnostic[] {
  if (!text) return [];
  const enabledIds = resolveEnabledRuleIds(config);
  const issues: WritingDiagnostic[] = [];
  for (const ruleId of enabledIds) {
    if (ruleId === "R11-dictionary") {
      issues.push(...checkDictionary(text, config?.dictionary ?? []));
    } else if (ruleId === "R12-ngword") {
      issues.push(...checkNgWords(text, config?.ngWords ?? []));
    } else {
      const rule = FIXED_RULES[ruleId];
      if (rule) issues.push(...rule(text));
    }
  }
  issues.sort((a, b) => a.start - b.start || a.end - b.end);
  return issues;
}
