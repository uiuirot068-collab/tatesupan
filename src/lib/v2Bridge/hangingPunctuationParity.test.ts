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

  // Human QA 2026-10-02: the hanging glyph was given a ~0 extent (clamped to the
  // exhausted line), so PDF/JPG drew it on top of the line's last character
  // and the Preview clipped it away entirely.
  it("gives the hanging 、 its own full cell in Preview and export, below the last character", () => {
    const measurement = createFakeMeasurementProvider();
    const preview = buildLivePreviewDocument(composeV2Layout({ title: "T", content, settings, measurement }));
    const previewUnits = preview.pages[0].columns[0].lines[0].units;
    const [previewPrev, previewHang] = previewUnits.slice(-2);
    expect(previewHang.heightPx).toBeCloseTo(previewPrev.heightPx, 3);
    expect(previewHang.topPx).toBeCloseTo(previewPrev.topPx + previewPrev.heightPx, 3);

    const bridge = composeV2Document({ title: "T", content, settings, measurement: createFakeMeasurementProvider() });
    const units = bridge.model.pages[0].columns[0].lines[0].units;
    const [prev, hang] = units.slice(-2);
    expect(hang.heightMm).toBeCloseTo(prev.heightMm, 6);
    const text = bridge.plan[0].commands.filter((c): c is Extract<typeof c, { op: "text" }> => c.op === "text");
    const prevCmd = text.find((c) => c.text === "漢" && Math.abs(c.yMm - Math.max(...text.filter((t) => t.text === "漢").map((t) => t.yMm))) < 1e-9)!;
    const hangCmd = text.find((c) => c.text === "︑" || c.text === "、")!;
    // one full cell below the last 漢, never overlapping it
    expect(hangCmd.yMm - prevCmd.yMm).toBeGreaterThan(prev.heightMm * 0.5);
  });
});
