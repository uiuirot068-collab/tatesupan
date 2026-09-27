import { describe, expect, it } from "vitest";
import { computeMaxCapacityChars, computePageLayout, DEFAULT_PAGE_SETTINGS, deriveMaxCapacityFromMargins, type PageSettings } from "../pageLayout";
import { PAPER_SIZE_TEMPLATES } from "../../constants/paperSizes";
import { applyColumnCountPreset, applyDestinationPaperPreset } from "../paperPresets";
import { composeV2Document } from "./composeV2Document";
import { buildV2PreviewDocument } from "./buildV2PreviewDocument";
import { createFakeMeasurementProvider } from "../../../typesetting-v2/core/measurement/fakeProvider";
import { tickToMm } from "../../../typesetting-v2/renderer/publication/geometry";

// Phase 9 Human QA: 設定 → A5 → 2段 painted the two 段 side by side in V2.
// TateSpun 2段 is 上段 → 下段 (legacy computePageLayout / PageCard). These
// tests lock that Preview and Publication paint the same stacked geometry,
// that each 段 starts where legacy's 段 frame starts, and that the isolated
// horizontal colophon keeps its historical geometry.

const MEASUREMENT = createFakeMeasurementProvider();
// PageSettingsPanel: every paper/段数 preset is followed by
// deriveCapacityFromCurrentMargins (default layoutMode "margin").
const deriveCapacity = (settings: PageSettings): PageSettings => ({
  ...settings,
  ...deriveMaxCapacityFromMargins({
    paperSize: settings.paperSize,
    marginTop: settings.marginTop,
    marginBottom: settings.marginBottom,
    marginGutter: settings.marginGutter,
    marginOuter: settings.marginOuter,
    fontSizePt: settings.fontSizePt,
    lineHeightRatio: settings.lineHeightRatio,
    columnCount: settings.columnCount,
    columnGapMm: settings.columnGapMm,
  }),
});
const a5 = (columnCount: 1 | 2, colophon = false): PageSettings => {
  const paper = deriveCapacity(applyDestinationPaperPreset(DEFAULT_PAGE_SETTINGS, "A5"));
  const settings = deriveCapacity(applyColumnCountPreset(paper, columnCount));
  return colophon ? { ...settings, colophon: { ...settings.colophon, enabled: true } } : settings;
};
const LONG = Array.from({ length: 80 }, (_, i) => `第${i}段落。吾輩は猫である。名前はまだ無い。どこで生れたか頓と見当がつかぬ。`).join("\n");

