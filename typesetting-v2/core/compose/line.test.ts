import { describe, expect, it } from "vitest";
import { createFakeMeasurementProvider } from "../measurement/fakeProvider";
import { DEFAULT_RULE_SET_V2 } from "../rules/defaultRuleSet";
import type { SourceSpan } from "../source/span";
import { createTraceRecorder } from "../trace";
import type {
  LogicalUnit,
  ManualBreakUnit,
  RubyUnit,
  SemanticRunUnit,
  TCYUnit,
  TextUnit,
} from "../units";
import { composeLine, type CompositionSettings } from "./line";

const BLOCK = "body-1";
const measurement = createFakeMeasurementProvider();
const settings: CompositionSettings = { bodyFontRef: "body", bodyFontSizePt: 10 };
const CELL = measurement.naturalAdvanceTick(settings.bodyFontRef, settings.bodyFontSizePt, "");

function span(start: number, end: number): SourceSpan {
  return { blockId: BLOCK, start, end };
}

function text(t: string, start: number): TextUnit {
  return { kind: "TEXT", span: span(start, start + Array.from(t).length), text: t };
}

describe("F01 — ordinary line fills using natural advances (test group A)", () => {
  it("places every character when the whole sentence fits within the line extent", () => {
    const unit = text("あいうえお", 0); // 5 cells
    const result = composeLine([unit], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, false);
    expect(result.hold).toBeUndefined();
    expect(result.line.placedUnits).toHaveLength(5);
    expect(result.consumedThroughOffset).toBe(5);
  });
});

describe("Residual space is reported, never absorbed (test group B/C, INV-004)", () => {
  it("reports leftover extent as residualSpaceTick rather than stretching pitch", () => {
    const unit = text("あいう", 0); // 3 cells
    const result = composeLine([unit], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, false);
    expect(result.residualSpaceTick).toBe(CELL * 7);
    // Every placed unit's own advance is untouched -- no stretching: the
    // vertical (yTick) pitch between consecutive units is exactly one cell.
    expect(result.line.placedUnits[1].yTick - result.line.placedUnits[0].yTick).toBe(CELL);
  });
});

describe("Human-approved literal yakumono pair mojikumi", () => {
  it("compresses only 。→」 and 、→」 to a half-em origin advance", () => {
    for (const source of ["あ。」", "あ、」"]) {
      const result = composeLine([text(source, 0)], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, false);
      expect(result.line.placedUnits[1].yTick - result.line.placedUnits[0].yTick).toBe(CELL);
      expect(result.line.placedUnits[2].yTick - result.line.placedUnits[1].yTick).toBe(CELL / 2);
    }
  });

  it("keeps ！/？ pairs and ordinary prose at uniform Natural Pitch", () => {
    for (const source of ["あ！」", "あ？」", "あ！？", "あ？！", "あ！？」", "あ？！」", "人は驚きすぎると本当に足が止まるらしい"]) {
      const result = composeLine([text(source, 0)], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 100, false);
      const pitches = result.line.placedUnits.slice(1).map((placed, i) => placed.yTick - result.line.placedUnits[i].yTick);
      expect(pitches.every((pitch) => pitch === CELL)).toBe(true);
    }
  });

  it("does not broaden to other members of cl-06/cl-07 or cl-02", () => {
    for (const source of ["あ．」", "あ，」", "あ。』", "あ、）"]) {
      const result = composeLine([text(source, 0)], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, false);
      expect(result.line.placedUnits[2].yTick - result.line.placedUnits[1].yTick).toBe(CELL);
    }
  });
});

