import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(path), "utf8");

describe("TSP-PREVIEW-SYNC-STABILITY-011 §B/§C: PREVIEW_TO_EDITOR navigation must not echo back into an unrelated Preview re-scroll", () => {
  const editor = source("src/components/TategakiEditor.tsx");

  it("stores the exact expected post-jump global offset before handing off to the Editor", () => {
    const nav = editor.slice(
      editor.indexOf("const navigateEditorToGlobalOffset ="),
      editor.indexOf("const navigateEditorToGlobalOffset =") + 700
    );
    expect(nav).toContain("suppressPreviewFollowForRef.current = end;");
    expect(nav).toContain("editorPaneRef.current?.navigateToGlobalOffset(start, end);");
  });

  it("the cursorIndex->previewCursorIndex debounce consumes the guard for exactly that one value, then resumes normal follow", () => {
    const debounce = editor.slice(
      editor.indexOf("const [previewCursorIndex, setPreviewCursorIndex]"),
      editor.indexOf("const [isPreviewCollapsed")
    );
    expect(debounce).toMatch(
      /suppressPreviewFollowForRef\.current !== null && suppressPreviewFollowForRef\.current === cursorIndex/
    );
    expect(debounce).toContain("suppressPreviewFollowForRef.current = null;");
    // The suppressed branch must return before reaching the normal follow call.
    const guardIndex = debounce.indexOf("suppressPreviewFollowForRef.current === cursorIndex");
    const returnIndex = debounce.indexOf("return;", guardIndex);
    const followIndex = debounce.indexOf("setPreviewCursorIndex(cursorIndex);", guardIndex);
    expect(returnIndex).toBeGreaterThan(guardIndex);
    expect(followIndex).toBeGreaterThan(returnIndex);
  });

  it("does not depend on live `content` for the callback identity (would defeat PreviewPane's memo on every keystroke)", () => {
    const nav = editor.slice(
      editor.indexOf("const navigateEditorToGlobalOffset ="),
      editor.indexOf("const navigateEditorToGlobalOffset =") + 700
    );
    const depsMatch = nav.match(/\}, \[([^\]]*)\]\);/);
    expect(depsMatch).not.toBeNull();
    expect(depsMatch?.[1] ?? "").not.toMatch(/content/);
  });
});

describe("TSP-PREVIEW-SYNC-STABILITY-011 §D: Preview page selection must never drive Editor cursor-follow", () => {
  const preview = source("src/components/PreviewPane.tsx");

  it("handleToggleSelect/handleToggleCheckbox only ever call setSelected, never onCursorIndexChange/onNavigateToSource/scrollIntoView", () => {
    const toggleSelect = preview.slice(
      preview.indexOf("const handleToggleSelect ="),
      preview.indexOf("const handleToggleCheckbox =")
    );
    const toggleCheckbox = preview.slice(
      preview.indexOf("const handleToggleCheckbox ="),
      preview.indexOf("const moveBy =")
    );
    for (const handler of [toggleSelect, toggleCheckbox]) {
      expect(handler).toContain("setSelected(next)");
      expect(handler).not.toContain("onNavigateToSource");
      expect(handler).not.toContain("scrollIntoView");
      expect(handler).not.toContain("cursorIndex");
    }
  });

  it("the cursor-follow effect keys off activePageIndex (derived from the cursorIndex PROP) only, never off `selected`", () => {
    const effect = preview.slice(
      preview.indexOf('perfMark("PreviewPane:cursorFollowEffect:fired"'),
      preview.indexOf('perfMark("PreviewPane:cursorFollowEffect:fired"') + 30
    );
    expect(effect).toBeTruthy();
    const depsMatch = preview
      .slice(preview.indexOf('perfMark("PreviewPane:cursorFollowEffect:fired"'))
      .match(/\}, \[([^\]]*)\]\);/);
    expect(depsMatch?.[1].trim()).toBe("activePageIndex");
  });
});
