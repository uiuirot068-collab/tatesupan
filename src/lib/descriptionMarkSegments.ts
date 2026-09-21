/** TSP-B5 — pure helpers for painting candidate ranges (kept out of the component so they run in Node tests). */

export interface MarkRange {
  start: number;
  end: number;
}

/** Sorted, overlap-merged ranges clipped to the text, so a phrase is highlighted once however many candidates cover it. */
export function mergeMarkRanges(marks: readonly MarkRange[], textLength: number): MarkRange[] {
  const sorted = marks
    .map((mark) => ({ start: Math.max(0, mark.start), end: Math.min(textLength, mark.end) }))
    .filter((mark) => mark.end > mark.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: MarkRange[] = [];
  for (const mark of sorted) {
    const last = merged[merged.length - 1];
    if (last && mark.start <= last.end) last.end = Math.max(last.end, mark.end);
    else merged.push({ ...mark });
  }
  return merged;
}

export function buildMarkSegments(text: string, marks: readonly MarkRange[]): { text: string; marked: boolean }[] {
  const segments: { text: string; marked: boolean }[] = [];
  let cursor = 0;
  for (const range of mergeMarkRanges(marks, text.length)) {
    if (range.start > cursor) segments.push({ text: text.slice(cursor, range.start), marked: false });
    segments.push({ text: text.slice(range.start, range.end), marked: true });
    cursor = range.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), marked: false });
  return segments;
}

/** Marks intersecting `[pageStart, pageEnd)`, re-based to page-local coordinates (for the paged / WINDOWED editor). */
export function marksForPage<T extends MarkRange>(marks: readonly T[], pageStart: number, pageEnd: number): T[] {
  return marks
    .filter((mark) => mark.start < pageEnd && mark.end > pageStart)
    .map((mark) => ({ ...mark, start: Math.max(0, mark.start - pageStart), end: Math.min(pageEnd - pageStart, mark.end - pageStart) }));
}
