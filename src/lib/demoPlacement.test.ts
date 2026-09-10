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

  it("keeps the fallback and its fixed action controls inside the viewport", () => {
    const oversized = computeDemoCardPlacement(rect(390, 450), { width: 366, height: 900 }, viewport);
    expect(oversized.side).toBe("floating");
    expect(oversized.top).toBe(12);
    expect(oversized.maxHeight).toBe(820);
    expect(oversized.left).toBeGreaterThanOrEqual(12);
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

    expect(data.match(/\bn:\s*\d+,/g)).toHaveLength(10);
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

  it("contains only the narrow guided Demo in one dynamic viewport", () => {
    const editor = readFileSync(join(__dirname, "..", "components", "TategakiEditor.tsx"), "utf8");
    const pane = readFileSync(join(__dirname, "..", "components", "EditorPane.tsx"), "utf8");
    const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf8");

    expect(editor).toContain('data-demo-mode={demoMode ? "" : undefined}');
    expect(editor).toContain('demoMode\n          ? "h-[100dvh] min-h-0');
    expect(editor).toContain('guidedViewport={demoMode}');
    expect(pane).toContain('guidedViewport ? "max-md:flex-1" : "max-md:h-[62dvh]"');
    expect(css).toContain("[data-editor-shell][data-demo-mode]");
    expect(css).toContain("height: 100dvh");
    expect(css).toContain("overflow: hidden !important");
    expect(css).toContain("Normal mobile");
    expect(css).toContain("Editor keeps the document-scroll model above");
  });
});
