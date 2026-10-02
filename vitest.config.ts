import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "typesetting-v2/core/**/*.test.ts",
      "src/lib/pageJump.test.ts",
      // CST-PORT-004: shared with COLUMNSTAND (same core / same file)
      "src/lib/searchReplaceNavigation.test.ts",
      "src/lib/gutterZone.test.ts",
    ],
  },
});
