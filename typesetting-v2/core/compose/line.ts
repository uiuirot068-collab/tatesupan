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
import { tcyCellCost } from "../tcy";

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
  // True only when this line ended because of a MANUAL_FORCED opportunity
  // (Contract §13/INV-006) — never because of ordinary capacity or an
  // otherwise-legal boundary. The column/page composer (P3-L08) uses this
  // to close the current column AND page immediately, even under capacity
  // (Contract Appendix CASE 6), rather than starting another line here.
  forcedBreak: boolean;
  // True only when this line ended because of a PARAGRAPH_FORCED opportunity
  // (Human Product Decision B, `qa/evidence/PARAGRAPH_SEMANTICS_PRE_STAGE_D.md`)
  // — a bare manuscript line ending. Unlike `forcedBreak`, this never closes
  // the column/page: it only tells the column composer that the NEXT line
  // it composes is a fresh paragraph start (for auto-indent purposes).
  endedAtParagraphBreak: boolean;
}

// Human Product Decision A (一字下げ): a paragraph's first line reserves one
// character cell, UNLESS its first visible character is a conversation-
// opening bracket (matches legacy convention — `tategaki.ts`'s own
// AUTO_INDENT_EXEMPT_OPENERS, ported verbatim) or is itself the indent
// character already (avoids double-indenting a manuscript that already
// typed a leading full-width space). Ported as Core-owned data — not a
// renderer choice, not a manuscript mutation (Contract-consistent: this
// never touches SourceSpan or unit content, only a line's own capacity
// budget).
const AUTO_INDENT_EXEMPT_OPENERS = "「『（〈《【〔［｛“‘";
const AUTO_INDENT_CHAR = "　"; // full-width space (U+3000)

// The first visible character of a unit, for the auto-indent exemption
// check only — determinable for TEXT/TCY (both store their own content
// directly); NOT determinable for RUBY (Core's RubyUnit carries only
// `baseSpan`, never the base text itself) or SEMANTIC_RUN (carries only
// `length`, never its literal characters) — a known, disclosed architecture
// constraint (`qa/evidence/PARAGRAPH_SEMANTICS_PRE_STAGE_D.md` §5): a
// paragraph starting with one of these two kinds will not receive
// auto-indent in v2, unlike legacy (whose own tokens store this content
// directly). `undefined` here mirrors legacy's own `firstVisibleTokenChar`
// returning `""` for anything it doesn't special-case (image/pageBreak) —
// both paths converge on "auto-indent does not apply" with no character.
function firstVisibleCharFor(unit: LogicalUnit): string | undefined {
  if (unit.kind === "TEXT") return Array.from(unit.text)[0];
  if (unit.kind === "TCY") return Array.from(unit.displayText)[0];
  return undefined;
}

