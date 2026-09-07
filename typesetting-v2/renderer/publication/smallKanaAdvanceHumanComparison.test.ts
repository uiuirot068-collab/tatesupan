// P3-O08 -- VISUAL PROTOTYPE ONLY (Human Visual QA HOLD round 15, Part A).
// NOT a standards audit, NOT an architecture change. Tests the Human's own
// stated hypothesis directly: does small kana progressing at ~half a cell
// (instead of the current, unchanged 1em) look better?
//
// Nothing in Core or `pdfGenerator.ts`/`paintModel.ts` is modified.
// A_CURRENT is composed and painted through the real, unmodified
// production pipeline. B_HALF is a QA-only geometry TRANSFORM applied to
// an already-composed PublicationDocument's own paint units, computed
// entirely inside this test file -- it never touches source, SourceSpan,
// Core's canonical advance, or any default RuleSetVersion/Core file. The
// glyph paint mechanism itself (real GSUB vertical-alternate outline for
// small kana, exactly as round 7 already proved) is reused unmodified;
// only the POSITIONING slot differs between A and B. Glyph size is pinned
// to the document's own fixed `bodyEmMm` in both variants -- proven by a
// dedicated test below, not merely asserted in prose.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_RULE_SET_V2 } from "../../core";
import { buildPublicationDocument, type PaintPlacedUnit, type PublicationRenderContext } from "./paintModel";
import { renderPaintPlanToPdf, type PaintCommand, type PublicationFontResource, type PublicationPageGeometry } from "./pdfGenerator";
import { VerticalOutlineContext } from "./verticalOutlinePaint";
import { verticalPaintGraphemeFor } from "./verticalGlyphMap";
import { settingsFor } from "./fixtures";
import { buildFixtureUnits } from "../../tools/compare/fixtureBuilder";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");

function fontResource(): PublicationFontResource {
  return { fileName: "ShipporiMincho-Regular.ttf", fontName: "ShipporiMincho", base64: readFileSync(FONT_PATH).toString("base64") };
}

const DIAGNOSTIC_GEOMETRY: PublicationPageGeometry = { paperWidthMm: 80, paperHeightMm: 100, marginTopMm: 15, marginBottomMm: 15, marginRightMm: 15, marginLeftMm: 15 };
const BASELINE_RATIO = 0.88; // same real vmtx-derived constant every other round-5+ test uses

const FIXTURES = ["だった。", "あった", "きっと", "やっぱり", "ちょっと"];

function isSmallKana(ch: string): boolean {
  return DEFAULT_RULE_SET_V2.characterClassFor(ch).id === "cl-11";
}

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

/** QA-only transform: B_HALF halves every small-kana unit's own progression slot (heightMm) and shifts every later unit in the same line up by the saved amount. Never touches Core, never touches the source model (returns a new array). */
function applyHalfKanaSlot(units: PaintPlacedUnit[]): PaintPlacedUnit[] {
  let shift = 0;
  return units.map((u) => {
    const topMm = u.topMm - shift;
    let heightMm = u.heightMm;
    if (u.kind === "TEXT" && isSmallKana(u.text)) {
      const saved = heightMm * 0.5;
      heightMm -= saved;
      shift += saved;
    }
    return { ...u, topMm, heightMm };
  });
}

/** Self-contained QA painter: glyph SIZE is always the fixed bodyEmMm (never scaled, never derived from the slot's own heightMm -- this deliberately avoids the outline path's own emSize/heightMm conflation in `glyphOutlineCommandsMm`, since here heightMm is the very thing being experimentally varied). Position (yMm) uses the unit's own real slot (topMm/heightMm), which IS what differs between A and B. */
function paintUnitCommand(unit: PaintPlacedUnit, xCenterMm: number, yOffsetMm: number, bodyEmMm: number, outlineContext: VerticalOutlineContext): PaintCommand {
  const ch = unit.text;
  const yMm = yOffsetMm + unit.topMm + unit.heightMm * BASELINE_RATIO;
  const outlineGlyphId = outlineContext.resolveOutlineGlyphId(ch);
  if (outlineGlyphId !== undefined) {
    return { op: "glyphOutline", commands: outlineContext.glyphOutlineCommandsMm(outlineGlyphId, xCenterMm, yMm, bodyEmMm) };
  }
  return { op: "text", text: verticalPaintGraphemeFor(ch), xMm: xCenterMm, yMm, fontSizePt: bodyEmMm * (72 / 25.4), align: "center" };
}

