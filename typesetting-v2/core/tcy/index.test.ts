import { describe, expect, it } from "vitest";
import { createFakeMeasurementProvider } from "../measurement/fakeProvider";
import { DEFAULT_RULE_SET_V2 } from "../rules/defaultRuleSet";
import type { SourceSpan } from "../source/span";
import type { TCYUnit, TextUnit } from "../units";
import { composeLine, type CompositionSettings } from "../compose/line";
import { tcyCellCost } from "./index";

describe("tcyCellCost — cl-30 atomic group cell cost (Contract §10)", () => {
  it("returns exactly the unit's declared logicalCells, regardless of displayText length", () => {
    const tcy: TCYUnit = { kind: "TCY", span: { blockId: "b1", start: 0, end: 2 }, displayText: "12", logicalCells: 1 };
    expect(tcyCellCost(tcy)).toBe(1);
  });

  it("requires no auto-detection heuristic — an explicit 4-digit TCY still reports its own declared cell cost", () => {
    const tcy: TCYUnit = { kind: "TCY", span: { blockId: "b1", start: 0, end: 4 }, displayText: "1999", logicalCells: 1 };
    expect(tcyCellCost(tcy)).toBe(1); // P3-O07 (auto-detection threshold) stays out of scope
  });
});

describe("F10 — explicit TCY unit as one logical-cell-consuming atomic group (test group L)", () => {
  const measurement = createFakeMeasurementProvider();
  const settings: CompositionSettings = { bodyFontRef: "body", bodyFontSizePt: 10 };
  const CELL = measurement.naturalAdvanceTick(settings.bodyFontRef, settings.bodyFontSizePt, "");

  function span(start: number, end: number): SourceSpan {
    return { blockId: "b1", start, end };
  }

  function text(t: string, start: number): TextUnit {
    return { kind: "TEXT", span: span(start, start + Array.from(t).length), text: t };
  }

  it("consumes exactly logicalCells worth of line extent through the full Line Composer pipeline", () => {
    const before = text("あ", 0);
    const tcy: TCYUnit = { kind: "TCY", span: span(1, 3), displayText: "12", logicalCells: 1 };
    const after = text("い", 3);
    const result = composeLine([before, tcy, after], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 2, false);
    // "あ" (1 cell) + TCY (1 cell, despite spanning 2 source code points) = 2
    // cells -- exactly the extent budget; "い" does not fit.
    expect(result.hold).toBeUndefined();
    expect(result.line.placedUnits).toHaveLength(2);
    expect(result.consumedThroughOffset).toBe(3);
  });
});
