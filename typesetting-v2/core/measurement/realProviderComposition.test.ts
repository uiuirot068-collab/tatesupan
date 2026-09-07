// P3-O08 — Real Shippori Mincho MeasurementFacts: composition-level proof.
// Confirms the REAL provider produces a CanonicalDocument identical (except
// for the version.measurementIdentity string itself) to the fake provider's
// own output, for representative content covering every special-unit kind
// this session's own P3-O03/O04/O05/Ruby work already closed. This is the
// direct evidence for "real measurement facts introduce zero unexpected
// reflow" -- not asserted from theory alone.

import { join } from "path";
import { describe, expect, it } from "vitest";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_RULE_SET_V2 } from "../index";
import { createShipporiMinchoMeasurementProvider } from "./shipporiMinchoProvider";
import { buildFixtureUnits } from "../../tools/compare/fixtureBuilder";
import { mmToTicks } from "../geometry/tick";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");

const BODY_FONT_SIZE_PT = 10.5;
function settingsFor(charsPerLine: number, linesPerColumn: number, columnsPerPage: number) {
  const perCellAdvanceTick = mmToTicks((BODY_FONT_SIZE_PT * 25.4) / 72);
  return {
    bodyFontRef: "shippori-mincho",
    bodyFontSizePt: BODY_FONT_SIZE_PT,
    lineExtentTicks: charsPerLine * perCellAdvanceTick,
    linePitchTicks: perCellAdvanceTick,
    columnExtentTicks: linesPerColumn * perCellAdvanceTick,
    columnsPerPage,
  };
}

describe("Real vs fake MeasurementFacts — composition parity", () => {
  it("7/12. F20 canonical sentence composes to an identical page/line structure and is itself deterministic under the real provider", () => {
    const { units, source } = buildFixtureUnits("body", [
      { kind: "TEXT", text: "「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」" },
    ]);
    const settings = settingsFor(14, 5, 1);
    const fakeDoc = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement: createFakeMeasurementProvider(), settings });
    const realProvider = createShipporiMinchoMeasurementProvider(FONT_PATH);
    const realDoc = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement: realProvider, settings });
    const realDocAgain = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement: realProvider, settings });

    expect(realDoc.pages.length).toBe(fakeDoc.pages.length);
    expect(realDoc.pages).toEqual(fakeDoc.pages); // identical geometry, not just identical counts
    expect(realDoc.pages).toEqual(realDocAgain.pages); // deterministic under the real provider itself
    expect(realDoc.hold).toBe(false);
  });

  it("9. ruby body invariant preserved: base run coordinates are identical between fake and real providers; only the reading's own extent is computed via the (identical-formula) real provider", () => {
    const { units, source } = buildFixtureUnits("body", [
      { kind: "TEXT", text: "これは" },
      { kind: "RUBY", base: "東京", reading: "とうきょう" },
      { kind: "TEXT", text: "に行く用事があった" },
    ]);
    void source;
    const settings = settingsFor(10, 3, 1);
    const fakeDoc = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement: createFakeMeasurementProvider(), settings });
    const realDoc = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement: createShipporiMinchoMeasurementProvider(FONT_PATH), settings });
    const fakePlaced = fakeDoc.pages[0].columns[0].lines.flatMap((l) => l.placedUnits);
    const realPlaced = realDoc.pages[0].columns[0].lines.flatMap((l) => l.placedUnits);
    expect(realPlaced.map((p) => ({ xTick: p.xTick, yTick: p.yTick, sourceSpan: p.sourceSpan }))).toEqual(
      fakePlaced.map((p) => ({ xTick: p.xTick, yTick: p.yTick, sourceSpan: p.sourceSpan }))
    );
    expect(realPlaced.map((p) => p.rubyReadingExtentTick)).toEqual(fakePlaced.map((p) => p.rubyReadingExtentTick));
  });

  it("10. TCY logicalCells/atomicity unchanged -- TCY occupancy never calls naturalAdvanceTick/rubyReadingExtentTick at all", () => {
    const { units } = buildFixtureUnits("body", [{ kind: "TEXT", text: "西暦" }, { kind: "TCY", text: "2026" }, { kind: "TEXT", text: "年" }]);
    const settings = settingsFor(10, 2, 1);
    const fakeDoc = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement: createFakeMeasurementProvider(), settings });
    const realDoc = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement: createShipporiMinchoMeasurementProvider(FONT_PATH), settings });
    expect(realDoc.pages).toEqual(fakeDoc.pages);
  });

  it("11. Dash/Ellipsis semantic-run extents unchanged (length * naturalAdvanceTick, same formula, same result)", () => {
    const { units } = buildFixtureUnits("body", [
      { kind: "TEXT", text: "彼は" },
      { kind: "SEMANTIC_RUN", text: "――", runKind: "DASH" },
      { kind: "TEXT", text: "そうだ" },
      { kind: "SEMANTIC_RUN", text: "……", runKind: "ELLIPSIS" },
      { kind: "TEXT", text: "と言った" },
    ]);
    const settings = settingsFor(6, 5, 1);
    const fakeDoc = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement: createFakeMeasurementProvider(), settings });
    const realDoc = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement: createShipporiMinchoMeasurementProvider(FONT_PATH), settings });
    expect(realDoc.pages).toEqual(fakeDoc.pages);
  });
});
