// Break opportunity derivation (Core Contract §8). Pure function:
// (LogicalUnit[], RuleSetVersion) -> BreakOpportunity[]. This answers only
// "could a break legally occur here, and why/why not" — it never decides
// which opportunity is actually taken given physical line capacity (that is
// the Natural-Pitch Line Composer's job, a later Loop). No remaining-width,
// GeometryTick-accumulation, or page-filling logic exists anywhere here.

import { codePointSlice, graphemeBoundaries } from "../source/graphemeSafety";
import type { SourceSpan } from "../source/span";
import { DEFAULT_CLASS, type CharacterClass, type RuleSetVersion } from "../rules/characterClass";
import type { LogicalUnit, SemanticRunKind, TextUnit } from "../units";
import type { TraceRecorder } from "../trace";
import { deriveRubyBreakOpportunities } from "../ruby";
import { semanticRunPairRule } from "../semanticRuns";

export type BreakOpportunityReason =
  | "ALLOWED"
  | "PROHIBITED_KINSOKU"
  | "PROHIBITED_GROUP"
  | "RUBY_INTERNAL_ALLOWED"
  | "RUBY_INTERNAL_PROHIBITED"
  | "MANUAL_FORCED"
  | "PARAGRAPH_FORCED";

export interface BreakOpportunity {
  position: SourceSpan; // zero-width span at the candidate boundary
  reason: BreakOpportunityReason;
}

function boundarySpan(blockId: string, offset: number): SourceSpan {
  return { blockId, start: offset, end: offset };
}

function firstCodePoint(text: string): string {
  return Array.from(text)[0] ?? "";
}

function lastCodePoint(text: string): string {
  const chars = Array.from(text);
  return chars[chars.length - 1] ?? "";
}

function classifyOrdinaryBoundary(left: CharacterClass, right: CharacterClass): BreakOpportunityReason {
  // Contract §8: a candidate is PROHIBITED_KINSOKU if either the preceding
  // class forbids ending a line, or the following class forbids starting one.
  if (!left.mayEndLine || !right.mayStartLine) {
    return "PROHIBITED_KINSOKU";
  }
  return "ALLOWED";
}

interface EdgeContext {
  firstClass: CharacterClass;
  lastClass: CharacterClass;
  semanticRunKind?: SemanticRunKind;
}

// The character class to consult at a unit's outer edges. Only TEXT units
// carry classifiable characters at their boundary; every other kind is a
// structural unit whose outer edge is class-neutral for ordinary kinsoku
// purposes (SEMANTIC_RUN's cl-08 pairing is handled separately, by identity,
// not by character class).
function edgeContextFor(unit: LogicalUnit, ruleSet: RuleSetVersion): EdgeContext {
  if (unit.kind === "TEXT") {
    return {
      firstClass: ruleSet.characterClassFor(firstCodePoint(unit.text)),
      lastClass: ruleSet.characterClassFor(lastCodePoint(unit.text)),
    };
  }
  if (unit.kind === "SEMANTIC_RUN") {
    return { firstClass: DEFAULT_CLASS, lastClass: DEFAULT_CLASS, semanticRunKind: unit.runKind };
  }
  return { firstClass: DEFAULT_CLASS, lastClass: DEFAULT_CLASS };
}

// Internal candidate boundaries within one TextUnit's own text — one per
// grapheme-cluster boundary that is not the unit's own outer edge. Boundary
// enumeration goes through graphemeBoundaries() exclusively, so a candidate
// can never land inside a surrogate pair, combining-mark sequence,
// variation-selector pair, or ZWJ sequence (INV-011).
function deriveTextUnitInternalOpportunities(
  unit: TextUnit,
  ruleSet: RuleSetVersion,
  trace?: TraceRecorder
): BreakOpportunity[] {
  const boundaries = graphemeBoundaries(unit.text);
  const opportunities: BreakOpportunity[] = [];
  for (let i = 1; i < boundaries.length - 1; i++) {
    const leftAtom = codePointSlice(unit.text, boundaries[i - 1], boundaries[i]);
    const rightAtom = codePointSlice(unit.text, boundaries[i], boundaries[i + 1]);
    const leftClass = ruleSet.characterClassFor(lastCodePoint(leftAtom));
    const rightClass = ruleSet.characterClassFor(firstCodePoint(rightAtom));
    const reason = classifyOrdinaryBoundary(leftClass, rightClass);
    const position = boundarySpan(unit.span.blockId, unit.span.start + boundaries[i]);

    opportunities.push({ position, reason });
    trace?.record({
      sourceSpan: position,
      ruleApplied:
        reason === "PROHIBITED_KINSOKU" ? `kinsoku: ${leftClass.id}|${rightClass.id}` : "ordinary boundary",
      alternativesConsidered: ["ALLOWED", "PROHIBITED_KINSOKU"],
      outcome: reason,
    });
  }
  return opportunities;
}

