import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "../pageLayout";
import { composeV2Layout } from "./composeV2Document";
import { ExportWorkerSession } from "./exportWorkerProtocol";
import { publicationModelOf } from "./previewWorkerProtocol";
import { PUBLICATION_FONT_ASSETS, publicationFontAssetFor } from "../v2BrowserExport";
import { FONT_FAMILY_OPTIONS } from "../../constants/fonts";
import { createFakeMeasurementProvider } from "../../../typesetting-v2/core/measurement/fakeProvider";
import type { PublicationFontResource } from "../../../typesetting-v2/renderer/publication/pdfGenerator";

// TSP-PHASE13-001: PDF embeds the Editor's chosen fonts — the body font for
// the text (and its glyph metrics / vertical outlines), plus the ノンブル and
// 奥付 fonts when they differ. Only the system「serif」stack has no file and
// falls back to Shippori Mincho.

const MEASUREMENT = createFakeMeasurementProvider();
const loads: string[] = [];
const loadFont = async (cssFamily?: string): Promise<PublicationFontResource> => {
  const asset = publicationFontAssetFor(cssFamily);
  loads.push(asset.fontName);
  return { fileName: asset.fileName, fontName: asset.fontName, base64: readFileSync(resolve(`public${asset.path}`)).toString("base64") };
};
const decode = async () => ({ data: new Uint8Array(4), width: 1, height: 1 });

const ZEN = "'Zen Old Mincho', serif";
const NOTO_SANS = "'Noto Sans JP', sans-serif";
const NOTO_SERIF = "'Noto Serif JP', serif";

function settingsWith(body: string, nombre: string, colophon: string): PageSettings {
  return {
    ...DEFAULT_PAGE_SETTINGS,
    fontFamily: body,
    masterPage: { ...DEFAULT_PAGE_SETTINGS.masterPage, nombreFontFamily: nombre },
    colophon: {
      ...DEFAULT_PAGE_SETTINGS.colophon,
      enabled: true,
      fontFamily: colophon,
      fields: [{ id: "title", label: "書名", value: "確認用", visible: true }],
    },
  };
}

/** BaseFont names embedded in the PDF (subset prefix removed). */
function embeddedFonts(bytes: Uint8Array): string[] {
  const raw = Buffer.from(bytes).toString("latin1");
  return [...new Set([...raw.matchAll(/\/BaseFont\s*\/([^\s/<>\]]+)/g)].map((m) => m[1].replace(/^[A-Z]{6}\+/, "").replace(/#20/g, " ")))].sort();
}

/** Fonts selected (Tf) in the content streams, as resource names → count. */
function usedFontResources(bytes: Uint8Array): Set<string> {
  const raw = Buffer.from(bytes).toString("latin1");
  const used = new Set<string>();
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let text: string;
    try {
      text = inflateSync(Buffer.from(m[1], "latin1")).toString("latin1");
    } catch {
      continue;
    }
    for (const tf of text.matchAll(/\/(F\d+)\s+[\d.]+\s+Tf/g)) used.add(tf[1]);
  }
  return used;
}

async function exportPdf(settings: PageSettings) {
  loads.length = 0;
  const session = new ExportWorkerSession({ loadFont, decode });
  const publication = structuredClone(publicationModelOf(composeV2Layout({ title: "T", content: "　吾輩は「猫」である。名前はまだ無い……。ニャーと鳴いた――ABC、123。", settings, measurement: MEASUREMENT })));
  session.receiveModel({ ok: true, publication } as Parameters<ExportWorkerSession["receiveModel"]>[0]);
  const indices = publication.pageSequence.map((_, index) => index);
  const result = await session.renderPdf({ physicalIndices: indices, layerOrder: {}, mode: "trim" });
  return result.bytes;
}

describe("TSP-PHASE13-001 PDF font selection", () => {
  it("has an embeddable file for every Editor font choice except the system stack", () => {
    expect(PUBLICATION_FONT_ASSETS).toHaveLength(FONT_FAMILY_OPTIONS.length);
    expect(publicationFontAssetFor(ZEN).fontName).toBe("Zen Old Mincho");
    expect(publicationFontAssetFor("serif").fontName).toBe("Shippori Mincho");
    expect(publicationFontAssetFor(undefined).fontName).toBe("Shippori Mincho");
  });

  it("embeds the body font only when ノンブル and 奥付 follow the body", async () => {
    const bytes = await exportPdf(settingsWith(ZEN, "", ""));
    expect(embeddedFonts(bytes)).toEqual(["Zen Old Mincho"]);
    expect(loads).toEqual(["Zen Old Mincho"]);
  });

  it("embeds and uses separate ノンブル and 奥付 fonts", async () => {
    const bytes = await exportPdf(settingsWith(ZEN, NOTO_SANS, NOTO_SERIF));
    expect(embeddedFonts(bytes)).toEqual(["Noto Sans JP", "Noto Serif JP", "Zen Old Mincho"]);
    expect(usedFontResources(bytes).size).toBe(3);
  });

  it("keeps the historical Shippori-only PDF for the default settings", async () => {
    const bytes = await exportPdf(settingsWith(DEFAULT_PAGE_SETTINGS.fontFamily, "", ""));
    expect(embeddedFonts(bytes)).toEqual(["Shippori Mincho"]);
  });

  it.each(FONT_FAMILY_OPTIONS.map((option) => [option.label, option.value]))("paints a whole document (vertical body, ノンブル, 奥付) in %s", async (_label, value) => {
    const bytes = await exportPdf(settingsWith(value, "", ""));
    expect(embeddedFonts(bytes)).toEqual([publicationFontAssetFor(value).fontName]);
  }, 30_000);
});