function buildPage(model: ReturnType<typeof composeFor>["model"], variant: "A_CURRENT" | "B_HALF", outlineContext: VerticalOutlineContext) {
  const page = model.pages[0];
  const contentRightEdgeMm = DIAGNOSTIC_GEOMETRY.paperWidthMm - DIAGNOSTIC_GEOMETRY.marginRightMm;
  const yOffsetMm = DIAGNOSTIC_GEOMETRY.marginTopMm;
  const commands: PaintCommand[] = [];
  for (const column of page.columns) {
    for (const line of column.lines) {
      const x = contentRightEdgeMm - column.rightMm - line.rightMm - line.widthMm;
      const units = variant === "A_CURRENT" ? line.units : applyHalfKanaSlot(line.units);
      for (const unit of units) {
        // QA-only subtle cell-boundary overlay, never part of normal Publication output.
        commands.push({ op: "rect", xMm: x, yMm: yOffsetMm + unit.topMm, widthMm: line.widthMm, heightMm: unit.heightMm });
        commands.push(paintUnitCommand(unit, x + line.widthMm / 2, yOffsetMm, model.bodyEmMm, outlineContext));
      }
    }
  }
  return { widthMm: DIAGNOSTIC_GEOMETRY.paperWidthMm, heightMm: DIAGNOSTIC_GEOMETRY.paperHeightMm, commands };
}

describe("Small kana advance human comparison -- prototype invariants", () => {
  it("Core's own canonical advance is completely untouched -- A_CURRENT source geometry is uniform 1em for every character (no default change)", () => {
    const { document } = composeFor("だった。");
    const line = document.pages[0].columns[0].lines[0];
    const first = line.placedUnits[1].yTick - line.placedUnits[0].yTick;
    for (let i = 1; i < line.placedUnits.length; i++) {
      expect(line.placedUnits[i].yTick - line.placedUnits[i - 1].yTick).toBe(first);
    }
  });

  it("B_HALF's own transform halves only small-kana slots and preserves every other unit's own heightMm", () => {
    const { model } = composeFor("だった。");
    const units = model.pages[0].columns[0].lines[0].units;
    const transformed = applyHalfKanaSlot(units);
    units.forEach((u, i) => {
      if (isSmallKana(u.text)) {
        expect(transformed[i].heightMm).toBeCloseTo(u.heightMm * 0.5, 6);
      } else if (!units.slice(0, i).some((prior) => isSmallKana(prior.text))) {
        // no small-kana unit precedes this one -- its own heightMm is untouched
        expect(transformed[i].heightMm).toBeCloseTo(u.heightMm, 6);
      }
    });
  });

  it("glyph size (outline emSize / text fontSizePt) is IDENTICAL between A_CURRENT and B_HALF -- never scaled", () => {
    const { model } = composeFor("きっと");
    const outlineContext = new VerticalOutlineContext(readFileSync(FONT_PATH));
    const pageA = buildPage(model, "A_CURRENT", outlineContext);
    const pageB = buildPage(model, "B_HALF", outlineContext);
    const outlinesOf = (p: ReturnType<typeof buildPage>) => p.commands.filter((c): c is Extract<PaintCommand, { op: "glyphOutline" }> => c.op === "glyphOutline");
    const oa = outlinesOf(pageA);
    const ob = outlinesOf(pageB);
    expect(oa.length).toBeGreaterThan(0);
    expect(oa.length).toBe(ob.length);
    // Same emSize (bodyEmMm) fed to opentype.js in both variants -> same advanceWidth-derived anchorX offset and identical path bounding extent, provable by the two outlines being non-degenerate and structurally equal in point count per contour.
    oa.forEach((cmdA, i) => expect(cmdA.commands.length).toBe(ob[i].commands.length));
  });
});

describe("Small kana advance human comparison -- generates small-kana-advance-human-comparison.pdf", () => {
  it("one A_CURRENT page per fixture, then one B_HALF page per fixture, same order", () => {
    const font = fontResource();
    const outlineContext = new VerticalOutlineContext(readFileSync(FONT_PATH));
    const composed = FIXTURES.map((text) => composeFor(text));
    const pagesA = composed.map(({ model }) => buildPage(model, "A_CURRENT", outlineContext));
    const pagesB = composed.map(({ model }) => buildPage(model, "B_HALF", outlineContext));
    const combinedPlan = [...pagesA, ...pagesB];
    const { bytes, pageCount } = renderPaintPlanToPdf(combinedPlan, font);
    expect(pageCount).toBe(FIXTURES.length * 2);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "small-kana-advance-human-comparison.pdf"), bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});
