// Ruby Placement Micro-Loop — regression tests proving canonical ruby
// annotation geometry is wired into composition (compose/line.ts), reads
// only already-approved measurement/rule-set facts, and never touches body
// placement (INV-003), breaks, capacity, or Natural Pitch.

import { describe, expect, it } from "vitest";
import { createFakeMeasurementProvider } from "../measurement/fakeProvider";
import { DEFAULT_RULE_SET_V2 } from "../rules/defaultRuleSet";
import type { SourceSpan } from "../source/span";
import type { LogicalUnit, RubyUnit, TextUnit } from "../units";
import { composeLine, type CompositionSettings } from "./line";
import type { PageCompositionSettings } from "./page";
import { composeCanonicalDocument } from "../layout/assemble";

const BLOCK = "body-1";
const measurement = createFakeMeasurementProvider();
const settings: CompositionSettings = { bodyFontRef: "body", bodyFontSizePt: 10 };
const CELL = measurement.naturalAdvanceTick(settings.bodyFontRef, settings.bodyFontSizePt, ""); // 3528 ticks

function span(start: number, end: number): SourceSpan {
  return { blockId: BLOCK, start, end };
}

function text(t: string, start: number): TextUnit {
  return { kind: "TEXT", span: span(start, start + Array.from(t).length), text: t };
}

function ruby(
  baseText: string,
  readingText: string,
  start: number,
  opts: { rubyKind?: "ATOMIC" | "JUKUGO"; segments?: { base: string; reading: string }[] } = {}
): RubyUnit {
  const baseLen = Array.from(baseText).length;
  const baseSpan = span(start, start + baseLen);
  if (opts.segments) {
    let segStart = start;
    const segments = opts.segments.map((s) => {
      const len = Array.from(s.base).length;
      const seg = { baseSpan: span(segStart, segStart + len), readingSpan: span(-1, -1), readingText: s.reading };
      segStart += len;
      return seg;
    });
    return {
      kind: "RUBY",
      span: baseSpan,
      rubyKind: "JUKUGO",
      baseSpan,
      readingSpan: span(-1, -1),
      readingText,
      segments,
    };
  }
  return {
    kind: "RUBY",
    span: baseSpan,
    rubyKind: opts.rubyKind ?? "ATOMIC",
    baseSpan,
    readingSpan: span(-1, -1),
    readingText,
  };
}

function makePageSettings(overrides: Partial<PageCompositionSettings> = {}): PageCompositionSettings {
  return {
    bodyFontRef: "body",
    bodyFontSizePt: 10,
    lineExtentTicks: CELL * 8,
    linePitchTicks: CELL,
    columnExtentTicks: CELL * 5,
    columnsPerPage: 1,
    ...overrides,
  };
}

