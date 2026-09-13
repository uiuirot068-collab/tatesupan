import { describe, expect, it } from "vitest";
import {
  computeRawEditFromBeforeInput,
  createUndoHistory,
  flushBatch,
  pushEdit,
  redo,
  undo,
  type UndoHistory,
} from "./undoModel";

describe("insert/delete undo/redo round trip", () => {
  it("undoes and redoes a single non-batching (atomic) insertion", () => {
    let canonical = "abcdef";
    let history = createUndoHistory();
    history = pushEdit(history, { rangeStart: 3, removedText: "", insertedText: "XYZ", atomic: true, now: 0 });
    canonical = "abcXYZdef";

    const undone = undo(history, canonical);
    expect(undone).not.toBeNull();
    expect(undone!.canonicalText).toBe("abcdef");
    expect(undone!.selectionStart).toBe(3);
    expect(undone!.selectionEnd).toBe(3);

    const redone = redo(undone!.history, undone!.canonicalText);
    expect(redone).not.toBeNull();
    expect(redone!.canonicalText).toBe("abcXYZdef");
    expect(redone!.selectionStart).toBe(6);
    expect(redone!.selectionEnd).toBe(6);
  });

  it("undoes and redoes a deletion, restoring the removed text and a collapsed caret after undo", () => {
    let history = createUndoHistory();
    history = pushEdit(history, { rangeStart: 2, removedText: "cd", insertedText: "", atomic: true, now: 0 });
    const canonicalAfterDelete = "abef";

    const undone = undo(history, canonicalAfterDelete);
    expect(undone!.canonicalText).toBe("abcdef");
    expect(undone!.selectionStart).toBe(2);
    expect(undone!.selectionEnd).toBe(4);

    const redone = redo(undone!.history, undone!.canonicalText);
    expect(redone!.canonicalText).toBe("abef");
    expect(redone!.selectionStart).toBe(2);
    expect(redone!.selectionEnd).toBe(2);
  });

  it("returns null when there is nothing to undo/redo", () => {
    const history = createUndoHistory();
    expect(undo(history, "abc")).toBeNull();
    expect(redo(history, "abc")).toBeNull();
  });
});

describe("typing batches into one undo step", () => {
  it("merges contiguous single-character insertions within the timeout into one op", () => {
    let history = createUndoHistory();
    let canonical = "";
    for (const [i, ch] of Array.from("hello").entries()) {
      history = pushEdit(history, { rangeStart: canonical.length, removedText: "", insertedText: ch, now: i * 10 });
      canonical += ch;
    }
    expect(history.undoStack).toHaveLength(1);
    expect(history.undoStack[0].insertedText).toBe("hello");

    const undone = undo(history, canonical);
    expect(undone!.canonicalText).toBe("");
  });

  it("starts a new batch after a pause longer than the batch timeout", () => {
    let history = createUndoHistory();
    history = pushEdit(history, { rangeStart: 0, removedText: "", insertedText: "a", now: 0 });
    history = pushEdit(history, { rangeStart: 1, removedText: "", insertedText: "b", now: 5000 });
    expect(history.undoStack).toHaveLength(2);
  });

  it("starts a new batch at a newline instead of merging it in", () => {
    let history = createUndoHistory();
    history = pushEdit(history, { rangeStart: 0, removedText: "", insertedText: "a", now: 0 });
    history = pushEdit(history, { rangeStart: 1, removedText: "", insertedText: "\n", now: 10 });
    expect(history.undoStack).toHaveLength(2);
  });

  it("never merges a non-contiguous insertion into the current batch", () => {
    let history = createUndoHistory();
    history = pushEdit(history, { rangeStart: 0, removedText: "", insertedText: "a", now: 0 });
    history = pushEdit(history, { rangeStart: 5, removedText: "", insertedText: "b", now: 10 });
    expect(history.undoStack).toHaveLength(2);
  });

  it("caps a single batch at the configured character limit", () => {
    let history = createUndoHistory();
    let pos = 0;
    for (let i = 0; i < 250; i++) {
      history = pushEdit(history, { rangeStart: pos, removedText: "", insertedText: "x", now: i });
      pos += 1;
    }
    // 200-char cap: at least one boundary must have been forced.
    expect(history.undoStack.length).toBeGreaterThan(1);
    const totalChars = history.undoStack.reduce((sum, op) => sum + op.insertedText.length, 0);
    expect(totalChars).toBe(250);
  });
});

