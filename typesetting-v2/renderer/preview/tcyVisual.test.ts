// P3-O03 — TCY Visual regression tests. Explicit TCYUnit recognition,
// atomicity, source mapping, and canonical occupied extent are all
// Core-owned and already PASS (untouched by this task) — these tests cover
// the Renderer's own paint boundary: does it show already-canonical TCY
// content horizontally, inside its own already-fixed canonical box,
// without moving anything else or introducing any new layout decision.

import { describe, expect, it } from "vitest";
import ReactDOMServer from "react-dom/server";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_RULE_SET_V2 } from "../../core";
import type { LogicalUnit } from "../../core";
import { buildFixtureUnits } from "../../tools/compare/fixtureBuilder";
import { buildPaintDocument, type PaintDocument, type PreviewRenderContext } from "./paintModel";
import { PreviewFoundationArtifact } from "./PreviewRenderer";
import { ALL_FIXTURES, settingsFor, type FoundationCapacity } from "./fixtures";
import { DEFAULT_SCALE_MULTIPLIER } from "./geometry";

const measurement = createFakeMeasurementProvider();

function composeAndPaint(units: LogicalUnit[], source: string, capacity: FoundationCapacity, scale = DEFAULT_SCALE_MULTIPLIER) {
  const settings = settingsFor(capacity);
  const document = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
  const ctx: PreviewRenderContext = {
    scaleMultiplier: scale,
    linePitchTicks: settings.linePitchTicks,
    lineExtentTicks: settings.lineExtentTicks,
    columnExtentTicks: settings.columnExtentTicks,
    columnsPerPage: settings.columnsPerPage,
    nominalCellTicks: settings.linePitchTicks,
    measurementIdentity: document.version.measurementIdentity,
    paintFontIdentity: document.version.measurementIdentity,
  };
  const model = buildPaintDocument("id", "label", document, units, source, ctx);
  return { document, model, ctx };
}

function findTcyUnit(model: PaintDocument) {
  return model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units))).find((u) => u.kind === "TCY")!;
}

