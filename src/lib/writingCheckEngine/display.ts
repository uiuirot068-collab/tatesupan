/**
 * Display-preparation helpers -- ported verbatim from pre-2.0
 * `src/lib/writingCheck.ts` (no behavior change, only the parameter
 * type now reads `WritingDiagnostic` instead of `WritingIssue`, which
 * remains a type alias of it).
 */
import type { WritingDiagnostic } from "./types";

/**
 * Collapses overlapping / touching issue ranges into the minimal set of
 * display ranges for the wavy underline. The reason list keeps the
 * original issues -- this is only for drawing.
 */
export function mergeIssueRanges(issues: WritingDiagnostic[]): Array<{ start: number; end: number }> {
  const sorted = [...issues].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Array<{ start: number; end: number }> = [];
  for (const { start, end } of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last.end) {
      last.end = Math.max(last.end, end);
    } else {
      merged.push({ start, end });
    }
  }
  return merged;
}

export type WritingSegment = { text: string; flagged: boolean };

/**
 * Splits `text` into consecutive segments, each either plain or
 * `flagged` (inside a merged issue range). `segments.map((s) =>
 * s.text).join("")` always reconstructs `text` exactly, so the overlay
 * mirror can never gain or lose a character relative to the textarea.
 * Ranges are clamped to `[0, text.length]` defensively.
 */
export function buildWritingSegments(text: string, ranges: Array<{ start: number; end: number }>): WritingSegment[] {
  if (ranges.length === 0) return text ? [{ text, flagged: false }] : [];

  const segments: WritingSegment[] = [];
  let cursor = 0;
  for (const range of ranges) {
    const start = Math.max(cursor, Math.min(range.start, text.length));
    const end = Math.max(start, Math.min(range.end, text.length));
    if (start > cursor) segments.push({ text: text.slice(cursor, start), flagged: false });
    if (end > start) segments.push({ text: text.slice(start, end), flagged: true });
    cursor = end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), flagged: false });
  return segments;
}

/**
 * The text immediately around an issue, for the reason list. Newlines
 * are shown as `↵` so a snippet stays on one line.
 */
export function issueContext(text: string, issue: WritingDiagnostic, pad = 14): { before: string; target: string; after: string } {
  const clean = (value: string) => value.replace(/\r?\n/g, "↵");
  return {
    before: clean(text.slice(Math.max(0, issue.start - pad), issue.start)),
    target: clean(text.slice(issue.start, issue.end)),
    after: clean(text.slice(issue.end, Math.min(text.length, issue.end + pad))),
  };
}
