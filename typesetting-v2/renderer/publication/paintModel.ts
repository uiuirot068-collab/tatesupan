// P3-O08 — Publication Renderer Foundation: CanonicalDocument -> a
// renderer-independent, physical-unit Publication paint model.
//
// Sibling of `renderer/preview/paintModel.ts`, not a dependent of it (per
// this task's own instruction: "Preview and Publication are sibling
// consumers of CanonicalDocument", never one depending on the other's
// module or DOM). The concept lineage (span-lookup convention, yTick+indent
// paint-time addition, last-unit-extent approximation, paint-kind
// classification) is the SAME general pattern already proven correct by
// Preview — re-derived here in physical millimeters via `tickToMm`, never
// imported from `renderer/preview/`, and with zero browser/DOM/CSS
// dependency of any kind (this module never touches `document`, `window`,
// React, or any style string).
//
// PAINTER OF CANONICAL DECISIONS ONLY (INV-002/INV-003/INV-004/INV-009):
// never re-tokenizes, never re-runs kinsoku, never chooses a break, never
// derives capacity, never remeasures, never computes ruby annotation
// geometry itself (reads Core's own already-placed `rubyBoundaryPolicy`/
// `rubyReadingOffsetTick`/`rubyReadingExtentTick` read-only, exactly like
// Preview does).

import type { CanonicalDocument, CanonicalPage, LogicalUnit, PlacedUnit } from "../../core";
import type { SourceSpan } from "../../core/source/span";
import { tickToMm } from "./geometry";

export type PaintUnitKind = "TEXT" | "RUBY" | "TCY" | "SEMANTIC_RUN" | "IMAGE" | "UNKNOWN";

// Publication has not had ANY Human Visual QA on any special-unit kind —
// Preview's own Human PASS (Ruby anchor, TCY, Dash, Ellipsis) does NOT
// transfer here (Master §28.10: "Preview PASSはPublication PASSを意味しない"
// — the three quality gates, Logical/Preview/Publication, are independently
// maintained). Every one of these kinds is therefore marked provisional at
// the Publication layer specifically, regardless of Preview's own status.
const PROVISIONAL_KINDS: ReadonlySet<PaintUnitKind> = new Set(["RUBY", "TCY", "SEMANTIC_RUN", "IMAGE"]);

export type RubyAnnotationPaint =
  | { status: "PENDING" }
  | { status: "PLACED"; policy: "CENTER" | "START_CLAMP" | "END_CLAMP" | "OVERFLOW_OPEN"; offsetMm: number; extentMm: number; text: string };

export type ImageResolution = { kind: "PLACEHOLDER" } | { kind: "RESOLVED"; url: string };
export type ImageResolver = (refId: string) => ImageResolution;
export const defaultPlaceholderImageResolver: ImageResolver = () => ({ kind: "PLACEHOLDER" });

export interface PaintDebugInfo {
  pageOrder: number;
  columnOrder: number;
  lineOrder: number;
  sourceSpan: SourceSpan;
  unitKind: PaintUnitKind;
  yTick: number;
}

export interface PaintPlacedUnit {
  id: string;
  kind: PaintUnitKind;
  text: string;
  sourceSpan: SourceSpan;
  topMm: number;
  heightMm: number;
  heightIsApproximate: boolean;
  provisional: boolean;
  rubyAnnotation?: RubyAnnotationPaint;
  imageResolution?: ImageResolution;
  semanticRunKind?: "DASH" | "ELLIPSIS" | "TWO_DOT_LEADER";
  debug: PaintDebugInfo;
}

export interface PaintLine {
  id: string;
  order: number;
  rightMm: number;
  widthMm: number;
  units: PaintPlacedUnit[];
  indentMm?: number;
  indentTick?: number;
}

export interface PaintColumn {
  id: string;
  order: number;
  rightMm: number;
  widthMm: number;
  residualSpaceMm: number;
  lines: PaintLine[];
}

