// Human Product Decisions A (一字下げ auto-indent) and B (bare-newline
// paragraph break) — `qa/evidence/PARAGRAPH_SEMANTICS_PRE_STAGE_D.md`.
// Exercises the PARAGRAPH_BREAK LogicalUnit and compose/line.ts's
// auto-indent budget reduction directly, at the Core level (Stage C's own
// suite exercises the same mechanism end-to-end against legacy).

import { describe, expect, it } from "vitest";
import { createFakeMeasurementProvider } from "../measurement/fakeProvider";
import { DEFAULT_RULE_SET_V2 } from "../rules/defaultRuleSet";
import type { SourceSpan } from "../source/span";
import type { LogicalUnit, ParagraphBreakUnit, RubyUnit, TCYUnit, TextUnit } from "../units";
import { composeColumn, type ColumnCompositionSettings } from "./column";
import { composeLine } from "./line";

const BLOCK = "body-1";
const measurement = createFakeMeasurementProvider();
const CELL = measurement.naturalAdvanceTick("body", 10, "");
const settings = { bodyFontRef: "body", bodyFontSizePt: 10 };

function span(start: number, end: number): SourceSpan {
  return { blockId: BLOCK, start, end };
}

function text(t: string, start: number): TextUnit {
  return { kind: "TEXT", span: span(start, start + Array.from(t).length), text: t };
}

function paragraphBreak(start: number, chars = "\n"): ParagraphBreakUnit {
  return { kind: "PARAGRAPH_BREAK", span: span(start, start + Array.from(chars).length) };
}

describe("Human Product Decision A — 一字下げ auto-indent", () => {
  it("a single paragraph's first line reserves one cell, unless the first character is exempt", () => {
    const unit = text("あいうえお", 0); // 5 cells, "あ" is not exempt
    const result = composeLine([unit], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 5, true);
    expect(result.hold).toBeUndefined();
    // Effective budget is 4 cells (5 - indent), so only 4 of the 5 characters fit.
    expect(result.line.placedUnits).toHaveLength(4);
    expect(result.line.indentTick).toBe(CELL);
  });

  it("does not indent when isParagraphStart is false, even for the same content", () => {
    const unit = text("あいうえお", 0);
    const result = composeLine([unit], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 5, false);
    expect(result.line.placedUnits).toHaveLength(5);
    expect(result.line.indentTick).toBeUndefined();
  });

  it("does not indent when the paragraph starts with a conversation-opening bracket", () => {
    const unit = text("「あいうえお", 0); // 「 is in AUTO_INDENT_EXEMPT_OPENERS
    const result = composeLine([unit], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 6, true);
    expect(result.line.placedUnits).toHaveLength(6); // full budget, no indent reserved
    expect(result.line.indentTick).toBeUndefined();
  });

  it("does not double-indent when the manuscript already typed a leading full-width space", () => {
    const unit = text("　あいうえお", 0); // full-width space (U+3000) is AUTO_INDENT_CHAR
    const result = composeLine([unit], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 6, true);
    expect(result.line.placedUnits).toHaveLength(6);
    expect(result.line.indentTick).toBeUndefined();
  });

  it("Natural Pitch residual accounting reflects the indent-reduced budget, never stretching (INV-004)", () => {
    const unit = text("あい", 0); // 2 cells, well under the 5-cell line extent
    const result = composeLine([unit], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 5, true);
    // Effective budget = 4 (5 - indent); used = 2; residual = 2.
    expect(result.residualSpaceTick).toBe(CELL * 2);
  });

  it("does not fabricate a source character for the indent — placedUnits' spans still cover only real content", () => {
    const unit = text("あいうえお", 0);
    const result = composeLine([unit], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 5, true);
    const spans = result.line.placedUnits.map((p) => p.sourceSpan);
    expect(spans).toEqual([span(0, 1), span(1, 2), span(2, 3), span(3, 4)]);
    expect(result.consumedThroughOffset).toBe(4); // no extra offset consumed for the indent itself
  });

  it("cannot determine a first character for RUBY or SEMANTIC_RUN — no indent applies (disclosed architecture limitation)", () => {
    const ruby: RubyUnit = { kind: "RUBY", span: span(0, 2), rubyKind: "ATOMIC", baseSpan: span(0, 2), readingSpan: span(10, 15) };
    const after = text("あいう", 2);
    const result = composeLine([ruby, after], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 5, true);
    expect(result.line.indentTick).toBeUndefined(); // no indent — RubyUnit stores no base text for the check
  });

  it("TCY's displayText is determinable, so indent applies normally when a paragraph starts with TCY", () => {
    const tcy: TCYUnit = { kind: "TCY", span: span(0, 2), displayText: "12", logicalCells: 1 };
    const after = text("あいう", 2);
    const result = composeLine([tcy, after], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 5, true);
    // "1" is not an exempt opener -> indent applies.
    expect(result.line.indentTick).toBe(CELL);
  });
});

