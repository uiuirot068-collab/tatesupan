import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pane = readFileSync("src/components/EditorPane.tsx", "utf8");
const hub = readFileSync("src/components/ReviewHub.tsx", "utf8");
const toolRegistry = readFileSync("src/lib/reviewHub.ts", "utf8");
const pinSettings = readFileSync("src/components/ReviewHubFooterPinSettings.tsx", "utf8");
const pinStore = readFileSync("src/lib/reviewHubFooterPins.ts", "utf8");
const pinHook = readFileSync("src/hooks/useReviewHubFooterPins.ts", "utf8");

describe("B2 footer customization wiring — final Review UI contract", () => {
  it("mounts a footer display control on each Review Hub tool row", () => {
    expect(hub).toContain("ReviewHubFooterPinSettings");
    expect(pinSettings).toContain("data-review-hub-footer-pin-toggle");
  });

  it("keeps the canonical manuscript character count in the title row, independent of footer pins", () => {
    expect(pane).toContain('data-editor-character-count=""');
    expect(pane).toContain('{visualLength.toLocaleString("ja-JP")}');
    expect(pane).toContain('workSessionPinned={footerPins.includes("character-count")}');
  });

  it("routes writing-check footer display by pin separately from its ON/OFF state", () => {
    expect(pane).toContain('const writingCheckPinned = footerPins.includes("writing-check")');
    expect(pane).toContain("showBar={false}");
    expect(pane).toContain("writingCheckPinned={writingCheckPinned}");
    expect(pane).toContain('data-mobile-writing-check-pill=""');
    expect(pane).toContain("enabled={writingCheckEnabled}");
  });

  it("offers all four currently implemented Review tools", () => {
    for (const id of ["writing-check", "character-count", "read-aloud", "description-check"]) {
      expect(toolRegistry).toContain(id);
      expect(pane).toContain(`"${id}"`);
    }
  });

  it("keeps display selection separate from feature enablement for the newer tools too", () => {
    expect(pane).toContain('footerPins.includes("read-aloud")');
    expect(pane).toContain('footerPins.includes("description-check")');
    expect(pane).toContain("descriptionCheck.enabled");
    expect(pane).toContain("readAloud.state.status");
  });

  it("stores footer display preference locally, not in manuscript/cloud state", () => {
    expect(pinStore).toContain("tatespun.reviewHub.footerTools.v1");
    expect(pinStore).not.toMatch(/supabase|manuscript|documentId|docId/i);
  });

  it("uses an external-store hydration-safe local preference hook", () => {
    expect(pinHook).toContain("useSyncExternalStore");
  });
});
