import { describe, expect, it } from "vitest";
import { deriveV2NativeCapacity } from "./capacityV2Native";
import { deriveLegacyFrozenCapacity } from "./capacityLegacyFrozen";
import { PRODUCTION_PRESET_FIXTURES_MM, toLegacyInputMm, toV2InputMm } from "./capacityFixtures";
import { createFakeMeasurementProvider } from "../measurement/fakeProvider";
import type { MeasurementFacts } from "../measurement/facts";

function findFixture(name: string) {
  const fixture = PRODUCTION_PRESET_FIXTURES_MM.find((f) => f.name === name);
  if (!fixture) throw new Error(`fixture not found: ${name}`);
  return fixture;
}

const measurement = createFakeMeasurementProvider();

describe("v2-native capacity — corrected geometry (test group H)", () => {
  it("A5 1段: 54 chars x 21 lines (single column — matches the physically-correct value)", () => {
    const result = deriveV2NativeCapacity(toV2InputMm(findFixture("A5 1段")), measurement);
    expect(result.charsPerLine).toBe(54);
    expect(result.linesPerColumn).toBe(21);
  });

  it("A5 2段: uses the ACTUAL per-column height, not the full undivided height", () => {
    const result = deriveV2NativeCapacity(toV2InputMm(findFixture("A5 2段")), measurement);
    // Physically valid: charsPerLine must fit within the real per-column extent.
    expect(result.charsPerLine * result.advanceTick).toBeLessThanOrEqual(result.columnHeightTick);
    expect(result.charsPerLine).toBe(28);
    expect(result.linesPerColumn).toBe(23);
  });

  it("A5 2段: does NOT reproduce the legacy full-height 2-column bug (59 chars/line)", () => {
    const v2 = deriveV2NativeCapacity(toV2InputMm(findFixture("A5 2段")), measurement);
    const legacyBuggyMax = deriveLegacyFrozenCapacity(
      toLegacyInputMm(findFixture("A5 2段"), { charsPerLine: 9999, linesPerColumn: 9999 })
    );
    expect(legacyBuggyMax.charsPerLine).toBe(59); // the bug, still present in the legacy path (by design)
    expect(v2.charsPerLine).not.toBe(59);
    expect(v2.charsPerLine).toBeLessThan(legacyBuggyMax.charsPerLine);
    // The legacy "max" value is physically impossible for the real 85mm-tall column —
    // proven by checking it against v2's own (correct) per-column extent.
    expect(legacyBuggyMax.charsPerLine * v2.advanceTick).toBeGreaterThan(v2.columnHeightTick);
  });
});

describe("v2-native capacity — no stretch-to-fill (test group I, INV-004)", () => {
  it.each(PRODUCTION_PRESET_FIXTURES_MM)(
    "$name: residual space is reported, never redistributed into the pitch",
    (fixture) => {
      const result = deriveV2NativeCapacity(toV2InputMm(fixture), measurement);
      expect(result.charsPerLine * result.advanceTick + result.residualMainAxisTick).toBe(
        result.columnHeightTick
      );
      expect(result.linesPerColumn * result.linePitchTick + result.residualCrossAxisTick).toBe(
        result.textAreaWidthTick
      );
      expect(result.residualMainAxisTick).toBeGreaterThanOrEqual(0);
      expect(result.residualCrossAxisTick).toBeGreaterThanOrEqual(0);
    }
  );
});

describe("v2-native capacity — GeometryTick integers (test group J, Contract §21/INV-013)", () => {
  it.each(PRODUCTION_PRESET_FIXTURES_MM)("$name: every tick field is an integer", (fixture) => {
    const result = deriveV2NativeCapacity(toV2InputMm(fixture), measurement);
    expect(Number.isInteger(result.advanceTick)).toBe(true);
    expect(Number.isInteger(result.linePitchTick)).toBe(true);
    expect(Number.isInteger(result.columnHeightTick)).toBe(true);
    expect(Number.isInteger(result.textAreaWidthTick)).toBe(true);
    expect(Number.isInteger(result.residualMainAxisTick)).toBe(true);
    expect(Number.isInteger(result.residualCrossAxisTick)).toBe(true);
  });
});

describe("v2-native capacity — MeasurementFacts-compatible (test group K)", () => {
  it("a different provider's advance changes capacity deterministically", () => {
    const doubledAdvance: MeasurementFacts = {
      ...measurement,
      naturalAdvanceTick: (fontRef, sizePt, char) => measurement.naturalAdvanceTick(fontRef, sizePt, char) * 2,
    };
    const baseline = deriveV2NativeCapacity(toV2InputMm(findFixture("A5 1段")), measurement);
    const doubled = deriveV2NativeCapacity(toV2InputMm(findFixture("A5 1段")), doubledAdvance);
    expect(doubled.advanceTick).toBe(baseline.advanceTick * 2);
    expect(doubled.charsPerLine).toBeLessThan(baseline.charsPerLine);
  });
});

describe("v2-native capacity — modified geometry (test groups L/M)", () => {
  it("widening margins strictly decreases charsPerLine (文庫 1段)", () => {
    const fixture = findFixture("文庫 1段");
    const baseline = deriveV2NativeCapacity(toV2InputMm(fixture), measurement);
    const widened = deriveV2NativeCapacity(
      toV2InputMm({ ...fixture, marginTopMm: 20, marginBottomMm: 20 }),
      measurement
    );
    expect(widened.charsPerLine).toBeLessThan(baseline.charsPerLine);
    expect(widened.linesPerColumn).toBe(baseline.linesPerColumn); // unaffected axis
  });

  it("increasing font size strictly decreases both charsPerLine and linesPerColumn (文庫 1段)", () => {
    const fixture = findFixture("文庫 1段");
    const baseline = deriveV2NativeCapacity(toV2InputMm(fixture), measurement);
    const largerFont = deriveV2NativeCapacity(toV2InputMm({ ...fixture, fontSizePt: 10 }), measurement);
    expect(largerFont.charsPerLine).toBeLessThan(baseline.charsPerLine);
    expect(largerFont.linesPerColumn).toBeLessThan(baseline.linesPerColumn);
  });
});

describe("v2-native capacity — determinism (test group N)", () => {
  it("same inputs + same MeasurementFacts repeat identically", () => {
    const input = toV2InputMm(findFixture("B5 2段"));
    const a = deriveV2NativeCapacity(input, measurement);
    const b = deriveV2NativeCapacity(input, measurement);
    expect(a).toEqual(b);
  });
});

describe("v2-native capacity — all 8 mandatory presets representable (test group O)", () => {
  it.each(PRODUCTION_PRESET_FIXTURES_MM)("$name derives a valid, positive capacity", (fixture) => {
    const result = deriveV2NativeCapacity(toV2InputMm(fixture), measurement);
    expect(result.charsPerLine).toBeGreaterThan(0);
    expect(result.linesPerColumn).toBeGreaterThan(0);
  });
});
