/**
 * TSP-EDITOR-PAGE-WAITING-UX-HOTFIX-012A — structural coverage for
 * PagedEditor.tsx's manual "今すぐ区切る" Editor Page split and the gold
 * actionable waiting state. Mirrors `pagedEditorQaFixes.test.ts`'s own
 * established convention of asserting against the component's source text
 * directly (no React Testing Library in this project).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(path), "utf8");

describe("TSP-EDITOR-PAGE-WAITING-UX-HOTFIX-012A §C/§D: manual Editor Page split", () => {
  const editor = source("src/components/PagedEditor.tsx");

  it("forceSplitActivePage is gated on the waiting state and not mid-composition", () => {
    const fn = editor.slice(editor.indexOf("const forceSplitActivePage ="), editor.indexOf("useImperativeHandle("));
    expect(fn).toContain("if (isComposingRef.current || !isWaitingForBoundary) return;");
  });

  it("chooses the forced split point by reusing chooseSafeEditorPageBoundary with minTrailingSize disabled, not a new algorithm", () => {
    const fn = editor.slice(editor.indexOf("const forceSplitActivePage ="), editor.indexOf("useImperativeHandle("));
    expect(fn).toMatch(/chooseSafeEditorPageBoundary\(content, currentPage\.start, EDITOR_PAGE_TARGET_SIZE, \{\s*minTrailingSize: 0,?\s*\}\)/);
  });

  it("never touches canonical content -- no commitCanonical/onContentChange/pushEdit call, so it is NOT a manuscript undo step", () => {
    const fn = editor.slice(editor.indexOf("const forceSplitActivePage ="), editor.indexOf("useImperativeHandle("));
    expect(fn).not.toContain("commitCanonical(");
    expect(fn).not.toContain("onContentChange(");
    expect(fn).not.toContain("pushEdit(");
  });

  it("reconciles the current page/caret through the same switchToPageForOffset path as every other jump", () => {
    const fn = editor.slice(editor.indexOf("const forceSplitActivePage ="), editor.indexOf("useImperativeHandle("));
    expect(fn).toContain("switchToPageForOffset(globalCaret, newPages)");
    expect(fn).toContain("reportCaret(globalCaret)");
  });

  it("skips forcing a split that would produce an empty trailing page", () => {
    const fn = editor.slice(editor.indexOf("const forceSplitActivePage ="), editor.indexOf("useImperativeHandle("));
    expect(fn).toMatch(/forcedOffset <= currentPage\.start \|\| forcedOffset >= content\.length/);
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

describe("TSP-EDITOR-PAGE-WAITING-UX-HOTFIX-012A §B: gold actionable waiting state", () => {
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

  it("the manual-split button only renders while actually waiting, and explains it does not touch the manuscript/print pages", () => {
    expect(editor).toContain('data-editor-force-split=""');
    expect(editor).toMatch(/\{isWaitingForBoundary && \(\s*<button[\s\S]{0,80}data-editor-force-split/);
    expect(editor).toContain('title="原稿本文や印刷ページには影響しません"');
    expect(editor).toContain("今すぐ区切る");
  });

  it("keeps the waiting badge and button on a wrapping row so mobile widths never overflow horizontally", () => {
    const progressSpan = editor.slice(editor.indexOf('data-editor-page-progress=""') - 20, editor.indexOf("</span>\n      </div>"));
    expect(progressSpan).toContain("flex-wrap");
  });
});
