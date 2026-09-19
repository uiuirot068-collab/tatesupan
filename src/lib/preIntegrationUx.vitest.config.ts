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
      "src/lib/betaFeedbackClient.test.ts",
      "src/lib/demoPlacement.test.ts",
      "src/lib/exportCancellation.test.ts",
      "src/lib/finalDrawerPolish.test.ts",
      "src/lib/helpTableOfContents.test.ts",
      "src/lib/helpNotationActions.test.ts",
      "src/lib/paperPresets.test.ts",
      "src/lib/postBlockerUx.test.ts",
      "src/lib/updateHistory.test.ts",
      "src/lib/previewPageVirtualization.test.ts",
      "src/lib/turnstile.test.ts",
      "src/lib/rcUiInformationArchitecture.test.ts",
      "src/lib/rcPolishRound3.test.ts",
      "src/lib/rcPolishRound4.test.ts",
      "src/lib/rcPolishRound5.test.ts",
      "src/lib/rcPolishRound6.test.ts",
      "src/lib/reportRestoration.test.ts",
      "src/lib/txtTransfer.test.ts",
      "src/lib/v2Rollout.test.ts",
      "src/lib/v2Bridge/**/*.test.ts",
      "src/lib/writingCheckEngine/**/*.test.ts",
      "src/utils/exportCancellation.integration.test.ts",
    ],
  },
});
