import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SETTINGS, resolvePaperSize, type PageSettings } from "../pageLayout";
import type { TocSettings } from "../tocSettings";
import { composeV2Document, composeV2Layout } from "./composeV2Document";
import { buildV2PageGeometry } from "./settingsAdapter";
import { buildV2PreviewPageModel } from "./previewPageModel";
import { buildPaintPlan, type PaintCommand, type PaintPlan } from "../../../typesetting-v2/renderer/publication/pdfGenerator";
import { createFakeMeasurementProvider } from "../../../typesetting-v2/core/measurement/fakeProvider";
import {
  previewFolioPlacement,
  previewFurnitureFrame,
  previewHeaderPlacement,
  resolveColophonPreviewFurniture,
  resolvePreviewHashira,
} from "../../components/previewFurniture";

// Phase 11 残件③ — page decoration (ノンブル / 柱) V2 canonical migration.
// Core decides WHAT each physical page carries; `renderer/furnitureGeometry.ts`
// decides WHERE, for the PDF/JPG paint plan AND the Preview overlays. These
// tests pin that the Publication paint plan puts every folio/柱 exactly where
// the Preview path (previewFurniture.ts) places it, on body / TOC / colophon,
// odd / even pages, with overrides on/off and decoration on/off.

const MEASUREMENT = createFakeMeasurementProvider();
type TextCommand = Extract<PaintCommand, { op: "text" }>;

const base = (extra: Partial<PageSettings> = {}, master: Partial<PageSettings["masterPage"]> = {}): PageSettings => ({
  ...DEFAULT_PAGE_SETTINGS,
  charsPerLine: 20,
  linesPerColumn: 8,
  columnCount: 1,
  marginGutter: 18,
  marginOuter: 10,
  ...extra,
  masterPage: { ...DEFAULT_PAGE_SETTINGS.masterPage, hashiraOdd: "奇数柱", hashiraEven: "偶数柱", nombrePosition: "outer", nombreFontSize: 6, headerFontSize: 7, ...master },
});
const paragraphs = (count: number) => Array.from({ length: count }, (_, i) => `「第${i + 1}頁の本文です」`).join("\n【改ページ】\n");

function furniture(plan: PaintPlan, physicalIndex: number, role: "folio" | "running-head"): TextCommand | undefined {
  return plan[physicalIndex].commands.find((c): c is TextCommand => c.op === "text" && c.furnitureRole === role);
}

function expectPreviewParity(settings: PageSettings, content: string) {
  const bridge = composeV2Document({ title: "T", content, settings, measurement: MEASUREMENT });
  const paper = resolvePaperSize(settings.paperSize);
  const frame = previewFurnitureFrame(settings, paper);
  const sequence = bridge.document.pageSequence;
  let checkedFolio = 0;
  let checkedHeader = 0;
  sequence.forEach((ref, physicalIndex) => {
    const page = ref.kind === "body" ? bridge.document.pages[ref.index] : bridge.document.colophon!.pages[ref.index];
    const isOdd = (physicalIndex + 1) % 2 === 1;
    const folio = furniture(bridge.plan, physicalIndex, "folio");
    if (page.folio) {
      const at = previewFolioPlacement(page.folio.position, frame, isOdd, settings.masterPage.nombreFontSize!);
      expect(folio, `folio on physical page ${physicalIndex + 1}`).toMatchObject({ text: page.folio.text, xMm: at.xMm, yMm: at.yCenterMm, align: at.align });
      checkedFolio += 1;
    } else {
      expect(folio).toBeUndefined();
    }
    const header = furniture(bridge.plan, physicalIndex, "running-head");
    if (page.header) {
      const at = previewHeaderPlacement(page.header.position.band, page.header.position.horizontal, frame, isOdd);
      expect(header, `柱 on physical page ${physicalIndex + 1}`).toMatchObject({ text: page.header.text, xMm: at.xMm, yMm: at.yCenterMm, align: at.align });
      checkedHeader += 1;
    } else {
      expect(header).toBeUndefined();
    }
  });
  return { bridge, checkedFolio, checkedHeader };
}

