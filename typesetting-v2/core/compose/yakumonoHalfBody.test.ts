// Human Visual QA HOLD round 11 (yakumono half-body canonical model —
// qa/evidence/P3_O08_YAKUMONO_HALF_BODY_MODEL.md): SUPERSEDES round 8's
// "full-em body + negative pair adjustment" model (the old
// core/compose/yakumonoSpacing.test.ts asserted THAT model and has been
// removed, not left standing as a false record — its numeric assertions
// are wrong under the new model, proven directly below).
//
// New model, verified against every worked numeric example this round's
// own task text gives explicitly: opening brackets (cl-01), closing
// brackets (cl-02), full stops (cl-06), commas (cl-07) each have an
// INTRINSIC half-em canonical body — never a full em that gets negatively
// adjusted — plus an EXPLICIT, class-rule-driven side space.

import { describe, expect, it } from "vitest";
import { createFakeMeasurementProvider } from "../measurement/fakeProvider";
import { DEFAULT_RULE_SET_V2 } from "../rules/defaultRuleSet";
import type { SourceSpan } from "../source/span";
import type { LogicalUnit, SemanticRunUnit, TCYUnit, TextUnit } from "../units";
import { composeLine, type CompositionSettings } from "./line";

const BLOCK = "yakumono-half-body-1";
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

describe("Yakumono half-body model -- intrinsic body advance", () => {
  it("cl-01 (opening bracket) alone: body = 0.5em (its own advanceTick, isolated from side-space effects, measured via a following ordinary character that adds no leading space of its own)", () => {
    // あ「い: 「's own advanceTick = body(0.5, cl-01 has no trailing space by default) + 0 (next=い, ordinary, not cl-01) = 0.5.
    const p = pitches([text("あ「い", 0)]);
    expect(p[1]).toBe(HALF_CELL);
  });

  it("cl-02 (closing bracket) alone: body = 0.5em, plus its own default trailing space before ordinary text = 1.0em total pitch", () => {
    // あ」い: 」's own advanceTick = body(0.5) + trailing space (0.5, next=い ordinary, not in scope) = 1.0.
    const p = pitches([text("あ」い", 0)]);
    expect(p[1]).toBe(CELL);
  });

  it("cl-06 (full stop) alone: body 0.5em + trailing space 0.5em before ordinary text = 1.0em total pitch (this round's own た。次 worked example)", () => {
    const p = pitches([text("た。次", 0)]);
    expect(p[1]).toBe(CELL);
  });

  it("cl-07 (comma) alone: same as cl-06", () => {
    const p = pitches([text("た、次", 0)]);
    expect(p[1]).toBe(CELL);
  });
});

describe("Yakumono half-body model -- glyph visual size is NEVER derived from canonical body/space (round 9's own fix, not regressed)", () => {
  it("canonical body compression is a Core/composition concept only -- this file asserts nothing about Publication paint font size (covered separately in renderer/publication/glyphSizeIndependence.test.ts)", () => {
    // Structural note only: Core has no font-size concept at all (Contract §18) -- this test exists to document the boundary, not to re-assert Publication's own already-covered invariant.
    expect(true).toBe(true);
  });
});

describe("Yakumono half-body model -- た。」 (this round's own explicit worked example)", () => {
  it("た。」 -- た=1.0em body, 。=0.5em body with NO trailing space (next is cl-02), 」=0.5em body -- 。and」 together total exactly 1.0em, not 1.5em", () => {
    const p = pitches([text("た。」", 0)]);
    // pitches[0] = た->。 = た's own advanceTick = 1.0em (ordinary, unaffected).
    expect(p[0]).toBe(CELL);
    // pitches[1] = 。->」 = 。's own advanceTick = body(0.5) + 0 (suppressed, next=cl-02) = 0.5em.
    expect(p[1]).toBe(HALF_CELL);
  });

  it("「今日は、雨だった。」 -- the original reported symptom fixture: 。→」 pitch is exactly HALF_CELL (0.5em), not compressed via any negative adjustment on a full-em body", () => {
    const unit = text("「今日は、雨だった。」", 0);
    const p = pitches([unit]);
    // 「 今 日 は 、 雨 だ っ た 。 」
    // index:  0  1  2  3  4  5  6  7  8  9  10
    const period = p[9]; // 。->」
    expect(period).toBe(HALF_CELL);
  });
});

