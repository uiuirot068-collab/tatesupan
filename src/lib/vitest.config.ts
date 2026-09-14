// TateSpun src/lib/ (top-level files only) vitest config, mirroring the
// same pattern already used by src/hooks/, src/lib/v2Bridge/,
// src/lib/writingCheckEngine/, src/lib/editorSessionActivity/. A NEW,
// separate config file -- never modifies the protected root
// `vitest.config.ts`. Non-recursive (`src/lib/*.test.ts`, not `**`) so it
// never double-covers those subdirectories' own scoped configs.
// Run with:
//   npx vitest run --config src/lib/vitest.config.ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("../", import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": srcDir },
  },
  test: {
    environment: "node",
    include: ["src/lib/*.test.{ts,tsx}"],
  },
});
