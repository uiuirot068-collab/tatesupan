/**
 * Display-preparation helpers -- ported verbatim from pre-2.0
 * `src/lib/writingCheck.ts` (no behavior change, only the parameter
 * type now reads `WritingDiagnostic` instead of `WritingIssue`, which
 * remains a type alias of it).
 */
import type { WritingDiagnostic, WritingSeverity } from "./types";

export type WritingDisplayRange = { start: number; end: number; severity: WritingSeverity; ngWord?: true };

/**
 * Collapses overlapping / touching issue ranges into the minimal set of
 * display ranges for the wavy underline. The reason list keeps the
 * original issues -- this is only for drawing.
 *
 * Phase 3 (RED/YELLOW UI): each merged range also carries a `severity`,
 * used purely for underline COLOR -- never conflated with `fixClass` (see
 * `types.ts`'s own doc on why those two axes are independent). When a
 * HIGH_CONFIDENCE (RED) range touches/overlaps a REVIEW (YELLOW) one,
 * HIGH_CONFIDENCE wins for the merged range -- a manuscript-accident
 * signal must never be visually downgraded to "just review this" by
 * merging with an adjacent lower-severity note.
 */
export function mergeIssueRanges(issues: WritingDiagnostic[]): WritingDisplayRange[] {
  const sorted = [...issues].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: WritingDisplayRange[] = [];
  for (const { start, end, severity, ruleId } of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last.end) {
      last.end = Math.max(last.end, end);
      if (severity === "HIGH_CONFIDENCE") last.severity = "HIGH_CONFIDENCE";
      if (last.severity !== "HIGH_CONFIDENCE" && ruleId === "R12-ngword") last.ngWord = true;
    } else {
      merged.push({ start, end, severity, ...(ruleId === "R12-ngword" ? { ngWord: true as const } : {}) });
    }
  }
  return merged;
}

export type WritingSegment = { text: string; flagged: boolean; severity?: WritingSeverity; ngWord?: true };

/**
 * Splits `text` into consecutive segments, each either plain or
 * `flagged` (inside a merged issue range, carrying that range's own
 * `severity` for RED/YELLOW underline color). `segments.map((s) =>
 * s.text).join("")` always reconstructs `text` exactly, so the overlay
 * mirror can never gain or lose a character relative to the textarea.
 * Ranges are clamped to `[0, text.length]` defensively.
 */
export function buildWritingSegments(text: string, ranges: WritingDisplayRange[]): WritingSegment[] {
  if (ranges.length === 0) return text ? [{ text, flagged: false }] : [];

  const segments: WritingSegment[] = [];
  let cursor = 0;
  for (const range of ranges) {
    const start = Math.max(cursor, Math.min(range.start, text.length));
    const end = Math.max(start, Math.min(range.end, text.length));
    if (start > cursor) segments.push({ text: text.slice(cursor, start), flagged: false });
    if (end > start) segments.push({ text: text.slice(start, end), flagged: true, severity: range.severity, ...(range.ngWord ? { ngWord: true as const } : {}) });
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
