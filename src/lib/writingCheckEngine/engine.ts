/**
 * TateSpun 文章チェック β 2.0 -- rule engine (Phase 1: foundation).
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

const RULES: Record<WritingRuleId, (text: string) => WritingDiagnostic[]> = {
  "R1-bracket": checkBrackets,
  "R2-punct": checkPunctuation,
  "R3-tcy": checkTcyNotation,
  "R3-ruby": checkRubyNotation,
};

const ALL_RULE_IDS = Object.keys(RULES) as WritingRuleId[];

/**
 * Runs every enabled rule over `text` and returns the 確認候補 sorted by
 * position. Pure and side-effect-free. Omitting `config`/`enabledRuleIds`
 * runs every currently-shipped rule (Phase 1: all of them are
 * HIGH_CONFIDENCE and always on) -- byte-identical to the pre-2.0
 * `analyzeWriting(text)` call shape.
 */
export function runWritingCheck(text: string, config?: WritingCheckConfig): WritingDiagnostic[] {
  if (!text) return [];
  const enabledIds = config?.enabledRuleIds ?? ALL_RULE_IDS;
  const issues = enabledIds.flatMap((ruleId) => RULES[ruleId](text));
  issues.sort((a, b) => a.start - b.start || a.end - b.end);
  return issues;
}
