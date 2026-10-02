// P3-O08 — Publication Renderer Foundation: PublicationDocument -> real PDF
// bytes, via jsPDF (already an approved dependency — see `package.json`;
// no new package added for this task).
//
// ARCHITECTURE, proven not assumed: legacy `src/utils/exportPdf.ts` uses
// jsPDF only as a page container for an `addImage()` raster PNG captured
// from the live Preview DOM via `html-to-image` (`src/utils/exportCapture.ts`)
// — a screenshot pipeline. That is exactly the "Preview DOM as layout
// authority" antipattern this task's own frozen contract forbids for the
// canonical v2 Publication path. This generator instead calls jsPDF's own
// vector primitives directly from `PublicationDocument`'s own physical mm
// coordinates — it never touches a browser DOM, a canvas, or any
// screenshot of anything, and needs no Preview Renderer to exist or run
// first.
//
// TWO-STAGE DESIGN (deliberate, testable split): `buildPaintPlan` turns a
// `PublicationDocument` into a plain-data `PaintPlan` (one `PaintCommand`
// per glyph/rectangle, with no jsPDF dependency at all) — this is what
// every typography test in `typography.test.ts` asserts against directly,
// rather than spying on jsPDF's own internals (jsPDF v4's `text`/`rect`
// are NOT prototype methods — they are assigned per-instance by its
// plugin system, so `vi.spyOn(jsPDF.prototype, "text")` does not work;
// proven directly, not assumed). `renderPaintPlanToPdf` is a thin,
// mechanical executor that walks the plan and calls the corresponding
// jsPDF primitive — it contains no typography decisions of its own.
//
// FONT EMBEDDING GATE (qa/evidence/P3_O08_FONT_EMBEDDING_GATE.md): jsPDF's
// built-in "standard 14" fonts (Helvetica/Times/Courier) carry no CJK glyph
// coverage. A real, license-cleared CJK font resource (Shippori Mincho, SIL
// OFL 1.1) can be supplied via the optional `fontResource` parameter.
// `fontResource` is optional and paint-only: when supplied, TEXT/RUBY/TCY/
// SEMANTIC_RUN units draw as real vector glyph text via jsPDF's own `text()`
// primitive at coordinates derived exclusively from `PublicationDocument`'s
// own already-fixed physical mm fields — never a screenshot, never
// re-measured, never re-positioned, never changing which coordinate Core
// already decided. IMAGE remains a vector-rectangle placeholder (no real
// image resolver exists yet, unrelated to font embedding). When
// `fontResource` is omitted, every kind falls back to the original
// rectangle-only foundation (backward compatible, unmodified since the
// Foundation task).
//
// PUBLICATION TYPOGRAPHY (qa/evidence/P3_O08_PUBLICATION_TYPOGRAPHY.md):
// Ruby/TCY/Dash/Ellipsis are each independently re-derived here for vector
// PDF paint — never a copy of Preview's own CSS/DOM technique (Preview uses
// `text-combine-upright`, absolutely-positioned overlapping `<span>`s, and
// `text-align` tricks, none of which exist in a PDF's own paint model).
// Every treatment below reads ONLY already-canonical fields
// (`topMm`/`heightMm`/`rubyAnnotation`/`semanticRunKind`/`text`) and never
// recalculates placement, breaks, or canonical occupancy.

import { folioPlacement, furnitureFrameMargins, headerPlacement, HIDDEN_NOMBRE_FONT_SIZE_PT, hiddenNombreGlyphCentres, hiddenNombreText, type FurniturePageFrame, type PublicationFurnitureGeometry } from "../furnitureGeometry";
import { jsPDF } from "jspdf";
import type { PaintPage, PaintPlacedUnit, PublicationDocument } from "./paintModel";
import { verticalPaintGraphemeFor } from "./verticalGlyphMap";
import { createGlyphIdLookup } from "./fontCapability";
import { FontMetricsReader } from "./fontMetrics";
import { publicationFurnitureFontSizePt } from "../../core/settings/outputTypography";
import { VerticalOutlineContext, type OutlinePathCommand } from "./verticalOutlinePaint";
import { VerticalGposContext } from "./verticalGposPaint";
import { VerticalYakumonoAlignContext } from "./verticalYakumonoAlign";
import { FontBinary } from "./fontBinary";
import { DEFAULT_RUBY_SCALE, resolveFolioPhysicalSide, type ColophonPlacement } from "../../core";
import { rubyLaneGeometry } from "../rubyLane";
import { emphasisDotLane } from "../emphasisMarks";
import { buildColophonRenderPlan } from "../../../src/lib/colophonRenderPlan";
import { layoutImageGroup, type GroupedImagePosition, type ImageRectMm } from "../../../src/lib/imageGeometry";
import {
  PDF_BLEED_MM,
  resolvePublicationPdfPageOutput,
  type PublicationPdfMode,
  type PublicationPdfPageOutput,
} from "./pdfOutputGeometry";

export interface PublicationFontResource {
  /** Arbitrary VFS filename jsPDF registers the font under (e.g. "ShipporiMincho-Regular.ttf"). */
  fileName: string;
  /** The font family name later code refers to via `setFont`. */
  fontName: string;
  /** Base64-encoded raw TTF bytes (never read from a browser/DOM, never re-measured). */
  base64: string;
}

export interface PublicationPdfResult {
  bytes: Uint8Array;
  pageCount: number;
}

// Human Visual QA HOLD (2026-09-07): the Foundation task's own page model
// treated CONTENT extent (Core's `columnsPerPage x columnExtentTicks` /
// `lineExtentTicks`) as if it WERE the physical paper size — correct for
// Preview's own on-screen convenience, but wrong for Publication, where the
// paper sheet is the canonical output. `CanonicalDocument` itself carries
// no physical-paper field to read instead (`core/layout/schema.ts`'s
// `CanonicalPage = {id, order, columns, folio?}`, confirmed by direct read
// — no Core defect, just a field that was never wired up), so Publication
// now supplies its OWN render-only physical context: a real paper sheet
// size plus margins, with the already-composed content positioned INSET
// from the paper's own edges rather than assumed to fill it edge-to-edge.
// Optional and additive — omitting it preserves the exact prior
// (content-sized page, zero margin) behavior for existing callers/tests.
export interface PublicationPageGeometry {
  paperWidthMm: number;
  paperHeightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  /** Inside margin — for vertical-rl, content starts near the paper's own right edge. */
  marginRightMm: number;
  /** Outside margin. */
  marginLeftMm: number;
  // Human Visual QA HOLD round 29 (P3-O08 final-page completion, Step
  // 2D): real legacy MasterPageSettings-level `marginGutter`/`marginOuter`
  // (ノド/小口, `src/lib/colophon.ts` consumer `ColophonPageCard.tsx:85-98`)
  // -- DISTINCT quantities from `marginLeftMm`/`marginRightMm` above,
  // which every OTHER paint path (body content, folio, header) still
  // uses as one fixed, parity-INDEPENDENT physical rectangle for the
  // whole document (a real, pre-existing v2 simplification, not
  // resolved by this round; Phase 11 残件③ resolves it through the
  // optional `furniture` field below, leaving these two untouched). These
  // two fields are read ONLY by
  // `buildColophonPaintPage`'s own `ColophonPlacement.respectGutter`
  // resolution (round 29) -- body/folio/header remain byte-identical.
  // Optional/additive: omitted (every existing caller), `respectGutter`
  // has no distinguishable effect (falls back to
  // `marginLeftMm`/`marginRightMm` symmetrically either way) -- a real,
  // honest inertness, not a silent no-op dressed up as support.
  marginGutterMm?: number;
  marginOuterMm?: number;
  /**
   * Phase 11 残件③: the Editor's page-furniture geometry (parity-aware
   * ノド/小口 frame edges + `nombreBottomMargin`). When supplied, folio / 柱
   * are placed by `renderer/furnitureGeometry.ts` exactly where the Editor
   * Preview paints them; omitted, the historical placement is unchanged.
   */
  furniture?: PublicationFurnitureGeometry;
}

export type PaintCommand =
  | {
      op: "text";
      text: string;
      xMm: number;
      yMm: number;
      fontSizePt: number;
      // "right" added round 28 (P3-O08 final-page completion, Step 2C) —
      // real colophon row value-column anchor (round 27) and the new
      // `ColophonPlacement.horizontal:"right"` block anchor both need it.
      // jsPDF's own `text()` already accepts "right" (a real, existing
      // TextOptionsLight value, unrelated to this widening) — this only
      // corrects the PaintCommand type to match, removing round 27's own
      // unsafe `as "left" | "center"` cast.
      align: "left" | "center" | "right";
      angle?: number;
      baseline?: "alphabetic" | "middle";
      maxWidthMm?: number;
      /** Page-furniture identity lets Web raster output apply its fixed 15/20 scale without changing PDF/print. */
      furnitureRole?: "folio" | "running-head";
      /** Optional CSS family requested by the source surface (used by browser JPG). */
      fontFamily?: string;
      /**
       * TSP-PHASE13-001: ink tone, 0 = black (default) … 1 = white. Output is
       * grayscale, so the Preview's text opacity on white paper is printed as
       * the equivalent gray (`colophonInkGray`).
       */
      inkGray?: number;
      /** TSP-PHASE13-001: outline stroke (mm) added to the fill for weight > 400. */
      strokeWidthMm?: number;
    }
  | { op: "rect"; xMm: number; yMm: number; widthMm: number; heightMm: number; /** see text `inkGray` */ inkGray?: number }
  // Human Visual QA HOLD round 7 (OpenType vertical GSUB outline paint,
  // dependency-gate approval — opentype.js): a real vector glyph outline,
  // already fully translated/scaled into mm page-coordinate space
  // (`VerticalOutlineContext.glyphOutlineCommandsMm`). Emitted ONLY for
  // the specific graphemes proven (P3_O08_OPENTYPE_VERTICAL_GSUB_AUDIT.md)
  // to have a real GSUB `vert`/`vrt2` alternate that is NOT reachable via
  // jsPDF's Unicode-string `text()` API — every other character keeps
  // using the existing "text" command, unchanged.
  | { op: "glyphOutline"; commands: OutlinePathCommand[] }
  // Human Visual QA HOLD round 30 (P3-O08 final-page completion, Step
  // 3, real image embedding): real, already-resolved image bytes,
  // painted at Core's own canonical box (`xMm`/`yMm`/`widthMm`/`heightMm`
  // — never re-derived from `bytes`' own real pixel dimensions, per this
  // round's own frozen "Publication does not re-layout from raster
  // dimensions" architecture). `format` tells the executor which of
  // jsPDF's own real embedders to call — "JPEG" bytes pass through
  // unmodified (jsPDF embeds the DCT-encoded stream directly, no
  // recompression); "PNG" bytes go through jsPDF's own internal PNG
  // decoder (unavoidable — the PDF image-XObject model has no native
  // PNG encoding), which does preserve a real alpha channel via jsPDF's
  // own SMask support.
  //
  // TSP-PHASE13-001: `fullPageCover` marks an Editor 「全面」 image whose box
  // covers the finished page. The canonical box stays trim-based (JPG and
  // trim-mode PDF are unchanged); the PDF executor re-covers the 3 mm bleed
  // in bleed/full modes and clips to the bleed box.
  | { op: "image"; xMm: number; yMm: number; widthMm: number; heightMm: number; bytes: Uint8Array; format: "JPEG" | "PNG"; refId?: string; fullPageCover?: true }
  // Post-beta typography Phase 1 (傍点): one FILLED vector circle, centre
  // (xMm, yMm). Font-independent geometry, so PDF (jsPDF circle) and both
  // JPG rasterizers (Canvas arc) paint the identical dot.
  | { op: "circle"; xMm: number; yMm: number; radiusMm: number };

