// Stage D — CanonicalDocument -> paint-only ViewModel.
//
// PAINTER OF CANONICAL DECISIONS ONLY (PREVIEW_DEVELOPMENT_ADAPTER_PLAN.md
// §4/INV-002/INV-003/INV-004/INV-009): this module never re-tokenizes,
// never re-runs kinsoku, never chooses a break, never derives capacity,
// never remeasures. It only (a) reads an already-finished CanonicalDocument
// back through a read-only span lookup against the SAME LogicalUnit[] the
// caller already built (never re-derives content), and (b) converts
// GeometryTick values to px for painting (one-way, geometry.ts).
//
// Extent-ambiguity note (per the Preview Adapter plan's own audit, §3 gap
// 2): PlacedUnit carries no explicit width/height field. This module
// derives it from consecutive placedUnits' own yTick deltas where safe
// (exact, since Core places units contiguously with no gaps); for the LAST
// unit on a line, no next-unit delta exists, so a DEV-ONLY approximation is
// used (the previous unit's own delta, or a caller-supplied nominal cell
// size as a last resort) — never a fabricated "canonical" size, always
// clearly a paint convenience.

import type {
  CanonicalColumn,
  CanonicalDocument,
  CanonicalLine,
  CanonicalPage,
  LogicalUnit,
  PlacedUnit,
} from "../../core";
import type { SourceSpan } from "../../core/source/span";
import { tickToPx } from "./geometry";

export type ViewUnitKind = "TEXT" | "RUBY" | "TCY" | "SEMANTIC_RUN" | "IMAGE" | "UNKNOWN";

// Kinds whose FINAL visual quality is explicitly not yet solved (P3-O03/
// O04/O05/O06, ruby-placement wiring gap) — painted, but always labeled
// provisional so a reviewer never mistakes v0 painting for approved
// typography (Preview Adapter plan §9's own instruction).
const PROVISIONAL_KINDS: ReadonlySet<ViewUnitKind> = new Set(["RUBY", "TCY", "SEMANTIC_RUN", "IMAGE"]);

export interface ViewPlacedUnit {
  id: string;
  kind: ViewUnitKind;
  text: string;
  sourceSpan: SourceSpan;
  topPx: number;
  heightPx: number;
  heightIsApproximate: boolean;
  provisional: boolean;
}

export interface ViewLine {
  id: string;
  order: number;
  rightPx: number;
  units: ViewPlacedUnit[];
  indentPx?: number;
}

export interface ViewColumn {
  id: string;
  order: number;
  rightPx: number;
  widthPx: number;
  residualSpacePx: number;
  lines: ViewLine[];
}

export interface ViewPage {
  id: string;
  order: number;
  widthPx: number;
  heightPx: number;
  manualBreakBefore: boolean;
  columns: ViewColumn[];
}

export interface PreviewRenderContext {
  scaleMultiplier: number;
  /** Same settings the document was actually composed with — echoed back
   * read-only for column/line/page sizing, never rederived. */
  linePitchTicks: number;
  lineExtentTicks: number;
  columnExtentTicks: number;
  columnsPerPage: number;
  /** DEV-ONLY fallback extent (ticks) for a line's last unit, when no
   * following unit exists to derive an exact delta from. Not a canonical
   * value — see this module's own header comment. */
  nominalCellTicks: number;
  /** How many pages to materialize into the view model (bounded page
   * window — Preview Adapter plan §13; full document correctness stays
   * independently verified by the Core test suite, not by this painter). */
  maxPages?: number;
  /** MeasurementFacts identity the document was actually composed against
   * (`VersionMetadata.measurementIdentity`) — echoed for the font-boundary
   * mismatch warning (§ Font Boundary), never used to remeasure. */
  measurementIdentity: string;
  /** The font identity this adapter is ABOUT to paint with — compared
   * against `measurementIdentity` only to decide whether to show a warning. */
  paintFontIdentity: string;
}

export interface PreviewViewModel {
  id: string;
  label: string;
  hold: boolean;
  holdReasons: string[];
  fontIdentityMismatch: boolean;
  totalPageCount: number;
  renderedPageCount: number;
  pages: ViewPage[];
}

function findOwningUnit(units: LogicalUnit[], span: SourceSpan): LogicalUnit | null {
  return units.find((u) => span.start >= u.span.start && span.end <= u.span.end) ?? null;
}

function viewKindFor(unit: LogicalUnit): ViewUnitKind {
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
    case "PARAGRAPH_BREAK":
      return "UNKNOWN"; // zero-content markers, never actually reach this (filtered before painting)
  }
}

function sliceCodePoints(source: string, start: number, end: number): string {
  return Array.from(source).slice(start, end).join("");
}

// Mirrors typesetting-v2/tools/compare/v2Adapter.ts's own comparisonTextFor
// convention: slice the PLACED ATOM's own span out of the read-only source
// string, never the owning unit's full span (a unit can be split into
// several placed atoms sharing one owner — see that file's own comment for
// the duplication bug this exact convention was written to avoid).
function textFor(kind: ViewUnitKind, placedSpan: SourceSpan, source: string): string {
  if (kind === "IMAGE" || kind === "UNKNOWN") return "";
  return sliceCodePoints(source, placedSpan.start, placedSpan.end).replace(/\n/g, "");
}

