import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SearchReplaceModal from "./SearchReplaceModal";

// 検索・置換 Human-QA repair. Node vitest has no jsdom, so the dialog is
// rendered statically and the editor wiring is source-checked; the search
// state itself is tested as data in src/lib/searchReplaceNavigation.test.ts
// and real reveal / selection / page switching in
// tests/e2e/searchReplaceNavigation.e2e.mjs (FULL and WINDOWED builds).

const read = (path: string) => readFileSync(resolve(path), "utf8");
const noop = () => {};
const render = (placement: "screen" | "preview") =>
  renderToStaticMarkup(
    createElement(SearchReplaceModal, { content: "瑠璃色の空", placement, onFind: noop, onReplaceOne: noop, onReplace: noop, onClose: noop })
  );
const buttonTag = (html: string, attr: string) => html.match(new RegExp(`<button[^>]*${attr}[^>]*>`))?.[0] ?? "";

describe("検索・置換 dialog", () => {
  it("is named 検索・置換 in the toolbar and the dialog, and says the replacement may stay empty", () => {
    const html = render("preview");
    expect(html).toContain("検索・置換</h2>");
    expect(html).toContain("検索する文字列");
    expect(html).toContain("検索だけなら空欄のまま");
    const pane = read("src/components/EditorPane.tsx");
    expect(pane).toMatch(/data-editor-action="replace"[\s\S]{0,400}>\s*検索・置換\s*</);
  });

  it("offers 選択箇所を置換 and すべて置換, both disabled (with 前へ / 次へ) before any match exists", () => {
    const html = render("preview");
    for (const attr of ['data-search-step="prev"', 'data-search-step="next"', 'data-search-action="replace-one"', 'data-search-action="replace-all"']) {
      expect(buttonTag(html, attr), attr).toContain("disabled");
    }
    expect(html).toContain("選択箇所を置換");
    expect(html).toContain("すべて置換");
    expect(buttonTag(html, 'data-search-action="close"')).not.toContain("disabled");
  });

  it("keeps the desktop Preview-pane panel and the phone screen modal (mobile layout unchanged)", () => {
    const preview = render("preview");
    const screen = render("screen");
    expect(preview).toContain('data-search-replace-placement="preview"');
    expect(preview).toContain("pointer-events-none absolute inset-x-0 top-0");
    expect(screen).toContain('data-search-replace-placement="screen"');
    expect(screen).toContain("fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4");
    const editor = read("src/components/TategakiEditor.tsx");
    expect(editor).toContain('className="md:hidden"');
    expect(editor).toContain('className="hidden md:block"');
    expect(editor.match(/onFind=\{revealSearchMatch\}/g)).toHaveLength(2);
    expect(editor.match(/onReplaceOne=\{replaceSearchMatch\}/g)).toHaveLength(2);
  });
});