export interface PaintPagePlan {
  widthMm: number;
  heightMm: number;
  commands: PaintCommand[];
}

export type PaintPlan = PaintPagePlan[];

// Fallback baseline ratio used only when no font resource is available to
// derive one from (the rectangle-only, no-font paint path never calls
// `verticalGraphemeCommands` at all, so this value only matters for a
// hypothetical caller that supplies `hasFont: true` without ever calling
// `deriveBaselineRatioFromFont`). Equal to the REAL, MEASURED value for the
// committed Shippori Mincho asset (see below) — not an independent guess.
export const FALLBACK_BASELINE_RATIO = 0.88;

// Human Visual QA HOLD round 5 (qa/evidence/P3_O08_FONT_DERIVED_VERTICAL_GLYPH_METRICS.md):
// jsPDF paints every glyph via ordinary HORIZONTAL alphabetic-baseline
// metrics — there is no vertical-writing-mode API anywhere in its type
// surface (confirmed exhaustively in the prior task). This function derives
// where that horizontal baseline should sit within one vertical cell FROM
// THE FONT'S OWN REAL vhea/vmtx data, replacing what was previously a
// hand-picked constant (0.88) with a measured one.
//
// MEASURED, not assumed (fontMetrics.test.ts, run against the exact
// committed Shippori Mincho Regular asset): this font's own `vmtx` table
// gives EVERY tested glyph — ordinary kanji (た), ordinary/small kana
// (つ/っ/ッ), every punctuation source AND vertical-presentation-form glyph
// (、。「」（）and their U+FE1x/FE3x/FE4x substitutes) — the IDENTICAL
// vertical origin: 880 font units above the horizontal baseline, out of
// 1000 units-per-em (0.88 exactly). The font provides no per-glyph or
// per-class differentiation signal at all — a single, uniform ratio is the
// font's own real, intentional design (a standard convention: this font's
// vertical origin Y was set equal to its own horizontal ascent value, so a
// vertical glyph painted via horizontal-baseline fallback still lands where
// a normal horizontal line's baseline would). This is why the pre-existing
// 0.88 constant, though originally hand-picked, turns out to already match
// the font's own real data exactly — and why it ALSO explains why Round 4's
// B_STANDARD/C_STRONG per-class offsets made results look WORSE, not
// better: they deviated away from a position the font itself defines as
// correct, uniformly, for every character class.
export function deriveBaselineRatioFromFont(fontResource: PublicationFontResource): number {
  const buf = FontBinary.fromBase64(fontResource.base64);
  const reader = new FontMetricsReader(buf);
  if (!reader.hasTable("vhea") || !reader.hasTable("vmtx")) return FALLBACK_BASELINE_RATIO;
  // Any covered glyph gives the identical answer (measured uniform above);
  // U+3042 (あ) is an ordinary, virtually-always-covered hiragana used only
  // as a representative probe, not because this character is special.
  const glyphId = createGlyphIdLookup(buf)(0x3042);
  if (glyphId === undefined) return FALLBACK_BASELINE_RATIO;
  const vmtx = reader.verticalMetrics(glyphId);
  if (!vmtx || vmtx.originY === undefined) return FALLBACK_BASELINE_RATIO;
  return vmtx.originY / reader.unitsPerEm;
}

// Human/Product decision (2026-09-07): TateSpun v2's single authoritative
// ruby-scale value — Core's own `rubyReadingExtentTick` measurement,
// Preview's `.ruby-annotation` CSS font-size, and this Publication paint
// size all derive from the SAME constant now (prior state: Core measured
// unscaled, Preview used an independently-hardcoded 0.55, Publication
// used its own separate 0.55 — exactly the inconsistency this decision
// resolves; see qa/evidence/P3_O08_VERTICAL_CELL_AND_RUBY_SCALE.md).
const RUBY_ANNOTATION_FONT_RATIO = DEFAULT_RUBY_SCALE;

// ONE deterministic Publication vertical-glyph paint layer
// (qa/evidence/P3_O08_VERTICAL_GLYPH_PAINT.md): every grapheme painted
// vertically — ordinary TEXT, RUBY base/annotation, and (as of this fix)
// DASH/ELLIPSIS — runs through `verticalPaintGraphemeFor` (verticalGlyphMap.ts),
// which substitutes a real Unicode vertical presentation-form glyph
// (measured present in the committed Shippori Mincho asset — 、。「」（）
// ―…) when one exists, and paints the character UNCHANGED, UPRIGHT
// (never rotated) otherwise. This REPLACES the earlier ad-hoc 90-degree
// glyph-rotation approach for Dash/Ellipsis, which caused a real,
// reported bug: a rotated horizontal glyph's own rotated bounding box did
// not reliably match the assumed per-character cell height, so Dash's
// vertical stroke visibly intruded into the following character's cell.
// The real vertical-form glyph is designed by the font itself to sit
// correctly within one ordinary cell — the SAME per-character-height
// slot algorithm already proven correct for ordinary TEXT now applies
// uniformly, with no separate overlap/rotation math needed for Dash or
// Ellipsis at all. Canonical source/SourceSpan are never touched — this
// is a pure paint-time substitution, never re-tokenizing/re-classifying
// anything (Array.from(text).length, i.e. the grapheme COUNT, is always
// computed from the ORIGINAL text before substitution).
// `baselineRatio` (Human Visual QA HOLD round 5): the font-derived fraction
// of one cell's own height at which jsPDF's horizontal alphabetic baseline
// is placed — see `deriveBaselineRatioFromFont`'s own doc above. Defaults
// to `FALLBACK_BASELINE_RATIO` (equal to the real measured value) so every
// pre-existing call site/test is unaffected unless a caller explicitly
// supplies a font-derived value (as `buildPaintPlan` now does whenever a
// font resource is available).
//
// `outlineContext` (Human Visual QA HOLD round 7): when supplied, each
// grapheme is checked against `VerticalOutlineContext.resolveOutlineGlyphId`
// FIRST — only a grapheme proven to need outline paint (its real GSUB
// vertical alternate is unreachable via jsPDF's Unicode `text()` API)
// emits a "glyphOutline" command instead of "text"; everything else
// (ordinary kanji, punctuation, ellipsis, Latin/digits) is completely
// unaffected and keeps painting via the exact same "text" path as before.
// The SAME `topMm`/`perCharHeightMm`/`baselineRatio` position math is
// reused for both paint mechanisms — no separate/new position model.
// `gposContext` (Human Visual QA HOLD round 10): a small, real-font-
// derived Y-position nudge (`verticalGposPaint.ts`'s own `vpal`
// YPlacement data — the only vertical positioning feature this font
// ships, vhal/vchw confirmed absent) — applied to EVERY grapheme's own
// paint position, for both the "text" and "glyphOutline" mechanisms
// alike, scaled by this atom's own real em size (`fontSizePt`, already
// the fixed `bodyEmMm`-derived value since round 9 — never this atom's
// own possibly-compressed `totalHeightMm`, per this round's own "font
// metrics determine HOW the glyph is positioned, never re-use the
// canonical advance for it" principle). Canonical yTick/topMm are never
// touched — this is a pure paint-time ink nudge, same architectural
// class as round 5's baseline ratio and round 7's outline paint.
//
// `yakumonoContext` (Human Visual QA HOLD round 13 — legacy parity):
// when a grapheme is classified HANG_START/HANG_END
// (`classifyYakumonoAlignment`, ported verbatim from the already-working
// legacy renderer's own regex), its baseline is placed using a REAL,
// font-derived ratio that flushes that exact glyph's own ink against the
// correct cell edge, OVERRIDING the ordinary centered `baselineRatio`
// for that grapheme only. Deliberately gates OUT the `gposContext` nudge
// for any grapheme this override applies to — both are ink-position
// corrections, and legacy's own comment describes `vpal` as secondary to
// the edge-anchor fix, not a second correction to stack on top of it
// (avoids double-applying placement).
function verticalGraphemeCommands(
  text: string,
  xCenterMm: number,
  topMm: number,
  totalHeightMm: number,
  fontSizePt: number,
  baselineRatio: number = FALLBACK_BASELINE_RATIO,
  outlineContext?: VerticalOutlineContext,
  gposContext?: VerticalGposContext,
  yakumonoContext?: VerticalYakumonoAlignContext
): PaintCommand[] {
  const graphemes = Array.from(text);
  if (graphemes.length === 0) return [];
  const perCharHeightMm = totalHeightMm / graphemes.length;
  const emSizeMm = fontSizePt * (25.4 / 72);
  return graphemes.map((ch, i) => {
    const yakumonoBaselineRatio = yakumonoContext?.baselineRatioFor(ch);
    // Human Visual QA HOLD round 23: small kana's own real ink bbox is
    // measurably smaller than an ordinary glyph's (round 14's own
    // finding), so the uniform, vmtx-origin-derived default baseline
    // ratio does not center it well within its own 1em slot along the
    // vertical-flow axis. `inkCenteredBaselineRatioForSmallKana`
    // computes a real, per-glyph, bbox-derived correction — never a
    // guessed/hardcoded offset — scoped to cl-11 members only (ordinary
    // characters, including punctuation the yakumono context already
    // handles, are unaffected). Yakumono edge-alignment takes priority
    // if both were ever somehow applicable (never in practice — small
    // kana is never yakumono-classified).
    const smallKanaBaselineRatio = outlineContext?.inkCenteredBaselineRatioForSmallKana(ch);
    const effectiveBaselineRatio = yakumonoBaselineRatio ?? smallKanaBaselineRatio ?? baselineRatio;
    // Typography Parity Round 6 (2026-09-09, qa/evidence/
    // TYPOGRAPHY_PARITY_GLYPH_IN_CELL_VERTICAL_RHYTHM.md): `vpal`'s own
    // real, non-trivial YPlacement values were verified (round 10,
    // P3_O08_YAKUMONO_GPOS.md) for yakumono characters (「「(+0.527em,
    // 「（+0.623em) -- but yakumono ALREADY bypasses this branch entirely
    // (routed to `yakumonoContext` above, whose own `yakumonoBaselineRatio`
    // is what actually positions 「」（） ink -- this generic gposOffsetMm
    // path is a no-op for them either way). Round 10's own "applying it
    // everywhere is harmless" justification checked only ordinary KANJI
    // (real vpal = 0, confirmed harmless) -- it never checked ordinary
    // HIRAGANA, which this font gives real, substantial vpal values (up
    // to -0.188em for い). A direct Human-supplied raster comparison
    // against the real InDesign reference PDF (same font, same 9pt, same
    // sequence) found TateSpun's per-glyph vertical-center offset from
    // InDesign correlates almost exactly (same sign, closely matching
    // magnitude) with this exact applied vpal value for every hiragana
    // measured (e.g. い: applied -0.188em vs. measured InDesign-relative
    // offset -1.68pt at 9pt = -0.187em) -- i.e. applying vpal to ordinary
    // hiragana moves TateSpun's ink AWAY from InDesign's own rendering,
    // not toward it. Retired for this branch, not merely re-tuned:
    // ordinary (non-yakumono, non-small-kana) characters no longer
    // receive any gpos Y-nudge. `gposContext`/`VerticalGposContext`/
    // `gposReader.ts` themselves are UNCHANGED and still real, tested
    // infrastructure -- only this one call site's own consumption of
    // `yPlacementEmFor` for the generic/ordinary branch is removed.
    const gposOffsetMm = 0;
    const yMm = topMm + i * perCharHeightMm + perCharHeightMm * effectiveBaselineRatio + gposOffsetMm;
    // CSS Preview inherits `text-orientation: upright` from PageCard, so
    // ordinary printable ASCII occupies one upright vertical cell per
    // grapheme. Shippori's `vert` GSUB also exposes alternates for Latin,
    // but those outlines are sideways and therefore do not represent that
    // product contract. Keep ordinary ASCII on the unrotated text path.
    // TCY never reaches this function (it has its own one-command path), so
    // automatic two-digit and explicit [tate] behavior remain independent.
    const useUprightAsciiText = /^[\x20-\x7e]$/.test(ch);
    const outlineGlyphId = useUprightAsciiText
      ? undefined
      : outlineContext?.resolveOutlineGlyphId(ch);
    if (outlineGlyphId !== undefined && outlineContext) {
      return { op: "glyphOutline" as const, commands: outlineContext.glyphOutlineCommandsMm(outlineGlyphId, xCenterMm, yMm, perCharHeightMm) };
    }
    // Browser Canvas has no vertical OpenType shaping API. The real PDF
    // path above receives Shippori Mincho's `vert` GSUB outline for U+30FC,
    // while the browser-only PaintPlan has no font bytes/outline context and
    // therefore reaches this text fallback. Rotate ONLY the prolonged-sound
    // mark around the center of its already-composed cell. This is paint-only:
    // source, advance, line/page geometry, and U+2015's existing vertical-form
    // substitution remain untouched. Both Web and print JPG consume this same
    // command before print performs its final whole-page resize.
    if (ch === "ー") {
      return {
        op: "text" as const,
        text: ch,
        xMm: xCenterMm,
        yMm: topMm + i * perCharHeightMm + perCharHeightMm / 2,
        fontSizePt,
        align: "center" as const,
        angle: 90,
        baseline: "middle" as const,
      };
    }
    return {
      op: "text" as const,
      text: verticalPaintGraphemeFor(ch),
      xMm: xCenterMm,
      yMm,
      fontSizePt,
      align: "center" as const,
    };
  });
}

