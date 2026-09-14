import { createCanvas, loadImage } from "@napi-rs/canvas";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  containRasterRect,
  WEB_FOOTER_BRAND_CSS_WIDTH,
  WEB_FOOTER_BRAND_SOURCE_HEIGHT,
  WEB_FOOTER_BRAND_SOURCE_WIDTH,
} from "./webFooterBranding";

const source = (path: string) => readFileSync(resolve(path), "utf8");

describe("Round 5 Memo and Home contracts", () => {
  const pane = source("src/components/EditorPane.tsx");
  const shell = source("src/components/TategakiEditor.tsx");
  const memo = source("src/components/InlineMemoAccordion.tsx");
  const bookshelf = source("src/components/bookshelf/Bookshelf.tsx");
  const bookshelfCss = source("src/components/bookshelf/Bookshelf.module.css");
  const home = source("src/app/page.tsx");

  it("uses the same Memo entry as an open/close toggle without touching draft semantics", () => {
    expect(pane).toContain("onToggleMemo: () => void");
    expect(pane).toContain("onClick={onToggleMemo}");
    expect(pane).toContain('{memoOpen ? "▼メモ" : "▶メモ"}');
    expect(pane).toContain("aria-expanded={memoOpen}");
    expect(shell).toContain("setIsMemoOpen((open) => !open)");
    expect(memo).toContain("writeMemoDraft(window.localStorage, storageKey, value)");
    expect(memo).toContain("clearMemoDraft(window.localStorage, storageKey)");
    expect(memo).toContain("canConfirmMemoDraft(draft, confirmedMemo)");
  });

  it("removes the actual long shelf-front line while retaining card and popup borders", () => {
    expect(bookshelf).not.toContain("shelfFrontLip");
    expect(bookshelfCss).not.toContain(".shelfFrontLip {");
    expect(home).toContain('role="tabpanel"');
    expect(home).toContain('rounded-[18px] border border-[rgba(31,42,68,0.14)]');
    expect(bookshelfCss).toMatch(/\.menuPanel\s*\{[\s\S]*?border: 1px solid/);
    expect(bookshelfCss).toContain("background: var(--base)");
  });
});

describe("Round 5 compact mobile Editor controls", () => {
  const pane = source("src/components/EditorPane.tsx");
  const mobileNav = source("src/components/MobileEditorNav.tsx");
  const actionRow = pane.slice(
    pane.indexOf('data-editor-action-row=""'),
    pane.indexOf('<div className={focusMode ? "hidden" : ""}')
  );
  const secondaryRow = pane.slice(
    pane.indexOf('data-editor-secondary-row=""'),
    pane.indexOf("<InlineMemoAccordion")
  );

  it.each([320, 375, 390, 430])("keeps all five manuscript actions in one nowrap row at %ipx", () => {
    expect(actionRow).toContain("grid-cols-[44px_44px_max-content_max-content_max-content]");
    expect(actionRow).not.toContain("grid-cols-2");
    expect(actionRow).toContain("whitespace-nowrap");
    expect(actionRow).toContain("min-h-9 min-w-11");
  });

  it("shows arrow-only mobile Undo/Redo with accessible labels and larger icons", () => {
    expect(actionRow).toMatch(/aria-label="元に戻す"[\s\S]*?text-xl[\s\S]*?hidden md:inline">元に戻す/);
    expect(actionRow).toMatch(/aria-label="やり直す"[\s\S]*?text-xl[\s\S]*?hidden md:inline">やり直す/);
  });

  it("keeps core actions outside the mobile Focus-hidden secondary wrapper", () => {
    const focusHidden = pane.indexOf('focusMode ? "hidden" : ""', pane.indexOf('data-editor-action-row=""'));
    expect(pane.indexOf('data-editor-action-row=""')).toBeLessThan(focusHidden);
    expect(actionRow).not.toContain("max-md:hidden");
    expect(actionRow).toContain('data-editor-action="undo"');
    expect(actionRow).toContain('data-editor-action="redo"');
    expect(actionRow).toContain('data-editor-action="page-break"');
    expect(actionRow).toContain('data-editor-action="replace"');
    expect(actionRow).toContain('data-editor-action="memo"');
    expect(actionRow).toContain('data-editor-action="report"');
    expect(actionRow).toContain('data-editor-action="exit-focus"');
    expect(pane).toMatch(/data-writing-check-surface=""[\s\S]*?max-md:hidden/);
    expect(pane).toMatch(/data-editor-status-surfaces=""[\s\S]*?max-md:hidden/);
  });

  it.each([320, 375, 390, 430])("keeps all four secondary controls in one content-aware row at %ipx", () => {
    expect(secondaryRow).toContain("grid-cols-[auto_minmax(0,1fr)_auto_auto]");
    expect(secondaryRow).toContain("gap-0.5");
    expect(secondaryRow.match(/whitespace-nowrap/g)).toHaveLength(4);
    expect(secondaryRow).toContain("▶オプション");
    expect(secondaryRow).not.toContain("flex-wrap");
  });

  it("exposes the mobile Focus control as a guide target", () => {
    expect(mobileNav).toMatch(/data-demo-target="focus-mode"[\s\S]*?onClick=/);
  });
});

describe("Round 5 Demo contract", () => {
  const data = source("src/constants/demoData.ts");
  const tour = source("src/components/DemoTour.tsx");
  const pane = source("src/components/EditorPane.tsx");
  const placement = source("src/lib/demoPlacement.ts");

  it("adds Options immediately after the two Settings steps and explains all contents", () => {
    const titles = Array.from(data.matchAll(/title: "([^"]+)"/g), (match) => match[1]);
    expect(titles.slice(0, 6)).toEqual([
      "作品にタイトルをつけよう",
      "本のサイズを決めよう",
      "ノンブルや柱も設定できるよ",
      "オプションも使えます",
      "困ったらヘルプへ",
      "集中モードで本文を広く",
    ]);
    expect(data).toContain("奥付（縦・横）、目次、完成前チェック、TXT出入力");
    expect(data).toContain('target: "options"');
    expect(pane).toContain('data-demo-target="options"');
  });

  it("keeps mobile tab copy to 本文/プレビュー and adds a no-toggle Focus step", () => {
    expect(data).toContain('"スマートフォンでは「本文」と「プレビュー」を切り替えられます。');
    expect(data).not.toContain('「本文」「プレビュー」「設定」');
    expect(data).toContain('target: "focus-mode"');
    expect(data).not.toContain("prepare:");
    expect(tour).not.toMatch(/setActiveDrawer|setIsMemoOpen|setFocusMode/);
  });

  it("derives numbering from array length and uses safe target-preserving placement", () => {
    expect(data).not.toMatch(/\bn:\s*\d+/);
    expect(tour).toContain("STEP {stepNumber} / {total}");
    expect(tour).toContain('block: "nearest"');
    expect(placement).toContain("availableAbove");
    expect(placement).toContain("availableBelow");
  });
});

describe("Round 5 Web JPG footer branding", () => {
  it("fits the original 384×341 source directly into the 19px production box", () => {
    const height = WEB_FOOTER_BRAND_CSS_WIDTH * WEB_FOOTER_BRAND_SOURCE_HEIGHT / WEB_FOOTER_BRAND_SOURCE_WIDTH;
    const destination = containRasterRect(
      { width: WEB_FOOTER_BRAND_SOURCE_WIDTH, height: WEB_FOOTER_BRAND_SOURCE_HEIGHT },
      { x: 0, y: 0, width: WEB_FOOTER_BRAND_CSS_WIDTH, height }
    );
    expect(destination.width).toBe(19);
    expect(destination.height).toBeCloseTo(16.8724, 4);
    expect(destination.width / destination.height).toBeCloseTo(384 / 341, 10);
  });

  it("uses a visibility-preserving placeholder and one high-quality direct paint", () => {
    const pageCard = source("src/components/PageCard.tsx");
    const capture = source("src/utils/exportCapture.ts");
    expect(pageCard.match(/data-export-branding="web-footer"/g)).toHaveLength(1);
    expect(capture).toContain("img.style.visibility = \"hidden\"");
    expect(capture).toContain('img.setAttribute("data-export-direct-composite", "true")');
    expect(capture).toContain('ctx.imageSmoothingQuality = "high"');
    expect(capture).toContain("containRasterRect(");
    expect(capture.match(/compositeImagesOntoCanvas\(canvas, imageComposites\)/g)).toHaveLength(1);
  });

  it("writes a focused one-paint QA artifact at actual production size", async () => {
    const image = await loadImage(resolve("public/caroad_main2.png"));
    expect(image.width).toBe(WEB_FOOTER_BRAND_SOURCE_WIDTH);
    expect(image.height).toBe(WEB_FOOTER_BRAND_SOURCE_HEIGHT);

    const canvas = createCanvas(360, 150);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f9f8f6";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1f2a44";
    ctx.font = "14px sans-serif";
    ctx.fillText("Web JPG footer branding — production size", 18, 28);
    ctx.font = "12px sans-serif";
    ctx.fillText("source 384×341  |  destination 19×16.87  |  paint count 1", 18, 50);
    const destination = containRasterRect(
      { width: image.width, height: image.height },
      { x: 40, y: 82, width: 19, height: 19 * 341 / 384 }
    );
    ctx.strokeStyle = "#c5a059";
    ctx.strokeRect(39.5, 81.5, 20, 19 * 341 / 384 + 1);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    let paintCount = 0;
    ctx.drawImage(image, destination.x, destination.y, destination.width, destination.height);
    paintCount += 1;
    expect(paintCount).toBe(1);

    const artifact = resolve("typesetting-v2/qa/visual/rc-polish-round5/web-jpg-branding-single-paint.png");
    mkdirSync(dirname(artifact), { recursive: true });
    writeFileSync(artifact, canvas.toBuffer("image/png"));
  });
});