describe("Prohibited boundary is skipped in favor of an earlier legal one (test group D/E)", () => {
  it("extends onto the current line through a line-start-prohibited character when it still fits", () => {
    // "あいう、え" with a 4-cell extent: breaking BEFORE '、' (offset 3) is
    // PROHIBITED_KINSOKU (cl-07), but including '、' on this line and
    // breaking before 'え' (offset 4) is perfectly legal and fits exactly
    // -- correct kinsoku behavior extends onto the line, it does not
    // retreat unnecessarily.
    const unit = text("あいう、え", 0);
    const result = composeLine([unit], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 4, false);
    expect(result.hold).toBeUndefined();
    expect(result.line.placedUnits).toHaveLength(4);
    expect(result.consumedThroughOffset).toBe(4);
  });

  it("retreats to an earlier legal boundary (oidashi) when extending through the prohibited character would overflow", () => {
    // Same text, but a 3-cell extent: '、' at offset 3 doesn't fit at all
    // (would need 4 cells), and breaking right before it (offset 3) is
    // PROHIBITED_KINSOKU -- so the composer must retreat past 'う' as well,
    // cutting at the nearest actually-legal boundary (offset 2, after 'い'),
    // pushing both 'う' and '、' to the next line even though 'う' alone
    // would otherwise have fit.
    const unit = text("あいう、え", 0);
    const result = composeLine([unit], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 3, false);
    expect(result.hold).toBeUndefined();
    expect(result.line.placedUnits).toHaveLength(2);
    expect(result.consumedThroughOffset).toBe(2);
    expect(result.residualSpaceTick).toBe(CELL * 1);
  });
});

describe("Atomic group is never split (test group F)", () => {
  it("keeps a same-kind dash run together even if only part of it would fit", () => {
    const before = text("あ", 0);
    const dash1: SemanticRunUnit = { kind: "SEMANTIC_RUN", span: span(1, 2), runKind: "DASH", length: 1 };
    const dash2: SemanticRunUnit = { kind: "SEMANTIC_RUN", span: span(2, 3), runKind: "DASH", length: 1 };
    const units: LogicalUnit[] = [before, dash1, dash2];
    // Extent fits "あ" (1 cell) + dash1 (1 cell) = 2 cells, but not dash2 --
    // however dash1/dash2 are PROHIBITED_GROUP (cl-08 same-kind), so the
    // composer must not cut between them; it must cut before dash1 instead.
    const result = composeLine(units, DEFAULT_RULE_SET_V2, measurement, settings, CELL * 2, false);
    expect(result.hold).toBeUndefined();
    expect(result.line.placedUnits).toHaveLength(1);
    expect(result.consumedThroughOffset).toBe(1);
  });
});

describe("Jukugo ruby legal/illegal internal boundaries (test group G/H)", () => {
  it("may cut at a declared jukugo segment boundary", () => {
    const jukugo: RubyUnit = {
      kind: "RUBY",
      span: span(0, 4),
      rubyKind: "JUKUGO",
      baseSpan: span(0, 4),
      readingSpan: span(10, 15),
      readingText: "よみかた",
      segments: [
        { baseSpan: span(0, 2), readingSpan: span(10, 12), readingText: "よみ" },
        { baseSpan: span(2, 4), readingSpan: span(12, 15), readingText: "かた" },
      ],
    };
    // Each segment = 2 cells; extent fits exactly the first segment (2
    // cells) but not both (4 cells) -- the declared boundary at offset 2
    // makes this a legal, usable cut.
    const result = composeLine([jukugo], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 2, false);
    expect(result.hold).toBeUndefined();
    expect(result.consumedThroughOffset).toBe(2);
  });

  it("cannot cut inside an undeclared (segments-absent) jukugo group -- holds rather than splitting it", () => {
    const unsegmented: RubyUnit = {
      kind: "RUBY",
      span: span(0, 4),
      rubyKind: "JUKUGO",
      baseSpan: span(0, 4),
      readingSpan: span(10, 15),
      readingText: "よみかた",
    };
    // No internal boundary exists at all (undeclared -> treated as ATOMIC),
    // so a 2-cell extent cannot legally place any part of this 4-cell atom.
    const result = composeLine([unsegmented], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 2, false);
    expect(result.hold).toBeDefined();
    expect(result.hold?.reason).toBe("SINGLE_ATOM_EXCEEDS_LINE_EXTENT");
  });
});