// TCY ("tate-chu-yoko" — horizontal-in-vertical): the digit/character run
// must read in NORMAL horizontal orientation (angle 0, never rotated) even
// though it sits inside a vertical column — that is the entire point of
// TCY. Fit (shrunk only if necessary) within the single-cell width
// available via a single measure-then-scale pass, using jsPDF's own
// `getStringUnitWidth`-derived ratio (font-metric-relative, deterministic,
// no per-font-file lookup needed) rather than a live jsPDF instance's own
// `getTextWidth` — this keeps the paint PLAN pure/jsPDF-free; the actual
// text is only measured by the real jsPDF font at render time via a second,
// executor-side shrink pass (see `renderPaintPlanToPdf`). P3-O03's own
// frozen evidence never defined a numeric fitting rule (Preview relies on
// the browser's own `text-combine-upright` engine, which has no PDF
// equivalent), so this is the smallest deterministic strategy for the
// currently-approved fixture, not a general policy. Canonical
// logicalCells/occupancy are never touched.
function tcyCommand(text: string, xCenterMm: number, yCenterMm: number, fontSizePt: number, maxWidthMm: number): PaintCommand {
  return { op: "text", text, xMm: xCenterMm, yMm: yCenterMm, fontSizePt, align: "center", angle: 0, baseline: "middle", maxWidthMm };
}

// Human Visual QA HOLD round 23: page furniture (folio/柱, Contract §15)
// is generated content, not manuscript typography -- it must never be
// painted sideways/rotated or split one-character-per-vertical-line the
// way body text is. This is the SAME "horizontal even inside a
// vertical-rl document" architectural pattern `tcyCommand` above
// already established -- a single, unrotated, unsplit text run.
// Deliberately bypasses `verticalGraphemeCommands` entirely: no GSUB
// vert/vrt2 substitution, no small-kana bbox correction, no yakumono
// edge-alignment, no per-character split -- none of those are
// vertical-writing-mode concerns that apply to a horizontal string.
function horizontalFurnitureCommand(
  text: string,
  xMm: number,
  yCenterMm: number,
  fontSizePt: number,
  align: "left" | "center" | "right" = "center",
  furnitureRole?: "folio" | "running-head",
  fontFamily?: string
): PaintCommand {
  return {
    op: "text", text, xMm, yMm: yCenterMm, fontSizePt, align, angle: 0, baseline: "middle",
    ...(furnitureRole ? { furnitureRole } : {}),
    ...(fontFamily ? { fontFamily } : {}),
  };
}

// Converts a physical mm length to the equivalent jsPDF font-size point
// value for ONE character cell of that height.
function mmToPt(mm: number): number {
  return mm * (72 / 25.4);
}

function unitCommands(
  unit: PaintPlacedUnit,
  x: number,
  lineWidthMm: number,
  yOffsetMm: number,
  baselineRatio: number,
  bodyEmMm: number,
  outlineContext?: VerticalOutlineContext,
  gposContext?: VerticalGposContext,
  yakumonoContext?: VerticalYakumonoAlignContext,
  // Human Visual QA HOLD round 30 follow-up (Step 3 size/placement fix):
  // the real physical content-area box an isolated IMAGE unit should be
  // sized/centered against — the page's own writing area between margins,
  // NOT `lineWidthMm` (a single character-line's own pitch width, ~one em;
  // correct for TEXT/RUBY/TCY's own column-strip positioning above, but
  // never the available width for a FULL-placement image, which visually
  // spans past its own originating line). Optional: undefined when no real
  // page geometry is available (pre-round-30-follow-up callers, and any
  // caller that never supplied `pageGeometry` to `buildPaintPlan`), in
  // which case the IMAGE branch falls back to the prior `lineWidthMm`-based
  // sizing unchanged.
  imageBoxMm?: {
    contentLeftMm: number;
    contentTopMm: number;
    contentWidthMm: number;
    contentHeightMm: number;
    paperWidthMm: number;
    paperHeightMm: number;
  },
  // TSP-PHASE13-001: the shared group placement (`layoutImageGroup`) of a
  // 天/中央/地 image, computed per page by `buildBodyPaintPage`. When given it
  // replaces the single-image centring below.
  imageRectMm?: ImageRectMm
): PaintCommand[] {
  const y = yOffsetMm + unit.topMm;
  const xCenter = x + lineWidthMm / 2;
  // Human Visual QA HOLD round 9 (glyph-size regression): every glyph's
  // own FONT SIZE comes from `bodyEmMm` — the fixed, document-wide,
  // never-compressed body em (`PublicationDocument.bodyEmMm`, derived
  // from `LayoutSettings.linePitchTicks`, a declared constant, never a
  // per-atom composed advance). `unit.heightMm` remains the POSITIONING
  // quantity only (where this atom sits, how far apart consecutive
  // graphemes within it are stacked) — round 8's yakumono compression
  // legitimately shrinks specific atoms' own `heightMm` for spacing
  // purposes; that must never also shrink the glyph painted into it.
  // Before this fix, `heightMm` doubled as both quantities, which was
  // numerically harmless when every atom's advance was uniformly 1em
  // (pre-round-8) but produced a real, Human-caught bug once round 8
  // legitimately compressed specific atoms' advance: punctuation glyphs
  // painted at ~50% size instead of merely sitting closer together.
  const perCharFontSizePt = mmToPt(bodyEmMm);

  if (unit.kind === "TEXT" && unit.text.length > 0) {
    // TEXT is already one atom PER CHARACTER (Core's own composition).
    // `outlineContext` is threaded here too (not just Ruby/Dash below)
    // because the round-6 GSUB audit proved the unreachable-vertical-
    // alternate problem is NOT small-kana-specific — ordinary kana
    // (つ/た, etc.) in normal body text have the identical issue.
    return verticalGraphemeCommands(unit.text, xCenter, y, unit.heightMm, perCharFontSizePt, baselineRatio, outlineContext, gposContext, yakumonoContext);
  }

  if (unit.kind === "RUBY" && unit.text.length > 0) {
    // BUG FIXED (Human Visual QA HOLD, oversized/"suspicious" glyphs): a
    // RUBY base atom carries its FULL string (e.g. "東京", 2 characters),
    // so `unit.heightMm` spans BOTH characters together — using it
    // directly as one glyph's own font size (as an earlier draft did)
    // painted every base character roughly 2x (or Nx, for an N-character
    // base) too large. The per-glyph font size now comes from the fixed
    // `bodyEmMm` (see this function's own doc above), not from dividing
    // this atom's own (possibly non-uniform) `heightMm`.
    const commands = verticalGraphemeCommands(unit.text, xCenter, y, unit.heightMm, perCharFontSizePt, baselineRatio, outlineContext, gposContext, yakumonoContext);
    if (unit.rubyAnnotation?.status === "PLACED") {
      const ann = unit.rubyAnnotation;
      const annotationFontSizePt = perCharFontSizePt * RUBY_ANNOTATION_FONT_RATIO;
      // The shared paint metric starts from the unchanged body center and
      // uses the Human-selected fraction of the runtime line pitch. It
      // changes neither Core's reading-direction geometry nor
      // the body position, and Preview consumes the identical lane contract.
      const annotationX =
        xCenter + rubyLaneGeometry(bodyEmMm, lineWidthMm).annotationCenterFromParentCenter;
      commands.push(...verticalGraphemeCommands(ann.text, annotationX, y + ann.offsetMm, ann.extentMm, annotationFontSizePt, baselineRatio, outlineContext, gposContext, yakumonoContext));
    }
    return commands;
  }

  if (unit.kind === "TCY" && unit.text.length > 0) {
    // TCY paints as one horizontal run (never split per-character), so its
    // own box heightMm is the correct basis for an initial font-size guess
    // — `renderPaintPlanToPdf`'s own measure-then-scale pass (via
    // `maxWidthMm`) corrects it against the real font's actual metrics
    // regardless.
    return [tcyCommand(unit.text, xCenter, y + unit.heightMm / 2, mmToPt(unit.heightMm), lineWidthMm)];
  }

  if (unit.kind === "SEMANTIC_RUN" && unit.semanticRunKind === "DASH" && unit.text.length > 0) {
    // BUG FIXED (Human Visual QA HOLD round 2, dash stroke intruding into
    // the following character's cell): no longer a special-cased rotation
    // + overlap paint — each "―" grapheme now runs through the SAME
    // `verticalGraphemeCommands` path as any other character. Round 6's
    // GSUB audit found the manually-mapped U+FE31 glyph is NOT the font's
    // own true `vert` alternate (which is unreachable via any Unicode code
    // point) — `outlineContext` (round 7) now paints the font's REAL
    // vertical dash glyph via outline when supplied, superseding the
    // U+FE31 substitute; falls back to U+FE31 unchanged when no
    // `outlineContext` is supplied (backward-compatible). Canonical run
    // extent (2 glyphs guaranteed, P3-O04's own Product scope) is
    // unchanged — only the PAINT MECHANISM changed. Font size: the fixed
    // `bodyEmMm` (see this function's own doc above), not derived from
    // this run's own `heightMm`.
    return verticalGraphemeCommands(unit.text, xCenter, y, unit.heightMm, perCharFontSizePt, baselineRatio, outlineContext, gposContext, yakumonoContext);
  }

  if (unit.kind === "SEMANTIC_RUN" && unit.semanticRunKind === "ELLIPSIS" && unit.text.length > 0) {
    // Native vertical-form glyph (U+FE19, confirmed present in the
    // committed font AND confirmed by the round-6 GSUB audit to be the
    // SAME glyph the font's own `vert` feature selects), painted upright
    // via the same generic path as any other character — matches P3-O05's
    // own Preview conclusion (no seam-continuity problem exists for a
    // discrete dot-cluster glyph, so no Dash-style special treatment is
    // needed beyond correct glyph selection). `outlineContext` is threaded
    // for uniformity but `resolveOutlineGlyphId` correctly returns
    // `undefined` here (already Unicode-reachable) — Ellipsis keeps
    // painting via "text", unchanged. Font size: the fixed `bodyEmMm`
    // (see this function's own doc above), same as every other kind.
    return verticalGraphemeCommands(unit.text, xCenter, y, unit.heightMm, perCharFontSizePt, baselineRatio, outlineContext, gposContext, yakumonoContext);
  }

  if (unit.kind === "IMAGE") {
    // Human Visual QA HOLD round 30 (P3-O08 final-page completion, Step
    // 3, real image embedding). Canonical box authority: width/height
    // come from Core's own `intrinsicWidth`/`intrinsicHeight`
    // (`unit.imageIntrinsicWidthMm`/`unit.heightMm`, round 30's own
    // `paintModel.ts` fix), never re-derived from the resolved bytes'
    // own real pixel dimensions. Safety-only clamp: if the intrinsic
    // width would paint outside the page's own real content area, scale
    // BOTH dimensions down proportionally (never distorts, never grows)
    // so the image never paints past its real canonical page bounds —
    // this is a safety floor, not a redesign of the "intrinsic size, no
    // stretch" default policy (see evidence for the audited rationale).
    //
    // BUG FIXED (round 30 follow-up, Human Visual QA HOLD: images
    // rendered drastically too small / "upper-right postage stamp").
    // This clamp previously compared against `lineWidthMm` — the width
    // of the single character-line this unit happens to be attached to
    // (~one em, a few mm), correct for TEXT/RUBY/TCY's own column-strip
    // math above but NOT the available box for an isolated FULL-placement
    // image, which visually spans past its own originating line. Every
    // real image was therefore clamped down to roughly one character's
    // width regardless of its real intended size. Now uses `imageBoxMm`
    // (the real page content-area width/center between margins, threaded
    // from `buildBodyPaintPage`) when available, falling back to the
    // prior `lineWidthMm`/`xCenter` behavior only when no real page
    // geometry was supplied at all (preserves every pre-existing
    // geometry-less caller byte-for-byte).
    const boxWidthMm = imageBoxMm?.contentWidthMm ?? lineWidthMm;
    const boxHeightMm = imageBoxMm?.contentHeightMm ?? unit.heightMm;
    const boxLeftMm = imageBoxMm?.contentLeftMm ?? x;
    const boxTopMm = imageBoxMm?.contentTopMm ?? y;
    const naturalWidthMm = unit.imageIntrinsicWidthMm ?? boxWidthMm;
    const naturalHeightMm = unit.heightMm;
    const placement = unit.imagePlacement ?? "CENTER";
    if (placement === "FULL" && unit.imageFullPageCover && imageBoxMm) {
      // Match the established editor contract: cover the physical page while
      // preserving the marker box's aspect ratio. Any overflow is clipped by
      // the PDF/JPG page surface; no raster-pixel remeasurement is involved.
      const scale = Math.max(
        imageBoxMm.paperWidthMm / naturalWidthMm,
        imageBoxMm.paperHeightMm / naturalHeightMm
      );
      const widthMm = naturalWidthMm * scale;
      const heightMm = naturalHeightMm * scale;
      const imageX = (imageBoxMm.paperWidthMm - widthMm) / 2;
      const imageY = (imageBoxMm.paperHeightMm - heightMm) / 2;
      const resolution = unit.imageResolution;
      return resolution && resolution.kind === "RESOLVED"
        ? [{ op: "image", xMm: imageX, yMm: imageY, widthMm, heightMm, bytes: resolution.bytes, format: resolution.format, ...(unit.imageRefId ? { refId: unit.imageRefId } : {}), fullPageCover: true }]
        : [{ op: "rect", xMm: imageX, yMm: imageY, widthMm, heightMm }];
    }
    if (placement === "FULL") {
      // Preserve the renderer's pre-existing generic Core-fixture behavior:
      // FULL isolates flow but only the Editor bridge's explicit UI contract
      // opts into covering the physical page.
      const scale = naturalWidthMm > boxWidthMm ? boxWidthMm / naturalWidthMm : 1;
      const widthMm = naturalWidthMm * scale;
      const heightMm = naturalHeightMm * scale;
      const imageX = boxLeftMm + (boxWidthMm - widthMm) / 2;
      const resolution = unit.imageResolution;
      return resolution && resolution.kind === "RESOLVED"
        ? [{ op: "image", xMm: imageX, yMm: y, widthMm, heightMm, bytes: resolution.bytes, format: resolution.format, ...(unit.imageRefId ? { refId: unit.imageRefId } : {}) }]
        : [{ op: "rect", xMm: imageX, yMm: y, widthMm, heightMm }];
    }
    const scale = Math.min(1, boxWidthMm / naturalWidthMm, boxHeightMm / naturalHeightMm);
    const widthMm = imageRectMm?.widthMm ?? naturalWidthMm * scale;
    const heightMm = imageRectMm?.heightMm ?? naturalHeightMm * scale;
    const imageX = imageRectMm?.xMm ?? boxLeftMm + (boxWidthMm - widthMm) / 2;
    const imageY = imageRectMm?.yMm ?? (placement === "TOP"
      ? boxTopMm
      : placement === "BOTTOM"
        ? boxTopMm + boxHeightMm - heightMm
        : boxTopMm + (boxHeightMm - heightMm) / 2);
    const resolution = unit.imageResolution;
    if (resolution && resolution.kind === "RESOLVED") {
      return [{ op: "image", xMm: imageX, yMm: imageY, widthMm, heightMm, bytes: resolution.bytes, format: resolution.format, ...(unit.imageRefId ? { refId: unit.imageRefId } : {}) }];
    }
    // PLACEHOLDER (no resolver wired) or an unresolved failure kind that
    // reached paint time without going through `generatePublicationPdf`'s
    // own pre-flight check (e.g. a caller using `buildPaintPlan` directly,
    // as every typography test in this file does) — the same vector-rect
    // placeholder as before, now sized to the real aspect-correct box
    // instead of the full column width.
    return [{ op: "rect", xMm: imageX, yMm: imageY, widthMm, heightMm }];
  }

  // Any other kind without real paint text yet: unchanged vector-rectangle
  // placeholder.
  return [{ op: "rect", xMm: x, yMm: y, widthMm: lineWidthMm, heightMm: unit.heightMm }];
}

