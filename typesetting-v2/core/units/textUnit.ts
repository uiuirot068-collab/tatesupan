import type { SourceSpan } from "../source/span";

// One or more consecutive plain characters sharing no special structure
// (Contract §5). `text` must be grapheme-cluster-safe (Contract §6) — never
// split mid-surrogate-pair, mid-combining-sequence, or mid-ZWJ-sequence.
// This is a data-shape contract, validated by callers via
// source/graphemeSafety.ts, not enforced by construction here (P3-L05 is
// types-only for this module — see CORE_MODULE_MAP.md row 5).
export interface TextUnit {
  kind: "TEXT";
  span: SourceSpan;
  text: string;
}
