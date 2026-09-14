import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(resolve(path), "utf8");

describe("RC Home information architecture", () => {
  const home = readSource("src/app/page.tsx");

  it("puts the bookshelf first for returning users and moves the compact brand panel below it", () => {
    expect(home).toContain("data-home-returning-bookshelf");
    expect(home).toContain('renderBrandPanel("informational")');
    expect(home.match(/どこで綴っても、ひとつの本になる。/g)).toHaveLength(1);
    expect(home.indexOf("data-home-returning-bookshelf")).toBeLessThan(
      home.lastIndexOf('renderBrandPanel("informational")')
    );
  });

  it("keeps returning Create, Demo, and anthology actions together above the shelf", () => {
    const start = home.indexOf("data-home-returning-actions");
    const end = home.indexOf("</div>", start);
    const actions = home.slice(start, end);
    expect(actions).toContain("新しい作品を作成する");
    expect(actions).toContain("おためしデモ");
    expect(actions).toContain("総集編を編成する");
  });

  it("uses the Human-reference upper structure for zero-work without a bordered empty card", () => {
    const start = home.indexOf("data-home-empty-onboarding");
    const end = home.indexOf("</main>", start);
    const emptyState = home.slice(start, end);
    expect(emptyState).toContain('renderBrandPanel("onboarding")');
    expect(emptyState).not.toContain("ここから、最初の一冊を。");
    expect(emptyState).not.toContain("新しい作品を作るか、おためしデモでTateSpunを試せます。");
    expect(emptyState).toContain('data-home-empty-bookshelf=""');
    expect(emptyState).toContain("<Bookshelf");
    expect(home).toContain("3分でわかる TateSpun おためしデモ");
    expect(emptyState).not.toContain("rounded-[18px] border");
    expect(home).toContain("原稿を持ち込む");
    expect(home).toContain("PDF / JPGで持ち帰る");
  });
});

