// P3-O08 — Ruby scale re-audit diagnostic. A proper, repository-local
// regression test (not a throwaway script) that captures the exact
// canonical numbers the Human HOLD's own "RUBY DATA TRACE" section
// requires, against the real `atomic-ruby` fixture. Asserted as a frozen
// snapshot object so the measured values are visible in this file's own
// diff/output — the audit result IS the assertion.

import { describe, expect, it } from "vitest";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_RULE_SET_V2 } from "../../core";
import { buildPublicationDocument, type PublicationRenderContext } from "./paintModel";
import { ALL_FIXTURES, settingsFor } from "./fixtures";

const measurement = createFakeMeasurementProvider();

describe("Ruby scale re-audit — atomic-ruby fixture diagnostic trace", () => {
  it("records exact canonical/measurement numbers for 東京《とうきょう》", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "atomic-ruby")!;
    const settings = settingsFor(fx.capacity);
    const document = composeCanonicalDocument({ bodyUnits: fx.bodyUnits, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
    const ctx: PublicationRenderContext = {
      linePitchTicks: settings.linePitchTicks,
      lineExtentTicks: settings.lineExtentTicks,
      columnExtentTicks: settings.columnExtentTicks,
      columnsPerPage: settings.columnsPerPage,
      measurementIdentity: document.version.measurementIdentity,
      paintFontIdentity: document.version.measurementIdentity,
    };
    const model = buildPublicationDocument(fx.id, fx.label, document, fx.bodyUnits, fx.source, ctx);
    const ruby = model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units))).find((u) => u.kind === "RUBY")!;
    const ann = ruby.rubyAnnotation!;
    expect(ann.status).toBe("PLACED");

    const baseGraphemeCount = Array.from(ruby.text).length;
    const readingCodePointCount = ann.status === "PLACED" ? Array.from(ann.text).length : 0;
    const bodyCellMm = settings.linePitchTicks * 0.001; // one body em, in mm

    const trace = {
      bodyFontSizePt: settings.bodyFontSizePt,
      bodyCellMm,
      baseGraphemeCount, // 東京 -> 2
      baseRunExtentMm: ruby.heightMm, // canonical base run extent
      readingCodePointCount, // とうきょう -> 5
      rubyReadingExtentMm: ann.status === "PLACED" ? ann.extentMm : undefined, // canonical rubyReadingExtentTick, in mm
      extentRatio: ann.status === "PLACED" ? ann.extentMm / ruby.heightMm : undefined, // annotation extent / base extent
      configuredRubyScaleInSettings: (settings as unknown as { rubyScale?: number }).rubyScale, // PageCompositionSettings carries no rubyScale field at all
    };

    // AFTER FIX (2026-09-07, Human/Product decision: rubyScale = 0.5,
    // applied at core/compose/line.ts's own measurement call site):
    //   rubyReadingExtentTick = naturalAdvanceTick(fontRef, bodyFontSizePt * rubyScale, "") * readingCodePointCount
    // i.e. 5 x (BODY em x 0.5) = 5 x RUBY em, not 5 x full BODY em.
    //
    // BEFORE this fix (recorded here for the historical record, proven by
    // this exact test before the fix landed -- see
    // qa/evidence/P3_O08_VERTICAL_CELL_AND_RUBY_SCALE.md): rubyReadingExtentMm
    // was 18.52 (5 x 3.704, full body em) and extentRatio was 2.5 -- the
    // annotation reserved 2.5x the base run's own height. rubyScale was
    // declared as a LayoutSettings field but never read or applied anywhere.
    expect(trace).toEqual({
      bodyFontSizePt: 10.5,
      bodyCellMm: 3.704,
      baseGraphemeCount: 2,
      baseRunExtentMm: 7.408, // 2 x 3.704
      readingCodePointCount: 5,
      rubyReadingExtentMm: 9.26, // 5 x (3.704 x 0.5) -- RUBY em, scaled per the Human-approved DEFAULT_RUBY_SCALE
      extentRatio: 1.25, // 9.26 / 7.408 -- the annotation now reserves 1.25x the base run's own height, not 2.5x
      configuredRubyScaleInSettings: undefined, // PageCompositionSettings itself carries no rubyScale field (optional, defaults via DEFAULT_RUBY_SCALE at the composeLine call site) -- this fixture did not set one explicitly
    });
  });
});
