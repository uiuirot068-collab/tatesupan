// TCYUnit logical-cell consumption for capacity math (jlreq cl-30 atomic
// group, Contract §10). A TCY group is never internally decomposed for
// break-opportunity purposes (breaks/opportunity.ts generates zero internal
// candidates for it — see deriveBreakOpportunities) — this function only
// answers how many Natural-Pitch cells the whole group consumes once placed
// on a line (compose/line.ts's capacity math). No auto-detection threshold
// exists here (P3-O07, out of scope, Contract §10) — this only ever
// consumes an already-explicit TCYUnit.

import type { TCYUnit } from "../units";

export function tcyCellCost(unit: TCYUnit): number {
  return unit.logicalCells;
}
