/**
 * Output isolation proof (Phase 18, 文章チェックβ v2). Writing Check
 * diagnostics are an editor-screen-only concern (the wavy underline /
 * result panel) -- they must NEVER reach Preview, PDF, JPG, or TXT
 * output. Rather than trust that by inspection alone, this statically
 * scans the REAL canonical Core/Publication/Preview/export source tree
 * (`typesetting-v2/`) and asserts nothing there references this engine
 * at all -- the strongest possible isolation proof: the export pipeline
 * doesn't merely ignore diagnostics, it has no way to see them.
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const WORKTREE_ROOT = join(__dirname, "..", "..", "..");
const TYPESETTING_V2_DIR = join(WORKTREE_ROOT, "typesetting-v2");

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectSourceFiles(full));
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) files.push(full);
  }
  return files;
}

describe("Writing Check engine -- output isolation (Core/Publication/Preview/export never reference it)", () => {
  const files = collectSourceFiles(TYPESETTING_V2_DIR);

  it("found real source files to check (sanity check on the test itself)", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s does not import or reference writingCheckEngine", (file) => {
    const source = readFileSync(file, "utf-8");
    expect(/writingCheck/i.test(source)).toBe(false);
  });
});
