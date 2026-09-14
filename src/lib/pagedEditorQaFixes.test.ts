import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(path), "utf8");

describe("TSP-PAGED-EDITOR-QA-FIXES-AND-DEMO-010 §C/§D: Ctrl+A and explicit full-manuscript selection", () => {
  const editor = source("src/components/PagedEditor.tsx");

  it("no longer intercepts Ctrl/Cmd+A to select the whole manuscript", () => {
    // The keydown handler must not branch on the "a" key at all anymore --
    // only undo (z) and redo (y / shift+z) remain intercepted.
    const handler = editor.slice(editor.indexOf("const handleKeyDown ="), editor.indexOf("const handleSelect ="));
    expect(handler).not.toMatch(/key === "a"/);
    expect(handler).toContain('key === "z"');
    expect(handler).toContain('key === "y"');
  });

  it("exposes an explicit 全文を選択 action as the only way into full-manuscript selection", () => {
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
    expect(editor).toMatch(/allSelectedRef\.current && !isComposingRef\.current/); // handleBeforeInputNative
  });
});

describe("TSP-PAGED-EDITOR-QA-FIXES-AND-DEMO-010 §A/§B: page-switch selection timing and IME boundary reconciliation", () => {
  const editor = source("src/components/PagedEditor.tsx");

  it("applies a cross-page selection via a layout effect gated on the actual DOM commit, not a bare requestAnimationFrame race", () => {
    expect(editor).toContain("useLayoutEffect(() => {");
    expect(editor).toContain("pendingSelectionRef");
  });

  it("reconciles the editor page after an IME composition, exactly like it already does after ordinary typing", () => {
    const compositionEnd = editor.slice(
      editor.indexOf("const handleCompositionEnd ="),
      editor.indexOf("const moveSelectionToGlobal =")
    );
    expect(compositionEnd).toContain("computeEditorPages(nextCanonical, nextState)");
    expect(compositionEnd).toContain("editorPageForGlobalOffset(nextPages, globalCaret)");
    expect(compositionEnd).toContain("switchToPageForOffset(globalCaret, nextPages)");
  });
});
