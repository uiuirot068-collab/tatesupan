import { describe, expect, it } from "vitest";
import { FONT_FAMILY_OPTIONS, normalizeFontChoice, normalizeSettingsFonts } from "../constants/fonts";
import { DEFAULT_PAGE_SETTINGS } from "./pageLayout";
import { normalizeColophonSettings } from "./colophon";
import { PUBLICATION_FONT_ASSETS, publicationFontAssetFor } from "./v2BrowserExport";

describe("TSP-PHASE13-001: every font choice prints in PDF", () => {
  it("offers only families PDF can embed (システム標準明朝 retired)", () => {
    expect(FONT_FAMILY_OPTIONS.map((option) => option.label)).not.toContain("システム標準明朝");
    for (const option of FONT_FAMILY_OPTIONS) {
      expect(PUBLICATION_FONT_ASSETS).toContain(publicationFontAssetFor(option.value));
      expect(publicationFontAssetFor(option.value).cssName).toBe(option.value.split(",")[0].replace(/'/g, "").trim());
    }
  });

  it("resolves a stored retired family: body → Shippori Mincho, ノンブル/奥付 → 本文と同じ", () => {
    expect(normalizeFontChoice("serif", "")).toBe("");
    expect(normalizeFontChoice("'Zen Old Mincho', serif", "")).toBe("'Zen Old Mincho', serif");
    const loaded = normalizeSettingsFonts({
      ...DEFAULT_PAGE_SETTINGS,
      fontFamily: "serif",
      masterPage: { ...DEFAULT_PAGE_SETTINGS.masterPage, nombreFontFamily: "serif" },
    });
    expect(loaded.fontFamily).toBe("'Shippori Mincho', serif");
    expect(loaded.masterPage.nombreFontFamily).toBe("");
    expect(normalizeColophonSettings({ ...DEFAULT_PAGE_SETTINGS.colophon, fontFamily: "serif" }).fontFamily).toBe("");
  });

  it("returns current settings unchanged", () => {
    expect(normalizeSettingsFonts(DEFAULT_PAGE_SETTINGS)).toBe(DEFAULT_PAGE_SETTINGS);
  });
});
