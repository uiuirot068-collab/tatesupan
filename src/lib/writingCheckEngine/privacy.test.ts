/**
 * Static, code-level privacy verification (Phase 12) -- not merely an
 * assertion of intent. Reads every real source file in this engine
 * (excluding tests/config) and asserts none of them reference any
 * network/AI primitive. This test itself runs in Node/Vitest only (dev
 * tooling), never shipped to the client -- it verifies the SHIPPED
 * engine files, not itself.
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const ENGINE_DIR = __dirname;

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.endsWith(".test.ts") || entry.name === "vitest.config.ts") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectSourceFiles(full));
    else if (entry.name.endsWith(".ts")) files.push(full);
  }
  return files;
}

const FORBIDDEN_PATTERNS = [/\bfetch\s*\(/, /XMLHttpRequest/, /\baxios\b/, /new\s+WebSocket/, /\bEventSource\b/, /navigator\.sendBeacon/, /\brequire\(["']https?["']\)/, /from\s+["']https?["']/];

describe("Writing Check engine -- privacy (no network/AI code path)", () => {
  const files = collectSourceFiles(ENGINE_DIR);

  it("found real source files to check (sanity check on the test itself)", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s contains no network/AI call primitive", (file) => {
    const source = readFileSync(file, "utf-8");
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(pattern.test(source)).toBe(false);
    }
  });
});

// Phase 3's own dictionary/NG-word/preset persistence and result-panel/
// settings UI live OUTSIDE this directory (`src/hooks/`, `src/components/`)
// -- listed explicitly here (rather than recursively scanned, which would
// pull in every unrelated hook/component in the app) so the SAME privacy
// guarantee covers the localStorage-backed pieces of Phase 3, not just the
// pure rule engine.
const PHASE3_UI_FILES = [
  join(ENGINE_DIR, "..", "..", "hooks", "createJsonLocalStorageHook.ts"),
  join(ENGINE_DIR, "..", "..", "hooks", "useWritingCheckDictionary.ts"),
  join(ENGINE_DIR, "..", "..", "hooks", "useWritingCheckNgWords.ts"),
  join(ENGINE_DIR, "..", "..", "hooks", "useWritingCheckRuleConfig.ts"),
  join(ENGINE_DIR, "..", "..", "components", "WritingCheckBar.tsx"),
  join(ENGINE_DIR, "..", "..", "components", "WritingCheckOverlay.tsx"),
  join(ENGINE_DIR, "..", "..", "components", "WritingCheckSettingsPanel.tsx"),
];

describe("Writing Check Phase 3 UI/persistence -- privacy (no network/AI call, localStorage only)", () => {
  it.each(PHASE3_UI_FILES)("%s contains no network/AI call primitive", (file) => {
    const source = readFileSync(file, "utf-8");
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(pattern.test(source)).toBe(false);
    }
  });
});