describe("Phase 11 残件③: Publication furniture == Preview furniture placement", () => {
  it("body pages, odd and even, ノド/小口 mirrored: every folio and 柱 lands where the Preview paints it", () => {
    const { bridge, checkedFolio, checkedHeader } = expectPreviewParity(base(), paragraphs(4));
    expect(bridge.document.pages.length).toBe(4);
    expect(checkedFolio).toBe(4);
    expect(checkedHeader).toBe(4);
    // outer folio: odd page → left frame edge (小口 10mm), even → right frame edge (小口 10mm)
    const paper = resolvePaperSize("文庫");
    expect(furniture(bridge.plan, 0, "folio")).toMatchObject({ xMm: 10, align: "left" });
    expect(furniture(bridge.plan, 1, "folio")).toMatchObject({ xMm: paper.widthMm - 10, align: "right" });
    expect(furniture(bridge.plan, 0, "running-head")).toMatchObject({ text: "奇数柱" });
    expect(furniture(bridge.plan, 1, "running-head")).toMatchObject({ text: "偶数柱" });
  });

  it.each(["center", "gutter", "outer"] as const)("nombre position %s and 柱 at the bottom band stay in parity", (nombrePosition: "center" | "gutter" | "outer") => {
    expectPreviewParity(base({}, { nombrePosition, hashiraPosition: "bottom" }), paragraphs(3));
  });

  it("per-page overrides (柱 off / 柱 text / ノンブル off) are honoured identically", () => {
    const settings = base({ pageOverrides: { 2: { hideHashira: true }, 3: { hashiraOverride: "差替柱", hideNombre: true } } });
    const { bridge } = expectPreviewParity(settings, paragraphs(4));
    expect(furniture(bridge.plan, 1, "running-head")).toBeUndefined();
    expect(furniture(bridge.plan, 2, "running-head")).toMatchObject({ text: "差替柱" });
    expect(furniture(bridge.plan, 2, "folio")).toBeUndefined();
    expect(furniture(bridge.plan, 3, "folio")).toMatchObject({ text: "4" });
  });

  it("decoration off: hidden nombre and empty 柱 paint no furniture at all", () => {
    const { bridge, checkedFolio, checkedHeader } = expectPreviewParity(base({}, { nombrePosition: "hidden", hashiraOdd: "", hashiraEven: "" }), paragraphs(2));
    expect(checkedFolio + checkedHeader).toBe(0);
    expect(bridge.plan.flatMap((p) => p.commands).some((c) => c.op === "text" && c.furnitureRole !== undefined)).toBe(false);
  });

  it("first-page nombre suppression is decided by Core for both paths", () => {
    const { bridge } = expectPreviewParity(base({}, { hideNombreOnFirstPage: true }), paragraphs(2));
    expect(furniture(bridge.plan, 0, "folio")).toBeUndefined();
    expect(furniture(bridge.plan, 1, "folio")).toMatchObject({ text: "2" });
  });

  it("TOC pages: folio kept, no 柱, same placement as the Preview", () => {
    const toc: TocSettings = {
      enabled: true,
      items: [{ title: "第一章", pageNumber: 2 }, { title: "第二章", pageNumber: 3 }],
      position: { mode: "start" },
      leader: "dots",
      updatedAt: 1,
    };
    const content = "# 第一章\n「一章の本文」\n【改ページ】\n# 第二章\n「二章の本文」";
    const { bridge } = expectPreviewParity(base({ toc }), content);
    const firstToc = bridge.document.pages[0];
    expect(firstToc.folio).toBeDefined();
    expect(firstToc.header).toBeUndefined();
  });

  it("colophon page (end and mid-book): Core's colophon folio/柱 paint where the Preview colophon card paints them", () => {
    for (const pagePosition of [{ mode: "end" as const }, { mode: "after-body-page" as const, afterBodyPage: 1 }]) {
      const settings = base({ colophon: { ...DEFAULT_PAGE_SETTINGS.colophon, enabled: true, pagePosition } });
      const { bridge } = expectPreviewParity(settings, paragraphs(3));
      const colophonIndex = bridge.document.pageSequence.findIndex((ref) => ref.kind === "colophon");
      expect(colophonIndex).toBeGreaterThan(0);
      // The Preview model hands the colophon card exactly Core's furniture.
      const model = buildV2PreviewPageModel(composeV2Layout({ title: "T", content: paragraphs(3), settings, measurement: MEASUREMENT }), paragraphs(3));
      const colophonPage = model.pages.find((page) => page.kind === "colophon");
      const canonical = bridge.document.colophon!.pages[0];
      expect(colophonPage?.furniture?.folio).toEqual(canonical.folio);
      expect(colophonPage?.furniture?.header).toEqual(canonical.header);
      const resolved = resolveColophonPreviewFurniture({ canonicalFurniture: colophonPage?.furniture, legacyNombre: null, legacySide: "center" });
      expect(resolved.nombre).toEqual({ value: Number(canonical.folio!.text), side: canonical.folio!.position });
      expect(resolved.hashira?.text).toBe(canonical.header!.text);
    }
  });
});

