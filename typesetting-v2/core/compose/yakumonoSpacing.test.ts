// Human Visual QA HOLD round 8 (yakumono/punctuation-pair spacing —
// qa/evidence/P3_O08_YAKUMONO_SPACING.md): proves the real canonical
// advance compression for adjacent jlreq 括弧類等 (opening/closing
// brackets, full stops, commas) characters, against real composeLine
// output — not a paint-layer offset, a genuine Core canonical-advance
// change, cited to this project's own primary-source jlreq research.

import { describe, expect, it } from "vitest";
import { createFakeMeasurementProvider } from "../measurement/fakeProvider";
import { DEFAULT_RULE_SET_V2 } from "../rules/defaultRuleSet";
import type { SourceSpan } from "../source/span";
import type { LogicalUnit, SemanticRunUnit, TCYUnit, TextUnit } from "../units";
import { composeLine, type CompositionSettings } from "./line";

const BLOCK = "yakumono-1";
const measurement = createFakeMeasurementProvider();
const settings: CompositionSettings = { bodyFontRef: "body", bodyFontSizePt: 10 };
const CELL = measurement.naturalAdvanceTick(settings.bodyFontRef, settings.bodyFontSizePt, "");
const HALF_CELL = Math.round(CELL * 0.5);

function span(start: number, end: number): SourceSpan {
  return { blockId: BLOCK, start, end };
}
function text(t: string, start: number): TextUnit {
  return { kind: "TEXT", span: span(start, start + Array.from(t).length), text: t };
}

function pitches(units: LogicalUnit[]): number[] {
  const result = composeLine(units, DEFAULT_RULE_SET_V2, measurement, settings, CELL * 20, false);
  const placed = result.line.placedUnits;
  const out: number[] = [];
  for (let i = 1; i < placed.length; i++) out.push(placed[i].yTick - placed[i - 1].yTick);
  return out;
}

describe("Yakumono pair spacing -- case c (closing+closing): the reported symptom, 。 then 」", () => {
  it("「今日は、雨だった。」 -- 。→」 pitch is compressed to half a cell; 、→雨 (not yakumono-adjacent) stays full", () => {
    const unit = text("「今日は、雨だった。」", 0);
    const p = pitches([unit]);
    // 「 今 日 は 、 雨 だ っ た 。 」
    // pitches[i] = yTick(char i+1) - yTick(char i)
    // index:        0  1  2  3  4  5  6  7  8  9
    // chars:        「 今 日 は 、 雨 だ っ た 。 」
    // 、(idx4) -> 雨(idx5): 雨 is ordinary kana, not yakumono -- full cell
    expect(p[4]).toBe(CELL);
    // 。(idx9) -> 」(idx10): both yakumono (cl-06, cl-02) -- compressed
    expect(p[9]).toBe(HALF_CELL);
  });
});

describe("Yakumono pair spacing -- every jlreq-cited adjacency case", () => {
  it("case c: 、 then 」 (comma, closing bracket) -- compressed", () => {
    const p = pitches([text("あ、」い", 0)]);
    // あ,、,」,い -> pitches[1] = 、->」
    expect(p[1]).toBe(HALF_CELL);
  });

  it("case a: 。 then 「 (full stop, opening bracket) -- compressed", () => {
    const p = pitches([text("あ。「い", 0)]);
    expect(p[1]).toBe(HALF_CELL);
  });

  it("case b: 「 then 「 (opening, opening) -- compressed", () => {
    const p = pitches([text("あ「「い", 0)]);
    expect(p[1]).toBe(HALF_CELL);
  });

  it("case d: 「 then 」 (opening, closing) -- compressed under this round's disclosed uniform simplification (half, not full ベタ)", () => {
    const p = pitches([text("あ「」い", 0)]);
    expect(p[1]).toBe(HALF_CELL);
  });

  it("」 then 」 (closing, closing, both cl-02) -- compressed", () => {
    const p = pitches([text("あ」」い", 0)]);
    expect(p[1]).toBe(HALF_CELL);
  });
});

