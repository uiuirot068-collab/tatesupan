import { describe, expect, it } from "vitest";
import { compositionEdit, decideCompositionOutcome, decideWholeInputOutcome, type CompositionBase } from "./compositionTransaction";
import { createUndoHistory, pushEdit, redo, undo } from "./undoModel";

const para = (i: number) => `　第${i}段落。春の宵、窓辺に置いた硝子の瓶が淡い光を返していた。\n`;
const MANUSCRIPT = Array.from({ length: 5000 }, (_, i) => para(i + 1)).join(""); // ≈200k
const PAGE_START = 50_000;
const PAGE_END = 100_000;
const PAGE = MANUSCRIPT.slice(PAGE_START, PAGE_END);

function base(overrides: Partial<CompositionBase> = {}): CompositionBase {
  return {
    baseCanonical: MANUSCRIPT,
    pageStart: PAGE_START,
    pageEnd: PAGE_END,
    beforeText: PAGE,
    selectionStart: 0,
    selectionEnd: PAGE.length,
    whole: false,
    ...overrides,
  };
}

function applyEdit(text: string, edit: { rangeStart: number; removedText: string; insertedText: string }) {
  expect(text.slice(edit.rangeStart, edit.rangeStart + edit.removedText.length)).toBe(edit.removedText);
  return text.slice(0, edit.rangeStart) + edit.insertedText + text.slice(edit.rangeStart + edit.removedText.length);
}

describe("decideCompositionOutcome: 全文選択", () => {
  it("replaces the whole manuscript with the IME's committed string, not the page's DOM value", () => {
    // The IME narrowed the native selection: the DOM keeps 20k of old page text.
    const dom = PAGE.slice(0, 20_000) + "電話";
    const outcome = decideCompositionOutcome(base({ whole: true }), MANUSCRIPT, dom, "電話", dom.length);
    expect(outcome).toEqual({ kind: "whole-replace", text: "電話" });
  });

  it("changes nothing when canceled (empty data)", () => {
    const outcome = decideCompositionOutcome(base({ whole: true }), MANUSCRIPT, PAGE.slice(10), "", 0);
    expect(outcome).toEqual({ kind: "whole-unchanged", reason: "canceled" });
  });

  it("changes nothing when the IME's string was never seen (fail-safe, never a page-local guess)", () => {
    const outcome = decideCompositionOutcome(base({ whole: true }), MANUSCRIPT, "で", null, 1);
    expect(outcome).toEqual({ kind: "whole-unchanged", reason: "unknown-text" });
  });

  it("normalizes CRLF like a textarea value", () => {
    const outcome = decideCompositionOutcome(base({ whole: true }), MANUSCRIPT, "", "a\r\nb", 0);
    expect(outcome).toEqual({ kind: "whole-replace", text: "a\nb" });
  });

  it("discards when the manuscript changed externally during the composition", () => {
    const outcome = decideCompositionOutcome(base({ whole: true }), MANUSCRIPT + "x", "電話", "電話", 2);
    expect(outcome).toEqual({ kind: "discard", reason: "external-change" });
  });
});

describe("decideCompositionOutcome: page-local (large in-page selection)", () => {
  it("commits a 30k-selection IME replacement once, exactly, and one undo restores the manuscript", () => {
    const s = 10_000;
    const e = 40_000;
    const dom = PAGE.slice(0, s) + "電話" + PAGE.slice(e);
    const outcome = decideCompositionOutcome(base({ selectionStart: s, selectionEnd: e }), MANUSCRIPT, dom, "電話", s + 2);
    expect(outcome.kind).toBe("page-commit");
    if (outcome.kind !== "page-commit") return;
    const expected = MANUSCRIPT.slice(0, PAGE_START + s) + "電話" + MANUSCRIPT.slice(PAGE_START + e);
    expect(outcome.nextCanonical).toBe(expected);
    expect(outcome.edit).toMatchObject({ rangeStart: PAGE_START + s, insertedText: "電話", atomic: true });
    expect(applyEdit(MANUSCRIPT, outcome.edit)).toBe(expected);

    const history = pushEdit(createUndoHistory(), outcome.edit);
    const undone = undo(history, outcome.nextCanonical);
    expect(undone?.canonicalText).toBe(MANUSCRIPT);
    expect(redo(undone!.history, undone!.canonicalText)?.canonicalText).toBe(expected);
  });

  it("stays exact when the IME narrowed the selection after the composition began", () => {
    // Began over [10k, 40k); the IME only replaced [25k, 40k).
    const dom = PAGE.slice(0, 25_000) + "で" + PAGE.slice(40_000);
    const outcome = decideCompositionOutcome(base({ selectionStart: 10_000, selectionEnd: 40_000 }), MANUSCRIPT, dom, "で", 25_001);
    expect(outcome.kind).toBe("page-commit");
    if (outcome.kind !== "page-commit") return;
    expect(outcome.nextCanonical).toBe(MANUSCRIPT.slice(0, PAGE_START) + dom + MANUSCRIPT.slice(PAGE_END));
    expect(applyEdit(MANUSCRIPT, outcome.edit)).toBe(outcome.nextCanonical);
  });

  it("falls back to an exact diff when text outside the starting selection changed", () => {
    const dom = "X" + PAGE.slice(1, 100) + "電話" + PAGE.slice(200);
    const outcome = decideCompositionOutcome(base({ selectionStart: 100, selectionEnd: 200 }), MANUSCRIPT, dom, "電話", 102);
    expect(outcome.kind).toBe("page-commit");
    if (outcome.kind !== "page-commit") return;
    expect(applyEdit(MANUSCRIPT, outcome.edit)).toBe(outcome.nextCanonical);
  });

  it("is a no-op when the page text did not change", () => {
    expect(decideCompositionOutcome(base({ selectionStart: 5, selectionEnd: 5 }), MANUSCRIPT, PAGE, "", 5)).toEqual({ kind: "page-unchanged" });
  });

  it("discards on an external change or a page that is not the manuscript's slice", () => {
    expect(decideCompositionOutcome(base(), "changed", PAGE + "a", "a", 1)).toEqual({ kind: "discard", reason: "external-change" });
    expect(decideCompositionOutcome(base({ beforeText: "other" }), MANUSCRIPT, "othera", "a", 6)).toEqual({ kind: "discard", reason: "stale-page" });
  });
});

