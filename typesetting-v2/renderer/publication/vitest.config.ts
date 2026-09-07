// P3-O08 Publication Renderer Foundation's own vitest config, mirroring
// the same pattern already used by Stage C, Stage D, and P3-O09 Preview.
// Run with:
//   npx vitest run --config typesetting-v2/renderer/publication/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["typesetting-v2/renderer/publication/**/*.test.{ts,tsx}"],
  },
});
