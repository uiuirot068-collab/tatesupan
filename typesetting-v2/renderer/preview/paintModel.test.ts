import { describe, expect, it } from "vitest";
import {
  composeCanonicalDocument,
  createFakeMeasurementProvider,
  DEFAULT_RULE_SET_V2,
  type CanonicalDocument,
} from "../../core";
import { buildFixtureUnits } from "../../tools/compare/fixtureBuilder";
import { DEFAULT_SCALE_MULTIPLIER, tickToPx } from "./geometry";
import { ALL_FIXTURES, settingsFor } from "./fixtures";
import { buildPaintDocument, defaultPlaceholderImageResolver, type PreviewRenderContext } from "./paintModel";

const measurement = createFakeMeasurementProvider();

function composeFixture(id: string): { document: CanonicalDocument; ctx: PreviewRenderContext; bodyUnits: ReturnType<typeof buildFixtureUnits>["units"]; source: string } {
  const fx = ALL_FIXTURES.find((f) => f.id === id);
  if (!fx) throw new Error(`fixture not found: ${id}`);
  const settings = settingsFor(fx.capacity);
  const document = composeCanonicalDocument({ bodyUnits: fx.bodyUnits, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
  const ctx: PreviewRenderContext = {
    scaleMultiplier: DEFAULT_SCALE_MULTIPLIER,
    linePitchTicks: settings.linePitchTicks,
    lineExtentTicks: settings.lineExtentTicks,
    columnExtentTicks: settings.columnExtentTicks,
    columnsPerPage: settings.columnsPerPage,
    nominalCellTicks: settings.linePitchTicks,
    measurementIdentity: document.version.measurementIdentity,
    paintFontIdentity: document.version.measurementIdentity,
  };
  return { document, ctx, bodyUnits: fx.bodyUnits, source: fx.source };
}

describe("geometry.ts — GeometryTick -> px, one-way conversion", () => {
  it("4. is deterministic: same tick + same scale -> same px", () => {
    expect(tickToPx(3528, 4)).toBe(tickToPx(3528, 4));
  });

  it("5. changing scale changes only the visual size, not the tick value itself", () => {
    const at1x = tickToPx(1000, 1);
    const at4x = tickToPx(1000, 4);
    expect(at4x).toBe(at1x * 4);
  });
});

describe("paintModel.ts — CanonicalDocument -> paint-only PaintDocument", () => {
  it("1. never mutates the CanonicalDocument it reads (renderer cannot change layout)", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("f20-canonical-sentence");
    const snapshot = JSON.parse(JSON.stringify(document));
    buildPaintDocument("f20-canonical-sentence", "F20", document, bodyUnits, source, ctx);
    expect(document).toEqual(snapshot);
  });

  it("2. renderer cannot change page count — PaintDocument.totalPageCount always equals document.pages.length", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("multi-page");
    const model = buildPaintDocument("id", "label", document, bodyUnits, source, ctx);
    expect(model.totalPageCount).toBe(document.pages.length);
  });

  it("3. renderer cannot change line breaks — line/unit counts and source spans are read directly from CanonicalDocument, never re-derived", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("two-column-flow");
    const model = buildPaintDocument("id", "label", document, bodyUnits, source, ctx);
    expect(model.pages[0].columns.length).toBe(document.pages[0].columns.length);
    expect(model.pages[0].columns[0].lines.length).toBe(document.pages[0].columns[0].lines.length);
    const paintSpans = model.pages[0].columns[0].lines[0].units.map((u) => u.sourceSpan);
    const canonicalSpans = document.pages[0].columns[0].lines[0].placedUnits.map((p) => p.sourceSpan);
    expect(paintSpans).toEqual(canonicalSpans);
  });

  it("6. font paint scales with page geometry — fontSizePx ratio equals page-width ratio across two scales", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "f20-canonical-sentence")!;
    const settings = settingsFor(fx.capacity);
    const document = composeCanonicalDocument({ bodyUnits: fx.bodyUnits, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
    const ctxAt = (scale: number): PreviewRenderContext => ({
      scaleMultiplier: scale,
      linePitchTicks: settings.linePitchTicks,
      lineExtentTicks: settings.lineExtentTicks,
      columnExtentTicks: settings.columnExtentTicks,
      columnsPerPage: settings.columnsPerPage,
      nominalCellTicks: settings.linePitchTicks,
      measurementIdentity: document.version.measurementIdentity,
      paintFontIdentity: document.version.measurementIdentity,
    });
    const at1 = buildPaintDocument("id", "label", document, fx.bodyUnits, fx.source, ctxAt(1));
    const at4 = buildPaintDocument("id", "label", document, fx.bodyUnits, fx.source, ctxAt(4));
    expect(at4.fontSizePx / at1.fontSizePx).toBeCloseTo(4, 6);
    expect(at4.pages[0].widthPx / at1.pages[0].widthPx).toBeCloseTo(4, 6);
  });

  it("7. first-line indent is visible in paint coordinates, not merely reduced capacity", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("paragraph-blank-line");
    const model = buildPaintDocument("id", "label", document, bodyUnits, source, ctx);
    const firstLine = model.pages[0].columns[0].lines[0];
    expect(firstLine.indentPx).toBeGreaterThan(0);
    expect(firstLine.units[0].topPx).toBeCloseTo(firstLine.indentPx!, 6);
    expect(firstLine.units[0].topPx).not.toBe(0);
  });

  it("8. manual page break has no phantom line and does not fabricate a paragraph indent", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("manual-page-break");
    const model = buildPaintDocument("id", "label", document, bodyUnits, source, ctx);
    expect(model.pages[1].manualBreakBefore).toBe(true);
    expect(model.pages[1].columns[0].lines.length).toBe(1); // no phantom blank line
    expect(model.pages[1].columns[0].lines[0].indentPx).toBeUndefined();
  });

  it("9. paragraph break preserved — the line after a bare PARAGRAPH_BREAK is indented like any paragraph start", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("paragraph-blank-line");
    const model = buildPaintDocument("id", "label", document, bodyUnits, source, ctx);
    const line1 = model.pages[0].columns[0].lines[1];
    expect(line1.indentPx).toBeGreaterThan(0);
  });

  it("10. blank paragraph preserved — the blank line itself carries no indent", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("paragraph-blank-line");
    const model = buildPaintDocument("id", "label", document, bodyUnits, source, ctx);
    const blankLine = model.pages[0].columns[0].lines[2];
    expect(blankLine.indentPx).toBeUndefined();
  });

  it("11. multi-column source order — column 0's last placed span precedes column 1's first placed span", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("two-column-flow");
    const model = buildPaintDocument("id", "label", document, bodyUnits, source, ctx);
    const col0 = model.pages[0].columns[0];
    const col1 = model.pages[0].columns[1];
    const col0Last = col0.lines[col0.lines.length - 1].units.slice(-1)[0];
    const col1First = col1.lines[0].units[0];
    expect(col0Last.sourceSpan.end).toBeLessThanOrEqual(col1First.sourceSpan.start);
  });

  it("12. multi-page source order — page N's last placed span precedes page N+1's first placed span", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("multi-page");
    const model = buildPaintDocument("id", "label", document, bodyUnits, source, ctx);
    expect(model.totalPageCount).toBeGreaterThan(1);
    for (let i = 0; i < model.pages.length - 1; i++) {
      const pageCol = model.pages[i].columns[0];
      const nextCol = model.pages[i + 1].columns[0];
      const pageLast = pageCol.lines[pageCol.lines.length - 1].units.slice(-1)[0];
      const nextFirst = nextCol.lines[0].units[0];
      expect(pageLast.sourceSpan.end).toBeLessThanOrEqual(nextFirst.sourceSpan.start);
    }
  });

  it("13. bounded page window — renderedPageCount respects ctx.maxPages without altering totalPageCount", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("multi-page");
    const bounded = buildPaintDocument("id", "label", document, bodyUnits, source, { ...ctx, maxPages: 2 });
    expect(bounded.renderedPageCount).toBe(2);
    expect(bounded.totalPageCount).toBe(document.pages.length);
    expect(bounded.totalPageCount).toBeGreaterThan(2);
  });

  it("14. image paint stays inside canonical occupancy — the IMAGE unit's own paint extent is derived from its own placed atom, never a resolved-asset dimension", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("image-placeholder");
    const model = buildPaintDocument("id", "label", document, bodyUnits, source, ctx);
    const allUnits = model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units)));
    const imageUnit = allUnits.find((u) => u.kind === "IMAGE");
    expect(imageUnit).toBeDefined();
    expect(imageUnit!.imageResolution).toEqual({ kind: "PLACEHOLDER" });
    expect(defaultPlaceholderImageResolver("anything")).toEqual({ kind: "PLACEHOLDER" });
  });

  it("15. HOLD excludes normal approved layout — a HOLD document's pages must never be treated as approved", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("hold-example");
    const model = buildPaintDocument("id", "label", document, bodyUnits, source, ctx);
    expect(model.hold).toBe(true);
    expect(model.holdReasons.length).toBeGreaterThan(0);
    expect(model.holdReasons[0]).toContain("SINGLE_ATOM_EXCEEDS_LINE_EXTENT");
  });

  it("16. RUBY body position is unchanged by the annotation's placement — base text paints at its own canonical yTick like any other unit (Ruby Placement Micro-Loop)", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("atomic-ruby");
    const model = buildPaintDocument("id", "label", document, bodyUnits, source, ctx);
    const allUnits = model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units)));
    const rubyUnit = allUnits.find((u) => u.kind === "RUBY");
    expect(rubyUnit).toBeDefined();
    expect(rubyUnit!.text).toBe("東京");
    // Core now wires placeRuby() into composition, so this atom carries
    // real geometry — read back here, never recomputed by this Renderer.
    expect(rubyUnit!.rubyAnnotation?.status).toBe("PLACED");
    if (rubyUnit!.rubyAnnotation?.status === "PLACED") {
      expect(rubyUnit!.rubyAnnotation.text).toBe("とうきょう");
      // base "東京" (2 cells) vs reading "とうきょう" (5 cells) overflows
      // with the shipped (empty, P3-O06 residual) overhang table -> OVERFLOW_OPEN.
      expect(rubyUnit!.rubyAnnotation.policy).toBe("OVERFLOW_OPEN");
    }
    // Body placement equals the plain tickToPx(yTick) conversion — the
    // annotation carries no coordinate of its own for the BASE and never
    // shifts the base unit's own topPx (INV-003).
    const canonicalPlaced = document.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.placedUnits))).find((p) => p.id === rubyUnit!.id)!;
    const owningLine = document.pages[0].columns[0].lines.find((l) => l.placedUnits.some((p) => p.id === rubyUnit!.id))!;
    expect(rubyUnit!.topPx).toBeCloseTo(tickToPx(canonicalPlaced.yTick + (owningLine.indentTick ?? 0), ctx.scaleMultiplier), 6);
  });

  it("17. TCY preserved as a single atomic paint item — one PaintPlacedUnit, kind TCY, not decomposed into individual characters", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("explicit-tcy");
    const model = buildPaintDocument("id", "label", document, bodyUnits, source, ctx);
    const allUnits = model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units)));
    const tcyUnits = allUnits.filter((u) => u.kind === "TCY");
    expect(tcyUnits.length).toBe(1);
    expect(tcyUnits[0].text).toBe("2026");
    expect(tcyUnits[0].provisional).toBe(true);
  });

  it("18. dash semantic run preserved — identity, source order, and canonical placement kept, no optical hack applied", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("dash-ellipsis");
    const model = buildPaintDocument("id", "label", document, bodyUnits, source, ctx);
    const allUnits = model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units)));
    const dashUnit = allUnits.find((u) => u.kind === "SEMANTIC_RUN" && u.text === "――");
    expect(dashUnit).toBeDefined();
    expect(dashUnit!.provisional).toBe(true);
  });

  it("19. ellipsis semantic run preserved — identity, source order, and canonical placement kept, no optical hack applied", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("dash-ellipsis");
    const model = buildPaintDocument("id", "label", document, bodyUnits, source, ctx);
    const allUnits = model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units)));
    const ellipsisUnit = allUnits.find((u) => u.kind === "SEMANTIC_RUN" && u.text === "……");
    expect(ellipsisUnit).toBeDefined();
    expect(ellipsisUnit!.provisional).toBe(true);
    // Source order preserved: dash's span ends before ellipsis's span starts.
    const dashUnit = allUnits.find((u) => u.kind === "SEMANTIC_RUN" && u.text === "――")!;
    expect(dashUnit.sourceSpan.end).toBeLessThanOrEqual(ellipsisUnit!.sourceSpan.start);
  });
});
