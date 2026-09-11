import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SETTINGS, type PageSettings, type PaperSizeKey } from "./pageLayout";
import { normalizeOutputTypography } from "./outputTypography";
import { applyColumnCountPreset, applyDestinationPaperPreset } from "./paperPresets";

const manual: PageSettings = {
  ...DEFAULT_PAGE_SETTINGS,
  fontSizePt: 13,
  masterPage: {
    ...DEFAULT_PAGE_SETTINGS.masterPage,
    nombreFontSize: 11,
    headerFontSize: 12,
    nombreLayoutCustomized: true,
  },
};

describe("final paper preset contract", () => {
  it("reapplies the destination paper furniture defaults", () => {
    const expected: Record<PaperSizeKey, number> = {
      文庫: 4, B6: 4, A6: 4, 新書: 4, A5: 5, B5: 5, Web閲覧用: 15,
    };
    for (const [paper, size] of Object.entries(expected) as Array<[PaperSizeKey, number]>) {
      const next = applyDestinationPaperPreset(manual, paper);
      expect(next.masterPage.nombreFontSize).toBe(size);
      expect(next.masterPage.headerFontSize).toBe(paper === "Web閲覧用" ? 20 : size);
      expect(next.masterPage.nombreLayoutCustomized).toBe(false);
    }
  });

  it("applies the approved 文庫 and A6 one-column body presets", () => {
    const bunko = applyDestinationPaperPreset({ ...manual, columnCount: 2 }, "文庫");
    expect(bunko).toMatchObject({
      columnCount: 1, fontSizePt: 9, lineHeightRatio: 1.5,
      marginTop: 14, marginBottom: 14, marginGutter: 18, marginOuter: 10,
    });
    const a6 = applyDestinationPaperPreset({ ...manual, columnCount: 2 }, "A6");
    expect(a6).toMatchObject({
      columnCount: 1, fontSizePt: 9.5, lineHeightRatio: 1.7,
      marginTop: 14, marginBottom: 14, marginGutter: 15, marginOuter: 10,
    });
  });

  it("applies only the A5/B5 column-triggered body sizes", () => {
    for (const paperSize of ["A5", "B5"] as const) {
      const base = { ...manual, paperSize };
      expect(applyColumnCountPreset(base, 1).fontSizePt).toBe(10);
      expect(applyColumnCountPreset(base, 2).fontSizePt).toBe(9.5);
    }
    expect(applyColumnCountPreset({ ...manual, paperSize: "B6" }, 2).fontSizePt).toBe(13);
  });

  it("preserves manual values through unrelated settings and keeps Web furniture editable", () => {
    const preset = applyDestinationPaperPreset(manual, "Web閲覧用");
    const edited = {
      ...preset,
      masterPage: { ...preset.masterPage, nombreFontSize: 17, headerFontSize: 21, nombreLayoutCustomized: true },
    };
    const unrelated = normalizeOutputTypography({ ...edited, lineHeightRatio: 2.1 });
    expect(unrelated.masterPage.nombreFontSize).toBe(17);
    expect(unrelated.masterPage.headerFontSize).toBe(21);
  });
});
