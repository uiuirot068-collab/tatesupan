// P3-O09 — Preview Renderer Foundation: CanonicalDocument -> paint-only
// PaintModel.
//
// PAINTER OF CANONICAL DECISIONS ONLY (INV-002/INV-003/INV-004/INV-009):
// this module never re-tokenizes, never re-runs kinsoku, never chooses a
// break, never derives capacity, never remeasures, and never computes ruby
// annotation geometry itself (that decision belongs to Core's own
// `ruby/placeRuby`, which is not yet wired into the compose pipeline —
// P3-O06 residual). It only (a) reads an already-finished CanonicalDocument
// back through a read-only span lookup against the SAME LogicalUnit[] the
// caller already built, and (b) converts GeometryTick values to px for
// painting (one-way, geometry.ts).
//
// Concept lineage (P3-O09 Stage D audit, see
// qa/evidence/P3_O09_PREVIEW_RENDERER_FOUNDATION.md §3): the span-lookup
// convention, the yTick+indentTick paint-time addition, and the
// last-unit-extent approximation are all REUSE CONCEPT ONLY from
// `tools/preview-dev-adapter/viewModel.ts` and `tools/compare/v2Adapter.ts`
// — re-derived here as this foundation's own contract (renamed
// View->Paint, NORMAL/DEBUG split added, ruby-annotation state added,
// image-resolver boundary added) rather than imported, per this task's
// explicit "must not depend on the QA artifact generator" instruction.

import type {
  CanonicalColumn,
  CanonicalDocument,
  CanonicalLine,
  CanonicalPage,
  ColophonBlock,
  LogicalUnit,
  PlacedUnit,
} from "../../core";
import type { SourceSpan } from "../../core/source/span";
import { tickToPx } from "./geometry";

export type PaintUnitKind = "TEXT" | "RUBY" | "TCY" | "SEMANTIC_RUN" | "IMAGE" | "UNKNOWN";

// Kinds whose FINAL visual quality is explicitly not yet solved (P3-O03/
// O04/O05/O06) — always painted using their own logical identity, but never
// presented as approved final typography. In NORMAL mode this is simply
// "paint the content plainly, no optical polish yet"; in DEBUG mode the
// renderer may additionally label these — see PreviewRenderer.tsx.
const PROVISIONAL_KINDS: ReadonlySet<PaintUnitKind> = new Set(["RUBY", "TCY", "SEMANTIC_RUN", "IMAGE"]);

// Ruby Placement Micro-Loop: `core/ruby/index.ts`'s `placeRuby()` is now
// wired into `compose/line.ts`, so a RUBY-owned `PlacedUnit` carries real
// canonical annotation geometry (`rubyBoundaryPolicy`/`rubyReadingOffsetTick`/
// `rubyReadingExtentTick`). This Renderer only ever READS those fields and
// converts ticks->px for painting — it never calls `placeRuby()` itself,
// never centers/clamps/measures the annotation on its own, and never
// chooses a ruby segment break (that would make the Renderer a second
// typesetter). "PENDING" is kept as a defensive fallback for the
// theoretical case where a placed atom's owner is RUBY but Core did not
// attach placement data (should not occur post-wiring; never silently
// treated as PLACED with fabricated geometry if it does).
export type RubyAnnotationPaint =
  | { status: "PENDING" }
  | { status: "PLACED"; policy: "CENTER" | "START_CLAMP" | "END_CLAMP" | "OVERFLOW_OPEN"; offsetPx: number; extentPx: number; text: string };

// A Renderer-owned abstraction boundary between "an IMAGE unit's canonical
// occupancy" (Core-owned: refId/intrinsicWidth/intrinsicHeight/placement)
// and "what actually gets painted inside that rectangle" (Renderer-owned).
// The default resolver always reports a placeholder — no network/file
// access, no decode — matching this foundation's own non-goal ("real image
// decode not required for the logical gate", carried from Stage D/Stage C).
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
  isParagraphStartLine: boolean;
  manualBreakBeforePage: boolean;
}

