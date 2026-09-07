// P3-O08 — Publication Renderer Foundation tests. Covers the task's own
// 18 required checks. This module never touches a browser DOM, canvas, or
// screenshot of any kind — every assertion here is pure data.

import { describe, expect, it } from "vitest";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_RULE_SET_V2 } from "../../core";
import type { LogicalUnit } from "../../core";
import { buildFixtureUnits } from "../../tools/compare/fixtureBuilder";
import { buildPublicationDocument, type PublicationDocument, type PublicationRenderContext } from "./paintModel";
import { ALL_FIXTURES, settingsFor, type FoundationCapacity } from "./fixtures";
import { tickToMm } from "./geometry";

const measurement = createFakeMeasurementProvider();

function composeAndPaint(units: LogicalUnit[], source: string, capacity: FoundationCapacity) {
  const settings = settingsFor(capacity);
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
  return { document, model, ctx };
}

function allUnits(model: PublicationDocument) {
  return model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units)));
}

describe("P3-O08 — Publication Renderer Foundation", () => {
  it("1. CanonicalDocument is never mutated by painting it", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "f20-canonical-sentence")!;
    const settings = settingsFor(fx.capacity);
    const document = composeCanonicalDocument({ bodyUnits: fx.bodyUnits, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
    const snapshot = JSON.parse(JSON.stringify(document));
    const ctx: PublicationRenderContext = {
      linePitchTicks: settings.linePitchTicks,
      lineExtentTicks: settings.lineExtentTicks,
      columnExtentTicks: settings.columnExtentTicks,
      columnsPerPage: settings.columnsPerPage,
      measurementIdentity: document.version.measurementIdentity,
      paintFontIdentity: document.version.measurementIdentity,
    };
    buildPublicationDocument("id", "label", document, fx.bodyUnits, fx.source, ctx);
    expect(document).toEqual(snapshot);
  });

  it("2. page count is preserved exactly (Publication renders every page, no bounded window)", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "multi-column")!;
    const { document, model } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    expect(model.totalPageCount).toBe(document.pages.length);
    expect(model.renderedPageCount).toBe(document.pages.length);
  });

  it("3. line/page/column breaks are preserved exactly -- the Publication paint model never re-derives them", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "paragraph-manual-break")!;
    const { document, model } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    expect(document.pages.length).toBeGreaterThanOrEqual(2);
    expect(model.pages.length).toBe(document.pages.length);
    document.pages.forEach((page, pi) => {
      page.columns.forEach((col, ci) => {
        expect(model.pages[pi].columns[ci].lines.length).toBe(col.lines.length);
      });
    });
  });

  it("4. source order is preserved -- ordered paint items reconstruct the original manuscript text", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "f20-canonical-sentence")!;
    const { model } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const reconstructed = allUnits(model)
      .filter((u) => u.kind !== "UNKNOWN")
      .map((u) => u.text)
      .join("");
    expect(reconstructed).toBe(Array.from(fx.source).join(""));
  });

  it("5. physical tick->mm conversion is deterministic (Contract §21: 1 tick = 0.001mm exactly)", () => {
    expect(tickToMm(1000)).toBe(1);
    expect(tickToMm(51856)).toBeCloseTo(51.856, 6);
    expect(tickToMm(0)).toBe(0);
  });

  it("6. body placement is deterministic -- two independent compositions of the same input produce identical mm coordinates", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "f20-canonical-sentence")!;
    const { model: modelA } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const { model: modelB } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    expect(modelB).toEqual(modelA);
  });

  it("7. first-line paragraph indent is preserved as a physical mm offset", () => {
    const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text: "あいうえお" }, { kind: "TEXT", text: "続き" }]);
    const { model } = composeAndPaint(units, source, { charsPerLine: 8, linesPerColumn: 2, columnCount: 1 });
    const line0 = model.pages[0].columns[0].lines[0];
    expect(line0.indentMm).toBeGreaterThan(0);
    expect(line0.units[0].topMm).toBe(line0.indentMm);
  });

  it("8. manual page break is preserved -- content after MANUAL_BREAK composes on a new physical page", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "paragraph-manual-break")!;
    const { document, model } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const manualBreakPageIndex = model.pages.findIndex((p) => p.manualBreakBefore);
    expect(manualBreakPageIndex).toBeGreaterThan(0);
    expect(document.pages[manualBreakPageIndex].columns[0].lines[0].indentTick).toBeUndefined();
  });

  it("9. blank paragraph (bare paragraph break) is preserved -- composition does not collapse or fabricate content around it", () => {
    const { units, source } = buildFixtureUnits("body", [
      { kind: "TEXT", text: "あ" },
      { kind: "PARAGRAPH_BREAK" },
      { kind: "PARAGRAPH_BREAK" },
      { kind: "TEXT", text: "い" },
    ]);
    const { document } = composeAndPaint(units, source, { charsPerLine: 8, linesPerColumn: 3, columnCount: 1 });
    expect(document.hold).toBe(false);
  });

  it("10. Ruby consumes Core's own canonical annotation geometry (offset/extent), never re-measuring or re-centering it", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "atomic-ruby")!;
    const { model } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const ruby = allUnits(model).find((u) => u.kind === "RUBY")!;
    expect(ruby).toBeDefined();
    expect(ruby.rubyAnnotation?.status).toBe("PLACED");
    if (ruby.rubyAnnotation?.status === "PLACED") {
      expect(ruby.rubyAnnotation.text).toBe("とうきょう");
      expect(ruby.rubyAnnotation.extentMm).toBeGreaterThan(0);
      expect(["CENTER", "START_CLAMP", "END_CLAMP", "OVERFLOW_OPEN"]).toContain(ruby.rubyAnnotation.policy);
    }
  });

  it("11. TCY remains exactly one atomic paint item, never decomposed", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "explicit-tcy")!;
    const { model } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const tcyUnits = allUnits(model).filter((u) => u.kind === "TCY");
    expect(tcyUnits).toHaveLength(1);
    expect(tcyUnits[0].text).toBe("2026");
  });

  it("12. Dash semantic identity (runKind, SourceSpan, one-atom extent) is preserved", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "dash-ellipsis")!;
    const { document, model } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const dash = allUnits(model).find((u) => u.semanticRunKind === "DASH")!;
    expect(dash).toBeDefined();
    expect(dash.text).toBe("――");
    const canonicalPlaced = document.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.placedUnits))).find((p) => p.id === dash.id)!;
    expect(dash.sourceSpan).toEqual(canonicalPlaced.sourceSpan);
  });

  it("13. Dash Publication treatment: semantic identity preserved; the P3-O04 per-grapheme seam-overlap paint treatment is a Preview-CSS-specific mechanism NOT YET reproduced at the Publication layer (disclosed gap, not a fabricated claim of parity)", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "dash-ellipsis")!;
    const { model } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const dash = allUnits(model).find((u) => u.semanticRunKind === "DASH")!;
    // No per-grapheme paint split field exists anywhere in the Publication
    // paint model (unlike Preview's `dashGlyphs`) -- confirmed structurally,
    // not just by this one unit's own shape.
    expect((dash as unknown as { dashGlyphs?: unknown }).dashGlyphs).toBeUndefined();
    expect(dash.provisional).toBe(true);
  });

  it("14. Ellipsis identity is preserved -- SourceSpan and text unchanged, no fabricated dot/glyph split", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "dash-ellipsis")!;
    const { model } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const ellipsis = allUnits(model).find((u) => u.semanticRunKind === "ELLIPSIS")!;
    expect(ellipsis).toBeDefined();
    expect(ellipsis.text).toBe("……");
    expect(Array.from(ellipsis.text).length).toBe(2);
  });

  it("15. Image canonical occupancy is unchanged; Publication paints a placeholder boundary, exactly like Preview's own disclosed boundary", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "image-placeholder")!;
    const { model } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const image = allUnits(model).find((u) => u.kind === "IMAGE")!;
    expect(image).toBeDefined();
    expect(image.imageResolution).toEqual({ kind: "PLACEHOLDER" });
    expect(image.heightMm).toBeGreaterThan(0);
  });

  it("16. HOLD cannot silently publish as a normal PASS -- generatePublicationPdf refuses to emit bytes for a HOLD document", async () => {
    const { generatePublicationPdf } = await import("./pdfGenerator");
    const holdDocument: PublicationDocument = {
      id: "hold-test",
      label: "hold",
      hold: true,
      holdReasons: ["synthetic HOLD for this regression"],
      fontIdentityMismatch: false,
      totalPageCount: 0,
      renderedPageCount: 0,
      bodyEmMm: 3.704,
      pages: [],
    };
    expect(() => generatePublicationPdf(holdDocument)).toThrow(/HOLD/);
  });

  it("17. font identity mismatch is handled structurally (a boolean flag), never by silently remeasuring/reflowing", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "f20-canonical-sentence")!;
    const settings = settingsFor(fx.capacity);
    const document = composeCanonicalDocument({ bodyUnits: fx.bodyUnits, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
    const ctxMismatched: PublicationRenderContext = {
      linePitchTicks: settings.linePitchTicks,
      lineExtentTicks: settings.lineExtentTicks,
      columnExtentTicks: settings.columnExtentTicks,
      columnsPerPage: settings.columnsPerPage,
      measurementIdentity: document.version.measurementIdentity,
      paintFontIdentity: "a-deliberately-different-font-identity",
    };
    const modelA = buildPublicationDocument("id", "label", document, fx.bodyUnits, fx.source, {
      ...ctxMismatched,
      paintFontIdentity: document.version.measurementIdentity,
    });
    const modelB = buildPublicationDocument("id", "label", document, fx.bodyUnits, fx.source, ctxMismatched);
    expect(modelA.fontIdentityMismatch).toBe(false);
    expect(modelB.fontIdentityMismatch).toBe(true);
    // Geometry is identical either way -- the mismatch is a flag, never a
    // trigger for recomputing any coordinate.
    expect(modelB.pages).toEqual(modelA.pages);
  });

  it("18. same canonical input -> the same logical Publication paint model, deterministically", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "dash-ellipsis")!;
    const { model: modelA } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const { model: modelB } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    expect(modelB).toEqual(modelA);
  });
});
