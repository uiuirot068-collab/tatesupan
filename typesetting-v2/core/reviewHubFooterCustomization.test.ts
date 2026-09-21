import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (rel: string) =>
  fs.readFileSync(path.join(root, rel), "utf8");

const hub = read("src/components/ReviewHub.tsx");
const tools = read("src/lib/reviewHub.ts");
const pane = read("src/components/EditorPane.tsx");
const settings = read("src/components/ReviewHubFooterPinSettings.tsx");
const pinned = read("src/components/ReviewHubFooterPinnedTools.tsx");
const hook = read("src/hooks/useReviewHubFooterPins.ts");

describe("B2 footer customization wiring", () => {
  it("mounts a footer display control on each tool row of the Review Hub panel", () => {
    // Inline on the tool's own title row (not a stacked settings block): keeps the panel inside its cap on a 320x568 phone.
    expect(hub).toContain("<ReviewHubFooterPinControl toolId={tool.id} label={tool.title} />");
    expect(hub).toContain("<ReviewHubFooterPinNote />");
  });

  it("reuses the Editor's canonical visualLength pill, unchanged, for character count", () => {
    expect(pane).toContain("<ReviewHubFooterPinnedTools");
    expect(pane).toContain('title="現在の原稿文字数"');
    expect(pane).toContain("現在の原稿文字数 {visualLength}文字");
    expect(pinned).toContain("characterCount");
    expect(pinned).not.toContain("countVisualLength");
  });

  it("offers only currently implemented tools", () => {
    expect(tools).toContain("文章チェックβ");
    expect(tools).toContain("文字数カウント");
    expect(settings).not.toContain("音読β");
    expect(settings).not.toContain("描写");
    expect(settings).not.toContain("傍点");
    expect(hub).toContain("REVIEW_HUB_TOOLS.map"); // the controls follow the Hub's own tool list, not a second one
    expect(settings).not.toContain("TOOLS");
  });

  it("states that display selection is not feature enablement", () => {
    expect(settings).toContain("フッター表示は機能のON/OFFとは別");
    expect(settings).not.toContain("setWritingCheckEnabled");
  });

  it("stores preference locally and not in cloud/manuscript state", () => {
    expect(hook).toContain("localStorage");
    expect(hook).toContain("tatespun:review-hub-footer-tools-change");
    expect(hook).not.toContain("supabase");
  });

  it("uses the external-store contract for hydration-safe local preference", () => {
    expect(hook).toContain("useSyncExternalStore");
    expect(hook).toContain("getServerSnapshot");
    expect(hook).toContain("getClientSnapshot");
    expect(hook).not.toContain("setPins(readStoredPins())");
  });
});
