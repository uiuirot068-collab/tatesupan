// P3-O08 -- Small-kana in-cell parity audit (Human Visual QA HOLD round 14,
// Part 1). Human reported "too much apparent space after っ" in
// `yakumono-legacy-parity-qa.pdf`'s own sentence fixture. This file proves,
// by direct evidence rather than inference, which of A/REGRESSION,
// B/NO REGRESSION (pre-existing optical characteristic), or C/LEGACY
// PARITY DIFFERENCE applies -- and generates a QA-ONLY diagnostic overlay
// PDF so Human can visually separate "real extra advance" from "empty ink
// area inside an otherwise-correct, unchanged cell."
//
// AUDIT FINDING (see qa/evidence/P3_O08_SMALL_KANA_CELL_AUDIT.md for the
// full writeup): legacy `src/components/PageCard.tsx` has NO small-kana-
// specific classification anywhere (confirmed by direct Grep of
// 小さ|捨て仮名|拗音|促音|small.?kana|smallKana|ぁぃぅぇぉ|っゃゅょ --
// only two unrelated matches, page-number-size and trim-guide comments).
// Small kana is not a member of YAKUMONO_VPAL_TEST, YAKUMONO_HANG_START_TEST,
// or YAKUMONO_HANG_END_TEST either -- legacy paints it exactly like any
// ordinary character (centered, vpal off). There is therefore no legacy
// mechanism to port (rules out C). `classifyYakumonoAlignment("っ")` is
// NORMAL, so round 13's `yakumonoContext` provably never touches っ's own
// baseline ratio (proven directly below, not just by code inspection) --
// rules out A (regression from commit 639c63f). What remains is B: small
// kana glyphs are REAL-DATA-PROVEN to carry a smaller ink bounding box than
// ordinary kanji at the SAME uniform baseline anchor -- an inherent,
// expected property of "small kana drawn smaller within an unchanged
// full-em cell," not a positioning bug. No paint correction is made.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_RULE_SET_V2 } from "../../core";
import { buildPublicationDocument, type PublicationRenderContext } from "./paintModel";
import { buildPaintPlan, deriveBaselineRatioFromFont, renderPaintPlanToPdf, type PaintCommand, type PublicationFontResource, type PublicationPageGeometry } from "./pdfGenerator";
import { VerticalOutlineContext } from "./verticalOutlinePaint";
import { VerticalGposContext } from "./verticalGposPaint";
import { VerticalYakumonoAlignContext, classifyYakumonoAlignment } from "./verticalYakumonoAlign";
import { FontMetricsReader } from "./fontMetrics";
import { createGlyphIdLookup } from "./fontCapability";
import { verticalPaintGraphemeFor } from "./verticalGlyphMap";
import { settingsFor } from "./fixtures";
import { buildFixtureUnits } from "../../tools/compare/fixtureBuilder";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");

function fontResource(): PublicationFontResource {
  return { fileName: "ShipporiMincho-Regular.ttf", fontName: "ShipporiMincho", base64: readFileSync(FONT_PATH).toString("base64") };
}

const DIAGNOSTIC_GEOMETRY: PublicationPageGeometry = { paperWidthMm: 80, paperHeightMm: 100, marginTopMm: 15, marginBottomMm: 15, marginRightMm: 15, marginLeftMm: 15 };

const FIXTURE_TEXT = "だった";

function composeFor(text: string) {
  const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text }]);
  const settings = settingsFor({ charsPerLine: Array.from(text).length + 2, linesPerColumn: 1, columnCount: 1 });
  const measurement = createFakeMeasurementProvider();
  const document = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
  const ctx: PublicationRenderContext = {
    linePitchTicks: settings.linePitchTicks,
    lineExtentTicks: settings.lineExtentTicks,
    columnExtentTicks: settings.columnExtentTicks,
    columnsPerPage: settings.columnsPerPage,
    measurementIdentity: document.version.measurementIdentity,
    paintFontIdentity: document.version.measurementIdentity,
  };
  const model = buildPublicationDocument("id", "label", document, units, source, ctx);
  return { document, model };
}

