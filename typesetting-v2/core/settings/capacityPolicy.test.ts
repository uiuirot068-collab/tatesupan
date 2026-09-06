import { describe, expect, it } from "vitest";
import { deriveCapacityForEvent, initializeNewDocumentCapacity } from "./capacityPolicy";
import { deriveLegacyFrozenCapacity } from "./capacityLegacyFrozen";
import { PRODUCTION_PRESET_FIXTURES_MM, toLegacyInputMm, toV2InputMm } from "./capacityFixtures";
import { createFakeMeasurementProvider } from "../measurement/fakeProvider";

function findFixture(name: string) {
  const fixture = PRODUCTION_PRESET_FIXTURES_MM.find((f) => f.name === name);
  if (!fixture) throw new Error(`fixture not found: ${name}`);
  return fixture;
}

const measurement = createFakeMeasurementProvider();
const a5 = findFixture("A5 1段");
const inputFor = (name: string) => ({
  legacyInputMm: toLegacyInputMm(findFixture(name)),
  v2InputMm: toV2InputMm(findFixture(name)),
});

describe("deriveCapacityForEvent — version resolution (test groups A/B)", () => {
  it("missing version -> legacy-frozen", () => {
    const result = deriveCapacityForEvent(undefined, "documentOpen", inputFor("A5 1段"), measurement);
    expect(result.formulaVersion).toBe("legacy-frozen");
  });

  it("explicit v2 version -> v2-native, for every event (no downgrade path)", () => {
    for (const event of ["documentOpen", "ordinarySave", "unrelatedSettingsEdit", "explicitGeometryCommit"] as const) {
      const result = deriveCapacityForEvent("v2-1", event, inputFor("A5 1段"), measurement);
      expect(result.formulaVersion).toBe("v2-1");
    }
  });
});

describe("deriveCapacityForEvent — migration trigger (test groups C/D/E)", () => {
  it("opening a legacy document does not migrate it", () => {
    const result = deriveCapacityForEvent(undefined, "documentOpen", inputFor("A5 1段"), measurement);
    expect(result.formulaVersion).toBe("legacy-frozen");
  });

  it("an ordinary save of a legacy document does not migrate it", () => {
    const result = deriveCapacityForEvent(undefined, "ordinarySave", inputFor("A5 1段"), measurement);
    expect(result.formulaVersion).toBe("legacy-frozen");
  });

  it("an unrelated settings edit does not migrate a legacy document", () => {
    const result = deriveCapacityForEvent(undefined, "unrelatedSettingsEdit", inputFor("A5 1段"), measurement);
    expect(result.formulaVersion).toBe("legacy-frozen");
  });

  it("an explicit geometry commit migrates a legacy document to v2-native", () => {
    const result = deriveCapacityForEvent(undefined, "explicitGeometryCommit", inputFor("A5 1段"), measurement);
    expect(result.formulaVersion).toBe("v2-1");
  });
});

describe("deriveCapacityForEvent — legacy persisted target stays geometry-clamped (test group F)", () => {
  it("an impossible legacy target is still clamped, never trusted outright", () => {
    const result = deriveCapacityForEvent(
      undefined,
      "documentOpen",
      {
        legacyInputMm: toLegacyInputMm(a5, { charsPerLine: 9999, linesPerColumn: 9999 }),
        v2InputMm: toV2InputMm(a5),
      },
      measurement
    );
    expect(result.formulaVersion).toBe("legacy-frozen");
    expect(result.charsPerLine).toBeLessThan(9999);
    expect(result.charsPerLine).toBe(54); // computeMaxCapacityChars clamp, per audit §10
  });
});

describe("deriveCapacityForEvent — diagnostic metadata distinguishes the two paths (test group P)", () => {
  it("a legacy-frozen result carries `legacy`, never `v2`", () => {
    const result = deriveCapacityForEvent(undefined, "documentOpen", inputFor("A5 1段"), measurement);
    expect(result.formulaVersion).toBe("legacy-frozen");
    if (result.formulaVersion === "legacy-frozen") {
      expect(result.legacy).toBeDefined();
      expect(result.legacy.fontSizeTick).toBeGreaterThan(0);
    }
  });

  it("a v2-native result carries `v2`, never `legacy`", () => {
    const result = deriveCapacityForEvent(undefined, "explicitGeometryCommit", inputFor("A5 1段"), measurement);
    expect(result.formulaVersion).toBe("v2-1");
    if (result.formulaVersion === "v2-1") {
      expect(result.v2).toBeDefined();
      expect(result.v2.advanceTick).toBeGreaterThan(0);
    }
  });
});

describe("initializeNewDocumentCapacity — new-document policy (points 6/7)", () => {
  it("a brand-new document starts legacy-frozen, matching the live legacy formula's own preset output", () => {
    const result = initializeNewDocumentCapacity(inputFor("文庫 1段"), measurement);
    expect(result.formulaVersion).toBe("legacy-frozen");
    const expected = deriveLegacyFrozenCapacity(toLegacyInputMm(findFixture("文庫 1段")));
    expect(result.charsPerLine).toBe(expected.charsPerLine);
    expect(result.linesPerColumn).toBe(expected.linesPerColumn);
    // Specifically NOT the stale PAPER_SIZE_TEMPLATES literal (38x16, audit §6/§10).
    expect([result.charsPerLine, result.linesPerColumn]).not.toEqual([38, 16]);
  });
});

describe("determinism across the dispatch layer (test group N)", () => {
  it("same version + same inputs + same MeasurementFacts -> same capacity", () => {
    const input = inputFor("B6 1段");
    const a = deriveCapacityForEvent("v2-1", "documentOpen", input, measurement);
    const b = deriveCapacityForEvent("v2-1", "documentOpen", input, measurement);
    expect(a).toEqual(b);
  });
});