// Post-beta typography Phase 1 (傍点): the paint model already resolved which
// graphemes of this atom carry a dot and where along the flow
// (`emphasisDots`, shared `emphasisMarks.ts` contract); this only adds the
// shared cross-axis lane — the same lane Preview paints — and emits one
// filled circle per dot. Never re-derives emphasis from the text.
function emphasisDotCommands(unit: PaintPlacedUnit, x: number, lineWidthMm: number, yOffsetMm: number, bodyEmMm: number): PaintCommand[] {
  if (!unit.emphasisDots) return [];
  const lane = emphasisDotLane(bodyEmMm, lineWidthMm, unit.emphasisDots.side);
  const xMm = x + lineWidthMm / 2 + lane.centerFromParentCenter;
  const topMm = yOffsetMm + unit.topMm;
  return unit.emphasisDots.flowCentersMm.map((center) => ({ op: "circle" as const, xMm, yMm: topMm + center, radiusMm: lane.radius }));
}

// Pure, jsPDF-free: PublicationDocument -> a plain-data paint plan. This is
// what every typography regression test asserts against directly.
//
// `pageGeometry` (optional, additive — see its own interface doc): when
// supplied, the emitted page uses the REAL paper size, and every command's
// coordinates are offset so the already-composed content sits INSET from
// the paper edges by the declared margins, rather than assumed to fill the
// paper edge-to-edge. When omitted, behavior is byte-for-byte the same as
// before this fix (content-sized page, zero margin) — existing callers
// unaffected.
//
// `baselineRatio` (optional, defaults to `FALLBACK_BASELINE_RATIO` — the
// real measured value for the committed font): the font-derived fraction
// of one cell's own height at which jsPDF's horizontal baseline is placed
// — see `deriveBaselineRatioFromFont`. `generatePublicationPdf` computes
// this from the real font resource automatically; callers that only pass
// `hasFont: true` without a real font resource (most of this module's own
// structural tests) get the same real, measured default.
// `outlineContext` (optional, Human Visual QA HOLD round 7): when
// supplied, characters proven to need it (§ see `verticalOutlinePaint.ts`)
// paint via a real vector glyph outline instead of jsPDF's Unicode
// `text()` path. Omitting it preserves the exact prior (pre-round-7)
// "text"-only behavior — every existing call site/test is unaffected.
/**
 * TSP-PHASE13-001: places every 天/中央/地 image of one page with the shared
 * `layoutImageGroup` rule (the same rule the V2 Preview overlay uses), so
 * several images at one position flow in a row instead of overlapping.
 * Sizes are the existing safety-clamped intrinsic sizes.
 */
function groupedImageRects(
  page: PaintPage,
  box: { contentLeftMm: number; contentTopMm: number; contentWidthMm: number; contentHeightMm: number },
): Map<PaintPlacedUnit, ImageRectMm> {
  const groups = new Map<GroupedImagePosition, PaintPlacedUnit[]>();
  for (const column of page.columns) {
    for (const line of column.lines) {
      for (const unit of line.units) {
        if (unit.kind !== "IMAGE") continue;
        const placement = unit.imagePlacement ?? "CENTER";
        if (placement === "FULL") continue;
        const list = groups.get(placement) ?? [];
        list.push(unit);
        groups.set(placement, list);
      }
    }
  }
  const rects = new Map<PaintPlacedUnit, ImageRectMm>();
  const contentBox = { leftMm: box.contentLeftMm, topMm: box.contentTopMm, widthMm: box.contentWidthMm, heightMm: box.contentHeightMm };
  for (const [placement, units] of groups) {
    const sizes = units.map((unit) => {
      const naturalWidthMm = unit.imageIntrinsicWidthMm ?? box.contentWidthMm;
      const naturalHeightMm = unit.heightMm;
      const scale = Math.min(1, box.contentWidthMm / naturalWidthMm, box.contentHeightMm / naturalHeightMm);
      return { widthMm: naturalWidthMm * scale, heightMm: naturalHeightMm * scale };
    });
    layoutImageGroup(sizes, contentBox, placement).forEach((rect, index) => rects.set(units[index], rect));
  }
  return rects;
}

