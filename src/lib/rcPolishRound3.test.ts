import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "./pageLayout";
import { applyRunningHeads } from "./runningHeadApply";
import { resolveJpgPageIndices } from "./jpgPageSelection";
import {
  publicationFurnitureFontSizePt,
  normalizeOutputTypography,
  WEB_READING_BODY_FONT_SIZE,
  WEB_READING_FOLIO_FONT_SIZE,
  WEB_READING_RUNNING_HEAD_FONT_SIZE,
} from "./outputTypography";
import { canConfirmMemoDraft, clearMemoDraft, memoDraftStorageKey, readMemoDraft, writeMemoDraft } from "./memoDraft";

const settings = (pageOverrides: PageSettings["pageOverrides"] = {}): PageSettings => ({
  ...DEFAULT_PAGE_SETTINGS,
  masterPage: { ...DEFAULT_PAGE_SETTINGS.masterPage, hashiraOdd: "奇数B", hashiraEven: "偶数B" },
  pageOverrides,
});

describe("Round 3 running-head scope", () => {
  it("all pages clear old assignments so canonical odd/even masters apply", () => {
    const result = applyRunningHeads(settings({ 2: { hashiraOverride: "偶数A" }, 3: { hashiraOverride: "奇数A", hideNombre: true } }), []);
    expect(result.scope).toBe("all");
    expect(result.settings.pageOverrides).toEqual({ 3: { hideNombre: true } });
    expect(result.settings.masterPage.hashiraOdd).toBe("奇数B");
    expect(result.settings.masterPage.hashiraEven).toBe("偶数B");
  });

  it("splits mixed selected pages by physical parity and canonical order", () => {
    const result = applyRunningHeads(settings(), [7, 2, 4, 3]);
    expect(result.oddPages).toEqual([3, 7]);
    expect(result.evenPages).toEqual([2, 4]);
    expect(result.settings.pageOverrides[3].hashiraOverride).toBe("奇数B");
    expect(result.settings.pageOverrides[4].hashiraOverride).toBe("偶数B");
  });

  it("reports and updates odd-only selections", () => {
    const result = applyRunningHeads(settings(), [5, 1, 3]);
    expect(result.oddPages).toEqual([1, 3, 5]);
    expect(result.evenPages).toEqual([]);
  });

  it("reports and updates even-only selections", () => {
    const result = applyRunningHeads(settings(), [6, 2, 4]);
    expect(result.oddPages).toEqual([]);
    expect(result.evenPages).toEqual([2, 4, 6]);
  });

  it("replaces existing assignments in scope and preserves folio flags outside scope", () => {
    const result = applyRunningHeads(settings({ 2: { hashiraOverride: "old", hideNombre: true }, 3: { hashiraOverride: "outside", hideHashira: true } }), [2]);
    expect(result.settings.pageOverrides[2]).toEqual({ hashiraOverride: "偶数B", hideNombre: true });
    expect(result.settings.pageOverrides[3]).toEqual({ hashiraOverride: "outside", hideHashira: true });
  });
});

describe("Round 3 JPG scope", () => {
  it("uses all pages for no selection", () => expect(resolveJpgPageIndices(4, [])).toEqual([0, 1, 2, 3]));
  it("uses selected pages in canonical order", () => expect(resolveJpgPageIndices(8, [6, 1, 3, 1])).toEqual([1, 3, 6]));
});

describe("Round 3 output typography", () => {
  it.each([[9, 6], [6, 4], [4, 4], [9.5, 6.5]])("uses max(4, body - 3) for publication furniture", (body, expected) => {
    expect(publicationFurnitureFontSizePt(body)).toBe(expected);
  });
  it("keeps the Web reading body fixed while nombre/running-head stay recommended-but-editable", () => {
    // The final release fix (item 6) makes Web furniture user-editable and
    // persistent — these constants remain the *recommended* preset values
    // (applied by applyDestinationPaperPreset on paper switch), not a
    // permanent override normalizeOutputTypography re-applies afterward.
    expect([WEB_READING_BODY_FONT_SIZE, WEB_READING_FOLIO_FONT_SIZE, WEB_READING_RUNNING_HEAD_FONT_SIZE]).toEqual([30, 15, 20]);
    const web = normalizeOutputTypography({
      ...DEFAULT_PAGE_SETTINGS,
      paperSize: "Web閲覧用",
      fontSizePt: 36,
      masterPage: { ...DEFAULT_PAGE_SETTINGS.masterPage, nombreFontSize: undefined, headerFontSize: undefined },
    });
    expect(web.fontSizePt).toBe(WEB_READING_BODY_FONT_SIZE);
    const manual = normalizeOutputTypography({
      ...DEFAULT_PAGE_SETTINGS,
      paperSize: "Web閲覧用",
      masterPage: { ...DEFAULT_PAGE_SETTINGS.masterPage, nombreFontSize: 17, headerFontSize: 21 },
    });
    expect([manual.masterPage.nombreFontSize, manual.masterPage.headerFontSize]).toEqual([17, 21]);
  });
  it("does not leak Web sizes into print/PDF settings", () => {
    const print = normalizeOutputTypography({
      ...DEFAULT_PAGE_SETTINGS,
      fontSizePt: 9.5,
      masterPage: { ...DEFAULT_PAGE_SETTINGS.masterPage, nombreFontSize: undefined, headerFontSize: undefined },
    });
    expect(print.fontSizePt).toBe(9.5);
    expect(print.masterPage.nombreFontSize).toBe(6.5);
    expect(print.masterPage.headerFontSize).toBe(6.5);
  });
});

describe("Round 3 memo drafts", () => {
  it("round-trips and clears a work-scoped draft", () => {
    const map = new Map<string, string>();
    const storage = { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); }, removeItem: (key: string) => { map.delete(key); } };
    const key = memoDraftStorageKey("local:12");
    writeMemoDraft(storage, key, "draft");
    expect(readMemoDraft(storage, key)).toBe("draft");
    clearMemoDraft(storage, key);
    expect(readMemoDraft(storage, key)).toBeNull();
  });
  it("does not allow a blank draft to replace confirmed content", () => {
    expect(canConfirmMemoDraft("", "confirmed")).toBe(false);
    expect(canConfirmMemoDraft("new", "confirmed")).toBe(true);
    expect(canConfirmMemoDraft("", "")).toBe(true);
  });
});
