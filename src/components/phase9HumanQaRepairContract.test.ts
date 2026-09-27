import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const editor = readFileSync(resolve("src/components/TategakiEditor.tsx"), "utf8");
const searchModal = readFileSync(resolve("src/components/SearchReplaceModal.tsx"), "utf8");
const compose = readFileSync(resolve("src/lib/v2Bridge/composeV2Document.ts"), "utf8");
const previewBridge = readFileSync(resolve("src/lib/v2Bridge/buildV2PreviewDocument.ts"), "utf8");
const previewPaint = readFileSync(resolve("typesetting-v2/renderer/preview/paintModel.ts"), "utf8");
const publicationPaint = readFileSync(resolve("typesetting-v2/renderer/publication/paintModel.ts"), "utf8");

describe("Phase 9 Human-QA repair wiring", () => {
  it("keeps desktop find/replace inside the Preview pane while mobile keeps the screen modal", () => {
    expect(editor).toContain('placement="preview"');
    expect(editor).toContain('className="hidden md:block"');
    expect(editor).toContain('placement="screen"');
    expect(editor).toContain('className="md:hidden"');
    expect(searchModal).toContain('placement?: "screen" | "preview"');
    expect(searchModal).toContain('data-search-replace-placement={placement}');
    expect(searchModal).toContain('data-search-match-context=""');
  });

  it("threads the TateSpun top/bottom 2-column paint geometry into both Preview and Publication", () => {
    expect(compose).toContain('settings.columnCount === 2 ? ("vertical" as const)');
    expect(compose).toContain("columnGapTicks: mmToTicks(settings.columnGapMm)");
    expect(compose).toContain("columnFrameTicks: mmToTicks(computePageLayout(settings).columnHeightMm)");
    expect(previewBridge).toContain("columnStackDirection: bridge.columnStackDirection");
    expect(previewBridge).toContain("columnGapTicks: bridge.columnGapTicks");
    expect(previewBridge).toContain("columnFrameTicks: bridge.columnFrameTicks");
    expect(previewPaint).toContain("paintColumnPlacementTicks");
    expect(previewPaint).toContain("paintBodyExtentTicks");
    expect(publicationPaint).toContain("paintColumnPlacementTicks");
    expect(publicationPaint).toContain("paintBodyExtentTicks");
  });

  it("does not leak the body 2-column stack into the isolated horizontal colophon", () => {
    expect(previewPaint).toContain('columnStackDirection: "horizontal"');
    expect(previewPaint).toContain("colophonContext");
    expect(publicationPaint).toContain('columnStackDirection: "horizontal"');
    expect(publicationPaint).toContain("colophonContext");
  });
});
