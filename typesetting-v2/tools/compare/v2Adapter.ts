// Stage C — v2 Canonical Core adapter (CORE_MIGRATION_ROLLBACK_PLAN.md §2).
// Consumes only the public entry point (`typesetting-v2/core/index.ts`) —
// never a private `core/compose/*` internal — and never re-derives a break,
// a capacity number, or a kinsoku decision. It only (a) calls
// `composeCanonicalDocument` once, and (b) reads back its already-final
// `CanonicalDocument` into the same normalized `ComparisonDocument` shape
// `legacyAdapter.ts` produces, via a read-only span lookup against the same
// `LogicalUnit[]` the caller already built (identical technique to the one
// recommended for the Preview Development Adapter plan's own input
// contract, `qa/research/PREVIEW_DEVELOPMENT_ADAPTER_PLAN.md` §3/§4).

import {
  composeCanonicalDocument,
  DEFAULT_RULE_SET_V2,
  createFakeMeasurementProvider,
  type CanonicalDocument,
  type CanonicalPage,
  type LogicalUnit,
  type PageCompositionSettings,
  type PlacedUnit,
} from "../../core";
import type { BlockId, SourceSpan } from "../../core/source/span";
import {
  type ComparisonColumn,
  type ComparisonDocument,
  type ComparisonLine,
  type ComparisonPage,
  type ComparisonUnitKind,
} from "./normalize";

export interface V2CompareInput {
  bodyUnits: LogicalUnit[];
  colophonUnits?: LogicalUnit[];
  colophonBlockId?: BlockId;
  // The hand-authored fixture's own source string — used only to slice a
  // RubyUnit's `baseSpan` (the only unit kind whose comparison text isn't
  // already stored inline, since `RubyUnit` carries a span, not the base
  // text itself). Code-point indexed, matching SourceSpan's own convention
  // (Core Contract §4) — no UTF-16 conversion needed on this side.
  v2Source: string;
  settings: PageCompositionSettings;
}

function sliceCodePoints(source: string, start: number, end: number): string {
  return Array.from(source).slice(start, end).join("");
}

function findOwningUnit(units: LogicalUnit[], span: SourceSpan): LogicalUnit | null {
  return units.find((u) => span.start >= u.span.start && span.end <= u.span.end) ?? null;
}

function comparisonKindFor(unit: LogicalUnit): ComparisonUnitKind | null {
  switch (unit.kind) {
    case "TEXT":
      return "TEXT";
    case "RUBY":
      return "RUBY";
    case "TCY":
      return "TCY";
    case "SEMANTIC_RUN":
      return "SEMANTIC_RUN";
    case "IMAGE":
      return "IMAGE";
    case "MANUAL_BREAK":
      return null; // zero-width marker, never a visible placed unit — mirrors legacy's pageBreak exclusion
    case "PARAGRAPH_BREAK":
      return null; // zero visible content (advance 0) — mirrors legacyAdapter.ts's own bare-"\n" exclusion
  }
}

// Deliberately slices `v2Source` by the PLACED ATOM's own span, never by
// the owning LogicalUnit's full span. A single LogicalUnit (a multi-char
// TextUnit, or a JUKUGO RubyUnit with declared segments) can be split by
// Core into SEVERAL placed atoms sharing one owner — using the owning
// unit's full text/span for every one of its atoms would duplicate that
// unit's content once per atom (caught by this harness's own fixture
// tests: `dash-run` initially reproduced exactly this duplication before
// this fix). Slicing `v2Source` by the placed span instead is correct for
// every kind this harness cares about, because `fixtureBuilder.ts`
// constructs `v2Source`'s flow region so that `v2Source.slice(u.span.start,
// u.span.end)` already equals that unit's own flowed content verbatim —
// so a SUB-range of that same span (the placed atom's span) is
// automatically the correct sub-content too, with no per-kind logic needed.
function comparisonTextFor(kind: ComparisonUnitKind, placedSpan: SourceSpan, v2Source: string): string {
  if (kind === "IMAGE") return "";
  // Strip bare "\n": legacy always isolates a "\n" as its own zero-content
  // token (`legacyAdapter.ts`'s `tokenComparisonText`), so comparing WITH
  // it embedded here would count it as flowed content on v2's side but not
  // legacy's — a spurious asymmetry in this harness's own convention, not a
  // real engine difference. The resulting LINE-COUNT divergence still
  // surfaces the real, newly-discovered gap this asymmetry would otherwise
  // have masked (see `fixtures.ts`'s `paragraph-break-gap`).
  return sliceCodePoints(v2Source, placedSpan.start, placedSpan.end).replace(/\n/g, "");
}