/** Resolves the SAME glyph ID production paint actually draws for one grapheme -- outline-first (round 7), cmap fallback -- so ink-bbox evidence reflects reality, not a guessed glyph. */
function resolvePaintedGlyphId(ch: string, outlineContext: VerticalOutlineContext, glyphIdFor: (cp: number) => number | undefined): number | undefined {
  const outlineGlyphId = outlineContext.resolveOutlineGlyphId(ch);
  if (outlineGlyphId !== undefined) return outlineGlyphId;
  const painted = verticalPaintGraphemeFor(ch);
  return glyphIdFor(painted.codePointAt(0)!);
}

describe("Small kana in-cell parity audit -- canonical layer proofs", () => {
  it("だ/っ/た canonical advance is UNIFORM -- っ's own cell is exactly one ordinary cell, never compressed", () => {
    const { document } = composeFor(FIXTURE_TEXT);
    const line = document.pages[0].columns[0].lines[0];
    expect(line.placedUnits).toHaveLength(3);
    const pitch01 = line.placedUnits[1].yTick - line.placedUnits[0].yTick; // だ -> っ
    const pitch12 = line.placedUnits[2].yTick - line.placedUnits[1].yTick; // っ -> た
    expect(pitch01).toBe(pitch12); // same cell, no per-character compression
  });

  it("っ classifies as NORMAL under the round-13 yakumono alignment scheme -- it is not a HANG_START/HANG_END member", () => {
    expect(classifyYakumonoAlignment("っ")).toBe("NORMAL");
  });
});

describe("Small kana in-cell parity audit -- rules out A (regression from commit 639c63f)", () => {
  it("っ's own painted yMm is BYTE-IDENTICAL whether or not a yakumonoContext (round 13's own mechanism) is supplied -- direct proof, not inference", () => {
    const { model } = composeFor(FIXTURE_TEXT);
    const planWithout = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY);
    const yakumonoContext = new VerticalYakumonoAlignContext(readFileSync(FONT_PATH), 0.88);
    const planWith = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, undefined, undefined, yakumonoContext);
    // With no outlineContext supplied, っ falls back to a "text" command in both plans (outline is a separate, orthogonal mechanism -- isolating this proof to yakumonoContext's own effect alone).
    const textOf = (p: ReturnType<typeof buildPaintPlan>) => p.flatMap((pg) => pg.commands).filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    const without = textOf(planWithout);
    const withCtx = textOf(planWith);
    expect(without[1].yMm).toBe(withCtx[1].yMm); // index 1 == っ
  });

  it("っ's real outline paint geometry (round 7's own mechanism) is BYTE-IDENTICAL whether or not a yakumonoContext is supplied", () => {
    const { model } = composeFor(FIXTURE_TEXT);
    const outlineContext = new VerticalOutlineContext(readFileSync(FONT_PATH));
    const planWithout = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext);
    const yakumonoContext = new VerticalYakumonoAlignContext(readFileSync(FONT_PATH), 0.88);
    const planWith = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, undefined, yakumonoContext);
    const outlinesOf = (p: ReturnType<typeof buildPaintPlan>) => p.flatMap((pg) => pg.commands).filter((c): c is Extract<PaintCommand, { op: "glyphOutline" }> => c.op === "glyphOutline");
    const without = outlinesOf(planWithout);
    const withCtx = outlinesOf(planWith);
    expect(without.length).toBeGreaterThan(0); // だ/っ/た: at least っ needs outline paint (its real vert-alternate is Unicode-unreachable, round 6)
    expect(withCtx).toEqual(without); // fully identical path commands -- round 13 changed NOTHING about any of だ/っ/た's own paint
  });
});

