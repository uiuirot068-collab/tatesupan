// Natural-Pitch line composer (Core Contract §18/§19, INV-004/INV-005/INV-013).
//
// Scope boundary (explicit, per this Loop's brief): ONE line only. Column
// and page assembly, multi-line flow, ruby/TCY visual placement, and image
// flow are later Loops (originally P3-L10/P3-L11/P3-L12/P3-L13). This module
// answers "given this ordered content and this much physical line extent,
// what actually goes on the line, and how much room is left over" — nothing
// about *how many* lines a document needs.
//
// Algorithm: Natural Pitch never stretches to fill (§18) — the composer
// accumulates each atom's natural advance and, on overflow, cuts at the
// LATEST legal break boundary that still fit (never a PROHIBITED_* one,
// never mid-atom). If no legal boundary was ever seen before overflow, or
// the very first atom alone exceeds the line extent, that is a structured
// hold, not a guess (INV-004's "never stretch" implies the composer must
// never silently split/shrink to force a fit either).

import type { GeometryTick } from "../geometry/tick";
import type { SourceSpan } from "../source/span";
import type { RuleSetVersion } from "../rules/characterClass";
import type { MeasurementFacts } from "../measurement/facts";
import type { LogicalUnit } from "../units";
import type { TraceRecorder } from "../trace";
import type { CanonicalLine, PlacedUnit } from "../layout/schema";
import { deriveBreakOpportunities, type BreakOpportunity } from "../breaks/opportunity";

export interface CompositionSettings {
  bodyFontRef: string;
  bodyFontSizePt: number;
}

export interface LineCompositionHold {
  reason: string;
  sourceSpan: SourceSpan;
}

export interface LineCompositionResult {
  hold?: LineCompositionHold;
  line: CanonicalLine;
  residualSpaceTick: GeometryTick;
  // Source code-point offset the NEXT line should resume composing from —
  // == the source end of the last atom this line consumed (or the stream's
  // own start, unconsumed, when `hold` is set).
  consumedThroughOffset: number;
}

interface CompositionAtom {
  sourceSpan: SourceSpan;
  advanceTick: GeometryTick;
}

// One visual "cell" for Natural Pitch purposes. A grapheme cluster inside a
// TEXT unit is always exactly one cell, however many code points it spans
// (INV-011 already guarantees an atom never fractures a grapheme — see
// breaks/opportunity.ts). TCY and cl-08 semantic runs declare their own
// logical-cell cost. Ruby base extent is approximated by its span's
// code-point width (every base character is ordinary CJK/kana, one cell
// each) — this file never touches ruby/TCY *placement*, only how much line
// extent their (already-atomic) group consumes.
function cellCountFor(unit: LogicalUnit, spanWidth: number): number {
  switch (unit.kind) {
    case "TEXT":
      return 1;
    case "TCY":
      return unit.logicalCells;
    case "SEMANTIC_RUN":
      return unit.length;
    case "RUBY":
      return spanWidth;
    case "MANUAL_BREAK":
      return 0;
    case "IMAGE":
      // Images are out of this Loop's scope (P3-L13) — never composed here.
      return 0;
  }
}

function findOwningUnit(units: LogicalUnit[], start: number, end: number): LogicalUnit {
  const owner = units.find((u) => start >= u.span.start && end <= u.span.end);
  if (!owner) {
    throw new Error(
      `compose/line: no LogicalUnit owns source range [${start}, ${end}) — this indicates a boundary-derivation bug, not malformed input`
    );
  }
  return owner;
}

// Atom boundaries are derived from unit spans PLUS every BreakOpportunity
// position already computed by breaks/opportunity.ts — never re-decided
// here. This is what keeps the Line Composer's atomicity guarantees
// (grapheme-safe, cl-08-inseparable, ruby-atomic-unless-segmented)
// automatically consistent with P3-L06's legality analysis: an atom can
// only ever be as fine as an actual candidate boundary already allows.
function computeAtoms(
  units: LogicalUnit[],
  opportunities: BreakOpportunity[],
  measurement: MeasurementFacts,
  settings: CompositionSettings
): CompositionAtom[] {
  if (units.length === 0) return [];
  const blockId = units[0].span.blockId;
  const boundarySet = new Set<number>();
  for (const unit of units) {
    boundarySet.add(unit.span.start);
    boundarySet.add(unit.span.end);
  }
  for (const opportunity of opportunities) {
    boundarySet.add(opportunity.position.start);
  }
  const boundaries = Array.from(boundarySet).sort((a, b) => a - b);

  const perCellAdvance = measurement.naturalAdvanceTick(settings.bodyFontRef, settings.bodyFontSizePt, "");
  const atoms: CompositionAtom[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    if (end <= start) continue; // zero-width marker span (e.g. a MANUAL_BREAK) contributes no atom
    const owner = findOwningUnit(units, start, end);
    const cells = cellCountFor(owner, end - start);
    atoms.push({ sourceSpan: { blockId, start, end }, advanceTick: perCellAdvance * cells });
  }
  return atoms;
}

