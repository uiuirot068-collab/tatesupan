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
      // CST-PORT-014: cloud version compare
      "src/lib/cloudVersionCompare.test.ts",
      "src/lib/cloudLink.test.ts",
      // TSP-SAFE-002: could not read ≠ deleted; the DB checks the overwritten version
      "src/lib/supabase/projects.test.ts",
      // TSP-SAFE-003: the way out when the editor crashes or a work cannot be opened
      "src/lib/editorRescue.test.ts",
      // TSP-DEMO-001: おためしデモ on phones
      "src/lib/tspDemo001.test.ts",
      // PLT-LOOP-003: メモ・プロット panel (reads プロット帳 files)
      "src/lib/plotPanel.test.ts",
      // SPN-XFIX-001: Xから来た50人のテストの直し
      "src/lib/spnXfix001.test.ts", "src/lib/snsCredit.test.ts",
      // CST-PORT-016: 長い原稿の速度計測（?perf=1、開発用）
      "src/lib/longDocumentPerf.test.ts",
      // SPN-UNIFY-001: login and feedback in the SpunTales portal project
      "src/lib/supabase/plans.test.ts",
      "src/lib/betaFeedbackClient.test.ts",
      // TSP-SAFE-001: 保存の作り（端末控え・2つのタブ・失敗のやり直し）
      "src/lib/localSaveQueue.test.ts", "src/lib/localSaveSafety.test.ts", "src/lib/cloudDeviceCopy.test.ts",
    ],
  },
});