export function deriveBreakOpportunities(
  units: LogicalUnit[],
  ruleSet: RuleSetVersion,
  trace?: TraceRecorder
): BreakOpportunity[] {
  const opportunities: BreakOpportunity[] = [];

  for (const unit of units) {
    if (unit.kind === "TEXT") {
      opportunities.push(...deriveTextUnitInternalOpportunities(unit, ruleSet, trace));
    } else if (unit.kind === "RUBY") {
      const rubyOpportunities = deriveRubyBreakOpportunities(unit);
      opportunities.push(...rubyOpportunities);
      for (const opportunity of rubyOpportunities) {
        trace?.record({
          sourceSpan: opportunity.position,
          ruleApplied: "cl-23 jukugo declared segment boundary (HG-3)",
          alternativesConsidered: ["RUBY_INTERNAL_ALLOWED", "RUBY_INTERNAL_PROHIBITED"],
          outcome: opportunity.reason,
        });
      }
    } else if (unit.kind === "MANUAL_BREAK") {
      const position = boundarySpan(unit.span.blockId, unit.span.start);
      opportunities.push({ position, reason: "MANUAL_FORCED" });
      trace?.record({
        sourceSpan: position,
        ruleApplied: "Contract §13 manual page break — always forced",
        alternativesConsidered: ["MANUAL_FORCED"],
        outcome: "MANUAL_FORCED",
      });
    } else if (unit.kind === "PARAGRAPH_BREAK") {
      // Positioned at the unit's own END (not start, unlike MANUAL_BREAK):
      // a paragraph-break's own atom belongs to the LINE it terminates
      // (Human Product Decision B — mirrors legacy's own "\n" token being
      // the last thing placed on the line it ends), so the forced cut must
      // land right after it, not before.
      const position = boundarySpan(unit.span.blockId, unit.span.end);
      opportunities.push({ position, reason: "PARAGRAPH_FORCED" });
      trace?.record({
        sourceSpan: position,
        ruleApplied: "Human Product Decision B — bare manuscript line ending always ends the current line",
        alternativesConsidered: ["PARAGRAPH_FORCED"],
        outcome: "PARAGRAPH_FORCED",
      });
    }
    // TCY, IMAGE: no internal opportunities — each is one atomic composition
    // group for break-analysis purposes (cl-30 for TCY; images are never
    // decomposed at all).
  }

  for (let i = 0; i < units.length - 1; i++) {
    const left = units[i];
    const right = units[i + 1];
    const leftEdge = edgeContextFor(left, ruleSet);
    const rightEdge = edgeContextFor(right, ruleSet);
    const offset = left.span.end;
    const position = boundarySpan(left.span.blockId, offset);

    let reason: BreakOpportunityReason;
    let ruleApplied: string;
    const leftIsFullImage = left.kind === "IMAGE" && left.placement === "FULL";
    const rightIsFullImage = right.kind === "IMAGE" && right.placement === "FULL";
    if (leftIsFullImage || rightIsFullImage) {
      // Contract §14: FULL placement forces isolation on both sides — the
      // already-frozen decision core/images/placeImage() records (P3-L11).
      // Reusing MANUAL_FORCED is a deliberate choice: it is the existing,
      // already-tested mechanism for "this boundary is never optional,"
      // which correctly propagates through composeLine/Column/Page to close
      // the line/column/page immediately, not a new mechanism invented here.
      reason = "MANUAL_FORCED";
      ruleApplied = "Contract §14 FULL image placement forces isolation on both sides";
    } else if (leftEdge.semanticRunKind && rightEdge.semanticRunKind) {
      const pairing = semanticRunPairRule(ruleSet, leftEdge.semanticRunKind, rightEdge.semanticRunKind);
      reason = pairing === "INSEPARABLE" ? "PROHIBITED_GROUP" : "ALLOWED";
      ruleApplied = `cl-08 pair rule: ${leftEdge.semanticRunKind}+${rightEdge.semanticRunKind} -> ${pairing}`;
    } else {
      reason = classifyOrdinaryBoundary(leftEdge.lastClass, rightEdge.firstClass);
      ruleApplied =
        reason === "PROHIBITED_KINSOKU"
          ? `kinsoku: ${leftEdge.lastClass.id}|${rightEdge.firstClass.id}`
          : "ordinary boundary";
    }

    opportunities.push({ position, reason });
    trace?.record({
      sourceSpan: position,
      ruleApplied,
      alternativesConsidered: ["ALLOWED", "PROHIBITED_KINSOKU", "PROHIBITED_GROUP"],
      outcome: reason,
    });
  }

  return opportunities.sort((a, b) => a.position.start - b.position.start);
}
