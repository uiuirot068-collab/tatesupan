/**
 * TSP-EDITOR-PAGE-BOUNDARY-AND-PREVIEW-LANDING-012 — structural coverage for
 * PagedEditor.tsx's §E/§F (Backspace/Delete across an editor-page boundary),
 * §B (deterministic caret-scroll on a cross-page jump), and §H/§I
 * (remaining-character progress indicator). Mirrors
 * `pagedEditorQaFixes.test.ts`'s own established convention
 * of asserting against the component's source text directly -- there is no
 * React Testing Library in this project (see that file's own precedent), and
 * DOM-selection/scroll effects have no automated coverage for the same
 * reason `switchToPageForOffset`'s own module comment already notes.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(path), "utf8");

describe("TSP-EDITOR-PAGE-BOUNDARY-AND-PREVIEW-LANDING-012 §E/§F: Backspace/Delete across an editor-page boundary", () => {
  const editor = source("src/components/PagedEditor.tsx");

  it("intercepts Backspace at local offset 0 of a non-first page, before it would otherwise reach the pendingBeforeInputRef fallback", () => {
    const handler = editor.slice(
      editor.indexOf("const handleBeforeInputNative ="),
      editor.indexOf("useEffect(() => {\n    const el = textareaRef.current;")
    );
    expect(handler).toMatch(/inputType === "deleteContentBackward"[\s\S]{0,120}currentPage\.index > 0/);
    expect(handler).toContain("deleteAcrossBoundaryBackward()");
    const backwardIndex = handler.indexOf('inputType === "deleteContentBackward"');
    const fallbackIndex = handler.indexOf("pendingBeforeInputRef.current = {");
    expect(backwardIndex).toBeGreaterThan(-1);
    expect(fallbackIndex).toBeGreaterThan(backwardIndex);
  });

  it("intercepts Delete at the end of a page that isn't the manuscript's own end", () => {
    const handler = editor.slice(
      editor.indexOf("const handleBeforeInputNative ="),
      editor.indexOf("useEffect(() => {\n    const el = textareaRef.current;")
    );
    expect(handler).toMatch(/inputType === "deleteContentForward"[\s\S]{0,150}currentPage\.end < content\.length/);
    expect(handler).toContain("deleteAcrossBoundaryForward()");
  });

  it("both cross-boundary deletions are surrogate-pair safe and reconcile pages/caret afterward", () => {
    const backward = editor.slice(
      editor.indexOf("const deleteAcrossBoundaryBackward ="),
      editor.indexOf("const deleteAcrossBoundaryForward =")
    );
    expect(backward).toContain("isLowSurrogate(prevCode)");
    expect(backward).toContain("isHighSurrogate(content.charCodeAt(globalCaret - 2))");
    expect(backward).toContain('switchToPageForOffset(deleteFrom, newPages, undefined, { affinity: "backward" })');
    expect(backward).toContain("reportCaret(deleteFrom)");

    const forward = editor.slice(
      editor.indexOf("const deleteAcrossBoundaryForward ="),
      editor.indexOf("/**\n   * `onBeforeInput`'s React prop")
    );
    expect(forward).toContain("isHighSurrogate(nextCode)");
    expect(forward).toContain("isLowSurrogate(content.charCodeAt(globalCaret + 1))");
    expect(forward).toContain("switchToPageForOffset(globalCaret, newPages)");
    expect(forward).toContain("reportCaret(globalCaret)");
  });

  it("does not mark the cross-boundary deletion atomic, so continuous Backspace across the boundary still merges into one undo batch", () => {
    const backward = editor.slice(
      editor.indexOf("const deleteAcrossBoundaryBackward ="),
      editor.indexOf("const deleteAcrossBoundaryForward =")
    );
    expect(backward).toMatch(/pushEdit\(undoHistoryRef\.current, \{ rangeStart: deleteFrom, removedText, insertedText: "" \}\)/);
  });

  it("preserves backward intent for both the first cross-boundary Backspace and repeated native Backspaces", () => {
    expect(editor).toContain('const navigationAffinity = pending?.inputType === "deleteContentBackward" ? "backward" : "forward"');
    expect(editor).toContain("editorPageForGlobalOffset(nextPages, globalCaret, navigationAffinity)");
    expect(editor).toContain("{ affinity: navigationAffinity }");
  });
});

describe("TSP-EDITOR-PAGE-BOUNDARY-AND-PREVIEW-LANDING-012 §B: deterministic caret-scroll on Preview/Writing-Check jumps", () => {
  const editor = source("src/components/PagedEditor.tsx");

  it("moveSelectionToGlobal and the deferred cross-page-jump-after-composition path both request the upper-view scroll hint", () => {
    const moveSelection = editor.slice(
      editor.indexOf("const moveSelectionToGlobal ="),
      editor.indexOf("const replaceRangeGlobal =")
    );
    expect(moveSelection).toContain('{ scrollHint: "upper" }');

    const compositionEnd = editor.slice(
      editor.indexOf("const handleCompositionEnd ="),
      editor.indexOf("const moveSelectionToGlobal =")
    );
    expect(compositionEnd).toMatch(
      /switchToPageForOffset\(\s*pendingJump\.end,\s*computeEditorPages\(contentRef\.current, \{ forcedBoundaries, joinedRanges \}\),\s*pendingJump,\s*\{ scrollHint: "upper" \}\s*\)/
    );
  });

  it("switchToPageForOffset applies the scroll hint on both the same-page and cross-page paths", () => {
    const fn = editor.slice(
      editor.indexOf("const switchToPageForOffset ="),
      editor.indexOf("// Applies a pending cross-page selection")
    );
    expect(fn).toContain('options?.scrollHint === "upper"');
    expect(fn).toContain("scrollCaretNearUpperView(el, localStart)");
    expect(fn).toContain("scrollHint: options?.scrollHint");

    const layoutEffect = editor.slice(
      editor.indexOf("useLayoutEffect(() => {\n    const pending = pendingSelectionRef.current;"),
      editor.indexOf("/** Re-anchors the current page")
    );
    expect(layoutEffect).toContain('pending.scrollHint === "upper"');
    expect(layoutEffect).toContain("scrollCaretNearUpperView(el, pending.start)");
  });

  it("measures the scroll target using a detached clone textarea, never mutating the live element's own value", () => {
    const measure = editor.slice(
      editor.indexOf("function measureCaretOffsetTop"),
      editor.indexOf("function scrollCaretNearUpperView")
    );
    expect(measure).toContain('document.createElement("textarea")');
    expect(measure).toContain("document.body.appendChild(mirror)");
    expect(measure).toContain("document.body.removeChild(mirror)");
    expect(measure).not.toMatch(/\bel\.value\s*=/);
  });
});

describe("TSP-EDITOR-PAGE-BOUNDARY-AND-PREVIEW-LANDING-012 §H/§I: remaining-character progress indicator", () => {
  const editor = source("src/components/PagedEditor.tsx");

  it("shows an estimated remaining count only for the active LAST/growing page, under target", () => {
    expect(editor).toContain("次の編集ページまで あと約");
    expect(editor).toContain("EDITOR_PAGE_TARGET_SIZE - currentPage.length");
  });

  it("shows a compact waiting-for-boundary state once the last page reaches target size", () => {
    // TSP-EDITOR-PAGE-WAITING-UX-HOTFIX-012A §B superseded the bare
    // "区切り待ち" label with a truthful countdown -- see
    // pagedEditorWaitingUxHotfix.test.ts for the full coverage of that.
    expect(editor).toContain("区切り待ち");
  });

  it("shows a non-misleading informational length (not a remaining count) for a finalized, non-last page", () => {
    expect(editor).toContain("この編集ページ：約");
  });

  it("never shows a negative remaining count (the branch only runs while length is under target)", () => {
    const label = editor.slice(editor.indexOf("const progressLabel ="), editor.indexOf("const progressTitle ="));
    expect(label).toContain("currentPage.length < EDITOR_PAGE_TARGET_SIZE");
  });

  it("is guidance-only and never substitutes for computeEditorPages as the pagination source of truth", () => {
    const docBlock = editor.slice(editor.indexOf("// TSP-EDITOR-PAGE-BOUNDARY-AND-PREVIEW-LANDING-012 §H:"), editor.indexOf("const isLastPage ="));
    expect(docBlock).toMatch(/NEVER the source of\s*\n\s*\/\/ truth for pagination|NEVER the source of truth for pagination/);
  });

  it("keeps the waiting status on its own row while allowing ordinary progress to share a compact mobile row", () => {
    expect(editor).toMatch(/data-editor-page-progress=""/);
    expect(editor).toContain('isWaitingForBoundary ? "basis-full" : "sm:basis-full"');
  });
});
