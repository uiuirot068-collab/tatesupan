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
  const manualBreakAtOffset = units.some(
    (unit) => unit.kind === "MANUAL_BREAK" && unit.span.start === offset
  );
  for (const unit of units) {
    if (unit.span.end <= offset) continue; // fully consumed
    // A UI-inserted marker is isolated on its own source line. Once its
    // MANUAL_BREAK closes the page, the immediately following separator
    // newline has no independent paragraph meaning; consuming it prevents an
    // empty first line on the new page. Ordinary newlines at every other
    // offset remain untouched.
    if (
      manualBreakAtOffset &&
      unit.kind === "PARAGRAPH_BREAK" &&
      unit.span.start === offset
    ) continue;
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
    // a fresh paragraph start; every other cut — ordinary/kinsoku OR
    // MANUAL_FORCED (page-closing) — means the paragraph-start flag has
    // already been consumed by THIS line's own indent decision (composeLine
    // evaluates `appliesIndent` unconditionally, regardless of how the line
    // later ends), so the next line starts false. This mirrors legacy's
    // `pendingParagraphStart`, which is consumed by the first real content
    // character (`openLineBudget`) and is never re-armed by a page break —
    // a page break by itself carries forward whatever the flag already was,
    // and by the time any page break fires, real content has always already
    // consumed it. Previously this carried the pre-line value forward
    // unchanged on a MANUAL_FORCED cut, which incorrectly re-indented the
    // first line of the next page whenever the page-ending line had itself
    // been a paragraph start (STAGE-D-FIRST-LINE-INDENT-VISUAL-HOLD test 6).
    currentIsParagraphStart = lineResult.endedAtParagraphBreak;
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
