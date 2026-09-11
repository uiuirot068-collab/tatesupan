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
  /** Physical free extent from the base start back to the line start. */
  availableBeforeTick?: GeometryTick;
  /** Physical free extent from the base end forward to the line end. */
  availableAfterTick?: GeometryTick;
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
  const centerOffset = Math.floor((input.baseExtentTick - input.readingExtentTick) / 2);
  if (overflow <= 0) {
    return { policy: "CENTER", readingOffsetTick: centerOffset };
  }

  // Long ruby is centered over its base first. The annotation may extend on
  // BOTH sides of the base; only the physical line edges are hard clamps.
  // Callers predating the line-space fields retain their former allowance as
  // the amount of known space, keeping this pure helper backwards-compatible.
  const availableBefore = Math.max(
    0,
    input.availableBeforeTick ?? input.overhangAllowanceBeforeTick
  );
  const availableAfter = Math.max(
    0,
    input.availableAfterTick ?? input.overhangAllowanceAfterTick
  );
  const minimumOffset = availableBefore === 0 ? 0 : -availableBefore;
  const maximumOffset = input.baseExtentTick + availableAfter - input.readingExtentTick;

  // The reading itself is longer than the whole available physical line.
  // Keep its visual center honest and disclose the overflow instead of
  // fabricating a renderer-specific shift.
  if (minimumOffset > maximumOffset) {
    return { policy: "OVERFLOW_OPEN", readingOffsetTick: centerOffset };
  }

  const readingOffsetTick = Math.max(minimumOffset, Math.min(maximumOffset, centerOffset));
  if (readingOffsetTick === centerOffset) {
    return { policy: "CENTER", readingOffsetTick };
  }
  return {
    // Preserve the established policy naming: shifting toward the preceding
    // side is START_CLAMP; shifting toward the following side is END_CLAMP.
    policy: readingOffsetTick < centerOffset ? "START_CLAMP" : "END_CLAMP",
    readingOffsetTick,
  };
}
