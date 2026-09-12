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
import {
  prepareLineComposition,
  type LineCompositionHold,
  type PreparedLineComposition,
} from "./line";

export interface PageCompositionSettings extends ColumnCompositionSettings {
  columnsPerPage: number;
}

export interface PageCompositionResult {
  page: CanonicalPage;
  remainingUnits: LogicalUnit[];
  hold?: LineCompositionHold;
  // See ColumnCompositionResult's own field of the same name — threaded
  // across columns within this page, then onward to the next page.
  nextLineIsParagraphStart: boolean;
}

export function composePage(
  units: LogicalUnit[],
  order: number,
  ruleSet: RuleSetVersion,
  measurement: MeasurementFacts,
  settings: PageCompositionSettings,
  isParagraphStart: boolean,
  trace?: TraceRecorder,
  prepared?: PreparedLineComposition
): PageCompositionResult {
  const columns: CanonicalPage["columns"] = [];
  let remaining = units;
  let hold: LineCompositionHold | undefined;
  let currentIsParagraphStart = isParagraphStart;

  for (let c = 0; c < settings.columnsPerPage && remaining.length > 0; c++) {
    const columnResult = composeColumn(
      remaining,
      c,
      ruleSet,
      measurement,
      settings,
      currentIsParagraphStart,
      trace,
      prepared
    );
    columns.push(columnResult.column);
    remaining = columnResult.remainingUnits;
    currentIsParagraphStart = columnResult.nextLineIsParagraphStart;
    if (columnResult.hold) {
      hold = columnResult.hold;
      break;
    }
    if (columnResult.forcedBreak) break; // manual break closes the page immediately, even under column capacity
  }

  return {
    page: { id: `page-${order}`, order, columns },
    remainingUnits: remaining,
    hold,
    nextLineIsParagraphStart: currentIsParagraphStart,
  };
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
  // Human Product Decision A: the document's very first paragraph is
  // indented too (matches legacy's own `pendingParagraphStart` starting
  // `true` at document start, TSP-LOOP-029) — never reset by a page
  // boundary, only by an actual PARAGRAPH_FORCED cut.
  let isParagraphStart = true;
  const prepared = prepareLineComposition(units, ruleSet, measurement, settings, trace);

  while (remaining.length > 0) {
    // Track progress by source START OFFSET, not array length: a single
    // TextUnit sliced down to a smaller remainder still occupies one array
    // slot, so length alone would falsely look "stuck" every time a page
    // ends mid-unit.
    const beforeOffset = remaining[0]?.span.start;
    const pageResult = composePage(
      remaining,
      order,
      ruleSet,
      measurement,
      settings,
      isParagraphStart,
      trace,
      prepared
    );
    pages.push(pageResult.page);
    remaining = pageResult.remainingUnits;
    isParagraphStart = pageResult.nextLineIsParagraphStart;
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
