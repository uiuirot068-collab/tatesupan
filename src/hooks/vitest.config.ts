// TateSpun src/hooks/ vitest config, mirroring the same pattern already
// used by `src/lib/v2Bridge/` and `src/lib/writingCheckEngine/`. A NEW,
// separate config file -- never modifies the protected root
// `vitest.config.ts`. No jsdom: the pure store logic under test is
// exercised against a plain stub `window`, not a real DOM.
// Run with:
//   npx vitest run --config src/hooks/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/hooks/**/*.test.{ts,tsx}"],
  },
});
