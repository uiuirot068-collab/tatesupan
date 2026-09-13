/**
 * TSP-EDITOR-PAGE-WAITING-UX-HOTFIX-012A — structural coverage for
 * PagedEditor.tsx's manual Editor Page split and the gold waiting state.
 * 012B supersedes the waiting-only CTA with an always-present neutral
 * "ここで区切る" action. Mirrors `pagedEditorQaFixes.test.ts`'s own
 * established convention of asserting against the component's source text
 * directly (no React Testing Library in this project).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(path), "utf8");

describe("TSP-EDITOR-MANUAL-SPLIT-AND-BACKSPACE-HOTFIX-012B: manual Editor Page split", () => {
  const editor = source("src/components/PagedEditor.tsx");

  it("uses the textarea's exact collapsed global caret and is not gated on the waiting state", () => {
    const fn = editor.slice(editor.indexOf("const forceSplitAtCaret ="), editor.indexOf("useImperativeHandle("));
    expect(fn).toContain("const selectionStart = editorPageLocalToGlobal(currentPage, el.selectionStart)");
    expect(fn).toContain("const selectionEnd = editorPageLocalToGlobal(currentPage, el.selectionEnd)");
    expect(fn).toContain("if (selectionStart !== selectionEnd) return;");
    expect(fn).toContain("const forcedOffset = selectionStart");
    expect(fn).not.toContain("isWaitingForBoundary");
  });

  it("rejects page/document endpoints, duplicates, selections, and surrogate-pair interiors", () => {
    const fn = editor.slice(editor.indexOf("const forceSplitAtCaret ="), editor.indexOf("useImperativeHandle("));
    expect(fn).toContain("forcedOffset <= currentPage.start");
    expect(fn).toContain("forcedOffset >= currentPage.end");
    expect(fn).toContain("forcedOffset <= 0");
    expect(fn).toContain("forcedOffset >= content.length");
    expect(fn).toContain("forcedBoundaries.includes(forcedOffset)");
    expect(fn).toContain("isHighSurrogate(content.charCodeAt(forcedOffset - 1))");
    expect(fn).toContain("isLowSurrogate(content.charCodeAt(forcedOffset))");
  });

  it("never touches canonical content -- no commitCanonical/onContentChange/pushEdit call, so it is NOT a manuscript undo step", () => {
    const fn = editor.slice(editor.indexOf("const forceSplitAtCaret ="), editor.indexOf("useImperativeHandle("));
    expect(fn).not.toContain("commitCanonical(");
    expect(fn).not.toContain("onContentChange(");
    expect(fn).not.toContain("pushEdit(");
  });

  it("reconciles the current page/caret through the same switchToPageForOffset path as every other jump", () => {
    const fn = editor.slice(editor.indexOf("const forceSplitAtCaret ="), editor.indexOf("useImperativeHandle("));
    expect(fn).toContain("switchToPageForOffset(forcedOffset, newPages)");
    expect(fn).toContain("reportCaret(forcedOffset)");
  });

  it("renders one always-present neutral action in the navigator, separate from the waiting row", () => {
    const navigator = editor.slice(editor.indexOf('data-editor-page-navigator=""'), editor.indexOf('data-demo-target="editor"'));
    expect(navigator.match(/data-editor-force-split=""/g)).toHaveLength(1);
    expect(navigator).toContain("disabled={!canForceSplitAtCaret}");
    expect(navigator).toContain("ここで区切る");
    expect(navigator).toContain("border-ink/20");
    expect(navigator).not.toMatch(/data-editor-force-split=""[\s\S]{0,400}(amber|accent|red)/);
    expect(navigator).not.toContain("今すぐ区切る");
    expect(navigator).not.toMatch(/\{isWaitingForBoundary && \(\s*<button/);
  });
});

describe("TSP-EDITOR-PAGE-WAITING-UX-HOTFIX-012A §E: forced boundaries stay meaningful across edits", () => {
  const editor = source("src/components/PagedEditor.tsx");

  it("computeEditorPages is called with the current forcedBoundaries state, not recomputed from scratch each time", () => {
    expect(editor).toMatch(/computeEditorPages\(content, \{ forcedBoundaries \}\)/);
  });

  it("commitCanonical adjusts forcedBoundaries via adjustForcedBoundaries, gated on non-empty so the common case (no manual split yet) stays a single length check", () => {
    const fn = editor.slice(editor.indexOf("const commitCanonical ="), editor.indexOf("const handleChange ="));
    expect(fn).toContain("if (forcedBoundaries.length > 0");
    expect(fn).toContain("adjustForcedBoundaries(forcedBoundaries, editStart, editEnd, insertedLength)");
    expect(fn).toContain("setForcedBoundaries(adjusted)");
  });

  it("forced boundaries are session-only React state, never written to a persistence layer", () => {
    expect(editor).toContain("useState<number[]>([])");
    expect(editor).not.toMatch(/forcedBoundaries[\s\S]{0,80}(supabase|localStorage|indexedDB)/i);
  });
});

describe("TSP-EDITOR-PAGE-WAITING-UX-HOTFIX-012A §B: gold waiting status", () => {
  const editor = source("src/components/PagedEditor.tsx");

  it("shows a truthful countdown to the real enforced ceiling (EDITOR_PAGE_HARD_MAXIMUM_SIZE), not a bare unhelpful label", () => {
    expect(editor).toContain("区切り待ち・最大あと約");
    expect(editor).toContain("EDITOR_PAGE_HARD_MAXIMUM_SIZE - currentPage.length");
  });

  it("never shows a negative remaining-to-hard-max count", () => {
    const label = editor.slice(editor.indexOf("const progressLabel ="), editor.indexOf("const progressTitle ="));
    expect(label).toContain("Math.max(0, EDITOR_PAGE_HARD_MAXIMUM_SIZE - currentPage.length)");
  });

  it("uses the amber (gold, non-error) badge convention already established elsewhere in the app", () => {
    expect(editor).toMatch(/isWaitingForBoundary[\s\S]{0,120}bg-amber-100[\s\S]{0,60}text-amber-800/);
  });

  it("the manual-split button is always rendered and explains it does not touch the manuscript/print pages", () => {
    expect(editor).toContain('data-editor-force-split=""');
    expect(editor).toContain('title="現在のカーソル位置で編集ページを区切ります。原稿や印刷ページには影響しません。"');
    expect(editor).toContain("ここで区切る");
  });

  it("keeps the waiting badge and button on a wrapping row so mobile widths never overflow horizontally", () => {
    const progressSpan = editor.slice(editor.indexOf('data-editor-page-progress=""') - 20, editor.indexOf("</span>\n      </div>"));
    expect(progressSpan).toContain("flex-wrap");
  });
});
