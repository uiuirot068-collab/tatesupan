import { describe, expect, it } from "vitest";
import {
  composeCanonicalDocument,
  createFakeMeasurementProvider,
  DEFAULT_RULE_SET_V2,
  type CanonicalDocument,
} from "../../core";
import { buildFixtureUnits } from "../compare/fixtureBuilder";
import { DEFAULT_SCALE_MULTIPLIER, tickToPx } from "./geometry";
import { ALL_FIXTURES, settingsFor } from "./fixtures";
import { buildPreviewViewModel, type PreviewRenderContext } from "./viewModel";

describe("geometry.ts — GeometryTick -> px, one-way conversion", () => {
  it("is deterministic: same tick + same scale -> same px", () => {
    expect(tickToPx(3528, 4)).toBe(tickToPx(3528, 4));
  });

  it("changing scale changes only the visual size, not the tick value itself", () => {
    const at1x = tickToPx(1000, 1);
    const at4x = tickToPx(1000, 4);
    expect(at4x).toBe(at1x * 4);
  });

  it("zero ticks maps to zero px regardless of scale", () => {
    expect(tickToPx(0, DEFAULT_SCALE_MULTIPLIER)).toBe(0);
  });
});

const measurement = createFakeMeasurementProvider();

function composeFixture(id: string): { document: CanonicalDocument; ctx: PreviewRenderContext; bodyUnits: ReturnType<typeof buildFixtureUnits>["units"]; source: string } {
  const fx = ALL_FIXTURES.find((f) => f.id === id);
  if (!fx) throw new Error(`fixture not found: ${id}`);
  const settings = settingsFor(fx.capacity);
  const document = composeCanonicalDocument({
    bodyUnits: fx.bodyUnits,
    ruleSet: DEFAULT_RULE_SET_V2,
    measurement,
    settings,
  });
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

describe("viewModel.ts — CanonicalDocument -> paint-only ViewModel", () => {
  it("never mutates the CanonicalDocument it reads (INV-002/INV-009 — painter is read-only)", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("f20-canonical-sentence");
    const snapshot = JSON.parse(JSON.stringify(document));
    buildPreviewViewModel("f20-canonical-sentence", "F20", document, bodyUnits, source, ctx);
    expect(document).toEqual(snapshot);
  });

  it("produces the same view model for the same input (deterministic)", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("f20-canonical-sentence");
    const a = buildPreviewViewModel("id", "label", document, bodyUnits, source, ctx);
    const b = buildPreviewViewModel("id", "label", document, bodyUnits, source, ctx);
    expect(b).toEqual(a);
  });

  it("resolves page/column/line/unit structure directly from CanonicalDocument, never re-deriving it", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("two-column-flow");
    const vm = buildPreviewViewModel("id", "label", document, bodyUnits, source, ctx);
    expect(vm.pages.length).toBe(document.pages.length);
    expect(vm.pages[0].columns.length).toBe(document.pages[0].columns.length);
    expect(vm.pages[0].columns[0].lines.length).toBe(document.pages[0].columns[0].lines.length);
  });

  it("recovers unit kind and text via the read-only LogicalUnit span lookup, not by re-tokenizing", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("atomic-ruby");
    const vm = buildPreviewViewModel("id", "label", document, bodyUnits, source, ctx);
    const allUnits = vm.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units)));
    const rubyUnit = allUnits.find((u) => u.kind === "RUBY");
    expect(rubyUnit).toBeDefined();
    expect(rubyUnit!.text).toBe("東京");
    expect(rubyUnit!.provisional).toBe(true); // ruby annotation placement not yet final (P3-O06/wiring gap)
    const textUnit = allUnits.find((u) => u.kind === "TEXT");
    expect(textUnit!.provisional).toBe(false);
  });

  it("exposes source spans unchanged from the PlacedUnit's own span (no fabrication)", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("f20-canonical-sentence");
    const vm = buildPreviewViewModel("id", "label", document, bodyUnits, source, ctx);
    const firstUnit = vm.pages[0].columns[0].lines[0].units[0];
    const firstPlaced = document.pages[0].columns[0].lines[0].placedUnits[0];
    expect(firstUnit.sourceSpan).toEqual(firstPlaced.sourceSpan);
  });

  it("surfaces the paragraph-break indent as line-level metadata (indentPx), never as a fabricated unit", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("paragraph-blank-line");
    const vm = buildPreviewViewModel("id", "label", document, bodyUnits, source, ctx);
    const firstLine = vm.pages[0].columns[0].lines[0];
    expect(firstLine.indentPx).toBeGreaterThan(0); // first paragraph is indented (Human Product Decision A)
    // No PlacedUnit/ViewPlacedUnit exists for the indent itself.
    expect(firstLine.units.every((u) => u.sourceSpan.start >= 0)).toBe(true);
  });

  it("marks the manual-page-break page distinctly, with no phantom extra line (Root Cause C not ported)", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("manual-page-break");
    const vm = buildPreviewViewModel("id", "label", document, bodyUnits, source, ctx);
    expect(vm.pages[1].manualBreakBefore).toBe(true);
    expect(vm.pages[1].columns[0].lines.length).toBe(1); // exactly the content line, no blank phantom line
  });

  it("gives the image unit zero text but real occupancy (kind IMAGE, provisional, non-zero height)", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("image-placeholder");
    const vm = buildPreviewViewModel("id", "label", document, bodyUnits, source, ctx);
    const allUnits = vm.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units)));
    const image = allUnits.find((u) => u.kind === "IMAGE");
    expect(image).toBeDefined();
    expect(image!.text).toBe("");
    expect(image!.provisional).toBe(true);
    expect(image!.heightPx).toBeGreaterThan(0);
  });

  it("shows a HOLD document as hold:true with its error reasons, and renders zero pages worth trusting", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("hold-example");
    expect(document.hold).toBe(true); // confirm the fixture actually holds, not just assumed
    const vm = buildPreviewViewModel("id", "label", document, bodyUnits, source, ctx);
    expect(vm.hold).toBe(true);
    expect(vm.holdReasons.length).toBeGreaterThan(0);
  });

  it("bounds rendered pages to maxPages without altering the document's own true page count", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("multi-page");
    const bounded = buildPreviewViewModel("id", "label", document, bodyUnits, source, { ...ctx, maxPages: 2 });
    expect(bounded.totalPageCount).toBe(document.pages.length);
    expect(bounded.renderedPageCount).toBe(Math.min(2, document.pages.length));
    expect(bounded.pages.length).toBe(bounded.renderedPageCount);
  });

  it("flags a font/measurement identity mismatch without remeasuring anything", () => {
    const { document, ctx, bodyUnits, source } = composeFixture("f20-canonical-sentence");
    const mismatched: PreviewRenderContext = { ...ctx, paintFontIdentity: "some-other-font@9.9.9" };
    const vm = buildPreviewViewModel("id", "label", document, bodyUnits, source, mismatched);
    expect(vm.fontIdentityMismatch).toBe(true);
    // The underlying document's own composed geometry is untouched by this flag.
    const matched = buildPreviewViewModel("id", "label", document, bodyUnits, source, ctx);
    expect(matched.fontIdentityMismatch).toBe(false);
    expect(matched.pages).toEqual(vm.pages); // same canonical coordinates regardless of the paint-time font flag
  });
});
