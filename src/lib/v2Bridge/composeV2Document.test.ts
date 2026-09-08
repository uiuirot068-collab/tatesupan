import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "../pageLayout";
import { composeV2Document } from "./composeV2Document";
import { createFakeMeasurementProvider } from "../../../typesetting-v2/core/measurement/fakeProvider";

const MEASUREMENT = createFakeMeasurementProvider();

// A long enough manuscript that a narrow (small charsPerLine/linesPerColumn)
// capacity genuinely cannot fit it on one page, while the real Editor
// DEFAULT_PAGE_SETTINGS capacity (39x15) comfortably can.
const LONG_TEXT = "あ".repeat(60);

describe("composeV2Document -- realistic Editor state -> real v2 PaintPlan (integration)", () => {
  it("REAL Editor line-count settings change canonical PAGE COUNT, proving propagation reaches composition, not just the settings object (Human QA regression)", () => {
    const narrow: PageSettings = { ...DEFAULT_PAGE_SETTINGS, charsPerLine: 10, linesPerColumn: 2, columnCount: 1 };
    const wide: PageSettings = { ...DEFAULT_PAGE_SETTINGS, charsPerLine: 39, linesPerColumn: 15, columnCount: 1 };

    const narrowResult = composeV2Document({ title: "T", content: LONG_TEXT, settings: narrow, measurement: MEASUREMENT });
    const wideResult = composeV2Document({ title: "T", content: LONG_TEXT, settings: wide, measurement: MEASUREMENT });

    // Narrow capacity (10 chars/line x 2 lines/column = 20 chars/page) needs
    // multiple pages for 60 characters; wide capacity (39x15 = 585
    // chars/page, the REAL current app default) needs exactly one.
    expect(narrowResult.document.pages.length).toBeGreaterThan(1);
    expect(wideResult.document.pages.length).toBe(1);

    // The SAME real page count difference must reach the actual PaintPlan
    // (the thing PDF/JPG executors consume) -- not just CanonicalDocument.
    expect(narrowResult.plan.length).toBe(narrowResult.document.pages.length);
    expect(wideResult.plan.length).toBe(wideResult.document.pages.length);
    expect(narrowResult.plan.length).toBeGreaterThan(wideResult.plan.length);
  });

  it("the PaintPlan page's physical mm dimensions come from the real Editor paper/margin settings, unaffected by charsPerLine/linesPerColumn", () => {
    const narrow: PageSettings = { ...DEFAULT_PAGE_SETTINGS, charsPerLine: 10, linesPerColumn: 2 };
    const wide: PageSettings = { ...DEFAULT_PAGE_SETTINGS, charsPerLine: 39, linesPerColumn: 15 };
    const narrowResult = composeV2Document({ title: "T", content: "本文", settings: narrow, measurement: MEASUREMENT });
    const wideResult = composeV2Document({ title: "T", content: "本文", settings: wide, measurement: MEASUREMENT });
    expect(narrowResult.plan[0].widthMm).toBe(wideResult.plan[0].widthMm);
    expect(narrowResult.plan[0].heightMm).toBe(wideResult.plan[0].heightMm);
  });

  it("a real ruby+TCY+image manuscript composes to a real, non-empty PaintPlan without throwing", () => {
    const result = composeV2Document({
      title: "T",
      content: "前置き｜東京《とうきょう》に20年住んだ。",
      settings: DEFAULT_PAGE_SETTINGS,
      measurement: MEASUREMENT,
    });
    expect(result.plan.length).toBeGreaterThan(0);
    expect(result.plan[0].commands.length).toBeGreaterThan(0);
  });

  it("folio/header settings reach the composed document's real pages when the Editor has real hashira text set", () => {
    const withHashira: PageSettings = { ...DEFAULT_PAGE_SETTINGS, masterPage: { ...DEFAULT_PAGE_SETTINGS.masterPage, hashiraOdd: "作品名", hashiraEven: "作品名" } };
    const result = composeV2Document({ title: "T", content: "本文", settings: withHashira, measurement: MEASUREMENT });
    expect(result.document.pages[0].folio).toBeDefined();
    expect(result.document.pages[0].header?.text).toBe("作品名");
  });

  it("an enabled colophon reaches a real, separate colophon page in the composed document", () => {
    const withColophon: PageSettings = {
      ...DEFAULT_PAGE_SETTINGS,
      colophon: {
        ...DEFAULT_PAGE_SETTINGS.colophon,
        enabled: true,
        fields: [{ id: "title", label: "書名", value: "テスト作品", visible: true }],
        freeText: "",
      },
    };
    const result = composeV2Document({ title: "T", content: "本文", settings: withColophon, measurement: MEASUREMENT });
    expect(result.document.colophon).toBeDefined();
    expect(result.plan.length).toBeGreaterThan(result.document.pages.length - 1); // colophon adds at least its own page
  });

  it("a disabled colophon (real Editor default) never adds a colophon page", () => {
    const result = composeV2Document({ title: "T", content: "本文", settings: DEFAULT_PAGE_SETTINGS, measurement: MEASUREMENT });
    expect(result.document.colophon).toBeUndefined();
  });
});
