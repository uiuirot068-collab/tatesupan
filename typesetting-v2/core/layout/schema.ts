// Canonical page/column/line hierarchy (Core Contract §20). Types only —
// CORE_MODULE_MAP.md row 21 scopes this module's allowed deps to geometry,
// source/span, and version, so CanonicalDocument here carries only the
// structural fields those modules can support. Two field groups from the
// data model candidate are added later, by the loop that owns their source
// module, not by restructuring this file:
//   - trace: LayoutDecisionTrace       — added when trace/ lands (P3-L07, CORE_MODULE_MAP.md row 9)
//   - warnings / errors / hold         — added when diagnostics/ lands (P3-L14, CORE_MODULE_MAP.md row 23)

import type { GeometryTick } from "../geometry/tick";
import type { SourceSpan, BlockId } from "../source/span";
import type { VersionMetadata } from "../version";

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
}