// Human Visual QA HOLD round 20/21/22 (P3-O08 final-page completion,
// Steps 1/1B/1C): `CanonicalPage.folio?: GeneratedPageFurniture`
// (Contract §15, page-decoration layer) is now real, generated Core
// data — `core/folio/index.ts` populates it (ported verbatim from
// legacy `src/lib/pageLayout.ts`'s `MasterPageSettings`), including
// round 22's own parity-aware gutter/outer -> left/right resolution
// (ported from `PageCard.tsx`'s own `isOddPage`/`anchoredSide` logic).
// Publication resolves both here, consistent with every OTHER unit in
// this file's own convention (paintModel.ts always resolves paint-ready
// data up front; `pdfGenerator.ts` never re-touches raw Core types) — a
// deliberate, documented divergence from Preview's own raw pass-through.
//
// Physical mm is intentionally NOT resolved here: Core's own
// `ResolvedFolioPosition` ("center"/"left"/"right") is still SEMANTIC —
// Core does not own physical paper geometry
// (`PublicationPageGeometry`, a Publication-paint-boundary-only
// concept), so converting a resolved side into an actual xMm/topMm
// happens in `pdfGenerator.ts`, which is the only place that ever sees
// real page margins. 柱 (`GeneratedHeader`/`PaintHeader`) follows the
// exact same split — `position` (round 25: `band` top/bottom crossed
// with `horizontal`, the SAME center/left/right vocabulary folio's own
// `PaintFolio.position` already uses, already parity-resolved by Core)
// stays semantic here; only physical mm conversion happens at the
// Publication paint boundary.
export interface PaintFolio {
  text: string;
  position: "center" | "left" | "right";
}

export interface PaintHeader {
  text: string;
  position: { band: "top" | "bottom"; horizontal: "center" | "left" | "right" };
}

export interface PaintPage {
  id: string;
  order: number;
  widthMm: number;
  heightMm: number;
  manualBreakBefore: boolean;
  columns: PaintColumn[];
  folio?: PaintFolio;
  header?: PaintHeader;
}

export interface PublicationRenderContext {
  linePitchTicks: number;
  lineExtentTicks: number;
  columnExtentTicks: number;
  columnsPerPage: number;
  measurementIdentity: string;
  paintFontIdentity: string;
  imageResolver?: ImageResolver;
}

export interface PublicationDocument {
  id: string;
  label: string;
  hold: boolean;
  holdReasons: string[];
  fontIdentityMismatch: boolean;
  totalPageCount: number;
  renderedPageCount: number;
  // Human Visual QA HOLD round 9 (glyph-size regression): the fixed,
  // document-wide body em size in mm, derived from `ctx.linePitchTicks`
  // (a declared LayoutSettings constant — `settings.linePitchTicks`,
  // never a per-atom composed advance). Deliberately NEVER derived from
  // any specific `PaintPlacedUnit.heightMm` — that field is a
  // POSITIONING quantity (how far this atom's own cell extends, which
  // round 8's yakumono compression can legitimately shrink for specific
  // adjacent punctuation pairs) and must never double as a FONT-SIZE
  // quantity. Every glyph in this document paints at this same size
  // (divided by grapheme count for multi-character atoms), regardless of
  // how compressed or approximate its own positioning `heightMm` is.
  bodyEmMm: number;
  pages: PaintPage[];
  // Human Visual QA HOLD round 26 (P3-O08 final-page completion, Step
  // 2, structural colophon): Core's own `CanonicalDocument.colophon`
  // (Contract §15, a distinct, isolated `ColophonBlock`, never threaded
  // through body columns/lines) resolved into paint-ready pages via the
  // SAME `buildPaintPage` this file already uses for body pages —
  // reused, not reimplemented. `undefined` when no colophon was
  // composed (every existing caller, byte-identical to before this
  // field existed). Orientation (colophon is real, legacy-confirmed
  // HORIZONTAL content, `src/lib/colophon.ts`'s own `writing-mode:
  // horizontal-tb`) is a Publication PAINT-TIME decision, per this
  // file's own established boundary (paintModel.ts resolves structure;
  // `pdfGenerator.ts` decides how to walk it) — these pages carry the
  // exact same tick-derived `PaintPage` shape as body pages; only
  // `pdfGenerator.ts` interprets them differently.
  colophonPages?: PaintPage[];
}

