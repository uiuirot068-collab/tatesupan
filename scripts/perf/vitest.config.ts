// Phase 7 long-manuscript benchmark (NOT part of any test suite; never
// asserts timings). Run with:
//   npx vitest run --config scripts/perf/vitest.config.ts
// Results: printed, and written to scripts/perf/results/<label>.json
// (label from TATESPUN_PERF_LABEL, default "local").
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("../../src/", import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": srcDir },
  },
  test: {
    environment: "node",
    include: ["scripts/perf/*.bench.ts"],
    testTimeout: 600_000,
  },
});
