/**
 * WINDOWED final parity decisions in PagedEditor.tsx
 * (docs/TATESPUN_WINDOWED_DEFAULT_READINESS.md): Ctrl/Cmd+A = 全文選択, and
 * the phone-only collapsible 編集ページ navigator. Source-text contracts (the
 * convention of the other PagedEditor tests; no React Testing Library here);
 * the behaviour is measured in a real browser by
 * tests/e2e/windowedFinalParity.e2e.mjs.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const editor = readFileSync(resolve("src/components/PagedEditor.tsx"), "utf8");
const between = (start: string, end: string) => editor.slice(editor.indexOf(start), editor.indexOf(end, editor.indexOf(start)));

describe("Ctrl/Cmd+A = 全文選択", () => {
  const handler = between("const handleKeyDown =", "const handleSelect =");

  it("reuses selectEntireManuscript (no second whole-selection implementation)", () => {
    expect(handler).toContain("selectEntireManuscript();");
    expect(handler).not.toContain("setAllSelected(true)");
  });

  it("is handled only on the editor textarea's own keydown (inputs keep their native select-all)", () => {
    expect(editor).toContain("onKeyDown={handleKeyDown}");
    expect(editor.match(/onKeyDown=\{handleKeyDown\}/g)).toHaveLength(1);
  });

  it("Escape still leaves 全文選択", () => {
    expect(handler).toMatch(/event\.key === "Escape" && allSelectedRef\.current\) \{\s*deselectEntireManuscript\(\);/);
  });

  it("全文選択 lasts exactly while the mounted page stays fully selected (Ctrl+A's own keyup must not end it)", () => {
    const select = between("const handleSelect =", "const handleBlur =");
    // Ends only when the page is no longer fully selected, and never for an
    // IME key's own selection move or a composition's caret.
    expect(select).toMatch(
      /allSelectedRef\.current &&\s*!wholeInputArmedRef\.current &&\s*!isComposingRef\.current &&\s*\(el\.selectionStart !== 0 \|\| el\.selectionEnd !== el\.value\.length\)\s*\)\s*\{\s*setAllSelected\(false\);/
    );
    expect(editor).not.toContain("justSetAllSelectedRef");
  });

  it("also ends it on the late native selectionchange of a click inside the selection (React's onSelect misses it)", () => {
    const effect = between('document.addEventListener("selectionchange"', "return () => document.removeEventListener");
    expect(effect).toContain("onSelectionChange");
    const handler = between("const onSelectionChange = () => {", 'document.addEventListener("selectionchange"');
    expect(handler).toContain("document.activeElement !== el");
    expect(handler).toContain("el.selectionStart !== 0 || el.selectionEnd !== el.value.length");
  });

  it("the 全文を選択 button names the shortcut", () => {
    expect(editor).toContain("原稿全体を選択します（Ctrl+A）");
  });
});

describe("phone-collapsible 編集ページ navigator", () => {
  const nav = between('data-editor-page-navigator=""', '<div className="relative min-h-0 flex-1">');
  const tools = nav.slice(nav.indexOf("data-editor-page-tools=\"\""));

  it("starts collapsed, session-only (plain state, never persisted)", () => {
    expect(editor).toContain("const [pageToolsExpanded, setPageToolsExpanded] = useState(false);");
    expect(editor).not.toMatch(/localStorage[\s\S]{0,80}pageTools/);
  });

  it("the toggle is phone-only, labelled, and exposes its state", () => {
    const toggle = between('data-editor-page-tools-toggle=""', "</button>");
    expect(toggle).toContain("md:hidden");
    expect(toggle).toContain("aria-expanded={pageToolsExpanded}");
    expect(toggle).toContain("aria-controls={pageToolsId}");
    expect(toggle).toMatch(/aria-label=\{pageToolsExpanded \? "編集ページの操作を閉じる" : "編集ページの操作/);
    expect(toggle).toContain("min-h-7");
  });

  it("folds only ここで区切る / 前のページとつなぐ / progress, and only below md", () => {
    expect(nav).toContain('className={`contents ${pageToolsExpanded ? "" : "max-md:hidden"}`}');
    expect(tools).toContain("data-editor-force-split");
    expect(tools).toContain("data-editor-merge-with-previous");
    expect(tools).toContain("data-editor-page-progress");
  });

  it("keeps ← / page indicator / → / 全文を選択 in the always-visible row", () => {
    const row = nav.slice(0, nav.indexOf("data-editor-page-tools=\"\""));
    expect(row).toContain('aria-label="前の編集ページへ移動"');
    expect(row).toContain("data-editor-page-indicator");
    expect(row).toContain('aria-label="次の編集ページへ移動"');
    expect(row).toContain('data-editor-select-all=""');
  });

  it("signals the amber 区切り待ち state on the collapsed toggle", () => {
    const toggle = between('data-editor-page-tools-toggle=""', "</button>");
    expect(toggle).toContain("!pageToolsExpanded && isWaitingForBoundary");
  });
});
