// TateSpun 文章チェック β 2.0 rule engine's own vitest config, mirroring
// the same pattern already used by `src/lib/v2Bridge/` and every
// typesetting-v2 stage. A NEW, separate config file -- never modifies
// the protected root `vitest.config.ts`.
// Run with:
//   npx vitest run --config src/lib/writingCheckEngine/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/lib/writingCheckEngine/**/*.test.{ts,tsx}"],
  },
});
