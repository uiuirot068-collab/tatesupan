// Canonical page/column/line hierarchy (Core Contract §20).
//
// CanonicalDocument's trace/warnings/errors/hold fields were originally
// deferred here at P3-L04 (before trace/ and diagnostics/ existed) — trace/
// landed at (original-numbering) P3-L07 but this file was not revisited
// then; warnings/errors/hold land now, at (original-numbering) P3-L14, and
// this catch-up adds all four fields together in one pass rather than
// leaving trace missing any longer.

import type { GeometryTick } from "../geometry/tick";
import type { SourceSpan, BlockId } from "../source/span";
import type { VersionMetadata } from "../version";
import type { LayoutDecisionTrace } from "../trace";

// LayoutWarning/LayoutError (Contract §26) live here, not in diagnostics/,
// specifically to avoid a circular module dependency: CanonicalDocument
// needs these shapes, and CORE_MODULE_MAP.md row 23 already declares
// diagnostics/'s allowed deps as "layout/schema, units" — i.e. diagnostics/
// depends on this file, never the reverse. diagnostics/'s computeHold()
// consumes these types by importing them from here.
export interface LayoutWarning {
  sourceSpan: SourceSpan;
  message: string;
}

export interface LayoutError {
  sourceSpan: SourceSpan;
  message: string;
  severity: "BLOCKS_HOLD" | "LOCAL_ONLY";
}

export interface PlacedUnit {
  id: string;
  sourceSpan: SourceSpan;
  xTick: GeometryTick;
  yTick: GeometryTick;
  hanging?: boolean;
  rubyBoundaryPolicy?: "CENTER" | "START_CLAMP" | "END_CLAMP" | "OVERFLOW_OPEN";
}

export interface CanonicalLine {
  id: string;
  order: number;
  placedUnits: PlacedUnit[];
}

export interface CanonicalColumn {
  id: string;
  order: number;
  lines: CanonicalLine[];
  residualSpaceTick: GeometryTick; // Contract §18 — Natural Pitch leftover, never silently absorbed
}

export interface CanonicalPage {
  id: string;
  order: number;
  columns: CanonicalColumn[];
  folio?: PlacedUnit; // page-decoration layer, Contract §15
}

export interface ColophonBlock {
  sourceBlockId: BlockId;
  pages: CanonicalPage[]; // its own page(s), not threaded through body columns/lines
}

export interface CanonicalDocument {
  pages: CanonicalPage[];
  colophon?: ColophonBlock;
  version: VersionMetadata;
  warnings: LayoutWarning[];
  errors: LayoutError[];
  hold: boolean; // Contract §26 — true if Publication approval must be withheld
  trace: LayoutDecisionTrace;
}