function buildBodyPaintPage(
  page: PaintPage,
  hasFont: boolean,
  pageGeometry: PublicationPageGeometry | undefined,
  doc: PublicationDocument,
  baselineRatio: number,
  isOddPage: boolean,
  outlineContext?: VerticalOutlineContext,
  gposContext?: VerticalGposContext,
  yakumonoContext?: VerticalYakumonoAlignContext,
  physicalPageNumber?: number
): PaintPagePlan {
  const commands: PaintCommand[] = [];
  // The content area's own right edge, physically: the paper's right
    // edge minus the inside margin when pageGeometry is supplied, or the
    // content's own extent (the prior, margin-less behavior) otherwise.
    // Phase 11 残件③: with the Editor's furniture geometry the text frame is
    // parity-aware (ノド on the spine side of each page, as the Preview sheet
    // pads it); without it the historical fixed frame is kept.
    const frameMargins = pageGeometry
      ? furnitureFrameMargins(
          {
            paperWidthMm: pageGeometry.paperWidthMm,
            paperHeightMm: pageGeometry.paperHeightMm,
            marginTopMm: pageGeometry.marginTopMm,
            marginBottomMm: pageGeometry.marginBottomMm,
            marginLeftMm: pageGeometry.marginLeftMm,
            marginRightMm: pageGeometry.marginRightMm,
            ...(pageGeometry.furniture ? { furniture: pageGeometry.furniture } : {}),
          },
          isOddPage
        )
      : undefined;
    const contentRightEdgeMm = pageGeometry && frameMargins ? pageGeometry.paperWidthMm - frameMargins.rightMm : page.widthMm;
    const yOffsetMm = pageGeometry ? pageGeometry.marginTopMm : 0;
    // Round 30 follow-up (Human Visual QA HOLD, image size/placement
    // fix): the real content-area box, used ONLY as an IMAGE unit's own
    // sizing/centering reference (see `unitCommands`'s own `imageBoxMm`
    // doc) — undefined when no real page geometry was supplied, so
    // geometry-less callers keep their prior `lineWidthMm`-based behavior.
    const contentAreaWidthMm = pageGeometry && frameMargins ? contentRightEdgeMm - frameMargins.leftMm : undefined;
    const imageBoxMm = pageGeometry && frameMargins && contentAreaWidthMm !== undefined ? {
      contentLeftMm: frameMargins.leftMm,
      contentTopMm: pageGeometry.marginTopMm,
      contentWidthMm: contentAreaWidthMm,
      contentHeightMm: pageGeometry.paperHeightMm - pageGeometry.marginTopMm - pageGeometry.marginBottomMm,
      paperWidthMm: pageGeometry.paperWidthMm,
      paperHeightMm: pageGeometry.paperHeightMm,
    } : undefined;
    const imageRects = imageBoxMm ? groupedImageRects(page, imageBoxMm) : undefined;
    for (const column of page.columns) {
      for (const line of column.lines) {
        for (const unit of line.units) {
          if (unit.kind === "UNKNOWN") continue;
          // vertical-rl physical placement: a "line" is one vertical strip,
          // offset from the CONTENT area's own right edge by
          // `column.rightMm + line.rightMm`; a unit's own topMm is its
          // offset down that strip, from the content area's own top edge.
          const x = contentRightEdgeMm - column.rightMm - line.rightMm - line.widthMm;
          if (!hasFont) {
            commands.push({ op: "rect", xMm: x, yMm: yOffsetMm + unit.topMm, widthMm: line.widthMm, heightMm: unit.heightMm });
          } else {
            commands.push(...unitCommands(unit, x, line.widthMm, yOffsetMm, baselineRatio, doc.bodyEmMm, outlineContext, gposContext, yakumonoContext, imageBoxMm, imageRects?.get(unit)));
            commands.push(...emphasisDotCommands(unit, x, line.widthMm, yOffsetMm, doc.bodyEmMm));
          }
        }
      }
    }
    // Human Visual QA HOLD round 20/21/22/23 (P3-O08 final-page
    // completion, Steps 1/1B/1C, Human orientation correction):
    // painted ONLY when Core actually supplies one for this page
    // (never invented, never a page-numbering/pagination policy
    // decided here). Core's own `ResolvedFolioPosition`
    // ("center"/"left"/"right", already parity-resolved by Core -- see
    // `core/folio/index.ts`) is still SEMANTIC, not a physical
    // coordinate -- converting it to mm is this function's own job,
    // since this is the only place real paper size/margins
    // (`PublicationPageGeometry`) are ever available.
    //
    // Round 23 (Human Visual QA HOLD): page furniture is NOT manuscript
    // typography -- rounds 20-22 mistakenly routed it through the SAME
    // vertical per-character painter body text uses (GSUB vert/vrt2
    // substitution, small-kana handling, yakumono edge-alignment, TCY
    // rotation), which paints Arabic digits/柱 text sideways/stacked.
    // `horizontalFurnitureCommand` below is a dedicated, SIMPLE
    // horizontal text path (angle 0, no vertical-writing concerns of
    // any kind) -- the same architectural pattern TCY already
    // established for "content that must read horizontally even inside
    // a vertical-rl document."
    const paperWidthMm = pageGeometry?.paperWidthMm ?? page.widthMm;
    const paperHeightMm = pageGeometry?.paperHeightMm ?? page.heightMm;
    const marginBottomMm = pageGeometry?.marginBottomMm ?? 0;
    const marginTopMm = pageGeometry?.marginTopMm ?? 0;
    const marginLeftMm = pageGeometry?.marginLeftMm ?? 0;
    const marginRightMm = pageGeometry?.marginRightMm ?? 0;
    const furnitureFrame: FurniturePageFrame = {
      paperWidthMm,
      paperHeightMm,
      marginTopMm,
      marginBottomMm,
      marginLeftMm,
      marginRightMm,
      ...(pageGeometry?.furniture ? { furniture: pageGeometry.furniture } : {}),
    };
    if (page.folio && page.folio.text.length > 0 && hasFont) {
      // Placement is shared with the Editor Preview (renderer/furnitureGeometry.ts).
      const folioSizePt = doc.folioFontSizePt ?? publicationFurnitureFontSizePt(mmToPt(doc.bodyEmMm));
      const at = folioPlacement(page.folio.position, furnitureFrame, isOddPage, folioSizePt, doc.bodyEmMm);
      commands.push(horizontalFurnitureCommand(page.folio.text, at.xMm, at.yCenterMm, folioSizePt, at.align, "folio", doc.folioFontFamily));
    }
    if (page.header && page.header.text.length > 0 && hasFont) {
      // Human Visual QA HOLD round 25: `band` is the only vertical axis
      // (top/bottom); `horizontal` is Core's parity-resolved side. The
      // physical anchor (text frame edge / paper centre) is shared with the
      // Editor Preview (renderer/furnitureGeometry.ts).
      const at = headerPlacement(page.header.position, furnitureFrame, isOddPage, doc.bodyEmMm);
      commands.push(horizontalFurnitureCommand(page.header.text, at.xMm, at.yCenterMm, doc.runningHeadFontSizePt ?? publicationFurnitureFontSizePt(mmToPt(doc.bodyEmMm)), at.align, "running-head"));
    }
    // TSP-PHASE13-001: 隠しノンブル, independent of the visible folio (it is
    // printed even when nombrePosition is "hidden"). Geometry is shared with
    // the Preview overlay (renderer/furnitureGeometry.ts).
    const hiddenNombre = pageGeometry?.furniture?.hiddenNombre;
    if (hiddenNombre && hasFont && physicalPageNumber !== undefined) {
      const text = hiddenNombreText(page.folio?.text, hiddenNombre.nombreStart, physicalPageNumber);
      const at = hiddenNombreGlyphCentres(text, furnitureFrame, isOddPage);
      Array.from(text).forEach((glyph, i) => {
        commands.push(horizontalFurnitureCommand(glyph, at.xCenterMm, at.yCentersMm[i], HIDDEN_NOMBRE_FONT_SIZE_PT, "center"));
      });
    }
  return {
    widthMm: pageGeometry?.paperWidthMm ?? page.widthMm,
    heightMm: pageGeometry?.paperHeightMm ?? page.heightMm,
    commands,
  };
}

// Human Visual QA HOLD round 20 onward: builds the full document paint
// plan. `outlineContext`/`baselineRatio` (Human Visual QA HOLD round 7):
// see `buildBodyPaintPage`'s own doc comment above.
//
// Human Visual QA HOLD round 28 (P3-O08 final-page completion, Step
// 2C): walks `doc.pageSequence` (Core's own real physical page order)
// when present, dispatching each entry to the body or colophon painter
// -- Publication never decides insertion order itself, only paints what
// Core already decided (`resolveColophonInsertion`, wired in
// `core/layout/assemble.ts`). Falls back to the pre-round-28 "all body,
// then all colophon" concatenation when `pageSequence` is absent (a
// hand-built `PublicationDocument` fixture predating this round) --
// byte-identical to before for every such caller.
export function buildPaintPlan(
  doc: PublicationDocument,
  hasFont: boolean,
  pageGeometry?: PublicationPageGeometry,
  baselineRatio: number = FALLBACK_BASELINE_RATIO,
  outlineContext?: VerticalOutlineContext,
  gposContext?: VerticalGposContext,
  yakumonoContext?: VerticalYakumonoAlignContext
): PaintPlan {
  const source = paintPlanPageSource(doc, hasFont, pageGeometry, baselineRatio, outlineContext, gposContext, yakumonoContext);
  return Array.from({ length: source.pageCount }, (_, physicalIndex) => source.pageAt(physicalIndex));
}

function paintPlanPageSource(
  doc: PublicationDocument,
  hasFont: boolean,
  pageGeometry: PublicationPageGeometry | undefined,
  baselineRatio: number,
  outlineContext?: VerticalOutlineContext,
  gposContext?: VerticalGposContext,
  yakumonoContext?: VerticalYakumonoAlignContext
): PaintPlanPageSource {
  const colophonPageCount = doc.colophonPages?.length ?? 0;
  // `physicalIndex` decides the page's parity (ノド/小口 side) for furniture.
  const bodyPageAt = (i: number, physicalIndex: number) =>
    buildBodyPaintPage(doc.pages[i], hasFont, pageGeometry, doc, baselineRatio, (physicalIndex + 1) % 2 === 1, outlineContext, gposContext, yakumonoContext, physicalIndex + 1);
  // `physicalIndex` (Human Visual QA HOLD round 29): the SAME 0-based
  // final-physical-sequence position `core/layout/assemble.ts` already
  // used to resolve this page's own folio/header -- re-derived here
  // (never re-decided) purely to compute `isOddPage` for
  // `ColophonPlacement.respectGutter`'s own parity-dependent margin
  // resolution, via the SAME `resolveFolioPhysicalSide` Core's own
  // folio/header logic already uses (round 22).
  const colophonPageAt = (i: number, physicalIndex: number) =>
    buildColophonPaintPage(
      doc.colophonPages![i],
      hasFont,
      pageGeometry,
      doc.bodyEmMm,
      doc.colophonPlacement,
      colophonPageCount,
      (physicalIndex + 1) % 2 === 1,
      outlineContext,
      doc.folioFontSizePt,
      doc.runningHeadFontSizePt,
      doc.colophonTemplateId ?? "standard",
      doc.colophonFontSizePt,
      doc.colophonTitleFallback ?? doc.label,
      doc.colophonFontFamily,
      doc.colophonRows,
      doc.colophonFreeText,
      doc.folioFontFamily
    );

  if (doc.pageSequence) {
    const sequence = doc.pageSequence;
    return {
      pageCount: sequence.length,
      pageAt: (physicalIndex) => {
        const ref = sequence[physicalIndex];
        return ref.kind === "body" ? bodyPageAt(ref.index, physicalIndex) : colophonPageAt(ref.index, physicalIndex);
      },
    };
  }
  const bodyCount = doc.pages.length;
  return {
    pageCount: bodyCount + colophonPageCount,
    pageAt: (physicalIndex) => (physicalIndex < bodyCount ? bodyPageAt(physicalIndex, physicalIndex) : colophonPageAt(physicalIndex - bodyCount, physicalIndex)),
  };
}

/**
 * Phase 9: one physical page of the PaintPlan at a time. `pageAt(i)` is
 * exactly `buildPaintPlan(...)[i]` (buildPaintPlan is `pageAt` over every
 * index), so an exporter can build only the pages it outputs, in a worker,
 * without holding the whole plan.
 */
export interface PaintPlanPageSource {
  pageCount: number;
  pageAt: (physicalIndex: number) => PaintPagePlan;
}

