import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(path), "utf8");

describe("TSP-PAGED-EDITOR-QA-FIXES-AND-DEMO-010 §C/§D: Ctrl+A and explicit full-manuscript selection", () => {
  const editor = source("src/components/PagedEditor.tsx");

  it("Ctrl/Cmd+A in the editor selects the whole manuscript through the SAME action as 全文を選択 (product decision 2026-09-29, superseding §C's page-only Ctrl+A)", () => {
    const handler = editor.slice(editor.indexOf("const handleKeyDown ="), editor.indexOf("const handleSelect ="));
    expect(handler).toMatch(/key === "a" && !event\.shiftKey && !event\.altKey\) \{\s*event\.preventDefault\(\);\s*selectEntireManuscript\(\);/);
    // Still inside the not-composing guard, and undo/redo stay intercepted.
    expect(handler.indexOf('key === "a"')).toBeGreaterThan(handler.indexOf("!event.nativeEvent.isComposing"));
    expect(handler).toContain('key === "z"');
    expect(handler).toContain('key === "y"');
  });

  it("exposes 全文を選択 as the explicit (button) way into full-manuscript selection", () => {
    expect(editor).toContain("const selectEntireManuscript = ()");
    expect(editor).toContain("const deselectEntireManuscript = ()");
    expect(editor).toContain("全文を選択");
    expect(editor).toContain("全文選択中");
    expect(editor).toContain('data-editor-select-all=""');
  });

  it("exits full-manuscript selection on Escape and on an editor-page switch", () => {
    expect(editor).toMatch(/event\.key === "Escape" && allSelectedRef\.current/);
    const goToPage = editor.slice(editor.indexOf("const goToPage ="), editor.indexOf("useImperativeHandle("));
    expect(goToPage).toContain("setAllSelected(false)");
  });

  it("keeps Copy/Cut/typed-replacement full-document semantics gated on the SAME allSelectedRef the explicit action sets", () => {
    expect(editor).toContain("if (!allSelectedRef.current) return;"); // handleCopy
    expect(editor).toMatch(/if \(allSelectedRef\.current\) \{[\s\S]{0,120}replaceWholeDocument\(""\)/); // handleCut
    expect(editor).toMatch(/allSelectedRef\.current &&\s*!isComposingRef\.current/); // handleBeforeInputNative
  });
});

describe("TSP-PAGED-EDITOR-QA-FIXES-AND-DEMO-010 §A/§B: page-switch selection timing and IME boundary reconciliation", () => {
  const editor = source("src/components/PagedEditor.tsx");

  it("applies a cross-page selection via a layout effect gated on the actual DOM commit, not a bare requestAnimationFrame race", () => {
    expect(editor).toContain("useLayoutEffect(() => {");
    expect(editor).toContain("pendingSelectionRef");
  });

  it("reconciles the editor page after an IME composition, exactly like it already does after ordinary typing", () => {
    // The composition's ONE commit lives in finishComposition (compositionend or its recovery).
    const compositionEnd = editor.slice(
      editor.indexOf("const finishComposition ="),
      editor.indexOf("const handleChange =")
    );
    expect(compositionEnd).toContain("const nextPages = paginate(nextCanonical, nextState);");
    expect(compositionEnd).toContain("editorPageForGlobalOffset(nextPages, globalCaret, affinity)");
    // Human QA 2: a large replacement that changes the page count (joins the
    // page before) still lands the caret right after the committed text, on
    // its page, scrolled into view -- and re-applied after the IME has finished.
    expect(compositionEnd).toContain("const globalCaret = edit.rangeStart + edit.insertedText.length;");
    expect(compositionEnd).toMatch(/const resliced =\s*targetIndex !== safePageIndex \|\|\s*targetPage\.start !== currentPage\.start \|\|\s*nextCanonical\.slice\(targetPage\.start, targetPage\.end\) !== finalPageText;/);
    expect(compositionEnd).toMatch(/switchToPageForOffset\(globalCaret, nextPages, undefined, \{\s*focus: keepFocus,\s*affinity,\s*scrollHint: "upper",\s*nextContent: nextCanonical,\s*\}\)/);
    expect(compositionEnd).toContain("scheduleImeSettle(globalCaret, affinity, true)");
  });
});