describe("Yakumono half-body model -- full class-pair truth table (data-driven, no hardcoded literal characters in the production rule itself)", () => {
  it("ordinary -> cl-06 pitch equals ordinary body (1em) -- period attaches directly, no gap added before it", () => {
    const p = pitches([text("あ。い", 0)]);
    expect(p[0]).toBe(CELL); // あ (ordinary) -> 。 : あ's own advance is untouched (1em), the period's own body/space live on ITS OWN advanceTick (p[1]), not あ's.
  });

  it("cl-06 + ordinary: period contributes body+trailing-space = 1em", () => {
    const p = pitches([text("あ。い", 0)]);
    expect(p[1]).toBe(CELL);
  });

  it("ordinary + cl-07 (comma): same pattern as cl-06", () => {
    const p = pitches([text("あ、い", 0)]);
    expect(p[0]).toBe(CELL);
    expect(p[1]).toBe(CELL);
  });

  it("ordinary + cl-01 (opening bracket): a leading half-em space is added before the bracket -- あ's own advanceTick includes it", () => {
    const p = pitches([text("あ「い", 0)]);
    // あ -> 「: あ is ordinary, not in scope; but 「 (next) is cl-01, mayEndLine=false -> leading space rule fires on THIS boundary regardless of あ's own class.
    expect(p[0]).toBe(CELL + HALF_CELL);
  });

  it("cl-01 + ordinary: opening bracket has no default trailing space -- body only", () => {
    const p = pitches([text("あ「い", 0)]);
    expect(p[1]).toBe(HALF_CELL);
  });

  it("ordinary + cl-02 (closing bracket): no leading space before a closing bracket", () => {
    const p = pitches([text("あ」い", 0)]);
    expect(p[0]).toBe(CELL);
  });

  it("cl-02 + ordinary: closing bracket contributes body+trailing-space = 1em", () => {
    const p = pitches([text("あ」い", 0)]);
    expect(p[1]).toBe(CELL);
  });

  it("cl-06 + cl-02 (。」): period's trailing space suppressed (next is in scope) -- period's own advance is body-only", () => {
    const p = pitches([text("あ。」い", 0)]);
    expect(p[1]).toBe(HALF_CELL); // 。's own advanceTick
  });

  it("cl-07 + cl-02 (、」): same suppression as cl-06+cl-02", () => {
    const p = pitches([text("あ、」い", 0)]);
    expect(p[1]).toBe(HALF_CELL);
  });

  it("cl-02 + cl-01 (」「): the leading-space rule for a next=cl-01 boundary takes priority over the closing bracket's own (suppressed) trailing-space rule -- 」's own advanceTick = body(0.5) + leading-space-for-「(0.5) = 1.0 (the leading-space rule is keyed on the boundary, not on which side 'owns' it, so it still applies here even though 」 itself is closing-type)", () => {
    const p = pitches([text("あ」「い", 0)]);
    expect(p[1]).toBe(CELL);
  });

  it("cl-01 + cl-01 (「「): leading-space rule fires unconditionally for a next=cl-01 boundary, regardless of current's own class -- documented, deterministic choice (this round's own task text states the cl-01 leading-space rule as an unconditional default; no worked numeric example was given for this specific pair, so this is the explicit, disclosed, class-rule-driven answer, not a guess). First 「's own advanceTick = body(0.5) + leading-space-for-second-「(0.5) = 1.0", () => {
    const p = pitches([text("あ「「い", 0)]);
    expect(p[1]).toBe(CELL);
  });

  it("cl-02 + cl-02 (」」): closing-bracket trailing space suppressed (next also in scope) -- body only", () => {
    const p = pitches([text("あ」」い", 0)]);
    expect(p[1]).toBe(HALF_CELL);
  });
});

describe("Yakumono half-body model -- structurally excluded unit kinds (unchanged from round 8's own exclusion)", () => {
  it("SEMANTIC_RUN (Dash) atoms are never given a half-body treatment, even adjacent to a real yakumono character", () => {
    const dash: SemanticRunUnit = { kind: "SEMANTIC_RUN", span: span(0, 2), runKind: "DASH", length: 2 };
    const period = text("。", 2);
    const p = pitches([dash, period]);
    expect(p[0]).toBe(CELL * 2); // whole 2-glyph dash run's own advance, unchanged
  });

  it("TCY atoms are never given a half-body treatment", () => {
    const tcy: TCYUnit = { kind: "TCY", span: span(0, 2), displayText: "12", logicalCells: 1 };
    const period = text("。", 2);
    const bracket = text("」", 3);
    const p = pitches([tcy, period, bracket]);
    // 。->」 still correctly suppressed (both TEXT, both in scope) regardless of the preceding TCY atom.
    expect(p[1]).toBe(HALF_CELL);
  });
});

describe("Yakumono half-body model -- cl-05 deliberately left open, not folded into this scope", () => {
  it("middle dot (・, cl-05) is unaffected -- keeps its full 1em body, no half-body/side-space treatment applied", () => {
    const p = pitches([text("あ・い", 0)]);
    expect(p[0]).toBe(CELL);
    expect(p[1]).toBe(CELL);
  });
});

describe("Yakumono half-body model -- invariants", () => {
  it("source is never mutated by composeLine", () => {
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
    const unit = text("あいうえお、かきくけこ。」さしすせそ", 0);
    const result = composeLine([unit], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 6, false);
    const firstChar = Array.from("あいうえお、かきくけこ。」さしすせそ")[result.consumedThroughOffset];
    if (firstChar !== undefined) {
      expect(["、", "。", "」"]).not.toContain(firstChar);
    }
  });

  it("Natural Pitch is never stretched to fill -- residualSpaceTick reflects real leftover extent; the half-body model only ever shrinks specific bodies below 1em, never grows anything beyond 1em per character-equivalent", () => {
    const unit = text("あ「」い", 0);
    const result = composeLine([unit], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 10, false);
    const totalAdvance = CELL * 10 - result.residualSpaceTick;
    // あ's own advanceTick = body(1.0, ordinary) + leading-space-for-following-「(0.5) = CELL+HALF_CELL.
    // 「's own advanceTick = body(0.5, no trailing since next=」 is in scope but not cl-01) = HALF_CELL.
    // 」's own advanceTick = body(0.5) + trailing-space(0.5, next=い ordinary) = CELL.
    // い's own advanceTick = body(1.0, ordinary, no yakumono interaction) = CELL.
    expect(totalAdvance).toBe(CELL + HALF_CELL + HALF_CELL + CELL + CELL);
  });
});