// Human Visual QA HOLD round 26: colophon pages are composed through
// the SAME vertical Natural-Pitch line-breaking `composePages` uses for
// body content (Core's own existing, real mechanism -- reused, not
// duplicated) -- but legacy's own real product is HORIZONTAL. This
// function reinterprets that already-decided LINE STRUCTURE (which
// characters share a line -- a real, reusable decision) as horizontal
// rows, painted top-to-bottom, left-to-right, via the SAME
// `horizontalFurnitureCommand` single-line text path folio/header
// already use. KNOWN, DISCLOSED SCOPE LIMIT: only the first column of
// each page is painted (ordinary colophon content -- short field rows
// -- fits within one column in every fixture this round proves; a
// colophon long enough to overflow into a second column would need a
// real multi-column horizontal layout, not yet built).
//
// Human Visual QA HOLD round 28 (P3-O08 final-page completion, Step
// 2C): applies real legacy `ColophonPlacement.horizontal`/`.vertical`
// (`src/lib/colophon.ts:67-74`, `ColophonPageCard.tsx:100-120`'s own
// flexbox justify-content/align-items). `horizontal` anchors each
// non-tab (freeText/plain) line's own text -- a tab-joined row (round
// 27) already spans the full content width by construction (label
// flush-left, value flush-right, mirroring legacy's own fixed 2-column
// `FragmentRow` grid) and is deliberately NOT re-anchored by
// `horizontal`, a disclosed simplification (see evidence). `vertical`
// shifts the WHOLE content block's own start position -- but ONLY when
// this colophon composed onto exactly one page, matching legacy's own
// real single-page model exactly; a v2-only multi-page overflow
// (round 27) always top-anchors every page instead of applying
// `vertical` per page, a deliberate, disclosed "smallest consistent
// continuation rule" (repeating "center"/"bottom" per page would break
// visual flow across pages, a real product decision legacy never had
// to make since it has no multi-page colophon concept at all).
// Human Visual QA HOLD round 29 (P3-O08 final-page completion, Step
// 2D): applies real legacy `respectGutter`/`respectVerticalMargins`
// (`src/lib/colophon.ts:67-74`, direct-read formula at
// `ColophonPageCard.tsx:85-98`) -- these are REAL, NOT a legacy no-op:
// `respectGutter` ON assigns the placement area's own left/right
// margins asymmetrically by page parity (`marginOuter`/`marginGutter`,
// via the SAME `resolveFolioPhysicalSide("outer"|"gutter", isOddPage)`
// Core's own folio/header logic already uses, round 22) — OFF makes
// both sides `Math.min(marginGutterMm, marginOuterMm)` (symmetric).
// `respectVerticalMargins` ON uses `marginTopMm`/`marginBottomMm`
// as-is (the pre-round-29 default) — OFF makes both
// `Math.min(marginTopMm, marginBottomMm)` (symmetric). `left`/`center`/
// `right` and `top`/`center`/`bottom` all resolve WITHIN whatever this
// placement area turns out to be — so "center" is not exempt from
// these flags either, matching legacy's own real flexbox
// justify-content/align-items-on-a-resized-area behavior exactly
// (proven with deliberately asymmetric geometry, not a symmetric
// fixture that would pass by accident). `marginGutterMm`/`marginOuterMm`
// are optional, additive `PublicationPageGeometry` fields (this round);
// omitted, `respectGutter` has no distinguishable effect (both
// true/false fall back to `marginLeftMm`/`marginRightMm` symmetrically)
// -- see that field's own doc comment for why this is the smallest
// sufficient derivation rather than a full parity-aware geometry
// rewrite touching body/folio/header.
// Human Visual QA HOLD round 29C (P3-O08 final-page completion, Human
// HOLD remediation): closes the two remaining real Human-found defects
// in round 28/29's own placement work.
//
// (1) FREE TEXT BLOCK WIDTH. Rows and freeText must share ONE visual
// block, sized by REAL font metrics (`VerticalOutlineContext.advanceWidthMm`,
// round 29C's own new method -- never a character-count estimate,
// which would be wrong the moment a row mixes CJK and Latin/ASCII
// glyphs of genuinely different real widths, e.g. an email address).
// `labelColumnWidthMm`/`valueColumnWidthMm` are each the WIDEST real
// label/value in this page's own rows; freeText wraps (a real,
// per-character greedy wrap against real measured widths -- disclosed
// simplification: no kinsoku line-start/end prohibition is applied
// here, this is Publication-paint-time-only soft-wrap, not a second
// Core line-breaking engine) inside that SAME width. Explicit `\n`
// boundaries (already separate Core-composed lines, see
// `colophonFixturePieces`) are never merged by this wrap -- only
// split further when a single already-explicit line is itself too
// wide.
//
// (2) FURNITURE COLLISION CLAMP. `respectVerticalMargins:false` can
// shrink the colophon's own content area top/bottom past where the
// REAL page furniture (`page.header`/`page.folio`, painted below,
// unchanged) actually sits -- Human found real visual overlap. This
// function now computes each ACTUALLY-PAINTED furniture element's own
// real occupied band (its paint `yCenter` +/- half a body-em, matching
// `baseline:"middle"` text painting) and clamps the colophon's own
// vertical bounds inward only as far as needed to clear it -- never
// moving furniture, never touching Core's own page ordering, and never
// reserving a clamp for furniture that isn't actually present
// (`page.header`/`page.folio` absent or empty -> no exclusion band at
// all, matching the SAME condition already gating whether that
// furniture paints below).
/**
 * TSP-PHASE13-001: the Preview draws colophon text/rules/frames with CSS
 * opacity/alpha over white paper. Output is grayscale, so the same look is
 * printed as the equivalent gray ink (alpha 1 → black, omitted).
 */
function colophonInk(alpha: number): { inkGray?: number } {
  return alpha >= 1 ? {} : { inkGray: 1 - Math.max(0, alpha) };
}

/** Fill+stroke width (em) that stands in for weight 600 (the regular face is the only embedded one). */
const COLOPHON_WEIGHT_STROKE_EM = 0.03;

function buildColophonPaintPage(
  page: PaintPage,
  hasFont: boolean,
  pageGeometry: PublicationPageGeometry | undefined,
  bodyEmMm: number,
  placement: ColophonPlacement | undefined,
  colophonPageCount: number,
  isOddPage: boolean,
  outlineContext?: VerticalOutlineContext,
  folioFontSizePt?: number,
  runningHeadFontSizePt?: number,
  templateId: "standard" | "center" | "minimal" | "classic" = "standard",
  colophonFontSizePt?: number,
  titleFallback: string = "",
  colophonFontFamily?: string,
  rawRows?: Array<{ id?: string; label: string; value: string }>,
  rawFreeText?: string,
  folioFontFamily?: string
): PaintPagePlan {
  const paperWidthMm = pageGeometry?.paperWidthMm ?? page.widthMm;
  const paperHeightMm = pageGeometry?.paperHeightMm ?? page.heightMm;
  const marginTopMm = pageGeometry?.marginTopMm ?? 0;
  const marginBottomMm = pageGeometry?.marginBottomMm ?? 0;
  const marginLeftMm = pageGeometry?.marginLeftMm ?? 0;
  const marginRightMm = pageGeometry?.marginRightMm ?? 0;
  const colophonFurnitureFrame: FurniturePageFrame = {
    paperWidthMm,
    paperHeightMm,
    marginTopMm,
    marginBottomMm,
    marginLeftMm,
    marginRightMm,
    ...(pageGeometry?.furniture ? { furniture: pageGeometry.furniture } : {}),
  };
  const commands: PaintCommand[] = [];
  const firstColumn = page.columns[0];
  const colophonEmMm =
    typeof colophonFontSizePt === "number" && Number.isFinite(colophonFontSizePt)
      ? Math.min(24, Math.max(4, colophonFontSizePt)) * (25.4 / 72)
      : bodyEmMm;
  const vertical = colophonPageCount === 1 ? (placement?.vertical ?? "center") : "top";
  const respectVerticalMargins = placement?.respectVerticalMargins ?? true;

  // Human Visual QA HOLD round 29F: `emSizeMm` now defaults to
  // `bodyEmMm` (the structured metadata's own size) but callers
  // measuring/wrapping freeText pass its own real, smaller em
  // explicitly -- font-size-correct real measurement, never a
  // character-count estimate at any size.
  const measureMm = (text: string, emSizeMm: number = colophonEmMm): number => {
    if (!outlineContext) return Array.from(text).length * emSizeMm; // no real font available -- Natural Pitch's own uniform-advance default, not a new estimate
    let sum = 0;
    for (const ch of Array.from(text)) sum += outlineContext.advanceWidthMm(ch, emSizeMm);
    return sum;
  };
  const wrapToWidthMm = (text: string, widthMm: number, emSizeMm: number = bodyEmMm): string[] => {
    if (widthMm <= 0 || Array.from(text).length === 0) return [text];
    const lines: string[] = [];
    let current = "";
    let currentWidthMm = 0;
    const epsilonMm = 1e-6; // guards against floating-point round-trip error (e.g. frameWidthMm - labelColumnWidthMm - gapMm reconstructing a value's own real width) spuriously splitting a value that exactly fits
    for (const ch of Array.from(text)) {
      const chWidthMm = outlineContext ? outlineContext.advanceWidthMm(ch, emSizeMm) : emSizeMm;
      if (current.length > 0 && currentWidthMm + chWidthMm > widthMm + epsilonMm) {
        lines.push(current);
        current = ch;
        currentWidthMm = chWidthMm;
      } else {
        current += ch;
        currentWidthMm += chWidthMm;
      }
    }
    if (current.length > 0) lines.push(current);
    return lines.length > 0 ? lines : [text];
  };

  if (hasFont && firstColumn) {
    const placementTopMm = respectVerticalMargins ? marginTopMm : Math.min(marginTopMm, marginBottomMm);
    const placementBottomMm = respectVerticalMargins ? marginBottomMm : Math.min(marginTopMm, marginBottomMm);
    // TSP-PHASE13-001: the same placement area as the Preview
    // (`ColophonPageSurface`): respectGutter ON keeps ノド/小口 per physical
    // parity (odd: 小口 left / ノド right; even: mirrored), OFF uses the
    // smaller of the two on both sides.
    const gutterMm = pageGeometry?.marginGutterMm ?? marginRightMm;
    const outerMm = pageGeometry?.marginOuterMm ?? marginLeftMm;
    const symmetricHorizontalMm = Math.min(gutterMm, outerMm);
    const respectGutter = placement?.respectGutter ?? false;
    const contentLeftMm = respectGutter ? (isOddPage ? outerMm : gutterMm) : symmetricHorizontalMm;
    const contentRightMm = paperWidthMm - (respectGutter ? (isOddPage ? gutterMm : outerMm) : symmetricHorizontalMm);

    const halfFurnitureBandMm = bodyEmMm / 2;
    let contentAreaTopMm = placementTopMm;
    let contentAreaBottomMm = paperHeightMm - placementBottomMm;
    if (page.header && page.header.text.length > 0) {
      const headerYCenterMm =
        page.header.position.band === "top"
          ? marginTopMm / 2
          : paperHeightMm - marginBottomMm / 2;
      if (page.header.position.band === "top") {
        contentAreaTopMm = Math.max(contentAreaTopMm, headerYCenterMm + halfFurnitureBandMm);
      } else {
        contentAreaBottomMm = Math.min(contentAreaBottomMm, headerYCenterMm - halfFurnitureBandMm);
      }
    }
    if (page.folio && page.folio.text.length > 0) {
      const folioYCenterMm = folioPlacement(
        page.folio.position,
        colophonFurnitureFrame,
        isOddPage,
        folioFontSizePt ?? publicationFurnitureFontSizePt(mmToPt(bodyEmMm)),
        bodyEmMm
      ).yCenterMm;
      contentAreaBottomMm = Math.min(contentAreaBottomMm, folioYCenterMm - halfFurnitureBandMm);
    }
    contentAreaBottomMm = Math.max(contentAreaBottomMm, contentAreaTopMm);

    const rows: { id: string; label: string; value: string }[] =
      rawRows?.map((row, index) => ({ ...row, id: row.id ?? `row-${index}` })) ?? [];
    const fallbackFreeLines: string[] = [];
    if (!rawRows) {
      let syntheticRow = 0;
      for (const line of firstColumn.lines) {
        const text = line.units.map((u) => u.text).join("");
        if (text.length === 0) continue;
        if (text.includes("\t")) {
          const [label, ...valueParts] = text.split("\t");
          rows.push({ id: `row-${syntheticRow++}`, label, value: valueParts.join("\t") });
        } else {
          fallbackFreeLines.push(text);
        }
      }
    }

    const availableSafeWidthMm = Math.max(contentRightMm - contentLeftMm, 0);
    const renderPlan = buildColophonRenderPlan({
      templateId,
      rows,
      freeText: rawFreeText ?? fallbackFreeLines.join("\n"),
      titleFallback,
      availableWidthEm: availableSafeWidthMm / Math.max(colophonEmMm, 0.001),
    });
    const blockWidthMm = Math.min(renderPlan.widthEm * colophonEmMm, availableSafeWidthMm);
    const blockHeightMm = renderPlan.heightEm * colophonEmMm;
    const blockLeftMm =
      contentLeftMm + Math.max(availableSafeWidthMm - blockWidthMm, 0) / 2;
    const availableHeightMm = Math.max(contentAreaBottomMm - contentAreaTopMm, 0);
    const blockTopMm =
      vertical === "bottom"
        ? Math.max(contentAreaBottomMm - blockHeightMm, contentAreaTopMm)
        : vertical === "center"
          ? contentAreaTopMm + Math.max(availableHeightMm - blockHeightMm, 0) / 2
          : contentAreaTopMm;

    for (const item of renderPlan.items) {
      if (item.kind === "frame") {
        commands.push({
          op: "rect",
          xMm: blockLeftMm + item.xEm * colophonEmMm,
          yMm: blockTopMm + item.yEm * colophonEmMm,
          widthMm: item.widthEm * colophonEmMm,
          heightMm: item.heightEm * colophonEmMm,
          ...colophonInk(item.alpha),
        });
        continue;
      }
      if (item.kind === "rule") {
        commands.push({
          op: "rect",
          xMm: blockLeftMm + item.xEm * colophonEmMm,
          yMm: blockTopMm + item.yEm * colophonEmMm,
          widthMm: item.widthEm * colophonEmMm,
          heightMm: 0.01,
          ...colophonInk(item.alpha),
        });
        continue;
      }
      commands.push({
        op: "text",
        text: item.text,
        xMm: blockLeftMm + item.xEm * colophonEmMm,
        yMm: blockTopMm + item.yEm * colophonEmMm,
        fontSizePt: mmToPt(colophonEmMm * item.fontScale),
        align: item.align,
        angle: 0,
        baseline: "middle",
        ...(colophonFontFamily ? { fontFamily: colophonFontFamily } : {}),
        ...colophonInk(item.opacity ?? 1),
        ...(item.weight !== undefined && item.weight > 400
          ? { strokeWidthMm: colophonEmMm * item.fontScale * COLOPHON_WEIGHT_STROKE_EM * ((item.weight - 400) / 200) }
          : {}),
      });
    }
  }
  if (page.folio && page.folio.text.length > 0 && hasFont) {
    const folioSizePt = folioFontSizePt ?? publicationFurnitureFontSizePt(mmToPt(bodyEmMm));
    const at = folioPlacement(page.folio.position, colophonFurnitureFrame, isOddPage, folioSizePt, bodyEmMm);
    commands.push(horizontalFurnitureCommand(page.folio.text, at.xMm, at.yCenterMm, folioSizePt, at.align, "folio", folioFontFamily));
  }
  // Human Visual QA HOLD round 28: colophon pages carry Core's `header`
  // (`assemble.ts` physical-sequence continuation) and paint it. With Editor
  // geometry the placement is the body page's (shared helper); without it
  // the historical half-cell centring is kept.
  if (page.header && page.header.text.length > 0 && hasFont) {
    const at = headerPlacement(page.header.position, colophonFurnitureFrame, isOddPage, bodyEmMm, true);
    commands.push(horizontalFurnitureCommand(page.header.text, at.xMm, at.yCenterMm, runningHeadFontSizePt ?? publicationFurnitureFontSizePt(mmToPt(bodyEmMm)), at.align, "running-head"));
  }
  return { widthMm: paperWidthMm, heightMm: paperHeightMm, commands };
}