function detectManualBreaks(units: LogicalUnit[], pages: CanonicalPage[]): boolean[] {
  const breaks = units.filter((u) => u.kind === "MANUAL_BREAK");
  const bounds = pages.map((page) => {
    const flat = flattenPlacedUnits(page);
    if (flat.length === 0) return null;
    return { start: flat[0].sourceSpan.start, end: flat[flat.length - 1].sourceSpan.end };
  });
  return bounds.map((b, i) => {
    if (i === 0 || !b) return false;
    const prev = bounds[i - 1];
    if (!prev) return false;
    return breaks.some((brk) => brk.span.start >= prev.end && brk.span.end <= b.start);
  });
}

function flattenPlacedUnits(page: CanonicalPage): PlacedUnit[] {
  const flat: PlacedUnit[] = [];
  for (const column of page.columns) {
    for (const line of column.lines) flat.push(...line.placedUnits);
  }
  return flat;
}

function buildViewLine(
  line: CanonicalLine,
  lineIndex: number,
  units: LogicalUnit[],
  source: string,
  ctx: PreviewRenderContext
): ViewLine {
  const viewUnits: ViewPlacedUnit[] = line.placedUnits.map((placed, i) => {
    const owner = findOwningUnit(units, placed.sourceSpan);
    const kind = owner ? viewKindFor(owner) : "UNKNOWN";
    const next = line.placedUnits[i + 1];
    const prev = line.placedUnits[i - 1];
    let extentTicks: number;
    let heightIsApproximate: boolean;
    if (next) {
      extentTicks = next.yTick - placed.yTick;
      heightIsApproximate = false;
    } else if (prev) {
      extentTicks = placed.yTick - prev.yTick; // DEV-ONLY approximation — see module header
      heightIsApproximate = true;
    } else {
      extentTicks = ctx.nominalCellTicks; // DEV-ONLY fallback — single-unit line
      heightIsApproximate = true;
    }
    return {
      id: placed.id,
      kind,
      text: textFor(kind, placed.sourceSpan, source),
      sourceSpan: placed.sourceSpan,
      topPx: tickToPx(placed.yTick, ctx.scaleMultiplier),
      heightPx: Math.max(tickToPx(extentTicks, ctx.scaleMultiplier), 1),
      heightIsApproximate,
      provisional: PROVISIONAL_KINDS.has(kind),
    };
  });

  return {
    id: line.id,
    order: lineIndex,
    rightPx: tickToPx(lineIndex * ctx.linePitchTicks, ctx.scaleMultiplier),
    units: viewUnits,
    indentPx: line.indentTick !== undefined ? tickToPx(line.indentTick, ctx.scaleMultiplier) : undefined,
  };
}

function buildViewColumn(column: CanonicalColumn, columnIndex: number, units: LogicalUnit[], source: string, ctx: PreviewRenderContext): ViewColumn {
  return {
    id: column.id,
    order: columnIndex,
    rightPx: tickToPx(columnIndex * ctx.columnExtentTicks, ctx.scaleMultiplier),
    widthPx: tickToPx(ctx.columnExtentTicks, ctx.scaleMultiplier),
    residualSpacePx: tickToPx(column.residualSpaceTick, ctx.scaleMultiplier),
    lines: column.lines.map((line, i) => buildViewLine(line, i, units, source, ctx)),
  };
}

function buildViewPage(page: CanonicalPage, manualBreakBefore: boolean, units: LogicalUnit[], source: string, ctx: PreviewRenderContext): ViewPage {
  return {
    id: page.id,
    order: page.order,
    widthPx: tickToPx(ctx.columnsPerPage * ctx.columnExtentTicks, ctx.scaleMultiplier),
    heightPx: tickToPx(ctx.lineExtentTicks, ctx.scaleMultiplier),
    manualBreakBefore,
    columns: page.columns.map((col, i) => buildViewColumn(col, i, units, source, ctx)),
  };
}

/**
 * Builds a paint-only ViewModel from an already-composed CanonicalDocument.
 * `units` is the SAME LogicalUnit[] (bodyUnits, or colophonUnits for a
 * colophon document) the caller passed into `composeCanonicalDocument` —
 * used only as a read-only span lookup, never re-tokenized. `source` is the
 * caller's own manuscript/fixture source string (code-point indexed,
 * matching SourceSpan's convention) — used only to slice already-decided
 * placed spans back into displayable text.
 */
export function buildPreviewViewModel(
  id: string,
  label: string,
  document: CanonicalDocument,
  units: LogicalUnit[],
  source: string,
  ctx: PreviewRenderContext
): PreviewViewModel {
  const manualBreaks = detectManualBreaks(units, document.pages);
  const maxPages = ctx.maxPages ?? document.pages.length;
  const renderedPages = document.pages.slice(0, maxPages);
  return {
    id,
    label,
    hold: document.hold,
    holdReasons: document.errors.map((e) => e.message),
    fontIdentityMismatch: ctx.measurementIdentity !== ctx.paintFontIdentity,
    totalPageCount: document.pages.length,
    renderedPageCount: renderedPages.length,
    pages: renderedPages.map((page, i) => buildViewPage(page, manualBreaks[i] ?? false, units, source, ctx)),
  };
}
