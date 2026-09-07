// Human Visual QA HOLD round 14, Part 2 — the narrow cl-06/cl-07 -> cl-02
// pair-advance-suppression rule in `computeAtoms` (core/compose/line.ts).
// Explicitly NOT a re-introduction of round 8's `applyYakumonoCompression`
// or round 11's `yakumonoHalfBodyScope` (both global, both deleted) — a
// single, scoped pair rule evaluated via the existing
// `RuleSetVersion.characterClassFor` lookup, never a hardcoded character.

import { describe, expect, it } from "vitest";
import { createFakeMeasurementProvider } from "../measurement/fakeProvider";
import { DEFAULT_RULE_SET_V2 } from "../rules/defaultRuleSet";
import type { SourceSpan } from "../source/span";
import type { TextUnit } from "../units";
import { composeLine, type CompositionSettings } from "./line";

const BLOCK = "body-1";
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

function composeFull(t: string) {
  const unit = text(t, 0);
  return composeLine([unit], DEFAULT_RULE_SET_V2, measurement, settings, CELL * 20, false);
}

describe("Round 14 conditional pair rule -- controls (ordinary text must NOT move)", () => {
  it("た。次 -- 。 followed by ordinary text keeps its full, uniform 1-cell advance (test 4)", () => {
    const result = composeFull("た。次");
    expect(result.hold).toBeUndefined();
    const p = result.line.placedUnits;
    expect(p[1].yTick - p[0].yTick).toBe(CELL); // た -> 。
    expect(p[2].yTick - p[1].yTick).toBe(CELL); // 。 -> 次 (unchanged)
  });

  it("た、次 -- 、 followed by ordinary text keeps its full, uniform 1-cell advance (test 5)", () => {
    const result = composeFull("た、次");
    const p = result.line.placedUnits;
    expect(p[1].yTick - p[0].yTick).toBe(CELL);
    expect(p[2].yTick - p[1].yTick).toBe(CELL);
  });
});

describe("Round 14 conditional pair rule -- cl-06/cl-07 -> cl-02 suppression", () => {
  it("た。」 -- 。 immediately before a closing bracket (cl-02) has its own advance reduced by half a cell (test 6)", () => {
    const result = composeFull("た。」");
    const p = result.line.placedUnits;
    expect(p[1].yTick - p[0].yTick).toBe(CELL); // た -> 。 unaffected (た is not cl-06/07)
    expect(p[2].yTick - p[1].yTick).toBe(CELL - HALF_CELL); // 。 -> 」 suppressed
  });

  it("た、」 -- 、 immediately before a closing bracket (cl-02) receives the SAME class rule (test 7)", () => {
    const result = composeFull("た、」");
    const p = result.line.placedUnits;
    expect(p[1].yTick - p[0].yTick).toBe(CELL);
    expect(p[2].yTick - p[1].yTick).toBe(CELL - HALF_CELL);
  });

  it("cl-06 -> cl-02 and cl-07 -> cl-02 are suppressed by the exact same amount (standards-backed half-em, not two different tuned values)", () => {
    const periodPitch = composeFull("た。」").line.placedUnits;
    const commaPitch = composeFull("た、」").line.placedUnits;
    const periodGap = periodPitch[2].yTick - periodPitch[1].yTick;
    const commaGap = commaPitch[2].yTick - commaPitch[1].yTick;
    expect(periodGap).toBe(commaGap);
  });
});

describe("Round 14 conditional pair rule -- does not become a global model", () => {
  it("」次 -- a closing bracket followed by ordinary text is NOT affected (cl-02 is not cl-06/cl-07 -- rule only fires on the punctuation SIDE)", () => {
    const result = composeFull("」次");
    const p = result.line.placedUnits;
    expect(p[1].yTick - p[0].yTick).toBe(CELL);
  });

  it("先「次 -- an opening bracket (cl-01) is never a trigger for this rule, before or after", () => {
    const result = composeFull("先「次");
    const p = result.line.placedUnits;
    expect(p[1].yTick - p[0].yTick).toBe(CELL);
    expect(p[2].yTick - p[1].yTick).toBe(CELL);
  });

  it("。。 -- two consecutive cl-06 characters: the rule never fires (next class is cl-06, not cl-02)", () => {
    const result = composeFull("。。");
    const p = result.line.placedUnits;
    expect(p[1].yTick - p[0].yTick).toBe(CELL);
  });
});

describe("Round 14 conditional pair rule -- invariants (Core Contract safety)", () => {
  it("source is never mutated (test 10)", () => {
    const before = text("た。」", 0);
    const beforeCopy = JSON.parse(JSON.stringify(before));
    composeFull("た。」");
    expect(before).toEqual(beforeCopy);
  });

  it("SourceSpan is preserved end-to-end, one grapheme per placedUnit, in order (test 11)", () => {
    const source = "た。」";
    const result = composeFull(source);
    const chars = Array.from(source);
    expect(result.line.placedUnits).toHaveLength(chars.length);
    result.line.placedUnits.forEach((p, i) => {
      expect(p.sourceSpan.start).toBe(i);
      expect(p.sourceSpan.end).toBe(i + 1);
    });
  });

  it("composing the same source twice yields byte-identical CanonicalLine output (test 12, determinism)", () => {
    const a = composeFull("「今日は、雨だった。」");
    const b = composeFull("「今日は、雨だった。」");
    expect(a.line).toEqual(b.line);
  });

  it("っ's own canonical advance is completely unaffected by this rule -- it is not cl-06/cl-07/cl-02 (test 1/2, small kana)", () => {
    const result = composeFull("だった");
    const p = result.line.placedUnits;
    expect(p[1].yTick - p[0].yTick).toBe(CELL); // だ -> っ
    expect(p[2].yTick - p[1].yTick).toBe(CELL); // っ -> た
  });
});
