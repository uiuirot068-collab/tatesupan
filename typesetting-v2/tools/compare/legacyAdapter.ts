// Stage C — legacy engine adapter (CORE_MIGRATION_ROLLBACK_PLAN.md §2).
// READ-ONLY consumer of `src/lib/tategaki.ts`'s exported pure functions —
// nothing here modifies, forks, or re-implements legacy's tokenization or
// pagination algorithm. `tategaki.ts` has zero external imports of its own,
// so this file needs no `@/*` alias resolution and no `pageLayout.ts`
// import (Track C1 supplies capacity numbers directly — see compare.ts —
// rather than deriving them from `computePageLayout`, per this Stage C
// Loop's own "equivalent resolved chars-per-line/lines-per-column" brief).
//
// Adapter-boundary limitation, disclosed rather than worked around: legacy
// exposes exact SOURCE-MAPPED ranges only at page granularity
// (`computePageSourceRanges`). Its exported `paginateTokens` operates on
// `TategakiToken[]` with offsets already stripped (`tokenizeTategaki` maps
// away `OffsetToken.start/end` before pagination), and a text token can be
// split mid-string during line-fill — recovering an exact per-line source
// span would require re-deriving `paginateTokensByLines`'s own kinsoku/
// nowrap split-point loop, i.e. duplicating legacy's private algorithm,
// which this Stage C Loop's brief explicitly prohibits ("do NOT duplicate
// large amounts of legacy logic"). The chosen substitute: line-level
// comparison uses RECONSTRUCTED LINE TEXT (reading-order concatenation of
// each placed token's comparison text) rather than exact offsets — see
// `normalize.ts`'s `ComparisonLine.text` doc comment. Page-level comparison
// still uses exact, code-point-normalized source spans.

import {
  tokenizeTategakiWithOffsets,
  paginateTokens,
  computePageSourceRanges,
  type PageLineMetrics,
  type TategakiToken,
  type TategakiPage,
  type OffsetToken,
} from "../../../src/lib/tategaki";
import {
  normalizeUtf16Span,
  type ComparisonColumn,
  type ComparisonDocument,
  type ComparisonLine,
  type ComparisonPage,
  type ComparisonUnitKind,
} from "./normalize";

export interface LegacyCompareInput {
  source: string;
  metrics: PageLineMetrics;
}

// Bare "\n" text tokens are legacy's forced-line-break mechanism (every
// `paginateTokensByLines` line ends exactly one, unless the wrap already
// filled the line — see that function's own comment). They carry no visible
// comparison content and are deliberately excluded from `unitKinds`/`text`
// here — v2 has no equivalent structural unit (see the harness's own
// discovered-gap fixture, `fixtures.ts` `paragraph-break-gap`), so keeping
// bare newlines out of the comparison text lets the resulting LINE-COUNT
// divergence surface that gap on its own, without polluting text-content
// comparison with a character neither side would show identically anyway.
function tokenKind(token: TategakiToken): ComparisonUnitKind | null {
  switch (token.type) {
    case "text":
      return token.value === "\n" ? null : "TEXT";
    case "ruby":
      return "RUBY";
    case "tcy":
      return "TCY";
    case "image":
      return "IMAGE";
    case "pageBreak":
      return null;
  }
}

function tokenComparisonText(token: TategakiToken): string {
  switch (token.type) {
    case "text":
      return token.value === "\n" ? "" : token.value;
    case "ruby":
      // Matches legacy's OWN capacity convention (`tokenLength`: ruby costs
      // `base.length`) — the reading annotation is metadata, not flowed text.
      return token.base;
    case "tcy":
      return token.value;
    default:
      return "";
  }
}

function buildLines(tokenLines: TategakiToken[][]): ComparisonLine[] {
  return tokenLines.map((line, lineIndex) => {
    const unitKinds: ComparisonUnitKind[] = [];
    let text = "";
    for (const token of line) {
      const kind = tokenKind(token);
      if (kind) unitKinds.push(kind);
      text += tokenComparisonText(token);
    }
    return { lineIndex, text, unitKinds };
  });
}

function buildColumns(page: TategakiPage): ComparisonColumn[] {
  if (page.columnLines) {
    return [
      { columnIndex: 0, lines: buildLines(page.columnLines[0]) },
      { columnIndex: 1, lines: buildLines(page.columnLines[1]) },
    ];
  }
  return [{ columnIndex: 0, lines: buildLines(page.lines) }];
}

// Independent structural check (not a re-derivation of any break decision):
// does a real 【改ページ】 command token's own span sit in the gap between
// this page's source range and the previous one's? `computePageSourceRanges`
// never calls `mark()` for a pageBreak token, so a real command's span is
// always exactly the un-covered gap between two consecutive page ranges.
function detectManualBreaks(
  offsetTokens: OffsetToken[],
  pageRanges: Array<{ start: number; end: number }>
): boolean[] {
  const breaks = offsetTokens.filter((t) => t.token.type === "pageBreak");
  return pageRanges.map((range, i) => {
    if (i === 0) return false;
    const prevEnd = pageRanges[i - 1].end;
    return breaks.some((b) => b.start >= prevEnd && b.end <= range.start);
  });
}

export interface LegacyMirrorConsistency {
  consistent: boolean;
  paginatedPageCount: number;
  sourceRangePageCount: number;
}

// `paginateTokens` and `computePageSourceRanges` are two independently-
// maintained mirror implementations of the same pagination decision
// (already flagged as a duplication risk by the Editor Inventory,
// `qa/inventory/CURRENT_EDITOR_FEATURE_INVENTORY.md` §1 finding #2). A page
// COUNT mismatch between them is a legacy-internal inconsistency, not a
// v2-vs-legacy difference — surfaced here so it is never silently absorbed
// into a Stage C classification it doesn't belong in.
export function checkLegacyMirrorConsistency(input: LegacyCompareInput): LegacyMirrorConsistency {
  const tokens = tokenizeTategakiWithOffsets(input.source).map((t) => t.token);
  const paginatedPageCount = paginateTokens(tokens, input.metrics).length;
  const sourceRangePageCount = computePageSourceRanges(input.source, input.metrics).length;
  return {
    consistent: paginatedPageCount === sourceRangePageCount,
    paginatedPageCount,
    sourceRangePageCount,
  };
}

export function buildLegacyComparisonDocument(input: LegacyCompareInput): ComparisonDocument {
  const { source, metrics } = input;
  const offsetTokens = tokenizeTategakiWithOffsets(source);
  const plainTokens = offsetTokens.map((t) => t.token);
  const pages = paginateTokens(plainTokens, metrics);
  const pageRanges = computePageSourceRanges(source, metrics);
  const manualBreaks = detectManualBreaks(offsetTokens, pageRanges);

  const comparisonPages: ComparisonPage[] = pages.map((page, i) => {
    const range = pageRanges[i] ?? { start: source.length, end: source.length };
    return {
      pageIndex: i,
      sourceSpan: normalizeUtf16Span(source, range),
      manualBreakBefore: manualBreaks[i] ?? false,
      columns: buildColumns(page),
    };
  });

  return {
    engine: "legacy",
    pages: comparisonPages,
    hold: false, // legacy has no HOLD concept at all — confirmed structurally, not an oversight
    holdReasons: [],
    sourceCodePointLength: Array.from(source).length,
  };
}