export interface PaintPlacedUnit {
  id: string;
  kind: PaintUnitKind;
  text: string;
  sourceSpan: SourceSpan;
  topPx: number;
  heightPx: number;
  heightIsApproximate: boolean;
  provisional: boolean;
  rubyAnnotation?: RubyAnnotationPaint; // RUBY units only
  imageResolution?: ImageResolution; // IMAGE units only
  debug: PaintDebugInfo;
}

export interface PaintLine {
  id: string;
  order: number;
  rightPx: number;
  widthPx: number;
  units: PaintPlacedUnit[];
  indentPx?: number;
  indentTick?: number;
}

export interface PaintColumn {
  id: string;
  order: number;
  rightPx: number;
  widthPx: number;
  residualSpacePx: number;
  residualSpaceTick: number;
  lines: PaintLine[];
}

export interface PaintPage {
  id: string;
  order: number;
  widthPx: number;
  heightPx: number;
  manualBreakBefore: boolean;
  columns: PaintColumn[];
  // Contract §15 page-decoration layer. Never populated by Core today
  // (verified by direct grep: `folio` appears only in its own type
  // declaration) — passed through unchanged if a future Core ever sets it,
  // painted as nothing when absent. Recorded as PENDING CORE DATA, not
  // invented here.
  folio?: PlacedUnit;
  // TSP-LOOP-005 precedent: a colophon is its own, structurally identical
  // CanonicalPage set, but conventionally set in horizontal writing mode —
  // this is a fixed Renderer painting convention (Contract-consistent),
  // never a per-document Core flag, since no such flag exists in the schema.
  orientation: "vertical" | "horizontal";
}

export interface PreviewRenderContext {
  scaleMultiplier: number;
  linePitchTicks: number;
  lineExtentTicks: number;
  columnExtentTicks: number;
  columnsPerPage: number;
  nominalCellTicks: number;
  maxPages?: number;
  measurementIdentity: string;
  paintFontIdentity: string;
  imageResolver?: ImageResolver;
}

export interface PaintDocument {
  id: string;
  label: string;
  hold: boolean;
  holdReasons: string[];
  fontIdentityMismatch: boolean;
  totalPageCount: number;
  renderedPageCount: number;
  pages: PaintPage[];
  colophonPages?: PaintPage[];
  fontSizePx: number;
}

function findOwningUnit(units: LogicalUnit[], span: SourceSpan): LogicalUnit | null {
  return units.find((u) => span.start >= u.span.start && span.end <= u.span.end) ?? null;
}

// Mirrors core/compose/line.ts's own `rubyReadingTextForAtom` — reads the
// SAME already-stored literal reading text Core itself measured against
// (never re-measures, never re-derives a segment boundary). The matching
// segment's own text when this atom's span equals a declared JUKUGO
// segment's baseSpan; otherwise the whole unit's own readingText (ATOMIC,
// or an undeclared/too-short-to-segment JUKUGO composed as one atom).
function rubyReadingTextForAtom(owner: LogicalUnit & { kind: "RUBY" }, atomSpan: SourceSpan): string {
  const segment = owner.segments?.find((s) => s.baseSpan.start === atomSpan.start && s.baseSpan.end === atomSpan.end);
  return segment ? segment.readingText : owner.readingText;
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
      return "UNKNOWN"; // zero-content markers, never carry a placed atom of their own
  }
}

function sliceCodePoints(source: string, start: number, end: number): string {
  return Array.from(source).slice(start, end).join("");
}