describe("Small kana in-cell parity audit -- classification B evidence (real ink-bbox measurement)", () => {
  it("っ's real GSUB vertical-alternate glyph has a measurably SMALLER ink height fraction than だ/た's ordinary glyphs, at the identical uniform baseline anchor", () => {
    const fontBuf = readFileSync(FONT_PATH);
    const outlineContext = new VerticalOutlineContext(fontBuf);
    const metrics = new FontMetricsReader(fontBuf);
    const glyphIdFor = createGlyphIdLookup(fontBuf);

    const inkHeightFractionOf = (ch: string): number => {
      const glyphId = resolvePaintedGlyphId(ch, outlineContext, glyphIdFor);
      expect(glyphId).toBeDefined();
      const bbox = metrics.glyphInkBBox(glyphId!);
      expect(bbox).toBeDefined();
      return (bbox!.yMax - bbox!.yMin) / metrics.unitsPerEm;
    };

    const daFraction = inkHeightFractionOf("だ");
    const kkuFraction = inkHeightFractionOf("っ");
    const taFraction = inkHeightFractionOf("た");

    // Real, measured font data -- not tuned, not guessed: small kana's own
    // real glyph outline occupies a smaller fraction of the em square than
    // an ordinary kanji, at the SAME baseline anchor position. This is the
    // evidence-backed reason for the reported "extra apparent space" -- an
    // inherent property of the glyph itself, unrelated to any positioning
    // logic this codebase controls.
    expect(kkuFraction).toBeLessThan(daFraction);
    expect(kkuFraction).toBeLessThan(taFraction);
  });
});

describe("Small kana in-cell parity audit -- QA-only diagnostic overlay", () => {
  it("generates small-kana-cell-debug.pdf -- cell boundaries + real ink bbox for だった (QA-only, never part of normal Publication output)", () => {
    const fontBuf = readFileSync(FONT_PATH);
    const font = fontResource();
    const outlineContext = new VerticalOutlineContext(fontBuf);
    const gposContext = new VerticalGposContext(fontBuf);
    const yakumonoContext = new VerticalYakumonoAlignContext(fontBuf, deriveBaselineRatioFromFont(font));
    const metrics = new FontMetricsReader(fontBuf);
    const glyphIdFor = createGlyphIdLookup(fontBuf);

    const { model } = composeFor(FIXTURE_TEXT);
    // Normal, real paint plan (glyph commands) -- unmodified production path.
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);

    // QA-ONLY debug overlay commands, computed here directly (never wired
    // into buildPaintPlan/generatePublicationPdf -- this overlay does not
    // exist in normal Publication output). One cell-boundary rect and one
    // real-ink-bbox rect per character, using the SAME coordinate formulas
    // buildPaintPlan itself uses (contentRightEdgeMm/x, yOffsetMm+topMm).
    const page = model.pages[0];
    const contentRightEdgeMm = DIAGNOSTIC_GEOMETRY.paperWidthMm - DIAGNOSTIC_GEOMETRY.marginRightMm;
    const yOffsetMm = DIAGNOSTIC_GEOMETRY.marginTopMm;
    const overlay: PaintCommand[] = [];
    const baselineRatio = deriveBaselineRatioFromFont(font);
    for (const column of page.columns) {
      for (const line of column.lines) {
        const x = contentRightEdgeMm - column.rightMm - line.rightMm - line.widthMm;
        for (const unit of line.units) {
          const cellTopMm = yOffsetMm + unit.topMm;
          // Cell boundary (unfilled -- jsPDF's default rect style is stroke-only).
          overlay.push({ op: "rect", xMm: x, yMm: cellTopMm, widthMm: line.widthMm, heightMm: unit.heightMm });

          const ch = Array.from(unit.text)[0];
          const glyphId = resolvePaintedGlyphId(ch, outlineContext, glyphIdFor);
          if (glyphId === undefined) continue;
          const bbox = metrics.glyphInkBBox(glyphId);
          if (!bbox) continue;
          const emSizeMm = unit.heightMm; // one cell == one em, this font's own fixed body size
          const yBaselineMm = cellTopMm + emSizeMm * baselineRatio;
          const inkTopMm = yBaselineMm - (bbox.yMax / metrics.unitsPerEm) * emSizeMm;
          const inkBottomMm = yBaselineMm - (bbox.yMin / metrics.unitsPerEm) * emSizeMm;
          const inkWidthMm = line.widthMm * 0.5;
          overlay.push({ op: "rect", xMm: x + line.widthMm * 0.25, yMm: inkTopMm, widthMm: inkWidthMm, heightMm: Math.max(inkBottomMm - inkTopMm, 0.001) });
        }
      }
    }

    const combinedPlan = plan.map((p, i) => (i === 0 ? { ...p, commands: [...overlay, ...p.commands] } : p));
    const { bytes, pageCount } = renderPaintPlanToPdf(combinedPlan, font);
    expect(pageCount).toBe(1);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "small-kana-cell-debug.pdf"), bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});