describe("A5 2段 is a top/bottom stack in both Preview and Publication", () => {
  const settings = a5(2, true);
  const bridge = composeV2Document({ title: "T", content: LONG, settings, measurement: MEASUREMENT });
  const preview = buildV2PreviewDocument(bridge, {});
  const layout = computePageLayout(settings);

  it("uses the real A5 2段 preset (non-zero 段間)", () => {
    expect(settings.columnCount).toBe(2);
    expect(settings.columnGapMm).toBeGreaterThan(0);
    expect(bridge.columnStackDirection).toBe("vertical");
  });

  it("Publication: 下段 starts at the legacy 段 frame + 段間 and every unit stays inside the text area", () => {
    const fullPage = bridge.model.pages.find((page) => page.columns.length === 2);
    expect(fullPage).toBeDefined();
    const [upper, lower] = fullPage!.columns;
    expect(upper.rightMm).toBe(0);
    expect(lower.rightMm).toBe(0);
    const lowerStartMm = layout.columnHeightMm + settings.columnGapMm;
    const upperUnits = upper.lines.flatMap((l) => l.units);
    const lowerUnits = lower.lines.flatMap((l) => l.units);
    expect(Math.max(...upperUnits.map((u) => u.topMm + u.heightMm))).toBeLessThanOrEqual(layout.columnHeightMm + 1e-6);
    expect(Math.min(...lowerUnits.map((u) => u.topMm))).toBeCloseTo(lowerStartMm, 1);
    for (const page of bridge.model.pages) {
      expect(page.heightMm).toBeLessThanOrEqual(layout.textAreaHeightMm + 1e-6);
      expect(page.widthMm).toBeLessThanOrEqual(layout.textAreaWidthMm + 1e-6);
      for (const unit of page.columns.flatMap((c) => c.lines.flatMap((l) => l.units))) {
        expect(unit.topMm + unit.heightMm).toBeLessThanOrEqual(page.heightMm + 1e-6);
      }
    }
  });

  it("PaintPlan (PDF/JPG): every body glyph baseline lies in the 上段 or 下段 band, never in 段間 or the bottom margin", () => {
    const top = settings.marginTop;
    const upperEnd = top + layout.columnHeightMm;
    const lowerStart = upperEnd + settings.columnGapMm;
    const bottom = bridge.pageGeometry.paperHeightMm - settings.marginBottom;
    const bodyPlans = bridge.document.pageSequence
      .map((ref, i) => ({ ref, plan: bridge.plan[i] }))
      .filter(({ ref }) => ref.kind === "body");
    expect(bodyPlans.length).toBeGreaterThan(1);
    let upper = 0;
    let lower = 0;
    for (const { plan } of bodyPlans) {
      for (const command of plan.commands) {
        if (command.op !== "text" || command.furnitureRole) continue;
        const inUpper = command.yMm > top && command.yMm <= upperEnd;
        const inLower = command.yMm > lowerStart && command.yMm <= bottom;
        expect(inUpper || inLower, `y=${command.yMm}`).toBe(true);
        if (inUpper) upper++;
        if (inLower) lower++;
      }
    }
    expect(upper).toBeGreaterThan(0);
    expect(lower).toBeGreaterThan(0);
  });

  it("Preview paints the same stacked positions as Publication (px vs mm is only a unit change)", () => {
    bridge.model.pages.forEach((publicationPage, i) => {
      const previewPage = preview.pages[bridge.document.pageSequence.findIndex((ref) => ref.kind === "body" && ref.index === i)];
      expect(previewPage.widthPx / previewPage.heightPx).toBeCloseTo(publicationPage.widthMm / publicationPage.heightMm, 6);
      publicationPage.columns.forEach((column, c) => {
        expect(previewPage.columns[c].rightPx).toBe(0);
        const pub = column.lines.flatMap((l) => l.units);
        const pre = previewPage.columns[c].lines.flatMap((l) => l.units);
        pre.forEach((unit, k) => {
          expect(unit.topPx / previewPage.heightPx).toBeCloseTo(pub[k].topMm / publicationPage.heightMm, 6);
        });
      });
    });
  });

  it("the colophon keeps its historical horizontal geometry (no body 2段 stack leak)", () => {
    expect(bridge.model.colophonPages?.length).toBeGreaterThan(0);
    const colophonPreview = preview.pages.filter((_, i) => bridge.document.pageSequence[i].kind === "colophon");
    const { lineExtentTicks, columnExtentTicks, columnsPerPage } = bridge.layoutSettings;
    for (const page of bridge.model.colophonPages!) {
      expect(page.heightMm).toBeCloseTo(tickToMm(lineExtentTicks), 6);
      expect(page.widthMm).toBeCloseTo(tickToMm(columnsPerPage * columnExtentTicks), 6);
      page.columns.forEach((column, c) => {
        expect(column.rightMm).toBeCloseTo(tickToMm(c * columnExtentTicks), 6);
        for (const unit of column.lines.flatMap((l) => l.units)) {
          expect(unit.topMm).toBeLessThan(tickToMm(lineExtentTicks));
        }
      });
    }
    for (const page of colophonPreview) {
      expect(page.orientation).toBe("horizontal");
      page.columns.forEach((column, c) => {
        expect(column.rightPx).toBeCloseTo(c * column.widthPx, 6);
      });
    }
  });
});

describe("1段 is unchanged by the stack helper", () => {
  it("A5 1段 keeps a single horizontal-origin column with the line extent as body height", () => {
    const settings = a5(1);
    const bridge = composeV2Document({ title: "T", content: LONG, settings, measurement: MEASUREMENT });
    expect(bridge.columnStackDirection).toBe("horizontal");
    for (const page of bridge.model.pages) {
      expect(page.columns).toHaveLength(1);
      expect(page.columns[0].rightMm).toBe(0);
      expect(page.heightMm).toBeCloseTo(tickToMm(bridge.layoutSettings.lineExtentTicks), 6);
      expect(page.widthMm).toBeCloseTo(tickToMm(bridge.layoutSettings.columnExtentTicks), 6);
    }
  });
});

