/**
 * TSP-B4 (Revision 2) — the "held" selection behind 選択範囲を読む.
 *
 * The browser keeps a textarea's selection when focus moves to the footer / Review Hub, but it stops
 * PAINTING it, so the writer believes it is gone. This model records the last non-empty selection so
 * the UI can say 「選択範囲を保持中」 (and paint a ghost highlight) — and, just as importantly, stop
 * saying it the moment it is no longer true:
 *   - it is only valid for the document it was taken in (`docKey`);
 *   - it is only valid while the manuscript still contains exactly that text at that place;
 *   - a collapsed / whitespace-only selection is never held.
 * Pure: no DOM, no React.
 */

export interface HeldSelection {
  start: number;
  end: number;
  /** The selected text at capture time (validity check + character count). */
  text: string;
  docKey: string;
}

export function captureHeldSelection(
  content: string,
  selection: { start: number; end: number },
  docKey: string,
): HeldSelection | null {
  const start = Math.max(0, Math.min(selection.start, selection.end));
  const end = Math.min(content.length, Math.max(selection.start, selection.end));
  if (end <= start) return null;
  const text = content.slice(start, end);
  if (text.trim() === "") return null;
  return { start, end, text, docKey };
}

/** The held selection if — and only if — it still describes real text in this document. */
export function validHeldSelection(held: HeldSelection | null, content: string, docKey: string): HeldSelection | null {
  if (!held || held.docKey !== docKey) return null;
  if (held.end > content.length || content.slice(held.start, held.end) !== held.text) return null;
  return held;
}

export function describeHeldSelection(held: HeldSelection): string {
  return `選択範囲を保持中（${held.text.length.toLocaleString("ja-JP")}文字）`;
}

/** Shown for the 選択範囲 target when nothing valid is held. Never blames the writer. */
export const READ_ALOUD_NO_SELECTION_NOTICE = "本文の読みたい文字を選ぶと、選択範囲を読めます。";

export function sameHeldSelection(a: HeldSelection | null, b: HeldSelection | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.start === b.start && a.end === b.end && a.text === b.text && a.docKey === b.docKey;
}
