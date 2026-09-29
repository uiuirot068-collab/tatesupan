/**
 * WINDOWED (PagedEditor) IME composition as ONE transaction.
 *
 * A composition never commits the canonical manuscript while it is in
 * progress: committing each update used to re-paginate the manuscript and
 * re-slice the mounted 編集ページ under the IME (a large selection shrinks the
 * page, so its boundary moved and React re-assigned the textarea value), which
 * corrupted the text and left undo entries that no longer matched it. The
 * editor only mirrors the IME in the textarea; when the composition ends
 * (compositionend, or a recovery signal when that event never arrives) this
 * module decides, from what was captured when it began, the ONE edit to
 * commit -- or that nothing may change.
 */
import type { RawEdit } from "./undoModel";

export interface CompositionBase {
  /** The canonical manuscript when the composition began. */
  baseCanonical: string;
  /** The mounted 編集ページ's canonical range when the composition began. */
  pageStart: number;
  pageEnd: number;
  /** The textarea's value and selection when the composition began (page-local). */
  beforeText: string;
  selectionStart: number;
  selectionEnd: number;
  /** The composition began over 全文選択: it replaces the whole manuscript. */
  whole: boolean;
}

export type CompositionOutcome =
  | { kind: "whole-replace"; text: string }
  /** 全文選択 stays and the manuscript is untouched: canceled, or the IME's text is unknown (never guess at it). */
  | { kind: "whole-unchanged"; reason: "canceled" | "unknown-text" }
  | { kind: "page-commit"; nextCanonical: string; edit: RawEdit; caretLocal: number }
  | { kind: "page-unchanged" }
  /** The manuscript is left as it is now: it no longer matches what the composition began on. */
  | { kind: "discard"; reason: "external-change" | "stale-page" };

/**
 * The exact splice that turns `beforeText` into `finalText`, in canonical
 * offsets. Uses the composition's starting selection when the text around it
 * is intact (the IME replaced exactly that selection), otherwise the
 * common-prefix/suffix diff -- either way applying the edit to `beforeText`
 * yields `finalText`, so its undo restores the page exactly.
 */
export function compositionEdit(
  beforeText: string,
  selectionStart: number,
  selectionEnd: number,
  finalText: string,
  pageStart: number
): RawEdit | null {
  if (beforeText === finalText) return null;
  const prefix = beforeText.slice(0, selectionStart);
  const suffix = beforeText.slice(selectionEnd);
  let start: number;
  let end: number;
  if (
    finalText.length >= prefix.length + suffix.length &&
    finalText.startsWith(prefix) &&
    finalText.endsWith(suffix)
  ) {
    start = selectionStart;
    end = selectionEnd;
  } else {
    const max = Math.min(beforeText.length, finalText.length);
    start = 0;
    while (start < max && beforeText[start] === finalText[start]) start += 1;
    let suffixLength = 0;
    while (
      suffixLength < beforeText.length - start &&
      suffixLength < finalText.length - start &&
      beforeText[beforeText.length - 1 - suffixLength] === finalText[finalText.length - 1 - suffixLength]
    ) {
      suffixLength += 1;
    }
    end = beforeText.length - suffixLength;
  }
  const insertedText = finalText.slice(start, finalText.length - (beforeText.length - end));
  return {
    rangeStart: pageStart + start,
    removedText: beforeText.slice(start, end),
    insertedText,
    atomic: true,
  };
}

/**
 * Decides the ONE commit a finished composition makes.
 *
 * - `data`: the IME's committed string (compositionend's `data`), or its last
 *   compositionupdate string when compositionend never arrived; null when the
 *   IME's string was never seen.
 * - `currentCanonical`: the manuscript now. Nothing this editor does commits
 *   during a composition, so any difference is an external change, and a
 *   page-local edit captured against the old text would splice it at stale
 *   offsets: discarded rather than risk corrupting the manuscript.
 *
 * 全文選択: `data` replaces the WHOLE manuscript -- never the mounted page's
 * DOM value, which keeps whatever part of the page the IME's own selection
 * did not cover. No `data` (or "": canceled) changes nothing: better an
 * unchanged manuscript than a page-local or guessed replacement.
 */
export function decideCompositionOutcome(
  base: CompositionBase,
  currentCanonical: string,
  finalPageText: string,
  data: string | null,
  caretLocal: number
): CompositionOutcome {
  if (currentCanonical !== base.baseCanonical) return { kind: "discard", reason: "external-change" };
  if (base.whole) {
    if (data === null) return { kind: "whole-unchanged", reason: "unknown-text" };
    // A textarea value never holds CR (see insertedTextOf in PagedEditor).
    const text = data.replace(/\r\n?/g, "\n");
    if (text === "") return { kind: "whole-unchanged", reason: "canceled" };
    return { kind: "whole-replace", text };
  }
  // The mounted page must be exactly the page slice the composition began on.
  if (base.beforeText !== base.baseCanonical.slice(base.pageStart, base.pageEnd)) {
    return { kind: "discard", reason: "stale-page" };
  }
  const edit = compositionEdit(base.beforeText, base.selectionStart, base.selectionEnd, finalPageText, base.pageStart);
  if (!edit) return { kind: "page-unchanged" };
  const nextCanonical =
    base.baseCanonical.slice(0, base.pageStart) + finalPageText + base.baseCanonical.slice(base.pageEnd);
  return { kind: "page-commit", nextCanonical, edit, caretLocal };
}
