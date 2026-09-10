import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..", "..");

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path);
  }
  return files;
}

describe("11-B architectural and persistence isolation", () => {
  it("Core, canonical layout, Preview, and Publication never import Editor work-session metrics", () => {
    const files = sourceFiles(join(ROOT, "typesetting-v2"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(readFileSync(file, "utf8")).not.toMatch(/editorSessionActivity|WorkSessionTracker/);
    }
  });

  it("the persistence implementation uses localStorage, never cloud/database or manuscript fields", () => {
    const storeSource = readFileSync(join(__dirname, "store.ts"), "utf8");
    expect(storeSource).toContain("localStorage");
    expect(storeSource).not.toMatch(/supabase|indexedDB|\bfetch\s*\(|manuscript|content|text:/i);
  });

  it("20. the UI distinguishes written count from current manuscript length", () => {
    const counter = readFileSync(join(ROOT, "src", "components", "WorkSessionTracker.tsx"), "utf8");
    const editor = readFileSync(join(ROOT, "src", "components", "EditorPane.tsx"), "utf8");
    expect(counter).toContain("今回書いた文字数");
    expect(counter).toContain("現在の原稿文字数とは別の値です");
    expect(editor).toContain('title="現在の原稿文字数"');
    expect(editor).toContain("countVisualLength(content)");
  });

  it("keeps Ruby/TCY help compact with accessible hover, focus, and touch disclosure", () => {
    const counter = readFileSync(join(ROOT, "src", "components", "WorkSessionTracker.tsx"), "utf8");
    const editor = readFileSync(join(ROOT, "src", "components", "EditorPane.tsx"), "utf8");
    const help = readFileSync(join(ROOT, "src", "components", "EditorSyntaxHelp.tsx"), "utf8");
    expect(editor).toContain("<EditorSyntaxHelp />");
    expect(help).toContain("data-editor-footer-help");
    expect(editor).toContain("data-editor-footer-controls");
    expect(editor).toContain("現在の原稿文字数 {countVisualLength(content)}文字");
    expect(help).toContain("truncate whitespace-nowrap");
    expect(help).toContain("title={EDITOR_SYNTAX_HELP}");
    expect(help).toContain("aria-label={EDITOR_SYNTAX_HELP}");
    expect(help).toContain("data-editor-syntax-help-modal");
    expect(help).toContain("data-editor-syntax-help-full");
    expect(counter).toContain("flex-wrap");
  });

  it("exposes visible Undo/Redo controls through the textarea's native history path", () => {
    const editor = readFileSync(join(ROOT, "src", "components", "EditorPane.tsx"), "utf8");
    expect(editor).toContain('data-editor-history-action="undo"');
    expect(editor).toContain('data-editor-history-action="redo"');
    expect(editor).toMatch(/aria-label="元に戻す"[\s\S]*?>↶<\/span>/);
    expect(editor).toMatch(/aria-label="やり直す"[\s\S]*?>↷<\/span>/);
    expect(editor).toContain("document.execCommand(command)");
  });

  it("renders result and history through one centered viewport modal shell", () => {
    const counter = readFileSync(join(ROOT, "src", "components", "WorkSessionTracker.tsx"), "utf8");
    const modal = readFileSync(join(ROOT, "src", "components", "ViewportModal.tsx"), "utf8");
    expect(modal).toContain('createPortal(');
    expect(modal).toContain('document.body');
    expect(modal).toContain('items-center justify-center');
    expect(modal).toContain('max-h-[calc(100dvh-2rem)]');
    expect(modal).toContain('aria-modal="true"');
    expect(modal).toContain('modalStack.at(-1)');
    expect(counter).toContain('data-work-session-result-modal');
    expect(counter).toContain('data-work-session-history-modal');
    expect(counter).toContain('data-work-session-history-list');
    expect(counter).toContain('data-work-session-result-action="close"');
    expect(counter).toContain('data-work-session-result-action="copy"');
    expect(counter).toContain('data-work-session-result-action="share-x"');
    expect(counter).toContain('data-work-session-history-action="share-x"');
    expect(counter).not.toContain('className="absolute bottom-full');
  });

  it("wires compact Pause/Resume controls, active-time results, and an explicit resume baseline", () => {
    const counter = readFileSync(join(ROOT, "src", "components", "WorkSessionTracker.tsx"), "utf8");
    const editor = readFileSync(join(ROOT, "src", "components", "EditorPane.tsx"), "utf8");
    expect(counter).toContain('data-work-session-action="pause"');
    expect(counter).toContain('data-work-session-action="resume"');
    expect(counter).toContain("一時停止中");
    expect(counter).toContain("実作業時間");
    expect(counter).toContain('className="flex shrink-0 items-center gap-1"');
    expect(editor).toContain("inputActivityStateRef.current = createTextInputActivityState(content)");
    expect(editor).toMatch(/data-editor-status-surfaces=[\s\S]*?focusMode \? "max-md:hidden"/);
  });
});
