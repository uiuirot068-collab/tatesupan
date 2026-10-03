import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // same as tsconfig "paths" ("@/*" -> "./src/*")
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: [
      "typesetting-v2/core/**/*.test.ts",
      "src/lib/pageJump.test.ts",
      // CST-PORT-004: shared with COLUMNSTAND (same core / same file)
      "src/lib/searchReplaceNavigation.test.ts",
      "src/lib/gutterZone.test.ts",
      // CST-PORT-011: cover
      "src/lib/cover/**/*.test.ts",
      // CST-PORT-011B: 本づくり drawer accordion state
      "src/hooks/useBookmakingSections.test.ts",
      // CST-PORT-012: 3D preview
      "src/lib/book3d/**/*.test.ts",
      // TSP-DEMO-001: おためしデモ on phones
      "src/lib/tspDemo001.test.ts",
    ],
  },
});
