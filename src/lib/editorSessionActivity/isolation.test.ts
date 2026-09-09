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

  it("keeps Ruby/TCY help and wrapping work-session controls in separate footer rows", () => {
    const counter = readFileSync(join(ROOT, "src", "components", "WorkSessionTracker.tsx"), "utf8");
    const editor = readFileSync(join(ROOT, "src", "components", "EditorPane.tsx"), "utf8");
    expect(editor).toContain("data-editor-footer-help");
    expect(editor).toContain("whitespace-normal break-words");
    expect(editor).toContain("data-editor-footer-controls");
    expect(editor).toContain("現在の原稿文字数 {countVisualLength(content)}文字");
    expect(counter).toContain("flex-wrap");
  });

  it("exposes visible Undo/Redo controls through the textarea's native history path", () => {
    const editor = readFileSync(join(ROOT, "src", "components", "EditorPane.tsx"), "utf8");
    expect(editor).toContain('data-editor-history-action="undo"');
    expect(editor).toContain('data-editor-history-action="redo"');
    expect(editor).toContain("↶</span> 元に戻す");
    expect(editor).toContain("↷</span> やり直す");
    expect(editor).toContain("document.execCommand(command)");
  });
});
