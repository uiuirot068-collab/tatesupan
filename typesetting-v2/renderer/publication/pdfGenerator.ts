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

export type PaintCommand =
  | { op: "text"; text: string; xMm: number; yMm: number; fontSizePt: number; align: "left" | "center"; angle?: number; baseline?: "alphabetic" | "middle"; maxWidthMm?: number }
  | { op: "rect"; xMm: number; yMm: number; widthMm: number; heightMm: number };

export interface PaintPagePlan {
  widthMm: number;
  heightMm: number;
  commands: PaintCommand[];
}

export type PaintPlan = PaintPagePlan[];

// Approximates a CJK font's baseline as a fixed fraction of its own em-box
// height, since no real per-glyph baseline metric is consumed anywhere in
// this Core (Natural Pitch is declared-size-based by frozen contract — see
// qa/evidence/P3_O08_REAL_MEASUREMENT_FACTS.md §2/§6). Disclosed
// approximation, never affects a cell's own position/extent.
const BASELINE_RATIO = 0.88;

// P3-O04's own Human-selected value (qa/evidence/P3_O04_DASH_VISUAL.md §19):
// re-derived independently here for vector mm coordinates, never imported
// from `renderer/preview/` (Publication and Preview are sibling consumers,
// never dependents of each other).
const DASH_OVERLAP_EM = 0.16;

// Preview's own already-Human-approved ruby annotation font-size ratio
// (`renderer/preview/PreviewRenderer.tsx`'s `.ruby-annotation { font-size:
// 0.55em; }`) — a Renderer-only PAINT-TIME sizing choice, independent of
// the canonical `rubyReadingExtentTick`'s own body-font-size-based
// magnitude (see qa/evidence/P3_O08_PUBLICATION_TYPOGRAPHY.md §7's Ruby
// Scale Observation: this is classified a paint-only choice, not a
// canonical measurement gap — the canonical extent defines RESERVED SPACE,
// which the Renderer is free to fill with smaller text, exactly as Preview
// already does). Re-derived independently for vector paint, same ratio.
const RUBY_ANNOTATION_FONT_RATIO = 0.55;

function verticalGraphemeCommands(text: string, xCenterMm: number, topMm: number, totalHeightMm: number, fontSizePt: number): PaintCommand[] {
  const graphemes = Array.from(text);
  if (graphemes.length === 0) return [];
  const perCharHeightMm = totalHeightMm / graphemes.length;
  return graphemes.map((ch, i) => ({
    op: "text" as const,
    text: ch,
    xMm: xCenterMm,
    yMm: topMm + i * perCharHeightMm + perCharHeightMm * BASELINE_RATIO,
    fontSizePt,
    align: "center" as const,
  }));
}

