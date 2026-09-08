// TateSpun Live Editor -> v2 Publication Bridge's own vitest config,
// mirroring the same pattern already used by every typesetting-v2 stage
// (Stage C, Stage D, P3-O08 Publication, P3-O09 Preview). A NEW, separate
// config file -- never modifies the protected root `vitest.config.ts`.
// Run with:
//   npx vitest run --config src/lib/v2Bridge/vitest.config.ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// `pageLayout.ts` (a real src/ file this adapter imports) uses the same
// `@/*` -> `./src/*` alias `tsconfig.json` declares -- Vitest/Vite needs
// its own explicit alias entry (tsc's `paths` doesn't apply here).
const srcDir = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": srcDir },
  },
  test: {
    environment: "node",
    include: ["src/lib/v2Bridge/**/*.test.{ts,tsx}"],
  },
});