describe("margin-mode maximum capacity is per 段 for 2段 (settings layer)", () => {
  const papers = Object.keys(PAPER_SIZE_TEMPLATES) as PageSettings["paperSize"][];
  for (const paperSize of papers) {
    it(`${paperSize}: 2段 lines fit one 段; 1段 is the unchanged full-height maximum`, () => {
      const one = deriveCapacity(applyDestinationPaperPreset({ ...DEFAULT_PAGE_SETTINGS, columnCount: 1 }, paperSize));
      const oneLayout = computePageLayout(one);
      expect(one.charsPerLine).toBe(computeMaxCapacityChars(oneLayout.textAreaHeightMm, oneLayout.fontSizeMm));

      const two = deriveCapacity(applyColumnCountPreset(deriveCapacity(applyDestinationPaperPreset(DEFAULT_PAGE_SETTINGS, paperSize)), 2));
      const twoLayout = computePageLayout(two);
      expect(twoLayout.charsPerLine).toBe(two.charsPerLine);
      expect(two.charsPerLine * twoLayout.fontSizeMm).toBeLessThanOrEqual(twoLayout.columnHeightMm + 1e-9);
      expect(2 * twoLayout.columnHeightMm + two.columnGapMm).toBeLessThanOrEqual(twoLayout.textAreaHeightMm + 1e-9);
    });
  }
});

describe("2段 keeps ruby / 傍点 / TCY with their body glyphs and leaves ノンブル untouched", () => {
  const RICH = Array.from({ length: 60 }, (_, i) => `第${i}段落。｜漢字《かんじ》と《《傍点》》と[tate]12[/tate]を含む本文です。吾輩は猫である。`).join("\n");
  const one = a5(1);
  const two = a5(2);
  const plan1 = composeV2Document({ title: "T", content: RICH, settings: one, measurement: MEASUREMENT });
  const plan2 = composeV2Document({ title: "T", content: RICH, settings: two, measurement: MEASUREMENT });
  const layout = computePageLayout(two);

  it("every body text / ruby / emphasis command of a 2段 page lies inside the 上段 or 下段 band", () => {
    const top = two.marginTop;
    const upperEnd = top + layout.columnHeightMm;
    const lowerStart = upperEnd + two.columnGapMm;
    const bottom = plan2.pageGeometry.paperHeightMm - two.marginBottom;
    const inBand = (y: number) => (y > top - 1 && y <= upperEnd + 1) || (y > lowerStart - 1 && y <= bottom + 1);
    let ruby = 0;
    let dots = 0;
    let lowerGlyphs = 0;
    plan2.document.pageSequence.forEach((ref, i) => {
      if (ref.kind !== "body") return;
      for (const command of plan2.plan[i].commands) {
        if (command.op === "text" && !command.furnitureRole) {
          expect(inBand(command.yMm), `text "${command.text}" y=${command.yMm}`).toBe(true);
          if (command.fontSizePt < two.fontSizePt * 0.75) ruby++;
          if (command.yMm > lowerStart) lowerGlyphs++;
        }
        if (command.op === "circle") {
          expect(inBand(command.yMm), `emphasis y=${command.yMm}`).toBe(true);
          dots++;
        }
      }
    });
    expect(ruby).toBeGreaterThan(0);
    expect(dots).toBeGreaterThan(0);
    expect(lowerGlyphs).toBeGreaterThan(0);
  });

  it("ノンブル text, position and font size are the same in 1段 and 2段 (furniture never follows the body stack)", () => {
    const folios = (bridge: typeof plan1) =>
      bridge.plan.flatMap((page) => page.commands.filter((c) => c.op === "text" && c.furnitureRole === "folio"));
    const f1 = folios(plan1);
    const f2 = folios(plan2);
    expect(f1.length).toBeGreaterThan(0);
    expect(f2.length).toBeGreaterThan(0);
    const first1 = f1[0] as Extract<(typeof f1)[number], { op: "text" }>;
    const first2 = f2[0] as Extract<(typeof f2)[number], { op: "text" }>;
    expect(first2.text).toBe(first1.text);
    expect(first2.yMm).toBeCloseTo(first1.yMm, 6);
    expect(first2.xMm).toBeCloseTo(first1.xMm, 6);
    expect(first2.fontSizePt).toBe(first1.fontSizePt);
    expect(two.masterPage.nombreBottomMargin).toBe(one.masterPage.nombreBottomMargin);
  });
});
