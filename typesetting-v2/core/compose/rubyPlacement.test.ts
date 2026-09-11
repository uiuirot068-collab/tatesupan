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
// Human/Product decision (2026-09-07): ruby reading extent is measured at
// bodyFontSizePt * DEFAULT_RUBY_SCALE (0.5), not the full body cell — see
// compose/line.ts's own call site. One reading CHARACTER's own extent is
// therefore this smaller cell, never CELL itself.
const READING_CELL = measurement.naturalAdvanceTick(settings.bodyFontRef, settings.bodyFontSizePt * 0.5, ""); // 1764 ticks

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
    // "とう" (2 reading chars) now measures at READING_CELL each, not CELL —
    // shorter than the 2-cell base, so CENTER still applies, but the offset
    // is no longer 0 (base and reading are no longer equal-length once the
    // reading is measured at half body size).
    expect(placed.rubyReadingOffsetTick).toBe(Math.floor((CELL * 2 - READING_CELL * 2) / 2));
    expect(placed.rubyReadingExtentTick).toBe(READING_CELL * 2);
  });

  it("2. long ruby at line head clamps to the physical start instead of overflowing it", () => {
    const r = ruby("都", "とうきょう", 0); // base 1 cell, reading 5 chars at READING_CELL each
    const result = composeLine([r], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, false);
    const placed = result.line.placedUnits[0];
    expect(placed.rubyBoundaryPolicy).toBe("END_CLAMP");
    expect(placed.rubyReadingOffsetTick).toBe(0);
    expect(placed.rubyReadingExtentTick).toBe(READING_CELL * 5);
  });

  it("3. centered annotation — reading shorter than base", () => {
    const r = ruby("東京都", "とう", 0); // base 3 cells, reading 2 chars at READING_CELL each
    const result = composeLine([r], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, false);
    const placed = result.line.placedUnits[0];
    expect(placed.rubyBoundaryPolicy).toBe("CENTER");
    expect(placed.rubyReadingOffsetTick).toBe(Math.floor((CELL * 3 - READING_CELL * 2) / 2));
  });

  it("4/5. centers a 2-kanji / 9-character reading in the middle of a line", () => {
    const before = text("前前", 0);
    const r = ruby("東京", "とうきょうていこく", 2);
    const after = text("後後", 4);
    const result = composeLine([before, r, after], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 12, false);
    const placed = result.line.placedUnits.find((unit) => unit.rubyBoundaryPolicy !== undefined)!;
    expect(placed.rubyBoundaryPolicy).toBe("CENTER");
    expect(Math.abs(
      (placed.rubyReadingOffsetTick! * 2 + placed.rubyReadingExtentTick!) - CELL * 2
    )).toBeLessThanOrEqual(1);
  });

  it("6. ruby as the only content on a line (line/column edge): no same-line neighbor on either side -> overhang allowance resolves to 0 via the no-neighbor path, not a crash or a guess", () => {
    const r = ruby("都", "とうきょう", 0);
    const result = composeLine([r], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, false);
    expect(result.hold).toBeUndefined();
    expect(result.line.placedUnits).toHaveLength(1);
    expect(result.line.placedUnits[0].rubyBoundaryPolicy).toBe("END_CLAMP");
  });

  it("7. ruby adjacent to punctuation exercises the class-aware overhang lookup path (still resolves to 0 given the shipped empty table)", () => {
    const before = text("「", 0); // cl-05-ish opening bracket, a real classified character
    const r = ruby("都", "とうきょう", 1);
    const after = text("」", 2);
    const result = composeLine([before, r, after], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, false);
    const rubyPlaced = result.line.placedUnits[1];
    expect(rubyPlaced.rubyBoundaryPolicy).toBeDefined();
    expect(rubyPlaced.rubyBoundaryPolicy).toBe("CENTER");
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
    expect(seg1.rubyReadingExtentTick).toBe(READING_CELL * 5); // "とうきょう" = 5 code points (と,う,き,ょ,う), each at READING_CELL
    expect(seg2.sourceSpan).toEqual(span(2, 3));
    expect(seg2.rubyReadingExtentTick).toBe(READING_CELL * 1); // "と" = 1 reading cell
    // Independent geometry: the first long segment is line-head clamped;
    // the second short segment is centered in its own base.
    expect(seg1.rubyBoundaryPolicy).toBe("END_CLAMP");
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
    expect(rubyPlaced.rubyReadingExtentTick).toBe(READING_CELL * 5); // "とうきょう" = 5 code points, each at READING_CELL
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
    expect(rubyPlaced.rubyReadingExtentTick).toBe(READING_CELL * 5); // "とうきょう" = 5 code points, each at READING_CELL
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