type BoundaryLegality = "LEGAL" | "ILLEGAL" | "FORCED";

function legalityAfter(offset: number, opportunities: BreakOpportunity[]): BoundaryLegality {
  const opportunity = opportunities.find((o) => o.position.start === offset);
  if (!opportunity) return "LEGAL"; // no candidate recorded here (e.g. end of stream) — nothing prohibits it
  switch (opportunity.reason) {
    case "ALLOWED":
    case "RUBY_INTERNAL_ALLOWED":
      return "LEGAL";
    case "MANUAL_FORCED":
      return "FORCED";
    case "PROHIBITED_KINSOKU":
    case "PROHIBITED_GROUP":
    case "RUBY_INTERNAL_PROHIBITED":
      return "ILLEGAL";
  }
}

export function composeLine(
  units: LogicalUnit[],
  ruleSet: RuleSetVersion,
  measurement: MeasurementFacts,
  settings: CompositionSettings,
  lineExtentTicks: GeometryTick,
  trace?: TraceRecorder
): LineCompositionResult {
  const streamStart = units[0]?.span.start ?? 0;
  const blockId = units[0]?.span.blockId ?? "";

  if (units.length === 0) {
    return {
      line: { id: "line-empty", order: 0, placedUnits: [] },
      residualSpaceTick: lineExtentTicks,
      consumedThroughOffset: streamStart,
    };
  }

  const opportunities = deriveBreakOpportunities(units, ruleSet, trace);
  const atoms = computeAtoms(units, opportunities, measurement, settings);

  let used = 0;
  let cutAtAtomIndex = -1; // last atom INCLUSIVE index this line takes
  let sawAnyLegalCut = false;

  for (let i = 0; i < atoms.length; i++) {
    const nextUsed = used + atoms[i].advanceTick;
    if (nextUsed > lineExtentTicks) {
      break;
    }
    used = nextUsed;
    const legality = legalityAfter(atoms[i].sourceSpan.end, opportunities);
    if (legality === "FORCED") {
      cutAtAtomIndex = i;
      sawAnyLegalCut = true;
      break;
    }
    if (legality === "LEGAL" || i === atoms.length - 1) {
      cutAtAtomIndex = i;
      sawAnyLegalCut = true;
    }
  }

  if (!sawAnyLegalCut) {
    // Either the very first atom alone exceeds the line extent, or every
    // boundary seen before overflow was PROHIBITED — never split an atom
    // and never silently accept an illegal (kinsoku/group) cut to force a
    // fit. Structured hold, not a guess (Contract §26 direction; full
    // LayoutError/hold wiring is P3-L14 — this is the line-level signal it
    // will consume).
    const failingAtom = atoms[0];
    return {
      hold: {
        reason:
          atoms.length > 0 && atoms[0].advanceTick > lineExtentTicks
            ? "SINGLE_ATOM_EXCEEDS_LINE_EXTENT"
            : "NO_LEGAL_BREAK_BOUNDARY_WITHIN_EXTENT",
        sourceSpan: failingAtom?.sourceSpan ?? { blockId, start: streamStart, end: streamStart },
      },
      line: { id: "line-hold", order: 0, placedUnits: [] },
      residualSpaceTick: lineExtentTicks,
      consumedThroughOffset: streamStart,
    };
  }

  const placedUnits: PlacedUnit[] = [];
  let yTick = 0;
  for (let i = 0; i <= cutAtAtomIndex; i++) {
    placedUnits.push({
      id: `placed-${atoms[i].sourceSpan.start}-${atoms[i].sourceSpan.end}`,
      sourceSpan: atoms[i].sourceSpan,
      xTick: 0,
      yTick,
    });
    yTick += atoms[i].advanceTick;
  }

  const usedTick = yTick;
  const residualSpaceTick = lineExtentTicks - usedTick;
  const consumedThroughOffset = atoms[cutAtAtomIndex].sourceSpan.end;

  trace?.record({
    sourceSpan: { blockId, start: consumedThroughOffset, end: consumedThroughOffset },
    ruleApplied: "compose/line Natural-Pitch cut: latest legal boundary that fit",
    alternativesConsidered: atoms.slice(0, cutAtAtomIndex + 1).map((a) => `atom@${a.sourceSpan.end}`),
    outcome: `LINE_CUT_AT:${consumedThroughOffset}`,
  });

  return {
    line: { id: `line-${streamStart}-${consumedThroughOffset}`, order: 0, placedUnits },
    residualSpaceTick,
    consumedThroughOffset,
  };
}
