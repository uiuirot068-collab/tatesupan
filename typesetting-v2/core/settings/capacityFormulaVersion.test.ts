import { describe, expect, it } from "vitest";
import {
  canMigrateCapacityFormula,
  resolveCapacityFormulaVersion,
  type CapacitySettingsEvent,
} from "./capacityFormulaVersion";

describe("resolveCapacityFormulaVersion", () => {
  it("missing persisted version resolves to legacy-frozen (test group A)", () => {
    expect(resolveCapacityFormulaVersion(undefined)).toBe("legacy-frozen");
  });

  it("a known v2 version resolves as itself (test group B)", () => {
    expect(resolveCapacityFormulaVersion("v2-1")).toBe("v2-1");
  });

  it("an unrecognized value never silently upgrades to a v2 version", () => {
    expect(resolveCapacityFormulaVersion("some-future-unknown-version")).toBe("legacy-frozen");
    expect(resolveCapacityFormulaVersion("")).toBe("legacy-frozen");
  });
});

describe("canMigrateCapacityFormula", () => {
  const events: CapacitySettingsEvent[] = [
    "documentOpen",
    "ordinarySave",
    "unrelatedSettingsEdit",
    "explicitGeometryCommit",
  ];

  it.each(events)("%s", (event) => {
    expect(canMigrateCapacityFormula(event)).toBe(event === "explicitGeometryCommit");
  });
});
