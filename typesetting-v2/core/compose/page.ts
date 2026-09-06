// Page composition (Core Contract §13/§15/§19/§20). Assembles CanonicalPages
// from columns and applies MANUAL_FORCED breaks (INV-006): a manual break
// closes the current column AND page immediately, even under capacity
// (Contract Appendix CASE 6) — this file never parses raw notation itself,
// it only reacts to the already-resolved MANUAL_BREAK unit's effect as
// surfaced by compose/line.ts's `forcedBreak` flag.

import type { RuleSetVersion } from "../rules/characterClass";
import type { MeasurementFacts } from "../measurement/facts";
import type { LogicalUnit } from "../units";
import type { SourceSpan } from "../source/span";
import type { TraceRecorder } from "../trace";
import type { CanonicalPage } from "../layout/schema";
import { composeColumn, type ColumnCompositionSettings } from "./column";
import type { LineCompositionHold } from "./line";

export interface PageCompositionSettings extends ColumnCompositionSettings {
  columnsPerPage: number;
}

export interface PageCompositionResult {
  page: CanonicalPage;
  remainingUnits: LogicalUnit[];
  hold?: LineCompositionHold;
}

export function composePage(
  units: LogicalUnit[],
  order: number,
  ruleSet: RuleSetVersion,
  measurement: MeasurementFacts,
  settings: PageCompositionSettings,
  trace?: TraceRecorder
): PageCompositionResult {
  const columns: CanonicalPage["columns"] = [];
  let remaining = units;
  let hold: LineCompositionHold | undefined;

  for (let c = 0; c < settings.columnsPerPage && remaining.length > 0; c++) {
    const columnResult = composeColumn(remaining, c, ruleSet, measurement, settings, trace);
    columns.push(columnResult.column);
    remaining = columnResult.remainingUnits;
    if (columnResult.hold) {
      hold = columnResult.hold;
      break;
    }
    if (columnResult.forcedBreak) break; // manual break closes the page immediately, even under column capacity
  }

  return { page: { id: `page-${order}`, order, columns }, remainingUnits: remaining, hold };
}

export interface DocumentCompositionResult {
  pages: CanonicalPage[];
  hold?: LineCompositionHold;
}

// Repeatedly composes pages until the LogicalUnit stream is exhausted or a
// hold occurs. This is the pure multi-page logical driver used to exercise
// F19 (long prose, multi-page) — it is NOT layout/assemble.ts's full
// composeCanonicalDocument (P3-L15): no ruby/TCY/image wiring, no
// diagnostics/version metadata, no colophon. Those remain later Loops.
export function composePages(
  units: LogicalUnit[],
  ruleSet: RuleSetVersion,
  measurement: MeasurementFacts,
  settings: PageCompositionSettings,
  trace?: TraceRecorder
): DocumentCompositionResult {
  const pages: CanonicalPage[] = [];
  let remaining = units;
  let hold: LineCompositionHold | undefined;
  let order = 0;

  while (remaining.length > 0) {
    // Track progress by source START OFFSET, not array length: a single
    // TextUnit sliced down to a smaller remainder still occupies one array
    // slot, so length alone would falsely look "stuck" every time a page
    // ends mid-unit.
    const beforeOffset = remaining[0]?.span.start;
    const pageResult = composePage(remaining, order, ruleSet, measurement, settings, trace);
    pages.push(pageResult.page);
    remaining = pageResult.remainingUnits;
    order++;
    if (pageResult.hold) {
      hold = pageResult.hold;
      break;
    }
    if (remaining.length > 0 && remaining[0].span.start === beforeOffset) {
      // No progress at all (e.g. columnsPerPage settings degenerate to
      // zero) — a structured hold, never an infinite loop.
      const stuckSpan: SourceSpan = remaining[0]?.span ?? { blockId: "", start: 0, end: 0 };
      hold = { reason: "NO_PROGRESS_COMPOSING_PAGE", sourceSpan: stuckSpan };
      break;
    }
  }

  return { pages, hold };
}
