import type { LogicalUnit, PlacedUnit } from "../core";

/**
 * Shared by Preview (`preview/paintModel.ts`) and Publication
 * (`publication/paintModel.ts`): the painted extent (GeometryTick) of a line's
 * LAST placed atom. Core does not record an atom's advance on `PlacedUnit`,
 * so every other atom's extent is the exact delta to the next atom's `yTick`;
 * only the last one needs this estimate. Both painters must agree on it or the
 * same atom is drawn at a different size/baseline in Preview vs PDF/JPG.
 *
 * - A multi-cell atom uses its own cell count: a SEMANTIC_RUN (――/……) its run
 *   length, a RUBY atom its base span (Core composes it at perCell × base
 *   width). Never a neighbour's 1-cell delta (that squeezed or clipped them).
 * - Otherwise the previous atom's delta (preserves a compressed advance such
 *   as `。」` when it repeats), or, for a line's ONLY atom, one body cell —
 *   never the column pitch (Publication used to fall back to
 *   `linePitchTicks`, painting a document-final single character ~0.5em low).
 * - Always clamped to what is left of the line, so nothing paints past the
 *   frame.
 */
export function lastAtomExtentTicks(input: {
  owner: LogicalUnit | null | undefined;
  placed: PlacedUnit;
  prev: PlacedUnit | undefined;
  cellTicks: number;
  remainingLineExtentTicks: number;
}): number {
  const { owner, placed, prev, cellTicks, remainingLineExtentTicks } = input;
  const ownCells = owner?.kind === "SEMANTIC_RUN"
    ? owner.length
    : owner?.kind === "RUBY" ? placed.sourceSpan.end - placed.sourceSpan.start : undefined;
  const guess = ownCells !== undefined
    ? cellTicks * ownCells
    : prev ? placed.yTick - prev.yTick : cellTicks;
  return Math.min(guess, remainingLineExtentTicks);
}
