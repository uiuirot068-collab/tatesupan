import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { computeDemoCardPlacement, type DemoRect } from "./demoPlacement";

const viewport = { width: 390, height: 844 };
const card = { width: 366, height: 220 };

function rect(top: number, bottom: number): DemoRect {
  return { top, bottom, left: 24, right: 366, width: 342, height: bottom - top };
}

describe("responsive demo card placement", () => {
  it("places a narrow-viewport card above a bottom target", () => {
    const placement = computeDemoCardPlacement(rect(760, 800), card, viewport);
    expect(placement.side).toBe("above");
    expect(placement.top + card.height).toBeLessThanOrEqual(748);
  });

  it("places the card below a top target when it fits", () => {
    const placement = computeDemoCardPlacement(rect(40, 80), card, viewport);
    expect(placement.side).toBe("below");
    expect(placement.top).toBeGreaterThanOrEqual(92);
  });

  it("bottom-aligns the export guide while leaving its upper target visible", () => {
    const placement = computeDemoCardPlacement(rect(120, 160), card, viewport, "lower-safe");
    expect(placement.side).toBe("below");
    expect(placement.top).toBe(612);
    expect(placement.top).toBeGreaterThanOrEqual(172);
  });

  it("falls back to the target-safe side when a lower export guide cannot fit", () => {
    const placement = computeDemoCardPlacement(rect(720, 760), card, viewport, "lower-safe");
    expect(placement.side).toBe("above");
    expect(placement.top + card.height).toBeLessThanOrEqual(708);
  });

  it("keeps an oversized card on the roomier target side with fixed controls inside the viewport", () => {
    const oversized = computeDemoCardPlacement(rect(390, 450), { width: 366, height: 900 }, viewport);
    expect(oversized.side).toBe("below");
    expect(oversized.top).toBe(462);
    expect(oversized.maxHeight).toBe(370);
    expect(oversized.left).toBeGreaterThanOrEqual(12);
  });

  it("TSP-PAGED-EDITOR-PREVIEW-SYNC-STABILITY-011 §G: places STEP 8's card below the thin 編集ページ nav row instead of overlapping it, at every required mobile width", () => {
    // The nav row sits just under the title, near the very top of the
    // editor pane -- unlike the old full-textarea target (which left no
    // room on either side), this thin strip always has room below it.
    const navRow: DemoRect = { top: 96, bottom: 132, left: 12, right: 320, width: 308, height: 36 };
    for (const width of [320, 375, 390, 430]) {
      const viewportAtWidth = { width, height: 844 };
      // Mirrors DemoTour's real CSS (`w-[calc(100vw-1.5rem)] max-w-md`) --
      // at these mobile widths the viewport-relative width always wins.
      const cardAtWidth = { width: width - 24, height: card.height };
      const placement = computeDemoCardPlacement(navRow, cardAtWidth, viewportAtWidth);
      expect(placement.side).toBe("below");
      expect(placement.top).toBeGreaterThanOrEqual(navRow.bottom);
      // Card stays fully inside the viewport horizontally.
      expect(placement.left).toBeGreaterThanOrEqual(0);
      expect(placement.left + cardAtWidth.width).toBeLessThanOrEqual(width);
    }
  });

  it("targets the 編集ページ nav row via a raw selector, not the whole editor surface", () => {
    const data = readFileSync(join(__dirname, "..", "constants", "demoData.ts"), "utf8");
    const tour = readFileSync(join(__dirname, "..", "components", "DemoTour.tsx"), "utf8");

    expect(data).toMatch(/title: "長い原稿は「編集ページ」で軽やかに"[\s\S]{0,1200}targetSelector: "\[data-editor-page-navigator\]"/);
    // STEP 8 must NOT keep spotlighting the generic whole-editor target.
    expect(data).not.toMatch(/title: "長い原稿は「編集ページ」で軽やかに"[\s\S]{0,1200}target: "editor"/);
    expect(tour).toContain("step.targetSelector ?? (step.target");
  });

  it("STEP 8 explains arbitrary editor-only splits without implying publication pagination changes", () => {
    const data = readFileSync(join(__dirname, "..", "constants", "demoData.ts"), "utf8");
    const step = data.slice(
      data.indexOf('title: "長い原稿は「編集ページ」で軽やかに"'),
      data.indexOf('title: "作業タイムを記録しよう"')
    );
    expect(step).toContain("ここで区切る");
    expect(step).toContain("前のページとつなぐ");
    // TSP-EDITOR-UNIFIED-SPLIT-JOIN-012D: no manual/automatic boundary
    // terminology -- just "編集ページは作業用の区切り" (an editing aid) and
    // that the manuscript/publication output is unaffected.
    expect(step).not.toMatch(/自動区切り|手動区切り/);
    expect(step).toContain("編集ページは作業用の区切り");
    expect(step).toContain("原稿そのもの");
    expect(step).toContain("プレビュー・PDF・JPGのページには影響しません");
    expect(step).toContain('targetSelector: "[data-editor-page-navigator]"');
  });

  it("is used by the real tour while its navigation controls stay fixed", () => {
    const tour = readFileSync(join(__dirname, "..", "components", "DemoTour.tsx"), "utf8");
    expect(tour).toContain("computeDemoCardPlacement(");
    expect(tour).toContain("data-demo-placement={placement?.side");
    expect(tour).toMatch(/data-demo-exit=""[\s\S]{0,200}デモを終了/);
    expect(tour).toMatch(/data-demo-next=""[\s\S]{0,200}次へ/);
    expect(tour.match(/flex-none/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps the primary tour concise while covering work sessions and the detailed checklist", () => {
    const data = readFileSync(join(__dirname, "..", "constants", "demoData.ts"), "utf8");
    const tracker = readFileSync(join(__dirname, "..", "components", "WorkSessionTracker.tsx"), "utf8");
    const guide = readFileSync(join(__dirname, "..", "app", "guide", "page.tsx"), "utf8");

    // TSP-PAGED-EDITOR-QA-FIXES-AND-DEMO-010 §G added one step (編集ページ).
    expect(data.match(/^    title: "/gm)).toHaveLength(12);
    expect(data).not.toMatch(/\bn:\s*\d+,/);
    expect(data).toContain('title: "オプションも使えます"');
    expect(data).toContain('title: "集中モードで本文を広く"');
    expect(data).toContain('title: "作業タイムを記録しよう"');
    expect(data).toContain("作業スタート");
    expect(data).toContain("新しく書いた文字数");
    expect(data).toContain("作業記録");
    expect(tracker).toContain('data-demo-target="work-session"');

    expect(guide).toContain('title: "完成前マイチェックリスト"');
    expect(guide).toContain("プリセット");
    expect(guide).toContain("自分専用のリスト");
    expect(guide).toContain("このブラウザに保存");
    expect(guide).toContain("入稿ミスを防ぎます");
  });

  it("contains both normal and guided narrow Editors in one dynamic viewport", () => {
    const editor = readFileSync(join(__dirname, "..", "components", "TategakiEditor.tsx"), "utf8");
    const pane = readFileSync(join(__dirname, "..", "components", "EditorPane.tsx"), "utf8");
    const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf8");

    expect(editor).toContain('data-demo-mode={demoMode ? "" : undefined}');
    expect(editor).toContain('className="box-border flex h-[100dvh] min-h-0');
    expect(editor).toContain('className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden');
    expect(editor).toContain('data-editor-header-slot=""');
    expect(editor).not.toContain('focusMode || demoMode ? "hidden');
    expect(pane).toContain('className="relative min-h-0 flex-1"');
    expect(css).toContain("html:has([data-editor-shell])");
    expect(css).toContain("height: 100dvh");
    expect(css).toContain("overflow-y: hidden !important");
    expect(css).not.toContain("[data-editor-shell][data-demo-mode]");
  });
});
