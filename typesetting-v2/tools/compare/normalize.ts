// Stage C — normalized comparison model + source-coordinate normalization
// (CORE_MIGRATION_ROLLBACK_PLAN.md §1/§2). Both the legacy adapter and the
// v2 adapter produce this SAME shape; comparison logic (classify.ts) only
// ever looks at this normalized model, never at either engine's own
// internal object shapes directly.
//
// Source-offset normalization (critical, per the Stage C brief): legacy
// (`src/lib/tategaki.ts`) indexes raw JS strings, i.e. UTF-16 code units —
// confirmed by direct read (`value[i]`, `value.length`, `value.slice(i,j)`
// throughout `paginateTokensByLines`/`computePageSourceRanges`, with no
// surrogate-pair guard). v2's canonical `SourceSpan` (Core Contract §4) is
// Unicode CODE-POINT offsets. Every span this module returns is normalized
// to code-point offsets — the v2 canonical convention — so a difference in
// indexing convention alone can never be mistaken for a real logical
// difference between engines.

export interface NormalizedSpan {
  start: number; // code-point offset, half-open range start
  end: number; // code-point offset, half-open range end
}

export type ComparisonUnitKind = "TEXT" | "RUBY" | "TCY" | "SEMANTIC_RUN" | "IMAGE";
// MANUAL_BREAK is deliberately not a placed-unit kind here: neither engine
// places it as visible content (legacy: zero tokenLength, never appears in
// a line; v2: zero-width marker span, no PlacedUnit). Its effect is
// captured instead as ComparisonPage.manualBreakBefore.

export interface ComparisonLine {
  lineIndex: number;
  // Reconstructed comparison text for this line, in reading order — an
  // explicit, disclosed substitute for exact per-character sub-line source
  // offsets (see legacyAdapter.ts's own module comment for why legacy
  // cannot expose those without duplicating its private split algorithm).
  // RUBY units contribute their base text only, TCY its logical value, TEXT
  // its literal text — mirroring both engines' own capacity-accounting
  // convention (legacy's `tokenLength`; v2's `advanceTickFor`), so this text
  // is a fair, engine-neutral comparison key, not a rendering string.
  text: string;
  unitKinds: ComparisonUnitKind[];
}

export interface ComparisonColumn {
  columnIndex: number;
  lines: ComparisonLine[];
}

export interface ComparisonPage {
  pageIndex: number;
  // Exact, code-point-normalized page source range — both engines expose
  // this precisely (legacy via `computePageSourceRanges`, v2 via its first/
  // last placed unit's sourceSpan), unlike per-line spans (see above).
  sourceSpan: NormalizedSpan;
  manualBreakBefore: boolean;
  columns: ComparisonColumn[];
}

export interface ComparisonDocument {
  engine: "legacy" | "v2";
  pages: ComparisonPage[];
  hold: boolean;
  holdReasons: string[];
  // Total code-point length of the manuscript's flowed body content (not
  // including out-of-flow annotation regions the v2 fixture encoding may
  // append — see fixtures.ts). Used for source-integrity checks (§ "no
  // source unit lost/duplicated").
  sourceCodePointLength: number;
}

/** UTF-16 code-unit offset -> Unicode code-point offset, over `source`. */
export function utf16ToCodePointOffset(source: string, utf16Offset: number): number {
  return Array.from(source.slice(0, utf16Offset)).length;
}

/** Unicode code-point offset -> UTF-16 code-unit offset, over `source`. */
export function codePointToUtf16Offset(source: string, codePointOffset: number): number {
  let utf16 = 0;
  let cp = 0;
  for (const ch of source) {
    if (cp === codePointOffset) return utf16;
    cp += 1;
    utf16 += ch.length;
  }
  return utf16;
}

export function normalizeUtf16Span(
  source: string,
  span: { start: number; end: number }
): NormalizedSpan {
  return {
    start: utf16ToCodePointOffset(source, span.start),
    end: utf16ToCodePointOffset(source, span.end),
  };
}
