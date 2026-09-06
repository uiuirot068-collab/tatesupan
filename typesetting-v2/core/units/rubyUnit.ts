import type { SourceSpan } from "../source/span";

// Group-ruby (distinct from atomic mono-ruby) is a recorded CONTRACT GAP
// (Contract §31) and is treated as ATOMIC by default until researched
// further — no third variant is added here to invent a resolution.
export type RubyKind = "ATOMIC" | "JUKUGO";

export interface RubySegment {
  baseSpan: SourceSpan;
  readingSpan: SourceSpan;
}

// Contract §9. Segmentation ownership: the Core only ever HONORS an
// already-provided `segments` array (Contract §8/§9, CORE_RESPONSIBILITY_MATRIX.md)
// — it never discovers where a compound word's reading should split. A
// JUKUGO RubyUnit with no `segments` is treated as ATOMIC by whichever Loop
// consumes this type (P3-L11's break-opportunity derivation) — this module
// declares the shape only and fabricates no segmentation logic.
export interface RubyUnit {
  kind: "RUBY";
  span: SourceSpan; // covers base + reading combined
  rubyKind: RubyKind;
  baseSpan: SourceSpan;
  readingSpan: SourceSpan;
  segments?: RubySegment[]; // JUKUGO only — ATOMIC ruby has no internal segmentation
}
