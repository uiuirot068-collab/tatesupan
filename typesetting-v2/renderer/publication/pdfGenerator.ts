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

import { jsPDF } from "jspdf";
import type { PaintPage, PaintPlacedUnit, PublicationDocument } from "./paintModel";
import { verticalPaintGraphemeFor } from "./verticalGlyphMap";
import { createGlyphIdLookup } from "./fontCapability";
import { FontMetricsReader } from "./fontMetrics";
import { VerticalOutlineContext, type OutlinePathCommand } from "./verticalOutlinePaint";
import { VerticalGposContext } from "./verticalGposPaint";
import { VerticalYakumonoAlignContext } from "./verticalYakumonoAlign";
import { DEFAULT_RUBY_SCALE, resolveFolioPhysicalSide, type ColophonPlacement } from "../../core";

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
  // resolved by this round). These two fields are read ONLY by
  // `buildColophonPaintPage`'s own `ColophonPlacement.respectGutter`
  // resolution (round 29) -- body/folio/header remain byte-identical.
  // Optional/additive: omitted (every existing caller), `respectGutter`
  // has no distinguishable effect (falls back to
  // `marginLeftMm`/`marginRightMm` symmetrically either way) -- a real,
  // honest inertness, not a silent no-op dressed up as support.
  marginGutterMm?: number;
  marginOuterMm?: number;
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
    }
  | { op: "rect"; xMm: number; yMm: number; widthMm: number; heightMm: number }
  // Human Visual QA HOLD round 7 (OpenType vertical GSUB outline paint,
  // dependency-gate approval — opentype.js): a real vector glyph outline,
  // already fully translated/scaled into mm page-coordinate space
  // (`VerticalOutlineContext.glyphOutlineCommandsMm`). Emitted ONLY for
  // the specific graphemes proven (P3_O08_OPENTYPE_VERTICAL_GSUB_AUDIT.md)
  // to have a real GSUB `vert`/`vrt2` alternate that is NOT reachable via
  // jsPDF's Unicode-string `text()` API — every other character keeps
  // using the existing "text" command, unchanged.
  | { op: "glyphOutline"; commands: OutlinePathCommand[] };

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
const FALLBACK_BASELINE_RATIO = 0.88;

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
  const buf = Buffer.from(fontResource.base64, "base64");
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
    const gposOffsetMm = yakumonoBaselineRatio !== undefined || smallKanaBaselineRatio !== undefined ? 0 : (gposContext?.yPlacementEmFor(ch) ?? 0) * emSizeMm;
    const yMm = topMm + i * perCharHeightMm + perCharHeightMm * effectiveBaselineRatio + gposOffsetMm;
    const outlineGlyphId = outlineContext?.resolveOutlineGlyphId(ch);
    if (outlineGlyphId !== undefined && outlineContext) {
      return { op: "glyphOutline" as const, commands: outlineContext.glyphOutlineCommandsMm(outlineGlyphId, xCenterMm, yMm, perCharHeightMm) };
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
function horizontalFurnitureCommand(text: string, xCenterMm: number, yCenterMm: number, fontSizePt: number): PaintCommand {
  return { op: "text", text, xMm: xCenterMm, yMm: yCenterMm, fontSizePt, align: "center", angle: 0, baseline: "middle" };
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
  yakumonoContext?: VerticalYakumonoAlignContext
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
      // Positioned to the physical right of the base run's own column —
      // the vector-paint equivalent of Preview's `left: 100%` CSS (see
      // this module's own RUBY_ANNOTATION_FONT_RATIO comment). BUG FIXED
      // (Human Visual QA HOLD, catastrophic overlap): the clearance MUST be
      // sized relative to the ANNOTATION's own font/glyph width, never the
      // base run's own `lineWidthMm` — the two are unrelated scales, and
      // using the base line's width as the clearance reference produced a
      // gap far too small for the annotation's own (similarly-sized)
      // glyphs, so the annotation visibly overlapped back into the base
      // run's column. The annotation is now centered within its own
      // em-sized column, placed just past the base run's right edge with a
      // small proportional gap.
      const annotationEmWidthMm = annotationFontSizePt * (25.4 / 72);
      const annotationGapMm = annotationEmWidthMm * 0.25;
      const annotationX = x + lineWidthMm + annotationGapMm + annotationEmWidthMm / 2;
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

  // IMAGE, and any other kind without real paint text yet: unchanged
  // vector-rectangle placeholder.
  return [{ op: "rect", xMm: x, yMm: y, widthMm: lineWidthMm, heightMm: unit.heightMm }];
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
function buildBodyPaintPage(
  page: PaintPage,
  hasFont: boolean,
  pageGeometry: PublicationPageGeometry | undefined,
  doc: PublicationDocument,
  baselineRatio: number,
  outlineContext?: VerticalOutlineContext,
  gposContext?: VerticalGposContext,
  yakumonoContext?: VerticalYakumonoAlignContext
): PaintPagePlan {
  const commands: PaintCommand[] = [];
  // The content area's own right edge, physically: the paper's right
    // edge minus the inside margin when pageGeometry is supplied, or the
    // content's own extent (the prior, margin-less behavior) otherwise.
    const contentRightEdgeMm = pageGeometry ? pageGeometry.paperWidthMm - pageGeometry.marginRightMm : page.widthMm;
    const yOffsetMm = pageGeometry ? pageGeometry.marginTopMm : 0;
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
            commands.push(...unitCommands(unit, x, line.widthMm, yOffsetMm, baselineRatio, doc.bodyEmMm, outlineContext, gposContext, yakumonoContext));
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
    if (page.folio && page.folio.text.length > 0 && hasFont) {
      // "left"/"right" anchor flush with the SAME margin the body
      // content area itself uses, mirroring legacy's own "frame edge,
      // not paper edge" convention (`PageCard.tsx`'s `NombreOverlay`).
      const xCenter =
        page.folio.position === "left"
          ? marginLeftMm + doc.bodyEmMm / 2
          : page.folio.position === "right"
            ? paperWidthMm - marginRightMm - doc.bodyEmMm / 2
            : paperWidthMm / 2;
      const yCenter = paperHeightMm - marginBottomMm / 2;
      commands.push(horizontalFurnitureCommand(page.folio.text, xCenter, yCenter, mmToPt(doc.bodyEmMm)));
    }
    if (page.header && page.header.text.length > 0 && hasFont) {
      // Human Visual QA HOLD round 25 (correction to round 24's own
      // vertical-center misreading): `band` is the ONLY vertical axis
      // (top/bottom, matching legacy exactly) -- there is no vertical
      // center. `horizontal` reuses the SAME center/left/right
      // resolution folio's own position already uses: "left"/"right"
      // anchor flush with the margin the body content area itself
      // uses; "center" horizontally centers on the PAPER's own
      // physical width (jsPDF's own `align:"center"` in
      // `horizontalFurnitureCommand` already accounts for the real
      // text width -- no separate measurement needed here).
      const xCenter =
        page.header.position.horizontal === "left"
          ? marginLeftMm + doc.bodyEmMm / 2
          : page.header.position.horizontal === "right"
            ? paperWidthMm - marginRightMm - doc.bodyEmMm / 2
            : paperWidthMm / 2;
      const yCenter = page.header.position.band === "top" ? marginTopMm / 2 : paperHeightMm - marginBottomMm / 2;
      commands.push(horizontalFurnitureCommand(page.header.text, xCenter, yCenter, mmToPt(doc.bodyEmMm)));
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
  const colophonPageCount = doc.colophonPages?.length ?? 0;
  const bodyPageAt = (i: number) => buildBodyPaintPage(doc.pages[i], hasFont, pageGeometry, doc, baselineRatio, outlineContext, gposContext, yakumonoContext);
  // `physicalIndex` (Human Visual QA HOLD round 29): the SAME 0-based
  // final-physical-sequence position `core/layout/assemble.ts` already
  // used to resolve this page's own folio/header -- re-derived here
  // (never re-decided) purely to compute `isOddPage` for
  // `ColophonPlacement.respectGutter`'s own parity-dependent margin
  // resolution, via the SAME `resolveFolioPhysicalSide` Core's own
  // folio/header logic already uses (round 22).
  const colophonPageAt = (i: number, physicalIndex: number) =>
    buildColophonPaintPage(doc.colophonPages![i], hasFont, pageGeometry, doc.bodyEmMm, doc.colophonPlacement, colophonPageCount, (physicalIndex + 1) % 2 === 1, outlineContext);

  if (doc.pageSequence) {
    return doc.pageSequence.map((ref, physicalIndex) => (ref.kind === "body" ? bodyPageAt(ref.index) : colophonPageAt(ref.index, physicalIndex)));
  }
  const bodyPlan = doc.pages.map((_, i) => bodyPageAt(i));
  const colophonPlan = (doc.colophonPages ?? []).map((_, i) => colophonPageAt(i, doc.pages.length + i));
  return [...bodyPlan, ...colophonPlan];
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
function buildColophonPaintPage(
  page: PaintPage,
  hasFont: boolean,
  pageGeometry: PublicationPageGeometry | undefined,
  bodyEmMm: number,
  placement: ColophonPlacement | undefined,
  colophonPageCount: number,
  isOddPage: boolean,
  outlineContext?: VerticalOutlineContext
): PaintPagePlan {
  const paperWidthMm = pageGeometry?.paperWidthMm ?? page.widthMm;
  const paperHeightMm = pageGeometry?.paperHeightMm ?? page.heightMm;
  const marginTopMm = pageGeometry?.marginTopMm ?? 0;
  const marginBottomMm = pageGeometry?.marginBottomMm ?? 0;
  const marginLeftMm = pageGeometry?.marginLeftMm ?? 0;
  const marginRightMm = pageGeometry?.marginRightMm ?? 0;
  const commands: PaintCommand[] = [];
  const firstColumn = page.columns[0];
  const horizontal = placement?.horizontal ?? "center";
  const vertical = colophonPageCount === 1 ? (placement?.vertical ?? "center") : "top";
  const respectGutter = placement?.respectGutter ?? true;
  const respectVerticalMargins = placement?.respectVerticalMargins ?? true;

  const measureMm = (text: string): number => {
    if (!outlineContext) return Array.from(text).length * bodyEmMm; // no real font available -- Natural Pitch's own uniform-advance default, not a new estimate
    let sum = 0;
    for (const ch of Array.from(text)) sum += outlineContext.advanceWidthMm(ch, bodyEmMm);
    return sum;
  };
  const wrapToWidthMm = (text: string, widthMm: number): string[] => {
    if (widthMm <= 0 || Array.from(text).length === 0) return [text];
    const lines: string[] = [];
    let current = "";
    let currentWidthMm = 0;
    const epsilonMm = 1e-6; // guards against floating-point round-trip error (e.g. frameWidthMm - labelColumnWidthMm - gapMm reconstructing a value's own real width) spuriously splitting a value that exactly fits
    for (const ch of Array.from(text)) {
      const chWidthMm = outlineContext ? outlineContext.advanceWidthMm(ch, bodyEmMm) : bodyEmMm;
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
    const lineHeightMm = bodyEmMm * 1.5; // simple, deterministic horizontal line spacing -- not a redesign of colophon's own visual style, just enough separation to keep lines legible
    const gutterMm = pageGeometry?.marginGutterMm;
    const outerMm = pageGeometry?.marginOuterMm;
    let placementLeftMm = marginLeftMm;
    let placementRightMm = marginRightMm;
    if (gutterMm !== undefined && outerMm !== undefined) {
      if (respectGutter) {
        const outerSide = resolveFolioPhysicalSide("outer", isOddPage);
        placementLeftMm = outerSide === "left" ? outerMm : gutterMm;
        placementRightMm = outerSide === "left" ? gutterMm : outerMm;
      } else {
        const symmetricMm = Math.min(gutterMm, outerMm);
        placementLeftMm = symmetricMm;
        placementRightMm = symmetricMm;
      }
    }
    const placementTopMm = respectVerticalMargins ? marginTopMm : Math.min(marginTopMm, marginBottomMm);
    const placementBottomMm = respectVerticalMargins ? marginBottomMm : Math.min(marginTopMm, marginBottomMm);
    const contentLeftMm = placementLeftMm;
    const contentRightMm = paperWidthMm - placementRightMm;

    // Furniture collision clamp (round 29C, item 2) -- real painted band
    // per actually-present furniture element only, clamped inward only.
    const halfFurnitureBandMm = bodyEmMm / 2; // baseline:"middle" text occupies roughly one em, centered on its own yCenter
    let contentAreaTopMm = placementTopMm;
    let contentAreaBottomMm = paperHeightMm - placementBottomMm;
    if (page.header && page.header.text.length > 0) {
      const headerYCenterMm = page.header.position.band === "top" ? marginTopMm / 2 : paperHeightMm - marginBottomMm / 2;
      if (page.header.position.band === "top") {
        contentAreaTopMm = Math.max(contentAreaTopMm, headerYCenterMm + halfFurnitureBandMm);
      } else {
        contentAreaBottomMm = Math.min(contentAreaBottomMm, headerYCenterMm - halfFurnitureBandMm);
      }
    }
    if (page.folio && page.folio.text.length > 0) {
      const folioYCenterMm = paperHeightMm - marginBottomMm / 2; // folio always bottom-band, see paint below
      contentAreaBottomMm = Math.min(contentAreaBottomMm, folioYCenterMm - halfFurnitureBandMm);
    }
    contentAreaBottomMm = Math.max(contentAreaBottomMm, contentAreaTopMm); // never invert if furniture leaves no room at all
    const contentAreaHeightMm = Math.max(contentAreaBottomMm - contentAreaTopMm, 0);

    // Block model (round 29C item 1, corrected round 29D). Human found
    // round 29C's own "value column = widest real value across every
    // row" defect: one long value (e.g. an email address) enlarged the
    // ENTIRE block, which freeText then inherited. Human Product
    // Decision (round 29D, this comment records it -- not merely an
    // implementation note): the bounded content frame is defined by ONE
    // reference row -- the field legacy's own `defaultColophonFields()`
    // (`src/lib/colophon.ts:101-111`) always places FIRST (書名/title).
    // `id` metadata does not survive Core's own text-flow pipeline
    // (a composed colophon LINE is plain flowed text by the time it
    // reaches this paint function, per Contract's own Renderer-reads-
    // Canonical-only boundary) -- so this uses POSITION (`rows[0]`),
    // matching that real, stable field-order convention exactly
    // (round 27 proved Core's own compiler preserves field order
    // verbatim), never a literal Japanese string comparison.
    //
    // `valueColumnWidthMm` = the reference row's own value width,
    // DIRECTLY (never re-derived by subtracting a label-column width
    // from a frame computed against the reference row's own label --
    // that would let some OTHER row's wider label silently shrink the
    // title row's own value column below its own natural width,
    // wrapping the title value even when the Human's own visual target
    // keeps it on one line). `labelColumnWidthMm` may still be the
    // widest LABEL across all rows (Human's own explicit allowance --
    // labels are short, uniform-ish product vocabulary, not the
    // defect); the frame simply grows to include that real width.
    // `frameWidthMm = labelColumnWidthMm + gap + valueColumnWidthMm` --
    // by construction the reference row's own value NEVER wraps. Every
    // OTHER row's own value shares the SAME `valueColumnWidthMm` and
    // WRAPS (the same real per-character greedy wrap freeText already
    // uses) if its own real content is wider -- it never enlarges the
    // frame. freeText wraps inside the SAME frame width.
    //
    // DISCLOSED GAP: this wrap happens at Publication paint time, after
    // Core already decided how many PAGES the colophon needs (from its
    // own, unrelated, character-count Natural Pitch line count). If a
    // frame narrow enough to force heavy re-wrapping ever produces MORE
    // real visual lines than Core's own page capacity assumed, content
    // could in principle extend past a physical page's own bottom edge
    // -- not observed in any fixture this round proves (this round's
    // own page capacity comfortably exceeds the real re-wrapped line
    // count), but not proven safe in general; a full fix would require
    // Publication to renegotiate Core's own page breaks, a materially
    // larger change than this round's own scope.
    const rows: { label: string; value: string }[] = [];
    const freeTextRawLines: string[] = [];
    for (const line of firstColumn.lines) {
      const text = line.units.map((u) => u.text).join("");
      if (text.length === 0) continue;
      if (text.includes("\t")) {
        const [label, value] = text.split("\t");
        rows.push({ label, value });
      } else {
        freeTextRawLines.push(text);
      }
    }
    const gapMm = bodyEmMm; // one real em between label/value columns -- deterministic, documented choice, not measured from any legacy source (legacy's own CSS grid gap is a separate, un-ported visual-density detail)
    const referenceRow = rows[0];
    // Human Product Decision (round 29D): `valueColumnWidthMm` is the
    // reference row's own value width DIRECTLY -- not re-derived by
    // subtracting `labelColumnWidthMm` from a frame computed against
    // the reference row's OWN (possibly narrower) label. Deriving it
    // via subtraction would let some OTHER row's wider label (e.g.
    // サークル vs 書名) silently shrink the title row's own value column
    // below its own natural width, wrapping the title value even
    // though the Human's own visual target keeps it on one line.
    // `labelColumnWidthMm` may still be the widest label across ALL
    // rows (Human's own explicit allowance); the frame simply grows to
    // accommodate that real width, on top of the reference row's own
    // full value width -- so the reference row's own value NEVER wraps
    // by construction, while any other row's wider value still does.
    const labelColumnWidthMm = rows.length > 0 ? Math.max(...rows.map((r) => measureMm(r.label))) : 0;
    const valueColumnWidthMm = referenceRow ? measureMm(referenceRow.value) : 0;
    const frameWidthMm = rows.length > 0 ? labelColumnWidthMm + gapMm + valueColumnWidthMm : 0;
    const rowsWithWrappedValues = rows.map((r) => ({ label: r.label, valueLines: r.value.length > 0 ? wrapToWidthMm(r.value, valueColumnWidthMm) : [] }));
    const wrapWidthMm = rows.length > 0 ? frameWidthMm : Math.max(contentRightMm - contentLeftMm, 0);
    const freeTextLines = freeTextRawLines.flatMap((l) => wrapToWidthMm(l, wrapWidthMm));
    const blockWidthMm = rows.length > 0 ? frameWidthMm : Math.max(0, ...freeTextLines.map((l) => measureMm(l)));
    const blockLeftMm =
      horizontal === "left" ? contentLeftMm : horizontal === "right" ? contentRightMm - blockWidthMm : contentLeftMm + Math.max(contentRightMm - contentLeftMm - blockWidthMm, 0) / 2;

    // Deterministic block-height: real line COUNT (each row now
    // contributes max(1, its own wrapped value line count) real lines,
    // plus real wrapped freeText lines) times the same fixed
    // lineHeightMm every line paints at -- never a character-count-based
    // estimate.
    const rowLineCounts = rowsWithWrappedValues.map((r) => Math.max(1, r.valueLines.length));
    const totalContentHeightMm = (rowLineCounts.reduce((a, b) => a + b, 0) + freeTextLines.length) * lineHeightMm;
    const startYMm =
      vertical === "bottom"
        ? Math.max(contentAreaBottomMm - totalContentHeightMm, contentAreaTopMm)
        : vertical === "center"
          ? contentAreaTopMm + Math.max(contentAreaHeightMm - totalContentHeightMm, 0) / 2
          : contentAreaTopMm;

    let lineIndex = 0;
    for (const row of rowsWithWrappedValues) {
      const rowStartLineIndex = lineIndex;
      if (row.label.length > 0) {
        const labelYMm = startYMm + rowStartLineIndex * lineHeightMm + bodyEmMm / 2;
        commands.push({ op: "text", text: row.label, xMm: blockLeftMm, yMm: labelYMm, fontSizePt: mmToPt(bodyEmMm), align: "left", angle: 0, baseline: "middle" });
      }
      for (const valueLine of row.valueLines) {
        if (valueLine.length > 0) {
          const valueYMm = startYMm + lineIndex * lineHeightMm + bodyEmMm / 2;
          commands.push({ op: "text", text: valueLine, xMm: blockLeftMm + labelColumnWidthMm + gapMm, yMm: valueYMm, fontSizePt: mmToPt(bodyEmMm), align: "left", angle: 0, baseline: "middle" });
        }
        lineIndex++;
      }
      if (row.valueLines.length === 0) lineIndex++; // label-only row (blank value) still occupies its own line
    }
    for (const line of freeTextLines) {
      const yCenter = startYMm + lineIndex * lineHeightMm + bodyEmMm / 2;
      // freeText always left-aligns WITHIN the block (natural paragraph
      // flow) -- `horizontal` decides where the whole block sits on the
      // page (blockLeftMm above), not freeText's own internal alignment.
      commands.push({ op: "text", text: line, xMm: blockLeftMm, yMm: yCenter, fontSizePt: mmToPt(bodyEmMm), align: "left", angle: 0, baseline: "middle" });
      lineIndex++;
    }
  }
  if (page.folio && page.folio.text.length > 0 && hasFont) {
    const xCenter =
      page.folio.position === "left" ? marginLeftMm + bodyEmMm / 2 : page.folio.position === "right" ? paperWidthMm - marginRightMm - bodyEmMm / 2 : paperWidthMm / 2;
    const yCenter = paperHeightMm - marginBottomMm / 2;
    commands.push(horizontalFurnitureCommand(page.folio.text, xCenter, yCenter, mmToPt(bodyEmMm)));
  }
  // Human Visual QA HOLD round 28: colophon pages have carried a real,
  // Core-generated `header` since round 26 (`assemble.ts`'s own
  // physical-sequence continuation), but this function never painted
  // it -- an undetected round-26 gap, fixed here, mirroring the body
  // page header paint exactly (`buildBodyPaintPage` above).
  if (page.header && page.header.text.length > 0 && hasFont) {
    const xCenter =
      page.header.position.horizontal === "left"
        ? marginLeftMm + bodyEmMm / 2
        : page.header.position.horizontal === "right"
          ? paperWidthMm - marginRightMm - bodyEmMm / 2
          : paperWidthMm / 2;
    const yCenter = page.header.position.band === "top" ? marginTopMm / 2 : paperHeightMm - marginBottomMm / 2;
    commands.push(horizontalFurnitureCommand(page.header.text, xCenter, yCenter, mmToPt(bodyEmMm)));
  }
  return { widthMm: paperWidthMm, heightMm: paperHeightMm, commands };
}

// Thin, mechanical executor: walks a PaintPlan and calls jsPDF's own
// primitives. Contains no typography decisions of its own — everything
// about WHAT to paint and WHERE was already decided by `buildPaintPlan`.
export function renderPaintPlanToPdf(plan: PaintPlan, fontResource?: PublicationFontResource): PublicationPdfResult {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [1, 1] });
  if (fontResource) {
    pdf.addFileToVFS(fontResource.fileName, fontResource.base64);
    pdf.addFont(fontResource.fileName, fontResource.fontName, "normal");
  }
  // jsPDF always creates one initial page at construction time (sized to
  // `format` above, a throwaway placeholder) — every real page below is
  // added explicitly with its own correct physical size, then the
  // placeholder is deleted, so the emitted document contains exactly
  // `plan.length` pages, never one extra.
  plan.forEach((page, i) => {
    pdf.addPage([page.widthMm, page.heightMm], "portrait");
    pdf.setPage(i + 2); // page 1 is the throwaway placeholder
    if (fontResource) pdf.setFont(fontResource.fontName);
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.05);
    pdf.setFillColor(0, 0, 0);
    for (const cmd of page.commands) {
      if (cmd.op === "rect") {
        pdf.rect(cmd.xMm, cmd.yMm, cmd.widthMm, cmd.heightMm);
        continue;
      }
      if (cmd.op === "glyphOutline") {
        // Round 7: a real vector glyph outline (already fully
        // translated/scaled into mm page-coordinate space by
        // `buildPaintPlan`/`VerticalOutlineContext` — this executor makes
        // no typography decisions, it only walks the already-decided
        // command stream). One glyph's outline may have MULTIPLE contours
        // (e.g. ゅ has 4) — each starts with its own "M" and ends with its
        // own "Z" (mapped to jsPDF's own `close()`, the PDF "h" operator);
        // ALL contours are accumulated into ONE current path before a
        // SINGLE `fill()` call, so the PDF's native nonzero-winding-rule
        // fill correctly renders inner "holes" (e.g. an enclosed
        // counter-shape) exactly as PDF's own multi-subpath model intends.
        for (const outlineCmd of cmd.commands) {
          if (outlineCmd.type === "M") pdf.moveTo(outlineCmd.x, outlineCmd.y);
          else if (outlineCmd.type === "L") pdf.lineTo(outlineCmd.x, outlineCmd.y);
          else if (outlineCmd.type === "C") pdf.curveTo(outlineCmd.x1, outlineCmd.y1, outlineCmd.x2, outlineCmd.y2, outlineCmd.x, outlineCmd.y);
          else pdf.close();
        }
        pdf.fill();
        continue;
      }
      pdf.setFontSize(cmd.fontSizePt);
      // TCY's own single measure-then-scale fit pass happens here, against
      // the REAL registered font (buildPaintPlan itself stays jsPDF-free,
      // so this is the one place font-metric-dependent sizing happens) —
      // never changes canonical coordinates, only this one text run's own
      // paint-time font size.
      if (cmd.maxWidthMm !== undefined) {
        const widthMm = pdf.getTextWidth(cmd.text);
        if (widthMm > cmd.maxWidthMm) {
          pdf.setFontSize(cmd.fontSizePt * (cmd.maxWidthMm / widthMm));
        }
      }
      pdf.text(cmd.text, cmd.xMm, cmd.yMm, {
        align: cmd.align,
        ...(cmd.angle !== undefined ? { angle: cmd.angle } : {}),
        ...(cmd.baseline ? { baseline: cmd.baseline } : {}),
      });
    }
  });
  pdf.deletePage(1);

  const arrayBuffer = pdf.output("arraybuffer") as ArrayBuffer;
  return { bytes: new Uint8Array(arrayBuffer), pageCount: plan.length };
}

// Refuses to emit a normal-looking publication PDF for a HOLD document —
// mirrors Preview's own HOLD structural exclusion (never silently painting
// an unresolved document as an approved layout). Throws rather than
// returning a partially-built result, since there is no "banner-only PDF
// page" concept defined by any frozen contract yet.
export function generatePublicationPdf(doc: PublicationDocument, fontResource?: PublicationFontResource, pageGeometry?: PublicationPageGeometry): PublicationPdfResult {
  if (doc.hold) {
    throw new Error(`generatePublicationPdf: refusing to emit a Publication PDF for a HOLD document (${doc.holdReasons.join("; ")})`);
  }
  const baselineRatio = fontResource ? deriveBaselineRatioFromFont(fontResource) : FALLBACK_BASELINE_RATIO;
  const outlineContext = fontResource ? new VerticalOutlineContext(Buffer.from(fontResource.base64, "base64")) : undefined;
  const gposContext = fontResource ? new VerticalGposContext(Buffer.from(fontResource.base64, "base64")) : undefined;
  const yakumonoContext = fontResource ? new VerticalYakumonoAlignContext(Buffer.from(fontResource.base64, "base64"), baselineRatio) : undefined;
  const plan = buildPaintPlan(doc, !!fontResource, pageGeometry, baselineRatio, outlineContext, gposContext, yakumonoContext);
  return renderPaintPlanToPdf(plan, fontResource);
}
