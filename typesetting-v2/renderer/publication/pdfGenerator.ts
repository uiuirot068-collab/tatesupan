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
import type { PaintPlacedUnit, PublicationDocument } from "./paintModel";
import { verticalPaintGraphemeFor } from "./verticalGlyphMap";
import { createGlyphIdLookup } from "./fontCapability";
import { FontMetricsReader } from "./fontMetrics";
import { VerticalOutlineContext, type OutlinePathCommand } from "./verticalOutlinePaint";
import { DEFAULT_RUBY_SCALE } from "../../core";

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
}

export type PaintCommand =
  | { op: "text"; text: string; xMm: number; yMm: number; fontSizePt: number; align: "left" | "center"; angle?: number; baseline?: "alphabetic" | "middle"; maxWidthMm?: number }
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
function verticalGraphemeCommands(
  text: string,
  xCenterMm: number,
  topMm: number,
  totalHeightMm: number,
  fontSizePt: number,
  baselineRatio: number = FALLBACK_BASELINE_RATIO,
  outlineContext?: VerticalOutlineContext
): PaintCommand[] {
  const graphemes = Array.from(text);
  if (graphemes.length === 0) return [];
  const perCharHeightMm = totalHeightMm / graphemes.length;
  return graphemes.map((ch, i) => {
    const yMm = topMm + i * perCharHeightMm + perCharHeightMm * baselineRatio;
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

// Converts a physical mm length to the equivalent jsPDF font-size point
// value for ONE character cell of that height.
function mmToPt(mm: number): number {
  return mm * (72 / 25.4);
}

function unitCommands(unit: PaintPlacedUnit, x: number, lineWidthMm: number, yOffsetMm: number, baselineRatio: number, outlineContext?: VerticalOutlineContext): PaintCommand[] {
  const y = yOffsetMm + unit.topMm;
  const xCenter = x + lineWidthMm / 2;

  if (unit.kind === "TEXT" && unit.text.length > 0) {
    // TEXT is already one atom PER CHARACTER (Core's own composition), so
    // `unit.heightMm` already IS one cell's own height. `outlineContext` is
    // threaded here too (not just Ruby/Dash below) because the round-6
    // GSUB audit proved the unreachable-vertical-alternate problem is NOT
    // small-kana-specific — ordinary kana (つ/た, etc.) in normal body
    // text have the identical issue.
    return verticalGraphemeCommands(unit.text, xCenter, y, unit.heightMm, mmToPt(unit.heightMm), baselineRatio, outlineContext);
  }

  if (unit.kind === "RUBY" && unit.text.length > 0) {
    // BUG FIXED (Human Visual QA HOLD, oversized/"suspicious" glyphs): a
    // RUBY base atom carries its FULL string (e.g. "東京", 2 characters),
    // so `unit.heightMm` spans BOTH characters together — using it
    // directly as one glyph's own font size (as an earlier draft did)
    // painted every base character roughly 2x (or Nx, for an N-character
    // base) too large. The per-glyph font size must come from the
    // PER-CHARACTER height, not the whole run's own height.
    const baseGraphemeCount = Array.from(unit.text).length;
    const perCharFontSizePt = mmToPt(unit.heightMm / baseGraphemeCount);
    const commands = verticalGraphemeCommands(unit.text, xCenter, y, unit.heightMm, perCharFontSizePt, baselineRatio, outlineContext);
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
      commands.push(...verticalGraphemeCommands(ann.text, annotationX, y + ann.offsetMm, ann.extentMm, annotationFontSizePt, baselineRatio, outlineContext));
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
    // BUG FIXED (Human Visual QA HOLD round 1, "Dash appears suspicious"):
    // same whole-run-vs-per-character height bug as Ruby's base run above
    // — a 2-glyph "――" run's own `unit.heightMm` spans BOTH glyphs, so it
    // must be divided by the grapheme count before becoming a per-glyph
    // font size.
    //
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
    // unchanged — only the PAINT MECHANISM changed.
    const graphemeCount = Array.from(unit.text).length;
    const perCharFontSizePt = mmToPt(unit.heightMm / graphemeCount);
    return verticalGraphemeCommands(unit.text, xCenter, y, unit.heightMm, perCharFontSizePt, baselineRatio, outlineContext);
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
    // painting via "text", unchanged. Same whole-run-vs-per-character
    // font-size fix as Dash/Ruby above.
    const graphemeCount = Array.from(unit.text).length;
    const perCharFontSizePt = mmToPt(unit.heightMm / graphemeCount);
    return verticalGraphemeCommands(unit.text, xCenter, y, unit.heightMm, perCharFontSizePt, baselineRatio, outlineContext);
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
export function buildPaintPlan(doc: PublicationDocument, hasFont: boolean, pageGeometry?: PublicationPageGeometry, baselineRatio: number = FALLBACK_BASELINE_RATIO, outlineContext?: VerticalOutlineContext): PaintPlan {
  return doc.pages.map((page) => {
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
            commands.push(...unitCommands(unit, x, line.widthMm, yOffsetMm, baselineRatio, outlineContext));
          }
        }
      }
    }
    return {
      widthMm: pageGeometry?.paperWidthMm ?? page.widthMm,
      heightMm: pageGeometry?.paperHeightMm ?? page.heightMm,
      commands,
    };
  });
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
  const plan = buildPaintPlan(doc, !!fontResource, pageGeometry, baselineRatio, outlineContext);
  return renderPaintPlanToPdf(plan, fontResource);
}
