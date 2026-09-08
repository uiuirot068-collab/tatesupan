/**
 * Structural-notation protected ranges (Phase 3, dictionary/NG-word
 * safety -- see `docs/specs/TateSpun_11A_11B_SPEC.md`'s own "Dictionary
 * Safety" requirement). Reuses the REAL, authoritative
 * `tokenizeTategakiWithOffsets` (`src/lib/tategaki.ts`) -- the same
 * tokenizer `v2Bridge`'s own manuscript adapter already reuses -- rather
 * than re-deriving a second parser/regex set for this purpose.
 *
 * A dictionary/NG match that overlaps a protected range (ruby, TCY,
 * image marker, page-break marker) is never offered as a safe automatic
 * replacement -- it can still be reported (a stray NG word could
 * legitimately appear inside a ruby reading, say), but this module lets
 * the dictionary/NG rules decide to skip suggesting a replacement there.
 */
import { tokenizeTategakiWithOffsets } from "../tategaki";

export interface ProtectedRange {
  start: number;
  end: number;
}

const PROTECTED_TOKEN_TYPES = new Set(["ruby", "tcy", "image", "pageBreak"]);

export function computeProtectedRanges(text: string): ProtectedRange[] {
  return tokenizeTategakiWithOffsets(text)
    .filter((t) => PROTECTED_TOKEN_TYPES.has(t.token.type))
    .map((t) => ({ start: t.start, end: t.end }));
}

export function overlapsProtectedRange(start: number, end: number, ranges: ProtectedRange[]): boolean {
  return ranges.some((r) => start < r.end && end > r.start);
}
