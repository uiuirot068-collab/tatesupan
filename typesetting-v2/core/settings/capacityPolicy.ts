// Capacity-formula dispatch policy — P3-O12-C.
//
// The single decision point a future Editor adapter defers to: given a
// document's persisted capacity-formula identity (or its absence) and the
// event that triggered this derivation, which formula actually runs, and
// does the document's identity change as a result. This file owns ONLY that
// dispatch — it does not decide document-versus-line-composition boundaries
// (compose/line.ts, compose/column.ts, compose/page.ts already consume
// resolved tick extents and are untouched by this Loop), and it is not a
// migration framework: there is no batch/background migration concept here,
// only a pure per-call decision (per the P3-O12-C brief's own instruction
// not to over-design one).

import type { MeasurementFacts } from "../measurement/facts";
import {
  canMigrateCapacityFormula,
  resolveCapacityFormulaVersion,
  type CapacityFormulaVersion,
  type CapacitySettingsEvent,
} from "./capacityFormulaVersion";
import { deriveLegacyFrozenCapacity, type LegacyCapacityInputMm, type LegacyCapacityResult } from "./capacityLegacyFrozen";
import { deriveV2NativeCapacity, type V2NativeCapacityInputMm, type V2NativeCapacityResult } from "./capacityV2Native";

export interface CapacityDerivationInput {
  /** Consumed only when the resolved/target formula is "legacy-frozen". */
  legacyInputMm: LegacyCapacityInputMm;
  /** Consumed only when the resolved/target formula is "v2-1". */
  v2InputMm: V2NativeCapacityInputMm;
}

export type CapacityDerivationResult =
  | {
      formulaVersion: "legacy-frozen";
      charsPerLine: number;
      linesPerColumn: number;
      legacy: LegacyCapacityResult;
    }
  | {
      formulaVersion: "v2-1";
      charsPerLine: number;
      linesPerColumn: number;
      v2: V2NativeCapacityResult;
    };

/**
 * Resolves which formula a document's NEXT effective capacity should use,
 * given its currently persisted identity (undefined ⇒ legacy-frozen, per
 * resolveCapacityFormulaVersion) and the event requesting derivation, then
 * runs exactly that one formula. Semantics (Human-approved P3-O12 policy,
 * P3-O12-B §16.6/§16.9 Decision #6 and P3-O12-C's approved points 1-5):
 *
 *  - A document already resolved to "v2-1" ALWAYS uses the v2-native formula,
 *    for every event — there is no "downgrade" path back to legacy.
 *  - A "legacy-frozen" document uses the legacy formula for every event
 *    EXCEPT `explicitGeometryCommit`, which is the one event that may
 *    migrate it (canMigrateCapacityFormula) — in which case this call's
 *    OWN result already reflects the new v2-native formula, and the
 *    returned `formulaVersion` is what the caller must now persist.
 *  - `documentOpen`, `ordinarySave`, and `unrelatedSettingsEdit` never
 *    change formulaVersion for a legacy-frozen document — calling this
 *    function for those events is safe to do on every load/save without
 *    risk of an accidental migration.
 */
export function deriveCapacityForEvent(
  persistedFormulaVersion: string | undefined,
  event: CapacitySettingsEvent,
  input: CapacityDerivationInput,
  measurement: MeasurementFacts
): CapacityDerivationResult {
  const currentVersion = resolveCapacityFormulaVersion(persistedFormulaVersion);
  const targetVersion: CapacityFormulaVersion =
    currentVersion === "v2-1"
      ? "v2-1"
      : canMigrateCapacityFormula(event)
        ? "v2-1"
        : "legacy-frozen";

  if (targetVersion === "v2-1") {
    const v2 = deriveV2NativeCapacity(input.v2InputMm, measurement);
    return { formulaVersion: "v2-1", charsPerLine: v2.charsPerLine, linesPerColumn: v2.linesPerColumn, v2 };
  }

  const legacy = deriveLegacyFrozenCapacity(input.legacyInputMm);
  return {
    formulaVersion: "legacy-frozen",
    charsPerLine: legacy.charsPerLine,
    linesPerColumn: legacy.linesPerColumn,
    legacy,
  };
}

/**
 * New-document initialization (P3-O12-C policy points 6-7): a brand new
 * document starts on the "legacy-frozen" formula, seeded from whatever
 * physical preset geometry the Editor applies — i.e. exactly
 * `deriveCapacityForEvent(undefined, "documentOpen", input, measurement)`.
 * It only becomes "v2-1" the same way an existing document would: an
 * explicit geometry/capacity commit (§16.8 of the P3-O12-B audit addendum:
 * "established preset default capacities" means the numbers the legacy
 * formula actually produces for that preset, never PAPER_SIZE_TEMPLATES'
 * stale stored literals — see capacityFixtures.ts). This function is a
 * named, documented alias, not new behavior — it exists purely so a caller
 * doesn't have to remember which event name means "just-created."
 */
export function initializeNewDocumentCapacity(
  input: CapacityDerivationInput,
  measurement: MeasurementFacts
): CapacityDerivationResult {
  return deriveCapacityForEvent(undefined, "documentOpen", input, measurement);
}
