// P3-O09 Preview Renderer Foundation's own vitest config — separate from
// the repo root `vitest.config.ts` (scoped to `typesetting-v2/core/**`, on
// this task's own do-not-modify list), mirroring the same pattern already
// used by Stage C (`tools/compare/vitest.config.ts`) and Stage D
// (`tools/preview-dev-adapter/vitest.config.ts`). Run with:
//   npx vitest run --config typesetting-v2/renderer/preview/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["typesetting-v2/renderer/preview/**/*.test.{ts,tsx}"],
  },
});
