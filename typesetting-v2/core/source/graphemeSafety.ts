// Grapheme-safe boundary validation (Core Contract §6, INV-011).
//
// Ownership boundary (CORE_RESPONSIBILITY_MATRIX.md): grapheme-safe
// *segmentation* of raw manuscript text is Normalizer-owned — the Core
// never re-segments raw strings. This module VALIDATES a boundary it is
// given (a SourceSpan edge, a candidate break position) against text that
// has already passed through the Normalizer; it is not a segmentation
// engine for production manuscript text.
//
// JS strings are UTF-16 internally, but the Core's public contract (§4)
// addresses text by Unicode code point, never by UTF-16 code unit. This
// module is the one place that bridges the two — no other Core module
// needs to reason about surrogate pairs directly.

import type { SourceSpan } from "./span";

function toCodePointArray(text: string): string[] {
  return Array.from(text); // code-point aware: a surrogate pair is one element
}

export function codePointLength(text: string): number {
  return toCodePointArray(text).length;
}

// Half-open code-point range slice, mirroring SourceSpan's [start, end) convention (Contract §4).
export function codePointSlice(text: string, start: number, end: number): string {
  return toCodePointArray(text).slice(start, end).join("");
}

export class GraphemeSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphemeSafetyError";
  }
}

// Thrown instead of a boundary result whenever grapheme-cluster segmentation
// cannot be performed at all. The Core prefers an explicit failure here over
// silently degrading to a one-code-point-per-boundary guess (INV-010: an
// unresolved serious condition must never silently become a PASS) — a
// guessed boundary could report a combining-mark sequence, variation
// selector, or ZWJ sequence as "safe" when it is not.
export class GraphemeSegmentationUnavailableError extends GraphemeSafetyError {
  constructor(message: string) {
    super(message);
    this.name = "GraphemeSegmentationUnavailableError";
  }
}

type SegmenterFactory = () => Intl.Segmenter;

function defaultSegmenterFactory(): Intl.Segmenter {
  if (typeof Intl === "undefined" || !("Segmenter" in Intl)) {
    throw new GraphemeSegmentationUnavailableError(
      "GRAPHEME_SEGMENTATION_UNAVAILABLE: Intl.Segmenter (grapheme granularity) is not available in this runtime, so grapheme-cluster boundaries cannot be validated. Refusing to guess (INV-010/INV-011)."
    );
  }
  return new Intl.Segmenter(undefined, { granularity: "grapheme" });
}

let segmenterFactory: SegmenterFactory = defaultSegmenterFactory;

// Test-only seam: lets the test suite exercise the "segmentation
// unavailable" path without mutating the process-global Intl object. Never
// called by Product code; not part of the Core's public contract. Pass
// `null` to restore the real Intl.Segmenter-backed factory.
export function __setGraphemeSegmenterFactoryForTesting(factory: SegmenterFactory | null): void {
  segmenterFactory = factory ?? defaultSegmenterFactory;
}

// The set of code-point offsets into `text` that are legal extended-grapheme-
// cluster boundaries (always includes 0 and codePointLength(text)). Throws
// GraphemeSegmentationUnavailableError if no segmenter is available — never
// falls back to an unsafe one-code-point-per-boundary guess.
function graphemeBoundaryOffsets(text: string): Set<number> {
  const segmenter = segmenterFactory();
  const boundaries = new Set<number>([0]);
  let offset = 0;
  for (const { segment } of segmenter.segment(text)) {
    offset += codePointLength(segment);
    boundaries.add(offset);
  }
  return boundaries;
}

// Throws GraphemeSafetyError if `codePointOffset` falls inside an extended
// grapheme cluster of `text` (a surrogate pair, combining-mark sequence,
// variation-selector pair, or emoji ZWJ/modifier sequence) rather than on a
// cluster boundary. Contract §6, INV-011.
export function assertGraphemeSafeBoundary(text: string, codePointOffset: number): void {
  const length = codePointLength(text);
  if (!Number.isInteger(codePointOffset) || codePointOffset < 0 || codePointOffset > length) {
    throw new GraphemeSafetyError(
      `codePointOffset ${codePointOffset} is out of range for text of code-point length ${length}`
    );
  }
  if (!graphemeBoundaryOffsets(text).has(codePointOffset)) {
    throw new GraphemeSafetyError(
      `codePointOffset ${codePointOffset} falls inside a grapheme cluster of "${text}", not on its boundary`
    );
  }
}

// Convenience wrapper validating both edges of a SourceSpan against the text
// it addresses (`text` is the span's containing block's normalizedText, or
// any substring positioned so span.start/span.end are measured against it).
export function assertGraphemeSafeSpan(text: string, span: SourceSpan): void {
  if (span.end < span.start) {
    throw new GraphemeSafetyError(
      `SourceSpan end (${span.end}) precedes start (${span.start}); reversed spans are not valid`
    );
  }
  assertGraphemeSafeBoundary(text, span.start);
  assertGraphemeSafeBoundary(text, span.end);
}
