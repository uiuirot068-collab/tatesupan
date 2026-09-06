import { describe, expect, it } from "vitest";
import { createFakeMeasurementProvider } from "../measurement/fakeProvider";
import { DEFAULT_RULE_SET_V2 } from "../rules/defaultRuleSet";
import { CORE_SCHEMA_VERSION } from "../version";
import { buildVersionMetadata, measurementIdentityFor, settingsVersionFor } from "./assemble";

describe("buildVersionMetadata (Contract §25)", () => {
  const measurement = createFakeMeasurementProvider();
  const settings = { bodyFontRef: "body", bodyFontSizePt: 10 };

  it("populates every field non-empty on every assembled document", () => {
    const version = buildVersionMetadata(DEFAULT_RULE_SET_V2.id, settings, measurement);
    expect(version.coreSchemaVersion).toBe(CORE_SCHEMA_VERSION);
    expect(version.coreSchemaVersion.length).toBeGreaterThan(0);
    expect(version.ruleSetVersion).toBe(DEFAULT_RULE_SET_V2.id);
    expect(version.settingsVersion.length).toBeGreaterThan(0);
    expect(version.measurementIdentity.length).toBeGreaterThan(0);
  });

  it("is deterministic for identical inputs (INV-005)", () => {
    const a = buildVersionMetadata(DEFAULT_RULE_SET_V2.id, settings, measurement);
    const b = buildVersionMetadata(DEFAULT_RULE_SET_V2.id, settings, measurement);
    expect(a).toEqual(b);
  });

  it("changes settingsVersion when settings actually differ, key order notwithstanding", () => {
    const a = settingsVersionFor({ bodyFontRef: "body", bodyFontSizePt: 10 });
    const b = settingsVersionFor({ bodyFontSizePt: 10, bodyFontRef: "body" }); // same content, different key order
    const c = settingsVersionFor({ bodyFontRef: "body", bodyFontSizePt: 12 }); // actually different
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("measurementIdentityFor", () => {
  it("identifies the provider + version, not a font/size pair", () => {
    const measurement = createFakeMeasurementProvider();
    expect(measurementIdentityFor(measurement)).toBe(
      `${measurement.providerId}@${measurement.providerVersion}`
    );
  });
});
