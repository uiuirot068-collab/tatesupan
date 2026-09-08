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

// Human Visual QA HOLD round 21 (P3-O08 final-page completion, Step 1B):
// legacy `src/lib/pageLayout.ts`'s real, shipped `NombrePosition` enum
// (`"center" | "gutter" | "outer" | "hidden"`) — ported verbatim, minus
// "hidden" (represented here by `CanonicalPage.folio` being absent
// entirely, the same optional-field convention already established).
// This is the SETTINGS-level (user-facing) choice — see
// `ResolvedFolioPosition` below for what Core actually attaches to a
// page once parity is resolved.
export type FolioPosition = "center" | "gutter" | "outer";

// Human Visual QA HOLD round 22 (P3-O08 final-page completion, Step
// 1C): "gutter"/"outer" require knowing which PHYSICAL side
// (left/right) is "inside" for a given page — round 21 left this an
// open Human/Product question, but it turns out legacy already answers
// it, verbatim, in two independently cross-checked places:
// `src/components/PageCard.tsx:335` (`isOddPage = pageNumber % 2 ===
// 1`) plus its own `sheetStyle` padding logic (:357-363) AND
// `NombreOverlay`'s own `anchoredSide` logic (:1384-1391) — a
// right-bound (右綴じ) tategaki book: an odd page (recto) is the LEFT
// side of a spread, so 小口/outer=left, ノド/gutter=right; an even page
// (verso) mirrors. This IS pagination-sensitive (Contract-consistent:
// Renderer must never decide it), but it is PURE LOGIC — page parity
// plus a fixed enum lookup — not a physical-geometry computation, so
// Core (which already knows each page's own `order`) can and does
// resolve it directly, without needing to know paper size/margins.
// `ResolvedFolioPosition` is what `GeneratedPageFurniture.position`
// actually carries — physical side, but still not a physical mm
// coordinate (that conversion needs real margins, still a Renderer-only
// concern, see `PublicationPageGeometry`).
export type ResolvedFolioPosition = "center" | "left" | "right";

// Human Visual QA HOLD round 21: generated page furniture (Contract
// §15) is NOT manuscript content — it has no real position in the
// author's own source text, so it must never carry a `SourceSpan`
// (INV-001 protects `SourceSpan` as an exclusively manuscript-content
// concept). `folio` was previously typed as `PlacedUnit` (which
// requires a `SourceSpan`) — confirmed, by direct audit, to have never
// actually been populated by any Core module, so changing its exact
// shape now is a clean, unbreaking change.
export interface GeneratedPageFurniture {
  text: string;
  position: ResolvedFolioPosition;
}

// Human Visual QA HOLD round 22: 柱 (running header), Contract §15's
// OTHER named page-decoration-layer element alongside folio — ported
// from legacy `MasterPageSettings.hashiraOdd`/`hashiraEven`/
// `hashiraPosition`. Kept as its own type, not force-fit into
// `GeneratedPageFurniture`'s own `ResolvedFolioPosition` vocabulary —
// 柱's own position axis (top/bottom, per legacy's real
// `HashiraPosition`) is a genuinely different concept from folio's own
// (center/left/right), and this codebase's own convention throughout
// (P3-O08's whole yakumono history) is to avoid a shared abstraction
// two real, differently-shaped concepts would have to be awkwardly
// squeezed into.
export type HeaderPosition = "top" | "bottom";

export interface GeneratedHeader {
  text: string;
  position: HeaderPosition;
}

export interface CanonicalPage {
  id: string;
  order: number;
  columns: CanonicalColumn[];
  folio?: GeneratedPageFurniture; // page-decoration layer, Contract §15
  header?: GeneratedHeader; // 柱, page-decoration layer, Contract §15
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