function flattenPlacedUnitsInOrder(page: CanonicalPage): PlacedUnit[] {
  const flat: PlacedUnit[] = [];
  for (const column of page.columns) {
    for (const line of column.lines) {
      flat.push(...line.placedUnits);
    }
  }
  return flat;
}

function buildComparisonColumns(
  page: CanonicalPage,
  units: LogicalUnit[],
  v2Source: string
): ComparisonColumn[] {
  return page.columns.map((column, columnIndex) => ({
    columnIndex,
    lines: column.lines.map((line, lineIndex): ComparisonLine => {
      const unitKinds: ComparisonUnitKind[] = [];
      let text = "";
      for (const placed of line.placedUnits) {
        const owner = findOwningUnit(units, placed.sourceSpan);
        if (!owner) continue; // should not happen against a self-consistent fixture; skip rather than throw during comparison
        const kind = comparisonKindFor(owner);
        if (!kind) continue; // MANUAL_BREAK: zero-width marker, never a visible placed unit
        unitKinds.push(kind);
        text += comparisonTextFor(kind, placed.sourceSpan, v2Source);
      }
      return { lineIndex, text, unitKinds };
    }),
  }));
}

// Same independent structural technique as `legacyAdapter.ts`'s
// `detectManualBreaks`: does a `ManualBreakUnit`'s own span sit in the gap
// between this page's first placed source offset and the previous page's
// last? Reads the original (pre-composition) unit list, not any composition
// internal.
function detectManualBreaks(units: LogicalUnit[], pageBounds: Array<{ start: number; end: number }>): boolean[] {
  const breaks = units.filter((u) => u.kind === "MANUAL_BREAK");
  return pageBounds.map((bounds, i) => {
    if (i === 0) return false;
    const prevEnd = pageBounds[i - 1].end;
    return breaks.some((b) => b.span.start >= prevEnd && b.span.end <= bounds.start);
  });
}

function pageSourceBounds(page: CanonicalPage): { start: number; end: number } {
  const flat = flattenPlacedUnitsInOrder(page);
  if (flat.length === 0) return { start: -1, end: -1 }; // empty page (e.g. a HOLD page) — no comparable bounds
  return { start: flat[0].sourceSpan.start, end: flat[flat.length - 1].sourceSpan.end };
}

function buildComparisonDocument(
  engine: "v2",
  canonicalPages: CanonicalPage[],
  units: LogicalUnit[],
  v2Source: string,
  hold: boolean,
  holdReasons: string[]
): ComparisonDocument {
  const bounds = canonicalPages.map(pageSourceBounds);
  const manualBreaks = detectManualBreaks(units, bounds);

  const pages: ComparisonPage[] = canonicalPages.map((page, i) => ({
    pageIndex: i,
    sourceSpan: bounds[i].start < 0 ? { start: 0, end: 0 } : bounds[i],
    manualBreakBefore: manualBreaks[i] ?? false,
    columns: buildComparisonColumns(page, units, v2Source),
  }));

  return {
    engine,
    pages,
    hold,
    holdReasons,
    sourceCodePointLength: Array.from(v2Source).length,
  };
}

export function buildV2ComparisonDocument(input: V2CompareInput): {
  comparison: ComparisonDocument;
  raw: CanonicalDocument;
} {
  const measurement = createFakeMeasurementProvider();
  const raw = composeCanonicalDocument({
    bodyUnits: input.bodyUnits,
    colophonUnits: input.colophonUnits,
    colophonBlockId: input.colophonBlockId,
    ruleSet: DEFAULT_RULE_SET_V2,
    measurement,
    settings: input.settings,
  });

  const bodyComparison = buildComparisonDocument(
    "v2",
    raw.pages,
    input.bodyUnits,
    input.v2Source,
    raw.hold,
    raw.errors.map((e) => e.message)
  );

  // Colophon pages are reported as a separate ComparisonDocument-shaped
  // value's pages, appended after body pages, tagged via a distinguishing
  // pageIndex offset — Stage C never threads colophon through the body's
  // own page list, mirroring the Core's own structural isolation
  // (`core/colophon/index.ts` — confirmed by direct read: it cannot accept
  // or return a body CanonicalColumn/CanonicalLine at all).
  if (input.colophonUnits && input.colophonUnits.length > 0 && raw.colophon) {
    const colophonComparison = buildComparisonDocument(
      "v2",
      raw.colophon.pages,
      input.colophonUnits,
      input.v2Source,
      raw.hold,
      []
    );
    return {
      comparison: {
        ...bodyComparison,
        pages: [
          ...bodyComparison.pages,
          ...colophonComparison.pages.map((p) => ({ ...p, pageIndex: bodyComparison.pages.length + p.pageIndex })),
        ],
      },
      raw,
    };
  }

  return { comparison: bodyComparison, raw };
}
