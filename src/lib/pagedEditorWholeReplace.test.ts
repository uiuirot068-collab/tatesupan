/**
 * WINDOWED 全文選択 (Ctrl/Cmd+A or 全文を選択) followed by any edit replaces the
 * WHOLE manuscript as ONE transaction. Real-OS Human QA found an IME commit
 * over 全文選択 on a 300k manuscript leaving tens of thousands of old
 * characters, freezing, and an undo that no longer restored the manuscript:
 * the composition was not recognised as a whole-selection one (the IME had
 * moved the native selection before compositionstart), so it ran as a
 * page-local composition whose every update re-paginated the shortened
 * manuscript and re-sliced the textarea under the IME.
 *
 * Source-text contracts (the convention of the other PagedEditor tests; no
 * React Testing Library here) plus the undo model's own behaviour for the
 * atomic step; measured in a real browser by
 * tests/e2e/windowedWholeReplace.e2e.mjs.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createUndoHistory, pushEdit, redo, undo } from "@/lib/windowedEditor/undoModel";

const editor = readFileSync(resolve("src/components/PagedEditor.tsx"), "utf8");
const between = (start: string, end: string) => editor.slice(editor.indexOf(start), editor.indexOf(end, editor.indexOf(start)));

describe("an IME composition (one transaction; see compositionTransaction.test.ts for its outcomes)", () => {
  const begin = between("const beginComposition =", "const finishComposition =");
  const finish = between("const finishComposition =", "const handleChange =");
  const change = between("const handleChange =", "const deleteAcrossBoundaryBackward =");

  it("is recognised as 全文選択 from 全文選択 itself, not the DOM selection the IME may already have moved", () => {
    expect(begin).toContain("whole: allSelectedRef.current,");
    expect(begin).toContain("baseCanonical: content,");
    expect(begin).not.toContain("el.selectionStart === 0 && el.selectionEnd === el.value.length");
  });

  it("an IME keydown over 全文選択 keeps it through the IME's own selection move before compositionstart", () => {
    const keyDown = between("const handleKeyDown =", "const handleSelect =");
    expect(keyDown).toMatch(/wholeInputArmedRef\.current =\s*allSelectedRef\.current &&\s*!isComposingRef\.current &&\s*\(event\.key === "Process" \|\| event\.nativeEvent\.keyCode === 229\);/);
    const listener = between("const onSelectionChange = () => {", 'document.addEventListener("selectionchange"');
    expect(listener).toContain("wholeInputArmedRef.current || isComposingRef.current");
    const select = between("const handleSelect =", "const handleKeyUp =");
    expect(select).toContain("!wholeInputArmedRef.current &&");
    expect(select).toContain("!isComposingRef.current &&");
  });

  it("the arming ends at pointerdown, blur and the composition -- NOT at keyup (a real-OS keyup can precede compositionstart)", () => {
    expect(between("const handleKeyUp =", "const disarmWholeInput =")).not.toContain("wholeInputArmedRef.current = false;");
    expect(editor).toContain("onPointerDown={disarmWholeInput}");
    expect(between("const handleBlur =", "const handleCompositionStart =")).toContain("wholeInputArmedRef.current = false;");
    expect(begin).toContain("wholeInputArmedRef.current = false;");
  });

  it("commits nothing while composing, page-local or 全文選択: the textarea mirrors the IME", () => {
    expect(change).toMatch(/if \(compositionTxnRef\.current\) \{\s*pendingBeforeInputRef\.current = null;\s*setCompositionText\(nextPageText\);\s*onNativeChangeCommitted\?\.\(el\);\s*return;\s*\}/);
    expect(editor).toContain("value={displayedPageText}");
    expect(editor).toContain("const displayedPageText = compositionText ?? pageText;");
  });

  it("finishes ONCE with the IME's string (compositionend data, else its last compositionupdate), never the page's DOM value", () => {
    expect(finish).toContain("decideCompositionOutcome(txn, content, finalPageText, data ?? txn.lastData, el.selectionStart)");
    expect(finish).toContain("replaceWholeDocument(outcome.text, { focus: keepFocus });");
    expect(between("const handleCompositionEnd =", "const moveSelectionToGlobal =")).toContain('finishComposition(el, event.data ?? "", "compositionend");');
    expect(between("const handleCompositionUpdate =", "const handleCompositionEnd =")).toContain("compositionTxnRef.current.lastData = event.data ?? null;");
  });

  it("a canceled or unknown composition leaves the manuscript and 全文選択 as they were", () => {
    expect(finish).toMatch(/outcome\.kind === "whole-unchanged"\) \{[\s\S]*?restoreMountedPage\(\);\s*setAllSelected\(true\);/);
  });

  it("recovers when compositionend never arrives: a non-composing keydown, blur, or a new composition finishes it", () => {
    expect(between("const handleKeyDown =", "const handleSelect =")).toMatch(/if \(compositionTxnRef\.current && !event\.nativeEvent\.isComposing\) \{\s*finishComposition\(el, null, "keydown"\);/);
    expect(between("const handleBlur =", "const handleCompositionStart =")).toContain('finishComposition(event.currentTarget, null, "blur")');
    expect(begin).toContain("if (compositionTxnRef.current) finishComposition(el, null, `restart:${source}`);");
    // A late compositionend after a recovery commits nothing.
    expect(between("const handleCompositionEnd =", "const moveSelectionToGlobal =")).toMatch(/if \(!compositionTxnRef\.current\) \{[\s\S]*?return;\s*\}/);
  });

  it("its own commit is not mistaken for an external content change (which reset the undo history)", () => {
    const readAt = finish.indexOf("const externalChangePending =");
    expect(readAt).toBeGreaterThan(-1);
    expect(readAt).toBeLessThan(finish.indexOf('if (outcome.kind === "whole-replace") {'));
    expect(finish).toContain("} else if (externalChangePending) {");
  });
});

describe("typed / deleted / pasted input over 全文選択", () => {
  const handler = between("const handleBeforeInputNative =", "useEffect(() => {\n    const el = textareaRef.current;");

  it("leaves IME input types to the composition path", () => {
    expect(handler).toMatch(/if \(inputType\.includes\("Composition"\) \|\| nativeEvent\.isComposing\) \{\s*if \(!compositionTxnRef\.current\) beginComposition\(el, "beforeinput"\);[\s\S]*?return;\s*\}/);
    expect(handler).toMatch(/allSelectedRef\.current &&\s*!isComposingRef\.current &&\s*\(inputType\.startsWith\("insert"\)/);
  });

  it("an uncancelable beforeinput commits its own text at input, never the page's DOM value", () => {
    expect(handler).toMatch(/if \(nativeEvent\.cancelable\) \{\s*nativeEvent\.preventDefault\(\);\s*replaceWholeDocument\(typed, \{ typedCharacter \}\);\s*\} else \{[\s\S]*?pendingWholeInsertRef\.current = typed;/);
    const change = between("const handleChange =", "const deleteAcrossBoundaryBackward =");
    expect(change).toMatch(/const pendingWhole = pendingWholeInsertRef\.current;\s*if \(pendingWhole !== null\) \{[\s\S]*?replaceWholeDocument\(pendingWhole\);/);
  });
});

describe("the whole-manuscript undo step", () => {
  it("only a single typed character (not Enter, paste, IME or deletion) stays extendable by typing", () => {
    const handler = between("const handleBeforeInputNative =", "useEffect(() => {\n    const el = textareaRef.current;");
    expect(handler).toContain('const typedCharacter = inputType === "insertText" && typed.length === 1 && typed !== "\\n";');
    const replace = between("const replaceWholeDocument =", "const deleteAcrossBoundaryBackward =");
    expect(replace).toContain("atomic: !extendableByTyping,");
  });

  it("typing that continues a typed-character whole replacement is the same undo step (Ctrl+A → abc)", () => {
    let history = pushEdit(createUndoHistory(), { rangeStart: 0, removedText: original, insertedText: "a", extendableByTyping: true, now: 1000 });
    history = pushEdit(history, { rangeStart: 1, removedText: "", insertedText: "b", now: 1100 });
    history = pushEdit(history, { rangeStart: 2, removedText: "", insertedText: "c", now: 1200 });
    expect(history.undoStack).toHaveLength(1);
    const undone = undo(history, "abc")!;
    expect(undone.canonicalText).toBe(original);
    expect(redo(undone.history, original)?.canonicalText).toBe("abc");
  });

  it("a pause, a line break or a deletion still starts a new step after it", () => {
    const base = pushEdit(createUndoHistory(), { rangeStart: 0, removedText: original, insertedText: "a", extendableByTyping: true, now: 1000 });
    expect(pushEdit(base, { rangeStart: 1, removedText: "", insertedText: "b", now: 5000 }).undoStack).toHaveLength(2);
    expect(pushEdit(base, { rangeStart: 1, removedText: "", insertedText: "\n", now: 1100 }).undoStack).toHaveLength(2);
    expect(pushEdit(base, { rangeStart: 0, removedText: "a", insertedText: "", now: 1100 }).undoStack).toHaveLength(2);
  });

  it("is never merged into the op before it", () => {
    let history = pushEdit(createUndoHistory(), { rangeStart: 0, removedText: "", insertedText: "x", now: 1000 });
    history = pushEdit(history, { rangeStart: 0, removedText: "x", insertedText: "a", extendableByTyping: true, now: 1100 });
    expect(history.undoStack).toHaveLength(2);
  });

  const original = "あ".repeat(300_000);

  it("one undo restores the exact manuscript and one redo re-applies the replacement", () => {
    let history = pushEdit(createUndoHistory(), { rangeStart: 0, removedText: original, insertedText: "d", atomic: true });
    const undone = undo(history, "d");
    expect(undone?.canonicalText).toBe(original);
    history = undone!.history;
    const redone = redo(history, original);
    expect(redone?.canonicalText).toBe("d");
  });

  it("is never merged with the typing that follows it", () => {
    let history = pushEdit(createUndoHistory(), { rangeStart: 0, removedText: original, insertedText: "d", atomic: true });
    history = pushEdit(history, { rangeStart: 1, removedText: "", insertedText: "e" });
    expect(history.undoStack).toHaveLength(2);
    const first = undo(history, "de")!;
    expect(first.canonicalText).toBe("d");
    expect(undo(first.history, "d")?.canonicalText).toBe(original);
  });
});
