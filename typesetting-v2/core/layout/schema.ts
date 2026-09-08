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
// 柱's own position axis is a genuinely different concept from folio's
// own (center/left/right), and this codebase's own convention
// throughout (P3-O08's whole yakumono history) is to avoid a shared
// abstraction two real, differently-shaped concepts would have to be
// awkwardly squeezed into.
//
// Human Visual QA HOLD round 24 (P3-O08 final-page completion, Step
// 1D): a v2-native ENHANCEMENT beyond legacy's own limited top/bottom
// contract — a full 2-axis semantic grid, TOP/CENTER/BOTTOM crossed
// with OUTER/GUTTER. `HeaderVerticalPosition` is the vertical axis
// (legacy only ever had "top"/"bottom" — "center" is new, v2-only).
// `HeaderSide` reuses the EXACT SAME "outer"/"gutter" vocabulary
// `FolioPosition` already established (not a coincidence — both are
// literally the same jlreq-adjacent 小口/ノド concept), so parity
// resolution reuses `core/folio/index.ts`'s own
// `resolveFolioPhysicalSide` directly rather than a second
// implementation of the identical odd/even logic.
//
// Human Visual QA HOLD round 25 (P3-O08 final-page completion,
// correction to round 24): round 24's own "vertical CENTER" reading was
// a genuine Human QA-caught product-model error — "CENTER" was never
// meant as vertical page-center; it means HORIZONTAL centering within
// the top/bottom band, the exact same axis/vocabulary folio's own
// `FolioPosition` ("center"|"gutter"|"outer") already uses. There is no
// vertical-center position. The corrected model: `HeaderBand`
// ("top"|"bottom" — the ONLY vertical axis, matching legacy's own real
// `HashiraPosition` exactly) crossed with `FolioPosition` itself,
// reused directly as the horizontal axis (not a lookalike copy — the
// SAME type, since 小口/ノド/center is literally the identical concept
// folio already models) — six real combinations (2 band x 3 horizontal),
// not the round-24 six that wrongly included a vertical center.
export type HeaderBand = "top" | "bottom";

// Settings-level (user-facing) choice. `horizontal` reuses
// `FolioPosition` directly — real code/type reuse, not a lookalike.
export interface HeaderPositionSetting {
  band: HeaderBand;
  horizontal: FolioPosition;
}

// Core-resolved (parity already applied) — what `GeneratedHeader`
// actually carries. `horizontal` reuses `ResolvedFolioPosition`
// directly (parity resolution for header's own horizontal axis IS
// folio's own `resolveFolioPhysicalSide`, called unchanged).
export interface ResolvedHeaderPosition {
  band: HeaderBand;
  horizontal: ResolvedFolioPosition;
}

export interface GeneratedHeader {
  text: string;
  position: ResolvedHeaderPosition;
}

export interface CanonicalPage {
  id: string;
  order: number;
  columns: CanonicalColumn[];
  folio?: GeneratedPageFurniture; // page-decoration layer, Contract §15
  header?: GeneratedHeader; // 柱, page-decoration layer, Contract §15
}

// Human Visual QA HOLD round 28 (P3-O08 final-page completion, Step 2C):
// legacy `ColophonPlacement` (`src/lib/colophon.ts:67-74`), ported
// verbatim as a type. `horizontal`/`vertical` are a real, portable
// content-block anchor (legacy: flexbox justify-content/align-items on
// a placement area, `ColophonPageCard.tsx:100-120`) — resolved by Core
// here (a pure enum, no parity dependency) and interpreted into actual
// mm only at the Publication paint boundary (`pdfGenerator.ts`), same
// split as `ResolvedFolioPosition`/`ResolvedHeaderPosition` above.
// `respectGutter`/`respectVerticalMargins` are real legacy fields
// (parity-dependent asymmetric margin selection, `ColophonPageCard.tsx:85-98`)
// carried here for contract fidelity but NOT YET acted on by Publication
// — `PublicationPageGeometry` has no distinct gutter/outer margin
// fields nor per-page-parity margin variance (a single fixed margin
// rectangle for the whole document), so faithfully porting them would
// require a materially larger geometry-model change. Disclosed, not
// silently ignored — see qa/evidence/P3_O08_STRUCTURAL_COLOPHON_FINAL_PLACEMENT.md.
export type ColophonHorizontalPlacement = "left" | "center" | "right";
export type ColophonVerticalPlacement = "top" | "center" | "bottom";

export interface ColophonPlacement {
  horizontal: ColophonHorizontalPlacement;
  vertical: ColophonVerticalPlacement;
  respectGutter: boolean;
  respectVerticalMargins: boolean;
}

export interface ColophonBlock {
  sourceBlockId: BlockId;
  pages: CanonicalPage[]; // its own page(s), not threaded through body columns/lines
  // Optional (not required) specifically so a hand-built ColophonBlock
  // fixture predating this round (e.g.
  // `renderer/preview/generateFoundationArtifact.test.ts`'s own
  // `{ sourceBlockId, pages }` literal) keeps type-checking unchanged —
  // `composeColophon()` itself always populates a real value (defaulting
  // to `DEFAULT_COLOPHON_PLACEMENT` when a caller omits it).
  placement?: ColophonPlacement;
}

// Human Visual QA HOLD round 28: the FINAL PHYSICAL page order, Core's
// own decision (never Publication's — Publication must not insert or
// reorder pages, only paint what this sequence already decided).
// References into `CanonicalDocument.pages`/`colophon.pages` rather
// than duplicating page data. For every existing caller that never
// supplies a colophon at all, or uses the (still-default)
// `{mode:"end"}` pagePosition, this is exactly `[...body pages in
// order, ...colophon pages in order]` — the same physical order those
// callers already got before this field existed.
export type PhysicalPageRef = { kind: "body"; index: number } | { kind: "colophon"; index: number };

export interface CanonicalDocument {
  pages: CanonicalPage[];
  colophon?: ColophonBlock;
  pageSequence: PhysicalPageRef[];
  version: VersionMetadata;
  warnings: LayoutWarning[];
  errors: LayoutError[];
  hold: boolean; // Contract §26 — true if Publication approval must be withheld
  trace: LayoutDecisionTrace;
}
