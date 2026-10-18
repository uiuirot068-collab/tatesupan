// TSP-PRINT-001: a long colophon continues on the next pages.
import { describe, expect, it } from "vitest";
import { createGuideColophonSettings } from "./colophon";
import { colophonTemplateLayoutPlan } from "./colophonLayoutPlan";
import { buildColophonPagePlans, colophonPlacementAreaMm, paginateColophonRenderPlan } from "./colophonPages";
import { buildColophonRenderPlan, type ColophonRenderPlan } from "./colophonRenderPlan";
import type { ColophonTemplateId } from "./colophon";

const TEMPLATES: ColophonTemplateId[] = ["standard", "center", "minimal", "classic"];
const rows = createGuideColophonSettings().fields.map((f) => ({ id: f.id, label: f.label, value: f.value }));
const longFree = Array.from({ length: 40 }, (_, i) => `自由欄の${i + 1}行目`).join("\n");

const texts = (plan: ColophonRenderPlan) => plan.items.flatMap((i) => (i.kind === "text" ? [i] : []));
const plan = (templateId: ColophonTemplateId, freeText = longFree) =>
  buildColophonRenderPlan({ templateId, rows, freeText, titleFallback: "", availableWidthEm: 30 });

describe("paginateColophonRenderPlan", () => {
  it.each(TEMPLATES)("%s: a colophon that fits is returned unchanged", (templateId) => {
    const p = plan(templateId, "短い自由欄");
    const pages = paginateColophonRenderPlan(p, p.heightEm + 0.01, templateId);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toBe(p);
  });

  it.each(TEMPLATES)("%s: every line appears once, in order, and every page fits", (templateId) => {
    const p = plan(templateId);
    const height = 20;
    const pages = paginateColophonRenderPlan(p, height, templateId);
    expect(pages.length).toBeGreaterThan(1);
    const lineHeight = colophonTemplateLayoutPlan(templateId).lineHeight;
    expect(pages.flatMap(texts).map((t) => t.text)).toEqual(texts(p).map((t) => t.text));
    for (const page of pages) {
      expect(page.heightEm).toBeLessThanOrEqual(height + 1e-6);
      for (const t of texts(page)) {
        expect(t.yEm - (t.fontScale * lineHeight) / 2).toBeGreaterThanOrEqual(-1e-6);
        expect(t.yEm + (t.fontScale * lineHeight) / 2).toBeLessThanOrEqual(page.heightEm + 1e-6);
      }
    }
  });

  it.each(TEMPLATES)("%s: a continuation page starts with its first line at the top", (templateId) => {
    const pages = paginateColophonRenderPlan(plan(templateId), 20, templateId);
    const layout = colophonTemplateLayoutPlan(templateId);
    const edge = templateId === "classic" ? layout.paddingYEm + layout.rowPaddingEm : 0;
    for (const page of pages.slice(1)) {
      const first = texts(page)[0];
      expect(first.yEm - (first.fontScale * layout.lineHeight) / 2).toBeCloseTo(edge, 6);
    }
  });

  it("classic: each page has its own frame around its part, and no rule sits at a page edge", () => {
    const pages = paginateColophonRenderPlan(plan("classic"), 20, "classic");
    for (const page of pages) {
      const frames = page.items.filter((i) => i.kind === "frame");
      expect(frames).toHaveLength(1);
      expect(frames[0]).toMatchObject({ yEm: 0, heightEm: page.heightEm });
      const t = texts(page);
      for (const rule of page.items.filter((i) => i.kind === "rule")) {
        expect(rule.yEm).toBeGreaterThan(t[0].yEm);
        expect(rule.yEm).toBeLessThan(t[t.length - 1].yEm);
      }
    }
  });

  it("a label and its value stay on the same page", () => {
    const p = buildColophonRenderPlan({ templateId: "standard", rows: Array.from({ length: 30 }, (_, i) => ({ id: `r${i}`, label: `項目${i}`, value: `値${i}` })), freeText: "", titleFallback: "", availableWidthEm: 30 });
    const pages = paginateColophonRenderPlan(p, 15, "standard");
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      const t = texts(page);
      for (let i = 0; i < 30; i++) {
        const hasLabel = t.some((x) => x.text === `項目${i}`);
        const hasValue = t.some((x) => x.text === `値${i}`);
        expect(hasLabel).toBe(hasValue);
      }
    }
  });
});

