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
  it("Core, canonical layout, Preview, and Publication never import Editor session metrics", () => {
    const files = sourceFiles(join(ROOT, "typesetting-v2"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(readFileSync(file, "utf8")).not.toMatch(/editorSessionActivity|SessionActivityCounter/);
    }
  });

  it("the persistence implementation names sessionStorage, never localStorage/cloud/database", () => {
    const storeSource = readFileSync(join(__dirname, "store.ts"), "utf8");
    expect(storeSource).toContain("sessionStorage");
    expect(storeSource).not.toMatch(/localStorage|supabase|indexedDB|\bfetch\s*\(/i);
  });

  it("the compact UI visibly distinguishes session activity from current manuscript length", () => {
    const counter = readFileSync(join(ROOT, "src", "components", "SessionActivityCounter.tsx"), "utf8");
    const editor = readFileSync(join(ROOT, "src", "components", "EditorPane.tsx"), "utf8");
    expect(counter).toContain("このセッションの編集量");
    expect(counter).toContain("原稿の現在文字数とは別の値です");
    expect(editor).toContain('title="現在の原稿文字数"');
  });
});
