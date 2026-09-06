import type { SourceSpan } from "../source/span";

// jlreq cl-08 identities (Contract §11).
export type SemanticRunKind = "DASH" | "ELLIPSIS" | "TWO_DOT_LEADER";

// Deliberately carries no pixel/x-y fields — visual glyph centering/alignment
// is Renderer-only (P3-O04/O05), blind to this semantic unit's fields.
export interface SemanticRunUnit {
  kind: "SEMANTIC_RUN";
  span: SourceSpan;
  runKind: SemanticRunKind;
  length: number; // number of same-kind cl-08 characters in the run
}