describe("Human Product Decision B — bare-newline paragraph break", () => {
  it("a PARAGRAPH_BREAK forces the current line to end, unconditionally, even under capacity", () => {
    const before = text("あい", 0);
    const brk = paragraphBreak(2);
    const after = text("うえ", 3);
    const units: LogicalUnit[] = [before, brk, after];
    const result = composeLine(units, DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, false);
    expect(result.hold).toBeUndefined();
    expect(result.endedAtParagraphBreak).toBe(true);
    expect(result.forcedBreak).toBe(false); // never closes column/page, unlike MANUAL_BREAK
    expect(result.consumedThroughOffset).toBe(3); // includes the break's own span, excludes "うえ"
  });

  it("does NOT close the column or page (distinct from MANUAL_BREAK) — composeColumn keeps filling", () => {
    const columnSettings: ColumnCompositionSettings = {
      ...settings,
      lineExtentTicks: CELL * 10,
      linePitchTicks: CELL,
      columnExtentTicks: CELL * 5, // room for 5 lines
    };
    const before = text("あい", 0);
    const brk = paragraphBreak(2);
    const after = text("うえ", 3);
    const result = composeColumn([before, brk, after], 0, DEFAULT_RULE_SET_V2, measurement, columnSettings, false);
    expect(result.forcedBreak).toBe(false);
    expect(result.hold).toBeUndefined();
    expect(result.column.lines).toHaveLength(2); // "あい\n" on line 1, "うえ" on line 2 — ordinary continued flow
  });

  it("makes the NEXT line a fresh paragraph start (auto-indent applies to it)", () => {
    const columnSettings: ColumnCompositionSettings = {
      ...settings,
      lineExtentTicks: CELL * 5,
      linePitchTicks: CELL,
      columnExtentTicks: CELL * 5,
    };
    const first = text("あ", 0);
    const brk = paragraphBreak(1);
    const second = text("いうえおか", 2); // 5 cells, "い" not exempt
    const result = composeColumn([first, brk, second], 0, DEFAULT_RULE_SET_V2, measurement, columnSettings, true);
    expect(result.hold).toBeUndefined();
    // Line 2 (the fresh paragraph) gets the -1 indent budget -> only 4 of "いうえおか" fit.
    expect(result.column.lines[1].placedUnits).toHaveLength(4);
    expect(result.column.lines[1].indentTick).toBe(CELL);
  });

  it("consecutive PARAGRAPH_BREAKs (a blank manuscript line) produce a real, empty line entry — never collapsed", () => {
    const columnSettings: ColumnCompositionSettings = {
      ...settings,
      lineExtentTicks: CELL * 10,
      linePitchTicks: CELL,
      columnExtentTicks: CELL * 5,
    };
    const first = text("あい", 0);
    const brk1 = paragraphBreak(2);
    const brk2 = paragraphBreak(3);
    const second = text("うえ", 4);
    const result = composeColumn([first, brk1, brk2, second], 0, DEFAULT_RULE_SET_V2, measurement, columnSettings, true);
    expect(result.hold).toBeUndefined();
    expect(result.column.lines).toHaveLength(3);
    expect(result.column.lines[1].placedUnits).toHaveLength(1); // the blank line: just the second break's own zero-cost atom
    expect(result.column.lines[2].placedUnits).toHaveLength(2); // "うえ", indent-exempt check doesn't apply ("う" is not exempt, but content still fits)
  });

  it("a CRLF (2 code points) paragraph break carries its full source span, never fabricated or truncated", () => {
    const before = text("あ", 0);
    const brk = paragraphBreak(1, "\r\n"); // span covers 2 code points
    const after = text("い", 3);
    const result = composeLine([before, brk, after], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, false);
    expect(result.hold).toBeUndefined();
    const brkPlaced = result.line.placedUnits.find((p) => p.sourceSpan.start === 1);
    expect(brkPlaced?.sourceSpan).toEqual(span(1, 3)); // full 2-code-point CRLF span preserved
    expect(result.consumedThroughOffset).toBe(3);
  });

  it("costs zero line extent, exactly like legacy's own bare-newline token", () => {
    const brk = paragraphBreak(0);
    const after = text("あいうえお", 1); // exactly fills a 5-cell line on its own
    const result = composeLine([brk, after], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 5, false);
    // The break costs 0, so it does NOT force an immediate cut before "あ" —
    // wait: PARAGRAPH_FORCED always cuts right after the break's own atom,
    // regardless of cost, so this line contains ONLY the break itself.
    expect(result.endedAtParagraphBreak).toBe(true);
    expect(result.consumedThroughOffset).toBe(1);
  });
});

describe("Determinism (INV-005) — paragraph semantics never vary across repeated runs", () => {
  it("produces byte-identical composition for the same input", () => {
    const first = text("あ", 0);
    const brk = paragraphBreak(1);
    const second = text("いうえお", 2);
    const units: LogicalUnit[] = [first, brk, second];
    const a = composeLine(units, DEFAULT_RULE_SET_V2, measurement, settings, CELL * 5, true);
    const b = composeLine(units, DEFAULT_RULE_SET_V2, measurement, settings, CELL * 5, true);
    expect(b).toEqual(a);
  });
});
