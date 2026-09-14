// PageCard's own vitest config, mirroring the same pattern already used by
// src/lib/v2Bridge and other scoped suites -- a NEW, separate config file,
// never modifies the protected root `vitest.config.ts`.
// Run with:
//   npx vitest run --config src/components/vitest.config.ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const srcDir = fileURLToPath(new URL("../", import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": srcDir },
  },
  test: {
    environment: "node",
    include: ["src/components/**/*.test.{ts,tsx}"],
  },
});
