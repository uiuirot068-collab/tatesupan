import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SETTINGS, computeLinePitchMm, type PageSettings } from "../pageLayout";
import { buildV2LayoutSettings, buildV2PageGeometry, buildV2FolioSettings, buildV2HeaderSettings, buildV2HeaderPageOverrides, buildV2ColophonText } from "./settingsAdapter";
import { mmToTicks } from "../../../typesetting-v2/core/geometry/tick";

describe("settingsAdapter -- real PageSettings -> v2 Core input contracts", () => {
  describe("format/typography (line-count propagation, Human QA concern)", () => {
    it("uses the Editor's OWN real charsPerLine/linesPerColumn directly -- never a hardcoded default", () => {
      const layout = buildV2LayoutSettings(DEFAULT_PAGE_SETTINGS);
      const perCellAdvanceTick = mmToTicks((DEFAULT_PAGE_SETTINGS.fontSizePt * 25.4) / 72);
      const linePitchTick = mmToTicks(computeLinePitchMm(DEFAULT_PAGE_SETTINGS.fontSizePt, DEFAULT_PAGE_SETTINGS.lineHeightRatio));
      expect(layout.lineExtentTicks).toBe(DEFAULT_PAGE_SETTINGS.charsPerLine * perCellAdvanceTick);
      expect(layout.columnExtentTicks).toBe(DEFAULT_PAGE_SETTINGS.linesPerColumn * linePitchTick);
    });

    // Typography Parity Round 3: linePitchTicks (行間, spacing between
    // adjacent 行 within a column) is a REAL, independent quantity from
    // perCellAdvanceTick (character-to-character advance WITHIN one 行) --
    // it reflects the Editor's own real lineHeightRatio (行間倍率, default
    // 1.7), never the same value, matching the real, already-shipped
    // legacy layout math (`computeLinePitchMm`, `pageLayout.ts`) and an
    // independently-measured real InDesign reference PDF's own ~1.77x
    // column-to-character-size ratio (see qa/evidence/
    // TYPOGRAPHY_PARITY_INDESIGN_OVERLAY_DRIFT.md).
    it("linePitchTicks reflects the Editor's own real lineHeightRatio, NOT the character advance -- these are genuinely independent physical quantities", () => {
      const layout = buildV2LayoutSettings(DEFAULT_PAGE_SETTINGS);
      const perCellAdvanceTick = mmToTicks((DEFAULT_PAGE_SETTINGS.fontSizePt * 25.4) / 72);
      expect(DEFAULT_PAGE_SETTINGS.lineHeightRatio).not.toBe(1); // sanity: the default itself is non-trivial (1.7)
      expect(layout.linePitchTicks).not.toBe(perCellAdvanceTick);
      expect(layout.linePitchTicks / perCellAdvanceTick).toBeCloseTo(DEFAULT_PAGE_SETTINGS.lineHeightRatio, 2);
    });

    it("a different lineHeightRatio produces proportionally different linePitchTicks/columnExtentTicks, with lineExtentTicks (character direction) completely unaffected", () => {
      const tight: PageSettings = { ...DEFAULT_PAGE_SETTINGS, lineHeightRatio: 1.0 };
      const loose: PageSettings = { ...DEFAULT_PAGE_SETTINGS, lineHeightRatio: 2.0 };
      const tightLayout = buildV2LayoutSettings(tight);
      const looseLayout = buildV2LayoutSettings(loose);
      expect(looseLayout.linePitchTicks / tightLayout.linePitchTicks).toBeCloseTo(2, 5);
      expect(looseLayout.columnExtentTicks / tightLayout.columnExtentTicks).toBeCloseTo(2, 5);
      expect(looseLayout.lineExtentTicks).toBe(tightLayout.lineExtentTicks);
    });

    it("two materially different Editor line-count settings produce measurably different tick geometry (not just different numbers on an unused object)", () => {
      const narrow: PageSettings = { ...DEFAULT_PAGE_SETTINGS, charsPerLine: 20, linesPerColumn: 10 };
      const wide: PageSettings = { ...DEFAULT_PAGE_SETTINGS, charsPerLine: 39, linesPerColumn: 15 };
      const narrowLayout = buildV2LayoutSettings(narrow);
      const wideLayout = buildV2LayoutSettings(wide);
      expect(wideLayout.lineExtentTicks).toBeGreaterThan(narrowLayout.lineExtentTicks);
      expect(wideLayout.columnExtentTicks).toBeGreaterThan(narrowLayout.columnExtentTicks);
      // Exact ratio, not just "greater than" -- proves real proportional propagation.
      expect(wideLayout.lineExtentTicks / narrowLayout.lineExtentTicks).toBeCloseTo(39 / 20, 5);
      expect(wideLayout.columnExtentTicks / narrowLayout.columnExtentTicks).toBeCloseTo(15 / 10, 5);
    });

    it("columnCount maps directly to columnsPerPage", () => {
      const twoColumn: PageSettings = { ...DEFAULT_PAGE_SETTINGS, columnCount: 2 };
      expect(buildV2LayoutSettings(twoColumn).columnsPerPage).toBe(2);
      expect(buildV2LayoutSettings(DEFAULT_PAGE_SETTINGS).columnsPerPage).toBe(1);
    });
  });

  describe("page geometry (paper size, margins)", () => {
    it("maps real paper dimensions and margins, with vertical-rl gutter/outer mapped to right/left", () => {
      const geometry = buildV2PageGeometry(DEFAULT_PAGE_SETTINGS);
      expect(geometry.paperWidthMm).toBeGreaterThan(0);
      expect(geometry.paperHeightMm).toBeGreaterThan(0);
      expect(geometry.marginTopMm).toBe(DEFAULT_PAGE_SETTINGS.marginTop);
      expect(geometry.marginBottomMm).toBe(DEFAULT_PAGE_SETTINGS.marginBottom);
      expect(geometry.marginRightMm).toBe(DEFAULT_PAGE_SETTINGS.marginGutter);
      expect(geometry.marginLeftMm).toBe(DEFAULT_PAGE_SETTINGS.marginOuter);
    });
  });

  describe("folio (nombre)", () => {
    it("maps a real nombre position directly", () => {
      const folio = buildV2FolioSettings(DEFAULT_PAGE_SETTINGS);
      expect(folio).toBeDefined();
      expect(folio?.position).toBe(DEFAULT_PAGE_SETTINGS.masterPage.nombrePosition);
      expect(folio?.nombreStart).toBe(DEFAULT_PAGE_SETTINGS.masterPage.nombreStart);
    });

    it("nombrePosition:'hidden' maps to undefined (v2 has no 'hidden' FolioPosition -- omitting folioSettings IS v2's real 'no folio' representation)", () => {
      const hidden: PageSettings = { ...DEFAULT_PAGE_SETTINGS, masterPage: { ...DEFAULT_PAGE_SETTINGS.masterPage, nombrePosition: "hidden" } };
      expect(buildV2FolioSettings(hidden)).toBeUndefined();
    });
  });

  describe("header (hashira)", () => {
    it("maps real hashiraOdd/hashiraEven/hashiraPosition via the existing headerSettingsFromLegacy adapter", () => {
      const withHashira: PageSettings = { ...DEFAULT_PAGE_SETTINGS, masterPage: { ...DEFAULT_PAGE_SETTINGS.masterPage, hashiraOdd: "小説のタイトル", hashiraEven: "第一章" } };
      const header = buildV2HeaderSettings(withHashira);
      expect(header.hashiraOdd).toBe("小説のタイトル");
      expect(header.hashiraEven).toBe("第一章");
      expect(header.position.band).toBe(withHashira.masterPage.hashiraPosition);
    });

    it("maps real per-page pageOverrides to headerPageOverrides (hashira-relevant subset only)", () => {
      const withOverride: PageSettings = { ...DEFAULT_PAGE_SETTINGS, pageOverrides: { 3: { hideHashira: true }, 5: { hashiraOverride: "特別編" }, 7: { hideNombre: true } } };
      const overrides = buildV2HeaderPageOverrides(withOverride);
      expect(overrides).toBeDefined();
      expect(overrides?.[3]).toEqual({ hideHashira: true });
      expect(overrides?.[5]).toEqual({ hashiraOverride: "特別編" });
      // Page 7 only has a folio-only override (hideNombre) -- no v2
      // headerPageOverrides equivalent exists (disclosed, out of scope),
      // so it must NOT appear here.
      expect(overrides?.[7]).toBeUndefined();
    });

    it("returns undefined when no real overrides exist", () => {
      expect(buildV2HeaderPageOverrides(DEFAULT_PAGE_SETTINGS)).toBeUndefined();
    });
  });

  describe("colophon content text", () => {
    it("compiles visible fields as label\\tvalue rows, joined by newline, with freeText appended last", () => {
      const withColophon: PageSettings = {
        ...DEFAULT_PAGE_SETTINGS,
        colophon: {
          ...DEFAULT_PAGE_SETTINGS.colophon,
          enabled: true,
          fields: [
            { id: "title", label: "書名", value: "吾輩は猫である", visible: true },
            { id: "author", label: "著者", value: "夏目漱石", visible: true },
            { id: "hidden", label: "非表示", value: "見えない値", visible: false },
          ],
          freeText: "初版発行",
        },
      };
      const text = buildV2ColophonText(withColophon.colophon);
      expect(text).toBe("書名\t吾輩は猫である\n著者\t夏目漱石\n初版発行");
      expect(text).not.toContain("見えない値");
    });
  });
});
