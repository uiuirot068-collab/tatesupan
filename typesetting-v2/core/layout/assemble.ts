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
import { composeColophon, resolveColophonInsertion, type ColophonPagePosition } from "../colophon";
import { composeFolioForPage, type FolioSettings } from "../folio";
import { composeHeaderForPage, type HeaderPageOverride, type HeaderSettings } from "../header";
import { createTraceRecorder } from "../trace";
import { computeHold, holdToLayoutError } from "../diagnostics";
import type { CanonicalDocument, CanonicalPage, ColophonPlacement, LayoutError, LayoutWarning, PhysicalPageRef } from "./schema";

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
  // Human Visual QA HOLD round 22 (P3-O08 final-page completion, Step
  // 1C): same optional/additive contract as `folioSettings` — omitting
  // it preserves the exact prior behavior. `headerPageOverrides` mirrors
  // legacy `PageSettings.pageOverrides`'s own per-page-number-keyed
  // shape (1-based page number, matching legacy exactly), but only for
  // the 柱-relevant subset (`hideHashira`/`hashiraOverride`) — folio's
  // own per-page `hideNombre` override is real legacy behavior but
  // remains out of this round's own scope (see
  // qa/evidence/P3_O08_FOLIO_HEADER_COMPLETE_CONTRACT.md).
  headerSettings?: HeaderSettings;
  headerPageOverrides?: Record<number, HeaderPageOverride>;
  // Human Visual QA HOLD round 26 (P3-O08 final-page completion, Step
  // 2, structural colophon): CORRECTS round 21's own prior comment ("no
  // page ever gets a folio... colophon pages... never receive folio") —
  // that was an untested assumption, not audited evidence. Direct read
  // of legacy `src/lib/colophon.ts`'s own real `resolveColophonNombre`
  // proves the opposite: the colophon page DOES participate in the SAME
  // physical page/nombre sequence as body pages ("ノンブルは実際の作品
  // ページ順（物理ページ順）に従う"), its own physical page number being
  // `precedingBodyPageCount + 1`. This round ports that behavior — the
  // colophon's own pages continue the SAME folio/header sequence body
  // pages use, at whatever physical position they end up.
  //
  // Human Visual QA HOLD round 28 (P3-O08 final-page completion, Step
  // 2C): `colophonPagePosition` wires the already-ported
  // `resolveColophonInsertion` (`core/colophon/index.ts`, verbatim from
  // `src/lib/colophon.ts:266-277`) into the actual final physical page
  // sequence. Optional/additive — omitting it defaults to `{mode:"end"}`,
  // byte-identical to every round-20-through-27 caller's own behavior
  // (colophon always after all body pages). `colophonPlacement` is the
  // real legacy `ColophonPlacement` (`src/lib/colophon.ts:67-74`),
  // attached to the resulting `ColophonBlock` — see `ColophonPlacement`'s
  // own doc comment in `./schema` for what is/isn't acted on yet.
  colophonPagePosition?: ColophonPagePosition;
  colophonPlacement?: ColophonPlacement;
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
  const headerSettings = input.headerSettings;

  let colophonRawPages: CanonicalPage[] = [];
  let colophonBlockId: BlockId | undefined;
  if (input.colophonUnits && input.colophonUnits.length > 0) {
    const colophonResult = composePages(input.colophonUnits, input.ruleSet, input.measurement, input.settings, trace);
    if (colophonResult.hold) {
      errors.push(holdToLayoutError(colophonResult.hold));
    }
    colophonRawPages = colophonResult.pages;
    colophonBlockId = input.colophonBlockId ?? input.colophonUnits[0].span.blockId;
  }
  const hasColophon = colophonRawPages.length > 0;

  // Human Visual QA HOLD round 28 (P3-O08 final-page completion, Step
  // 2C): the real physical page sequence, Core's own decision (Publication
  // never inserts/reorders pages -- it only paints what this decided).
  // `{mode:"end"}` (the default when `colophonPagePosition` is omitted,
  // matching every round-20-through-27 caller) yields exactly
  // `[...body pages, ...colophon pages]` -- byte-identical to this
  // file's own pre-round-28 behavior.
  const pagePosition = input.colophonPagePosition ?? { mode: "end" as const };
  const insertion = hasColophon ? resolveColophonInsertion(pagePosition, bodyResult.pages.length) : undefined;
  const precedingBodyPages = insertion?.precedingBodyPages ?? bodyResult.pages.length;

  const pageSequence: PhysicalPageRef[] = [];
  for (let i = 0; i < precedingBodyPages; i++) pageSequence.push({ kind: "body", index: i });
  for (let i = 0; i < colophonRawPages.length; i++) pageSequence.push({ kind: "colophon", index: i });
  for (let i = precedingBodyPages; i < bodyResult.pages.length; i++) pageSequence.push({ kind: "body", index: i });

  // Folio/header are resolved against each page's own position in the
  // FINAL physical sequence above -- not its position within the body's
  // own (unchanged) composition order or the colophon's own (unchanged)
  // composition order. A body page's own lines/columns/breaks/source
  // spans are never touched here, only its furniture -- see
  // qa/evidence/P3_O08_STRUCTURAL_COLOPHON_FINAL_PLACEMENT.md's own
  // "body composition invariant" proof.
  const bodyPagesOut: CanonicalPage[] = bodyResult.pages.slice();
  const colophonPagesOut: CanonicalPage[] = colophonRawPages.slice();
  if (folioSettings || headerSettings) {
    pageSequence.forEach((ref, physicalIndex) => {
      const folio = folioSettings ? composeFolioForPage(physicalIndex, folioSettings) : undefined;
      const header = headerSettings ? composeHeaderForPage(physicalIndex, headerSettings, input.headerPageOverrides?.[physicalIndex + 1]) : undefined;
      const patch = { ...(folio ? { folio } : {}), ...(header ? { header } : {}) };
      if (ref.kind === "body") bodyPagesOut[ref.index] = { ...bodyPagesOut[ref.index], ...patch };
      else colophonPagesOut[ref.index] = { ...colophonPagesOut[ref.index], ...patch };
    });
  }

  const colophon = hasColophon && colophonBlockId !== undefined ? composeColophon(colophonBlockId, colophonPagesOut, input.colophonPlacement) : undefined;

  return {
    pages: bodyPagesOut,
    colophon,
    pageSequence,
    version: buildVersionMetadata(input.ruleSet.id, input.settings, input.measurement),
    warnings,
    errors,
    hold: computeHold(errors, warnings),
    trace: trace.trace,
  };
}
