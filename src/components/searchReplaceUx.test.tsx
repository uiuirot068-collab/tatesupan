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

  it("選択箇所を置換 is one undoable edit on WINDOWED and never counted as written text on FULL", () => {
    const body = pane.slice(pane.indexOf("const replaceSearchMatch"), pane.indexOf("useImperativeHandle(\n"));
    expect(body).toContain("pagedEditorRef.current?.replaceRangeGlobal(start, end, text)");
    expect(body).toContain("syncTextInputActivityState(inputActivityStateRef.current, next)");
  });

  it("FULL reuses PagedEditor's own caret-scroll helper (no second scroll mechanism)", () => {
    expect(paged).toContain("export function scrollCaretNearUpperView");
    expect(pane).toContain('import PagedEditor, { scrollCaretNearUpperView, type PagedEditorHandle } from "./PagedEditor"');
  });
});