function needsAutoIndent(firstChar: string | undefined): boolean {
  return (
    firstChar !== undefined &&
    firstChar.length > 0 &&
    !AUTO_INDENT_EXEMPT_OPENERS.includes(firstChar) &&
    firstChar !== AUTO_INDENT_CHAR
  );
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
//
// IMAGE is deliberately NOT a cell multiple: an image consumes its own real
// intrinsic extent (Contract §14), read from MeasurementFacts directly, not
// derived from the font's per-character cell size (P3-L15A — closes the gap
// where images previously composed at zero cost, discovered at P3-L15).
function advanceTickFor(
  unit: LogicalUnit,
  spanWidth: number,
  perCellAdvance: GeometryTick,
  measurement: MeasurementFacts
): GeometryTick {
  switch (unit.kind) {
    case "TEXT":
      return perCellAdvance;
    case "TCY":
      return perCellAdvance * tcyCellCost(unit);
    case "SEMANTIC_RUN":
      return perCellAdvance * unit.length;
    case "RUBY":
      return perCellAdvance * spanWidth;
    case "MANUAL_BREAK":
      return 0;
    case "IMAGE":
      return measurement.imageIntrinsicTick(unit.refId).height;
    case "PARAGRAPH_BREAK":
      // Zero cost, mirrors legacy's own "\n" token (tokenLength === 0 by
      // omission — bare newlines are never counted toward line capacity).
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
interface AtomComputationResult {
  atoms: CompositionAtom[];
  // Set when an IMAGE unit's MeasurementFacts yields no resolvable intrinsic
  // size (height <= 0) — Contract §26's own example of a LayoutError case
  // ("an image with no resolvable intrinsic size and no MeasurementFacts
  // entry"). Never silently treated as a zero-cost, always-fits atom.
  unresolvedImageSpan?: SourceSpan;
}

function computeAtoms(
  units: LogicalUnit[],
  opportunities: BreakOpportunity[],
  measurement: MeasurementFacts,
  settings: CompositionSettings
): AtomComputationResult {
  if (units.length === 0) return { atoms: [] };
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
    const sourceSpan = { blockId, start, end };
    if (owner.kind === "IMAGE") {
      const advanceTick = advanceTickFor(owner, end - start, perCellAdvance, measurement);
      if (advanceTick <= 0) {
        return { atoms, unresolvedImageSpan: sourceSpan };
      }
      atoms.push({ sourceSpan, advanceTick });
      continue;
    }
    atoms.push({ sourceSpan, advanceTick: advanceTickFor(owner, end - start, perCellAdvance, measurement) });
  }
  return { atoms };
}

// FORCED_PAGE (MANUAL_FORCED) and FORCED_LINE (PARAGRAPH_FORCED) both cut
// the line at this exact boundary, but only FORCED_PAGE propagates upward
// as `forcedBreak` (closing the column+page, Contract §13/INV-006).
// FORCED_LINE ends only this line — ordinary column/page flow continues.
type BoundaryLegality = "LEGAL" | "ILLEGAL" | "FORCED_LINE" | "FORCED_PAGE";

function legalityAfter(offset: number, opportunities: BreakOpportunity[]): BoundaryLegality {
  const opportunity = opportunities.find((o) => o.position.start === offset);
  if (!opportunity) return "LEGAL"; // no candidate recorded here (e.g. end of stream) — nothing prohibits it
  switch (opportunity.reason) {
    case "ALLOWED":
    case "RUBY_INTERNAL_ALLOWED":
      return "LEGAL";
    case "MANUAL_FORCED":
      return "FORCED_PAGE";
    case "PARAGRAPH_FORCED":
      return "FORCED_LINE";
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
  // Human Product Decision A (一字下げ): true when this line is the first
  // line of a paragraph (document start, or the line immediately following
  // a PARAGRAPH_FORCED cut) — threaded from the column composer, which
  // tracks it across lines exactly as legacy's `pendingParagraphStart` does
  // across its own line/page loop.
  isParagraphStart: boolean,
  trace?: TraceRecorder
): LineCompositionResult {
  const streamStart = units[0]?.span.start ?? 0;
  const blockId = units[0]?.span.blockId ?? "";

  if (units.length === 0) {
    return {
      line: { id: "line-empty", order: 0, placedUnits: [] },
      residualSpaceTick: lineExtentTicks,
      consumedThroughOffset: streamStart,
      forcedBreak: false,
      endedAtParagraphBreak: false,
    };
  }

  const perCellAdvance = measurement.naturalAdvanceTick(settings.bodyFontRef, settings.bodyFontSizePt, "");
  const appliesIndent = isParagraphStart && needsAutoIndent(firstVisibleCharFor(units[0]));
  const indentTick = appliesIndent ? perCellAdvance : 0;
  const effectiveLineExtentTicks = lineExtentTicks - indentTick;

  const opportunities = deriveBreakOpportunities(units, ruleSet, trace);
  const atomResult = computeAtoms(units, opportunities, measurement, settings);
  if (atomResult.unresolvedImageSpan) {
    return {
      hold: {
        reason: "IMAGE_INTRINSIC_SIZE_UNRESOLVED",
        sourceSpan: atomResult.unresolvedImageSpan,
      },
      line: { id: "line-hold", order: 0, placedUnits: [] },
      residualSpaceTick: effectiveLineExtentTicks,
      consumedThroughOffset: streamStart,
      forcedBreak: false,
      endedAtParagraphBreak: false,
    };
  }
  const atoms = atomResult.atoms;

  let used = 0;
  let cutAtAtomIndex = -1; // last atom INCLUSIVE index this line takes
  let sawAnyLegalCut = false;
  let forcedCut = false;
  let endedAtParagraphBreak = false;

  for (let i = 0; i < atoms.length; i++) {
    const nextUsed = used + atoms[i].advanceTick;
    if (nextUsed > effectiveLineExtentTicks) {
      break;
    }
    used = nextUsed;
    const legality = legalityAfter(atoms[i].sourceSpan.end, opportunities);
    if (legality === "FORCED_PAGE") {
      cutAtAtomIndex = i;
      sawAnyLegalCut = true;
      forcedCut = true;
      break;
    }
    if (legality === "FORCED_LINE") {
      cutAtAtomIndex = i;
      sawAnyLegalCut = true;
      endedAtParagraphBreak = true;
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
          atoms.length > 0 && atoms[0].advanceTick > effectiveLineExtentTicks
            ? "SINGLE_ATOM_EXCEEDS_LINE_EXTENT"
            : "NO_LEGAL_BREAK_BOUNDARY_WITHIN_EXTENT",
        sourceSpan: failingAtom?.sourceSpan ?? { blockId, start: streamStart, end: streamStart },
      },
      line: { id: "line-hold", order: 0, placedUnits: [] },
      residualSpaceTick: effectiveLineExtentTicks,
      consumedThroughOffset: streamStart,
      forcedBreak: false,
      endedAtParagraphBreak: false,
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
  const residualSpaceTick = effectiveLineExtentTicks - usedTick;
  const consumedThroughOffset = atoms[cutAtAtomIndex].sourceSpan.end;

  trace?.record({
    sourceSpan: { blockId, start: consumedThroughOffset, end: consumedThroughOffset },
    ruleApplied: "compose/line Natural-Pitch cut: latest legal boundary that fit",
    alternativesConsidered: atoms.slice(0, cutAtAtomIndex + 1).map((a) => `atom@${a.sourceSpan.end}`),
    outcome: `LINE_CUT_AT:${consumedThroughOffset}`,
  });

  return {
    line: {
      id: `line-${streamStart}-${consumedThroughOffset}`,
      order: 0,
      placedUnits,
      ...(appliesIndent ? { indentTick } : {}),
    },
    residualSpaceTick,
    consumedThroughOffset,
    forcedBreak: forcedCut,
    endedAtParagraphBreak,
  };
}