describe("RC Editor information architecture", () => {
  const editor = readSource("src/components/EditorPane.tsx");
  const settings = readSource("src/components/EditorSettingsDrawer.tsx");
  const settingsPanel = readSource("src/components/PageSettingsPanel.tsx");
  const options = readSource("src/components/EditorOptionsDrawer.tsx");
  const shell = readSource("src/components/TategakiEditor.tsx");
  const preview = readSource("src/components/PreviewPaneNew.tsx");

  it("keeps the five approved visible manuscript actions, plus the focus-mode-only Memo and exit-focus entries", () => {
    expect(Array.from(editor.matchAll(/data-editor-action="([^"]+)"/g), (match) => match[1]))
      .toEqual(["undo", "redo", "page-break", "replace", "memo", "report", "exit-focus"]);
  });

  it("exposes exactly Settings, Options, Memo, and Help as secondary navigation", () => {
    expect(Array.from(editor.matchAll(/data-editor-secondary="([^"]+)"/g), (match) => match[1]))
      .toEqual(["settings", "options", "memo", "help"]);
  });

  it("keeps Memo and Help out of the Settings drawer", () => {
    expect(settings).not.toMatch(/plotNote|onOpenHelp|>メモ<|>ヘルプ</);
    expect(settings).toContain("settingsOnly");
  });

  it("renders page and master settings sequentially while hiding second-level tabs", () => {
    expect(settingsPanel).toContain('data-settings-section="page"');
    expect(settingsPanel).toContain('data-settings-section="master"');
    expect(settingsPanel).toContain('!settingsOnly && <div data-settings-tabs=""');
    expect(settingsPanel).toContain('settingsOnly || activeTab === "page"');
    expect(settingsPanel).toContain('settingsOnly || activeTab === "master"');
  });

  it("fits the narrow Editor into one dynamic viewport with internal scrolling surfaces", () => {
    expect(shell).toContain("h-[100dvh] min-h-0");
    expect(shell).toContain("gap-2 overflow-hidden");
    expect(shell).not.toContain("h-[calc(100dvh-9rem)]");
    expect(editor).toContain('className="relative min-h-0 flex-1"');
    // Exact substring match, not a weakened one: this locks in the same
    // resize-none/overflow-y-auto/overflow-x-hidden intent as before, but
    // written to account for the `probeMode === "nowrap"` diagnostic-only
    // ternary (b9ea7de) that already sits between overflow-y-auto and
    // overflow-x-hidden in the actual template literal.
    expect(editor).toContain(
      'resize-none overflow-y-auto ${probeMode === "nowrap" ? "overflow-x-auto whitespace-pre" : "overflow-x-hidden"}'
    );
    expect(settings).toContain("min-h-0 flex-1 overflow-y-auto");
    expect(options).toContain("min-h-0 flex-1 gap-3 overflow-y-auto");
    expect(shell).toContain('data-editor-header-slot=""');
    expect(shell).toContain('focusMode ? "hidden" : "flex-none"');
    expect(shell).not.toContain('focusMode || demoMode ? "hidden');
  });

  it("hides the global header at every width in desktop focus mode, reusing the one Focus Mode state", () => {
    // Previously the header slot was only hidden below `md`; on desktop it
    // stayed visible and reserved space. It must now fully leave layout (not
    // just be dimmed) whenever `focusMode` is on, with no independent
    // desktop focus flag introduced.
    expect(shell).not.toContain('focusMode ? "hidden md:block');
    expect(shell.match(/useMobileFocusMode\(\)/g)).toHaveLength(1);
    expect(shell).not.toMatch(/useDesktopFocusMode|isDesktopFocus/);
  });

  it("surfaces 通常に戻す beside 報告 in the Editor action row, wired to the shared exit handler, only while focus mode is on", () => {
    const reportIndex = editor.indexOf('data-editor-action="report"');
    const exitIndex = editor.indexOf('data-editor-action="exit-focus"');
    expect(reportIndex).toBeGreaterThan(-1);
    expect(exitIndex).toBeGreaterThan(reportIndex);
    expect(editor).toContain("{focusMode && onExitFocus && (");
    expect(editor).toContain("onClick={onExitFocus}");
    expect(editor).toContain("通常に戻す");
    // Hidden by default (mobile), only shown at md+ — mobile keeps its own
    // existing MobileEditorNav exit affordance untouched.
    expect(editor).toMatch(/className="hidden[^"]*md:inline-flex[^"]*"[\s\S]{0,40}通常に戻す/);
    expect(shell).toContain("onExitFocus={exitFocusMode}");
  });

  it("keeps the requested main Settings visual order in one continuous drawer", () => {
    expect(Array.from(settingsPanel.matchAll(/data-settings-row="([^"]+)"/g), (match) => match[1]))
      .toEqual(["paper", "typography", "columns", "layout-mode", "capacity", "capacity", "apply"]);
    expect(settingsPanel).toContain('data-settings-row="typography" className="order-[2]');
    expect(settingsPanel).toContain('data-settings-row="columns" className="order-[3]');
  });

  it("uses the single Memo entry to open an inline persistent accordion", () => {
    const memo = readSource("src/components/InlineMemoAccordion.tsx");
    expect(editor).toContain("<InlineMemoAccordion");
    expect(shell).not.toContain("<InlineMemoAccordion");
    expect(shell).not.toMatch(/isMemoOpen[\s\S]{0,120}<ViewportModal/);
    expect(memo).toContain('data-inline-memo=""');
    expect(memo).toContain("writeMemoDraft(window.localStorage");
    expect(memo).toContain("canConfirmMemoDraft(draft, confirmedMemo)");
  });

  it("uses no-selection JPG scope as all pages and preserves branding aspect ratio", () => {
    const legacyPreview = readSource("src/components/PreviewPane.tsx");
    const pageCard = readSource("src/components/PageCard.tsx");
    expect(legacyPreview).toContain("resolveJpgPageIndices(pages.length, selected)");
    expect(preview).toContain("resolveJpgPageIndices(plan.length, selectedPageIndices)");
    expect(preview).toContain("onTogglePage={togglePageSelection}");
    expect(pageCard).toContain('WEB_FOOTER_BRAND_SOURCE_WIDTH');
    expect(pageCard).toContain('WEB_FOOTER_BRAND_SOURCE_HEIGHT');
    expect(pageCard).toContain('height: "auto"');
  });

  it("derives visible HOLD and disabled exports from the composed image model", () => {
    expect(preview).toContain("findUnresolvedImageIssues(bridge.model)");
    expect(preview).toContain("imageHoldActive");
    expect(preview).toContain("!!progress || imageHoldActive");
  });

  it("contains all five required Options categories", () => {
    expect(Array.from(options.matchAll(/data-editor-option="([^"]+)"/g), (match) => match[1]))
      .toEqual(["vertical-colophon", "horizontal-colophon", "toc", "checklist", "txt-transfer"]);
    expect(options).toContain("A 原稿データ");
    expect(options).toContain("B 整形本文");
  });
});
