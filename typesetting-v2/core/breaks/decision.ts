// BreakDecision (Core Contract §8) — capacity-independent subset only.
//
// A full BreakDecision requires knowing which opportunity a line/column-
// filling algorithm actually took, which needs physical capacity math
// (GeometryTick accumulation, remaining width) — that is the Natural-Pitch
// Line Composer's job, a later Loop, not this one. The one BreakDecision
// this Loop CAN make without any capacity information is the manual-break
// case: Contract §13/INV-006 require every MANUAL_FORCED opportunity to
// always become a taken decision, unconditionally, regardless of remaining
// capacity — so it needs no line-filling context at all.
//
// P3-L06A boundary audit: CONFIRMED intentional, not a naming-symmetry gap.
// CORE_MODULE_MAP.md row 12 (breaks/decision.ts) itself assigns the full
// BreakDecision algorithm to the Natural-Pitch Line Composer Loop, not to
// this one — the frozen module map already draws this exact line between
// legality analysis (BreakOpportunity, this Loop) and physical chosen break
// (BreakDecision's CAPACITY_REACHED/HANGING_DEFERRAL causes, next Loop).
// This file is not expanded to cover those causes merely for symmetry with
// MANUAL_FORCE; doing so would require capacity math this Loop does not
// have.

import type { BreakOpportunity } from "./opportunity";

export type BreakDecisionCause = "CAPACITY_REACHED" | "MANUAL_FORCE" | "HANGING_DEFERRAL";

export interface BreakDecision {
  opportunity: BreakOpportunity;
  taken: boolean;
  hangingApplied?: boolean;
  causedBy: BreakDecisionCause;
}

// Every MANUAL_FORCED opportunity always becomes a taken BreakDecision
// (INV-006) — this is deterministic regardless of remaining capacity, so it
// requires no line-filling algorithm. Every other BreakOpportunityReason is
// intentionally NOT decided here; whether an ALLOWED/PROHIBITED_KINSOKU/etc.
// opportunity is actually taken depends on physical line capacity and is
// out of this Loop's scope.
export function deriveManualBreakDecisions(opportunities: BreakOpportunity[]): BreakDecision[] {
  return opportunities
    .filter((opportunity) => opportunity.reason === "MANUAL_FORCED")
    .map((opportunity) => ({ opportunity, taken: true, causedBy: "MANUAL_FORCE" as const }));
}
