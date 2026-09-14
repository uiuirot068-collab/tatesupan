import { describe, expect, it } from "vitest";
import {
  chooseEditorWindowAroundGlobalOffset,
  globalToLocalOffset,
  isNearWindowEdge,
  localToGlobalOffset,
  replaceWindowRangeInCanonicalText,
  snapToSafeBoundary,
} from "./offsetModel";

const PAGE_BREAK_MARKER = "【改ページ】";

describe("global/local offset mapping", () => {
  it("round-trips at the start, middle, and end of the manuscript", () => {
    const windowStart = 300;
    for (const globalOffset of [0, 1, 300, 301, 650, 999, 1000]) {
      const local = globalToLocalOffset(windowStart, globalOffset);
      expect(localToGlobalOffset(windowStart, local)).toBe(globalOffset);
    }
  });

  it("is plain arithmetic, independent of window size", () => {
    expect(globalToLocalOffset(1000, 1050)).toBe(50);
    expect(localToGlobalOffset(1000, 50)).toBe(1050);
    expect(globalToLocalOffset(0, 42)).toBe(42);
  });
});

describe("chooseEditorWindowAroundGlobalOffset", () => {
  const manuscript = (length: number) => "a".repeat(length);

  it("returns the whole manuscript when windowSize already covers it", () => {
    const text = manuscript(500);
    expect(chooseEditorWindowAroundGlobalOffset(text, 250, 500)).toEqual({ start: 0, end: 500 });
    expect(chooseEditorWindowAroundGlobalOffset(text, 250, 10_000)).toEqual({ start: 0, end: 500 });
  });

  it("pins to the manuscript start when the caret is near offset 0", () => {
    const text = manuscript(300_000);
    const win = chooseEditorWindowAroundGlobalOffset(text, 5, 20_000);
    expect(win.start).toBe(0);
    expect(win.end).toBe(20_000);
  });

  it("pins to the manuscript end when the caret is near the final offset", () => {
    const text = manuscript(296_000);
    const win = chooseEditorWindowAroundGlobalOffset(text, 295_995, 20_000);
    expect(win.end).toBe(296_000);
    expect(win.start).toBe(296_000 - 20_000);
  });

  it("centers the window around a caret in the middle of a long manuscript", () => {
    const text = manuscript(296_000);
    const caret = 148_000;
    const win = chooseEditorWindowAroundGlobalOffset(text, caret, 20_000);
    expect(win.end - win.start).toBe(20_000);
    expect(win.start).toBeLessThan(caret);
    expect(win.end).toBeGreaterThan(caret);
    // Roughly centered (allow the same rounding slack the implementation uses).
    expect(caret - win.start).toBeGreaterThanOrEqual(9_000);
    expect(win.end - caret).toBeGreaterThanOrEqual(9_000);
  });

  it("slides (never resizes) the window to keep hysteresis margin around the caret", () => {
    const text = manuscript(296_000);
    const windowSize = 20_000;
    const margin = 5_000;
    // Caret sits centered first...
    const first = chooseEditorWindowAroundGlobalOffset(text, 148_000, windowSize, { margin });
    expect(first.end - first.start).toBe(windowSize);
    // ...then drifts toward the window's trailing edge, inside the margin.
    const drifted = first.end - 2_000;
    const second = chooseEditorWindowAroundGlobalOffset(text, drifted, windowSize, { margin });
    expect(second.end - second.start).toBe(windowSize);
    expect(second.end - drifted).toBeGreaterThanOrEqual(margin);
  });

  it("never lets a window boundary split a UTF-16 surrogate pair", () => {
    // U+1F600 GRINNING FACE is a surrogate pair; place many of them so a
    // naive windowSize/2 offset is very likely to land mid-pair.
    const text = "😀".repeat(50_000); // 100,000 UTF-16 code units
    for (const caret of [1, 2, 3, 99_999, 100_000, 50_001, 50_002]) {
      const win = chooseEditorWindowAroundGlobalOffset(text, caret, 20_001);
      expect(win.start % 2).toBe(0);
      expect(win.end % 2).toBe(0);
      // A safe boundary must also be a valid split point for slice/splice.
      const before = text.slice(0, win.start);
      const windowText = text.slice(win.start, win.end);
      const after = text.slice(win.end);
      expect(before + windowText + after).toBe(text);
      expect(Array.from(windowText).every((ch) => ch === "😀")).toBe(true);
    }
  });
});

describe("snapToSafeBoundary", () => {
  it("leaves an already-safe boundary untouched", () => {
    expect(snapToSafeBoundary("abc", 1, -1)).toBe(1);
    expect(snapToSafeBoundary("abc", 0, 1)).toBe(0);
    expect(snapToSafeBoundary("abc", 3, -1)).toBe(3);
  });

  it("nudges a mid-surrogate-pair boundary in the requested direction", () => {
    const text = "a😀b"; // indices: a=0, high=1, low=2, b=3
    expect(snapToSafeBoundary(text, 2, -1)).toBe(1);
    expect(snapToSafeBoundary(text, 2, 1)).toBe(3);
  });

  it("clamps out-of-range indices before checking safety", () => {
    expect(snapToSafeBoundary("abc", -5, 1)).toBe(0);
    expect(snapToSafeBoundary("abc", 999, -1)).toBe(3);
  });
});

