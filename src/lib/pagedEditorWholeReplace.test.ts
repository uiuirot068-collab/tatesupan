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

describe("an IME composition over 全文選択", () => {
  const start = between("const handleCompositionStart =", "const handleCompositionEnd =");
  const end = between("const handleCompositionEnd =", "const moveSelectionToGlobal =");
  const change = between("const handleChange =", "const replaceWholeDocument =");

  it("is recognised from 全文選択 itself, not the DOM selection the IME may already have moved", () => {
    expect(start).toContain("compositionWholeSelectionRef.current = allSelectedRef.current ? { canonical: content } : null;");
    expect(start).not.toContain("el.selectionStart === 0 && el.selectionEnd === el.value.length ? { canonical");
  });

  it("an IME keydown over 全文選択 keeps it through the IME's own selection move before compositionstart", () => {
    const keyDown = between("const handleKeyDown =", "const handleSelect =");
    expect(keyDown).toMatch(/wholeInputArmedRef\.current =\s*allSelectedRef\.current &&\s*!isComposingRef\.current &&\s*\(event\.key === "Process" \|\| event\.nativeEvent\.keyCode === 229\)/);
    const listener = between("const onSelectionChange = () => {", 'document.addEventListener("selectionchange"');
    expect(listener).toContain("wholeInputArmedRef.current");
    const select = between("const handleSelect =", "const handleKeyUp =");
    expect(select).toContain("!wholeInputArmedRef.current &&");
  });

  it("the arming ends at keyup, pointerdown, blur and compositionstart", () => {
    expect(between("const handleKeyUp =", "const disarmWholeInput =")).toContain("wholeInputArmedRef.current = false;");
    expect(editor).toContain("onPointerDown={disarmWholeInput}");
    expect(between("const handleBlur =", "const handleCompositionStart =")).toContain("wholeInputArmedRef.current = false;");
    expect(start).toContain("wholeInputArmedRef.current = false;");
  });

  it("commits nothing while composing: the textarea mirrors the IME, the manuscript stays whole", () => {
    expect(change).toMatch(/if \(isComposingRef\.current && compositionWholeSelectionRef\.current\) \{\s*setWholeCompositionText\(nextPageText\);\s*onNativeChangeCommitted\?\.\(el\);\s*return;\s*\}/);
    expect(editor).toContain("value={displayedPageText}");
    expect(editor).toContain("const displayedPageText = wholeCompositionText ?? pageText;");
  });

  it("compositionend replaces the whole manuscript ONCE with the committed string, never the page's DOM value", () => {
    expect(end).toContain("setWholeCompositionText(null);");
    expect(end).toContain('let typed = event.data ?? "";');
    expect(end).toContain("replaceWholeDocument(typed);");
    expect(end).not.toContain("insertedText: finalPageText");
  });

  it("a canceled composition leaves the manuscript and 全文選択 as they were", () => {
    expect(end).toMatch(/\} else \{[\s\S]*?setAllSelected\(true\);\s*pendingSelectionRef\.current = \{ start: 0, end: pageText\.length \};/);
  });

  it("its own commit is not mistaken for an external content change (which reset the undo history)", () => {
    const readAt = end.indexOf("const externalChangePending =");
    expect(readAt).toBeGreaterThan(-1);
    expect(readAt).toBeLessThan(end.indexOf("if (wholeSelection) {"));
    expect(end).toContain("} else if (externalChangePending) {");
  });
});

describe("typed / deleted / pasted input over 全文選択", () => {
  const handler = between("const handleBeforeInputNative =", "useEffect(() => {\n    const el = textareaRef.current;");

  it("leaves IME input types to the composition path", () => {
    expect(handler).toContain('const compositionInput = inputType.includes("Composition");');
    expect(handler).toMatch(/allSelectedRef\.current &&\s*!isComposingRef\.current &&\s*!compositionInput &&/);
  });

  it("an uncancelable beforeinput commits its own text at input, never the page's DOM value", () => {
    expect(handler).toMatch(/if \(nativeEvent\.cancelable\) \{\s*nativeEvent\.preventDefault\(\);\s*replaceWholeDocument\(typed, \{ typedCharacter \}\);\s*\} else \{[\s\S]*?pendingWholeInsertRef\.current = typed;/);
    const change = between("const handleChange =", "const replaceWholeDocument =");
    expect(change).toMatch(/const pendingWhole = pendingWholeInsertRef\.current;\s*if \(pendingWhole !== null && !isComposingRef\.current\) \{[\s\S]*?replaceWholeDocument\(pendingWhole\);/);
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