describe("CST-PORT-015: 置換したら、その場で確かめられる", () => {
  const pane = read("src/components/EditorPane.tsx");
  const paged = read("src/components/PagedEditor.tsx");
  const modal = read("src/components/SearchReplaceModal.tsx");

  it("置換 never reveals the next match by itself: only 次へ / 前へ call onFind", () => {
    const replace = modal.slice(modal.indexOf("const handleReplaceActive"), modal.indexOf("const handleUndoReceipt"));
    expect(replace).not.toContain("onFind");
    expect(modal).not.toContain("pendingAfterReplaceRef");
    expect(modal.match(/onFind\(/g)).toHaveLength(1);
  });

  it("the new text stays selected where it is (FULL: no scroll; WINDOWED: its own page, no scroll hint)", () => {
    const apply = pane.slice(pane.indexOf("const applySearchEdit"), pane.indexOf("const replaceSearchMatch"));
    expect(apply).toContain("el.setSelectionRange(start, start + text.length)");
    expect(apply).not.toContain("scrollCaretNearUpperView");
    const range = paged.slice(paged.indexOf("const replaceRangeGlobal"), paged.indexOf("const goToPage"));
    expect(range).toMatch(/selectInserted[\s\S]{0,300}\{ start, end: start \+ text\.length \}, \{ nextContent: nextCanonical, affinity: "backward" \}/);
    expect(range).not.toContain('scrollHint: "upper"');
  });

  it("the replaced text is tinted through the same ghost highlight on both surfaces", () => {
    expect(pane).toContain("if (searchMark && searchMark.end > searchMark.start) ranges.push(searchMark);");
    const editor = read("src/components/TategakiEditor.tsx");
    expect(editor.match(/onMarkChange=\{markSearchReplaced\}/g)).toHaveLength(2);
  });

  it("shows 「n 件目を置換しました」 with この置換を戻す, and the surroundings with the hit marked", () => {
    const html = renderToStaticMarkup(
      createElement(SearchReplaceModal, { content: "瑠璃色の空", onFind: noop, onReplaceOne: noop, onReplace: noop, onClose: noop })
    );
    expect(html).not.toContain("この置換を戻す"); // nothing replaced yet
    expect(modal).toContain('data-search-action="undo-one"');
    expect(modal).toContain("この置換を戻す");
    expect(modal).toContain('data-search-receipt-context=""');
    expect(modal).toContain("<mark");
  });
});

describe("検索・置換 editor wiring (one search, two surfaces)", () => {
  const pane = read("src/components/EditorPane.tsx");
  const paged = read("src/components/PagedEditor.tsx");
  const modal = read("src/components/SearchReplaceModal.tsx");

  it("the dialog has no surface-specific search: it only calls onFind / onReplaceOne with canonical offsets", () => {
    expect(modal).not.toMatch(/isWindowed|PagedEditor/);
    expect(modal).toContain('from "@/lib/searchReplaceNavigation"');
  });

  it("FULL: selects THEN scrolls the match into view (focus without scrolling to the old caret)", () => {
    const body = pane.slice(pane.indexOf("const revealSearchMatch"), pane.indexOf("const replaceSearchMatch"));
    const focus = body.indexOf("el.focus({ preventScroll: true })");
    const select = body.indexOf("el.setSelectionRange(s, e)");
    const scroll = body.indexOf("scrollCaretNearUpperView(el, s)");
    expect(focus).toBeGreaterThan(-1);
    expect(select).toBeGreaterThan(focus);
    expect(scroll).toBeGreaterThan(select);
    expect(body).toContain("if (isComposingRef.current) return;");
  });

  it("WINDOWED: reveals through moveSelectionToGlobal (page switch + upper scroll), keeping the match on its own page", () => {
    const body = pane.slice(pane.indexOf("const revealSearchMatch"), pane.indexOf("const replaceSearchMatch"));
    expect(body).toContain("navigateToGlobalOffset(start, end)");
    const move = paged.slice(paged.indexOf("const moveSelectionToGlobal"), paged.indexOf("const replaceRangeGlobal"));
    expect(move).toContain('scrollHint: "upper"');
    expect(move).toContain('affinity: start < end ? "backward" : "forward"');
    expect(move).toContain("pendingJumpRef.current = { kind: \"global\", start, end }"); // IME: deferred to compositionend
    expect(move).toContain("setAllSelected(false)");
  });

  it("選択箇所を置換 and すべて置換 are ONE undoable body edit on both surfaces, never counted as written text", () => {
    const body = pane.slice(pane.indexOf("const applySearchEdit"), pane.indexOf("useImperativeHandle(\n"));
    // WINDOWED: PagedEditor's atomic, undoable range edit.
    expect(body).toContain("pagedEditorRef.current?.replaceRangeGlobal(start, end, text, selectInserted ? { selectInserted: true } : undefined)");
    // FULL: the native editing command, i.e. the same history Ctrl+Z / 元に戻す (execCommand("undo")) use —
    // never a controlled-value assignment, which wipes that history (Human QA: Ctrl+Z did not revert the body).
    expect(body).toContain('document.execCommand("insertText", false, text)');
    expect(body).toContain('document.execCommand("delete")');
    expect(body.indexOf("el.focus({ preventScroll: true })")).toBeLessThan(body.indexOf('document.execCommand("insertText"'));
    expect(body).toContain("const replaceSearchMatch = (start: number, end: number, text: string) => applySearchEdit(start, end, text, true);");
    // すべて置換: WINDOWED = one atomic range edit; FULL = a checkpoint (a native command is O(span × document)).
    const whole = pane.slice(pane.indexOf("const replaceWholeText"), pane.indexOf("const commitFullCheckpointText"));
    expect(whole).toContain("const range = minimalReplacementRange(content, next);");
    expect(whole).toMatch(/if \(isWindowed\) \{\s*applySearchEdit\(range\.start, range\.end, range\.text\);/);
    expect(whole).toContain("history.redo = [];");
    expect(whole).toContain("commitFullCheckpointText(next, range.start)");
    // The checkpoint only applies while the textarea holds exactly its text, and is consulted before native history
    // by the keyboard shortcuts and by 元に戻す / やり直す.
    const apply = pane.slice(pane.indexOf("const applyFullReplaceCheckpoint"), pane.indexOf("const runHistory"));
    expect(apply).toContain("if (!top || el.value !== top.after) return false;");
    expect(apply).toContain("if (!top || el.value !== top.before) return false;");
    const run = pane.slice(pane.indexOf("const runHistory"), pane.indexOf("const runHistory") + 400);
    expect(run.indexOf("applyFullReplaceCheckpoint(command)")).toBeLessThan(run.indexOf("runNativeHistory(command)"));
    expect(pane).toMatch(/if \(applyFullReplaceCheckpoint\(key === "y" \|\| event\.shiftKey \? "redo" : "undo"\)\) event\.preventDefault\(\);/);
    expect(pane).toContain("if (isSearchEdit) {");
    expect(pane).toMatch(/if \(isSearchEdit\) \{[\s\S]{0,200}syncTextInputActivityState\(inputActivityStateRef\.current, next\)/);
    const editor = read("src/components/TategakiEditor.tsx");
    expect(editor).not.toMatch(/onReplace=\{\(next\) => \{\s*setContent\(next\)/);
    // CST-PORT-015: the panel stays open after すべて置換 and says how many were replaced.
    expect(editor.match(/onReplace=\{\(next\) => replaceWholeText\(next\)\}/g)).toHaveLength(2);
  });

  it("/guide and its Help section use the current name 検索・置換 and say search alone works", () => {
    const guide = read("src/app/guide/page.tsx");
    expect(guide).toContain('title: "検索・置換"');
    expect(guide).not.toContain("置換機能");
    const help = read("public/docs/help.md");
    expect(help).toContain("## 検索・置換 <!-- help-id: replace -->");
    expect(help).toContain("検索だけなら「置換後の文字列」は空欄のままで構いません");
    expect(help).not.toContain("1件ずつの確認・スキップはありません");
  });

  it("FULL reuses PagedEditor's own caret-scroll helper (no second scroll mechanism)", () => {
    expect(paged).toContain("export function scrollCaretNearUpperView");
    expect(pane).toContain('import PagedEditor, { scrollCaretNearUpperView, type PagedEditorHandle } from "./PagedEditor"');
  });
});