describe("replaceWindowRangeInCanonicalText", () => {
  it("splices a plain insertion back into the canonical manuscript", () => {
    const canonical = "prefix-WINDOW-suffix";
    const windowStart = canonical.indexOf("WINDOW");
    const windowEnd = windowStart + "WINDOW".length;
    const next = replaceWindowRangeInCanonicalText(canonical, windowStart, windowEnd, "WIN-inserted-DOW");
    expect(next).toBe("prefix-WIN-inserted-DOW-suffix");
  });

  it("splices a deletion (shrunk window text) back into the canonical manuscript", () => {
    const canonical = "prefix-WINDOWTEXT-suffix";
    const windowStart = canonical.indexOf("WINDOWTEXT");
    const windowEnd = windowStart + "WINDOWTEXT".length;
    const next = replaceWindowRangeInCanonicalText(canonical, windowStart, windowEnd, "WIN");
    expect(next).toBe("prefix-WIN-suffix");
  });

  it("splices a large paste back into the canonical manuscript", () => {
    const canonical = "AAA" + "x".repeat(100) + "BBB";
    const windowStart = 3;
    const windowEnd = 103;
    const pasted = "y".repeat(5_000);
    const next = replaceWindowRangeInCanonicalText(canonical, windowStart, windowEnd, "x".repeat(50) + pasted + "x".repeat(50));
    expect(next.startsWith("AAA" + "x".repeat(50) + pasted)).toBe(true);
    expect(next.endsWith(pasted + "x".repeat(50) + "BBB")).toBe(true);
    expect(next.length).toBe(canonical.length + pasted.length);
  });

  it("preserves an inserted newline exactly", () => {
    const canonical = "line one line two";
    const caretInWindow = "line one".length;
    const next = replaceWindowRangeInCanonicalText(canonical, caretInWindow, caretInWindow, "\n");
    expect(next).toBe("line one\n line two");
  });

  it("preserves an inserted explicit page-break marker exactly", () => {
    const canonical = "章タイトル本文が続く";
    const insertAt = "章タイトル".length;
    const next = replaceWindowRangeInCanonicalText(canonical, insertAt, insertAt, `\n${PAGE_BREAK_MARKER}\n`);
    expect(next).toBe(`章タイトル\n${PAGE_BREAK_MARKER}\n本文が続く`);
  });

  it("is a no-op replacement when the window text is echoed back unchanged", () => {
    const canonical = "unchanged canonical text";
    const next = replaceWindowRangeInCanonicalText(canonical, 0, canonical.length, canonical);
    expect(next).toBe(canonical);
  });
});

describe("end-to-end window workflow: choose -> edit -> splice -> re-map caret", () => {
  it("typing at the very end of a long manuscript stays inside one window and maps the caret correctly", () => {
    let canonical = "x".repeat(296_000);
    const windowSize = 20_000;
    let caret = canonical.length;

    const win = chooseEditorWindowAroundGlobalOffset(canonical, caret, windowSize);
    let windowText = canonical.slice(win.start, win.end);
    const localCaret = globalToLocalOffset(win.start, caret);
    expect(localCaret).toBe(windowText.length);

    // Type one Japanese character at the local caret.
    windowText = windowText.slice(0, localCaret) + "あ" + windowText.slice(localCaret);
    canonical = replaceWindowRangeInCanonicalText(canonical, win.start, win.end, windowText);
    const newLocalCaret = localCaret + 1;
    caret = localToGlobalOffset(win.start, newLocalCaret);

    expect(canonical.length).toBe(296_001);
    expect(canonical[caret - 1]).toBe("あ");
  });

  it("deleting (backspace) at a mid-manuscript caret updates canonical text and caret together", () => {
    let canonical = "a".repeat(100_000) + "DELETE_ME" + "b".repeat(100_000);
    const windowSize = 20_000;
    let caret = 100_000 + "DELETE_ME".length;

    const win = chooseEditorWindowAroundGlobalOffset(canonical, caret, windowSize);
    let windowText = canonical.slice(win.start, win.end);
    let localCaret = globalToLocalOffset(win.start, caret);

    // Backspace 9 characters ("DELETE_ME").
    windowText = windowText.slice(0, localCaret - 9) + windowText.slice(localCaret);
    localCaret -= 9;
    canonical = replaceWindowRangeInCanonicalText(canonical, win.start, win.end, windowText);
    caret = localToGlobalOffset(win.start, localCaret);

    expect(canonical).toBe("a".repeat(100_000) + "b".repeat(100_000));
    expect(caret).toBe(100_000);
  });
});

describe("isNearWindowEdge", () => {
  it("flags proximity to a non-pinned edge and ignores edges pinned to the manuscript boundary", () => {
    const length = 296_000;
    // Window pinned to manuscript start: the start edge should never count,
    // even if the caret sits at offset 0.
    expect(isNearWindowEdge({ start: 0, end: 20_000 }, 10, length, 5_000)).toBe(false);
    // Its trailing (non-pinned) edge does count when the caret is close.
    expect(isNearWindowEdge({ start: 0, end: 20_000 }, 19_500, length, 5_000)).toBe(true);
    // A window pinned to the manuscript end: the end edge never counts.
    expect(isNearWindowEdge({ start: length - 20_000, end: length }, length - 10, length, 5_000)).toBe(false);
    // Mid-manuscript window, caret comfortably inside: no edge counts.
    expect(isNearWindowEdge({ start: 100_000, end: 120_000 }, 110_000, length, 5_000)).toBe(false);
  });
});
