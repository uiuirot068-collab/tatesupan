// TateSpun src/utils/ (top-level files only) vitest config, mirroring the
// same pattern already used by src/lib/, src/hooks/, src/lib/v2Bridge/, etc.
// A NEW, separate config file -- never modifies the protected root
// `vitest.config.ts`. Non-recursive (`src/utils/*.test.ts`, not `**`).
// Run with:
//   npx vitest run --config src/utils/vitest.config.ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("../", import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": srcDir },
  },
  test: {
    environment: "node",
    include: ["src/utils/*.test.{ts,tsx}"],
  },
});
