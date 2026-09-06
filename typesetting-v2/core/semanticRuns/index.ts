// SemanticRunUnit cl-08 same-kind inseparability (Contract §11). Break-
// opportunity logic only — visual glyph alignment stays Renderer-only
// (P3-O04/P3-O05), never touched here.
//
// The frozen Contract's own data model places this rule ON RuleSetVersion
// (`cl08PairRule`) rather than in a standalone module, since it is versioned
// rule DATA, exactly like a character class's mayStartLine/mayEndLine flags
// (Contract §7/§11). This function is a named, CORE_MODULE_MAP.md row-18-
// matching entry point onto that same authoritative rule — it does not
// introduce a second, competing home for the same decision.

import type { RuleSetVersion } from "../rules/characterClass";
import type { SemanticRunKind } from "../units";

export function semanticRunPairRule(
  ruleSet: RuleSetVersion,
  a: SemanticRunKind,
  b: SemanticRunKind
): "INSEPARABLE" | "SEPARABLE" {
  return ruleSet.cl08PairRule(a, b);
}
