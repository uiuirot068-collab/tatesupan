import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "../pageLayout";
import { composeV2Layout } from "./composeV2Document";
import { buildLivePreviewDocument } from "./previewWorkerProtocol";
import { samePaintPage } from "./paintPageEquality";
import { createFakeMeasurementProvider } from "../../../typesetting-v2/core/measurement/fakeProvider";

// Phase 8: PageCard skips re-rendering a page whose paint data is unchanged
// by a new layout. Deterministic (fake measurement).

const MEASUREMENT = createFakeMeasurementProvider();
const settings: PageSettings = { ...DEFAULT_PAGE_SETTINGS, charsPerLine: 10, linesPerColumn: 6, columnCount: 1 };
const PARAGRAPH = "　吾輩は｜猫《ねこ》である。名前は《《まだ》》無い――どこで生れたか……";
const pagesFor = (content: string) =>
  structuredClone(buildLivePreviewDocument(composeV2Layout({ title: "T", content, settings, measurement: MEASUREMENT })).pages);

describe("samePaintPage", () => {
  const manuscript = Array.from({ length: 12 }, () => PARAGRAPH).join("\n");

  it("a recomposition of the same text (new objects) is equal page by page", () => {
    const a = pagesFor(manuscript);
    const b = pagesFor(manuscript);
    expect(a.length).toBeGreaterThan(3);
    a.forEach((page, i) => {
      expect(page).not.toBe(b[i]);
      expect(samePaintPage(page, b[i])).toBe(true);
    });
  });

  it("typing at the end keeps earlier pages equal and changes the last one", () => {
    const before = pagesFor(manuscript);
    const after = pagesFor(`${manuscript}あ`);
    const last = before.length - 1;
    for (let i = 0; i < last; i++) expect(samePaintPage(before[i], after[i])).toBe(true);
    expect(samePaintPage(before[last], after[last])).toBe(false);
  });

  it("an edit on the first page changes it (and reflowed later pages), never a false equal", () => {
    const before = pagesFor(manuscript);
    const after = pagesFor(`あ${manuscript}`);
    expect(samePaintPage(before[0], after[0])).toBe(false);
    expect(samePaintPage(before[1], after[1])).toBe(false);
  });

  it("any paint field difference is detected (text, geometry, ruby, 傍点, missing field)", () => {
    const [page] = pagesFor(manuscript);
    const unitPaths = page.columns.flatMap((column) => column.lines.flatMap((line) => line.units));
    const ruby = unitPaths.findIndex((unit) => unit.rubyAnnotation);
    const emphasis = unitPaths.findIndex((unit) => unit.emphasisDots);
    expect(ruby).toBeGreaterThan(-1);
    expect(emphasis).toBeGreaterThan(-1);
    const mutate = (edit: (units: typeof unitPaths) => void) => {
      const copy = structuredClone(page);
      edit(copy.columns.flatMap((column) => column.lines.flatMap((line) => line.units)));
      return samePaintPage(page, copy);
    };
    expect(mutate(() => {})).toBe(true);
    expect(mutate((units) => { units[0].text = "X"; })).toBe(false);
    expect(mutate((units) => { units[1].topPx += 0.001; })).toBe(false);
    expect(mutate((units) => { const annotation = units[ruby].rubyAnnotation; if (annotation?.status === "PLACED") annotation.text = "ちがう"; })).toBe(false);
    expect(mutate((units) => { units[emphasis].emphasisDots!.flowCentersPx.pop(); })).toBe(false);
    expect(mutate((units) => { delete units[ruby].rubyAnnotation; })).toBe(false);
    expect(samePaintPage(page, undefined)).toBe(false);
    expect(samePaintPage(undefined, undefined)).toBe(true);
  });

  it("PageCard's memo comparator uses it for the V2 page (source contract; no DOM test environment)", () => {
    const pageCard = readFileSync(resolve("src/components/PageCard.tsx"), "utf8");
    expect(pageCard).toContain("samePaintPage(prev.v2PreviewPage, next.v2PreviewPage)");
    expect(pageCard).not.toContain("prev.v2PreviewPage === next.v2PreviewPage");
  });
});
