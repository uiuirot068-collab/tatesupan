// Top-level orchestration (Core Contract §20/§25, P3-L15). Wires the
// Normalizer's LogicalUnit output + LayoutSettings-equivalent + RuleSetVersion
// + MeasurementFacts into a CanonicalDocument. This is a regression-net
// composition (every module below it was already independently tested) —
// no new logical rule is introduced here, only assembly.

import { CORE_SCHEMA_VERSION, type VersionMetadata } from "../version";
import type { MeasurementFacts } from "../measurement/facts";
import type { RuleSetVersion } from "../rules/characterClass";
import type { LogicalUnit } from "../units";
import type { BlockId } from "../source/span";
import { composePages, type PageCompositionSettings } from "../compose/page";
import { composeColophon } from "../colophon";
import { composeFolioForPage, type FolioSettings } from "../folio";
import { createTraceRecorder } from "../trace";
import { computeHold, holdToLayoutError } from "../diagnostics";
import type { CanonicalDocument, CanonicalPage, LayoutError, LayoutWarning } from "./schema";

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
export function settingsVersionFor(settings: object): string {
  const entries = Object.entries(settings).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(Object.fromEntries(entries));
}

export function buildVersionMetadata(
  ruleSetVersion: string,
  settings: object,
  measurement: MeasurementFacts
): VersionMetadata {
  return {
    coreSchemaVersion: CORE_SCHEMA_VERSION,
    ruleSetVersion,
    settingsVersion: settingsVersionFor(settings),
    measurementIdentity: measurementIdentityFor(measurement),
  };
}

export interface DocumentCompositionInput {
  bodyUnits: LogicalUnit[];
  // If present, composed as an entirely separate, isolated ColophonBlock —
  // never threaded through the body's own pages (Contract §15).
  colophonUnits?: LogicalUnit[];
  colophonBlockId?: BlockId;
  ruleSet: RuleSetVersion;
  measurement: MeasurementFacts;
  settings: PageCompositionSettings;
  // Human Visual QA HOLD round 21 (P3-O08 final-page completion, Step
  // 1B): optional and additive — omitting it preserves the exact prior
  // behavior for every existing caller (no page ever gets a `folio`,
  // byte-identical to before this field existed). When supplied, every
  // body page (colophon pages are a distinct, isolated block per
  // Contract §15 and never receive folio) gets `composeFolioForPage`
  // applied per its own 0-based page order.
  folioSettings?: FolioSettings;
}

// The full orchestration named by this Loop's goal. Composes body pages,
// optionally an isolated colophon, converts any composition-level hold into
// a document-level LayoutError (never silently discarded — INV-010),
// and assembles VersionMetadata + Decision Trace onto one CanonicalDocument.
export function composeCanonicalDocument(input: DocumentCompositionInput): CanonicalDocument {
  const trace = createTraceRecorder(input.ruleSet.id);
  const errors: LayoutError[] = [];
  const warnings: LayoutWarning[] = [];

  const bodyResult = composePages(input.bodyUnits, input.ruleSet, input.measurement, input.settings, trace);
  if (bodyResult.hold) {
    errors.push(holdToLayoutError(bodyResult.hold));
  }
  const folioSettings = input.folioSettings;
  const pages: CanonicalPage[] = folioSettings
    ? bodyResult.pages.map((page, i) => {
        const folio = composeFolioForPage(i, folioSettings);
        return folio ? { ...page, folio } : page;
      })
    : bodyResult.pages;

  let colophon: CanonicalDocument["colophon"];
  if (input.colophonUnits && input.colophonUnits.length > 0) {
    const colophonResult = composePages(input.colophonUnits, input.ruleSet, input.measurement, input.settings, trace);
    if (colophonResult.hold) {
      errors.push(holdToLayoutError(colophonResult.hold));
    }
    const blockId = input.colophonBlockId ?? input.colophonUnits[0].span.blockId;
    colophon = composeColophon(blockId, colophonResult.pages);
  }

  return {
    pages,
    colophon,
    version: buildVersionMetadata(input.ruleSet.id, input.settings, input.measurement),
    warnings,
    errors,
    hold: computeHold(errors, warnings),
    trace: trace.trace,
  };
}
