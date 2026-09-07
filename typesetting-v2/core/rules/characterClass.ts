// Japanese character-class model (Core Contract §7). Represented as DATA,
// not conditionals — see buildCharacterClassLookup below: no individual
// character is ever special-cased in code; membership lives entirely in a
// RuleSetVersion's class-definition data (rules/defaultRuleSet.ts).

import type { GeometryTick } from "../geometry/tick";
import type { SemanticRunKind } from "../units";

export type CharacterClassId = `cl-${string}`;

export interface CharacterClass {
  id: CharacterClassId;
  mayStartLine: boolean;
  mayEndLine: boolean;
  // cl-08 only: identity-keyed, not class-keyed (P3-L01 finding) — not
  // populated by buildCharacterClassLookup; cl-08 pairing is evaluated via
  // RuleSetVersion.cl08PairRule against SemanticRunKind instead (the actual
  // LogicalUnit shape for dash/ellipsis carries a runKind, not a raw char).
  inseparableGroupKey?: string;
}

// TateSpun-internal fallback for any character a RuleSetVersion does not
// explicitly classify — "ordinary text," breakable on both sides. Not a
// jlreq class id (jlreq has no "unclassified" class); ships as part of the
// generic lookup algorithm, not as rule data, so it is never accidentally
// duplicated across different RuleSetVersions.
export const DEFAULT_CLASS: CharacterClass = {
  id: "cl-00",
  mayStartLine: true,
  mayEndLine: true,
};

export interface RuleSetVersion {
  id: string; // versioned, referenced from VersionMetadata
  characterClasses: CharacterClass[];
  cl08PairRule: (a: SemanticRunKind, b: SemanticRunKind) => "INSEPARABLE" | "SEPARABLE";
  hangingPunctuationScope: CharacterClassId[]; // frozen: ["cl-06", "cl-07"]
  rubyOverhangAllowance: Map<CharacterClassId, GeometryTick>; // §9.1 — values OPEN (HG-4 row 22b), ships empty/zero
  // Human Visual QA HOLD round 8 (yakumono/punctuation-pair spacing):
  // classes whose glyphs carry their own built-in ~half-cell blank margin
  // (句読点・括弧類等 — periods/commas/brackets), cited from this
  // project's own cached primary-source research
  // (research/phase3/source-cache/jlreq/punctuations_in_different_sizes.md,
  // 小林敏 2021 — a JIS X 4051/JLReq-sourced discussion, not invented).
  // When TWO atoms whose leading/trailing character both belong to this
  // scope are placed adjacently, the SECOND atom's own canonical advance
  // is compressed to half a cell — see `core/compose/line.ts`'s own
  // `yakumonoCompressionFactor` — because otherwise each glyph's own
  // built-in half-cell blank stacks with its neighbor's, doubling the
  // visually intended gap. Frozen v2 default: ["cl-01","cl-02","cl-06","cl-07"]
  // (opening brackets, closing brackets, full stops, commas) — the same
  // four classes jlreq's own "括弧類等" grouping names for this exact
  // adjacency problem.
  yakumonoSpacingScope: CharacterClassId[];
  // Generic per-character lookup (falls back to DEFAULT_CLASS). This is
  // plumbing the frozen data-model candidate's prose implies ("the class
  // table") but does not name as a field — see
  // TATESPUN_V2_CORE_DATA_MODEL_CANDIDATE.md's own note that field names
  // are not frozen, only the shapes they must support.
  characterClassFor: (char: string) => CharacterClass;
}

export interface CharacterClassDefinition {
  id: CharacterClassId;
  mayStartLine: boolean;
  mayEndLine: boolean;
  inseparableGroupKey?: string;
  members: string; // every character belonging to this class, as one string — DATA, not a conditional
}

// Generic algorithm: builds a CharacterClass[] table and a per-character
// classify function purely from `definitions`. No character identity is
// hard-coded here — this function would behave identically for any future
// RuleSetVersion's own class-definition data (e.g. a looser conformance
// profile, Contract §7).
export function buildCharacterClassLookup(definitions: CharacterClassDefinition[]): {
  classes: CharacterClass[];
  classify: (char: string) => CharacterClass;
} {
  const classes: CharacterClass[] = definitions.map(({ members: _members, ...cls }) => cls);
  const byChar = new Map<string, CharacterClass>();
  for (const definition of definitions) {
    const cls: CharacterClass = {
      id: definition.id,
      mayStartLine: definition.mayStartLine,
      mayEndLine: definition.mayEndLine,
      inseparableGroupKey: definition.inseparableGroupKey,
    };
    // `for...of` on a string iterates by Unicode code point (surrogate-pair
    // safe) — every membership character here is a single-code-point jlreq
    // punctuation/kana mark, so this is exact, not an approximation.
    for (const char of definition.members) {
      byChar.set(char, cls);
    }
  }
  return {
    classes,
    classify: (char: string) => byChar.get(char) ?? DEFAULT_CLASS,
  };
}
