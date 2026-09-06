// P3-O12-C: capacity-formula identity (Core Contract §19/§25, extends
// CORE_MODULE_MAP.md row 24's "settings/ owns LayoutSettings + mm→tick
// ingestion" to the one remaining unresolved P3-O12 item — see
// typesetting-v2/qa/research/P3_O12_CAPACITY_GEOMETRY_AUDIT.md §13/§16 for
// the Human-approved policy this file encodes).
//
// A document's persisted capacity-formula identity distinguishes which
// derivation produced its currently-effective charsPerLine/linesPerColumn:
//
//  - "legacy-frozen": the exact, never-edited-again port of Production's
//    current src/lib/pageLayout.ts clamp chain (capacityLegacyFrozen.ts).
//    A document with NO persisted identity is legacy-frozen by convention
//    (mirrors src/lib/db.ts's own withDefaults() pattern: an absent field
//    means "behave as if this document predates the field").
//  - "v2-1": the corrected, GeometryTick/MeasurementFacts-based derivation
//    (capacityV2Native.ts).
//
// This module is pure policy — it does not itself call either formula.

export type CapacityFormulaVersion = "legacy-frozen" | "v2-1";

const KNOWN_V2_VERSIONS: ReadonlySet<string> = new Set(["v2-1"]);

/**
 * Missing/unrecognized persisted identity resolves to "legacy-frozen" —
 * never to the newest v2 version. An unrecognized string is treated the
 * same as "absent" (never silently upgraded) so a corrupted or
 * future-unknown value can never accidentally re-derive a document under a
 * formula it was never actually authored against.
 */
export function resolveCapacityFormulaVersion(
  persisted: string | undefined
): CapacityFormulaVersion {
  if (persisted !== undefined && KNOWN_V2_VERSIONS.has(persisted)) {
    return persisted as CapacityFormulaVersion;
  }
  return "legacy-frozen";
}

/**
 * Every event that can touch a document's settings, named explicitly so the
 * migration-trigger policy (canMigrateCapacityFormula) is a total function
 * over a closed set, not a string the caller could get wrong by typo.
 */
export type CapacitySettingsEvent =
  | "documentOpen"
  | "ordinarySave"
  | "unrelatedSettingsEdit"
  | "explicitGeometryCommit";

/**
 * Pure migration-trigger policy (P3-O12-B §16.7/§16.9 Decision #6's
 * direction, Human-approved P3-O12-C policy points 2-4/7): only an explicit
 * geometry/capacity commit may move a document from "legacy-frozen" to
 * "v2-1". Opening a document, an ordinary autosave, or an edit unrelated to
 * physical geometry/capacity must never migrate it — this function is the
 * single place that boundary is expressed, so a future Editor adapter has
 * exactly one decision to defer to rather than re-deriving it.
 */
export function canMigrateCapacityFormula(event: CapacitySettingsEvent): boolean {
  return event === "explicitGeometryCommit";
}