function findOwningUnit(units: LogicalUnit[], span: SourceSpan): LogicalUnit | null {
  return units.find((u) => span.start >= u.span.start && span.end <= u.span.end) ?? null;
}

function paintKindFor(unit: LogicalUnit): PaintUnitKind {
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
      return "UNKNOWN";
  }
}

function sliceCodePoints(source: string, start: number, end: number): string {
  return Array.from(source).slice(start, end).join("");
}

function textFor(kind: PaintUnitKind, placedSpan: SourceSpan, source: string): string {
  if (kind === "IMAGE" || kind === "UNKNOWN") return "";
  return sliceCodePoints(source, placedSpan.start, placedSpan.end).replace(/\n/g, "");
}

function rubyAnnotationFor(owner: LogicalUnit & { kind: "RUBY" }, placed: PlacedUnit): RubyAnnotationPaint {
  if (placed.rubyBoundaryPolicy === undefined || placed.rubyReadingOffsetTick === undefined || placed.rubyReadingExtentTick === undefined) {
    return { status: "PENDING" };
  }
  const segment = owner.segments?.find((s) => s.baseSpan.start === placed.sourceSpan.start && s.baseSpan.end === placed.sourceSpan.end);
  return {
    status: "PLACED",
    policy: placed.rubyBoundaryPolicy,
    offsetMm: tickToMm(placed.rubyReadingOffsetTick),
    extentMm: tickToMm(placed.rubyReadingExtentTick),
    text: segment ? segment.readingText : owner.readingText,
  };
}

function buildPaintLine(
  line: { id: string; indentTick?: number; placedUnits: PlacedUnit[] },
  lineIndex: number,
  pageOrder: number,
  columnOrder: number,
  units: LogicalUnit[],
  source: string,
  ctx: PublicationRenderContext
): PaintLine {
  const indentOffsetTicks = line.indentTick ?? 0;
  const resolveImage = ctx.imageResolver ?? defaultPlaceholderImageResolver;

  const units_: PaintPlacedUnit[] = line.placedUnits.map((placed, i) => {
    const owner = findOwningUnit(units, placed.sourceSpan);
    const kind = owner ? paintKindFor(owner) : "UNKNOWN";
    const next = line.placedUnits[i + 1];
    const prev = line.placedUnits[i - 1];
    let extentTicks: number;
    let heightIsApproximate: boolean;
    if (next) {
      extentTicks = next.yTick - placed.yTick;
      heightIsApproximate = false;
    } else {
      // Same disclosed DEV-ONLY last-atom estimate as Preview's own
      // P3-O09-PAGE-CONTENT-CLIPPING-HOLD fix (renderer/preview/paintModel.ts) —
      // clamped so it can only ever shrink toward the line's own remaining
      // budget, never overshoot it.
      const remainingLineExtentTicks = Math.max(ctx.lineExtentTicks - (placed.yTick + indentOffsetTicks), 0);
      const guess = prev ? placed.yTick - prev.yTick : ctx.linePitchTicks;
      extentTicks = Math.min(guess, remainingLineExtentTicks);
      heightIsApproximate = true;
    }
    const text = textFor(kind, placed.sourceSpan, source);
    const heightMm = Math.max(tickToMm(extentTicks), 0.001);
    const semanticRunKind = kind === "SEMANTIC_RUN" && owner && owner.kind === "SEMANTIC_RUN" ? owner.runKind : undefined;
    return {
      id: placed.id,
      kind,
      text,
      sourceSpan: placed.sourceSpan,
      topMm: tickToMm(placed.yTick + indentOffsetTicks),
      heightMm,
      heightIsApproximate,
      provisional: PROVISIONAL_KINDS.has(kind),
      ...(kind === "RUBY" && owner && owner.kind === "RUBY" ? { rubyAnnotation: rubyAnnotationFor(owner, placed) } : {}),
      ...(kind === "IMAGE" && owner && owner.kind === "IMAGE" ? { imageResolution: resolveImage(owner.refId) } : {}),
      ...(semanticRunKind ? { semanticRunKind } : {}),
      debug: {
        pageOrder,
        columnOrder,
        lineOrder: lineIndex,
        sourceSpan: placed.sourceSpan,
        unitKind: kind,
        yTick: placed.yTick,
      },
    };
  });

  return {
    id: line.id,
    order: lineIndex,
    rightMm: tickToMm(lineIndex * ctx.linePitchTicks),
    widthMm: tickToMm(ctx.linePitchTicks),
    units: units_,
    indentMm: line.indentTick !== undefined ? tickToMm(line.indentTick) : undefined,
    indentTick: line.indentTick,
  };
}

