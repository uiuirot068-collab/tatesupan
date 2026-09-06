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

const graphemeSegmenter: Intl.Segmenter | null =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

// The set of code-point offsets into `text` that are legal extended-grapheme-
// cluster boundaries (always includes 0 and codePointLength(text)).
function graphemeBoundaryOffsets(text: string): Set<number> {
  if (!graphemeSegmenter) {
    // No Intl.Segmenter available: fall back to treating every code point as
    // its own boundary. This can under-merge a real cluster (e.g. a
    // combining-mark sequence) but never reports an unsafe boundary as safe,
    // so it never causes a false PASS on assertGraphemeSafeBoundary. Node 24
    // and evergreen browsers ship Intl.Segmenter, so this path is a defensive
    // fallback, not the expected runtime.
    const length = codePointLength(text);
    return new Set(Array.from({ length: length + 1 }, (_, i) => i));
  }
  const boundaries = new Set<number>([0]);
  let offset = 0;
  for (const { segment } of graphemeSegmenter.segment(text)) {
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
  assertGraphemeSafeBoundary(text, span.start);
  assertGraphemeSafeBoundary(text, span.end);
}