describe("Ruby Placement Micro-Loop — canonical annotation geometry", () => {
  it("1. short ruby: body extent >= reading extent -> CENTER, base placement unaffected", () => {
    const r = ruby("東京", "とう", 0); // base 2 cells, reading 2 cells
    const result = composeLine([r], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, false);
    const placed = result.line.placedUnits[0];
    expect(placed.xTick).toBe(0);
    expect(placed.yTick).toBe(0);
    expect(placed.rubyBoundaryPolicy).toBe("CENTER");
    expect(placed.rubyReadingOffsetTick).toBe(0); // (2cells - 2cells)/2 = 0
    expect(placed.rubyReadingExtentTick).toBe(CELL * 2);
  });

  it("2. annotation longer than body: reading extent > base extent -> overflow engages the clamp/overflow model", () => {
    const r = ruby("都", "とうきょう", 0); // base 1 cell, reading 5 cells -> 4 cells overflow
    const result = composeLine([r], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, false);
    const placed = result.line.placedUnits[0];
    // Empty overhang table (P3-O06 residual) -> no allowance anywhere ->
    // OVERFLOW_OPEN is the only reachable outcome for this much overflow.
    expect(placed.rubyBoundaryPolicy).toBe("OVERFLOW_OPEN");
    expect(placed.rubyReadingExtentTick).toBe(CELL * 5);
  });

  it("3. centered annotation — reading shorter than base", () => {
    const r = ruby("東京都", "とう", 0); // base 3 cells, reading 2 cells
    const result = composeLine([r], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, false);
    const placed = result.line.placedUnits[0];
    expect(placed.rubyBoundaryPolicy).toBe("CENTER");
    expect(placed.rubyReadingOffsetTick).toBe(Math.floor((CELL * 3 - CELL * 2) / 2));
  });

  it("4/5. START_CLAMP and END_CLAMP require nonzero overhang allowance — with today's shipped (empty) table, both degrade to OVERFLOW_OPEN, proving the capability is wired without fabricating a nonzero value", () => {
    const r = ruby("都", "とうきょう", 0); // 4 cells overflow
    const result = composeLine([r], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, false);
    const placed = result.line.placedUnits[0];
    // P3-O06 residual: DEFAULT_RULE_SET_V2's rubyOverhangAllowance table is
    // empty, so overhangAllowanceBeforeTick/AfterTick both resolve to 0 —
    // core/ruby/index.ts's own placeRuby() therefore cannot reach
    // START_CLAMP/END_CLAMP today (both require a nonzero allowance).
    // Directly exercising placeRuby with a synthetic allowance (already
    // covered by core/ruby/index.test.ts) proves the mechanism; this test
    // proves the WIRING calls it with the correct (currently-zero) inputs.
    expect(placed.rubyBoundaryPolicy).toBe("OVERFLOW_OPEN");
  });

  it("6. ruby as the only content on a line (line/column edge): no same-line neighbor on either side -> overhang allowance resolves to 0 via the no-neighbor path, not a crash or a guess", () => {
    const r = ruby("都", "とうきょう", 0);
    const result = composeLine([r], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, false);
    expect(result.hold).toBeUndefined();
    expect(result.line.placedUnits).toHaveLength(1);
    expect(result.line.placedUnits[0].rubyBoundaryPolicy).toBeDefined();
  });

  it("7. ruby adjacent to punctuation exercises the class-aware overhang lookup path (still resolves to 0 given the shipped empty table)", () => {
    const before = text("「", 0); // cl-05-ish opening bracket, a real classified character
    const r = ruby("都", "とうきょう", 1);
    const after = text("」", 2);
    const result = composeLine([before, r, after], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, false);
    const rubyPlaced = result.line.placedUnits[1];
    expect(rubyPlaced.rubyBoundaryPolicy).toBeDefined();
    // Overflow (4 cells) with 0 allowance on both sides -> still OVERFLOW_OPEN.
    // The point of this test is that composing with real adjacent TEXT
    // neighbors does not throw, misclassify, or silently skip the lookup —
    // not that a nonzero optical budget appears (P3-O06 residual, OPEN).
    expect(rubyPlaced.rubyBoundaryPolicy).toBe("OVERFLOW_OPEN");
  });

  it("8. atomic ruby places as exactly one atom — no internal break, matching INV-007", () => {
    const r = ruby("東京都", "とうきょうと", 0);
    const result = composeLine([r], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, false);
    expect(result.line.placedUnits).toHaveLength(1);
    expect(result.line.placedUnits[0].sourceSpan).toEqual(span(0, 3));
  });

  it("9. explicit jukugo segmented ruby places one atom per segment, each with its own independent annotation geometry", () => {
    const r = ruby("東京都", "とうきょうと", 0, { segments: [{ base: "東京", reading: "とうきょう" }, { base: "都", reading: "と" }] });
    const result = composeLine([r], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, false);
    expect(result.line.placedUnits).toHaveLength(2);
    const [seg1, seg2] = result.line.placedUnits;
    expect(seg1.sourceSpan).toEqual(span(0, 2));
    expect(seg1.rubyReadingExtentTick).toBe(CELL * 5); // "とうきょう" = 5 code points (と,う,き,ょ,う)
    expect(seg2.sourceSpan).toEqual(span(2, 3));
    expect(seg2.rubyReadingExtentTick).toBe(CELL * 1); // "と" = 1 cell
    // Independent geometry: segment 1 overflows (4 cells reading vs 2 cells
    // base), segment 2 does not (1 vs 1) -> different policies.
    expect(seg1.rubyBoundaryPolicy).toBe("OVERFLOW_OPEN");
    expect(seg2.rubyBoundaryPolicy).toBe("CENTER");
  });

  it("10. jukugo only breaks (and therefore only places separately) at a supplied legal segment boundary — an undeclared/too-short split never fabricates extra placed atoms", () => {
    const undeclaredJukugo = ruby("東京都", "とうきょうと", 0, { rubyKind: "JUKUGO" }); // no segments
    const result = composeLine([undeclaredJukugo], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, false);
    expect(result.line.placedUnits).toHaveLength(1); // treated as ATOMIC, matching P3-O14
  });

  it("11. ruby on a paragraph-first line: body starts at the indented position; ruby must not cancel or double the indent", () => {
    const before = ruby("東京", "とうきょう", 0); // NOT an exempt opener; RUBY's first-char is indeterminate for the indent check, so no indent applies here (disclosed architecture limitation) -- use a TEXT-first paragraph instead to actually exercise indent + ruby together:
    const paragraph: LogicalUnit[] = [text("あ", 0), ruby("東京", "とうきょう", 1), text("に", 3)];
    const result = composeLine(paragraph, DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, true); // isParagraphStart = true
    expect(result.line.indentTick).toBe(CELL); // one-cell auto-indent applies ("あ" is not exempt)
    const rubyPlaced = result.line.placedUnits[1];
    // The indent reserves LINE-START capacity only (Core's own yTick-stays-
    // at-0 contract) -- it must not appear a second time inside the ruby's
    // own placement fields, and the ruby's own yTick is exactly the sum of
    // the preceding atom's advance, unaffected by the indent reservation.
    expect(rubyPlaced.yTick).toBe(CELL); // after "あ" (1 cell), indent is NOT added into yTick itself
    expect(rubyPlaced.rubyBoundaryPolicy).toBeDefined();
    expect(before).toBeDefined(); // keep the disclosed-limitation note above meaningful without an unused-var lint issue
  });

  it("12. ruby immediately after a paragraph break composes with correct annotation geometry, unaffected by the break", () => {
    const settingsPage = makePageSettings({ lineExtentTicks: CELL * 20 });
    const units: LogicalUnit[] = [
      text("あ", 0),
      { kind: "PARAGRAPH_BREAK", span: span(1, 2) },
      ruby("東京", "とうきょう", 2),
    ];
    const doc = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings: settingsPage });
    expect(doc.hold).toBe(false);
    const secondLine = doc.pages[0].columns[0].lines[1];
    const rubyPlaced = secondLine.placedUnits.find((p) => p.sourceSpan.start === 2)!;
    expect(rubyPlaced.rubyBoundaryPolicy).toBeDefined();
    expect(rubyPlaced.rubyReadingExtentTick).toBe(CELL * 5); // "とうきょう" = 5 code points
  });

  it("13. ruby immediately after a manual page break composes on the new page with correct annotation geometry, and no phantom line/indent is fabricated", () => {
    const settingsPage = makePageSettings({ lineExtentTicks: CELL * 20 });
    const units: LogicalUnit[] = [
      text("第一章", 0),
      { kind: "MANUAL_BREAK", span: span(3, 3) },
      ruby("東京", "とうきょう", 3),
    ];
    const doc = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings: settingsPage });
    expect(doc.hold).toBe(false);
    expect(doc.pages.length).toBe(2);
    const page2Line0 = doc.pages[1].columns[0].lines[0];
    expect(page2Line0.indentTick).toBeUndefined(); // manual-break-state fix still holds
    expect(page2Line0.placedUnits).toHaveLength(1);
    const rubyPlaced = page2Line0.placedUnits[0];
    expect(rubyPlaced.rubyBoundaryPolicy).toBeDefined();
    expect(rubyPlaced.rubyReadingExtentTick).toBe(CELL * 5); // "とうきょう" = 5 code points
  });

  it("14. ruby placed at a column boundary composes correctly on the next column, annotation geometry unaffected by the column cut", () => {
    // 3 chars/line-worth of capacity so a plain-text line before the ruby
    // consumes exactly one column's own capacity, forcing the ruby onto the
    // next column.
    const settingsPage = makePageSettings({ lineExtentTicks: CELL * 3, columnExtentTicks: CELL * 1, columnsPerPage: 2 });
    const units: LogicalUnit[] = [text("あいう", 0), ruby("東京", "とうきょう", 3)];
    const doc = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings: settingsPage });
    expect(doc.hold).toBe(false);
    expect(doc.pages[0].columns.length).toBeGreaterThanOrEqual(2);
    const col2Line0 = doc.pages[0].columns[1].lines[0];
    const rubyPlaced = col2Line0.placedUnits.find((p) => p.sourceSpan.start === 3);
    expect(rubyPlaced).toBeDefined();
    expect(rubyPlaced!.rubyBoundaryPolicy).toBeDefined();
  });

  it("15. ruby placed at a page boundary composes correctly on the next page, annotation geometry unaffected by the page cut", () => {
    const settingsPage = makePageSettings({ lineExtentTicks: CELL * 3, columnExtentTicks: CELL * 1, columnsPerPage: 1 });
    const units: LogicalUnit[] = [text("あいう", 0), ruby("東京", "とうきょう", 3)];
    const doc = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings: settingsPage });
    expect(doc.hold).toBe(false);
    expect(doc.pages.length).toBeGreaterThanOrEqual(2);
    const page2Line0 = doc.pages[1].columns[0].lines[0];
    const rubyPlaced = page2Line0.placedUnits.find((p) => p.sourceSpan.start === 3);
    expect(rubyPlaced).toBeDefined();
    expect(rubyPlaced!.rubyBoundaryPolicy).toBeDefined();
  });

  it("16. source mapping is preserved — the placed ruby atom's sourceSpan equals the base span (or the exact segment span), never fabricated", () => {
    const r = ruby("東京", "とうきょう", 5);
    const result = composeLine([r], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, false);
    expect(result.line.placedUnits[0].sourceSpan).toEqual(span(5, 7));
  });

  it("17. body placement invariant — xTick/yTick/sourceSpan for every atom are identical to a plain cumulative-advance model, whether or not ruby annotation fields are attached", () => {
    const units: LogicalUnit[] = [text("あ", 0), ruby("東京", "とうきょう", 1), text("い", 3)];
    const result = composeLine(units, DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, false);
    // Expected cumulative yTick sequence: "あ"=1 cell, ruby="東京"=2 cells, "い"=1 cell.
    expect(result.line.placedUnits.map((p) => p.yTick)).toEqual([0, CELL, CELL * 3]);
    expect(result.line.placedUnits.map((p) => p.xTick)).toEqual([0, 0, 0]);
    expect(result.line.placedUnits.map((p) => p.sourceSpan)).toEqual([span(0, 1), span(1, 3), span(3, 4)]);
  });

  it("18. same input + same MeasurementFacts -> deterministic annotation geometry", () => {
    const units: LogicalUnit[] = [text("あ", 0), ruby("東京", "とうきょう", 1)];
    const a = composeLine(units, DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, false);
    const b = composeLine(units, DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, false);
    expect(b.line.placedUnits).toEqual(a.line.placedUnits);
  });
});
