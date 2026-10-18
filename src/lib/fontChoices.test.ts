import { describe, expect, it } from "vitest";
import { FONT_FAMILY_OPTIONS, normalizeFontChoice, normalizeSettingsFonts } from "../constants/fonts";
import { DEFAULT_PAGE_SETTINGS } from "./pageLayout";
import { normalizeColophonSettings } from "./colophon";
import { PUBLICATION_FONT_ASSETS, previewFontFaceCss, previewFontFamilyCss, publicationFontAssetFor } from "./v2BrowserExport";

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

describe("TSP-PRINT-001 (P4-1): Preview draws the typeface PDF embeds", () => {
  it("every font choice gives the Preview the same family PDF embeds", () => {
    for (const option of FONT_FAMILY_OPTIONS) {
      const { cssName, path } = publicationFontAssetFor(option.value);
      expect(previewFontFamilyCss(option.value)).toBe(`"TateSpun Preview ${cssName}", "${cssName}", serif`);
      // The Preview reads the same file PDF embeds (it has vertical metrics; the webfont does not).
      expect(previewFontFaceCss(option.value)).toContain(`font-family:"TateSpun Preview ${cssName}"`);
      expect(previewFontFaceCss(option.value)).toContain(`url("${path}")`);
    }
  });

  it("an unknown or empty family falls back to Shippori Mincho, as PDF does", () => {
    expect(previewFontFamilyCss(undefined)).toBe('"TateSpun Preview Shippori Mincho", "Shippori Mincho", serif');
    expect(previewFontFamilyCss("serif")).toBe('"TateSpun Preview Shippori Mincho", "Shippori Mincho", serif');
  });
});