function buildPaintColumn(
  column: { id: string; residualSpaceTick: number; lines: Array<{ id: string; indentTick?: number; placedUnits: PlacedUnit[] }> },
  columnIndex: number,
  pageOrder: number,
  units: LogicalUnit[],
  source: string,
  ctx: PublicationRenderContext
): PaintColumn {
  return {
    id: column.id,
    order: columnIndex,
    rightMm: tickToMm(columnIndex * ctx.columnExtentTicks),
    widthMm: tickToMm(ctx.columnExtentTicks),
    residualSpaceMm: tickToMm(column.residualSpaceTick),
    lines: column.lines.map((line, i) => buildPaintLine(line, i, pageOrder, columnIndex, units, source, ctx)),
  };
}

function buildPaintPage(page: CanonicalPage, manualBreakBefore: boolean, units: LogicalUnit[], source: string, ctx: PublicationRenderContext): PaintPage {
  return {
    id: page.id,
    order: page.order,
    widthMm: tickToMm(ctx.columnsPerPage * ctx.columnExtentTicks),
    heightMm: tickToMm(ctx.lineExtentTicks),
    manualBreakBefore,
    columns: page.columns.map((col, i) => buildPaintColumn(col, i, page.order, units, source, ctx)),
    ...(page.folio ? { folio: { text: page.folio.text, position: page.folio.position } } : {}),
    ...(page.header ? { header: { text: page.header.text, position: page.header.position } } : {}),
  };
}

function flattenPlacedUnits(page: CanonicalPage): PlacedUnit[] {
  const flat: PlacedUnit[] = [];
  for (const column of page.columns) {
    for (const line of column.lines) flat.push(...line.placedUnits);
  }
  return flat;
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

// Publication renders EVERY page — no bounded-window concept (that is a
// Preview-only, on-screen-performance convenience; a Publication document
// is a fixed, finite manuscript that must all be produced).
export function buildPublicationDocument(
  id: string,
  label: string,
  document: CanonicalDocument,
  units: LogicalUnit[],
  source: string,
  ctx: PublicationRenderContext,
  // Human Visual QA HOLD round 26: the colophon's own separate
  // LogicalUnit[]/source pair (it is composed from an entirely
  // different SourceBlock than the body, per Contract §15 -- its own
  // `sourceSpan`s are meaningless against the body's own `source`
  // string). Optional and additive; omitting it (every existing
  // caller) leaves `colophonPages` undefined, byte-identical to before
  // this parameter existed.
  colophonUnits?: LogicalUnit[],
  colophonSource?: string
): PublicationDocument {
  const manualBreaks = detectManualBreaks(units, document.pages);
  const pages = document.pages.map((page, i) => buildPaintPage(page, manualBreaks[i] ?? false, units, source, ctx));

  const colophonPages =
    document.colophon && colophonUnits && colophonSource !== undefined
      ? document.colophon.pages.map((page) => buildPaintPage(page, false, colophonUnits, colophonSource, ctx))
      : undefined;

  return {
    id,
    label,
    hold: document.hold,
    holdReasons: document.errors.map((e) => e.message),
    fontIdentityMismatch: ctx.measurementIdentity !== ctx.paintFontIdentity,
    totalPageCount: document.pages.length,
    renderedPageCount: pages.length,
    bodyEmMm: tickToMm(ctx.linePitchTicks),
    pages,
    ...(colophonPages ? { colophonPages } : {}),
  };
}
