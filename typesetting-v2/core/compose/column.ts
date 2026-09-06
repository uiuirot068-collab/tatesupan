// Column composition (Core Contract §19/§20 CASE 8). Fills a CanonicalColumn
// from lines to capacity, tracking residual space independently per column
// (INV-004: never stretched to absorb it).

import type { GeometryTick } from "../geometry/tick";
import { codePointSlice } from "../source/graphemeSafety";
import type { RuleSetVersion } from "../rules/characterClass";
import type { MeasurementFacts } from "../measurement/facts";
import type { LogicalUnit } from "../units";
import type { TraceRecorder } from "../trace";
import type { CanonicalColumn } from "../layout/schema";
import { composeLine, type CompositionSettings, type LineCompositionHold } from "./line";

export interface ColumnCompositionSettings extends CompositionSettings {
  lineExtentTicks: GeometryTick; // one line's own extent budget (passed through to composeLine)
  linePitchTicks: GeometryTick; // column-width consumed per line placed
  columnExtentTicks: GeometryTick; // total column width capacity
}

export interface ColumnCompositionResult {
  column: CanonicalColumn;
  remainingUnits: LogicalUnit[];
  hold?: LineCompositionHold;
  // True only when the column closed early because a line inside it ended
  // on a MANUAL_FORCED break (Contract Appendix CASE 6) — the page composer
  // (P3-L08) uses this to close the page too, even under column capacity.
  forcedBreak: boolean;
  // Human Product Decision A/B threading: whether the NEXT line composed
  // (in this column, the next column, or the next page — the page composer
  // threads this onward exactly like `remainingUnits`) should be treated as
  // a fresh paragraph start. Never reset by a column/page boundary itself
  // (mirrors legacy's own `pendingParagraphStart`, which persists across
  // page breaks and is changed only by an actual paragraph-break unit).
  nextLineIsParagraphStart: boolean;
}

// Returns the remaining LogicalUnit stream starting at source code-point
// `offset`. `offset` is guaranteed (by construction, from
// compose/line.ts's own atom-boundary derivation) to land on a boundary
// breaks/opportunity.ts already recognizes as legal — never mid-grapheme.
// Only TEXT units can be partially consumed and therefore need re-slicing;
// every other kind is always consumed whole or not at all (JUKUGO-ruby
// cross-line splitting is ruby-placement territory, P3-L11+, not exercised
// by this Loop).
function sliceUnitsFrom(units: LogicalUnit[], offset: number): LogicalUnit[] {
  const result: LogicalUnit[] = [];
  for (const unit of units) {
    if (unit.span.end <= offset) continue; // fully consumed
    if (unit.span.start >= offset) {
      result.push(unit);
      continue;
    }
    if (unit.kind === "TEXT") {
      const relativeStart = offset - unit.span.start;
      const remainingText = codePointSlice(unit.text, relativeStart, Array.from(unit.text).length);
      result.push({
        kind: "TEXT",
        span: { blockId: unit.span.blockId, start: offset, end: unit.span.end },
        text: remainingText,
      });
    } else {
      result.push(unit);
    }
  }
  return result;
}

export function composeColumn(
  units: LogicalUnit[],
  order: number,
  ruleSet: RuleSetVersion,
  measurement: MeasurementFacts,
  settings: ColumnCompositionSettings,
  isParagraphStart: boolean,
  trace?: TraceRecorder
): ColumnCompositionResult {
  const lines: CanonicalColumn["lines"] = [];
  let remaining = units;
  let usedColumnTick = 0;
  let hold: LineCompositionHold | undefined;
  let forcedBreak = false;
  let currentIsParagraphStart = isParagraphStart;

  while (remaining.length > 0 && usedColumnTick + settings.linePitchTicks <= settings.columnExtentTicks) {
    const lineResult = composeLine(remaining, ruleSet, measurement, settings, settings.lineExtentTicks, currentIsParagraphStart, trace);
    if (lineResult.hold) {
      hold = lineResult.hold;
      break;
    }
    if (lineResult.line.placedUnits.length === 0) break; // no progress possible — avoid an infinite loop
    lines.push({ ...lineResult.line, order: lines.length });
    usedColumnTick += settings.linePitchTicks;
    remaining = sliceUnitsFrom(remaining, lineResult.consumedThroughOffset);
    // Human Product Decision A/B: a PARAGRAPH_FORCED cut makes the NEXT line
    // a fresh paragraph start; an ordinary cut means still mid-paragraph
    // (no indent); a MANUAL_FORCED (page-closing) cut carries the CURRENT
    // value forward unchanged — mirrors legacy's own `pendingParagraphStart`,
    // which a page break never touches either way.
    currentIsParagraphStart = lineResult.endedAtParagraphBreak
      ? true
      : lineResult.forcedBreak
        ? currentIsParagraphStart
        : false;
    if (lineResult.forcedBreak) {
      forcedBreak = true;
      break;
    }
  }

  return {
    column: {
      id: `column-${order}`,
      order,
      lines,
      residualSpaceTick: settings.columnExtentTicks - usedColumnTick,
    },
    remainingUnits: remaining,
    hold,
    forcedBreak,
    nextLineIsParagraphStart: currentIsParagraphStart,
  };
}