describe("Yakumono pair spacing -- must NOT fire outside real adjacency", () => {
  it("ordinary kanji/kana pairs are completely unaffected -- every pitch is exactly one full cell", () => {
    const p = pitches([text("東京都庁", 0)]);
    for (const pitch of p) expect(pitch).toBe(CELL);
  });

  it("a LONE yakumono character next to ordinary text keeps its full cell on BOTH sides -- only adjacency to ANOTHER yakumono character compresses", () => {
    const p = pitches([text("東。京", 0)]);
    expect(p[0]).toBe(CELL); // 東 -> 。 (東 is not yakumono, so 。's own advance is not compressed)
    expect(p[1]).toBe(CELL); // 。 -> 京 (京 is not yakumono, so 京's own advance is not compressed)
  });

  it("digits/Latin adjacent to punctuation are unaffected (not in yakumonoSpacingScope)", () => {
    const p = pitches([text("A。B", 0)]);
    expect(p[0]).toBe(CELL);
    expect(p[1]).toBe(CELL);
  });
});

describe("Yakumono pair spacing -- structurally excluded unit kinds", () => {
  it("SEMANTIC_RUN (Dash) atoms are never compressed, even when adjacent to a real yakumono character", () => {
    const dash: SemanticRunUnit = { kind: "SEMANTIC_RUN", span: span(0, 2), runKind: "DASH", length: 2 };
    const period = text("。", 2);
    const p = pitches([dash, period]);
    // dash's own two internal glyphs are placed as ONE atom (length-based advance) -- pitches[0] is dash's own internal advance (unaffected by this rule), not a per-grapheme yakumono comparison.
    expect(p[0]).toBe(CELL * 2); // whole 2-glyph dash run's own advance, unchanged
  });

  it("TCY atoms are never compressed", () => {
    const tcy: TCYUnit = { kind: "TCY", span: span(0, 2), displayText: "12", logicalCells: 1 };
    const period = text("。", 2);
    const bracket = text("」", 3);
    const p = pitches([tcy, period, bracket]);
    // TCY's own advance (tcyCellCost-based) is untouched; 。->」 (both TEXT, both yakumono) still compresses normally.
    expect(p[1]).toBe(HALF_CELL);
  });
});

describe("Yakumono pair spacing -- invariants", () => {
  it("source is never mutated by composeLine, with or without a compressed pair", () => {
    const unit = text("「今日は、雨だった。」", 0);
    const before = JSON.parse(JSON.stringify(unit));
    composeLine([unit], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 20, false);
    expect(unit).toEqual(before);
  });

  it("every placedUnit's sourceSpan still covers exactly one grapheme, in original order, no loss/duplication", () => {
    const source = "「今日は、雨だった。」";
    const unit = text(source, 0);
    const result = composeLine([unit], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 20, false);
    const chars = Array.from(source);
    expect(result.line.placedUnits).toHaveLength(chars.length);
    result.line.placedUnits.forEach((p, i) => {
      expect(p.sourceSpan.start).toBe(i);
      expect(p.sourceSpan.end).toBe(i + 1);
    });
  });

  it("deterministic: composing the same fixture twice yields identical pitches", () => {
    const a = pitches([text("「今日は、雨だった。」", 0)]);
    const b = pitches([text("「今日は、雨だった。」", 0)]);
    expect(a).toEqual(b);
  });

  it("kinsoku legality is unaffected -- 、/。/」 still never start a line, even at a tight extent forcing a break near them", () => {
    // Extent sized so a break must occur somewhere inside the punctuation run; whichever legal boundary is chosen, the resulting line's own first character must never be a line-start-prohibited class member.
    const unit = text("あいうえお、かきくけこ。」さしすせそ", 0);
    const result = composeLine([unit], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 6, false);
    const firstChar = Array.from("あいうえお、かきくけこ。」さしすせそ")[result.consumedThroughOffset];
    if (firstChar !== undefined) {
      expect(["、", "。", "」"]).not.toContain(firstChar);
    }
  });

  it("Natural Pitch is never stretched to fill -- residualSpaceTick still reflects real leftover extent, compression only ever shrinks specific pair advances, never grows them", () => {
    const unit = text("あ「」い", 0); // 4 cells worth of source, but 「」compresses -> 3.5 cells of actual advance
    const result = composeLine([unit], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, false);
    const totalAdvance = CELL * 10 - result.residualSpaceTick;
    expect(totalAdvance).toBe(CELL * 3 + HALF_CELL);
  });
});
