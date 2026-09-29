/**
 * FULL / WINDOWED parity fixes in PagedEditor.tsx
 * (docs/TATESPUN_FULL_WINDOWED_PARITY_AUDIT.md). Source-text contracts, the
 * convention of the other PagedEditor tests (no React Testing Library here);
 * the behaviour itself is measured in a real browser on both surfaces by
 * tests/e2e/editorSurfaceParity.e2e.mjs.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const editor = readFileSync(resolve("src/components/PagedEditor.tsx"), "utf8");
const between = (start: string, end: string) => editor.slice(editor.indexOf(start), editor.indexOf(end, editor.indexOf(start)));

describe("全文選択 replacements insert what a native textarea would", () => {
  const helper = between("function insertedTextOf(", "/** Rounds a remaining/length");

  it("a line break (Enter) inserts one LF instead of the null `data` (which emptied the manuscript)", () => {
    expect(helper).toMatch(/inputType === "insertLineBreak" \|\| event\.inputType === "insertParagraph"\) return "\\n"/);
  });

  it("paste/drop text falls back to dataTransfer and is LF-normalized like a native textarea paste", () => {
    expect(helper).toContain('event.data ?? event.dataTransfer?.getData("text/plain") ?? ""');
    expect(helper).toContain('replace(/\\r\\n?/g, "\\n")');
  });

  it("the whole-document beforeinput path uses it", () => {
    const handler = between("const handleBeforeInputNative =", "useEffect(() => {\n    const el = textareaRef.current;");
    expect(handler).toContain('const typed = inputType.startsWith("insert") ? insertedTextOf(nativeEvent) : "";');
    expect(handler).toContain("replaceWholeDocument(typed, { typedCharacter });");
  });
});

// The IME-over-全文選択 contracts moved to pagedEditorWholeReplace.test.ts
// (atomic whole-manuscript replacement: decided by 全文選択 itself, nothing
// committed until compositionend).

describe("caret placement after an edit React has not committed yet", () => {
  const switcher = between("const switchToPageForOffset =", "// Applies a pending cross-page selection");

  it("defers the same-page selection to the layout effect while the DOM still holds the pre-edit page text", () => {
    expect(switcher).toContain("mountedValue !== options.nextContent.slice(targetPage.start, targetPage.end)");
    expect(switcher).toMatch(/if \(staleSamePage\) \{\s*pendingSelectionRef\.current = /);
  });

  it("every same-page editing path passes the post-edit text", () => {
    for (const call of [
      "switchToPageForOffset(typed.length, newPages, undefined, { nextContent: typed, focus: options?.focus })",
      "{ affinity: \"backward\", nextContent: nextCanonical }",
      "{ start: result.selectionStart, end: result.selectionEnd }, { nextContent: result.canonicalText })",
      "switchToPageForOffset(globalCaret, newPages, undefined, { nextContent: nextCanonical })",
    ]) {
      expect(editor).toContain(call);
    }
  });
});

describe("re-anchoring on a document load/switch", () => {
  const reanchor = between("const reanchorForExternalContent =", "useEffect(() => {\n    if (content === lastOwnContentRef.current) return;");

  it("uses the last REPORTED caret, never the textarea's post-commit selection (which opened page 2 of a new manuscript)", () => {
    expect(reanchor).toContain("globalCaretRangeRef.current.start");
    expect(reanchor).not.toContain("textareaRef.current?.selectionStart");
  });

  it("does not pull focus into the editor unless it already had it", () => {
    expect(reanchor).toContain("document.activeElement === textareaRef.current");
    expect(reanchor).toContain("{ focus: hadFocus }");
  });
});

it("the paged textarea styles its placeholder like the FULL textarea", () => {
  expect(editor).toContain("outline-none placeholder:text-ink/40");
});
