import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["typesetting-v2/renderer/publication/**/*.test.ts"],
  },
});
