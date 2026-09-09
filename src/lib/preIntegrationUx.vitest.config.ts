import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const srcDir = fileURLToPath(new URL("../", import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": srcDir },
  },
  test: {
    environment: "node",
    include: [
      "src/lib/demoPlacement.test.ts",
      "src/lib/exportCancellation.test.ts",
      "src/lib/helpTableOfContents.test.ts",
      "src/utils/exportCancellation.integration.test.ts",
    ],
  },
});