// Dash's own P3-O04 seam-continuity paint: one glyph per grapheme,
// consecutive glyphs overlapping by DASH_OVERLAP_EM (relative to the body
// line-pitch font size) so a shared canonical run reads as one unbroken
// line — same algorithm as Preview's `dashGlyphsFor`
// (renderer/preview/paintModel.ts), re-derived in physical mm instead of
// px. First glyph's own top and the last glyph's own bottom still span the
// full canonical run extent exactly — the run is never shortened.
function dashGlyphCommands(text: string, xCenterMm: number, topMm: number, totalHeightMm: number, fontSizePt: number): PaintCommand[] {
  const graphemes = Array.from(text);
  const n = graphemes.length;
  if (n === 0) return [];
  if (n === 1) {
    return [{ op: "text", text: graphemes[0], xMm: xCenterMm, yMm: topMm + totalHeightMm * BASELINE_RATIO, fontSizePt, align: "center" }];
  }
  const overlapMm = DASH_OVERLAP_EM * (fontSizePt * (25.4 / 72));
  const nominalGlyphHeightMm = totalHeightMm / n;
  return graphemes.map((ch, i) => {
    const isFirst = i === 0;
    const isLast = i === n - 1;
    const top = i * nominalGlyphHeightMm - (isFirst ? 0 : overlapMm / 2);
    const extra = (isFirst ? 0 : overlapMm / 2) + (isLast ? 0 : overlapMm / 2);
    const glyphHeight = nominalGlyphHeightMm + extra;
    return { op: "text" as const, text: ch, xMm: xCenterMm, yMm: topMm + top + glyphHeight * BASELINE_RATIO, fontSizePt, align: "center" as const };
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

function unitCommands(unit: PaintPlacedUnit, x: number, lineWidthMm: number): PaintCommand[] {
  const y = unit.topMm;
  const xCenter = x + lineWidthMm / 2;

  if (unit.kind === "TEXT" && unit.text.length > 0) {
    // TEXT is already one atom PER CHARACTER (Core's own composition), so
    // `unit.heightMm` already IS one cell's own height.
    return verticalGraphemeCommands(unit.text, xCenter, y, unit.heightMm, mmToPt(unit.heightMm));
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
    const commands = verticalGraphemeCommands(unit.text, xCenter, y, unit.heightMm, perCharFontSizePt);
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
      commands.push(...verticalGraphemeCommands(ann.text, annotationX, y + ann.offsetMm, ann.extentMm, annotationFontSizePt));
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
    // BUG FIXED (Human Visual QA HOLD, "Dash appears suspicious"): same
    // whole-run-vs-per-character height bug as Ruby's base run above — a
    // 2-glyph "――" run's own `unit.heightMm` spans BOTH glyphs, so it must
    // be divided by the grapheme count before becoming a per-glyph font
    // size.
    const graphemeCount = Array.from(unit.text).length;
    const perCharFontSizePt = mmToPt(unit.heightMm / graphemeCount);
    return dashGlyphCommands(unit.text, xCenter, y, unit.heightMm, perCharFontSizePt);
  }

  if (unit.kind === "SEMANTIC_RUN" && unit.semanticRunKind === "ELLIPSIS" && unit.text.length > 0) {
    // Native glyph, no special correction — matches P3-O05's own Preview
    // conclusion (no seam-continuity problem exists for a discrete
    // dot-cluster glyph). NEVER apply Dash's own overlap treatment here.
    // Same whole-run-vs-per-character fix as Dash/Ruby above.
    const graphemeCount = Array.from(unit.text).length;
    const perCharFontSizePt = mmToPt(unit.heightMm / graphemeCount);
    return verticalGraphemeCommands(unit.text, xCenter, y, unit.heightMm, perCharFontSizePt);
  }

  // IMAGE, and any other kind without real paint text yet: unchanged
  // vector-rectangle placeholder.
  return [{ op: "rect", xMm: x, yMm: y, widthMm: lineWidthMm, heightMm: unit.heightMm }];
}

// Pure, jsPDF-free: PublicationDocument -> a plain-data paint plan. This is
// what every typography regression test asserts against directly.
export function buildPaintPlan(doc: PublicationDocument, hasFont: boolean): PaintPlan {
  return doc.pages.map((page) => {
    const commands: PaintCommand[] = [];
    for (const column of page.columns) {
      for (const line of column.lines) {
        for (const unit of line.units) {
          if (unit.kind === "UNKNOWN") continue;
          // vertical-rl physical placement: a "line" is one vertical strip,
          // offset from the page's right edge by `column.rightMm + line.rightMm`;
          // a unit's own topMm is its offset down that strip.
          const x = page.widthMm - column.rightMm - line.rightMm - line.widthMm;
          if (!hasFont) {
            commands.push({ op: "rect", xMm: x, yMm: unit.topMm, widthMm: line.widthMm, heightMm: unit.heightMm });
          } else {
            commands.push(...unitCommands(unit, x, line.widthMm));
          }
        }
      }
    }
    return { widthMm: page.widthMm, heightMm: page.heightMm, commands };
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
    for (const cmd of page.commands) {
      if (cmd.op === "rect") {
        pdf.rect(cmd.xMm, cmd.yMm, cmd.widthMm, cmd.heightMm);
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
export function generatePublicationPdf(doc: PublicationDocument, fontResource?: PublicationFontResource): PublicationPdfResult {
  if (doc.hold) {
    throw new Error(`generatePublicationPdf: refusing to emit a Publication PDF for a HOLD document (${doc.holdReasons.join("; ")})`);
  }
  const plan = buildPaintPlan(doc, !!fontResource);
  return renderPaintPlanToPdf(plan, fontResource);
}