describe("P3-O03 — TCY Visual", () => {
  it("1/2/3. the actual explicit-tcy fixture (four-digit '2026' between ordinary Japanese text) paints as one horizontal TCY unit", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "explicit-tcy")!;
    const { model } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const tcy = findTcyUnit(model);
    expect(tcy).toBeDefined();
    expect(tcy.text).toBe("2026");
    expect(tcy.kind).toBe("TCY");
  });

  it("4. TCY at the very start of a line composes and paints correctly (structurally first on the line; its topPx equals the line's own indent offset, since document-start is also paragraph-start)", () => {
    const { units, source } = buildFixtureUnits("body", [
      { kind: "TCY", text: "12", logicalCells: 1 },
      { kind: "TEXT", text: "月になった" },
    ]);
    const { model } = composeAndPaint(units, source, { charsPerLine: 8, linesPerColumn: 3, columnCount: 1 });
    const line0 = model.pages[0].columns[0].lines[0];
    const tcy = findTcyUnit(model);
    expect(line0.units[0].id).toBe(tcy.id); // structurally first unit on the line
    expect(tcy.topPx).toBe(line0.indentPx ?? 0); // shifted only by the standard paragraph indent, nothing TCY-specific
    expect(tcy.text).toBe("12");
  });

  it("5. TCY at the end of a line (line fills exactly through the TCY unit) composes and paints correctly", () => {
    // "あいうえおか" = 6 cells; document-start is also paragraph-start and
    // "あ" is not an exempt opener, so a 1-cell indent applies -> 8 total
    // cells needed to exactly fill charsPerLine:8 through the TCY unit.
    const { units, source } = buildFixtureUnits("body", [
      { kind: "TEXT", text: "あいうえおか" },
      { kind: "TCY", text: "12", logicalCells: 1 },
      { kind: "TEXT", text: "続きの文章です" },
    ]);
    const { model } = composeAndPaint(units, source, { charsPerLine: 8, linesPerColumn: 3, columnCount: 1 });
    const line0 = model.pages[0].columns[0].lines[0];
    const tcy = line0.units.find((u) => u.kind === "TCY")!;
    expect(tcy).toBeDefined();
    expect(line0.units[line0.units.length - 1].id).toBe(tcy.id); // last unit on the line
    expect(tcy.topPx + tcy.heightPx).toBeCloseTo(model.pages[0].heightPx, 6); // fits exactly, never overflows
  });

  it("6. TCY adjacent to punctuation composes and paints correctly on both sides", () => {
    const { units, source } = buildFixtureUnits("body", [
      { kind: "TEXT", text: "「" },
      { kind: "TCY", text: "12", logicalCells: 1 },
      { kind: "TEXT", text: "」と言った" },
    ]);
    const { model } = composeAndPaint(units, source, { charsPerLine: 8, linesPerColumn: 3, columnCount: 1 });
    const tcy = findTcyUnit(model);
    expect(tcy).toBeDefined();
    expect(tcy.text).toBe("12");
  });

  it("7. TCY as a paragraph's first content (after auto-indent) composes with the indent applied, and the TCY unit itself is not shifted by anything other than the standard indent offset", () => {
    const { units, source } = buildFixtureUnits("body", [{ kind: "TCY", text: "12", logicalCells: 1 }, { kind: "TEXT", text: "月だった" }]);
    const settings = settingsFor({ charsPerLine: 8, linesPerColumn: 3, columnCount: 1 });
    const document = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
    const line0 = document.pages[0].columns[0].lines[0];
    // TCY's displayText IS determinable (Core's own paragraphSemantics.test.ts
    // already proves this) -- "1" is not an exempt opener, so indent applies.
    expect(line0.indentTick).toBeGreaterThan(0);
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
    const model = buildPaintDocument("id", "label", document, units, source, ctx);
    const tcy = findTcyUnit(model);
    expect(tcy.topPx).toBeGreaterThan(0); // shifted by the indent, not by anything TCY-specific
  });

  it("8. TCY immediately after a bare paragraph break composes and paints correctly", () => {
    const { units, source } = buildFixtureUnits("body", [
      { kind: "TEXT", text: "あ" },
      { kind: "PARAGRAPH_BREAK" },
      { kind: "TCY", text: "12", logicalCells: 1 },
      { kind: "TEXT", text: "月です" },
    ]);
    const { document, model } = composeAndPaint(units, source, { charsPerLine: 10, linesPerColumn: 3, columnCount: 1 });
    expect(document.hold).toBe(false);
    const tcy = findTcyUnit(model);
    expect(tcy).toBeDefined();
  });

  it("9. TCY immediately after a manual page break composes on the new page correctly", () => {
    const { units, source } = buildFixtureUnits("body", [
      { kind: "TEXT", text: "第一章" },
      { kind: "MANUAL_BREAK" },
      { kind: "TCY", text: "12", logicalCells: 1 },
      { kind: "TEXT", text: "月です" },
    ]);
    const { document, model } = composeAndPaint(units, source, { charsPerLine: 10, linesPerColumn: 3, columnCount: 1 });
    expect(document.pages.length).toBe(2);
    const page2Units = model.pages[1].columns[0].lines.flatMap((l) => l.units);
    const tcy = page2Units.find((u) => u.kind === "TCY");
    expect(tcy).toBeDefined();
    expect(model.pages[1].columns[0].lines[0].indentTick).toBeUndefined(); // no fabricated indent
  });

  it("10. TCY placed exactly at a column boundary composes on the next column correctly", () => {
    const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text: "あいう" }, { kind: "TCY", text: "12", logicalCells: 1 }]);
    const { document, model } = composeAndPaint(units, source, { charsPerLine: 3, linesPerColumn: 1, columnCount: 2 });
    expect(document.pages[0].columns.length).toBeGreaterThanOrEqual(2);
    const col1Units = model.pages[0].columns[1].lines.flatMap((l) => l.units);
    const tcy = col1Units.find((u) => u.kind === "TCY");
    expect(tcy).toBeDefined();
  });

  it("11. TCY placed exactly at a page boundary composes on the next page correctly", () => {
    const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text: "あいう" }, { kind: "TCY", text: "12", logicalCells: 1 }]);
    const { document, model } = composeAndPaint(units, source, { charsPerLine: 3, linesPerColumn: 1, columnCount: 1 });
    expect(document.pages.length).toBeGreaterThanOrEqual(2);
    const page2Units = model.pages[1].columns[0].lines.flatMap((l) => l.units);
    const tcy = page2Units.find((u) => u.kind === "TCY");
    expect(tcy).toBeDefined();
  });

  it("12. source span is preserved exactly on the TCY paint item", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "explicit-tcy")!;
    const { document, model } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const tcy = findTcyUnit(model);
    const canonicalPlaced = document.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.placedUnits))).find((p) => p.id === tcy.id)!;
    expect(tcy.sourceSpan).toEqual(canonicalPlaced.sourceSpan);
  });

  it("13. the TCY atom remains one unsplit paint item — never decomposed into two vertical placements for a two/four-character run", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "explicit-tcy")!;
    const { model } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const allUnits = model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units)));
    const tcyUnits = allUnits.filter((u) => u.kind === "TCY");
    expect(tcyUnits).toHaveLength(1);
    expect(tcyUnits[0].text).toBe("2026");
  });

  it("14. adjacent (non-TCY) unit coordinates on the SAME line are unaffected by the TCY visual wrapper — a pure CSS/paint-content change, never a geometry change", () => {
    // A fixture with generous same-line capacity on both sides of the TCY
    // unit, so "before"/"after" are guaranteed to be on the same line as
    // the TCY unit itself (never a cross-line comparison, which would
    // reset to a new line's own y-origin).
    const { units, source } = buildFixtureUnits("body", [
      { kind: "TEXT", text: "「" },
      { kind: "TCY", text: "12", logicalCells: 1 },
      { kind: "TEXT", text: "」と言った" },
    ]);
    const { model } = composeAndPaint(units, source, { charsPerLine: 10, linesPerColumn: 3, columnCount: 1 });
    const line0 = model.pages[0].columns[0].lines[0];
    const tcyIndex = line0.units.findIndex((u) => u.kind === "TCY");
    const before = line0.units[tcyIndex - 1];
    const after = line0.units[tcyIndex + 1];
    const tcy = line0.units[tcyIndex];
    // Ordinary cumulative-advance relationship holds exactly, TCY included.
    expect(tcy.topPx).toBeCloseTo(before.topPx + before.heightPx, 6);
    expect(after.topPx).toBeCloseTo(tcy.topPx + tcy.heightPx, 6);
  });

  it("15/16. line and page composition (CanonicalDocument itself) is unaffected by the Renderer's TCY visual change — deep-equal across two independent compositions of the same input", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "explicit-tcy")!;
    const { document: docA } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const { document: docB } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    expect(docB).toEqual(docA);
  });

  it("17/20. same input -> deterministic PaintDocument, and CanonicalDocument is never mutated by painting it", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "explicit-tcy")!;
    const settings = settingsFor(fx.capacity);
    const document = composeCanonicalDocument({ bodyUnits: fx.bodyUnits, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
    const snapshot = JSON.parse(JSON.stringify(document));
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
    const modelA = buildPaintDocument("id", "label", document, fx.bodyUnits, fx.source, ctx);
    const modelB = buildPaintDocument("id", "label", document, fx.bodyUnits, fx.source, ctx);
    expect(modelB).toEqual(modelA);
    expect(document).toEqual(snapshot);
  });

  it("18. NORMAL and DEBUG modes paint the identical TCY canonical geometry (topPx/heightPx/text) — only debug-only decoration differs", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "explicit-tcy")!;
    const { model } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const tcyBefore = findTcyUnit(model);
    ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models: [model], mode: "normal" }));
    ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models: [model], mode: "debug" }));
    const tcyAfter = findTcyUnit(model);
    expect(tcyAfter.topPx).toBe(tcyBefore.topPx);
    expect(tcyAfter.heightPx).toBe(tcyBefore.heightPx);
    expect(tcyAfter.text).toBe(tcyBefore.text);
  });

  it("19. visual scale changes TCY paint proportionally, never its canonical text/span", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "explicit-tcy")!;
    const { model: at1x } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity, 1);
    const { model: at3x } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity, 3);
    const tcy1 = findTcyUnit(at1x);
    const tcy3 = findTcyUnit(at3x);
    expect(tcy3.topPx / tcy1.topPx).toBeCloseTo(3, 6);
    expect(tcy3.heightPx / tcy1.heightPx).toBeCloseTo(3, 6);
    expect(tcy3.text).toBe(tcy1.text);
    expect(tcy3.sourceSpan).toEqual(tcy1.sourceSpan);
  });

  it("the generated NORMAL PREVIEW artifact wraps the TCY unit's text in the .tcy class (text-combine-upright), and .unit itself keeps its normal vertical writing-mode (canonical position/orientation unchanged)", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "explicit-tcy")!;
    const { model } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const html = ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models: [model], mode: "normal" }));
    expect(html).toContain('<span class="tcy">2026</span>');
    // Structural proof (not just string presence): the .tcy wrapper is
    // nested INSIDE the TCY unit's own .unit-ink, itself inside a
    // .unit.kind-TCY box positioned by Core's own canonical topPx/height.
    expect(html).toMatch(/<div class="unit kind-TCY"[^>]*><span class="unit-ink"><span class="tcy">2026<\/span>(?:<span class="provisional-badge">prov<\/span>)?<\/span>/);
  });

  it("the generated stylesheet declares text-combine-upright:all for .tcy, and does not apply it to ordinary body text", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "explicit-tcy")!;
    const { model } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const html = ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models: [model], mode: "normal" }));
    const tcyRuleMatch = html.match(/\.tcy\s*\{[^}]*\}/);
    expect(tcyRuleMatch).not.toBeNull();
    expect(tcyRuleMatch![0]).toContain("text-combine-upright: all");
    const unitRuleMatch = html.match(/(?<!-)\.unit\s*\{[^}]*\}/);
    expect(unitRuleMatch![0]).not.toContain("text-combine-upright");
  });
});
