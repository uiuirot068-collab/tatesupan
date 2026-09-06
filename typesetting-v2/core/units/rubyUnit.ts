import type { SourceSpan } from "../source/span";

// Group-ruby (distinct from atomic mono-ruby) is a recorded CONTRACT GAP
// (Contract §31) and is treated as ATOMIC by default until researched
// further — no third variant is added here to invent a resolution.
export type RubyKind = "ATOMIC" | "JUKUGO";

export interface RubySegment {
  baseSpan: SourceSpan;
  readingSpan: SourceSpan;
  // Ruby Placement Micro-Loop: this segment's own reading, stored literally
  // — the same convention TextUnit.text/TCYUnit.displayText already use,
  // applied here for the one LogicalUnit kind that previously lacked it.
  // Required because `MeasurementFacts.rubyReadingExtentTick(fontRef,
  // sizePt, text)` needs the literal reading text, and Core never receives
  // a raw manuscript source string (only LogicalUnit[] + spans) — without
  // this field, Core has no route to measure a segment's own reading
  // extent at compose time.
  readingText: string;
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
  // Ruby Placement Micro-Loop: the whole unit's reading, stored literally
  // (see RubySegment.readingText's doc comment for why). For a segmented
  // JUKUGO ruby this equals the concatenation of every segment's own
  // readingText, in order — callers are responsible for keeping the two
  // consistent (mirrors readingSpan's own existing min/max-of-segments
  // convention); Core itself never derives one from the other.
  readingText: string;
  segments?: RubySegment[]; // JUKUGO only — ATOMIC ruby has no internal segmentation
}
