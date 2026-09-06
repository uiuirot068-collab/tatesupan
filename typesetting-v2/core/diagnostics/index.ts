// Warning / Error / HOLD model (Core Contract §26, INV-010). Not
// exception-only: three structured severities. computeHold() is the
// mechanism; exact HOLD-triggering thresholds beyond the malformed-input
// case are explicitly an implementation-time detail (Contract §26) — not
// exhaustively designed here.

import type { LineCompositionHold } from "../compose/line";
import type { LayoutError, LayoutWarning } from "../layout/schema";

export type { LayoutError, LayoutWarning };

// INV-010: any BLOCKS_HOLD-severity LayoutError forces hold=true,
// unconditionally — a serious unresolved condition can never silently
// become Publication PASS. No LayoutWarning forces hold today; a
// Product-defined class of "serious enough to hold" warning is explicitly
// deferred (Contract §26), not invented here.
export function computeHold(errors: LayoutError[], _warnings: LayoutWarning[]): boolean {
  return errors.some((error) => error.severity === "BLOCKS_HOLD");
}

// Converts a compose/line.ts-level composition hold (an atomic unit that
// could not be placed at all, or no legal boundary within extent) into the
// Contract's LayoutError shape — the concrete bridge from "the line/column/
// page composer refused to guess" to "the document-level HOLD mechanism
// sees it," rather than the composition hold being silently swallowed.
export function holdToLayoutError(hold: LineCompositionHold): LayoutError {
  return {
    sourceSpan: hold.sourceSpan,
    message: hold.reason,
    severity: "BLOCKS_HOLD",
  };
}
