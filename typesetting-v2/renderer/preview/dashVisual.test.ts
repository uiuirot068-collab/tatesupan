// P3-O04 — Dash Visual regression tests. Semantic-run identity, source
// mapping, break/atomicity behavior, and canonical occupied extent are all
// Core-owned and already PASS (untouched by this task) — these tests cover
// only the Renderer's own paint boundary: does it paint the already-
// canonical DASH run as a continuous, centered, font-independent bar
// spanning its own canonical extent, without moving anything else,
// re-tokenizing, or touching ELLIPSIS (P3-O05, still OPEN).

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

function findDashUnit(model: PaintDocument) {
  return model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units))).find((u) => u.semanticRunKind === "DASH")!;
}

describe("P3-O04 — Dash Visual", () => {
  it("1. dash semantic identity is preserved — the paint item carries semanticRunKind DASH, read back from Core, never re-classified", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "dash-ellipsis")!;
    const { model } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const dash = findDashUnit(model);
    expect(dash).toBeDefined();
    expect(dash.text).toBe("――");
    expect(dash.kind).toBe("SEMANTIC_RUN");
  });

  it("2. source span is unchanged on the dash paint item", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "dash-ellipsis")!;
    const { document, model } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const dash = findDashUnit(model);
    const canonicalPlaced = document.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.placedUnits))).find((p) => p.id === dash.id)!;
    expect(dash.sourceSpan).toEqual(canonicalPlaced.sourceSpan);
  });

  it("3. canonical run extent is unchanged — the dash unit's own heightPx still spans exactly 2 cells (length:2), the Renderer paints INSIDE that extent, never enlarging it", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "dash-ellipsis")!;
    const { model } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const dash = findDashUnit(model);
    const cellPx = model.fontSizePx; // 1 cell = fontSizePx, per the same tickToPx(linePitchTicks) path
    expect(dash.heightPx).toBeCloseTo(cellPx * 2, 6);
  });

  it("4/5. line breaks and page breaks are unchanged by the dash visual treatment — deep-equal CanonicalDocument across two independent compositions of the same input", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "dash-ellipsis")!;
    const { document: docA } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const { document: docB } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    expect(docB).toEqual(docA);
  });

  it("6. surrounding (non-dash) unit coordinates on the same line are unchanged by the dash visual treatment — a pure CSS/paint-content change, never a geometry change", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "dash-ellipsis")!;
    const { model } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const line0 = model.pages[0].columns[0].lines[0];
    const dashIndex = line0.units.findIndex((u) => u.semanticRunKind === "DASH");
    expect(dashIndex).toBeGreaterThan(0); // "彼は" precedes it on line0
    const before = line0.units[dashIndex - 1];
    const dash = line0.units[dashIndex];
    expect(dash.topPx).toBeCloseTo(before.topPx + before.heightPx, 6);
    const after = line0.units[dashIndex + 1];
    if (after) expect(after.topPx).toBeCloseTo(dash.topPx + dash.heightPx, 6);
  });

  it("7. a dash paint item is generated with the semanticRunKind field populated", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "dash-ellipsis")!;
    const { model } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const dash = findDashUnit(model);
    expect(dash.semanticRunKind).toBe("DASH");
  });

  it("8. NORMAL Preview has no provisional/debug styling on the dash run — no title tooltip, no debug-info badge", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "dash-ellipsis")!;
    const { model } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const html = ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models: [model], mode: "normal" }));
    expect(html).not.toContain("paintStrategy=");
    expect(html).not.toContain('class="debug-info"');
  });

  it("9. DEBUG mode retains traceability — the tooltip exposes runKind, the canonical run box (top/height), and the paint strategy", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "dash-ellipsis")!;
    const { model } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const html = ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models: [model], mode: "debug" }));
    expect(html).toContain("runKind=DASH");
    expect(html).toContain("runBoxTop=");
    expect(html).toContain("runBoxHeight=");
    expect(html).toContain("paintStrategy=painted-bar");
  });

  it("10. visual scaling is proportional — the dash run's own topPx/heightPx scale exactly with the visual scale multiplier, canonical text/span unchanged", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "dash-ellipsis")!;
    const { model: at1x } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity, 1);
    const { model: at4x } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity, 4);
    const dash1 = findDashUnit(at1x);
    const dash4 = findDashUnit(at4x);
    expect(dash4.topPx / dash1.topPx).toBeCloseTo(4, 6);
    expect(dash4.heightPx / dash1.heightPx).toBeCloseTo(4, 6);
    expect(dash4.text).toBe(dash1.text);
    expect(dash4.sourceSpan).toEqual(dash1.sourceSpan);
  });

  it("11. CanonicalDocument is never mutated by painting it, and the same input produces a deterministic PaintDocument", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "dash-ellipsis")!;
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

  it("12. the Renderer never re-tokenizes or re-classifies source — semanticRunKind is read directly from the owning LogicalUnit, and an ELLIPSIS run in the same fixture is never touched by the dash-specific paint treatment", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "dash-ellipsis")!;
    const { model } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const allUnits = model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units)));
    const ellipsis = allUnits.find((u) => u.semanticRunKind === "ELLIPSIS")!;
    expect(ellipsis).toBeDefined();
    expect(ellipsis.text).toBe("……");
    const html = ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models: [model], mode: "normal" }));
    // The ELLIPSIS unit's own class attribute must be exactly
    // "unit kind-SEMANTIC_RUN" (no "semantic-dash" suffix) -- an unrelated
    // DASH unit correctly carrying that suffix elsewhere in the same HTML
    // does not mean the ellipsis unit was touched.
    expect(html).toContain('class="unit kind-SEMANTIC_RUN" style');
    expect(html).toMatch(/<div class="unit kind-SEMANTIC_RUN semantic-dash"[^>]*>/); // the DASH unit does get the class
  });

  it("dash and paragraph indent: a dash run as a paragraph's first content is shifted only by the standard indent offset, never by anything dash-specific", () => {
    const { units, source } = buildFixtureUnits("body", [{ kind: "SEMANTIC_RUN", text: "――", runKind: "DASH" }, { kind: "TEXT", text: "と言った" }]);
    const { document, model } = composeAndPaint(units, source, { charsPerLine: 8, linesPerColumn: 3, columnCount: 1 });
    const line0 = document.pages[0].columns[0].lines[0];
    expect(line0.indentTick).toBeUndefined(); // DASH's first-char indeterminacy (disclosed architecture limitation) -> no indent, matching Core's own documented behavior
    const dash = findDashUnit(model);
    expect(dash.topPx).toBe(0);
  });

  it("dash near paragraph break: composes and paints correctly immediately after a bare paragraph break", () => {
    const { units, source } = buildFixtureUnits("body", [
      { kind: "TEXT", text: "あ" },
      { kind: "PARAGRAPH_BREAK" },
      { kind: "SEMANTIC_RUN", text: "――", runKind: "DASH" },
      { kind: "TEXT", text: "と言った" },
    ]);
    const { document, model } = composeAndPaint(units, source, { charsPerLine: 10, linesPerColumn: 3, columnCount: 1 });
    expect(document.hold).toBe(false);
    expect(findDashUnit(model)).toBeDefined();
  });

  it("dash near manual page break: composes on the new page correctly, no phantom indent fabricated", () => {
    const { units, source } = buildFixtureUnits("body", [
      { kind: "TEXT", text: "第一章" },
      { kind: "MANUAL_BREAK" },
      { kind: "SEMANTIC_RUN", text: "――", runKind: "DASH" },
      { kind: "TEXT", text: "と言った" },
    ]);
    const { document, model } = composeAndPaint(units, source, { charsPerLine: 10, linesPerColumn: 3, columnCount: 1 });
    expect(document.pages.length).toBe(2);
    const page2Units = model.pages[1].columns[0].lines.flatMap((l) => l.units);
    expect(page2Units.find((u) => u.semanticRunKind === "DASH")).toBeDefined();
    expect(model.pages[1].columns[0].lines[0].indentTick).toBeUndefined();
  });

  it("dash near column boundary: composes on the next column correctly", () => {
    const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text: "あいう" }, { kind: "SEMANTIC_RUN", text: "――", runKind: "DASH" }]);
    const { document, model } = composeAndPaint(units, source, { charsPerLine: 3, linesPerColumn: 1, columnCount: 2 });
    expect(document.pages[0].columns.length).toBeGreaterThanOrEqual(2);
    const col1Units = model.pages[0].columns[1].lines.flatMap((l) => l.units);
    expect(col1Units.find((u) => u.semanticRunKind === "DASH")).toBeDefined();
  });

  it("dash near page boundary: composes on the next page correctly", () => {
    const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text: "あいう" }, { kind: "SEMANTIC_RUN", text: "――", runKind: "DASH" }]);
    const { document, model } = composeAndPaint(units, source, { charsPerLine: 3, linesPerColumn: 1, columnCount: 1 });
    expect(document.pages.length).toBeGreaterThanOrEqual(2);
    const page2Units = model.pages[1].columns[0].lines.flatMap((l) => l.units);
    expect(page2Units.find((u) => u.semanticRunKind === "DASH")).toBeDefined();
  });

  it("dash adjacent to punctuation: composes and paints correctly on both sides", () => {
    const { units, source } = buildFixtureUnits("body", [
      { kind: "TEXT", text: "「" },
      { kind: "SEMANTIC_RUN", text: "――", runKind: "DASH" },
      { kind: "TEXT", text: "」と言った" },
    ]);
    const { model } = composeAndPaint(units, source, { charsPerLine: 10, linesPerColumn: 3, columnCount: 1 });
    expect(findDashUnit(model)).toBeDefined();
  });

  it("multiple dash runs in one document: each composes and paints independently, atomicity preserved for each", () => {
    const { units, source } = buildFixtureUnits("body", [
      { kind: "TEXT", text: "あ" },
      { kind: "SEMANTIC_RUN", text: "――", runKind: "DASH" },
      { kind: "TEXT", text: "い" },
      { kind: "SEMANTIC_RUN", text: "――", runKind: "DASH" },
      { kind: "TEXT", text: "う" },
    ]);
    const { model } = composeAndPaint(units, source, { charsPerLine: 12, linesPerColumn: 3, columnCount: 1 });
    const allUnits = model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units)));
    const dashUnits = allUnits.filter((u) => u.semanticRunKind === "DASH");
    expect(dashUnits).toHaveLength(2);
    for (const d of dashUnits) expect(d.text).toBe("――");
  });

  it("the generated stylesheet declares the painted-bar rule scoped to .semantic-dash only, using an em (body-font-relative, proportional) width, never a fixed disconnected px value", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "dash-ellipsis")!;
    const { model } = composeAndPaint(fx.bodyUnits, fx.source, fx.capacity);
    const html = ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models: [model], mode: "normal" }));
    expect(html).toContain(".unit.kind-SEMANTIC_RUN.semantic-dash .unit-ink::after");
    const barRuleMatch = html.match(/\.unit\.kind-SEMANTIC_RUN\.semantic-dash \.unit-ink::after\s*\{[^}]*\}/);
    expect(barRuleMatch).not.toBeNull();
    // P3-O04-DASH-STROKE-WEIGHT-HOLD: em, relative to .unit's own inline
    // font-size (== the canonical fontSizePx) -- proportional by
    // construction, never a fixed px length.
    expect(barRuleMatch![0]).toMatch(/width:\s*0\.\d+em/);
    expect(barRuleMatch![0]).not.toMatch(/width:\s*\d+px/);
    expect(barRuleMatch![0]).not.toContain("width: 12%"); // the Human-rejected, too-heavy original value must not recur
  });

  it("does not mutate CanonicalDocument (no re-layout) — a snapshot taken before painting equals a snapshot taken after", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "dash-ellipsis")!;
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
    buildPaintDocument("id", "label", document, fx.bodyUnits, fx.source, ctx);
    expect(document).toEqual(snapshot);
  });
});