describe("backspace/delete batching", () => {
  it("merges repeated Backspace (contiguous backward deletion) into one op", () => {
    // Deleting "cde" from "abcdef" via Backspace, one char at a time from the end.
    let history = createUndoHistory();
    history = pushEdit(history, { rangeStart: 4, removedText: "e", insertedText: "", now: 0 });
    history = pushEdit(history, { rangeStart: 3, removedText: "d", insertedText: "", now: 10 });
    history = pushEdit(history, { rangeStart: 2, removedText: "c", insertedText: "", now: 20 });
    expect(history.undoStack).toHaveLength(1);
    expect(history.undoStack[0]).toMatchObject({ rangeStart: 2, removedText: "cde" });
  });

  it("merges repeated Delete-key (contiguous forward deletion) into one op", () => {
    let history = createUndoHistory();
    history = pushEdit(history, { rangeStart: 2, removedText: "c", insertedText: "", now: 0 });
    history = pushEdit(history, { rangeStart: 2, removedText: "d", insertedText: "", now: 10 });
    history = pushEdit(history, { rangeStart: 2, removedText: "e", insertedText: "", now: 20 });
    expect(history.undoStack).toHaveLength(1);
    expect(history.undoStack[0]).toMatchObject({ rangeStart: 2, removedText: "cde" });
  });
});

describe("paste and other atomic edits never merge with neighboring typing", () => {
  it("keeps a pasted insertion as its own undo step even between two batched keystrokes", () => {
    let history = createUndoHistory();
    history = pushEdit(history, { rangeStart: 0, removedText: "", insertedText: "a", now: 0 });
    history = pushEdit(history, { rangeStart: 1, removedText: "", insertedText: "PASTED CHUNK", atomic: true, now: 10 });
    history = pushEdit(history, { rangeStart: 13, removedText: "", insertedText: "b", now: 20 });
    expect(history.undoStack).toHaveLength(3);
    expect(history.undoStack[1].insertedText).toBe("PASTED CHUNK");
  });
});

describe("undo/redo across a window shift", () => {
  it("is correct with only the current canonical text -- the caller never needs the window that was active when the edit happened", () => {
    // Simulates: window was somewhere in the middle of a long manuscript when
    // the user typed; the window later shifts elsewhere; undo/redo must still
    // work using ONLY the up-to-date canonical text, with no notion of "window".
    const prefix = "P".repeat(50_000);
    const suffix = "S".repeat(50_000);
    const canonical = prefix + "typed" + suffix;
    let history = createUndoHistory();
    history = pushEdit(history, { rangeStart: prefix.length, removedText: "", insertedText: "typed", atomic: true, now: 0 });

    // The window shifts far away; canonical text itself is untouched by a shift.
    const undone = undo(history, canonical);
    expect(undone!.canonicalText).toBe(prefix + suffix);
    expect(undone!.selectionStart).toBe(prefix.length);

    const redone = redo(undone!.history, undone!.canonicalText);
    expect(redone!.canonicalText).toBe(canonical);
  });

  it("clears the redo branch once a new edit is made after an undo", () => {
    let canonical = "ab";
    let history = createUndoHistory();
    history = pushEdit(history, { rangeStart: 2, removedText: "", insertedText: "c", atomic: true, now: 0 });
    canonical = "abc";

    const undone = undo(history, canonical);
    history = undone!.history;
    canonical = undone!.canonicalText;
    expect(history.redoStack).toHaveLength(1);

    history = pushEdit(history, { rangeStart: 2, removedText: "", insertedText: "z", atomic: true, now: 100 });
    expect(history.redoStack).toHaveLength(0);
    expect(redo(history, canonical)).toBeNull();
  });
});

describe("flushBatch", () => {
  it("seals the in-progress batch so a later contiguous keystroke starts a new step", () => {
    let history = createUndoHistory();
    history = pushEdit(history, { rangeStart: 0, removedText: "", insertedText: "a", now: 0 });
    history = flushBatch(history);
    history = pushEdit(history, { rangeStart: 1, removedText: "", insertedText: "b", now: 10 });
    expect(history.undoStack).toHaveLength(2);
  });

  it("is a no-op on an empty or already-sealed history", () => {
    const empty = createUndoHistory();
    expect(flushBatch(empty)).toBe(empty);

    let history = createUndoHistory();
    history = pushEdit(history, { rangeStart: 0, removedText: "", insertedText: "a", atomic: true, now: 0 });
    const sealedOnce = flushBatch(history);
    expect(flushBatch(sealedOnce)).toEqual(sealedOnce);
  });
});

