import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

describe("development Editor frozen UI/export contracts", () => {
  it("keeps Editor mounted while settings, Memo, and checklist use one right-side panel", () => {
    expect(source).toContain('type SidePanel = "settings" | "memo" | "checklist" | null');
    expect(source).toContain('className="workspace"');
    expect(source).toContain('sidePanel === "settings"');
    expect(source).toContain('sidePanel === "memo"');
    expect(source).toContain('sidePanel === "checklist"');
    expect(source).toContain('position:fixed;z-index:21;right:0');
  });

  it("uses only the four Human-approved toolbar symbols for their approved actions", () => {
    expect(source).toContain("↶</span> 元に戻す");
    expect(source).toContain("↷</span> やり直す");
    expect(source).toContain("⏎</span> 改ページ");
    expect(source).toContain("⚙️</span> 設定");
    for (const rejected of ["💾", "🖼", "👁", "📝", "✏️"]) {
      expect(source).not.toContain(rejected);
    }
  });

  it("routes JPG through the browser executor using the current canonical PaintPlan", () => {
    expect(source).toContain("exportPaintPlanToBrowserJpgPages(bridge.plan");
    expect(source).toContain('exportJpg("WEB", "first")');
    expect(source).toContain('exportJpg("WEB", "zip")');
    expect(source).toContain('exportJpg("PRINT", "zip")');
    expect(source).toContain("buildPageJpgFileName");
    expect(source).toContain("buildZipFileName");
  });

  it("keeps default manuscript input horizontal and discloses Production isolation", () => {
    expect(source).toContain("原稿（横書き入力）");
    expect(source).toContain("Production未接続");
    expect(source).not.toContain("writing-mode:vertical-rl}.editor textarea");
  });
});
