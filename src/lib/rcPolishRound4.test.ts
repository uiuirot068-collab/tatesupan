import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createFakeMeasurementProvider } from "../../typesetting-v2/core/measurement/fakeProvider";
import { composeV2Document } from "./v2Bridge/composeV2Document";
import { DEFAULT_PAGE_SETTINGS, recommendedNombreFontSizePt } from "./pageLayout";
import {
  normalizeOutputTypography,
  WEB_READING_BODY_FONT_SIZE,
  WEB_READING_FOLIO_FONT_SIZE,
  WEB_READING_RUNNING_HEAD_FONT_SIZE,
} from "./outputTypography";

const source = (path: string) => readFileSync(resolve(path), "utf8");

describe("Round 4 settings contract", () => {
  it("uses explicit typography and columns rows in the approved order", () => {
    const panel = source("src/components/PageSettingsPanel.tsx");
    const rows = ["paper", "typography", "columns", "layout-mode", "capacity"];
    const positions = rows.map((row) => panel.indexOf(`data-settings-row="${row}"`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    const typography = panel.slice(positions[1], positions[2]);
    expect(typography).toContain('data-settings-order="font"');
    expect(typography).toContain('data-settings-order="font-size"');
    expect(typography).toContain('data-settings-order="line-height"');
    const columns = panel.slice(positions[2], positions[3]);
    expect(columns).toContain('data-settings-order="columns"');
    expect(columns).toContain('data-settings-order="column-gap"');
  });

  it("defaults only new/missing settings to margin mode while stored values win", () => {
    expect(DEFAULT_PAGE_SETTINGS.layoutMode).toBe("margin");
    expect({ ...DEFAULT_PAGE_SETTINGS, ...{ layoutMode: "capacity" as const } }.layoutMode).toBe("capacity");
  });
});

describe("Round 4 publication furniture overrides", () => {
  it.each([[9, 6], [6, 4], [4, 4]])("keeps max(4, body - 3) as the preset rule", (body, expected) => {
    expect(recommendedNombreFontSizePt(body)).toBe(expected);
  });

  it("accepts and preserves manual values below 4 across unrelated edits", () => {
    const manual = normalizeOutputTypography({
      ...DEFAULT_PAGE_SETTINGS,
      fontFamily: "manual-font",
      masterPage: { ...DEFAULT_PAGE_SETTINGS.masterPage, nombreFontSize: 2.5, headerFontSize: 2 },
    });
    expect([manual.masterPage.nombreFontSize, manual.masterPage.headerFontSize]).toEqual([2.5, 2]);
    const unrelated = normalizeOutputTypography({ ...manual, lineHeightRatio: 2.1 });
    expect([unrelated.masterPage.nombreFontSize, unrelated.masterPage.headerFontSize]).toEqual([2.5, 2]);
  });

  it("passes manual values into the canonical publication PaintPlan", () => {
    const settings = normalizeOutputTypography({
      ...DEFAULT_PAGE_SETTINGS,
      masterPage: {
        ...DEFAULT_PAGE_SETTINGS.masterPage,
        hashiraOdd: "柱",
        hashiraEven: "柱",
        nombreFontSize: 2.5,
        headerFontSize: 2,
      },
    });
    const { plan } = composeV2Document({ title: "manual", content: "本文", settings, measurement: createFakeMeasurementProvider() });
    const text = plan.flatMap((page) => page.commands).filter((command) => command.op === "text");
    expect(text.find((command) => command.furnitureRole === "folio")?.fontSizePt).toBe(2.5);
    expect(text.find((command) => command.furnitureRole === "running-head")?.fontSizePt).toBe(2);
  });

  it("keeps the Web body fixed at 30 while manual nombre/running-head values persist", () => {
    // Item 6 of the final release fix: Web furniture is user-editable and
    // must never silently snap back to the fixed 15 / 20 recommendation
    // once the user has set their own values.
    const web = normalizeOutputTypography({
      ...DEFAULT_PAGE_SETTINGS,
      paperSize: "Web閲覧用",
      masterPage: { ...DEFAULT_PAGE_SETTINGS.masterPage, nombreFontSize: 2.5, headerFontSize: 2 },
    });
    expect([web.fontSizePt, web.masterPage.nombreFontSize, web.masterPage.headerFontSize]).toEqual([
      WEB_READING_BODY_FONT_SIZE,
      2.5,
      2,
    ]);
    expect([WEB_READING_FOLIO_FONT_SIZE, WEB_READING_RUNNING_HEAD_FONT_SIZE]).toEqual([15, 20]);
  });
});

describe("Round 4 Editor placement and visibility", () => {
  const pane = source("src/components/EditorPane.tsx");
  const shell = source("src/components/TategakiEditor.tsx");

  it("renders Memo inside the Editor pane immediately after secondary navigation", () => {
    expect(pane.indexOf("data-editor-secondary-row")).toBeLessThan(pane.indexOf("<InlineMemoAccordion"));
    expect(pane.indexOf("<InlineMemoAccordion")).toBeLessThan(pane.indexOf('data-mobile-write-action=""'));
    expect(shell).not.toContain("<InlineMemoAccordion");
  });

  it("hides focus-only status surfaces without deleting their state", () => {
    expect(pane).toMatch(/data-writing-check-surface=""[\s\S]{0,100}focusMode \? "max-md:hidden md:hidden"/);
    expect(pane).toMatch(/data-editor-status-surfaces=""[\s\S]{0,180}focusMode \? "max-md:hidden md:hidden"/);
    expect(pane).toContain('data-ruby-tcy-status=""');
    expect(pane).toContain("<WorkSessionTracker");
  });

  it("removes the mobile write action after writing becomes active", () => {
    expect(pane).toContain("setMobileWritingActive(true)");
    expect(pane).toContain("!mobileWritingActive && !focusMode && <div data-mobile-write-action");
    expect(pane).toContain("onFocus={() => setMobileWritingActive(true)}");
  });
});

describe("Round 4 Home and Demo", () => {
  it("matches the zero-work reference structure without the intermediate block", () => {
    const home = source("src/app/page.tsx");
    const empty = home.slice(home.indexOf('data-home-empty-onboarding=""'), home.indexOf("</main>"));
    expect(empty).toContain('renderBrandPanel("onboarding")');
    expect(empty).toContain('data-home-empty-bookshelf=""');
    expect(empty).not.toContain("ここから、最初の一冊を。");
    expect(empty).not.toContain("新しい作品を作るか、おためしデモでTateSpunを試せます。");
    expect(home).not.toContain('className="border-t border-[rgba(31,42,68,0.14)] px-4 pt-[45px]');
  });

  it("keeps Demo transitions free of real UI open-state side effects", () => {
    const tour = source("src/components/DemoTour.tsx");
    const shell = source("src/components/TategakiEditor.tsx");
    const data = source("src/constants/demoData.ts");
    const demoCall = shell.slice(shell.indexOf("<DemoTour"), shell.indexOf("cloudLimitPlan"));
    expect(tour).not.toContain("onPrepare");
    expect(demoCall).not.toContain("setActiveDrawer");
    expect(demoCall).not.toContain("setIsMemoOpen");
    expect(data).not.toContain("prepare:");
    expect(data).toContain('target: "settings"');
  });
});