// Slices the PLACED ATOM's own span out of the read-only source string,
// never the owning unit's full span — a unit can be split across several
// placed atoms sharing one owner (the exact text-duplication bug this
// convention avoids is documented in tools/compare/v2Adapter.ts).
function textFor(kind: PaintUnitKind, placedSpan: SourceSpan, source: string): string {
  if (kind === "IMAGE" || kind === "UNKNOWN") return "";
  return sliceCodePoints(source, placedSpan.start, placedSpan.end).replace(/\n/g, "");
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

// Reads back Core's already-computed placement (never recomputes it): a
// RUBY-owned PlacedUnit with `rubyBoundaryPolicy` set carries real geometry
// (Ruby Placement Micro-Loop); this Renderer only converts its tick values
// to px and resolves the matching literal reading text, exactly like any
// other paint-time tick->px conversion in this file.
function rubyAnnotationFor(owner: LogicalUnit & { kind: "RUBY" }, placed: PlacedUnit, ctx: PreviewRenderContext): RubyAnnotationPaint {
  if (!placed.rubyBoundaryPolicy) return { status: "PENDING" };
  return {
    status: "PLACED",
    policy: placed.rubyBoundaryPolicy,
    offsetPx: tickToPx(placed.rubyReadingOffsetTick ?? 0, ctx.scaleMultiplier),
    extentPx: tickToPx(placed.rubyReadingExtentTick ?? 0, ctx.scaleMultiplier),
    text: rubyReadingTextForAtom(owner, placed.sourceSpan),
  };
}

function buildPaintLine(
  line: CanonicalLine,
  lineIndex: number,
  pageOrder: number,
  columnOrder: number,
  manualBreakBeforePage: boolean,
  units: LogicalUnit[],
  source: string,
  ctx: PreviewRenderContext
): PaintLine {
  // Core's own contract (schema.ts `CanonicalLine.indentTick` doc comment):
  // `PlacedUnit.yTick` is always line-relative starting at 0, regardless of
  // indent. A Renderer is responsible for adding `line.indentTick` itself
  // before painting (STAGE-D-FIRST-LINE-INDENT-VISUAL-HOLD fix, carried
  // forward here as this foundation's own correct behavior from day one).
  const indentOffsetTicks = line.indentTick ?? 0;
  const isParagraphStartLine = line.indentTick !== undefined;
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
      // P3-O09-PAGE-CONTENT-CLIPPING-HOLD: a line's LAST placed atom has no
      // next atom to derive an exact delta from, so this DEV-ONLY estimate
      // (never a fabricated "canonical" size) borrows either the previous
      // atom's own delta, or a nominal single-cell fallback when this is
      // the line's only atom. Both are only ever GUESSES about this atom's
      // OWN extent — when the previous atom was a wider unit (a multi-cell
      // SEMANTIC_RUN/TCY/IMAGE), naively reusing its delta could overshoot
      // past the line's own remaining extent, pushing this atom's painted
      // bottom edge past the page's own bottom edge (proven by
      // generateFoundationArtifact.test.ts's "no placed unit... exceeds
      // its own page's heightPx" regression: dash-ellipsis and
      // image-placeholder both overshot before this clamp existed). Since
      // Core guarantees `placed.yTick` never places this atom beyond the
      // line's own true budget, clamping the estimate to the remaining
      // line extent (at the atom's own painted position, indent included)
      // can only ever SHRINK an already-wrong guess toward safety —
      // it never grows it, and never claims a more exact value than the
      // guess it is.
      const remainingLineExtentTicks = Math.max(ctx.lineExtentTicks - (placed.yTick + indentOffsetTicks), 0);
      const guess = prev ? placed.yTick - prev.yTick : ctx.nominalCellTicks;
      extentTicks = Math.min(guess, remainingLineExtentTicks);
      heightIsApproximate = true;
    }
    return {
      id: placed.id,
      kind,
      text: textFor(kind, placed.sourceSpan, source),
      sourceSpan: placed.sourceSpan,
      topPx: tickToPx(placed.yTick + indentOffsetTicks, ctx.scaleMultiplier),
      heightPx: Math.max(tickToPx(extentTicks, ctx.scaleMultiplier), 1),
      heightIsApproximate,
      provisional: PROVISIONAL_KINDS.has(kind),
      ...(kind === "RUBY" && owner && owner.kind === "RUBY" ? { rubyAnnotation: rubyAnnotationFor(owner, placed, ctx) } : {}),
      ...(kind === "IMAGE" && owner && owner.kind === "IMAGE" ? { imageResolution: resolveImage(owner.refId) } : {}),
      debug: {
        pageOrder,
        columnOrder,
        lineOrder: lineIndex,
        sourceSpan: placed.sourceSpan,
        unitKind: kind,
        yTick: placed.yTick,
        isParagraphStartLine,
        manualBreakBeforePage,
      },
    };
  });

  return {
    id: line.id,
    order: lineIndex,
    rightPx: tickToPx(lineIndex * ctx.linePitchTicks, ctx.scaleMultiplier),
    widthPx: tickToPx(ctx.linePitchTicks, ctx.scaleMultiplier),
    units: units_,
    indentPx: line.indentTick !== undefined ? tickToPx(line.indentTick, ctx.scaleMultiplier) : undefined,
    indentTick: line.indentTick,
  };
}

