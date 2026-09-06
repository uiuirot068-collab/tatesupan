// Stage C's own vitest config — separate from the repo root `vitest.config.ts`
// (that file's `test.include` is scoped to `typesetting-v2/core/**` and is
// on this Loop's own do-not-modify list). Run with:
//   npx vitest run --config typesetting-v2/tools/compare/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["typesetting-v2/tools/compare/**/*.test.ts"],
  },
});
