// TateSpun src/constants/ vitest config, mirroring the same pattern already
// used by src/hooks/, src/lib/v2Bridge/, src/lib/writingCheckEngine/,
// src/lib/editorSessionActivity/, and src/lib/ itself. A NEW, separate
// config file -- never modifies the protected root `vitest.config.ts`.
// Run with:
//   npx vitest run --config src/constants/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/constants/*.test.{ts,tsx}"],
  },
});
