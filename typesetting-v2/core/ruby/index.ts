// Ruby composition (Core Contract §9/§9.1). Two responsibilities, per
// CORE_MODULE_MAP.md row 16:
//   1. deriveRubyBreakOpportunities — break-opportunity mapping for ATOMIC
//      and JUKUGO groups (breaks/opportunity.ts calls into this for every
//      RUBY unit; it does not decide ruby break legality itself).
//   2. placeRuby — geometry-clamp placement (CENTER/START_CLAMP/END_CLAMP/
//      OVERFLOW_OPEN) layered with the (possibly zero-valued) ruby-overhang
//      allowance table.
//
// Segmentation ownership (Contract §9, P3-O14): this module only ever HONORS
// an already-provided `segments` array. A JUKUGO unit with no segments is
// ATOMIC by default — the Core never discovers or guesses a split.

import type { GeometryTick } from "../geometry/tick";
import type { CharacterClassId, RuleSetVersion } from "../rules/characterClass";
import type { RubyUnit } from "../units";
import type { SourceSpan } from "../source/span";
import type { BreakOpportunity } from "../breaks/opportunity";

function boundarySpan(blockId: string, offset: number): SourceSpan {
  return { blockId, start: offset, end: offset };
}

// ATOMIC ruby, and a JUKUGO ruby with no declared `segments` (defaults to
// ATOMIC — the Core never guesses a split), generate zero internal
// opportunities: the group is simply never decomposed, which is what makes
// INV-007 hold by construction rather than by an explicit per-position
// prohibition. A JUKUGO ruby WITH declared segments generates exactly one
// RUBY_INTERNAL_ALLOWED opportunity per declared segment boundary (HG-3) and
// nothing else — no opportunity is ever generated at an undeclared
// (intra-segment) position (INV-008).
export function deriveRubyBreakOpportunities(unit: RubyUnit): BreakOpportunity[] {
  if (unit.rubyKind !== "JUKUGO" || !unit.segments || unit.segments.length < 2) {
    return [];
  }
  const opportunities: BreakOpportunity[] = [];
  for (let i = 0; i < unit.segments.length - 1; i++) {
    const boundaryOffset = unit.segments[i].baseSpan.end;
    opportunities.push({
      position: boundarySpan(unit.baseSpan.blockId, boundaryOffset),
      reason: "RUBY_INTERNAL_ALLOWED",
    });
  }
  return opportunities;
}

export type RubyBoundaryPolicy = "CENTER" | "START_CLAMP" | "END_CLAMP" | "OVERFLOW_OPEN";

export interface RubyPlacementInput {
  baseExtentTick: GeometryTick; // total extent the base group occupies along the line
  readingExtentTick: GeometryTick; // extent the reading text needs (measurement.rubyReadingExtentTick)
  overhangAllowanceBeforeTick: GeometryTick; // resolved allowance on the preceding side (0 until HG-4 values are set)
  overhangAllowanceAfterTick: GeometryTick; // resolved allowance on the following side
}

export interface RubyPlacementResult {
  policy: RubyBoundaryPolicy;
  // Reading's start offset relative to the base group's own start tick.
  // Never touches the BASE's own coordinates — the base-position invariant
  // (INV-003) holds because this function has no base-coordinate output at
  // all, only a reading-relative one.
  readingOffsetTick: GeometryTick;
}

// Resolves the ruby-overhang allowance for one adjacent character class from
// a RuleSetVersion's table, falling back to 0 (no overhang) rather than
// inventing a value — the shipped default table is empty (HG-4 principle
// approved, exact values still OPEN, P3-O06 residual, PHASE3_JAPANESE_RULE_FREEZE_MATRIX.md row 22b).
export function resolveOverhangAllowance(ruleSet: RuleSetVersion, adjacentClassId: CharacterClassId): GeometryTick {
  return ruleSet.rubyOverhangAllowance.get(adjacentClassId) ?? 0;
}

// Contract §9.1: rule data (overhang allowance) is separate from the
// placement mechanism (this function). When the reading fits within the
// base extent, it is simply centered. When it overflows, the overflow is
// split toward both sides and clamped by whatever allowance exists on each
// side; if allowance is insufficient to absorb the overflow on both sides
// (as it always is today, since the shipped table is all-zero), the
// existing OVERFLOW_OPEN policy applies — this is a legitimate, named
// outcome (Master §25.6), not an error.
export function placeRuby(input: RubyPlacementInput): RubyPlacementResult {
  const overflow = input.readingExtentTick - input.baseExtentTick;
  if (overflow <= 0) {
    const centerOffset = Math.floor((input.baseExtentTick - input.readingExtentTick) / 2);
    return { policy: "CENTER", readingOffsetTick: centerOffset };
  }

  // Absorb as much overflow as each side's own allowance permits — greedily,
  // not by a rigid even split, so a side with full allowance can absorb the
  // whole overflow on its own rather than being capped at "half."
  const beforeUsed = Math.min(overflow, input.overhangAllowanceBeforeTick);
  const afterUsed = Math.min(overflow - beforeUsed, input.overhangAllowanceAfterTick);
  const stillOverflowing = overflow - beforeUsed - afterUsed > 0;

  if (stillOverflowing) {
    return { policy: "OVERFLOW_OPEN", readingOffsetTick: -beforeUsed };
  }
  if (beforeUsed > 0 && afterUsed === 0) {
    return { policy: "START_CLAMP", readingOffsetTick: -beforeUsed };
  }
  if (afterUsed > 0 && beforeUsed === 0) {
    return { policy: "END_CLAMP", readingOffsetTick: 0 };
  }
  // Both sides contributed (or overflow was exactly 0, unreachable here) —
  // a balanced two-sided overhang stays classified as CENTER, the closest
  // existing named policy (Master §25.6 does not define a fifth name).
  return { policy: "CENTER", readingOffsetTick: -beforeUsed };
}
