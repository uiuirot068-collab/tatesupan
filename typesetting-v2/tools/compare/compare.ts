// Stage C — top-level comparison entry point
// (CORE_MIGRATION_ROLLBACK_PLAN.md §2). Runs one fixture's manuscript
// through both engines and returns a fully classified diff report. This is
// the only file a fixture-runner (or the vitest suite) needs to call.

import { PAGE_BREAK_MARKER, type PageLineMetrics } from "../../../src/lib/tategaki";
import { buildLegacyComparisonDocument, checkLegacyMirrorConsistency, type LegacyMirrorConsistency } from "./legacyAdapter";
import { buildV2ComparisonDocument } from "./v2Adapter";
import { compareDocuments, summarize, type ClassificationSummary, type DiffEntry, type FixtureExpectations, NO_EXPECTATIONS } from "./classify";
import type { ComparisonDocument } from "./normalize";
import type { LogicalUnit } from "../../core";
import type { PageCompositionSettings } from "../../core";
import { mmToTicks } from "../../core";

export { PAGE_BREAK_MARKER };

// Track C1 — capacity-equalized: the harness itself resolves one shared
// `{charsPerLine, linesPerColumn, columnCount}` triple and feeds the
// EQUIVALENT resolved capacity into both engines (Stage C brief's own
// instruction), rather than deriving it from either engine's own capacity
// formula (P3-O12 stays a separate, disclosed axis — see
// STAGE_C_LOGICAL_COMPARISON.md §7/Track C2). `bodyFontSizePt` only matters
// to v2's fake measurement provider (ticks-per-cell); legacy's capacity
// model is purely character-count-based and has no font-size axis at all.
export interface CapacityEqualizedSettings {
  charsPerLine: number;
  linesPerColumn: number;
  columnCount: 1 | 2;
  bodyFontSizePt: number;
}

export function legacyMetricsFor(settings: CapacityEqualizedSettings): PageLineMetrics {
  return {
    charsPerLine: settings.charsPerLine,
    linesPerPage: settings.linesPerColumn * settings.columnCount,
    columnCount: settings.columnCount,
    linesPerColumn: settings.linesPerColumn,
  };
}

export function v2SettingsFor(settings: CapacityEqualizedSettings): PageCompositionSettings {
  const perCellAdvanceTick = mmToTicks((settings.bodyFontSizePt * 25.4) / 72); // matches core/measurement/fakeProvider.ts's own ptToTicks formula exactly
  return {
    bodyFontRef: "stage-c-fixture-font",
    bodyFontSizePt: settings.bodyFontSizePt,
    lineExtentTicks: settings.charsPerLine * perCellAdvanceTick,
    linePitchTicks: perCellAdvanceTick,
    columnExtentTicks: settings.linesPerColumn * perCellAdvanceTick,
    columnsPerPage: settings.columnCount,
  };
}

export interface Fixture {
  id: string;
  description: string;
  legacySource: string;
  v2BodyUnits: LogicalUnit[];
  v2Source: string;
  v2ColophonUnits?: LogicalUnit[];
  capacity: CapacityEqualizedSettings;
  expectations: FixtureExpectations;
}

export interface FixtureResult {
  fixtureId: string;
  track: "C1";
  legacyMirror: LegacyMirrorConsistency;
  legacySummary: { pageCount: number; hold: boolean };
  v2Summary: { pageCount: number; hold: boolean; holdReasons: string[] };
  diffs: DiffEntry[];
  classification: ClassificationSummary;
}

export function runFixture(fixture: Fixture): FixtureResult {
  const legacyMetrics = legacyMetricsFor(fixture.capacity);
  const v2Settings = v2SettingsFor(fixture.capacity);

  const legacyMirror = checkLegacyMirrorConsistency({ source: fixture.legacySource, metrics: legacyMetrics });
  const legacy: ComparisonDocument = buildLegacyComparisonDocument({ source: fixture.legacySource, metrics: legacyMetrics });
  const { comparison: v2 } = buildV2ComparisonDocument({
    bodyUnits: fixture.v2BodyUnits,
    colophonUnits: fixture.v2ColophonUnits,
    colophonBlockId: fixture.v2ColophonUnits ? "colophon" : undefined,
    v2Source: fixture.v2Source,
    settings: v2Settings,
  });

  const diffs = compareDocuments(legacy, v2, fixture.expectations);
  const classification = summarize(diffs);

  return {
    fixtureId: fixture.id,
    track: "C1",
    legacyMirror,
    legacySummary: { pageCount: legacy.pages.length, hold: legacy.hold },
    v2Summary: { pageCount: v2.pages.length, hold: v2.hold, holdReasons: v2.holdReasons },
    diffs,
    classification,
  };
}

export { NO_EXPECTATIONS };
export type { FixtureExpectations, DiffEntry, ClassificationSummary };