describe("Grapheme cluster is never split (test group I)", () => {
  it("treats a base+combining-mark grapheme as one indivisible cell", () => {
    // "e" + COMBINING ACUTE ACCENT (U+0301), built from explicit escapes
    // (never a literal glyph) so this fixture can't be silently
    // re-normalized into a single precomposed code point by an editor or
    // file-encoding pass -- see graphemeSafety.test.ts's F16 fixture for
    // the same discipline.
    const combiningSequence = "e" + String.fromCharCode(0x0301);
    const unit = text(combiningSequence, 0); // one grapheme, two code points
    const result = composeLine([unit], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 1, false);
    expect(result.hold).toBeUndefined();
    expect(result.line.placedUnits).toHaveLength(1);
    expect(result.line.placedUnits[0].sourceSpan).toEqual(span(0, 2));
  });
});

describe("Too-large atomic unit produces a structured hold, never a guess (test group J)", () => {
  it("holds when a TCY unit alone exceeds the line extent", () => {
    const tcy: TCYUnit = { kind: "TCY", span: span(0, 2), displayText: "12", logicalCells: 1 };
    const result = composeLine([tcy], DEFAULT_RULE_SET_V2, measurement, settings, 0, false);
    expect(result.hold).toEqual({ reason: "SINGLE_ATOM_EXCEEDS_LINE_EXTENT", sourceSpan: span(0, 2) });
    expect(result.line.placedUnits).toHaveLength(0);
  });
});

describe("Determinism (test group K, INV-005)", () => {
  it("produces the same line composition across repeated runs on the same input", () => {
    const units: LogicalUnit[] = [text("あいう、えお「かき", 0)];
    const first = composeLine(units, DEFAULT_RULE_SET_V2, measurement, settings, CELL * 6, false);
    const second = composeLine(units, DEFAULT_RULE_SET_V2, measurement, settings, CELL * 6, false);
    expect(second).toEqual(first);
  });
});

describe("All geometry values are integer ticks (test group L, INV-013)", () => {
  it("never produces a floating-point xTick/yTick/residualSpaceTick", () => {
    const unit = text("あいうえお", 0);
    const result = composeLine([unit], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 3, false);
    for (const placed of result.line.placedUnits) {
      expect(Number.isInteger(placed.xTick)).toBe(true);
      expect(Number.isInteger(placed.yTick)).toBe(true);
    }
    expect(Number.isInteger(result.residualSpaceTick)).toBe(true);
  });
});

describe("Manual forced break ends the line unconditionally (INV-006)", () => {
  it("stops the line at a MANUAL_BREAK even though more content would otherwise fit", () => {
    const before = text("あい", 0);
    const manualBreak: ManualBreakUnit = { kind: "MANUAL_BREAK", span: span(2, 2) };
    const after = text("うえ", 2);
    const units: LogicalUnit[] = [before, manualBreak, after];
    const result = composeLine(units, DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, false);
    expect(result.hold).toBeUndefined();
    expect(result.consumedThroughOffset).toBe(2);
    expect(result.line.placedUnits).toHaveLength(2);
  });
});

describe("Line trace identifies the chosen boundary and RuleSetVersion (test group M)", () => {
  it("records which offset the line was cut at, alongside the RuleSetVersion", () => {
    const unit = text("あいう", 0);
    const recorder = createTraceRecorder(DEFAULT_RULE_SET_V2.id);
    const result = composeLine([unit], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 3, false, recorder);
    expect(recorder.trace.ruleSetVersion).toBe(DEFAULT_RULE_SET_V2.id);
    const cutEvent = recorder.trace.events.find((e) => e.outcome === `LINE_CUT_AT:${result.consumedThroughOffset}`);
    expect(cutEvent).toBeDefined();
  });
});
