// Version-metadata wiring only (Core Contract §25). Full CanonicalDocument
// orchestration (composeCanonicalDocument, pages/colophon/trace/hold
// assembly end to end) is P3-L15 — explicitly NOT this file's scope yet.
// This file exists now only so VersionMetadata has one real, tested
// construction path before P3-L15 needs it.

import { CORE_SCHEMA_VERSION, type VersionMetadata } from "../version";
import type { MeasurementFacts } from "../measurement/facts";

// "which MeasurementFacts bundle" (Contract §25) — identified by provider +
// version, per the Contract's own phrasing ("itself versioned/identified by
// font+size+provider-version"). font+size are LayoutSettings-level, not
// provider-level, so this identity covers the provider axis; a full
// per-font+size identity is a settingsVersion/measurement-pairing detail
// for whichever Loop first needs it, not invented here.
export function measurementIdentityFor(measurement: MeasurementFacts): string {
  return `${measurement.providerId}@${measurement.providerVersion}`;
}

// "a hash/id of the LayoutSettings actually used" (Contract §25). A stable,
// deterministic JSON serialization (keys sorted) stands in for a real hash
// until P3-L09(original)'s full LayoutSettings ingestion exists — this is
// sufficient for reproducibility comparison (same settings object ⇒ same
// string) without claiming to be a cryptographic digest.
export function settingsVersionFor(settings: Record<string, unknown>): string {
  const sortedKeys = Object.keys(settings).sort();
  const stable: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    stable[key] = settings[key];
  }
  return JSON.stringify(stable);
}

export function buildVersionMetadata(
  ruleSetVersion: string,
  settings: Record<string, unknown>,
  measurement: MeasurementFacts
): VersionMetadata {
  return {
    coreSchemaVersion: CORE_SCHEMA_VERSION,
    ruleSetVersion,
    settingsVersion: settingsVersionFor(settings),
    measurementIdentity: measurementIdentityFor(measurement),
  };
}
