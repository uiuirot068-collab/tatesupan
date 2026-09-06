// The shipped v2 default RuleSetVersion. Character membership is
// transcribed verbatim from jlreq's own class-table examples and from
// TateSpun's legacy `tategaki.ts` sets confirmed to "match evidence exactly"
// (docs/standards/P3_KINSOKU_RULE_FREEZE_CANDIDATE.md, Legacy Comparison
// table) — never invented. Only classes with a READY row in
// docs/standards/PHASE3_JAPANESE_RULE_FREEZE_MATRIX.md are encoded; the full
// 900-cell jlreq Table-2 pairwise grid remains OPEN and is not fabricated
// here (same document, §OPEN item 1).
//
// HG-1/HG-2 (Human Rule-Freeze Gate, 2026-09-05): cl-05 and cl-12/cl-13 are
// prohibited at line start as the v2 default — stricter than legacy
// `tategaki.ts`, which did not prohibit them. This file is where that
// Product decision becomes data, not a code branch (Contract §7).

import type { SemanticRunKind } from "../units";
import {
  buildCharacterClassLookup,
  type CharacterClassDefinition,
  type RuleSetVersion,
} from "./characterClass";

const CLASS_DEFINITIONS: CharacterClassDefinition[] = [
  {
    id: "cl-01", // opening brackets — line-end prohibition, all conformance levels
    mayStartLine: true,
    mayEndLine: false,
    members: "‘“（〔［｛〈《「『【〘〖",
  },
  {
    id: "cl-02", // closing brackets — line-start prohibition, all conformance levels
    mayStartLine: false,
    mayEndLine: true,
    members: "’”）〕］｝〉》」』】〙〗",
  },
  {
    id: "cl-04", // dividing punctuation marks (？！) — matches legacy tategaki.ts LINE_START_PROHIBITED
    mayStartLine: false,
    mayEndLine: true,
    members: "？！‼⁉",
  },
  {
    id: "cl-05", // middle dots — HG-1 (2026-09-05): stricter base-level policy APPROVED as v2 default
    mayStartLine: false,
    mayEndLine: true,
    members: "・：；",
  },
  {
    id: "cl-06", // full stops
    mayStartLine: false,
    mayEndLine: true,
    members: "。．",
  },
  {
    id: "cl-07", // commas
    mayStartLine: false,
    mayEndLine: true,
    members: "、，",
  },
  {
    id: "cl-09", // iteration marks
    mayStartLine: false,
    mayEndLine: true,
    members: "々ゝゞヽヾ",
  },
  {
    id: "cl-10", // prolonged sound mark
    mayStartLine: false,
    mayEndLine: true,
    members: "ー",
  },
  {
    id: "cl-11", // small kana
    mayStartLine: false,
    mayEndLine: true,
    members: "ぁぃぅぇぉァィゥェォっゃゅょッャュョ",
  },
  {
    id: "cl-12", // prefixed abbreviations — HG-2 (2026-09-05): stricter base-level policy APPROVED
    mayStartLine: false,
    mayEndLine: true,
    members: "￥＄￡＃",
  },
  {
    id: "cl-13", // postfixed abbreviations — HG-2
    mayStartLine: false,
    mayEndLine: true,
    members: "°′″℃￠％‰",
  },
];

const { classes, classify } = buildCharacterClassLookup(CLASS_DEFINITIONS);

// jlreq #notes_a3 id589-595: no line-break opportunity between two
// consecutive cl-08 characters of the SAME specific identity (EM DASH only
// pairs with EM DASH, etc.); a different identity is separable, even though
// both are cl-08 members. Identity-keyed, not class-keyed — see
// P3_DASH_ELLIPSIS_RULE_FREEZE_CANDIDATE.md §B.
function cl08PairRule(a: SemanticRunKind, b: SemanticRunKind): "INSEPARABLE" | "SEPARABLE" {
  return a === b ? "INSEPARABLE" : "SEPARABLE";
}

export const DEFAULT_RULE_SET_V2: RuleSetVersion = {
  id: "tatespun-v2-default-2026-09-06",
  characterClasses: classes,
  cl08PairRule,
  hangingPunctuationScope: ["cl-06", "cl-07"], // jlreq hanging-punctuation section — cl-06/cl-07 only
  rubyOverhangAllowance: new Map(), // HG-4: principle approved, exact values OPEN (row 22b) — ships empty, not fabricated
  characterClassFor: classify,
};
