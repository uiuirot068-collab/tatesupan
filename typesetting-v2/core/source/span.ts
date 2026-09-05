// Source model (Core Contract §4). SourceSpan offsets are Unicode code-point
// offsets — a deliberate contract decision (§4), not UTF-16 code units and
// not extended-grapheme-cluster indices.

export type BlockId = string;

export interface SourceSpan {
  blockId: BlockId;
  start: number; // code point offset, half-open range start
  end: number; // code point offset, half-open range end
}

export type SourceBlockKind = "BODY" | "COLOPHON";

export interface SourceBlock {
  blockId: BlockId;
  kind: SourceBlockKind;
  normalizedText: string; // already Normalizer-processed
}