describe("bounded history (no unbounded memory growth)", () => {
  it("drops the oldest entries once the history exceeds its cap", () => {
    let history: UndoHistory = createUndoHistory();
    // Force 600 distinct (non-adjacent, non-mergeable) ops.
    for (let i = 0; i < 600; i++) {
      history = pushEdit(history, { rangeStart: i * 100, removedText: "", insertedText: "x", atomic: true, now: i });
    }
    expect(history.undoStack.length).toBeLessThanOrEqual(500);
  });
});

describe("computeRawEditFromBeforeInput", () => {
  it("derives a plain forward insertion in canonical offsets", () => {
    const edit = computeRawEditFromBeforeInput(
      { beforeText: "abc", selectionStart: 3, selectionEnd: 3, inputType: "insertText" },
      "abcX",
      1_000
    );
    expect(edit).toEqual({ rangeStart: 1_003, removedText: "", insertedText: "X", atomic: false });
  });

  it("derives an insertion that replaces a selection as atomic", () => {
    const edit = computeRawEditFromBeforeInput(
      { beforeText: "abcdef", selectionStart: 2, selectionEnd: 4, inputType: "insertText" },
      "abZef",
      0
    );
    expect(edit).toEqual({ rangeStart: 2, removedText: "cd", insertedText: "Z", atomic: true });
  });

  it("derives a Backspace deletion (backward) at the correct offset", () => {
    const edit = computeRawEditFromBeforeInput(
      { beforeText: "abc", selectionStart: 3, selectionEnd: 3, inputType: "deleteContentBackward" },
      "ab",
      500
    );
    expect(edit).toEqual({ rangeStart: 502, removedText: "c", insertedText: "", atomic: false });
  });

  it("derives a Delete-key deletion (forward) at the correct offset", () => {
    const edit = computeRawEditFromBeforeInput(
      { beforeText: "abc", selectionStart: 1, selectionEnd: 1, inputType: "deleteContentForward" },
      "ac",
      500
    );
    expect(edit).toEqual({ rangeStart: 501, removedText: "b", insertedText: "", atomic: false });
  });

  it("marks a pasted insertion atomic", () => {
    const edit = computeRawEditFromBeforeInput(
      { beforeText: "ab", selectionStart: 1, selectionEnd: 1, inputType: "insertFromPaste" },
      "aXXXb",
      0
    );
    expect(edit).toEqual({ rangeStart: 1, removedText: "", insertedText: "XXX", atomic: true });
  });

  it("marks an IME composition commit atomic", () => {
    const edit = computeRawEditFromBeforeInput(
      { beforeText: "あい", selectionStart: 2, selectionEnd: 2, inputType: "insertFromComposition" },
      "あいうえ",
      2_000
    );
    expect(edit).toEqual({ rangeStart: 2_002, removedText: "", insertedText: "うえ", atomic: true });
  });

  it("never records native history commands", () => {
    expect(
      computeRawEditFromBeforeInput({ beforeText: "a", selectionStart: 0, selectionEnd: 0, inputType: "historyUndo" }, "", 0)
    ).toBeNull();
    expect(
      computeRawEditFromBeforeInput({ beforeText: "", selectionStart: 0, selectionEnd: 0, inputType: "historyRedo" }, "a", 0)
    ).toBeNull();
  });

  it("returns null for a no-op (identical before/after)", () => {
    expect(
      computeRawEditFromBeforeInput({ beforeText: "abc", selectionStart: 1, selectionEnd: 1, inputType: "insertText" }, "abc", 0)
    ).toBeNull();
  });

  it("falls back to a prefix/suffix diff for an unrecognized inputType", () => {
    const edit = computeRawEditFromBeforeInput(
      { beforeText: "abcdef", selectionStart: 0, selectionEnd: 0, inputType: "" },
      "abXYef",
      100
    );
    expect(edit).toEqual({ rangeStart: 102, removedText: "cd", insertedText: "XY", atomic: true });
  });
});
