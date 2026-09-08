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
