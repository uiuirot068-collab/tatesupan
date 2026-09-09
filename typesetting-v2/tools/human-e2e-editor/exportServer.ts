import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "../../../src/lib/pageLayout";
import { composeV2Document } from "../../../src/lib/v2Bridge/composeV2Document";
import { buildV2LayoutSettings, buildV2PageGeometry } from "../../../src/lib/v2Bridge/settingsAdapter";
import { buildV2UnitsFromManuscript } from "../../../src/lib/v2Bridge/manuscriptAdapter";
import { createShipporiMinchoMeasurementProvider } from "../../core/measurement/shipporiMinchoProvider";
import { mmToTicks } from "../../core/geometry/tick";
import { buildPaintDocument } from "../../renderer/preview/paintModel";
import { generatePublicationPdf, type PublicationFontResource } from "../../renderer/publication/pdfGenerator";

export interface QaInput { content: string; fontSizePt: number; lineHeightRatio: number; charsPerLine: number; linesPerColumn: number }
const FONT_PATH = fileURLToPath(new URL("../../qa/publication/p3-o08/font-poc/fonts/ShipporiMincho-Regular.ttf", import.meta.url));

function settingsFor(input: QaInput): PageSettings {
  return { ...DEFAULT_PAGE_SETTINGS, paperSize: "A5", fontFamily: "Shippori Mincho", fontSizePt: input.fontSizePt, lineHeightRatio: input.lineHeightRatio, charsPerLine: input.charsPerLine, linesPerColumn: input.linesPerColumn, columnCount: 1, layoutMode: "capacity", masterPage: { ...DEFAULT_PAGE_SETTINGS.masterPage, nombrePosition: "hidden", hashiraOdd: "", hashiraEven: "" }, pageOverrides: {}, colophon: { ...DEFAULT_PAGE_SETTINGS.colophon, enabled: false } };
}

function compose(input: QaInput) {
  const settings = settingsFor(input);
  const measurement = createShipporiMinchoMeasurementProvider(FONT_PATH);
  const bridge = composeV2Document({ title: "TateSpun v2 Human E2E QA", content: input.content, settings, measurement });
  return { settings, bridge };
}

export async function buildPreview(input: QaInput) {
  const { settings, bridge } = compose(input);
  const adapted = buildV2UnitsFromManuscript("body", input.content);
  const layout = buildV2LayoutSettings(settings);
  return buildPaintDocument("human-e2e", "v2 Canonical Preview", bridge.document, adapted.units, adapted.source, { scaleMultiplier: 0.72, linePitchTicks: layout.linePitchTicks, lineExtentTicks: layout.lineExtentTicks, columnExtentTicks: layout.columnExtentTicks, columnsPerPage: layout.columnsPerPage, nominalCellTicks: mmToTicks((settings.fontSizePt * 25.4) / 72), maxPages: 6, measurementIdentity: bridge.document.version.measurementIdentity, paintFontIdentity: bridge.document.version.measurementIdentity, bodyFontSizeTick: mmToTicks((settings.fontSizePt * 25.4) / 72) });
}

export async function buildPdf(input: QaInput): Promise<Uint8Array> {
  const { settings, bridge } = compose(input);
  const fontBytes = readFileSync(FONT_PATH);
  const font: PublicationFontResource = { fileName: "ShipporiMincho-Regular.ttf", fontName: "ShipporiMincho", base64: fontBytes.toString("base64") };
  return generatePublicationPdf(bridge.model, font, buildV2PageGeometry(settings)).bytes;
}