export interface PublicationPdfRenderOptions {
  /** Defaults to the historical V2 behavior: canonical finished/trim size. */
  mode?: PublicationPdfMode;
  /**
   * TSP-PHASE13-001: further embeddable fonts, keyed by the CSS family a text
   * command requests (`PaintCommand.fontFamily` — the ノンブル / 奥付 font).
   * A command whose family is not listed paints with the base font.
   */
  extraFonts?: ReadonlyArray<{ cssFamily: string; font: PublicationFontResource }>;
}

/** Registers the base and extra fonts; returns the jsPDF font name per CSS family. */
function registerPdfFonts(
  pdf: jsPDF,
  fontResource: PublicationFontResource | undefined,
  extraFonts: PublicationPdfRenderOptions["extraFonts"]
): Map<string, string> {
  const registered = new Set<string>();
  const register = (font: PublicationFontResource) => {
    if (registered.has(font.fontName)) return;
    registered.add(font.fontName);
    pdf.addFileToVFS(font.fileName, font.base64);
    pdf.addFont(font.fileName, font.fontName, "normal");
  };
  if (fontResource) register(fontResource);
  const byFamily = new Map<string, string>();
  if (!fontResource) return byFamily;
  for (const extra of extraFonts ?? []) {
    register(extra.font);
    byFamily.set(extra.cssFamily.trim(), extra.font.fontName);
  }
  return byFamily;
}

type JsPdfPageBox = {
  bottomLeftX: number;
  bottomLeftY: number;
  topRightX: number;
  topRightY: number;
};

type JsPdfPageContextWithPrintBoxes = {
  cropBox: JsPdfPageBox | null;
  bleedBox: JsPdfPageBox | null;
  trimBox: JsPdfPageBox | null;
};

/** Convert TateSpun mm/top-left boxes to jsPDF pt/bottom-left page boxes. */
function publicationBoxToJsPdfPoints(
  box: PublicationPdfPageOutput["trimBox"],
  outputHeightMm: number,
  scaleFactor: number,
): JsPdfPageBox {
  return {
    bottomLeftX: box.xMm * scaleFactor,
    bottomLeftY: (outputHeightMm - box.yMm - box.heightMm) * scaleFactor,
    topRightX: (box.xMm + box.widthMm) * scaleFactor,
    topRightY: (outputHeightMm - box.yMm) * scaleFactor,
  };
}

/**
 * jsPDF serializes CropBox/BleedBox/TrimBox from each pageContext, but has
 * no public setter for those page-dictionary entries. Populate that existing
 * metadata immediately after addPage/setPage so print PDFs explicitly carry
 * finished and bleed geometry instead of relying only on visible crop marks.
 * MediaBox remains owned by addPage().
 */
function applyPublicationPdfPageBoxes(pdf: jsPDF, output: PublicationPdfPageOutput): void {
  const pageContext = pdf.getCurrentPageInfo().pageContext as JsPdfPageContextWithPrintBoxes;
  const scaleFactor = pdf.internal.scaleFactor;
  pageContext.cropBox = publicationBoxToJsPdfPoints(output.cropBox, output.heightMm, scaleFactor);
  pageContext.bleedBox = publicationBoxToJsPdfPoints(output.bleedBox, output.heightMm, scaleFactor);
  pageContext.trimBox = publicationBoxToJsPdfPoints(output.trimBox, output.heightMm, scaleFactor);
}

/**
 * TSP-PHASE13-001: box of a 「全面」 image in bleed/full output. Covers the
 * trim page plus `PDF_BLEED_MM` on every side, keeping the image's aspect
 * ratio and centring it on the trim page, in output-sheet coordinates.
 */
export function resolveBleedCoverImageBoxMm(
  cmd: { widthMm: number; heightMm: number },
  page: { widthMm: number; heightMm: number },
  output: PublicationPdfPageOutput,
): { xMm: number; yMm: number; widthMm: number; heightMm: number } {
  const targetWidthMm = page.widthMm + PDF_BLEED_MM * 2;
  const targetHeightMm = page.heightMm + PDF_BLEED_MM * 2;
  const scale = Math.max(targetWidthMm / cmd.widthMm, targetHeightMm / cmd.heightMm);
  const widthMm = cmd.widthMm * scale;
  const heightMm = cmd.heightMm * scale;
  return {
    xMm: output.contentOffsetXMm + (page.widthMm - widthMm) / 2,
    yMm: output.contentOffsetYMm + (page.heightMm - heightMm) / 2,
    widthMm,
    heightMm,
  };
}

function paintBleedCoverImage(
  pdf: jsPDF,
  cmd: Extract<PaintCommand, { op: "image" }>,
  page: PaintPagePlan,
  output: PublicationPdfPageOutput,
): void {
  const box = resolveBleedCoverImageBoxMm(cmd, page, output);
  const clip = output.bleedBox;
  // Clip to the bleed box so an aspect-ratio overflow never reaches the
  // crop-mark margin of a full-mode sheet.
  pdf.saveGraphicsState();
  pdf.rect(clip.xMm, clip.yMm, clip.widthMm, clip.heightMm, null).clip().discardPath();
  pdf.addImage(cmd.bytes, cmd.format, box.xMm, box.yMm, box.widthMm, box.heightMm);
  pdf.restoreGraphicsState();
}

/** 0 (black) … 1 (white) ink tone to a jsPDF gray byte. */
function grayByte(inkGray: number): number {
  return Math.round(Math.min(1, Math.max(0, inkGray)) * 255);
}

function paintPageCommands(
  pdf: jsPDF,
  page: PaintPagePlan,
  output: PublicationPdfPageOutput,
  fonts?: { base: string; byFamily: ReadonlyMap<string, string> },
): void {
  const offsetX = output.contentOffsetXMm;
  const offsetY = output.contentOffsetYMm;
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.05);
  pdf.setFillColor(0, 0, 0);
  for (const cmd of page.commands) {
    if (cmd.op === "rect") {
      if (cmd.inkGray !== undefined) pdf.setDrawColor(grayByte(cmd.inkGray));
      pdf.rect(cmd.xMm + offsetX, cmd.yMm + offsetY, cmd.widthMm, cmd.heightMm);
      if (cmd.inkGray !== undefined) pdf.setDrawColor(0, 0, 0);
      continue;
    }
    if (cmd.op === "circle") {
      pdf.circle(cmd.xMm + offsetX, cmd.yMm + offsetY, cmd.radiusMm, "F");
      continue;
    }
    if (cmd.op === "image") {
      if (cmd.fullPageCover && output.mode !== "trim") {
        paintBleedCoverImage(pdf, cmd, page, output);
        continue;
      }
      pdf.addImage(cmd.bytes, cmd.format, cmd.xMm + offsetX, cmd.yMm + offsetY, cmd.widthMm, cmd.heightMm);
      continue;
    }
    if (cmd.op === "glyphOutline") {
      for (const outlineCmd of cmd.commands) {
        if (outlineCmd.type === "M") pdf.moveTo(outlineCmd.x + offsetX, outlineCmd.y + offsetY);
        else if (outlineCmd.type === "L") pdf.lineTo(outlineCmd.x + offsetX, outlineCmd.y + offsetY);
        else if (outlineCmd.type === "C") pdf.curveTo(
          outlineCmd.x1 + offsetX,
          outlineCmd.y1 + offsetY,
          outlineCmd.x2 + offsetX,
          outlineCmd.y2 + offsetY,
          outlineCmd.x + offsetX,
          outlineCmd.y + offsetY,
        );
        else pdf.close();
      }
      pdf.fill();
      continue;
    }
    const commandFont = cmd.fontFamily ? fonts?.byFamily.get(cmd.fontFamily.trim()) : undefined;
    if (commandFont) pdf.setFont(commandFont);
    pdf.setFontSize(cmd.fontSizePt);
    if (cmd.maxWidthMm !== undefined) {
      const widthMm = pdf.getTextWidth(cmd.text);
      if (widthMm > cmd.maxWidthMm) {
        pdf.setFontSize(cmd.fontSizePt * (cmd.maxWidthMm / widthMm));
      }
    }
    if (cmd.inkGray !== undefined) {
      pdf.setTextColor(grayByte(cmd.inkGray));
      pdf.setDrawColor(grayByte(cmd.inkGray));
    }
    if (cmd.strokeWidthMm !== undefined) pdf.setLineWidth(cmd.strokeWidthMm);
    pdf.text(cmd.text, cmd.xMm + offsetX, cmd.yMm + offsetY, {
      align: cmd.align,
      ...(cmd.angle !== undefined ? { angle: cmd.angle } : {}),
      ...(cmd.baseline ? { baseline: cmd.baseline } : {}),
      ...(cmd.strokeWidthMm !== undefined ? { renderingMode: "fillThenStroke" as const } : {}),
    });
    if (cmd.strokeWidthMm !== undefined) pdf.setLineWidth(0.05);
    if (cmd.inkGray !== undefined) {
      pdf.setTextColor(0, 0, 0);
      pdf.setDrawColor(0, 0, 0);
    }
    if (commandFont && fonts) pdf.setFont(fonts.base);
  }

  if (output.cropMarks.length > 0) {
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.1);
    for (const mark of output.cropMarks) {
      pdf.line(mark.x1Mm, mark.y1Mm, mark.x2Mm, mark.y2Mm);
    }
  }
}

