/**
 * Integrity boundary for native textarea deletion transactions.
 *
 * A normal Backspace/Delete is still performed entirely by the browser. This
 * module only repairs the resulting value when it contradicts the preceding
 * `beforeinput` contract (for example, a collapsed Backspace removing the
 * remainder of a line after an IME/selection glitch). Keeping this check at
 * the source boundary prevents a corrupted DOM value from becoming canonical
 * manuscript state and subsequently reaching Preview/autosave.
 */

export interface TextareaDeletionSnapshot {
  beforeText: string;
  selectionStart: number;
  selectionEnd: number;
  inputType: string;
}

export interface TextareaDeletionResolution {
  text: string;
  selectionStart: number;
  selectionEnd: number;
  repaired: boolean;
}

function previousCodePointStart(text: string, caret: number): number {
  if (caret <= 0) return 0;
  const last = text.charCodeAt(caret - 1);
  if (last >= 0xdc00 && last <= 0xdfff && caret >= 2) {
    const first = text.charCodeAt(caret - 2);
    if (first >= 0xd800 && first <= 0xdbff) return caret - 2;
  }
  return caret - 1;
}

function nextCodePointEnd(text: string, caret: number): number {
  if (caret >= text.length) return text.length;
  const first = text.charCodeAt(caret);
  if (first >= 0xd800 && first <= 0xdbff && caret + 1 < text.length) {
    const last = text.charCodeAt(caret + 1);
    if (last >= 0xdc00 && last <= 0xdfff) return caret + 2;
  }
  return caret + 1;
}

function graphemeRangeAt(
  text: string,
  caret: number,
  direction: "backward" | "forward"
): { start: number; end: number } | null {
  if (typeof Intl.Segmenter !== "function") return null;
  const probe = direction === "backward" ? caret - 1 : caret;
  if (probe < 0 || probe >= text.length) return null;

  const segments = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text);
  for (const part of segments) {
    const start = part.index;
    const end = start + part.segment.length;
    if (start <= probe && probe < end) return { start, end };
  }
  return null;
}

function splice(text: string, start: number, end: number): string {
  return text.slice(0, start) + text.slice(end);
}

/**
 * Resolves one native textarea change. Non-character deletion input types
 * (word/line deletion, Cut, history) and every insertion are deliberately
 * left untouched. Callers must also bypass this during active composition.
 */
export function resolveTextareaDeletion(
  snapshot: TextareaDeletionSnapshot,
  afterText: string
): TextareaDeletionResolution {
  const { beforeText, inputType } = snapshot;
  const selectionStart = Math.max(0, Math.min(beforeText.length, snapshot.selectionStart));
  const selectionEnd = Math.max(selectionStart, Math.min(beforeText.length, snapshot.selectionEnd));

  if (inputType !== "deleteContentBackward" && inputType !== "deleteContentForward") {
    return {
      text: afterText,
      selectionStart,
      selectionEnd,
      repaired: false,
    };
  }

  if (selectionStart !== selectionEnd) {
    const expected = splice(beforeText, selectionStart, selectionEnd);
    return afterText === expected
      ? { text: afterText, selectionStart, selectionEnd: selectionStart, repaired: false }
      : { text: expected, selectionStart, selectionEnd: selectionStart, repaired: true };
  }

  const caret = selectionStart;
  const backward = inputType === "deleteContentBackward";
  const codePointStart = backward ? previousCodePointStart(beforeText, caret) : caret;
  const codePointEnd = backward ? caret : nextCodePointEnd(beforeText, caret);
  const codePointResult = splice(beforeText, codePointStart, codePointEnd);
  const grapheme = graphemeRangeAt(beforeText, caret, backward ? "backward" : "forward");
  const graphemeResult = grapheme ? splice(beforeText, grapheme.start, grapheme.end) : codePointResult;

  // Browsers differ on whether Backspace removes one code point (notably a
  // combining mark) or the whole extended grapheme. Both are legitimate;
  // neither permits a collapsed caret to remove an arbitrary larger range.
  if (afterText === codePointResult) {
    const nextCaret = backward ? codePointStart : caret;
    return { text: afterText, selectionStart: nextCaret, selectionEnd: nextCaret, repaired: false };
  }
  if (afterText === graphemeResult) {
    const nextCaret = backward && grapheme ? grapheme.start : caret;
    return { text: afterText, selectionStart: nextCaret, selectionEnd: nextCaret, repaired: false };
  }

  // Recovery prefers the full grapheme boundary. This path is reached only
  // after the browser/IME result has already violated both accepted native
  // forms; it is not used for ordinary editing.
  const repairedStart = backward && grapheme ? grapheme.start : codePointStart;
  const repairedText = graphemeResult;
  const repairedCaret = backward ? repairedStart : caret;
  return {
    text: repairedText,
    selectionStart: repairedCaret,
    selectionEnd: repairedCaret,
    repaired: true,
  };
}
