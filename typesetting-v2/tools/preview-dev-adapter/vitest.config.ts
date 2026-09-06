// Stage D's own vitest config — separate from the repo root
// `vitest.config.ts` (scoped to `typesetting-v2/core/**`, on this Loop's
// own do-not-modify list). Run with:
//   npx vitest run --config typesetting-v2/tools/preview-dev-adapter/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["typesetting-v2/tools/preview-dev-adapter/**/*.test.{ts,tsx}"],
  },
});