function buildPaintColumn(
  column: CanonicalColumn,
  columnIndex: number,
  pageOrder: number,
  manualBreakBeforePage: boolean,
  units: LogicalUnit[],
  source: string,
  ctx: PreviewRenderContext
): PaintColumn {
  return {
    id: column.id,
    order: columnIndex,
    rightPx: tickToPx(columnIndex * ctx.columnExtentTicks, ctx.scaleMultiplier),
    widthPx: tickToPx(ctx.columnExtentTicks, ctx.scaleMultiplier),
    residualSpacePx: tickToPx(column.residualSpaceTick, ctx.scaleMultiplier),
    residualSpaceTick: column.residualSpaceTick,
    lines: column.lines.map((line, i) => buildPaintLine(line, i, pageOrder, columnIndex, manualBreakBeforePage, units, source, ctx)),
  };
}

function buildPaintPage(
  page: CanonicalPage,
  manualBreakBefore: boolean,
  units: LogicalUnit[],
  source: string,
  ctx: PreviewRenderContext,
  orientation: "vertical" | "horizontal" = "vertical"
): PaintPage {
  return {
    id: page.id,
    order: page.order,
    widthPx: tickToPx(ctx.columnsPerPage * ctx.columnExtentTicks, ctx.scaleMultiplier),
    heightPx: tickToPx(ctx.lineExtentTicks, ctx.scaleMultiplier),
    manualBreakBefore,
    columns: page.columns.map((col, i) => buildPaintColumn(col, i, page.order, manualBreakBefore, units, source, ctx)),
    folio: page.folio,
    orientation,
  };
}

/**
 * Builds a paint-only PaintDocument from an already-composed
 * CanonicalDocument. `units` is the SAME LogicalUnit[] the caller passed
 * into `composeCanonicalDocument` — used only as a read-only span lookup,
 * never re-tokenized. `source` is the caller's own manuscript/fixture
 * source string.
 */
export function buildPaintDocument(
  id: string,
  label: string,
  document: CanonicalDocument,
  units: LogicalUnit[],
  source: string,
  ctx: PreviewRenderContext
): PaintDocument {
  const manualBreaks = detectManualBreaks(units, document.pages);
  const maxPages = ctx.maxPages ?? document.pages.length;
  const renderedPages = document.pages.slice(0, maxPages);
  const pages = renderedPages.map((page, i) => buildPaintPage(page, manualBreaks[i] ?? false, units, source, ctx, "vertical"));

  return {
    id,
    label,
    hold: document.hold,
    holdReasons: document.errors.map((e) => e.message),
    fontIdentityMismatch: ctx.measurementIdentity !== ctx.paintFontIdentity,
    totalPageCount: document.pages.length,
    renderedPageCount: renderedPages.length,
    pages,
    fontSizePx: tickToPx(ctx.linePitchTicks, ctx.scaleMultiplier),
  };
}

/**
 * Paints a ColophonBlock's own pages (TSP-LOOP-005: never threaded through
 * body columns/lines) using the identical CanonicalPage/Column/Line schema
 * as the body — sufficient geometry already exists, so no Core change is
 * needed to support this. Painted in the fixed "horizontal" convention
 * (Contract-consistent; not a per-document Core flag, since none exists).
 */
export function buildColophonPaintPages(
  colophon: ColophonBlock,
  units: LogicalUnit[],
  source: string,
  ctx: PreviewRenderContext
): PaintPage[] {
  return colophon.pages.map((page) => buildPaintPage(page, false, units, source, ctx, "horizontal"));
}