// TSP-PRINT-003: a row's label and value lines stay together on every template.
describe("paginateColophonRenderPlan keeps each row on one page", () => {
  const manyRows = Array.from({ length: 24 }, (_, i) => ({
    id: `r${i}`,
    label: `項目${i}`,
    // Every third value wraps onto several lines.
    value: i % 3 === 0 ? `値${i}の`.padEnd(40, "長") : `値${i}`,
  }));
  const rowsOnPages = (pages: ColophonRenderPlan[]) =>
    pages.map((page) => new Set(texts(page).flatMap((t) => (t.row === undefined ? [] : [t.row]))));

  it.each(TEMPLATES)("%s: no row is split across pages, for many page heights", (templateId) => {
    const p = buildColophonRenderPlan({ templateId, rows: manyRows, freeText: "", titleFallback: "", availableWidthEm: 16 });
    const layout = colophonTemplateLayoutPlan(templateId);
    const edge = templateId === "classic" ? layout.paddingYEm + layout.rowPaddingEm : 0;
    const rowHeight = (row: number) => {
      const own = texts(p).filter((t) => t.row === row);
      if (own.length === 0) return Infinity;
      const top = Math.min(...own.map((t) => t.yEm - (t.fontScale * layout.lineHeight) / 2));
      const bottom = Math.max(...own.map((t) => t.yEm + (t.fontScale * layout.lineHeight) / 2));
      return bottom - top;
    };
    let splitSeen = 0;
    for (let height = 6; height <= 30; height += 0.37) {
      const pages = paginateColophonRenderPlan(p, height, templateId);
      if (pages.length < 2) continue;
      splitSeen++;
      const sets = rowsOnPages(pages);
      for (let row = 0; row < manyRows.length; row++) {
        // Only a row that fits on a page at all can be kept whole.
        if (rowHeight(row) + 2 * edge > height) continue;
        expect(sets.filter((set) => set.has(row)).length, `row ${row} at height ${height}`).toBe(1);
      }
      expect(pages.flatMap(texts).map((t) => t.text)).toEqual(texts(p).map((t) => t.text));
    }
    expect(splitSeen).toBeGreaterThan(10);
  });

  it("center: a label never ends a page without its value (the reported case)", () => {
    const p = buildColophonRenderPlan({ templateId: "center", rows: manyRows, freeText: "", titleFallback: "", availableWidthEm: 30 });
    const label = texts(p).find((t) => t.text === "項目5")!;
    const layout = colophonTemplateLayoutPlan("center");
    // A page that ends just under the label of row 5.
    const height = label.yEm + (label.fontScale * layout.lineHeight) / 2 + 0.01;
    const pages = paginateColophonRenderPlan(p, height, "center");
    const pageWithLabel = pages.findIndex((page) => texts(page).some((t) => t.text === "項目5"));
    const pageWithValue = pages.findIndex((page) => texts(page).some((t) => t.text === "値5"));
    expect(pageWithLabel).toBe(pageWithValue);
  });

  it("a row taller than a page starts on a fresh page and continues line by line", () => {
    const tall = [{ id: "a", label: "短い", value: "一" }, { id: "b", label: "長い", value: "長".repeat(200) }];
    const p = buildColophonRenderPlan({ templateId: "standard", rows: tall, freeText: "", titleFallback: "", availableWidthEm: 16 });
    const pages = paginateColophonRenderPlan(p, 8, "standard");
    expect(pages.length).toBeGreaterThan(2);
    expect(texts(pages[0]).map((t) => t.text)).toEqual(["短い", "一"]);
    expect(texts(pages[1])[0].text).toBe("長い");
    expect(pages.flatMap(texts).map((t) => t.text)).toEqual(texts(p).map((t) => t.text));
  });
});

describe("buildColophonPagePlans", () => {
  const geometry = { paperWidthMm: 105, paperHeightMm: 148, marginTopMm: 15, marginBottomMm: 15, marginGutterMm: 18, marginOuterMm: 12 };
  it("uses the placement area: its width for wrapping and its height for pages", () => {
    const area = colophonPlacementAreaMm(geometry, { respectGutter: true, respectVerticalMargins: true }, true);
    expect(area).toEqual({ leftMm: 12, rightMm: 105 - 18, topMm: 15, bottomMm: 148 - 15 });
    const emMm = 3.5;
    const pages = buildColophonPagePlans({ templateId: "standard", rows, freeText: longFree, titleFallback: "", geometry, placement: { respectGutter: true, respectVerticalMargins: true }, emMm });
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) expect(page.heightEm * emMm).toBeLessThanOrEqual(area.bottomMm - area.topMm + 1e-6);
  });
});
