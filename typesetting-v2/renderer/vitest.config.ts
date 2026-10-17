// Tests that sit directly in typesetting-v2/renderer/ (not in preview/ or
// publication/, which have their own configs). Non-recursive on purpose.
// TSP-IMPROVE-002 (P0-3): furnitureGeometry.test.ts was in no config.
// Run with:
//   npx vitest run --config typesetting-v2/renderer/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["typesetting-v2/renderer/*.test.{ts,tsx}"],
  },
});
