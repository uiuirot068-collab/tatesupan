// TSP-PHASE13-001 item 5: ぶら下げ組 through the real Editor bridge. A 、 that
// lands one cell past a full line stays on that line (Preview model and
// export paint plan alike), painted in the bottom margin, inside the paper.
import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "../pageLayout";
import { createFakeMeasurementProvider } from "../../../typesetting-v2/core/measurement/fakeProvider";
import { buildLivePreviewDocument } from "./previewWorkerProtocol";
import { composeV2Document, composeV2Layout } from "./composeV2Document";

const settings: PageSettings = { ...DEFAULT_PAGE_SETTINGS, charsPerLine: 10, linesPerColumn: 6, columnCount: 1 };
// paragraph-start indent takes one cell, so 9 kanji fill line 1 and the 、 overflows it
const content = `${"漢".repeat(9)}、${"字".repeat(5)}`;

describe("ぶら下げ組 through the Editor bridge", () => {
  it("the Preview model keeps the 、 on line 1 as a hanging unit", () => {
    const measurement = createFakeMeasurementProvider();
    const preview = buildLivePreviewDocument(composeV2Layout({ title: "T", content, settings, measurement }));
    const firstLine = preview.pages[0].columns[0].lines[0];
    const last = firstLine.units[firstLine.units.length - 1];
    expect(last.text).toBe("、");
    expect(last.hanging).toBe(true);
    expect(preview.pages[0].columns[0].lines[1].units[0].text).toBe("字");
  });

  it("export paints the hanging 、 past the line end but inside the paper", () => {
    const bridge = composeV2Document({ title: "T", content, settings, measurement: createFakeMeasurementProvider() });
    const g = bridge.pageGeometry;
    const unit = bridge.model.pages[0].columns[0].lines[0].units.at(-1)!;
    expect(unit.text).toBe("、");
    expect(unit.hanging).toBe(true);
    const lineExtentMm = settings.charsPerLine * (settings.fontSizePt * 25.4) / 72;
    // starts at (not before) the line end, still inside the paper
    expect(unit.topMm).toBeGreaterThanOrEqual(lineExtentMm - 1e-6);
    expect(g.marginTopMm + unit.topMm + unit.heightMm).toBeLessThan(g.paperHeightMm);
  });
});
