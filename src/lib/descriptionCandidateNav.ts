/**
 * TSP-B5 (Revision 2) — previous / next navigation over the CURRENT visible candidates (the ones for the
 * categories that are switched on), for the pinned footer card. Pure; the caller moves the editor.
 */

interface Span {
  start: number;
  end: number;
}

export interface CandidateStep<T extends Span> {
  mark: T;
  /** 0-based index in `marks`. */
  index: number;
}

/**
 * The mark to visit when the writer presses 前へ (dir -1) / 次へ (dir +1).
 * - With a current mark: its neighbour, wrapping at the ends.
 * - Without one: the first mark after the caret (前へ: the last one before it), wrapping.
 * Returns null when there is nothing to visit.
 */
export function stepDescriptionCandidate<T extends Span>(
  marks: readonly T[],
  current: T | null,
  caret: number,
  dir: 1 | -1,
): CandidateStep<T> | null {
  const n = marks.length;
  if (n === 0) return null;
  const at = current ? marks.indexOf(current) : -1;
  if (at >= 0) {
    const index = (at + dir + n) % n;
    return { mark: marks[index], index };
  }
  if (dir === 1) {
    const index = marks.findIndex((mark) => mark.start > caret);
    const chosen = index >= 0 ? index : 0;
    return { mark: marks[chosen], index: chosen };
  }
  let chosen = -1;
  for (let i = 0; i < n; i += 1) if (marks[i].start < caret) chosen = i;
  if (chosen < 0) chosen = n - 1;
  return { mark: marks[chosen], index: chosen };
}

/** `3 / 11`, or `– / 11` while no candidate is the current one. */
export function formatCandidatePosition(marks: readonly Span[], current: Span | null): string {
  const index = current ? marks.indexOf(current) : -1;
  return `${index >= 0 ? index + 1 : "–"} / ${marks.length}`;
}
