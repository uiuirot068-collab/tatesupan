import type { SourceSpan } from "../source/span";

// Explicit TCY unit (Contract §10). Auto-detection threshold (P3-O07) is
// explicitly not decided here or by the Core contract — this shape only
// supports Normalizer-emitted explicit TCY units.
export interface TCYUnit {
  kind: "TCY";
  span: SourceSpan;
  displayText: string;
  logicalCells: number; // structural cell consumption, cl-30 atomic group
}
