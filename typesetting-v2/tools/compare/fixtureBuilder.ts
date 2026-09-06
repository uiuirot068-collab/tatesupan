// Stage C — hand-authored fixture builder. Fixtures are authored as pairs
// of (legacy raw manuscript string, v2 LogicalUnit[] + synthetic v2Source)
// BY HAND per fixture, rather than one shared raw string parsed two
// different ways — this is a deliberate Stage C design choice (see
// `qa/research/PREVIEW_DEVELOPMENT_ADAPTER_PLAN.md`-style disclosure): it
// avoids reimplementing any part of legacy's private tokenizer/regex set
// under `typesetting-v2/`, at the cost of requiring each fixture author to
// keep the two representations honestly equivalent by construction. This
// module only automates the OFFSET ARITHMETIC of building a valid
// LogicalUnit[] + matching source string — it makes no typesetting
// decision (no break/capacity/kinsoku choice) of its own.
//
// v2Source layout: a "flow" region (in reading order, exactly what a real
// Normalizer would hand the Core as body content) followed by a trailing
// "annotations" region holding ruby reading text only (never part of the
// flowed body — matches the real production notation's own semantics,
// where `《reading》` is metadata attached to a base run, not additional
// flowed text). RubyUnit.span is deliberately set equal to baseSpan (not a
// wider "base+reading combined" range) so its capacity cost equals the
// base run's own code-point width — this exactly mirrors both engines'
// independently-arrived-at convention (legacy's `tokenLength`: ruby costs
// `base.length`; v2's `compose/line.ts` `advanceTickFor` RUBY case:
// `perCellAdvance * spanWidth` where `spanWidth` is read directly off
// `unit.span`).

import type {
  ImagePlacement,
  LogicalUnit,
  RubyKind,
  RubySegment,
  RubyUnit,
  SemanticRunKind,
} from "../../core";

export interface RubySegmentPiece {
  base: string;
  reading: string;
}

export type FixturePiece =
  | { kind: "TEXT"; text: string }
  | { kind: "RUBY"; base: string; reading: string; rubyKind?: RubyKind }
  | { kind: "RUBY_JUKUGO"; segments: RubySegmentPiece[] }
  | { kind: "TCY"; text: string; displayText?: string; logicalCells?: number }
  | { kind: "SEMANTIC_RUN"; text: string; runKind: SemanticRunKind }
  | { kind: "IMAGE"; refId: string; intrinsicWidthTicks: number; intrinsicHeightTicks: number; placement?: ImagePlacement }
  | { kind: "MANUAL_BREAK" };

// Synthetic, never-real-text placeholder occupying exactly one code point of
// flow-coordinate space per IMAGE marker — mirrors a real 【IMG:...】 marker
// having positive source width (so it participates in compose/line.ts's
// atom-boundary mechanism, per that file's own "zero-width marker span...
// contributes no atom" comment) without claiming any particular literal
// notation. Never compared as visible text (comparisonTextFor returns "" for
// IMAGE regardless), so its exact character value is immaterial. Built via
// fromCharCode (not an inline literal) so no non-printing byte sits directly
// in this source file.
const IMAGE_MARKER_CHAR = String.fromCharCode(1);

export function buildFixtureUnits(blockId: string, pieces: FixturePiece[]): { units: LogicalUnit[]; source: string } {
  let cursor = 0;
  let flow = "";
  const units: LogicalUnit[] = [];
  const readingQueue: Array<{ text: string; unitIndex: number; segIndex: number }> = [];

  for (const piece of pieces) {
    if (piece.kind === "TEXT") {
      const start = cursor;
      cursor += Array.from(piece.text).length;
      flow += piece.text;
      units.push({ kind: "TEXT", span: { blockId, start, end: cursor }, text: piece.text });
    } else if (piece.kind === "RUBY") {
      const start = cursor;
      cursor += Array.from(piece.base).length;
      flow += piece.base;
      const baseSpan = { blockId, start, end: cursor };
      const unitIndex = units.length;
      units.push({
        kind: "RUBY",
        span: baseSpan,
        rubyKind: piece.rubyKind ?? "ATOMIC",
        baseSpan,
        readingSpan: { blockId, start: -1, end: -1 },
      } satisfies RubyUnit);
      readingQueue.push({ text: piece.reading, unitIndex, segIndex: -1 });
    } else if (piece.kind === "RUBY_JUKUGO") {
      const base = piece.segments.map((s) => s.base).join("");
      const start = cursor;
      cursor += Array.from(base).length;
      flow += base;
      const baseSpan = { blockId, start, end: cursor };
      let segStart = start;
      const segments: RubySegment[] = piece.segments.map((seg) => {
        const segLen = Array.from(seg.base).length;
        const segSpan = { blockId, start: segStart, end: segStart + segLen };
        segStart += segLen;
        return { baseSpan: segSpan, readingSpan: { blockId, start: -1, end: -1 } };
      });
      const unitIndex = units.length;
      units.push({
        kind: "RUBY",
        span: baseSpan,
        rubyKind: "JUKUGO",
        baseSpan,
        readingSpan: { blockId, start: -1, end: -1 },
        segments,
      } satisfies RubyUnit);
      piece.segments.forEach((seg, segIndex) => readingQueue.push({ text: seg.reading, unitIndex, segIndex }));
    } else if (piece.kind === "TCY") {
      const start = cursor;
      cursor += Array.from(piece.text).length;
      flow += piece.text;
      units.push({
        kind: "TCY",
        span: { blockId, start, end: cursor },
        displayText: piece.displayText ?? piece.text,
        logicalCells: piece.logicalCells ?? 1,
      });
    } else if (piece.kind === "SEMANTIC_RUN") {
      const start = cursor;
      cursor += Array.from(piece.text).length;
      flow += piece.text;
      units.push({
        kind: "SEMANTIC_RUN",
        span: { blockId, start, end: cursor },
        runKind: piece.runKind,
        length: Array.from(piece.text).length,
      });
    } else if (piece.kind === "IMAGE") {
      const start = cursor;
      cursor += 1;
      flow += IMAGE_MARKER_CHAR;
      units.push({
        kind: "IMAGE",
        span: { blockId, start, end: cursor },
        refId: piece.refId,
        intrinsicWidth: piece.intrinsicWidthTicks,
        intrinsicHeight: piece.intrinsicHeightTicks,
        placement: piece.placement ?? "CENTER",
      });
    } else if (piece.kind === "MANUAL_BREAK") {
      units.push({ kind: "MANUAL_BREAK", span: { blockId, start: cursor, end: cursor } });
    }
  }

  let source = flow;
  for (const entry of readingQueue) {
    const start = Array.from(source).length;
    source += entry.text;
    const end = Array.from(source).length;
    const unit = units[entry.unitIndex] as RubyUnit;
    if (entry.segIndex === -1) {
      unit.readingSpan = { blockId, start, end };
    } else {
      unit.segments![entry.segIndex].readingSpan = { blockId, start, end };
    }
  }
  for (const unit of units) {
    if (unit.kind === "RUBY" && unit.segments && unit.segments.length > 0) {
      const starts = unit.segments.map((s) => s.readingSpan.start);
      const ends = unit.segments.map((s) => s.readingSpan.end);
      unit.readingSpan = { blockId: unit.baseSpan.blockId, start: Math.min(...starts), end: Math.max(...ends) };
    }
  }

  return { units, source };
}
