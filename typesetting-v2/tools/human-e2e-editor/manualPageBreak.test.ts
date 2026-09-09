import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "../../../src/lib/pageLayout";
import { composeV2Document } from "../../../src/lib/v2Bridge/composeV2Document";
import { buildV2PageGeometry, buildV2LayoutSettings } from "../../../src/lib/v2Bridge/settingsAdapter";
import { buildV2UnitsFromManuscript } from "../../../src/lib/v2Bridge/manuscriptAdapter";
import { createFakeMeasurementProvider } from "../../core/measurement/fakeProvider";
import { buildPaintDocument } from "../../renderer/preview/paintModel";
import { generatePublicationPdf, type PublicationFontResource } from "../../renderer/publication/pdfGenerator";
import { exportPaintPlanToJpgPages } from "../../renderer/publication/jpgExport";

const FONT_PATH = fileURLToPath(new URL("../../qa/publication/p3-o08/font-poc/fonts/ShipporiMincho-Regular.ttf", import.meta.url));
const MEASUREMENT = createFakeMeasurementProvider();

function settings(): PageSettings {
  return {
    ...DEFAULT_PAGE_SETTINGS,
    charsPerLine: 20,
    linesPerColumn: 10,
    columnCount: 1,
    masterPage: {
      ...DEFAULT_PAGE_SETTINGS.masterPage,
      nombrePosition: "hidden",
      hashiraOdd: "",
      hashiraEven: "",
    },
  };
}

function pageText(page: { columns: Array<{ lines: Array<{ units: Array<{ text: string }> }> }> }): string {
  return page.columns.flatMap((column) => column.lines.flatMap((line) => line.units.map((unit) => unit.text))).join("");
}

describe("development Editor manual page-break propagation", () => {
  it("creates one real shared Canonical boundary for Preview, PDF, Web JPG, and print JPG", async () => {
    const content = "text A\n【改ページ】\ntext B";
    const pageSettings = settings();
    const result = composeV2Document({ title: "Manual break", content, settings: pageSettings, measurement: MEASUREMENT });

    expect(result.document.pages).toHaveLength(2);
    expect(result.model.pages).toHaveLength(2);
    expect(result.plan).toHaveLength(2);
    expect(result.model.pages[1].manualBreakBefore).toBe(true);
    expect(result.model.pages.map(pageText)).toEqual(["text A", "text B"]);
    expect(result.model.pages.map(pageText).join("")).not.toContain("【改ページ】");

    const adapted = buildV2UnitsFromManuscript("body", content);
    const layout = buildV2LayoutSettings(pageSettings);
    const preview = buildPaintDocument("manual-break", "Manual break", result.document, adapted.units, adapted.source, {
      scaleMultiplier: 1,
      linePitchTicks: layout.linePitchTicks,
      lineExtentTicks: layout.lineExtentTicks,
      columnExtentTicks: layout.columnExtentTicks,
      columnsPerPage: layout.columnsPerPage,
      nominalCellTicks: MEASUREMENT.naturalAdvanceTick("body", pageSettings.fontSizePt, ""),
      measurementIdentity: result.document.version.measurementIdentity,
      paintFontIdentity: result.document.version.measurementIdentity,
    });
    expect(preview.pages).toHaveLength(2);
    expect(preview.pages[1].manualBreakBefore).toBe(true);
    expect(pageText(preview.pages[1])).toBe("text B");

    const fontBytes = readFileSync(FONT_PATH);
    const font: PublicationFontResource = {
      fileName: "ShipporiMincho-Regular.ttf",
      fontName: "ShipporiMincho",
      base64: fontBytes.toString("base64"),
    };
    const pdf = generatePublicationPdf(result.model, font, buildV2PageGeometry(pageSettings));
    expect(pdf.pageCount).toBe(2);
    expect(new TextDecoder().decode(pdf.bytes.slice(0, 5))).toBe("%PDF-");

    const webJpg = await exportPaintPlanToJpgPages(result.plan, font, "ManualBreak", "WEB", 72);
    const printJpg = await exportPaintPlanToJpgPages(result.plan, font, "ManualBreak", "PRINT", 72);
    expect(webJpg).toHaveLength(2);
    expect(printJpg).toHaveLength(2);
  });
});