describe("Phase 11 残件③: the text frame follows the same parity as the Preview sheet", () => {
  it("an even page's body moves by (ノド − 小口) relative to the odd page, as the Preview padding mirrors", () => {
    const settings = base({}, { nombrePosition: "hidden", hashiraOdd: "", hashiraEven: "" });
    const bridge = composeV2Document({ title: "T", content: paragraphs(2), settings, measurement: MEASUREMENT });
    const firstTextX = (i: number) => bridge.plan[i].commands.find((c): c is TextCommand => c.op === "text")!.xMm;
    expect(firstTextX(1) - firstTextX(0)).toBeCloseTo(settings.marginGutter - settings.marginOuter, 10);
  });

  it("symmetric margins: odd and even pages are identical (no movement)", () => {
    const settings = base({ marginGutter: 14, marginOuter: 14 }, { nombrePosition: "hidden", hashiraOdd: "", hashiraEven: "" });
    const bridge = composeV2Document({ title: "T", content: paragraphs(2), settings, measurement: MEASUREMENT });
    const firstTextX = (i: number) => bridge.plan[i].commands.find((c): c is TextCommand => c.op === "text")!.xMm;
    expect(firstTextX(1)).toBeCloseTo(firstTextX(0), 10);
  });

  it("without Editor furniture geometry the historical fixed frame and furniture are unchanged (renderer fixtures, tools)", () => {
    const settings = base();
    const bridge = composeV2Document({ title: "T", content: paragraphs(2), settings, measurement: MEASUREMENT });
    const { furniture: _furniture, ...legacyGeometry } = buildV2PageGeometry(settings);
    void _furniture;
    const legacyPlan = buildPaintPlan(bridge.model, true, legacyGeometry);
    const firstTextX = (i: number) => legacyPlan[i].commands.find((c): c is TextCommand => c.op === "text" && c.furnitureRole === undefined)!.xMm;
    expect(firstTextX(1)).toBeCloseTo(firstTextX(0), 10);
    const paperH = legacyGeometry.paperHeightMm;
    expect(furniture(legacyPlan, 0, "folio")).toMatchObject({ align: "center", yMm: paperH - legacyGeometry.marginBottomMm / 2 });
  });
});

describe("Phase 11 残件③: settings → geometry", () => {
  it("print papers carry the Editor furniture geometry (saved settings, no format change)", () => {
    const settings = base({}, { nombreBottomMargin: 7 });
    expect(buildV2PageGeometry(settings).furniture).toEqual({ marginGutterMm: 18, marginOuterMm: 10, folioBottomEdgeMm: 7 });
  });

  it("Web閲覧用 keeps its own web-reading furniture (no print geometry)", () => {
    expect(buildV2PageGeometry(base({ paperSize: "Web閲覧用" })).furniture).toBeUndefined();
  });
});

describe("Phase 11 残件③: Preview 柱 resolution", () => {
  it("V2: Core's header decides presence, text and side", () => {
    expect(
      resolvePreviewHashira({
        hasCanonicalPage: true,
        canonicalHeader: { text: "差替柱", position: { band: "bottom", horizontal: "right" } },
        legacyText: "古い柱",
        hideHashira: true,
        legacyBand: "top",
        isOddPage: true,
      })
    ).toEqual({ show: true, text: "差替柱", band: "bottom", horizontal: "right" });
    expect(resolvePreviewHashira({ hasCanonicalPage: true, canonicalHeader: undefined, legacyText: "古い柱", hideHashira: false, legacyBand: "top", isOddPage: true }).show).toBe(false);
  });

  it("LEGACY: master/override text on the 小口 side, hidden by the per-page flag", () => {
    expect(resolvePreviewHashira({ hasCanonicalPage: false, canonicalHeader: undefined, legacyText: "柱", hideHashira: false, legacyBand: "top", isOddPage: true })).toEqual({
      show: true,
      text: "柱",
      band: "top",
      horizontal: "left",
    });
    expect(resolvePreviewHashira({ hasCanonicalPage: false, canonicalHeader: undefined, legacyText: "柱", hideHashira: false, legacyBand: "top", isOddPage: false }).horizontal).toBe("right");
    expect(resolvePreviewHashira({ hasCanonicalPage: false, canonicalHeader: undefined, legacyText: "柱", hideHashira: true, legacyBand: "top", isOddPage: true }).show).toBe(false);
  });

  it("LEGACY colophon keeps nombre only, no 柱", () => {
    expect(resolveColophonPreviewFurniture({ canonicalFurniture: undefined, legacyNombre: { value: 5, isOddPage: true }, legacySide: "left" })).toEqual({
      nombre: { value: 5, side: "left" },
      hashira: null,
    });
  });
});
