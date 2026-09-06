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
  // Ruby Placement Micro-Loop: populated only for a placed atom owned by a
  // RUBY LogicalUnit (one atom per segment for a segmented JUKUGO group,
  // one atom for the whole group otherwise) — `core/ruby/index.ts`'s
  // `placeRuby()` result, attached here rather than recomputed by a
  // Renderer (INV-003: this never carries or implies any BASE-coordinate
  // change — `xTick`/`yTick` above remain the base run's own placement,
  // untouched). `rubyReadingOffsetTick` is relative to this atom's own
  // `yTick` (mirrors placeRuby's own "relative to the base group's own
  // start tick" contract); `rubyReadingExtentTick` is the reading's own
  // measured extent, so a Renderer never re-measures it.
  rubyBoundaryPolicy?: "CENTER" | "START_CLAMP" | "END_CLAMP" | "OVERFLOW_OPEN";
  rubyReadingOffsetTick?: GeometryTick;
  rubyReadingExtentTick?: GeometryTick;
}

export interface CanonicalLine {
  id: string;
  order: number;
  placedUnits: PlacedUnit[];
  // Human Product Decision A (一字下げ paragraph-first-line auto-indent,
  // `qa/evidence/PARAGRAPH_SEMANTICS_PRE_STAGE_D.md`): the logical extent
  // reserved at this line's start when it opens a new paragraph. Absent
  // (not zero) when no indent applies — a Renderer reserves this much
  // leading space before painting the line's placedUnits, never derives it
  // itself (Contract-consistent: this is a Core-owned logical decision, not
  // a renderer/CSS choice).
  indentTick?: GeometryTick;
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
