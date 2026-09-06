import { describe, expect, it } from "vitest";
import { composePages, type PageCompositionSettings } from "../compose/page";
import { createFakeMeasurementProvider } from "../measurement/fakeProvider";
import { DEFAULT_RULE_SET_V2 } from "../rules/defaultRuleSet";
import type { SourceSpan } from "../source/span";
import type { TextUnit } from "../units";
import { computeHold, holdToLayoutError, type LayoutError, type LayoutWarning } from "./index";

function span(start: number, end: number): SourceSpan {
  return { blockId: "body-1", start, end };
}

describe("computeHold (INV-010)", () => {
  it("returns false when there are zero errors/serious warnings", () => {
    expect(computeHold([], [])).toBe(false);
  });

  it("returns true when any BLOCKS_HOLD error is present", () => {
    const errors: LayoutError[] = [{ sourceSpan: span(0, 1), message: "malformed", severity: "BLOCKS_HOLD" }];
    expect(computeHold(errors, [])).toBe(true);
  });

  it("never downgrades a BLOCKS_HOLD error into a warning's effect — LOCAL_ONLY alone does not hold", () => {
    const errors: LayoutError[] = [{ sourceSpan: span(0, 1), message: "minor", severity: "LOCAL_ONLY" }];
    const warnings: LayoutWarning[] = [{ sourceSpan: span(0, 1), message: "unusual but valid" }];
    expect(computeHold(errors, warnings)).toBe(false);
  });

  it("is deterministic across repeated calls (INV-005 foundation)", () => {
    const errors: LayoutError[] = [{ sourceSpan: span(0, 1), message: "x", severity: "BLOCKS_HOLD" }];
    expect(computeHold(errors, [])).toBe(computeHold(errors, []));
  });
});

describe("F17 — malformed notation / HOLD case (INV-010)", () => {
  const measurement = createFakeMeasurementProvider();
  const CELL = measurement.naturalAdvanceTick("body", 10, "");
  const settings: PageCompositionSettings = {
    bodyFontRef: "body",
    bodyFontSizePt: 10,
    lineExtentTicks: 0, // impossible: no atom can ever fit -- forces a composition hold
    linePitchTicks: CELL,
    columnExtentTicks: CELL * 2,
    columnsPerPage: 1,
  };

  function text(t: string, start: number): TextUnit {
    return { kind: "TEXT", span: span(start, start + Array.from(t).length), text: t };
  }

  it("surfaces the triggering composition hold as a BLOCKS_HOLD LayoutError, never silently downgraded to a warning", () => {
    const unit = text("あ", 0);
    const { hold } = composePages([unit], DEFAULT_RULE_SET_V2, measurement, settings);
    expect(hold).toBeDefined();

    const error = holdToLayoutError(hold!);
    expect(error.severity).toBe("BLOCKS_HOLD");
    expect(error.sourceSpan).toEqual(hold!.sourceSpan);

    expect(computeHold([error], [])).toBe(true);
  });

  it("a document with zero errors/serious warnings has hold === false", () => {
    const workingSettings: PageCompositionSettings = { ...settings, lineExtentTicks: CELL * 3 };
    const unit = text("あ", 0);
    const { hold } = composePages([unit], DEFAULT_RULE_SET_V2, measurement, workingSettings);
    expect(hold).toBeUndefined();
    expect(computeHold([], [])).toBe(false);
  });
});
