import type { SourceSpan } from "../source/span";

// A normalized 【改ページ】 marker (Contract §13). Recognition/disambiguation
// (alone-on-line vs. trailing-after-text vs. literal-mid-sentence) is
// Normalizer-owned (CORE_RESPONSIBILITY_MATRIX.md) — the Core receives an
// already-resolved, unambiguous unit and never re-parses raw notation.
export interface ManualBreakUnit {
  kind: "MANUAL_BREAK";
  span: SourceSpan; // covers the resolved marker
}
