import { describe, expect, it } from "vitest";
import { DEFAULT_RULE_SET_V2 } from "../rules/defaultRuleSet";
import type { SourceSpan } from "../source/span";
import type { LogicalUnit, ManualBreakUnit, TextUnit } from "../units";
import { deriveManualBreakDecisions } from "./decision";
import { deriveBreakOpportunities } from "./opportunity";

const BLOCK = "body-1";

function span(start: number, end: number): SourceSpan {
  return { blockId: BLOCK, start, end };
}

describe("deriveManualBreakDecisions (INV-006, test group M)", () => {
  it("always takes a MANUAL_FORCED opportunity, unconditionally", () => {
    const before: TextUnit = { kind: "TEXT", span: span(0, 1), text: "あ" };
    const manualBreak: ManualBreakUnit = { kind: "MANUAL_BREAK", span: span(1, 1) };
    const after: TextUnit = { kind: "TEXT", span: span(1, 2), text: "い" };
    const units: LogicalUnit[] = [before, manualBreak, after];

    const opportunities = deriveBreakOpportunities(units, DEFAULT_RULE_SET_V2);
    const decisions = deriveManualBreakDecisions(opportunities);

    expect(decisions).toEqual([
      {
        opportunity: { position: span(1, 1), reason: "MANUAL_FORCED" },
        taken: true,
        causedBy: "MANUAL_FORCE",
      },
    ]);
  });

  it("never produces a decision for a non-manual opportunity — capacity-dependent decisions are out of this Loop's scope", () => {
    const unit: TextUnit = { kind: "TEXT", span: span(0, 4), text: "abc、" };
    const opportunities = deriveBreakOpportunities([unit], DEFAULT_RULE_SET_V2);
    expect(opportunities.some((o) => o.reason === "PROHIBITED_KINSOKU")).toBe(true);
    expect(deriveManualBreakDecisions(opportunities)).toEqual([]);
  });

  it("is deterministic across repeated calls (INV-005 foundation)", () => {
    const manualBreak: ManualBreakUnit = { kind: "MANUAL_BREAK", span: span(0, 0) };
    const opportunities = deriveBreakOpportunities([manualBreak], DEFAULT_RULE_SET_V2);
    const first = deriveManualBreakDecisions(opportunities);
    const second = deriveManualBreakDecisions(opportunities);
    expect(second).toEqual(first);
  });
});
