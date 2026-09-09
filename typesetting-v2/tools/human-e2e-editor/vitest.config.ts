import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["typesetting-v2/tools/human-e2e-editor/**/*.test.ts"],
  },
});
