import { describe, expect, it } from "vitest";
import { createFakeMeasurementProvider } from "../measurement/fakeProvider";
import { DEFAULT_RULE_SET_V2 } from "../rules/defaultRuleSet";
import type { SourceSpan } from "../source/span";
import type { LogicalUnit, ManualBreakUnit, TextUnit } from "../units";
import { composeColumn, type ColumnCompositionSettings } from "./column";

const BLOCK = "body-1";
const measurement = createFakeMeasurementProvider();
const CELL = measurement.naturalAdvanceTick("body", 10, "");

function span(start: number, end: number): SourceSpan {
  return { blockId: BLOCK, start, end };
}

function text(t: string, start: number): TextUnit {
  return { kind: "TEXT", span: span(start, start + Array.from(t).length), text: t };
}

const settings: ColumnCompositionSettings = {
  bodyFontRef: "body",
  bodyFontSizePt: 10,
  lineExtentTicks: CELL * 3, // 3 characters per line
  linePitchTicks: CELL, // one line "costs" one cell of column width (fixture value)
  columnExtentTicks: CELL * 2, // room for exactly 2 lines
};

describe("composeColumn — fills lines to column capacity", () => {
  it("places multiple lines until the column's own capacity is reached, continuing the source stream across lines", () => {
    const unit = text("あいうえおかきくけこ", 0); // 10 cells, 3 per line -> needs 4 lines, column holds 2
    const result = composeColumn([unit], 0, DEFAULT_RULE_SET_V2, measurement, settings);
    expect(result.hold).toBeUndefined();
    expect(result.column.lines).toHaveLength(2);
    expect(result.column.lines[0].placedUnits).toHaveLength(3);
    expect(result.column.lines[1].placedUnits).toHaveLength(3);
    // Line 2 must continue exactly where line 1 left off, not restart or skip.
    expect(result.column.lines[1].placedUnits[0].sourceSpan.start).toBe(3);
    expect(result.remainingUnits[0]?.span.start).toBe(6);
  });

  it("reports residual column-width space rather than stretching line pitch (INV-004)", () => {
    const unit = text("あいう", 0); // fits in one line, column has room for 2
    const result = composeColumn([unit], 0, DEFAULT_RULE_SET_V2, measurement, settings);
    expect(result.column.lines).toHaveLength(1);
    expect(result.column.residualSpaceTick).toBe(CELL * 1);
  });
});

describe("composeColumn — manual forced break closes the column immediately", () => {
  it("stops accepting more lines once a MANUAL_BREAK is hit, even under column capacity", () => {
    const before = text("あ", 0);
    const manualBreak: ManualBreakUnit = { kind: "MANUAL_BREAK", span: span(1, 1) };
    const after = text("いうえ", 1);
    const units: LogicalUnit[] = [before, manualBreak, after];
    const result = composeColumn(units, 0, DEFAULT_RULE_SET_V2, measurement, settings);
    expect(result.forcedBreak).toBe(true);
    expect(result.column.lines).toHaveLength(1); // column had room for 2 lines but stopped after the forced one
    expect(result.remainingUnits[0]?.span.start).toBe(1);
  });
});

describe("composeColumn — HOLD propagation", () => {
  it("propagates a line-level hold rather than silently discarding it", () => {
    const impossible: ColumnCompositionSettings = { ...settings, lineExtentTicks: 0 };
    const unit = text("あ", 0);
    const result = composeColumn([unit], 0, DEFAULT_RULE_SET_V2, measurement, impossible);
    expect(result.hold).toBeDefined();
    expect(result.column.lines).toHaveLength(0);
  });
});