describe("decideWholeInputOutcome: 全文選択's empty IME receptacle", () => {
  const whole = (overrides: Partial<Parameters<typeof decideWholeInputOutcome>[0]> = {}) =>
    decideWholeInputOutcome({
      baseCanonical: MANUSCRIPT,
      currentCanonical: MANUSCRIPT,
      startValue: "",
      receptacleValue: "テスト",
      data: "テスト",
      source: "compositionend",
      ...overrides,
    });

  it("replaces the whole manuscript with the IME's committed string when the receptacle holds exactly it", () => {
    expect(whole()).toEqual({ kind: "whole-replace", text: "テスト", source: "compositionend" });
    expect(whole({ data: "電話", receptacleValue: "電話", source: "compositionupdate" })).toEqual({ kind: "whole-replace", text: "電話", source: "compositionupdate" });
  });

  it("the real-OS failure: a composition that swallowed ~39k characters of old page text is refused, the manuscript unchanged", () => {
    const swallowed = "x" + PAGE.slice(10_968);
    // Even when the IME reports that same string as its data: the receptacle
    // never held page text, so the provenance check is exact.
    expect(whole({ data: swallowed, receptacleValue: "x" })).toMatchObject({ kind: "whole-unchanged", reason: "receptacle-mismatch" });
    expect(whole({ data: "x", receptacleValue: swallowed })).toMatchObject({ kind: "whole-unchanged", reason: "receptacle-mismatch" });
  });

  it("is not a size limit: a long legitimate string (a registered phrase, a prediction) is accepted when it is exactly the receptacle's", () => {
    const phrase = "東京都千代田区千代田一丁目一番一号　株式会社縦書き出版　編集部御中".repeat(40);
    expect(whole({ data: phrase, receptacleValue: phrase })).toMatchObject({ kind: "whole-replace", text: phrase });
  });

  it("fails safe: unknown, canceled, a receptacle that was not empty, or an external change", () => {
    expect(whole({ data: null, source: "none" })).toMatchObject({ kind: "whole-unchanged", reason: "unknown-text" });
    expect(whole({ data: "", receptacleValue: "" })).toMatchObject({ kind: "whole-unchanged", reason: "canceled" });
    expect(whole({ startValue: "前" })).toMatchObject({ kind: "whole-unchanged", reason: "receptacle-not-empty" });
    expect(whole({ currentCanonical: MANUSCRIPT + "x" })).toMatchObject({ kind: "whole-unchanged", reason: "external-change" });
  });

  it("normalizes CRLF like a textarea value", () => {
    expect(whole({ data: "a\r\nb", receptacleValue: "a\nb" })).toMatchObject({ kind: "whole-replace", text: "a\nb" });
  });
});

describe("compositionEdit", () => {
  it("returns null for identical text", () => {
    expect(compositionEdit("abc", 1, 1, "abc", 0)).toBeNull();
  });
  it("is exact for a collapsed caret insertion with repeated characters", () => {
    const edit = compositionEdit("ああ", 1, 1, "あああ", 7);
    expect(edit).toMatchObject({ rangeStart: 8, removedText: "", insertedText: "あ" });
  });
});