// Thin, mechanical executor: walks a PaintPlan and calls jsPDF's own
// primitives. Contains no typography decisions of its own — everything
// about WHAT to paint and WHERE was already decided by `buildPaintPlan`.
// PDF output mode changes only the containing sheet and paint origin; the
// canonical page commands and their dimensions remain untouched.
export function renderPaintPlanToPdf(
  plan: PaintPlan,
  fontResource?: PublicationFontResource,
  options: PublicationPdfRenderOptions = {},
): PublicationPdfResult {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [1, 1], compress: true, putOnlyUsedFonts: true });
  const fontsByFamily = registerPdfFonts(pdf, fontResource, options.extraFonts);
  // jsPDF always creates one initial page at construction time (sized to
  // `format` above, a throwaway placeholder) — every real page below is
  // added explicitly with its own correct physical size, then the
  // placeholder is deleted, so the emitted document contains exactly
  // `plan.length` pages, never one extra.
  plan.forEach((page, i) => {
    const output = resolvePublicationPdfPageOutput(page.widthMm, page.heightMm, options.mode ?? "trim");
    pdf.addPage([output.widthMm, output.heightMm], "portrait");
    pdf.setPage(i + 2); // page 1 is the throwaway placeholder
    applyPublicationPdfPageBoxes(pdf, output);
    if (fontResource) pdf.setFont(fontResource.fontName);
    paintPageCommands(pdf, page, output, fontResource ? { base: fontResource.fontName, byFamily: fontsByFamily } : undefined);
  });
  pdf.deletePage(1);

  const arrayBuffer = pdf.output("arraybuffer") as ArrayBuffer;
  return { bytes: new Uint8Array(arrayBuffer), pageCount: plan.length };
}

export interface AsyncPdfRenderOptions extends PublicationPdfRenderOptions {
  beforePage?: (pageNumber: number, pageCount: number) => Promise<void>;
  onProgress?: (completedPages: number, pageCount: number) => void;
}

/**
 * Browser-worker executor. The paint decisions remain the PaintPlan's; this
 * variant only adds an awaitable boundary between pages so pause/cancel and
 * progress messages can be honored without publishing a partial document.
 */
export async function renderPaintPlanToPdfAsync(
  plan: PaintPlan,
  fontResource?: PublicationFontResource,
  options: AsyncPdfRenderOptions = {}
): Promise<PublicationPdfResult> {
  return renderPaintPagesToPdfAsync(plan.length, (index) => plan[index], fontResource, options);
}

/**
 * Phase 9: `renderPaintPlanToPdfAsync` over pages produced on demand, so the
 * export worker builds, paints and drops one page at a time instead of
 * holding the whole plan. Same jsPDF calls in the same order.
 */
export async function renderPaintPagesToPdfAsync(
  pageCount: number,
  pageAt: (index: number) => PaintPagePlan | Promise<PaintPagePlan>,
  fontResource?: PublicationFontResource,
  options: AsyncPdfRenderOptions = {}
): Promise<PublicationPdfResult> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [1, 1], compress: true, putOnlyUsedFonts: true });
  const fontsByFamily = registerPdfFonts(pdf, fontResource, options.extraFonts);
  for (let index = 0; index < pageCount; index += 1) {
    await options.beforePage?.(index + 1, pageCount);
    const page = await pageAt(index);
    const output = resolvePublicationPdfPageOutput(page.widthMm, page.heightMm, options.mode ?? "trim");
    pdf.addPage([output.widthMm, output.heightMm], "portrait");
    pdf.setPage(index + 2);
    applyPublicationPdfPageBoxes(pdf, output);
    if (fontResource) pdf.setFont(fontResource.fontName);
    paintPageCommands(pdf, page, output, fontResource ? { base: fontResource.fontName, byFamily: fontsByFamily } : undefined);
    options.onProgress?.(index + 1, pageCount);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  pdf.deletePage(1);
  const arrayBuffer = pdf.output("arraybuffer") as ArrayBuffer;
  return { bytes: new Uint8Array(arrayBuffer), pageCount };
}

// Human Visual QA HOLD round 30 (P3-O08 final-page completion, Step 3):
// collects every IMAGE unit whose own resolver outcome is a real,
// structured failure (MISSING/UNSUPPORTED_FORMAT/CORRUPT) — never
// silently painted as a normal-looking placeholder rectangle and
// reported as a successful export (INV-010's own "no silently
// discarded problem" principle, extended here to image resolution,
// which is genuinely a Publication-only concern Core cannot see).
// PLACEHOLDER is NOT a failure here — it means no resolver was wired at
// all (every existing typography test's own real, intentional mode).
export function findUnresolvedImageIssues(doc: PublicationDocument): string[] {
  const issues: string[] = [];
  const scanPages = (pages: PublicationDocument["pages"]) => {
    for (const page of pages) {
      for (const column of page.columns) {
        for (const line of column.lines) {
          for (const unit of line.units) {
            if (unit.kind !== "IMAGE" || !unit.imageResolution) continue;
            const r = unit.imageResolution;
            if (r.kind === "MISSING") issues.push(`image at ${JSON.stringify(unit.sourceSpan)}: source not found`);
            else if (r.kind === "UNSUPPORTED_FORMAT") issues.push(`image at ${JSON.stringify(unit.sourceSpan)}: unsupported format${r.detectedFormat ? ` (${r.detectedFormat})` : ""}`);
            else if (r.kind === "CORRUPT") issues.push(`image at ${JSON.stringify(unit.sourceSpan)}: corrupt/undecodable bytes`);
          }
        }
      }
    }
  };
  scanPages(doc.pages);
  if (doc.colophonPages) scanPages(doc.colophonPages);
  return issues;
}

// Refuses to emit a normal-looking publication PDF for a HOLD document —
// mirrors Preview's own HOLD structural exclusion (never silently painting
// an unresolved document as an approved layout). Throws rather than
// returning a partially-built result, since there is no "banner-only PDF
// page" concept defined by any frozen contract yet. Round 30: the SAME
// refusal now also applies to a real, unresolved required image.
// Round 31 (JPG Export): extracted so the JPG raster path
// (`rasterGenerator.ts`/`jpgExport.ts`) can reuse the IDENTICAL
// pre-flight HOLD/unresolved-image refusal and paint-context
// construction PDF already uses -- never a second, independently
// drifting copy of this logic (per this round's own "do not duplicate
// composition logic" rule). `generatePublicationPdf` below is now a
// thin wrapper: build the plan via this function, then hand it to
// `renderPaintPlanToPdf`. `refusalPrefix` lets each real caller keep its
// own exact, already-tested error-message wording (existing PDF tests
// assert against `generatePublicationPdf`'s own exact prefix).
export function buildPublicationPaintPlan(doc: PublicationDocument, fontResource: PublicationFontResource | undefined, pageGeometry: PublicationPageGeometry | undefined, refusalPrefix: string): PaintPlan {
  const source = createPublicationPaintPlanBuilder(doc, fontResource, pageGeometry, refusalPrefix);
  return Array.from({ length: source.pageCount }, (_, physicalIndex) => source.pageAt(physicalIndex));
}

/** The HOLD / unresolved-image pre-flight refusal every Publication export applies to the WHOLE document. */
export function assertPublicationPaintable(doc: PublicationDocument, refusalPrefix: string): void {
  if (doc.hold) {
    throw new Error(`${refusalPrefix} for a HOLD document (${doc.holdReasons.join("; ")})`);
  }
  const imageIssues = findUnresolvedImageIssues(doc);
  if (imageIssues.length > 0) {
    throw new Error(`${refusalPrefix} with unresolved required image(s): ${imageIssues.join("; ")}`);
  }
}

/**
 * The font-derived paint contexts `buildPublicationPaintPlan` needs. They
 * depend only on the font, so a long-lived exporter (the Phase 9 export
 * worker) prepares them once per font and reuses them for every document.
 */
export interface PublicationFontPaintContext {
  fontResource: PublicationFontResource | undefined;
  baselineRatio: number;
  outlineContext?: VerticalOutlineContext;
  gposContext?: VerticalGposContext;
  yakumonoContext?: VerticalYakumonoAlignContext;
}

export function preparePublicationFontPaintContext(fontResource: PublicationFontResource | undefined): PublicationFontPaintContext {
  const baselineRatio = fontResource ? deriveBaselineRatioFromFont(fontResource) : FALLBACK_BASELINE_RATIO;
  const fontBytes = fontResource ? FontBinary.fromBase64(fontResource.base64) : undefined;
  return {
    fontResource,
    baselineRatio,
    outlineContext: fontBytes ? new VerticalOutlineContext(fontBytes) : undefined,
    gposContext: fontBytes ? new VerticalGposContext(fontBytes) : undefined,
    yakumonoContext: fontBytes ? new VerticalYakumonoAlignContext(fontBytes, baselineRatio) : undefined,
  };
}

/**
 * Phase 9: `buildPublicationPaintPlan` one page at a time — the same HOLD and
 * unresolved-image refusal up front, then `pageAt(i)` equal to the full
 * plan's page `i`.
 */
export function createPublicationPaintPlanBuilder(
  doc: PublicationDocument,
  fontResource: PublicationFontResource | undefined,
  pageGeometry: PublicationPageGeometry | undefined,
  refusalPrefix: string,
  fontContext: PublicationFontPaintContext = preparePublicationFontPaintContext(fontResource)
): PaintPlanPageSource {
  assertPublicationPaintable(doc, refusalPrefix);
  if (fontContext.fontResource !== fontResource) {
    throw new Error(`${refusalPrefix}: the font paint context belongs to a different font`);
  }
  const { baselineRatio, outlineContext, gposContext, yakumonoContext } = fontContext;
  return paintPlanPageSource(doc, !!fontResource, pageGeometry, baselineRatio, outlineContext, gposContext, yakumonoContext);
}

export function generatePublicationPdf(doc: PublicationDocument, fontResource?: PublicationFontResource, pageGeometry?: PublicationPageGeometry): PublicationPdfResult {
  const plan = buildPublicationPaintPlan(doc, fontResource, pageGeometry, "generatePublicationPdf: refusing to emit a Publication PDF");
  return renderPaintPlanToPdf(plan, fontResource);
}
